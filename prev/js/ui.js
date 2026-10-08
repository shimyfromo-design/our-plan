/* Our Plan — the shared parts every screen is built from (Round 3 design system). All return HTML strings. */
import { L, esc, icon, chev, attr, shortDate } from './core.js';
import { S } from './store.js';
import { Queue } from './api.js';

// ------------------------------------------------------------------ headers
/** The sticky header for a full page: "‹ Summary" on the left, an optional action on the right, the small title in the middle once scrolled. */
export function nav(opts = {}) {
  const back = opts.back ? `<button class="nav-back" data-act="back" ${opts.backTo ? `data-to="${esc(opts.backTo)}"` : ''} aria-label="Back to ${esc(opts.back)}">${chev('left')}<span>${esc(opts.back)}</span></button>` : '';
  return `<header class="nav${opts.always ? ' always' : ''}${opts.cls ? ' ' + opts.cls : ''}"><div class="nav-left">${back}</div><div class="nav-title" aria-hidden="true">${esc(opts.title || '')}</div><div class="nav-right">${opts.right || ''}</div></header>`;
}
/** Title block under the header: 34 bold, one optional secondary line. */
export function pageTitle(title, sub) {
  return `<div class="page-title"><h1 class="title${String(title).length > 17 ? ' long' : ''}">${esc(title)}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div>`;
}
/** Tab screen head: eyebrow (date) and the initial circle, then the greeting or the title, then one line. */
export function tabHead(opts) {
  return `<div class="head"><div class="head-row"><span class="eyebrow">${esc(opts.eyebrow || '')}</span><div class="right-tools">${opts.tools || ''}${initialBtn()}</div></div>
    <h1 class="${opts.greet ? 'greet' : 'title'}">${esc(opts.title)}</h1>${opts.line ? `<div class="head-line">${opts.line}</div>` : ''}${syncLine()}</div>`;
}
export function initialBtn() {
  const me = S.me();
  const n = me ? String(me.name || '?').trim().charAt(0).toUpperCase() : '?';
  return `<button class="initial" data-act="me" aria-label="You, settings and more">${esc(n)}</button>`;
}
export function initialOf(name) { return String(name || '?').trim().charAt(0).toUpperCase(); }
/** A quiet line only when something is waiting to sync. */
function syncLine() {
  const q = Queue.items().length;
  if (q && (Queue.lastError || navigator.onLine === false)) return `<div class="head-line"><button class="btn-text quiet" data-act="sync-now">${q} saved on this phone · Retry</button></div>`;
  if (S.error && S.error.code === 'not_authorized') return '<div class="head-line">Setup not finished</div>';
  return '';
}
export function greeting(name, minutes) {
  const m = minutes == null ? new Date().getHours() * 60 + new Date().getMinutes() : minutes;
  const part = m < 4 * 60 ? 'Good night' : m < 12 * 60 ? 'Good morning' : m < 17 * 60 ? 'Good afternoon' : m < 21 * 60 + 30 ? 'Good evening' : 'Good night';
  return part + (name ? ', ' + name : '');
}
export function sectionTitle(text, right) { return `<div class="split"><h2 class="section">${esc(text)}</h2>${right || ''}</div>`; }

// ------------------------------------------------------------------ cards and rows
export function card(inner, cls = '', extra = '') { return `<section class="card ${cls}" ${extra}>${inner}</section>`; }
export function listCard(rows, cls = '') { return `<section class="card list ${cls}">${rows.filter(Boolean).join('')}</section>`; }
/**
 * A row: icon · label (+ sub) · value · chevron. opts: { icon, c (a token like 'activity'), label, sub, value, act, data, cls, tag, eyebrow, labelHtml, right, noChev }
 */
