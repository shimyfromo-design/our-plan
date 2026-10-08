/* Our Plan — feel: a pressed state within 50 ms, motion under 300 ms (off with Reduce Motion), swipe back,
 * sheets you drag down, swipe-left to delete, charts you can touch, the "Logged" bar with Undo,
 * one small tip per feature (once per person) and the one-time "What's new" sheet. */
import { esc, icon, toast, closeSheet, sheetOpen, openSheet } from './core.js?v=c1a0501fca';
import { S, applyOptimistic } from './store.js?v=5199216217';
import { Queue } from './api.js?v=d44773a102';

export const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

// ------------------------------------------------------------------ pressed state (B9)
export function initPressed() {
  const SEL = 'button, .row, .trow, .tile, [role="button"]';
  let cur = null;
  const clear = () => { if (cur) { cur.classList.remove('pressed'); cur = null; } };
  document.addEventListener('pointerdown', (e) => { const el = e.target.closest && e.target.closest(SEL); if (!el || el.disabled) return; clear(); cur = el; el.classList.add('pressed'); }, { passive: true });
  ['pointerup', 'pointercancel', 'pointerleave', 'scroll'].forEach((t) => document.addEventListener(t, clear, { passive: true, capture: t === 'scroll' }));
  document.addEventListener('touchstart', () => {}, { passive: true }); // iOS: makes :active fire immediately
}

// ------------------------------------------------------------------ screen transitions
const TOP = new Set(['summary', 'plan', 'together', 'coach']);
export function enter(app, from, to, dir) {
  if (reduceMotion() || !from) return;
  const cls = TOP.has(from) && TOP.has(to) ? 'fx-fade' : (dir === 'back' ? 'fx-pop' : 'fx-push');
  app.classList.remove('fx-fade', 'fx-push', 'fx-pop');
  void app.offsetWidth;
  app.classList.add(cls);
  setTimeout(() => app.classList.remove(cls), 300);
}

// ------------------------------------------------------------------ numbers count up
const shown = new Map();
export function countUp(root) {
  root.querySelectorAll('[data-count]').forEach((el) => {
    const target = +el.dataset.count;
    const key = el.dataset.countKey || '';
    if (!isFinite(target)) return;
    const from = key && shown.has(key) ? shown.get(key) : 0;
    if (key) shown.set(key, target);
    if (reduceMotion() || from === target) return;
    const dec = (String(el.dataset.count).split('.')[1] || '').length;
    const t0 = performance.now(), dur = 280;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (from + (target - from) * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(step); else el.textContent = el.dataset.count;
    };
    requestAnimationFrame(step);
  });
}

// ------------------------------------------------------------------ swipe back from the left edge
export function initSwipeBack(back, allowed) {
  let x0 = 0, y0 = 0, t0 = 0, dragging = false, app = null, hash0 = '';
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || sheetOpen() || !allowed()) return;
    const t = e.touches[0];
    if (t.clientX > 24) return;
    x0 = t.clientX; y0 = t.clientY; t0 = Date.now(); dragging = true; app = document.getElementById('app'); hash0 = location.hash;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const t = e.touches[0], dx = t.clientX - x0, dy = Math.abs(t.clientY - y0);
    if (dy > 40 && dx < 30) { dragging = false; app.style.transform = ''; return; }
    if (dx > 0) { app.style.transition = 'none'; app.style.transform = 'translateX(' + dx + 'px)'; }
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!dragging) return;
    dragging = false;
    const dx = (e.changedTouches[0] || {}).clientX - x0, v = dx / Math.max(1, Date.now() - t0);
    app.style.transition = 'transform .22s ease-out';
    if (dx > window.innerWidth * 0.33 || (dx > 50 && v > 0.5)) {
      app.style.transform = 'translateX(100%)';
      // exactly one step: if the phone's own edge gesture already went back, don't go back a second time (G1)
      setTimeout(() => { app.style.transition = 'none'; app.style.transform = ''; if (location.hash === hash0) back(); requestAnimationFrame(() => { app.style.transition = ''; }); }, 200);
    } else { app.style.transform = ''; setTimeout(() => { app.style.transition = ''; }, 230); }
  });
}

