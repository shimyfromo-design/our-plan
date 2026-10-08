/* Our Plan — turning on real notifications (Web Push) for the home-screen app.
 * iPhone rules: iOS 16.4+, added to the Home Screen, and the permission question appears only when it is asked inside a
 * tap with nothing awaited before it. Round 3.2 (C1): turnOn() asks first thing (Notification.requestPermission), and only
 * then waits for the service worker, subscribes with the VAPID key (loaded when the app starts) and registers the phone.
 * C3: registering replaces this phone's old subscription on the back office. */
import { call, LS } from './api.js?v=d44773a102';
import { S } from './store.js?v=5199216217';

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

/** C1: the VAPID public key, loaded when the app starts (the last sync, or the back office's public ping) and kept. */
export function rememberKey(k) { if (k && typeof k === 'string') LS.set('op_vapid', k); }
export async function loadKey() {
  const have = (S.data && S.data.flags && S.data.flags.vapid) || LS.get('op_vapid');
  if (have) { rememberKey(have); return have; }
  try { const p = await call('ping', {}, { timeout: 20000 }); if (p && p.vapid) { rememberKey(p.vapid); return p.vapid; } } catch (e) { /* offline: try at the next sync */ }
  return '';
}
async function registration() {
  if (reg) return reg;
  const r = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
  if (r) return r;
  return Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error('The app is still installing. Close it, open it again, then tap Turn on.')), 10000))]);
}

/**
 * Turn notifications on. CALL IT FIRST THING IN THE TAP HANDLER: the permission question is asked synchronously, before
 * anything is awaited. Resolves 'on' or rejects with a friendly Error.
 */
export function turnOn() {
  if (status() === 'needs-install') return Promise.reject(new Error('Open Our Plan from its Home Screen icon, then turn notifications on there.'));
  if (!supported()) return Promise.reject(new Error('This browser can\'t show notifications. Emails still work.'));
  let ask;
  try { ask = Notification.permission === 'granted' ? Promise.resolve('granted') : Notification.requestPermission(); } catch (e) { ask = Promise.reject(e); }
  if (!ask || !ask.then) ask = Promise.resolve(Notification.permission); // very old Safari: callback form
  return ask.then(async (perm) => {
    if (perm === 'denied') throw new Error('Notifications are blocked for Our Plan. On iPhone: Settings → Notifications → Our Plan → Allow Notifications.');
    if (perm !== 'granted') throw new Error('Notifications weren\'t allowed. Tap Turn on again and choose Allow.');
    const vapid = await loadKey();
    if (!vapid) throw new Error('Notifications aren\'t ready yet. Check the connection and try again in a minute.');
    const r = await registration();
    let sub = await r.pushManager.getSubscription();
    if (sub) {
      // a subscription made with another key (an older install) can't receive ours: make a fresh one
      const k = sub.options && sub.options.applicationServerKey;
      if (k && btoa(String.fromCharCode.apply(null, new Uint8Array(k))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== vapid.replace(/=+$/, '')) { await sub.unsubscribe(); sub = null; }
    }
    if (!sub) {
      try { sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(vapid) }); }
      catch (e) { throw new Error('Notifications didn\'t turn on (' + (e.name || 'Error') + '). Try again.'); }
    }
    const json = sub.toJSON();
    await call('pushSubscribe', { subscription: { endpoint: json.endpoint, keys: json.keys }, device: deviceName(), replace: true }, { timeout: 45000 });
    S.setUi('push_endpoint', json.endpoint);
    return 'on';
  });
}
/** Round 3 name, kept for the Settings button. */
export const enable = turnOn;
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
  if (!supported() || Notification.permission !== 'granted') return;
  const r = reg || await navigator.serviceWorker.getRegistration();
  const sub = r && await r.pushManager.getSubscription();
  if (!sub) { if (S.ui.push_endpoint) S.setUi('push_endpoint', ''); return; }
  if (sub.endpoint !== S.ui.push_endpoint || !(S.data && S.data.flags && S.data.flags.pushSubs)) {
    const json = sub.toJSON();
    await call('pushSubscribe', { subscription: { endpoint: json.endpoint, keys: json.keys }, device: deviceName(), silent: true, replace: true });
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
