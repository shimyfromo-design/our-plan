/* Our Plan — small UI helpers: escaping, icons (Lucide), the "Logged" bar, bottom sheets, busy controls, files. */
import { ICONS } from './icons.js?v=3ed54b753e';

export const L = window.OurPlanLogic;
export const K = window.OurPlanContent;

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
/** Join HTML pieces, skipping false/null/undefined. */
export function join(parts) { return parts.filter((p) => p !== false && p != null && p !== '').join(''); }
export const attr = (o) => Object.keys(o).filter((k) => o[k] != null && o[k] !== false).map((k) => (o[k] === true ? k : `${k}="${esc(o[k])}"`)).join(' ');

export function uid(prefix = 'c') {
  const a = new Uint8Array(10);
  crypto.getRandomValues(a);
  return prefix + Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

// ------------------------------------------------------------ dates: always New York time (rule 10), whatever the phone's zone
export function todayISO(d = new Date()) { return L.nyDate(d); }
export function nowMinutes(d = new Date()) { return L.ny(d).minutes; }
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Shabbat'];
export function longDate(iso) { const [, m, d] = iso.split('-').map(Number); return DOW[L.weekday(iso)] + ', ' + MONTHS[m - 1] + ' ' + d; }
/** "Sept 8" style (D6) */
export function shortDate(iso) { const [, m, d] = iso.split('-').map(Number); return (m === 9 ? 'Sept' : MONTHS[m - 1].slice(0, 3)) + ' ' + d; }
export function dayName(iso) { return DOW[L.weekday(iso)]; }
export function timeAgo(ts) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) { const h = Math.floor(s / 3600); return h + (h === 1 ? ' hour ago' : ' hours ago'); }
  const days = Math.floor(s / 86400);
  return days === 1 ? 'yesterday' : days + ' days ago';
}
export const plural = (n, w, pl) => n + ' ' + (n === 1 ? w : (pl || w + 's'));
/** "9:45 pm" from an ISO timestamp, in New York time. */
export function clock(ts) { const n = L.ny(ts); return n ? L.fmt12(n.minutes) : ''; }