// ------------------------------------------------------------------ drag a sheet down to close it
export function initSheetDrag() {
  let y0 = 0, dy = 0, sheet = null, active = false;
  document.addEventListener('touchstart', (e) => {
    const s = e.target.closest && e.target.closest('.sheet');
    if (!s || e.touches.length !== 1) return;
    const body = s.querySelector('.sheet-body');
    if (body && body.scrollTop > 0 && !e.target.closest('.grab, .sheet-head')) return;
    sheet = s; y0 = e.touches[0].clientY; dy = 0; active = true;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!active) return;
    dy = e.touches[0].clientY - y0;
    if (dy > 0) { sheet.style.transition = 'none'; sheet.style.transform = 'translateY(' + dy + 'px)'; }
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (!active) return;
    active = false;
    sheet.style.transition = '';
    if (dy > 110) { sheet.style.transform = ''; closeSheet(); }
    else sheet.style.transform = '';
  });
}

// ------------------------------------------------------------------ swipe left to delete (.swipe rows)
export function initSwipeRows() {
  let el = null, x0 = 0, y0 = 0, dx = 0, mode = '';
  const W = 88;
  // G3: the row (its text and its background together) slides; the red Delete grows to fill exactly the space it leaves,
  // so it always sits flush against the row — never a gray gap
  const place = (s, x, animate) => {
    const inner = s.querySelector('.swipe-inner'), del = s.querySelector('.swipe-del');
    inner.style.transition = animate ? '' : 'none';
    if (del) { del.style.transition = animate ? '' : 'none'; del.style.width = Math.max(W, -x) + 'px'; del.style.transform = 'translateX(' + (x === 0 ? '100%' : '0') + ')'; }
    inner.style.transform = x ? 'translateX(' + x + 'px)' : '';
  };
  const closeAll = (except) => document.querySelectorAll('.swipe.open').forEach((s) => { if (s !== except) { s.classList.remove('open'); place(s, 0, true); } });
  document.addEventListener('touchstart', (e) => {
    const s = e.target.closest && e.target.closest('.swipe');
    if (!s || e.target.closest('.swipe-del')) { if (!s) closeAll(); return; }
    closeAll(s);
    el = s; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; mode = '';
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (!el) return;
    const t = e.touches[0];
    const mx = t.clientX - x0, my = t.clientY - y0;
    if (!mode) mode = Math.abs(mx) > 8 && Math.abs(mx) > Math.abs(my) ? 'x' : (Math.abs(my) > 8 ? 'y' : '');
    if (mode !== 'x') return;
    el.classList.add('dragging');
    dx = Math.min(0, Math.max(-W * 1.4, mx + (el.classList.contains('open') ? -W : 0)));
    place(el, dx, false);
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (!el) return;
    el.classList.remove('dragging');
    if (mode === 'x') {
      if (dx < -W * 1.25) { const del = el.querySelector('.swipe-del'); place(el, 0, true); el.classList.remove('open'); if (del) del.click(); }
      else if (dx < -W / 2) { el.classList.add('open'); place(el, -W, true); }
      else { el.classList.remove('open'); place(el, 0, true); }
    }
    el = null;
  });
}

// ------------------------------------------------------------------ charts you can touch
export function initCharts() {
  const handle = (e) => {
    const svg = e.target.closest && e.target.closest('svg.chart[data-pts]');
    if (!svg) return;
    const pts = JSON.parse(svg.dataset.pts || '[]');
    if (!pts.length) return;
    const r = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const x = ((e.clientX - r.left) / r.width) * vb.width;
    let best = pts[0];
    pts.forEach((p) => { if (Math.abs(p.x - x) < Math.abs(best.x - x)) best = p; });
    let tip = svg.parentElement.querySelector('.chart-tip');
    if (!tip) { tip = document.createElement('div'); tip.className = 'chart-tip'; tip.setAttribute('role', 'status'); svg.parentElement.appendChild(tip); }
    tip.innerHTML = '<b>' + esc(best.v) + '</b><span>' + esc(best.l) + '</span>';
    tip.style.left = Math.max(56, Math.min(r.width - 56, (best.x / vb.width) * r.width)) + 'px';
    tip.classList.add('on');
    let mark = svg.querySelector('.sel');
    if (!mark) { mark = document.createElementNS('http://www.w3.org/2000/svg', 'g'); mark.setAttribute('class', 'sel'); svg.appendChild(mark); }
    mark.innerHTML = '<line x1="' + best.x + '" x2="' + best.x + '" y1="8" y2="' + (vb.height - 22) + '"/><circle cx="' + best.x + '" cy="' + best.y + '" r="5"/>';
  };
  document.addEventListener('pointerdown', handle);
  document.addEventListener('pointermove', (e) => { if (e.buttons || e.pointerType === 'touch') handle(e); });
}

