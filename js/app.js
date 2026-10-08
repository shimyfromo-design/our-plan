/* Our Plan — boot, routing (four tabs), events, sync. */
import { L, $, esc, icon, toast, closeSheet, sheetOpen, todayISO } from './core.js?v=c1a0501fca';
import { Config, Queue, LS, call } from './api.js?v=d44773a102';
import { S } from './store.js?v=5199216217';
import { route, go, back, onRender, rerender, takeDirection, stamp } from './nav.js?v=57c55c9996';
import * as Voice from './voice.js?v=decfa3dab7';
import * as Mic from './mic.js?v=99eadb1765';
import * as PushClient from './push.js?v=cfef6cc387';
import * as fx from './fx.js?v=34cbfc2a31';
import * as Summary from './views/summary.js?v=e8a04af291';
import * as Plan from './views/plan.js?v=07f795f837';
import * as Workout from './views/workout.js?v=943b0227cc';
import * as Sos from './views/sos.js?v=41f1b378d8';
import * as Together from './views/together.js?v=934c68fec2';
import * as Coach from './views/coach.js?v=5f87e5bc8a';
import * as Me from './views/me.js?v=8edb7eed1e';
import * as Setup from './views/setup.js?v=2e9cc6c3c9';
import * as Install from './views/install.js?v=d348c3dde6';

const TABS = [['summary', 'Summary', 'layout-grid'], ['plan', 'Plan', 'calendar'], ['together', 'Together', 'users'], ['coach', 'Coach', 'message-circle']];
const TAB_SET = new Set(TABS.map((t) => t[0]));
const MODULES = { summary: Summary, plan: Plan, workout: Workout, sos: Sos, together: Together, coach: Coach, me: Me, setup: Setup };
/** Full-screen routes: no tab bar. */
const FULL = new Set(['workout', 'sos', 'setup', 'coach/talk', 'together/recap']);
/** Old routes (Rounds 1–2) go to their new homes (C1). */
const REDIRECT = {
  today: 'summary', food: 'plan', progress: 'summary/weight', labs: 'summary/labs', doctor: 'summary/doctor', recap: 'together/recap', guided: 'workout', more: 'me',
  'more/settings': 'me/settings', 'more/partner': 'me/partner', 'more/modes': 'me/modes', 'more/health': 'me/health', 'more/backups': 'me/backups', 'more/about': 'me/about',
  'more/knows': 'coach/knows', 'more/supplements': 'plan/supplements', 'more/guides': 'coach/guides'
};
let baseTab = 'summary'; // the tab under the You sheet
const keyOf = (r) => r.parts.join('/') || r.name;
const isFull = (r) => FULL.has(r.name) || FULL.has(r.parts.slice(0, 2).join('/'));
/** Which tab a route belongs to (for the tab bar and "back"). */
function tabOf(r) { return TAB_SET.has(r.name) ? r.name : (r.name === 'me' ? baseTab : (r.name === 'workout' || r.name === 'sos' ? 'plan' : 'summary')); }

// ------------------------------------------------------------------ actions
const all = [Summary, Plan, Workout, Sos, Together, Coach, Me, Setup, Install];
const actions = Object.assign({}, ...all.map((m) => m.actions || {}), {
  go(el) { closeSheet(); go(el.dataset.to); },
  back(el) { closeSheet(); back(el && el.dataset.to ? el.dataset.to : parentOf(route())); },
  me() { go('me'); },
  'sheet-close'() { closeSheet(); },
  noop() {},
  'sync-now'() { S.flush(); S.sync(); },
  speak(el) { Voice.toggle(el.dataset.vkey, el.dataset.text || ''); },
  'mic-stop'() { if (Coach.micStop) Coach.micStop(); else Mic.cancel(); },
  'undo-op'(el) { fx.undoOp(el.dataset.cid); }
});
const changes = Object.assign({}, ...all.map((m) => m.changes || {}));
function parentOf(r) {
  if (r.name === 'me' && r.parts[1]) return 'me';
  if (TAB_SET.has(r.name) && r.parts[1]) return r.name;
  return tabOf(r);
}

