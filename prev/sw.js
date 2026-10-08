/* Our Plan service worker: the app shell works offline; data comes from the API when online.
 * Round 3: notifications open the right screen (E8), the iPhone check hears its test push, and form-video stills stay cached.
 * VERSION and ASSETS are rewritten by tools/build.js on every build. */
const VERSION = '2026-10-08-5f665e7';
const ASSETS = [
  './',
  './css/app.css',
  './css/tokens.css',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './index.html',
  './js/api.js',
  './js/app.js',
  './js/content.js',
  './js/core.js',
  './js/fx.js',
  './js/icons.js',
  './js/logic.js',
  './js/mic.js',
  './js/mictap.js',
  './js/nav.js',
  './js/pointer.js',
  './js/push.js',
  './js/store.js',
  './js/ui.js',
  './js/views/coach.js',
  './js/views/coachpages.js',
  './js/views/groceries.js',
  './js/views/install.js',
  './js/views/labs.js',
  './js/views/me.js',
  './js/views/plan.js',
  './js/views/setup.js',
  './js/views/sos.js',
  './js/views/summary.js',
  './js/views/together.js',
  './js/views/workout.js',
  './js/voice.js',
  './js/wav.js',
  './manifest.webmanifest'
];
const CACHE = 'ourplanprev-' + VERSION;
const STILLS = 'op-stills-v1';   // the YouTube stills of the form videos, kept after the first view (D9a)
const ROUTES = 'op-route';       // a tapped notification's screen, for the app to read on launch (E8)

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ourplanprev-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

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
  if (url.pathname.startsWith(new URL('./prev/', self.registration.scope).pathname)) return;
  if (req.mode === 'navigate') {
    // Opens instantly: the cached shell, whatever the ?u=… query is. Network fallback on first load.
    event.respondWith(
      caches.match('./index.html', { ignoreSearch: true })
        .then((hit) => hit || fetch(req))
        .catch(() => caches.match('./index.html', { ignoreSearch: true }))
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
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
    body: data.body || '', tag: data.tag || 'ourplan', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png',
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
