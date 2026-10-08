/* Our Plan — turning on real notifications (Web Push) for the home-screen app.
 * iPhone rules: iOS 16.4+, added to the Home Screen, and the permission request must come straight
 * from a tap — so enable() calls pushManager.subscribe() first thing in the tap handler. */
import { call } from './api.js';
import { S } from './store.js';

let reg = null;
if ('serviceWorker' in navigator) navigator.serviceWorker.ready.then((r) => { reg = r; }).catch(() => {});

export const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const standalone = () => navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
export const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** 'on' | 'off' | 'denied' | 'needs-install' | 'unsupported' */
export function status() {
  if (isIOS() && !standalone()) return 'needs-install';
  if (!supported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission === 'granted' && S.ui.push_endpoint) return 'on';
  return 'off';
}

function keyBytes(b64) {
  const s = b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function deviceName() {
  const ua = navigator.userAgent;
  return /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : 'Browser';
}

/** Must be called directly from a tap. Resolves to 'on' or throws a friendly Error. */
export async function enable() {
  const vapid = S.data && S.data.flags && S.data.flags.vapid;
  if (!vapid) throw new Error('Notifications aren\'t ready yet. Try again in a minute.');
  const r = reg || (navigator.serviceWorker && await navigator.serviceWorker.getRegistration());
  if (!r) throw new Error('The app is still installing. Close and reopen it, then try again.');
  let sub;
  try {
    sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapid) });
  } catch (e) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') throw new Error('Notifications are blocked for Our Plan. On iPhone: Settings → Notifications → Our Plan → Allow Notifications.');
    throw new Error('Notifications didn\'t turn on. Try again.');
  }
  const json = sub.toJSON();
  await call('pushSubscribe', { subscription: { endpoint: json.endpoint, keys: json.keys }, device: deviceName() }, { timeout: 45000 });
  S.setUi('push_endpoint', json.endpoint);
  return 'on';
}
export async function disable() {
  const r = reg || (navigator.serviceWorker && await navigator.serviceWorker.getRegistration());
  const sub = r && await r.pushManager.getSubscription();
  const endpoint = (sub && sub.endpoint) || S.ui.push_endpoint;
  try { if (sub) await sub.unsubscribe(); } catch (e) { /* ignore */ }
  S.setUi('push_endpoint', '');
  if (endpoint) await call('pushUnsubscribe', { endpoint });
}
/** Keep the server's copy fresh if the phone's subscription changed (e.g. after an iOS update). */
export async function refresh() {
  if (!supported() || Notification.permission !== 'granted' || !S.ui.push_endpoint) return;
  const r = reg || await navigator.serviceWorker.getRegistration();
  const sub = r && await r.pushManager.getSubscription();
  if (!sub) { S.setUi('push_endpoint', ''); return; }
  if (sub.endpoint !== S.ui.push_endpoint || !(S.data && S.data.flags && S.data.flags.pushSubs)) {
    const json = sub.toJSON();
    await call('pushSubscribe', { subscription: { endpoint: json.endpoint, keys: json.keys }, device: deviceName(), silent: true });
    S.setUi('push_endpoint', json.endpoint);
  }
}

/** iPhone check (E11): resolves true when the test notification with this nonce reaches this phone (or false after ms). */
export function waitFor(nonce, ms) {
  return new Promise((resolve) => {
    if (!('serviceWorker' in navigator)) { resolve(false); return; }
    let done = false;
    const finish = (v) => { if (done) return; done = true; navigator.serviceWorker.removeEventListener('message', on); clearTimeout(t); resolve(v); };
    const on = (e) => { if (e.data && e.data.type === 'push' && e.data.nonce === nonce) finish(true); };
    navigator.serviceWorker.addEventListener('message', on);
    const t = setTimeout(() => finish(false), ms || 30000);
  });
}