const lastTap = new WeakMap(); // a tap can never be sent twice (B9, E6): a second tap on the same control within 450 ms is ignored
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled || el.getAttribute('aria-busy') === 'true') return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  const now = Date.now();
  if (now - (lastTap.get(el) || 0) < 450) return;
  lastTap.set(el, now);
  try { const r = fn(el, e); if (r && r.catch) r.catch(report); } catch (err) { report(err); }
});
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
  if (e.key === 'Escape' && sheetOpen()) closeSheet();
  if (e.key === 'Enter' && e.target.matches('input[data-enter]')) {
    e.preventDefault();
    const fn = actions[e.target.dataset.enter];
    if (fn) { try { const r = fn(e.target, e); if (r && r.catch) r.catch(report); } catch (err) { report(err); } }
  }
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const fn = changes[el.dataset.change];
  if (fn) { try { const r = fn(el, e); if (r && r.catch) r.catch(report); } catch (err) { report(err); } }
});

// ------------------------------------------------------------------ problem catcher: app errors reach the owner's digest
const reported = new Set();
export function sendProblem(message, stack, where) {
  const key = String(message).slice(0, 120);
  if (reported.has(key) || reported.size > 20 || !Config.token) return;
  reported.add(key);
  call('report', { message: String(message).slice(0, 300), stack: String(stack || '').slice(0, 1500), where: where || keyOf(route()), version: window.OUR_PLAN_VERSION || '' }).catch(() => {});
}
window.addEventListener('error', (e) => { if (e && e.message && !/Script error/.test(e.message)) sendProblem(e.message, (e.error && e.error.stack) || (e.filename + ':' + e.lineno), keyOf(route())); });
window.addEventListener('unhandledrejection', (e) => { const r = e && e.reason; if (r && !(r.code && r.message)) sendProblem((r && r.message) || String(r), r && r.stack, keyOf(route())); });
function report(err) {
  console.error(err);
  if (!(err && err.code)) sendProblem((err && err.message) || String(err), err && err.stack, keyOf(route()));
  toast(err && err.code && err.message ? err.message : (err && err.friendly) || 'Something went wrong. Your data is safe. Please try again.', { kind: 'err' });
}

