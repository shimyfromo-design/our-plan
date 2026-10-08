/* Our Plan — the first script on the page (Round 3.2, D2). Inlined into index.html by tools/build.js, before anything else.
 * - Catches every error from the very start (scripts that fail to load included) and sends it to the Problems tab with
 *   the app version and the cache state, until the app is running and reports its own errors.
 * - If the first screen hasn't appeared within 8 seconds, shows a calm "Something went wrong" screen with Reload and
 *   Something's off. Never a blank page. Reload starts clean: it drops this phone's copies of the app files and of the
 *   screen data (the back office has everything; changes not yet sent are kept), then opens the app again.
 * Plain old JavaScript: no modules, nothing it depends on can be missing. */
(function () {
  'use strict';
  var sent = {};
  function fromUrl(k) { try { return new URLSearchParams(location.search).get(k === 'op_token' ? 'u' : 'a'); } catch (e) { return null; } }
  function get(k) { var v = null; try { v = localStorage.getItem(k); } catch (e) { v = null; } return v || ((k === 'op_token' || k === 'op_api') ? fromUrl(k) : null); }
  function api() {
    var a = get('op_api') || '';
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(a)) return a;
    return a ? 'https://script.google.com/macros/s/' + a + '/exec' : '';
  }
  function post(body) {
    var u = api(), t = get('op_token');
    if (!u || !t) return Promise.reject(new Error('no link'));
    body.t = t;
    return fetch(u, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, credentials: 'omit' }).then(function (r) { return r.json(); });
  }
  function cacheState() {
    var bits = ['sw=' + (navigator.serviceWorker && navigator.serviceWorker.controller ? 'on' : 'off')];
    if (!window.caches) return Promise.resolve(bits.join(' '));
    return caches.keys().then(function (k) { bits.push('caches=' + k.filter(function (n) { return /^ourplan/.test(n); }).join(',')); return bits.join(' '); }, function () { return bits.join(' '); });
  }
  function report(message, stack) {
    if (window.__opAppReady && !window.__opFallback) return; // the running app reports its own errors
    var key = String(message).slice(0, 120);
    if (sent[key] || Object.keys(sent).length > 8) return;
    sent[key] = 1;
    cacheState().then(function (cs) {
      post({ action: 'report', message: String(message).slice(0, 300), stack: (String(stack || '') + '\n' + cs + ' route=' + (location.hash || '#')).slice(0, 1500), where: 'startup', version: window.OUR_PLAN_VERSION || '' }).catch(function () {});
    });
  }
  window.__opFail = report;
  window.addEventListener('error', function (e) {
    if (e && e.message) { if (!/Script error/.test(e.message)) report(e.message, (e.error && e.error.stack) || (e.filename + ':' + e.lineno)); }
    else if (e && e.target && (e.target.src || e.target.href)) report('Could not load ' + String(e.target.src || e.target.href).split('/').pop().split('?')[0]);
  }, true);
  window.addEventListener('unhandledrejection', function (e) { var r = e && e.reason; report((r && r.message) || String(r), r && r.stack); });

  function reload() {
    var go = function () { location.reload(); };
    try { Object.keys(localStorage).forEach(function (k) { if (/^op_state_/.test(k)) localStorage.removeItem(k); }); } catch (e) { /* private mode */ }
    var jobs = [];
    if (window.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return /^ourplan-/.test(k); }).map(function (k) { return caches.delete(k); })); }));
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.scope.indexOf('/prev/') < 0 ? r.unregister() : null; })); }));
    Promise.all(jobs).then(go, go);
    setTimeout(go, 3000);
  }
  function showFallback() {
    var app = document.getElementById('app');
    if (!app || window.__opRendered) return;
    window.__opFallback = true;
    report('The first screen did not appear within 8 seconds', 'ready=' + !!window.__opAppReady);
    var tabs = document.getElementById('tabs');
    if (tabs) tabs.hidden = true;
    app.innerHTML = '<div class="install" role="alert"><h1 class="title">Something went wrong</h1>' +
      '<p class="body">Our Plan didn\'t open properly. Your data is safe in your Google Sheet.</p>' +
      '<button class="btn-primary" type="button" id="op-reload"><span>Reload</span></button>' +
      '<button class="btn-text block" type="button" id="op-off"><span>Something\'s off</span></button>' +
      '<div id="op-off-box" hidden><label class="field"><span>What happened?</span><textarea id="op-off-note" rows="3" maxlength="1000"></textarea></label>' +
      '<button class="btn-primary" type="button" id="op-off-send"><span>Send</span></button><p class="sub" id="op-off-msg" role="status"></p></div></div>';
    document.getElementById('op-reload').onclick = reload;
    document.getElementById('op-off').onclick = function () { document.getElementById('op-off-box').hidden = false; document.getElementById('op-off-note').focus(); };
    document.getElementById('op-off-send').onclick = function () {
      var note = document.getElementById('op-off-note').value.trim(), msg = document.getElementById('op-off-msg');
      if (!note) { msg.textContent = 'Write a few words about what happened.'; return; }
      msg.textContent = 'Sending…';
      post({ action: 'somethingOff', note: note, route: 'startup', version: window.OUR_PLAN_VERSION || '' })
        .then(function (j) { msg.textContent = j && j.ok ? 'Sent. Thank you. Now tap Reload.' : 'It didn\'t send. Tap Reload and try from the app.'; },
          function () { msg.textContent = 'It didn\'t send (no connection?). Tap Reload.'; });
    };
  }
  window.__opShowFallback = showFallback;
  setTimeout(showFallback, 8000);
})();
