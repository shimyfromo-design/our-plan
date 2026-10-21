/* Round 4 (section 6): Cook mode (R4Supper) — full screen, no tab bar. The recipe's steps; every step with a time gets a
 * timer; several run at once by the wall clock (right after the screen was off); a soft chime through the one unlocked
 * audio player when one ends (the person started it with a tap), and a local notification from the service worker when
 * the app is in the background; the screen stays awake. "Cooked" marks the meal, adds freezer portions for "cook
 * double", and the rating card asks tomorrow. #/cook/<recipeId>, or #/cook/prep for Sunday prep (6.4). */
import { L, esc, icon, toast, openSheet, closeSheet, keepAwake } from '../core.js?v=132c8397ab';
import { S } from '../store.js?v=229f42e888';
import { go, back, rerender } from '../nav.js?v=57c55c9996';
import { iconBtn, primary, textBtn, picks, card } from '../ui.js?v=9375313392';
import * as Voice from '../voice.js?v=6f7b9b2130';
import * as Food from './food.js?v=24cb1aa60c';

let C = null, tick = null;
const r4 = () => (S.data && S.data.round4) || {};
const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function start(id) {
  if (id === 'prep') {
    const steps = Food.prepSteps(Food.weekPlan() || Food.currentPlan());
    C = { id, title: 'Sunday prep', serves: 0, steps: steps.map((s) => s.text + (/\d+\s*(min|hour)/i.test(s.text) ? '' : ' (' + s.minutes + ' min)')), i: 0, timers: [], girls: '', done: false };
  } else {
    const r = S.recipe(id);
    if (!r) return false;
    const plan = Food.currentPlan();
    const slot = plan && ((plan.days || []).find((d) => d.date === S.today()) || {}).dinner;
    C = { id, title: r.title, serves: r.serves || 4, steps: (r.steps || []).slice(), i: 0, timers: [], girls: r.girlsNote || '', done: false, cookDouble: !!(slot && slot.recipe_id === id && slot.cookDouble), recipe: r };
  }
  keepAwake(true);
  return true;
}
export function render(r) {
  const id = r.parts[1];
  if (!C || C.id !== id) { if (!start(id)) return `<div class="flow"><div class="flow-top">${iconBtn('x', 'cook-stop', 'Stop cooking')}<span></span><span></span></div><p class="sub">This recipe isn't in your recipes anymore.</p></div>`; }
  const step = C.steps[C.i] || '';
  const last = C.i >= C.steps.length - 1;
  const t = L.stepTimers(step);
  const running = C.timers.filter((x) => !x.done);
  const now = Date.now();
  const timersHtml = running.length ? `<div class="timers">${running.map((x) => `<div class="card timer-card${x.endsAt - now <= 0 ? ' ended' : ''}"><span class="grow"><span class="h3">${esc(x.name)}</span>${x.note ? `<span class="sub">${esc(x.note)}</span>` : ''}</span><b class="num" data-timer="${esc(x.id)}">${fmt(x.endsAt - now)}</b>${iconBtn('x', 'cook-timer-stop', 'Stop the ' + x.name + ' timer', { data: { 'data-id': x.id } })}</div>`).join('')}</div>` : '';
  return `<div class="flow cook">
    <div class="flow-top">${iconBtn('x', 'cook-stop', 'Stop cooking')}<div class="flow-clock"><b class="cook-title">${esc(C.title)}</b><span>Step ${C.i + 1} of ${C.steps.length}${C.serves ? ' · serves ' + C.serves : ''}</span></div>${iconBtn('volume-2', 'speak', 'Read the step aloud', { data: { 'data-vkey': 'cook:' + C.id + ':' + C.i, 'data-text': step } })}</div>
    <div class="flow-prog" aria-hidden="true">${C.steps.map((s, i) => `<i><u style="width:${i < C.i ? 100 : (i === C.i ? 50 : 0)}%"></u></i>`).join('')}</div>
    ${timersHtml}
    <div class="eyebrow act">Now</div>
    <p class="cook-step">${esc(C.id === 'prep' ? String(step).replace(/\s*\(\d+ min\)$/, '') : step)}</p>
    ${t.length ? `<div class="picks" style="margin-top:12px">${t.map((x) => `<button type="button" class="pick" data-act="cook-timer" data-m="${x.minutes}" data-n="${esc(timerName(step))}" data-note="${esc(x.text)}">${icon('timer')} ${esc(x.minutes >= 60 ? (x.minutes / 60) + ' h' : x.minutes + ' min')}</button>`).join('')}</div>` : ''}
    ${C.girls ? card(`<p class="note">${icon('hand-heart')}<span>${esc(C.girls)}</span></p>`, 'girls') : ''}
    <div class="flow-actions">${last ? primary('Cooked', 'cook-done') : primary('Next step', 'cook-next')}
      <div class="btn-row">${C.i > 0 ? textBtn('Back', 'cook-back') : ''}${textBtn('Add a timer', 'cook-add')}</div></div></div>`;
}
/** "Roast the chicken 35–40 minutes" → "Chicken in the oven"-style short names from the step's first words. */
function timerName(step) {
  const s = String(step || '');
  const m = /\b(chicken|carrots?|potatoes|rice|soup|salmon|fish|beef|brisket|vegetables|onions?|eggs?|pasta|cholent|kugel|sauce|lentils|broccoli|cauliflower|meatballs|chili)\b/i.exec(s);
  if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
  return s.split(/[ ,.]/).slice(0, 2).join(' ').replace(/^./, (c) => c.toUpperCase()) || 'Timer';
}
function addTimer(name, minutes, note) {
  C.timers.push({ id: 't' + Date.now().toString(36) + C.timers.length, name, note: note || '', endsAt: Date.now() + minutes * 60000, done: false, chimed: false });
  syncSw();
  rerender();
}
/** Tell the service worker, so a timer that ends while the app is in the background still says so. */
function syncSw() {
  try {
    const list = C ? C.timers.filter((x) => !x.done && !x.chimed).map((x) => ({ id: x.id, name: x.name, at: x.endsAt })) : [];
    if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'timers', timers: document.visibilityState === 'hidden' ? list : [], route: 'cook/' + (C ? C.id : '') });
  } catch (e) { /* no worker */ }
}
function loop() {
  clearInterval(tick);
  tick = setInterval(() => {
    if (!C) { clearInterval(tick); return; }
    const now = Date.now();
    C.timers.forEach((x) => {
      const el = document.querySelector('[data-timer="' + x.id + '"]');
      if (el) el.textContent = fmt(x.endsAt - now);
      if (!x.chimed && x.endsAt <= now) {
        x.chimed = true;
        if (document.visibilityState === 'visible') { Voice.beep(); toast(x.name + (/s$/i.test(x.name) ? ' are' : ' is') + ' done', { icon: 'timer', ms: 8000 }); }
        rerender();
      }
    });
  }, 500);
}
export function afterRender() { if (C) loop(); }
export function leave(from, to) { if (/^cook/.test(from) && !/^cook/.test(to)) { clearInterval(tick); keepAwake(false); } }
document.addEventListener('visibilitychange', () => { if (C) { syncSw(); if (document.visibilityState === 'visible') { keepAwake(true); loop(); rerender(); } } });