// ------------------------------------------------------------------ rendering
let lastKey = '', lastName = '';
const scrollPos = {};
function view(r) {
  if (!Config.token) return Install.render(r);
  if (!S.ready) return loading();
  if (r.name === 'setup') return Setup.render(r);
  if (r.name === 'me' && !r.parts[1]) return (MODULES[baseTab] || Summary).render({ name: baseTab, parts: [baseTab], params: r.params });
  const m = MODULES[r.name];
  return m ? m.render(r) : Summary.render({ name: 'summary', parts: ['summary'], params: r.params });
}
function loading() {
  const err = S.error;
  if (err) {
    return `<div class="install"><div class="app-mark"><img src="icons/icon-512-v32.png" alt=""></div><h1 class="title">Our Plan</h1>
      <p class="body">${esc(err.code === 'bad_token' ? 'This link isn\'t valid anymore.' : err.message)}</p>
      ${err.code === 'bad_token' ? '<p class="sub">Ask for your new personal link (your initial → Settings on the other phone), then open it.</p>' : '<button class="btn-primary" data-act="sync-now"><span>Try again</span></button>'}</div>`;
  }
  return '<div class="skeleton" aria-busy="true" aria-label="Getting your plan"><div class="sk h"></div><div class="sk line"></div><div class="sk card"></div><div class="sk card short"></div><div class="sk card short"></div></div>';
}
function tabbar(r) {
  if (!Config.token || !S.ready || isFull(r) || r.name === 'setup') return '';
  const on = tabOf(r);
  // E2: a dot only when there is something new to see there (a cheer, a recap); it clears when you see it
  const dot = { together: S.togetherDot() };
  return TABS.map(([k, label, ic]) => `<a href="#/${k}" class="tab${on === k ? ' on' : ''}" ${on === k ? 'aria-current="page"' : ''} aria-label="${label}${dot[k] ? ', something new' : ''}">${icon(ic)}<span>${label}</span>${dot[k] ? '<i class="badge"></i>' : ''}</a>`).join('');
}
function render() {
  let r = route();
  const red = REDIRECT[r.parts.slice(0, 2).join('/')] || REDIRECT[r.name];
  if (red) { history.replaceState(history.state, '', location.pathname + location.search + '#/' + red); r = route(); }
  stamp(); // G1: this screen's place in history, so back is exactly one step
  if (TAB_SET.has(r.name)) baseTab = r.name;
  const key = keyOf(r);
  const app = $('#app');
  const a = document.activeElement;
  const keep = a && a.id && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && app.contains(a) && !a.dataset.noKeep ? { id: a.id, value: a.value, s: a.selectionStart, e: a.selectionEnd } : null;
  const changed = key !== lastKey;
  if (changed && lastKey) {
    scrollPos[lastKey] = window.scrollY;
    all.forEach((m) => { if (m.leave) { try { m.leave(lastKey, key); } catch (e) { /* ignore */ } } });
  }
  let html;
  try { html = view(r); } catch (err) { console.error(err); sendProblem(err.message, err.stack, key); html = `<div class="install"><h1 class="title">Sorry</h1><p class="body">Something on this screen broke. Your data is safe.</p><button class="btn-primary" data-act="go" data-to="summary"><span>Go to Summary</span></button></div>`; }
  app.innerHTML = html;
  const full = isFull(r) || !Config.token || r.name === 'setup';
  app.className = (r.name === 'coach' && !r.parts[1] ? 'coach-screen' : '');
  const nav = $('#tabs');
  const tb = tabbar(r);
  nav.innerHTML = tb;
  nav.hidden = !tb;
  document.body.classList.toggle('no-tabs', !tb);
  document.body.classList.toggle('flow-on', full);
  document.body.classList.toggle('has-nav', !!app.querySelector('.nav'));
  document.body.dataset.route = key;
  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) { el.value = keep.value; el.focus(); try { el.setSelectionRange(keep.s, keep.e); } catch (e) { /* type=number */ } }
  }
  const dir = takeDirection();
  if (changed) {
    window.scrollTo(0, dir === 'back' ? (scrollPos[key] || 0) : 0);
    fx.enter(app, lastName, r.name, dir);
    lastKey = key; lastName = r.name;
  }
  onScroll();
  fx.countUp(app);
  syncPlayButtons();
  const m = r.name === 'me' && !r.parts[1] ? MODULES[baseTab] : MODULES[r.name];
  // D2: nothing after the screen is drawn can stop the app (Oct 8: a crash here left a blank screen on every open)
  const safe = (fn) => { try { fn(); } catch (e) { console.error(e); sendProblem(e.message, e.stack, key); } };
  if (m && m.afterRender) safe(() => m.afterRender(r));
  // the You sheet: closing it (Done, the dimmed page, a drag) returns to the tab underneath; opening a row navigates on
  if (r.name === 'me' && !r.parts[1] && !sheetOpen()) safe(() => Me.openYou(() => setTimeout(() => { if (route().name === 'me' && !route().parts[1]) back(baseTab); }, 0)));
  if (TAB_SET.has(r.name) && !r.parts[1] && S.ready && Config.token) safe(() => fx.whatsNew()); // once per person (it remembers itself)
  document.title = r.parts[1] === 'doctor' ? 'Health summary' : 'Our Plan';
  window.__opRendered = true; // the first screen is up: the startup guard (js/guard.js) stands down
}
onRender(render);
window.addEventListener('hashchange', () => { if (!(route().name === 'me' && !route().parts[1])) closeSheet(); render(); });
const onScroll = () => document.body.classList.toggle('scrolled', window.scrollY > 24);

