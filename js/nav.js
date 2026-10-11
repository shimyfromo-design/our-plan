/* Our Plan — tiny hash router shared by all views. Remembers the direction of travel for transitions.
 * Round 3.2 (G1): every screen is its own history entry, numbered in history.state ({ op: n }), so "back" (the back link
 * and the swipe from the left edge) is exactly one step: the browser's own back when there is a screen behind this one,
 * otherwise the screen this page's back link names. It works the same after a reload or a screen opened from a tab. */
const hooks = { render: () => {} };
let dir = 'none';
export function onRender(fn) { hooks.render = fn; }
export function route() {
  const h = (location.hash || '#/summary').replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) parts.push('summary');
  return { name: parts[0], parts, params: new URLSearchParams(query || '') };
}
function lastOp() { try { return +(sessionStorage.getItem('op_nav') || -1); } catch (e) { return -1; } }
function saveOp(n) { try { sessionStorage.setItem('op_nav', String(n)); } catch (e) { /* private mode */ } }
/** Number this history entry if it is new (called on every render). */
export function stamp() {
  const st = history.state;
  if (st && typeof st.op === 'number') { saveOp(st.op); return st.op; }
  const n = lastOp() + 1;
  try { history.replaceState(Object.assign({}, st || {}, { op: n }), ''); } catch (e) { /* ignore */ }
  saveOp(n);
  return n;
}
/** Is there one of our screens behind this one? */
export function canGoBack() { const st = history.state; return !!(st && typeof st.op === 'number' && st.op > 0); }
/** 'forward' | 'back' | 'none' — the last navigation, read once by the renderer. */
export function takeDirection() { const d = dir; dir = 'none'; return d; }
export function go(path, opts = {}) {
  const target = '#/' + String(path).replace(/^#?\/?/, '');
  if (location.hash === target) { rerender(); return; }
  dir = 'forward';
  if (opts.replace) { history.replaceState(history.state, '', location.pathname + location.search + target); rerender(); return; }
  location.hash = target;
}
export function rerender() { hooks.render(); }
export function back(fallback = 'summary') {
  dir = 'back';
  if (canGoBack()) { history.back(); return; }
  history.replaceState(history.state, '', location.pathname + location.search + '#/' + String(fallback).replace(/^#?\/?/, ''));
  rerender();
}
