/* Our Plan — talking to the Apps Script API, plus the offline write queue. */
import { uid } from './core.js';

const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) { /* private mode */ } },
  json(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
};
export const LS = store;

const API_ID_RE = /^[A-Za-z0-9_-]{20,140}$/;
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;

export const Config = {
  get token() { return store.get('op_token') || ''; },
  get api() { return store.get('op_api') || ''; },
  apiUrl() {
    const a = this.api;
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(a)) return a; // local test server only
    return a ? 'https://script.google.com/macros/s/' + a + '/exec' : '';
  },
  /** Read ?u=TOKEN&a=API from the address, remember them, and keep them in the address bar so
   * "Add to Home Screen" on iPhone opens straight into this person's view. */
  fromUrl() {
    const q = new URLSearchParams(location.search);
    const h = new URLSearchParams(location.hash.includes('?') ? location.hash.split('?')[1] : '');
    const u = q.get('u') || h.get('u');
    const a = q.get('a') || h.get('a');
    let changed = false;
    if (a && (API_ID_RE.test(a) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(a))) { if (a !== this.api) { store.set('op_api', a); changed = true; } }
    if (u && TOKEN_RE.test(u)) { if (u !== this.token) { store.set('op_token', u); changed = true; } }
    if (!u && this.token && this.api && !q.get('setup')) {
      // put the personal link back in the address bar (iOS uses it as the home-screen start page)
      const url = new URL(location.href);
      url.searchParams.set('u', this.token);
      url.searchParams.set('a', this.api);
      try { history.replaceState(null, '', url.pathname + url.search + location.hash); } catch (e) { /* ignore */ }
    }
    return changed;
  },
  setLink(token, api) {
    if (api) store.set('op_api', api);
    if (token) store.set('op_token', token);
    const url = new URL(location.href);
    url.search = '';
    if (token) url.searchParams.set('u', token);
    if (api) url.searchParams.set('a', api);
    try { history.replaceState(null, '', url.pathname + url.search + '#/today'); } catch (e) { /* ignore */ }
  },
  personalLink() {
    const base = location.origin + location.pathname;
    return this.token ? base + '?u=' + encodeURIComponent(this.token) + '&a=' + encodeURIComponent(this.api) : base;
  },
  forget() { store.del('op_token'); }
};

export class ApiError extends Error {
  constructor(code, message, retryable) { super(message); this.code = code; this.retryable = !!retryable; }
}

/** One API call. Throws ApiError with a human message. */
export async function call(action, body = {}, opts = {}) {
  const url = opts.apiUrl || Config.apiUrl();
  if (!url) throw new ApiError('no_api', 'This phone doesn\'t know where Our Plan lives yet. Open your personal link.', false);
  const payload = JSON.stringify(Object.assign({ action, t: Config.token }, body));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeout || 45000);
  let res;
  try {
    res = await fetch(url, { method: 'POST', body: payload, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow', signal: ctrl.signal, credentials: 'omit' });
  } catch (e) {
    throw new ApiError('network', navigator.onLine === false ? 'You\'re offline. It\'s saved on this phone and will sync later.' : 'Couldn\'t reach Our Plan just now.', true);
  } finally { clearTimeout(timer); }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = null; }
  if (!json) {
    if (res.status === 403 || /accounts\.google\.com|ServiceLogin|Authorization required/i.test(text)) {
      throw new ApiError('not_authorized', 'Our Plan\'s Google script isn\'t switched on yet. The owner needs to do the first step in SETUP.md.', false);
    }
    throw new ApiError('bad_response', 'Our Plan answered strangely (' + res.status + '). Try again in a minute.', res.status >= 500 || res.status === 429);
  }
  if (!json.ok) {
    const e = json.error || {};
    throw new ApiError(e.code || 'error', e.message || 'Something went wrong.', e.code === 'server');
  }
  if (json.v) window.__apiVersion = json.v;
  return json.data;
}

// ------------------------------------------------------------ offline write queue
const QKEY = () => 'op_queue_' + (Config.token || '').slice(0, 10);
const listeners = new Set();
export const Queue = {
  items() { return store.json(QKEY(), []); },
  save(items) { store.set(QKEY(), JSON.stringify(items)); listeners.forEach((fn) => fn(items)); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  add(action, body) {
    const op = { cid: uid('q'), action, body: Object.assign({}, body), ts: Date.now(), tries: 0 };
    op.body.cid = op.cid;
    const items = this.items();
    items.push(op);
    this.save(items);
    return op;
  },
  remove(cid) { this.save(this.items().filter((o) => o.cid !== cid)); },
  lastError: null,
  busy: false,
  timer: null,
  /** Send queued writes in order. Stops at the first network problem and retries later. */
  async flush(handlers = {}) {
    if (this.busy || !Config.token) return;
    this.busy = true;
    let sent = 0;
    try {
      for (;;) {
        const items = this.items();
        if (!items.length) { this.lastError = null; break; }
        const op = items[0];
        try {
          const data = await call(op.action, op.body);
          this.remove(op.cid);
          sent++;
          handlers.done && handlers.done(op, data);
        } catch (e) {
          if (e.retryable || e.code === 'not_authorized') {
            op.tries = (op.tries || 0) + 1;
            this.save([op].concat(items.slice(1)));
            this.lastError = e;
            const wait = Math.min(120000, 4000 * Math.pow(2, Math.min(op.tries, 5)));
            clearTimeout(this.timer);
            this.timer = setTimeout(() => this.flush(handlers), wait);
            listeners.forEach((fn) => fn(this.items()));
            break;
          }
          // The server refused this one (bad value etc.): drop it and tell the user.
          this.remove(op.cid);
          handlers.failed && handlers.failed(op, e);
        }
      }
    } finally {
      this.busy = false;
      if (sent && handlers.after) handlers.after(sent);
    }
  }
};