/** One Play/Pause control per reply (E2): "Play" shows a spinner at once while the line loads (A3), then "Pause". */
function syncPlayButtons() {
  const cur = Voice.nowPlaying();
  document.querySelectorAll('[data-act="speak"]').forEach((b) => {
    const mine = !!cur && cur.key === b.dataset.vkey;
    const loading = mine && cur.loading && cur.mode !== 'audio' && !cur.paused;
    const on = mine && !cur.paused;
    b.classList.toggle('loading', loading);
    b.setAttribute('aria-busy', loading ? 'true' : 'false');
    if (b.classList.contains('btn-icon')) { // the speaker button keeps its icon; a spinner sits on it while loading
      b.classList.toggle('on', on && !loading); b.setAttribute('aria-pressed', on ? 'true' : 'false'); b.style.setProperty('--c', 'var(--accent)');
      const sp = b.querySelector('.spin');
      if (loading && !sp) b.insertAdjacentHTML('beforeend', '<span class="spin" aria-hidden="true"></span>'); else if (!loading && sp) sp.remove();
      return;
    }
    const label = on && !loading ? 'Pause' : 'Play';
    const span = b.querySelector('span:not(.spin)');
    if (span && span.textContent !== label) span.textContent = label;
    const want = loading ? 'spin' : (on ? 'pause' : 'play');
    if (b.dataset.ic !== want) {
      const old = b.querySelector('svg, .spin');
      if (old) old.outerHTML = want === 'spin' ? '<span class="spin" aria-hidden="true"></span>' : icon(want, 'ic-xs');
      b.dataset.ic = want;
    }
    b.setAttribute('aria-label', loading ? 'Loading the voice' : label);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}
Voice.onChange(syncPlayButtons);

// ------------------------------------------------------------------ sync
S.flush = () => Queue.flush({
  done(op, data) {
    fx.noteResult(op, data);
    if (data && data.warning) toast(data.warning, { ms: 9000 });
    else if (data && data.celebrate && data.celebrate.length) toast(data.celebrate[0].title + '.', { icon: 'star', ms: 4000 });
  },
  failed(op, err) { toast('Couldn\'t save: ' + err.message, { kind: 'err', ms: 6000 }); },
  after() { setTimeout(() => S.sync(), 800); }
});
let renderQueued = false;
S.onChange(() => { if (renderQueued) return; renderQueued = true; requestAnimationFrame(() => { renderQueued = false; if (!busyTyping()) render(); else syncPlayButtons(); }); });
function busyTyping() { const a = document.activeElement; return a && a.tagName === 'TEXTAREA' && a.id === 'chat-in' && a.value; }
Queue.onChange(() => S.changed());
let pointerChecked = '';
S.onSynced = () => {
  const p = S.data && S.data.household && S.data.household.app_pointer;
  if (p && p !== pointerChecked && window.OurPlanPointer) { pointerChecked = p; window.OurPlanPointer.follow(p); }
  PushClient.rememberKey(S.data && S.data.flags && S.data.flags.vapid); // C1: the key is on the phone before any tap
  PushClient.refresh().catch(() => {});
  Voice.precacheFixed(); // A2: the chosen voice's workout lines stay on the phone
};
function maybeSync(force) {
  if (!Config.token) return;
  S.flush();
  if (force || Date.now() - S.lastSync > 60000) S.sync();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { readPendingRoute(); maybeSync(); render(); }
  else { Voice.stop(); Mic.close(); }
});
window.addEventListener('online', () => maybeSync(true));
setInterval(() => {
  if (document.visibilityState !== 'visible') return;
  const r = route();
  const typing = document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (!typing && !sheetOpen() && !Mic.open() && (r.name === 'summary' || r.name === 'together') && !r.parts[1]) render();
  if (Date.now() - S.lastSync > 5 * 60000) maybeSync();
}, 60000);

/** Jewish calendar straight from Hebcal if the app has none cached yet (first run / offline-first). */
async function ensureCalendar() {
  const today = todayISO();
  if (S.cal()[today] && S.cal()[L.addDays(today, 7)]) return;
  try {
    const url = 'https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&min=on&mod=off&nx=on&mf=on&ss=on&c=on&geo=geoname&geonameid=5110302&M=on&s=on&d=on&start=' + L.addDays(today, -7) + '&end=' + L.addDays(today, 30);
    const r = await fetch(url, { credentials: 'omit' });
    if (!r.ok) return;
    LS.set('op_cal', JSON.stringify(L.parseHebcal(await r.json())));
    S.changed();
  } catch (e) { /* offline */ }
}

// ------------------------------------------------------------------ notification routes (E8)
const ROUTE_CACHE = 'op-route';
/** A tapped notification leaves its route for the app: in the address (?open=…) or in Cache Storage. */
async function readPendingRoute() {
  const q = new URLSearchParams(location.search);
  const open = q.get('open');
  if (open && /^[a-z/]+$/.test(open)) {
    q.delete('open');
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + '#/' + open);
    closeSheet(); render();
    return;
  }
  try {
    if (!('caches' in window)) return;
    const c = await caches.open(ROUTE_CACHE);
    const hit = await c.match('pending-route');
    if (!hit) return;
    const j = await hit.json();
    await c.delete('pending-route');
    if (j && j.route && Date.now() - (j.at || 0) < 10 * 60000 && /^[a-z/]+$/.test(j.route)) { closeSheet(); go(j.route); }
  } catch (e) { /* ignore */ }
}