export function row(o) {
  const tag = o.act ? 'button' : 'div';
  const a = Object.assign({ class: 'row ' + (o.icon ? '' : 'no-ic ') + (o.act ? '' : 'static ') + (o.cls || ''), type: o.act ? 'button' : null, 'data-act': o.act || null }, o.data || {});
  if (o.c) a.style = '--c: var(--' + o.c + ')';
  if (o.aria) a['aria-label'] = o.aria;
  const value = o.right != null ? o.right : (o.value != null && o.value !== '' ? `<span class="row-value">${o.value}</span>` : '');
  const label = `<span class="row-label${o.bold ? ' b' : ''}">${o.labelHtml || esc(o.label)}</span>`;
  const sub = o.sub ? `<span class="row-sub${o.subCls ? ' ' + o.subCls : ''}">${o.sub}</span>` : '';
  // with a secondary line, a plain value sits next to the label, so the secondary line gets the full width (never wraps)
  const top = sub && value && o.right == null ? `<span class="row-top">${label}${value}</span>` : label;
  return `<${tag} ${attr(a)}>${o.icon ? icon(o.icon) : ''}<span class="row-main">${o.eyebrow ? `<span class="row-eyebrow">${esc(o.eyebrow)}</span>` : ''}${top}${sub}</span>${top === label ? value : ''}${o.act && !o.noChev ? chev() : ''}</${tag}>`;
}
/** Summary's Today rows: icon · label · 22 rounded number with "of …" · chevron, a 6 px bar under it. */
export function trow(o) {
  const below = o.segs ? segbar(o.segs.total, o.segs.on, o.c) : bar(o.pct || 0, o.c);
  // the visible words are the button's name ("Activity 0 of 40 min"); the bar under them is decoration
  return `<button class="trow" type="button" data-act="${esc(o.act)}" style="--c: var(--${esc(o.c)})">
    <span class="trow-top">${icon(o.icon)}<span class="trow-label">${esc(o.label)}</span><span class="trow-num"><b>${o.num}</b>${o.of ? `<span>${esc(o.of)}</span>` : ''}</span>${chev()}</span>${below}</button>`;
}
/** A 6 px bar. With a label it is a named progress bar; without one it only repeats numbers shown next to it, so screen readers skip it. */
export function bar(pct, c, cls = '', label = '') {
  const p = Math.max(0, Math.min(1, +pct || 0));
  const a11y = label ? `role="progressbar" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(p * 100)}"` : 'aria-hidden="true"';
  return `<span class="bar ${cls}" style="--c: var(--${esc(c || 'accent')})" ${a11y}><i style="width:${(p * 100).toFixed(1)}%"></i></span>`;
}
export function segbar(total, on, c) {
  return `<span class="segbar" style="--c: var(--${esc(c)})" aria-hidden="true">${Array.from({ length: total }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('')}</span>`;
}
export function eyebrow(text, cls = '') { return `<div class="eyebrow ${cls}">${esc(text)}</div>`; }

// ------------------------------------------------------------------ buttons
export function primary(label, act, data = {}, opts = {}) {
  const a = Object.assign({ class: 'btn-primary ' + (opts.cls || ''), type: 'button', 'data-act': act }, data);
  if (opts.disabled) a.disabled = true;
  return `<button ${attr(a)}>${opts.icon ? icon(opts.icon) : ''}<span>${esc(label)}</span></button>`;
}
export function textBtn(label, act, data = {}, opts = {}) {
  const a = Object.assign({ class: 'btn-text ' + (opts.cls || ''), type: 'button', 'data-act': act }, data);
  if (opts.aria) a['aria-label'] = opts.aria;
  return `<button ${attr(a)}>${opts.icon ? icon(opts.icon) : ''}<span>${esc(label)}</span></button>`;
}
export function iconBtn(name, act, label, opts = {}) {
  const a = Object.assign({ class: 'btn-icon ' + (opts.cls || '') + (opts.on ? ' on' : ''), type: 'button', 'data-act': act, 'aria-label': label }, opts.data || {});
  if (opts.c) a.style = '--c: var(--' + opts.c + ')';
  if (opts.pressed != null) a['aria-pressed'] = opts.pressed ? 'true' : 'false';
  return `<button ${attr(a)}>${icon(name)}</button>`;
}
export function seg(items, current, act, opts = {}) {
  return `<div class="seg" role="radiogroup" ${opts.label ? `aria-label="${esc(opts.label)}"` : ''}>${items.map(([k, label, aria]) => `<button type="button" role="radio" class="${String(k) === String(current) ? 'on' : ''}" aria-checked="${String(k) === String(current)}" data-act="${esc(act)}" data-v="${esc(k)}" ${opts.data ? attr(opts.data) : ''} ${aria ? `aria-label="${esc(aria)}"` : ''}>${esc(label)}</button>`).join('')}</div>`;
}
export function picks(items, act, current, opts = {}) {
  return `<div class="picks${opts.fit ? ' fit' : ''}" role="group" ${opts.label ? `aria-label="${esc(opts.label)}"` : ''}>${items.map(([k, label, aria]) => `<button type="button" class="pick${opts.circle ? ' circle' : ''}${String(k) === String(current) ? ' on' : ''}" aria-pressed="${String(k) === String(current)}" data-act="${esc(act)}" data-v="${esc(k)}" ${aria ? `aria-label="${esc(aria)}"` : ''} ${opts.data ? attr(opts.data) : ''}>${esc(label)}</button>`).join('')}</div>`;
}
export function kindChip(kind) {
  const label = { meat: 'Meat', dairy: 'Dairy', pareve: 'Pareve', fish: 'Pareve' }[kind];
  return label ? `<span class="chip">${label}</span>` : '';
}
export function checkCircle(on) { return `<span class="check${on ? ' on' : ''}" aria-hidden="true">${icon('check')}</span>`; }
export function empty(ic, title, text, action) {
  return `<div class="empty">${icon(ic)}<h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}${action || ''}</div>`;
}

