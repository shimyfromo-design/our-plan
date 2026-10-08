/* Our Plan — tiny hash router shared by all views. Remembers the direction of travel for transitions. */
const hooks = { render: () => {} };
let depth = 0;
let dir = 'none';
export function onRender(fn) { hooks.render = fn; }
export function route() {
  const h = (location.hash || '#/summary').replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) parts.push('summary');
  return { name: parts[0], parts, params: new URLSearchParams(query || '') };
}
/** 'forward' | 'back' | 'none' — the last navigation, read once by the renderer. */
export function takeDirection() { const d = dir; dir = 'none'; return d; }
export function go(path, opts = {}) {
  const target = '#/' + String(path).replace(/^#?\/?/, '');
  if (location.hash === target) { rerender(); return; }
  dir = 'forward';
  if (opts.replace) { history.replaceState(null, '', location.pathname + location.search + target); rerender(); return; }
  depth++;
  location.hash = target;
}
export function rerender() { hooks.render(); }
export function back(fallback = 'summary') {
  dir = 'back';
  if (depth > 0) { depth--; history.back(); return; }
  history.replaceState(null, '', location.pathname + location.search + '#/' + String(fallback).replace(/^#?\/?/, ''));
  rerender();
}