export const actions = {
  'cook-next'() { if (C.i < C.steps.length - 1) { C.i++; rerender(); } },
  'cook-back'() { if (C.i > 0) { C.i--; rerender(); } },
  'cook-timer'(el) { addTimer(el.dataset.n, +el.dataset.m, el.dataset.note); },
  'cook-timer-stop'(el) { const x = C.timers.find((t) => t.id === el.dataset.id); if (x) x.done = true; syncSw(); rerender(); },
  'cook-add'() { openSheet({ title: 'Add a timer', body: `<label class="field"><span>Name</span><input id="ct-name" value="${esc(timerName(C.steps[C.i]))}" autocomplete="off"></label>${picks([[1, '1'], [5, '5'], [10, '10'], [15, '15'], [20, '20'], [30, '30 min']], 'cook-add-go', '', { label: 'Minutes', fit: true })}` }); },
  'cook-add-go'(el) { const n = String((document.getElementById('ct-name') || {}).value || 'Timer').trim() || 'Timer'; closeSheet(); addTimer(n, +el.dataset.v, ''); },
  'cook-stop'() { const id = C ? C.id : ''; C = null; clearInterval(tick); keepAwake(false); syncSw(); if (id && id !== 'prep') go('plan/recipe/' + id, { replace: true }); else back('plan'); },
  'cook-done'() {
    if (C.id !== 'prep') {
      S.write('checkin', { date: S.today(), kind: 'cooked', value: C.id });
      if (C.cookDouble) { S.write('freezer', { op: 'add', name: C.title, portions: Math.max(1, Math.round((C.serves || 4) / 2)), recipeId: C.id }); toast('Cooked. Half went into the freezer list.'); }
      else toast('Cooked. Enjoy it.');
      S.setUi('cooked', Object.assign({}, S.ui.cooked || {}, { [S.today()]: C.id }));
    } else toast('Sunday prep done.');
    C.timers.forEach((x) => { x.done = true; });
    syncSw();
    C = null; clearInterval(tick); keepAwake(false);
    go('meals', { replace: true });
  }
};
