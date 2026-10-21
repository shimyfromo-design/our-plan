/* Our Plan service worker: the app shell works offline; data comes from the API when online.
 * Round 3: notifications open the right screen (E8), the iPhone check hears its test push, and form-video stills stay cached.
 * Round 3.2 (D1): updates are atomic. A new version's files are all fetched fresh (never from the browser's download cache)
 * into a cache named after the version, all or nothing, before it can take over. It does NOT take over by itself: it waits
 * until the app is next opened (app.js asks it to), so one session never mixes two versions. Each version serves only
 * its own cache. The published files carry content-hash names (?v=…), so versions can't mix anywhere else either.
 * (A2) The chosen voice's fixed workout lines are kept in their own cache (file names are content hashes).
 * VERSION and ASSETS are rewritten by tools/build.js (and stamped by tools/stage.js when publishing). */
const VERSION = '2026-10-21-1367e22';
const ASSETS = [
  './',
  './css/app.css?v=3d059ac894',
  './css/tokens.css?v=fbf122299c',
  './icons/apple-touch-icon-v32.png',
  './icons/icon-192-v32.png',
  './icons/icon-512-v32.png',
  './icons/maskable-512-v32.png',
  './img/recipes/r_beef_broccoli.webp',
  './img/recipes/r_chicken_soup.webp',
  './img/recipes/r_cottage_omelet.webp',
  './img/recipes/r_egg_muffins.webp',
  './img/recipes/r_harissa_skewers.webp',
  './img/recipes/r_israeli_salad.webp',
  './img/recipes/r_lentil_soup.webp',
  './img/recipes/r_lighter_cholent.webp',
  './img/recipes/r_lime_slaw.webp',
  './img/recipes/r_london_broil.webp',
  './img/recipes/r_overnight_oats.webp',
  './img/recipes/r_peri_peri.webp',
  './img/recipes/r_roast_broccoli.webp',
  './img/recipes/r_roast_chicken.webp',
  './img/recipes/r_salmon.webp',
  './img/recipes/r_shakshuka.webp',
  './img/recipes/r_shawarma_bowl.webp',
  './img/recipes/r_steak_salad.webp',
  './img/recipes/r_tuna_wraps.webp',
  './img/recipes/r_turkey_chili.webp',
  './img/recipes/r_turkey_meatballs.webp',
  './img/recipes/r_yogurt_bowl.webp',
  './img/recipes/r_zaatar_chicken.webp',
  './index.html',
  './js/api.js?v=b8330e966d',
  './js/app.js?v=f286e0efc7',
  './js/content.js?v=9be2395602',
  './js/core.js?v=132c8397ab',
  './js/fx.js?v=73177c13f1',
  './js/icons.js?v=760ffaa7c7',
  './js/logic.js?v=6bf2ccfcc9',
  './js/logic4.js?v=268fdc2315',
  './js/logic5.js?v=66a96991a0',
  './js/mic.js?v=9ffe5ac9ff',
  './js/mictap.js?v=1f005f41d5',
  './js/nav.js?v=57c55c9996',
  './js/pointer.js?v=b69ebca4d8',
  './js/push.js?v=99b803c26f',
  './js/store.js?v=229f42e888',
  './js/ui.js?v=9375313392',
  './js/version.js?v=97f878e1fc',
  './js/views/coach.js?v=20a4bc923d',
  './js/views/coachpages.js?v=f0557c9860',
  './js/views/cook.js?v=959d23a248',
  './js/views/dishes.js?v=b6544095a8',
  './js/views/food.js?v=24cb1aa60c',
  './js/views/groceries.js?v=0c65ce3293',
  './js/views/install.js?v=0f27f1dd9c',
  './js/views/labs.js?v=4eee65f2f7',
  './js/views/me.js?v=227e5a6ffe',
  './js/views/meals.js?v=8d6ab7f099',
  './js/views/order.js?v=c5692bde2e',
  './js/views/plan.js?v=5d0bdc692d',
  './js/views/r4coach.js?v=eca27d92ed',
  './js/views/r4settings.js?v=c50c4e4291',
  './js/views/recipe.js?v=57fba85ae3',
  './js/views/setup.js?v=1d94e7e325',
  './js/views/sos.js?v=8f3d12b565',
  './js/views/summary.js?v=789f6aceb5',
  './js/views/together.js?v=540be4e82a',
  './js/views/train.js?v=f0f02667e0',
  './js/views/workout.js?v=3eedba8b8f',
  './js/views/workouts.js?v=d94e73a7fa',
  './js/voice.js?v=6f7b9b2130',
  './js/wav.js?v=962fbb04c0',
  './manifest.webmanifest?v=f8cdd1a60f',
  './voice/lines.json?v=af3fed6aed'
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
    }).catch(() => Response.error())))); // Round 4: offline, a picture not kept yet just doesn't show (no error on the page)
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
  // Round 4 (6.3): Cook mode in the background — a local notification when a timer ends ("Carrots are done")
  if (event.data && event.data.type === 'timers') event.waitUntil(cookTimers(event.data.timers || [], event.data.route || 'summary'));
});
let cookGen = 0;
function cookTimers(timers, route) {
  const gen = ++cookGen;
  const open = new URL('./?open=' + encodeURIComponent(route) + '#/' + route, self.registration.scope).href;
  const waits = timers.filter((t) => t && t.at > Date.now() && t.at - Date.now() < 3 * 3600000).map((t) => new Promise((resolve) => {
    setTimeout(() => {
      if (gen !== cookGen) { resolve(); return; } // the app came back (or the timers changed): the page chimes instead
      self.registration.showNotification(String(t.name || 'A timer') + ' ' + (/s$/i.test(t.name || '') ? 'are' : 'is') + ' done', { body: 'Cook mode', tag: 'cook-' + (t.id || ''), icon: 'icons/icon-192-v32.png', data: { url: open, route } }).then(resolve, resolve);
    }, t.at - Date.now());
  }));
  return Promise.all(waits);
}

// ------------------------------------------------------------------ notifications (Web Push)
/** '#/plan/groceries' → 'plan/groceries' (only simple routes). */
function routeOf(hash) { const r = String(hash || '').replace(/^#?\/?/, ''); return /^[a-z0-9_/-]+$/i.test(r) ? r : 'summary'; } // Round 4: routes carry recipe ids

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
