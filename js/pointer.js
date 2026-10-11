/* Our Plan — which app version this household uses (one-tap undo of an update).
 * The owner flips a shared setting; every phone follows it on its next open. Each publish keeps the
 * previous version at ./prev/. This file is loaded first by the newest version, and the publish step
 * adds it to the previous version too (as ../js/pointer.js), so either version can switch back. */
(function () {
  'use strict';
  var KEY = 'op_pointer';
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  var inPrev = /\/prev\/(index\.html)?$/.test(location.pathname);
  function go(which) {
    var target = which === 'previous' ? (inPrev ? null : 'prev/') : (inPrev ? '../' : null);
    if (target) location.replace(target + location.search + location.hash);
  }
  // 1) instant: follow what this phone last knew (only once the previous version is known to exist)
  var known = get(KEY) || 'current';
  if (known === 'previous' && !inPrev && get('op_prev_ok') === '1') { go('previous'); return; }
  if (known !== 'previous' && inPrev) { go('current'); return; }

  function api() {
    var a = get('op_api') || '';
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(a)) return a;
    return a ? 'https://script.google.com/macros/s/' + a + '/exec' : '';
  }
  function post(body) {
    var url = api(), t = get('op_token');
    if (!url || !t) return Promise.reject(new Error('no link'));
    body.t = t;
    return fetch(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' }, credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok) throw new Error((j.error && j.error.message) || 'error'); return j.data; });
  }
  /** Called by the app after each sync, and by the previous version on open. */
  function follow(pointer) {
    if (pointer !== 'previous' && pointer !== 'current') return;
    set(KEY, pointer);
    if (pointer === 'previous' && !inPrev) {
      fetch('prev/js/version.js', { cache: 'no-store' }).then(function (r) {
        if (r.ok) { set('op_prev_ok', '1'); go('previous'); }
      }).catch(function () { /* offline: try next time */ });
    } else if (pointer !== 'previous' && inPrev) go('current');
  }
  window.OurPlanPointer = { follow: follow, inPrev: inPrev };

  // 2) inside the previous version: check the shared setting, and give the owner a way back
  if (inPrev) {
    var check = function () {
      post({ action: 'pointer' }).then(function (d) {
        follow(d.pointer);
        if (d.owner && d.pointer === 'previous') banner();
      }).catch(function () { /* offline */ });
    };
    var banner = function () {
      if (document.getElementById('op-prev-bar')) return;
      var b = document.createElement('div');
      b.id = 'op-prev-bar';
      b.setAttribute('role', 'status');
      b.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 76px);z-index:70;display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:14px;background:#1C1C1E;color:#fff;font:15px -apple-system,system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.25)';
      b.innerHTML = '<span>You\'re on the previous version.</span>';
      var btn = document.createElement('button');
      btn.textContent = 'Switch back';
      btn.style.cssText = 'min-height:44px;padding:8px 14px;border:0;border-radius:10px;background:#fff;color:#000;font:600 15px -apple-system,system-ui,sans-serif';
      btn.onclick = function () {
        btn.disabled = true; btn.textContent = 'Switching…';
        post({ action: 'settings', values: { app_pointer: 'current' } }).then(function () { follow('current'); })
          .catch(function () { btn.disabled = false; btn.textContent = 'Try again'; });
      };
      b.appendChild(btn);
      (document.body || document.documentElement).appendChild(b);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', check); else check();
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
  }
})();