// ------------------------------------------------------------------ service worker: updates apply on the next launch (D1)
// A new version installs completely in the background and then WAITS. It is applied when the app is next opened: at a
// cold start, or when the app comes back after being in the background — never in the middle of using it, a workout or Talk.
let swReg = null, applying = false, hiddenAt = 0, lastCheck = Date.now();
const midSession = () => route().name === 'workout' || route().name === 'sos' || Mic.open() || Voice.speaking();
function applyUpdate(reg) {
  if (!reg || !reg.waiting || applying || midSession()) return false;
  applying = true;
  reg.waiting.postMessage('skipWaiting');
  return true;
}
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').then((reg) => { swReg = reg; applyUpdate(reg); }).catch(() => {}); // cold start = a launch
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (applying) location.reload(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    if (!swReg) return;
    if (swReg.waiting && hiddenAt && Date.now() - hiddenAt > 20000) applyUpdate(swReg); // back after a while = a launch
    else if (Date.now() - lastCheck > 30 * 60000) { lastCheck = Date.now(); swReg.update().catch(() => {}); } // look for a new version (installs quietly, waits)
  });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'open' && e.data.route) { closeSheet(); go(String(e.data.route).replace(/^#?\/?/, '')); caches.open(ROUTE_CACHE).then((c) => c.delete('pending-route')).catch(() => {}); }
  });
}

// ------------------------------------------------------------------ boot
function boot() {
  Config.fromUrl();
  Me.applyTheme();
  fx.initPressed();
  // G1: swipe right from the left edge = back one step (the page's own back link names the step when nothing is behind it)
  const backLinkTarget = () => { const b = document.querySelector('#app .nav-back[data-to]'); return b ? b.dataset.to : parentOf(route()); };
  fx.initSwipeBack(() => back(backLinkTarget()), () => { const r = route(); return !!Config.token && S.ready && !(TAB_SET.has(r.name) && !r.parts[1]) && !['setup', 'workout', 'sos', 'me'].includes(r.name) && !(r.name === 'coach' && r.parts[1] === 'talk'); });
  fx.initSheetDrag();
  fx.initSwipeRows();
  fx.initCharts();
  window.addEventListener('scroll', onScroll, { passive: true });
  if (Config.token) {
    S.load();
    if (S.badSaved) sendProblem('The saved copy on this phone had no "me" and was replaced (keys: ' + S.badSaved + ')', 'startup', 'startup');
    if (!location.hash) history.replaceState(null, '', location.pathname + location.search + (S.ready && !S.setupDone() ? '#/setup' : '#/summary'));
    readPendingRoute();
    try { render(); } catch (e) { console.error(e); sendProblem(e.message, e.stack, 'startup'); } // the sync below must always start
    maybeSync(true);
    S.flush();
    setTimeout(() => PushClient.loadKey().catch(() => {}), 1500); // C1: the VAPID key is loaded at app start
  } else {
    render();
  }
  setTimeout(ensureCalendar, 4000); // only a fallback: the back office sends the calendar with the first sync, so it never delays the first screen
  window.__opAppReady = true;
}
boot();
window.__ourplan = { S, Queue, Config, go, rerender, Voice, Mic };