// ------------------------------------------------------------ icons (Lucide, inlined at build time)
/** A 22 px Lucide icon (stroke 2, round caps). cls adds a class (e.g. "ic-s"). */
export function icon(name, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.info}</svg>`;
}
/** A 14 px chevron, stroke 2.5, in the chevron color. */
export function chev(dir = 'right') {
  return `<svg class="chev" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${ICONS['chevron-' + dir]}</svg>`;
}

// ------------------------------------------------------------ the quiet "Logged" bar (with Undo)
let toastTimer = null;
export function toast(text, opts = {}) {
  const el = document.getElementById('toast');
  if (!el) return;
  const ic = opts.kind === 'err' ? 'circle-alert' : (opts.icon || 'check');
  el.innerHTML = `<div class="toast ${opts.kind || ''}" role="status">${icon(ic)}<span>${esc(text)}</span>${opts.action ? `<button class="btn-text" data-act="${esc(opts.action.act)}" ${opts.action.data ? attr(opts.action.data) : ''}>${esc(opts.action.label)}</button>` : ''}</div>`;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), opts.ms || (opts.action ? 5000 : 2600));
}

// ------------------------------------------------------------ bottom sheets (B8)
let sheetClose = null;
/**
 * openSheet({ title, body, label, doneLabel, doneAct, onClose }) — rises in 300 ms over a dimmed page; grabber, title on
 * the left, "Done" on the right; the height fits the content.
 */
export function openSheet(opts) {
  if (typeof opts === 'string') opts = { body: opts };
  const root = document.getElementById('sheet-root');
  const title = opts.title || '';
  root.innerHTML = `<div class="scrim" data-act="sheet-close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(opts.label || title || 'Details')}">
    <div class="grab" aria-hidden="true"></div>
    <div class="sheet-head"><h2>${esc(title)}</h2><button class="btn-text" data-act="${esc(opts.doneAct || 'sheet-close')}">${esc(opts.doneLabel || 'Done')}</button></div>
    <div class="sheet-body">${opts.body || ''}</div></div>`;
  sheetClose = opts.onClose || null;
  document.body.classList.add('sheet-open');
  void root.offsetWidth;
  root.classList.add('open');
  const first = root.querySelector('[autofocus]');
  if (first) setTimeout(() => { first.focus(); if (first.select) first.select(); }, 320);
  return root.querySelector('.sheet-body');
}
/** Replace the open sheet's body (keeps its place), or open a new one. */
export function updateSheet(opts) {
  const body = document.querySelector('#sheet-root.open .sheet-body');
  if (!body) return openSheet(opts);
  const h = document.querySelector('#sheet-root .sheet-head h2');
  if (h && opts.title != null) h.textContent = opts.title;
  body.innerHTML = opts.body || '';
  return body;
}
export function closeSheet() {
  const root = document.getElementById('sheet-root');
  if (!root || !root.classList.contains('open')) return;
  root.classList.remove('open');
  document.body.classList.remove('sheet-open');
  const cb = sheetClose; sheetClose = null;
  root.querySelectorAll('iframe').forEach((f) => f.remove());
  setTimeout(() => { if (!root.classList.contains('open')) root.innerHTML = ''; }, 300);
  if (cb) cb();
}
export const sheetOpen = () => !!document.getElementById('sheet-root')?.classList.contains('open');

// ------------------------------------------------------------ busy controls (B9): never twice; a spinner after 300 ms
const inflight = new WeakSet();
/** Run an async job for a control: it disables at once, shows a spinner after 300 ms, and can't be sent twice. */
export async function busy(el, job) {
  if (el && inflight.has(el)) return undefined;
  let timer = null;
  if (el) {
    inflight.add(el);
    el.disabled = true;
    el.setAttribute('aria-busy', 'true');
    timer = setTimeout(() => { if (el.isConnected && !el.querySelector('.spin')) { el.classList.add('is-busy'); el.insertAdjacentHTML('afterbegin', '<span class="spin" aria-hidden="true"></span>'); } }, 300);
  }
  try { return await job(); }
  finally {
    if (el) {
      clearTimeout(timer);
      inflight.delete(el);
      el.disabled = false;
      el.removeAttribute('aria-busy');
      el.classList.remove('is-busy');
      const s = el.querySelector('.spin'); if (s) s.remove();
    }
  }
}

// ------------------------------------------------------------ screen wake lock (workouts)
let wakeLock = null;
export async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); }
    if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch (e) { /* not supported */ }
}

// ------------------------------------------------------------ images
/** Resize a photo from <input type=file> to a JPEG data URL. */
export function resizeImage(file, maxSide = 1024, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that photo.')); };
    img.src = url;
  });
}

/**
 * Round 3.2 (B1): a photo from the camera or the library (HEIC or JPEG) for the coach. Decoded upright (the photo's own
 * rotation), long edge 1600 px, JPEG at about 80%, plus a small thumbnail for the chat bubble. A photo that comes out blank
 * is caught here instead of being sent. Rejects with an Error whose name and message are exact (for the Problems tab).
 */
export async function preparePhoto(file, maxSide = 1600, quality = 0.8) {
  const fail = (name, msg) => { const e = new Error(msg); e.name = name; return e; };
  const notes = [];
  const fromImg = () => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve({ src: img, done: () => URL.revokeObjectURL(url) });
    img.onerror = () => { URL.revokeObjectURL(url); reject(fail('DecodeError', 'This photo could not be opened (' + (file.type || 'unknown type') + ').')); };
    img.src = url;
  });
  const fromBitmap = async () => { const b = await createImageBitmap(file, { imageOrientation: 'from-image' }); return { src: b, done: () => { try { b.close(); } catch (e) { /* ignore */ } } }; };
  // two ways to decode; iPhone can hand back a blank canvas for some photos, so a blank result tries the other way
  const ways = (window.createImageBitmap ? [['bitmap', fromBitmap]] : []).concat([['image', fromImg]]);
  for (const [name, open] of ways) {
    let d = null;
    try { d = await open(); } catch (e) { notes.push(name + ': ' + (e.name || 'Error')); continue; }
    try {
      const src = d.src, w = src.naturalWidth || src.width, h = src.naturalHeight || src.height;
      if (!w || !h) { notes.push(name + ': no size'); continue; }
      const draw = (max) => {
        const s = Math.min(1, max / Math.max(w, h));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
        const g = c.getContext('2d');
        g.imageSmoothingQuality = 'high';
        g.drawImage(src, 0, 0, c.width, c.height);
        return c;
      };
      const big = draw(maxSide);
      // a canvas iPhone couldn't fill comes out one flat color: never send that
      const t = document.createElement('canvas'); t.width = 16; t.height = 16;
      const tg = t.getContext('2d'); tg.drawImage(big, 0, 0, 16, 16);
      const px = tg.getImageData(0, 0, 16, 16).data;
      let lo = 255, hi = 0;
      for (let i = 0; i < px.length; i += 4) { const v = (px[i] + px[i + 1] + px[i + 2]) / 3; if (v < lo) lo = v; if (v > hi) hi = v; }
      if (hi - lo < 3) { notes.push(name + ': blank at ' + w + '×' + h); continue; }
      const data = big.toDataURL('image/jpeg', quality);
      if (!/^data:image\/jpeg;base64,/.test(data)) { notes.push(name + ': no JPEG'); continue; }
      return { data, thumb: draw(360).toDataURL('image/jpeg', 0.72), w: big.width, h: big.height, from: w + '×' + h, bytes: Math.round(data.length * 0.75), notes };
    } finally { d.done(); }
  }
  // last resort: the original JPEG/PNG as it is (iPhone gives web apps a JPEG), if it isn't too big to send
  if (/^image\/(jpeg|png|webp)$/.test(file.type) && file.size <= 4400000) {
    const data = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(fail('ReadError', 'The photo file could not be read.')); r.readAsDataURL(file); });
    notes.push('sent the original');
    return { data, thumb: data, w: 0, h: 0, from: 'original', bytes: file.size, notes, original: true };
  }
  throw fail('BlankImage', 'The photo came out blank (' + notes.join('; ') + ').');
}

// ------------------------------------------------------------ files
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    ta.remove();
    return ok;
  }
}
export async function shareOrDownload(blob, name, title) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: title || name }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  return 'downloaded';
}

/** Minimal ZIP (stored, no compression) — enough for a CSV bundle. */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
export function makeZip(files) {
  const enc = new TextEncoder();
  const chunks = [], central = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  Object.keys(files).forEach((name) => {
    const data = typeof files[name] === 'string' ? enc.encode(files[name]) : files[name];
    const nameBytes = enc.encode(name);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true); local.setUint16(8, 0, true);
    local.setUint16(10, dosTime, true); local.setUint16(12, dosDate, true); local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true); local.setUint32(22, data.length, true); local.setUint16(26, nameBytes.length, true); local.setUint16(28, 0, true);
    chunks.push(new Uint8Array(local.buffer), nameBytes, data);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true); cen.setUint16(4, 20, true); cen.setUint16(6, 20, true); cen.setUint16(8, 0x0800, true); cen.setUint16(10, 0, true);
    cen.setUint16(12, dosTime, true); cen.setUint16(14, dosDate, true); cen.setUint32(16, crc, true); cen.setUint32(20, data.length, true); cen.setUint32(24, data.length, true);
    cen.setUint16(28, nameBytes.length, true); cen.setUint16(30, 0, true); cen.setUint16(32, 0, true); cen.setUint16(34, 0, true); cen.setUint16(36, 0, true); cen.setUint32(38, 0, true); cen.setUint32(42, offset, true);
    central.push(new Uint8Array(cen.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  });
  const cenSize = central.reduce((a, c) => a + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, Object.keys(files).length, true); end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, cenSize, true); end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}

export function debounce(fn, ms) { let t = null; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