// ------------------------------------------------------------------ tips: at most one per feature, once per person (B12)
export function tipSeen(key) {
  const seen = Object.assign({}, (S.settings().tips_seen) || {}, S.ui.tips || {});
  return !!seen[key];
}
/** Show a feature's one small tip the first time it's used (stored per person on the server). */
export function tipOnce(key, text) {
  if (!S.ready || tipSeen(key)) return;
  S.setUi('tips', Object.assign({}, S.ui.tips || {}, { [key]: true }));
  S.write('settings', { values: { tips_seen: { [key]: true } } }, { optimistic: false });
  setTimeout(() => toast(text, { icon: 'info', ms: 4200 }), 350);
}
/** "What's new" once per installed app, on the first open after this update (Round 3.2: what was fixed). Kept on the phone
 * only, so re-adding the icon (SETUP) shows it once more; an iPhone Safari tab used to check the link doesn't use it up. */
export function whatsNew() {
  if (!S.ready || !S.setupDone() || (S.ui.tips || {}).whatsnew_r32 || sheetOpen()) return;
  if (navigator.standalone === false) return;
  S.setUi('tips', Object.assign({}, S.ui.tips || {}, { whatsnew_r32: true }));
  const line = (ic, t, sub) => `<div class="row static">${icon(ic)}<span class="row-main"><span class="row-label">${esc(t)}</span><span class="row-sub">${esc(sub)}</span></span></div>`; // icons in the accent color (.row > .ic)
  openSheet({ title: 'What\'s new', label: 'What\'s new', body: `<div class="inset">${line('volume-2', 'The voice plays every time', 'Workouts, Play and Talk')}${line('camera', 'Your photos in the chat', 'The coach works out what they are')}${line('shopping-cart', 'A list you can shop from', 'Store amounts, staples folded away')}</div>` });
}

// ------------------------------------------------------------------ "Logged" bar with Undo (B9)
const results = new Map();   // cid -> server data (with undo refs)
const pendingUndo = new Set();
export function noteResult(op, data) {
  results.set(op.cid, data || {});
  if (pendingUndo.has(op.cid)) { pendingUndo.delete(op.cid); retractAll(op.cid); }
}
function retractAll(cid) {
  const d = results.get(cid) || {};
  (d.undo || []).forEach((r) => S.write('retract', { tab: r.tab, id: r.id }));
  dropLocal(cid);
}
function dropLocal(cid) {
  if (!S.data) return;
  const pid = 'tmp_' + cid;
  Object.values(S.data.logs || {}).forEach((lg) => Object.keys(lg).forEach((k) => { lg[k] = lg[k].filter((r) => !String(r.id || '').startsWith(pid)); }));
  if (S.data.together && S.data.together.cheers) S.data.together.cheers = S.data.together.cheers.filter((c) => !String(c.id || '').startsWith(pid));
  S.persist(); S.changed();
}
/** Show "Logged." with Undo for a queued write. */
export function logged(op, text) {
  toast(text || 'Logged.', { icon: 'check', ms: 5000, action: { label: 'Undo', act: 'undo-op', data: { 'data-cid': op.cid } } });
}
export function undoOp(cid) {
  const queued = Queue.items().find((o) => o.cid === cid);
  if (queued && !(Queue.busy && Queue.items()[0] && Queue.items()[0].cid === cid)) { Queue.remove(cid); dropLocal(cid); }
  else if (results.has(cid)) retractAll(cid);
  else { pendingUndo.add(cid); dropLocal(cid); }
  toast('Undone.', { icon: 'rotate-ccw' });
}
export { applyOptimistic };