// ------------------------------------------------------------------ voice: one Play/Pause control per reply (E2)
export function playCtl(key, text, label = 'Play') {
  return `<button class="playctl" type="button" data-act="speak" data-vkey="${esc(key)}" data-text="${esc(text)}" aria-label="${esc(label)}">${icon('play', 'ic-xs')}<span>${esc(label)}</span></button>`;
}

// ------------------------------------------------------------------ rings (timers drain)
export function ring(id, pct, num, sub, opts = {}) {
  const r = 52, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, pct));
  return `<div class="ring ${opts.cls || ''}" id="${esc(id)}" style="--c: var(--${esc(opts.c || 'activity')})" data-c="${c.toFixed(2)}" role="timer" aria-live="off">
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="track" cx="60" cy="60" r="${r}"/><circle class="fill" cx="60" cy="60" r="${r}" style="stroke-dasharray:${c.toFixed(2)};stroke-dashoffset:${(c * (1 - p)).toFixed(2)}"/></svg>
    <div class="ring-mid"><b id="${esc(id)}-num">${esc(num)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div></div>`;
}
export function setRing(id, pct, num) {
  const el = document.getElementById(id);
  if (!el) return;
  const c = +el.dataset.c;
  const fg = el.querySelector('.fill');
  if (fg) fg.style.strokeDashoffset = (c * (1 - Math.max(0, Math.min(1, pct)))).toFixed(2);
  if (num != null) { const n = document.getElementById(id + '-num'); if (n && n.textContent !== String(num)) n.textContent = num; }
}

// ------------------------------------------------------------------ video (privacy-enhanced YouTube, loads only when tapped)
export function videoFrame(id, title) {
  return `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1&rel=0&modestbranding=1" title="${esc(title || 'Exercise video')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
}
/** A still of the video with a play button; tapping it loads the privacy-enhanced player (data-act video-play). */
export function videoStill(v, title) {
  if (!v || !v.id) return '';
  return `<button type="button" class="video" data-act="video-play" data-vid="${esc(v.id)}" data-title="${esc(title || '')}" aria-label="Play the form video for ${esc(title || 'this move')}"><img src="${esc(still(v))}" alt="" loading="lazy"><span class="play">${icon('play')}</span></button>`;
}
/** The standard YouTube still for a verified video. */
export function still(v) { return v && v.id ? 'https://i.ytimg.com/vi/' + encodeURIComponent(v.id) + '/hqdefault.jpg' : ''; }

// ------------------------------------------------------------------ charts
export function smoothPath(p) {
  if (p.length < 3) return p.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ');
  let d = 'M' + p[0][0].toFixed(1) + ' ' + p[0][1].toFixed(1);
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ' C' + c1[0].toFixed(1) + ' ' + c1[1].toFixed(1) + ' ' + c2[0].toFixed(1) + ' ' + c2[1].toFixed(1) + ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
  }
  return d;
}
/** Summary's 140×56 sparkline: 7 trend points over the last two weeks, 3 px line, the last point with a halo. */
export function sparkline(series, today) {
  const pts = [];
  for (let i = 6; i >= 0; i--) { const v = L.trendAt(series, L.addDays(today, -2 * i)); if (v != null) pts.push(v); }
  if (pts.length < 2) return '';
  const W = 140, H = 56, pad = 7;
  const min = Math.min(...pts), max = Math.max(...pts), span = Math.max(0.6, max - min), lo = (min + max) / 2 - span / 2;
  const xy = pts.map((v, i) => [pad + (i / (pts.length - 1)) * (W - 2 * pad), pad + (1 - (v - lo) / span) * (H - 2 * pad)]);
  const last = xy[xy.length - 1];
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" width="140" height="56" aria-hidden="true"><path class="trend" d="${smoothPath(xy)}"/><circle class="halo" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="7"/><circle class="last" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3.5"/></svg>`;
}
/**
 * The Weight page chart (D6): dots = weigh-ins (38%), the line = the 7-day trend (3 px), the last point with a halo,
 * dashed gridlines with labels on the right, three x labels, tap a point to see its number.
 */
