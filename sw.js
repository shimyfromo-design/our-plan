/* Our Plan service worker: the app shell works offline; data comes from the API when online.
 * Round 3: notifications open the right screen (E8), the iPhone check hears its test push, and form-video stills stay cached.
 * Round 3.2 (D1): updates are atomic. A new version's files are all fetched fresh (never from the browser's download cache)
 * into a cache named after the version, all or nothing, before it can take over. It does NOT take over by itself: it waits
 * until the app is next opened (app.js asks it to), so one session never mixes two versions. Each version serves only
 * its own cache. The published files carry content-hash names (?v=…), so versions can't mix anywhere else either.
 * (A2) The chosen voice's fixed workout lines are kept in their own cache (file names are content hashes).
 * VERSION and ASSETS are rewritten by tools/build.js (and stamped by tools/stage.js when publishing). */
const VERSION = '2026-10-08-b77860e';
const ASSETS = [
  './',
  './css/app.css?v=91cb19a30f',
  './css/tokens.css?v=5c1bc892fa',
  './icons/apple-touch-icon-v32.png',
  './icons/icon-192-v32.png',
  './icons/icon-512-v32.png',
  './icons/maskable-512-v32.png',
  './index.html',
  './js/api.js?v=d44773a102',
  './js/app.js?v=5a4ab54559',
  './js/content.js?v=f636454dd9',
  './js/core.js?v=c1a0501fca',
  './js/fx.js?v=34cbfc2a31',
  './js/icons.js?v=3ed54b753e',
  './js/logic.js?v=3d5c5ae15d',
  './js/mic.js?v=99eadb1765',
  './js/mictap.js?v=1f005f41d5',
  './js/nav.js?v=57c55c9996',
  './js/pointer.js?v=b69ebca4d8',
  './js/push.js?v=cfef6cc387',
  './js/store.js?v=5199216217',
  './js/ui.js?v=b5958020ce',
  './js/version.js?v=0b8541c5be',
  './js/views/coach.js?v=5f87e5bc8a',
  './js/views/coachpages.js?v=332ed8f726',
  './js/views/groceries.js?v=b08b0b27ca',
  './js/views/install.js?v=d348c3dde6',
  './js/views/labs.js?v=422eee147f',
  './js/views/me.js?v=8edb7eed1e',
  './js/views/plan.js?v=07f795f837',
  './js/views/setup.js?v=2e9cc6c3c9',
  './js/views/sos.js?v=41f1b378d8',
  './js/views/summary.js?v=e8a04af291',
  './js/views/together.js?v=934c68fec2',
  './js/views/workout.js?v=943b0227cc',
  './js/voice.js?v=decfa3dab7',
  './js/wav.js?v=962fbb04c0',
  './manifest.webmanifest?v=f8cdd1a60f',
  './voice/lines.json?v=255d8a19b4'
];
const CACHE = 'ourplan-' + VERSION;
const STILLS = 'op-stills-v1';   // the YouTube stills of the form videos, kept after the first view (D9a)
const ROUTES = 'op-route';       // a tapped notification's screen, for the app to read on launch (E8)
const VOICE = 'op-voice-fixed';  // the chosen voice's fixed workout lines (A2)

