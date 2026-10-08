/* Craving SOS (D9e) — the Round 2 two-minute plan, restyled: water, protein or wait, move, delay, tell your partner.
 * Each step's ring drains with that step's real time. */
import { K, esc, icon, toast, keepAwake } from '../core.js?v=c1a0501fca';
import { S } from '../store.js?v=5199216217';
import { call } from '../api.js?v=d44773a102';
import { go, rerender } from '../nav.js?v=57c55c9996';
import { primary, textBtn, iconBtn, ring, setRing, row } from '../ui.js?v=b5958020ce';

// Round 3.2 (rule 11): Craving SOS is silent. The app speaks only from Play, Talk, a workout, the Summary speaker,
// voice Preview and the iPhone check; each step's words are on the screen.
let sos = null, raf = 0, delayTimer = null;
const fmt = (s) => (s >= 60 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : String(s));

function startStep() {
  cancelAnimationFrame(raf);
  const s = K.SOS_STEPS[sos.i];
  if (!s) { sos.done = true; rerender(); return; }
  sos.total = s.seconds; sos.endsAt = Date.now() + s.seconds * 1000; sos.paused = false; sos.left = s.seconds;
  rerender();
  loop();
}
function loop() {
  cancelAnimationFrame(raf);
  const frame = () => {
    if (!sos || sos.done || sos.i < 0) return;
    if (!sos.paused) {
      const ms = Math.max(0, sos.endsAt - Date.now());
      sos.left = Math.ceil(ms / 1000);
      setRing('sos-ring', ms / 1000 / sos.total, fmt(sos.left));
      if (ms <= 0) { sos.i++; startStep(); return; }
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
function top(label) {
  return `<div class="flow-top">${iconBtn('x', 'sos-exit', 'Close')}<div class="flow-clock"><span>${esc(label)}</span></div><span></span></div>
    <div class="flow-prog" aria-hidden="true">${K.SOS_STEPS.map((_, i) => `<i><u style="width:${sos.done || i < sos.i ? 100 : 0}%"></u></i>`).join('')}</div>`;
}

export function render() {
  if (!sos) sos = { i: -1, left: 0, done: false, delay: null };
  const p = S.partner();
  if (sos.i < 0) {
    return `<div class="flow">${top('Craving SOS')}<div class="eyebrow act">Two minutes</div><h1 class="move-name">Craving? Let's ride it out.</h1><p class="move-cue">Cravings peak and pass. Give it two minutes.</p>
      <div class="card list" style="margin-top:16px">${K.SOS_STEPS.map((s) => row({ label: s.title.replace(/ — /g, ', '), value: s.seconds + ' sec' })).join('')}</div>
      <div class="flow-actions">${primary('Start', 'sos-start', {}, { icon: 'play' })}</div></div>`;
  }
  if (sos.done) {
    return `<div class="flow">${top('Done')}<div class="done-ring" role="img" aria-label="Done">${icon('check')}</div><h1 class="done-title">Two minutes. Done.</h1>
      <p class="body center t-2" style="margin-top:6px">However it goes from here, you paused and chose. That's the skill.</p>
      ${sos.delay != null ? ring('sos-delay', sos.delay / 600, fmt(sos.delay), 'delay', { cls: 'small', c: 'accent' }) + '<p class="sub center">Still want it after? A planned portion, on a plate, sitting down.</p>' : `<div class="center" style="margin-top:12px">${textBtn('Start a 10-minute delay', 'sos-delay', {}, { icon: 'timer' })}</div>`}
      <p class="h3" style="margin-top:20px">How did it go?</p>
      <div class="card list" style="margin-top:8px">${['Rode it out', 'Had a planned portion', 'Had more than planned. No guilt.'].map((o) => row({ label: o, act: 'sos-out', data: { 'data-o': o } })).join('')}</div></div>`;
  }
  const s = K.SOS_STEPS[sos.i];
  const last = sos.i === K.SOS_STEPS.length - 1;
  return `<div class="flow">${top('Step ' + (sos.i + 1) + ' of ' + K.SOS_STEPS.length)}
    <h1 class="move-name" style="margin-top:12px">${esc(s.title.replace(/ — /g, ', '))}</h1>
    ${ring('sos-ring', (sos.left || s.seconds) / s.seconds, fmt(sos.left || s.seconds), 'seconds', { c: 'accent' })}
    ${s.title.indexOf('protein') >= 0 ? `<div class="card list">${K.NOSH.slice(0, 5).map((n) => row({ label: n.item, value: n.portion })).join('')}</div>` : ''}
    ${last && p ? `<div class="btn-row">${textBtn('Tell ' + p.name + ' in the app', 'sos-notify', {}, { icon: 'heart' })}${textBtn('Text ' + p.name, 'sos-text')}</div>` : ''}
    <div class="flow-actions">${primary(last ? 'Finish' : 'Next', 'sos-next')}<div class="btn-row">${textBtn(sos.paused ? 'Resume' : 'Pause', 'sos-pause')}</div></div></div>`;
}
export function afterRender() { if (sos && sos.i >= 0 && !sos.done) loop(); }
export function leave(from, to) { if (from === 'sos' && to !== 'sos') stop(); }
function stop() { cancelAnimationFrame(raf); clearInterval(delayTimer); keepAwake(false); sos = null; }

export const actions = {
  'sos-start'() { keepAwake(true); sos.i = 0; startStep(); },
  'sos-next'() { sos.i++; startStep(); },
  'sos-pause'() {
    if (sos.paused) { sos.endsAt = Date.now() + sos.pausedLeft; sos.paused = false; }
    else { sos.pausedLeft = Math.max(0, sos.endsAt - Date.now()); sos.paused = true; }
    rerender();
  },
  'sos-delay'() {
    sos.delay = 600; rerender();
    clearInterval(delayTimer);
    delayTimer = setInterval(() => {
      if (!sos) { clearInterval(delayTimer); return; }
      sos.delay--;
      setRing('sos-delay', sos.delay / 600, fmt(sos.delay));
      if (sos.delay <= 0) clearInterval(delayTimer);
    }, 1000);
  },
  async 'sos-notify'() {
    try { await call('sos', { notifyPartner: true }); toast('Sent. Help is on the way.', { icon: 'heart' }); }
    catch (e) { S.write('cheer', { kind: 'sos', text: 'I\'m riding out a craving right now. A quick cheer would help.' }); toast('Saved. It will send when you\'re online.', { icon: 'heart' }); }
  },
  async 'sos-text'() {
    const text = 'Craving SOS. Riding it out. Send me some love?';
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    location.href = 'sms:&body=' + encodeURIComponent(text);
  },
  'sos-out'(el) {
    call('sos', { outcome: el.dataset.o }).catch(() => {});
    toast(/guilt/.test(el.dataset.o) ? 'No guilt. Next meal: protein first. Never miss twice.' : 'Nice work.', { icon: 'heart' });
    stop(); go('summary', { replace: true });
  },
  'sos-exit'() { stop(); go('summary', { replace: true }); }
};