export function weightChart(series, from, to) {
  const pts = series.filter((p) => p.date >= from && p.date <= to);
  if (pts.length < 2) return `<p class="sub center" style="padding:40px 0">${pts.length ? 'One weigh-in in this range. The line appears after a few more.' : 'No weigh-ins in this range.'}</p>`;
  const W = 340, H = 200, pad = { l: 6, r: 38, t: 14, b: 26 };
  const vals = pts.flatMap((p) => [p.raw, p.trend]);
  let min = Math.min(...vals), max = Math.max(...vals);
  if (max - min < 3) { const m = (max + min) / 2; min = m - 1.5; max = m + 1.5; }
  min = Math.floor(min - 0.5); max = Math.ceil(max + 0.5);
  const t0 = Date.parse(from), t1 = Math.max(Date.parse(to), t0 + 86400000);
  const x = (d) => pad.l + ((Date.parse(d) - t0) / (t1 - t0)) * (W - pad.l - pad.r);
  const y = (v) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const ticks = [max, (min + max) / 2, min].map((v) => `<line class="grid" x1="${pad.l}" x2="${W - pad.r + 4}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="axis" x="${W - pad.r + 8}" y="${(y(v) + 4).toFixed(1)}">${Math.round(v)}</text>`).join('');
  const mid = L.addDays(from, Math.round(L.daysBetween(from, to) / 2));
  const xl = [[from, 'start'], [mid, 'middle'], [to, 'end']].map(([d, anchor]) => `<text class="axis" x="${x(d).toFixed(1)}" y="${H - 6}" text-anchor="${anchor}">${esc(shortDate(d))}</text>`).join('');
  const dots = pts.map((p) => `<circle class="dot" cx="${x(p.date).toFixed(1)}" cy="${y(p.raw).toFixed(1)}" r="3.4"/>`).join('');
  const tp = pts.map((p) => [x(p.date), y(p.trend)]);
  const last = tp[tp.length - 1];
  const data = pts.map((p) => ({ x: +x(p.date).toFixed(1), y: +y(p.raw).toFixed(1), v: p.raw + ' lb', l: shortDate(p.date) + ' · trend ' + p.trend }));
  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend from ${pts[0].trend} to ${pts[pts.length - 1].trend} pounds. Tap a point to see it." data-pts='${esc(JSON.stringify(data))}'>${ticks}${xl}${dots}<path class="trend" d="${smoothPath(tp)}"/><circle class="halo" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="9"/><circle class="last" cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="4.5"/></svg></div>`;
}

// ------------------------------------------------------------------ swipe-to-delete wrapper (rows, grocery items, logged lines)
export function swipe(inner, act, data = {}, label = 'Delete') {
  return `<div class="swipe"><button class="swipe-del" type="button" data-act="${esc(act)}" ${attr(data)} tabindex="-1">${esc(label)}</button><div class="swipe-inner">${inner}</div></div>`;
}