self.addEventListener('install', (event) => {
  // all or nothing, and fresh from the network: a version is either complete or not installed at all
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ourplan-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/** The chosen voice's fixed lines (voice/<voice>/<id>.mp3 listed in voice/lines.json); other voices' files are dropped. */
async function precacheVoice(voice) {
  if (!/^[a-z]{2,20}$/.test(String(voice || ''))) return;
  const base = self.registration.scope;
  const r = await fetch(new URL('voice/lines.json', base).href, { cache: 'no-cache' });
  if (!r.ok) return;
  const j = await r.json();
  if ((j.voices || []).indexOf(voice) < 0) return;
  const want = Object.keys(j.lines || {}).map((id) => new URL('voice/' + voice + '/' + id + '.mp3', base).href);
  const c = await caches.open(VOICE);
  const have = (await c.keys()).map((q) => q.url);
  for (const u of want) {
    if (have.indexOf(u) >= 0) continue;
    try { const res = await fetch(u); if (res.ok) await c.put(u, res); } catch (e) { /* offline: next time */ }
  }
  for (const u of have) if (want.indexOf(u) < 0) await c.delete(u);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // form-video stills: cache-first once seen, so the workout shows them instantly (and offline)
  if (url.hostname === 'i.ytimg.com') {
    event.respondWith(caches.open(STILLS).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()).catch(() => {});
      return res;
    }))));
    return;
  }
  if (url.origin !== self.location.origin) return; // API, YouTube, Hebcal: straight to the network

  // The previous app version (one-tap undo) lives in ./prev/ with its own service worker and cache.
  const scope = new URL(self.registration.scope).pathname;
  if (url.pathname.startsWith(scope + 'prev/')) return;
  if (url.pathname.startsWith(scope + 'voice/') && /\.mp3$/.test(url.pathname)) {
    event.respondWith(caches.open(VOICE).then((c) => c.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) c.put(req, res.clone()).catch(() => {});
      return res;
    }))));
    return;
  }
  if (req.mode === 'navigate') {
    // Opens instantly: this version's own shell, whatever the ?u=… query is. Network fallback on first load.
    event.respondWith(
      caches.open(CACHE).then((c) => c.match('./index.html', { ignoreSearch: true }))
        .then((hit) => hit || fetch(req))
        .catch(() => caches.open(CACHE).then((c) => c.match('./index.html', { ignoreSearch: true })))
    );
    return;
  }
  // only this version's own files (exact address, content-hash stamp included): never another version's
  event.respondWith(caches.open(CACHE).then((c) => c.match(req)).then((hit) => hit || fetch(req)));
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') { self.skipWaiting(); return; }
  if (event.data && event.data.type === 'voice') event.waitUntil(precacheVoice(event.data.voice).catch(() => {}));
});

// ------------------------------------------------------------------ notifications (Web Push)
/** '#/plan/groceries' → 'plan/groceries' (only simple routes). */
function routeOf(hash) { const r = String(hash || '').replace(/^#?\/?/, ''); return /^[a-z/]+$/.test(r) ? r : 'summary'; }

// Safari requires every push to show a notification right away (no silent pushes).
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { body: event.data ? event.data.text() : '' }; }
  const route = routeOf(data.url);
  const open = new URL('./?open=' + encodeURIComponent(route) + '#/' + route, self.registration.scope).href; // same origin, with the route
  const shown = self.registration.showNotification(data.title || 'Our Plan', {
    body: data.body || '', tag: data.tag || 'ourplan', icon: 'icons/icon-192-v32.png', badge: 'icons/icon-192-v32.png',
    data: { url: open, route }
  });
  // the iPhone check waits for its own test notification
  const told = data.nonce ? self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => list.forEach((c) => c.postMessage({ type: 'push', nonce: data.nonce }))) : Promise.resolve();
  event.waitUntil(Promise.all([shown, told]));
});

// A tap focuses an open window and takes it to the screen; otherwise it opens the app once, at that screen.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const route = routeOf(d.route || d.url);
  const open = d.url && String(d.url).indexOf(self.registration.scope) === 0 ? d.url : new URL('./?open=' + encodeURIComponent(route) + '#/' + route, self.registration.scope).href;
  event.waitUntil((async () => {
    try { const c = await caches.open(ROUTES); await c.put('pending-route', new Response(JSON.stringify({ route, at: Date.now() }), { headers: { 'Content-Type': 'application/json' } })); } catch (e) { /* the address carries it too */ }
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = list.find((c) => c.url.indexOf(self.registration.scope) === 0 && c.url.indexOf('/prev/') < 0) || list.find((c) => c.url.indexOf(self.registration.scope) === 0);
    if (win) {
      try { await win.focus(); } catch (e) { /* ignore */ }
      win.postMessage({ type: 'open', route });
      return;
    }
    await self.clients.openWindow(open);
  })());
});
