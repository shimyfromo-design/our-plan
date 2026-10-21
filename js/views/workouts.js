/* Round 5: the Workouts tab (screen 01; Plan renamed) and Log a workout (screen 08).
 * Today's workout card: the letter, block and week, the moves with "Learn first", the true time for the chosen length
 * (Short / Regular / Full), the late line after 8 pm, the make-up line the morning after a missed day, "Make today
 * lighter", and Start workout. Then This week, Log a workout (any day, any length) and Supplements. Her gentle start,
 * the symptom gate and the physio card follow program part 10. */
import { L, esc, icon, toast, openSheet, closeSheet, updateSheet, longDate, shortDate, dayName } from '../core.js?v=132c8397ab';
import { S } from '../store.js?v=229f42e888';
import { go, rerender } from '../nav.js?v=57c55c9996';
import { tabHead, card, listCard, row, primary, textBtn, seg, nav, pageTitle, bar, videoCover } from '../ui.js?v=9375313392';
import { logged } from '../fx.js?v=73177c13f1';
import * as Train from './train.js?v=f0f02667e0';
import * as Plan from './plan.js?v=5d0bdc692d';

const fmtMin = (s) => Math.max(1, Math.round(s / 60));
const cap1 = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
export function render(r) {
  const sub = r.parts[1];
  if (sub === 'supplements') return Plan.render({ name: 'plan', parts: ['plan', 'supplements'], params: r.params });
  if (sub === 'week') return weekPage();
  if (sub === 'learn') return learnPage(r.parts[2]);
  return tab();
}
export function afterRender() {}

function tab() {
  const head = tabHead({ eyebrow: longDate(S.realToday()), title: 'Workouts' });
  if (!S.setupDone()) return `<div class="stack">${head}${card(`<h2 class="card-title">Set up first</h2><p class="sub">Answer a few questions so your plan fits you.</p>${primary('Set up my plan', 'go', { 'data-to': 'setup' })}`)}</div>`;
  if (!S.r5()) return `<div class="stack">${head}${card('<p class="sub">Your new program is getting ready. Pull down or open the app again in a minute.</p>')}</div>`;
  if (Train.running()) return `<div class="stack">${head}${card(`<div class="eyebrow">In progress</div><h2 class="card-title">Your workout is waiting</h2><p class="sub">It picks up at the same set.</p>${primary('Go back to it', 'go', { 'data-to': 'workout' })}`)}${rows()}</div>`;
  return `<div class="stack">${head}${doctorCard()}${workoutCard()}${rows()}${footNote()}</div>`;
}
/** Hers, once before training (Round 4's question stays; her answer carries over). */
function doctorCard() {
  const me = S.person(S.meId()) || {}, s = S.settings();
  if (!me.safe || (s.doctor_ok && s.doctor_ok.answer)) return '';
  // (audit B8) her card names the midwife and her gentle start; anyone else in safe mode (a health-check "Yes") gets the
  // program's own words, because only she has the gentle start
  const hers = S.who() === 'f';
  return card(`<div class="eyebrow">Before your plan starts</div><h2 class="card-title" style="font-size:var(--f22)">${hers ? 'Did your doctor or midwife OK exercise?' : 'Did your doctor OK exercise?'}</h2>
    <p class="sub" style="margin-top:4px">${hers ? 'Either way you begin with the gentle start: breathing, the pelvic floor and easy core moves.' : 'Either way the Learn weeks start easy, one move at a time. If anything hurts, stop and ask your doctor.'}</p>
    <div class="picks fit" style="margin-top:12px"><button type="button" class="pick" data-act="doctor-ok" data-v="yes">Yes</button><button type="button" class="pick" data-act="doctor-ok" data-v="notyet">Not yet</button></div>`);
}
function workoutCard() {
  const t = Train.today();
  const st = t.st, sess = t.sess, k = t.kind;
  const s = S.settings();
  if (k.kind === 'notyet') {
    return card(`<div class="eyebrow">Your new program</div><h2 class="card-title">Your new program starts ${esc(dayName(st.start))}</h2>
      <p class="sub">Workout 1 has the most to learn, so it starts on a Sunday. Until then, walks count.</p><div class="center" style="margin-top:8px">${textBtn('Start now', 'w5-start-now')}</div>`, 'wkcard');
  }
  const cdT = L.calDay(S.cal(), S.realToday()), yt = cdT.isRest ? cdT.isYomTov : L.calDay(S.cal(), L.addDays(S.realToday(), 1)).isYomTov; // erev: the day that's coming
  if (k.kind === 'rest') return card(`<div class="eyebrow">Today</div><h2 class="card-title">${yt ? 'Yom Tov' : 'Shabbat'}</h2><p class="sub">A rest day. Your week counts the same.</p>`, 'wkcard');
  if (k.kind === 'shabbatsoon') return card(`<div class="eyebrow">Today</div><h2 class="card-title">${yt ? 'Yom Tov' : 'Shabbat'} soon</h2><p class="sub">Not enough time to finish before candle lighting. Your week counts the same.</p>`, 'wkcard');
  if (k.kind === 'fast') return card(`<div class="eyebrow">Today</div><h2 class="card-title">Fast day</h2><p class="sub">Workouts are paused. Your week counts the same.</p>`, 'wkcard');
  const done = k.done;
  // (walk B1) today's workout is done: say so and name the next one and its day, nothing to start again (three a week)
  if (done && k.kind !== 'off') {
    let nd = ''; for (let i = 1; i <= 7 && !nd; i++) { const d = L.addDays(S.realToday(), i); if ([0, 2, 4].indexOf(L.weekday(d)) >= 0 && !L.calDay(S.cal(), d).isRest) nd = d; }
    const what = sess.gentle ? 'Gentle start session ' + Math.max(1, (st.gentle.sessions || 1)) : 'Workout ' + L.letterOf(Math.max(1, st.n - 1));
    const next = sess.gentle ? 'Gentle start session ' + (Math.max(1, st.gentle.sessions || 1) + 1) : 'Workout ' + sess.letter; // (audit W8) says which one
    return card(`<div class="eyebrow act">Today · done</div><h2 class="card-title">${esc(what)} done</h2><p class="sub">Next: ${esc(next)}${nd ? ' on ' + esc(dayName(nd)) : ''}.</p>`, 'wkcard');
  }
  const physio = t.gentle && st.gentle.physioCard ? card(`<div class="eyebrow">${esc(L.PHYSIO_CARD.title)}</div><p class="sub">${esc(L.PHYSIO_CARD.text)}</p><div class="center">${textBtn(L.PHYSIO_CARD.go, 'w5-physio-go')}</div>`) : '';
  const ready = st.gentle.done && st.gentle.why === 'clear3' && t.who === 'f' && st.done === 0 ? `<p class="note">${icon('check')}<span>Ready for the full program</span></p>` : '';
  const ids = []; sess.steps.forEach((x) => { if (x.type === 'set' && ids.indexOf(x.move) < 0) ids.push(x.move); });
  const moveRows = ids.map((id) => {
    const m = sess.moves[id] || {}, base = L.MOVES5[id] || L.GENTLE5[id] || {};
    const learn = sess.gentle ? !(st.learned || {})[id] : m.learn;
    const name = sess.gentle ? (sess.steps.find((x) => x.move === id) || {}).name || base.name : m.name;
    const rung = m.rung && !sess.gentle ? String(m.rung.label || '').replace(new RegExp('^' + String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' · ', 'i'), '') : '';
    return `<button type="button" class="mrow" data-act="go" data-to="workouts/learn/${esc(id)}"><span class="mslot">${esc(L.slotLabel(id))}</span><span class="mname">${esc(name)}${rung && rung !== name ? `<span class="row-sub">${esc(cap1(rung))}</span>` : ''}</span>${learn ? '<span class="tag">Learn first</span>' : ''}</button>`;
  }).join('');
  const sets = sess.pairs.length ? Math.max.apply(null, sess.pairs.map((p) => p.rounds)) : 2;
  const effort = { learn: 'easy', light: 'easy', build: '', harder: '' }[sess.block] || '';
  const minutes = fmtMin(L.plannedTotal(sess));
  const title = sess.gentle ? 'Gentle start' : 'Workout ' + sess.letter;
  const eyebrow = (k.kind === 'makeup' ? 'Make-up · ' : (k.kind === 'off' ? 'Next · ' : 'Today · ')) + (sess.gentle ? 'session ' + sess.k : sess.line);
  const lengthPick = !sess.gentle && (sess.block === 'build' || sess.block === 'harder') && !k.shortOnly
    ? seg([['short', 'Short'], ['regular', 'Regular'], ['full', 'Full']], t.length, 'w5-length', { label: 'Workout length' }) : '';
  const late = k.late && s.late_line !== false && lengthPick ? `<p class="note">${icon('moon')}<span>${esc(k.late)}</span></p>` : '';
  const makeup = k.kind === 'makeup' ? `<p class="note">${icon('calendar-check')}<span>${esc(k.line)}${k.shortOnly && (sess.block === 'build' || sess.block === 'harder') ? ' Short only on Friday.' : ''}</span></p>` : ''; // audit Weak 2: Learn and Light weeks have one length
  const welcome = st.welcome && !sess.gentle ? `<p class="note">${icon('sparkles')}<span>${esc(st.welcomeLine || 'Back at it. Here\'s where you left off.')}</span></p>` : '';
  const lighter = !sess.gentle && k.kind !== 'off' ? `<button type="button" class="ready-note${t.ready.on ? ' on' : ''}" data-act="w5-lighter" aria-pressed="${t.ready.on}">${icon('moon')}<span>${t.ready.on ? (t.ready.why === 'ready' ? 'Lighter today after a short night or low energy. Tap for the usual workout.' : 'Lighter today: one set fewer, one rung lighter. Tap for the usual workout.') : 'Make today lighter'}</span></button>` : '';
  const herLine = t.who === 'f' ? `<p class="caption" style="margin-top:8px">${esc(L.HER_START_LINE)}</p>` : '';
  const earlyLight = L.offerEarlyLight({ n: st.n, sick: !!S.mode(S.meId()) && S.mode(S.meId()).key === 'sick', lighterThisWeek: Object.keys(s.lighter || {}).filter((d) => d >= L.weekStart(S.realToday()) && s.lighter[d] === true).length, lightAt: st.lightAt })
    ? card(`<div class="eyebrow">Run down?</div><p class="sub">You could start the Light week now and come back to Build after it.</p><div class="center">${textBtn('Start the Light week now', 'w5-early-light')}</div>`) : '';
  const startBtn = k.kind === 'off' ? `<div class="center">${textBtn('Do it today anyway', 't5-start', { 'data-len': t.length })}</div>` : primary(done ? 'Do another' : 'Start workout', 't5-start', { 'data-len': t.length, 'data-makeup': k.kind === 'makeup' ? '1' : '0' });
  return physio + card(`<div class="eyebrow act">${esc(eyebrow)}</div><h2 class="card-title">${esc(title)}</h2>
    <p class="sub">${ids.length} moves · ${sets} ${effort ? effort + ' ' : ''}${sets === 1 ? 'set' : 'sets'} · about ${minutes} min</p>${ready}${welcome}${makeup}
    <div class="mlist">${moveRows}</div>${lengthPick}${late}${lighter}${herLine}`, 'wkcard wk5') + earlyLight + `<div>${startBtn}</div>`;
}
function rows() {
  const id = S.meId();
  const lg = S.logs(id);
  const wk = L.activeWeek({ date: S.realToday(), workouts: lg.workouts, steps: lg.steps, goal: S.minutesGoal(id) });
  const supps = S.supplements().filter((x) => x.status === 'active');
  const taken = new Set(lg.supplog.filter((x) => x.date === S.realToday() && x.taken).map((x) => x.suppId));
  const toTake = supps.filter((x) => !taken.has(x.suppId)).length;
  return listCard([
    row({ icon: 'activity', c: 'activity', label: 'This week', value: wk.minutes + ' of ' + wk.goal + ' min', act: 'go', data: { 'data-to': 'workouts/week' } }),
    row({ icon: 'plus', label: 'Log a workout', sub: 'Any day, any length', act: 'w5-log' }),
    row({ icon: 'pill', label: 'Supplements', value: supps.length ? (toTake ? toTake + ' to take' : 'All taken') : '', act: 'go', data: { 'data-to': 'workouts/supplements' } })
  ]);
}
function footNote() {
  const t = Train.today();
  if (t.sess.gentle || t.sess.block !== 'learn') return '';
  const all = {}; Object.keys(L.MOVES5).forEach((k) => { all[k] = 2; }); // a Build workout with nothing new to learn and no finding sets left
  const mins = ['short', 'regular', 'full'].map((len) => fmtMin(L.plannedTotal(L.session5({ who: t.who, n: 13, length: len, hingeUnlocked: true, learned: all, findings: all }))));
  return `<p class="caption" style="padding:0 4px">From week 3: Short ${mins[0]} min, Regular ${mins[1]} min, Full ${mins[2]} min.</p>`;
}
/** This week: each day's active minutes against the goal. */
function weekPage() {
  const id = S.meId(), ws = L.weekStart(S.realToday()), lg = S.logs(id);
  const wk = L.activeWeek({ date: S.realToday(), workouts: lg.workouts, steps: lg.steps, goal: S.minutesGoal(id) });
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => L.addDays(ws, i)).filter((d) => d <= S.realToday());
  return nav({ back: 'Workouts', backTo: 'workouts', title: 'This week' }) + pageTitle('This week', wk.minutes + ' of ' + wk.goal + ' active minutes')
    + `<div class="stack">${card(`${bar(wk.pct, 'activity', 'thick', 'Active minutes this week')}<p class="sub" style="margin-top:8px">${wk.fromSteps ? wk.fromSteps + ' minutes from steps. ' : ''}Shabbat and Yom Tov count as rest, never against you.</p>`)}
    ${listCard(days.slice().reverse().map((d) => { const m = lg.workouts.filter((w) => w.date === d).reduce((a, w) => a + (+w.minutes || +w.version || 0), 0); return row({ label: dayName(d) + ', ' + shortDate(d), value: m ? m + ' min' : '—', act: 'w5-day', data: { 'data-d': d } }); }))}</div>`;
}
function learnPage(id) {
  const m = L.MOVES5[id] || L.GENTLE5[id];
  if (!m) return nav({ back: 'Workouts', backTo: 'workouts', title: '' }) + pageTitle('Not found');
  const f = L.FEEL[L.feelKind(id)] || { right: [], wrong: {} };
  const right = (f.right || []).map((c) => c.toLowerCase()).join(' and ');
  const wrong = L.orList(Object.keys(f.wrong || {}).map((c) => c.split(':')[0].toLowerCase()).filter((c, i, a) => a.indexOf(c) === i)); // (audit W12) "a, b or c"
  // Round 6 (1.6): the title is the version this person does now (rung 1 is "Box squat to a chair"), and under it where to
  // feel it, never the slot word ("Knee")
  let name = m.name, rung = 0;
  try { const t = Train.today(); const sm = t && t.sess && t.sess.moves && t.sess.moves[id]; if (sm && sm.name && !t.sess.gentle) name = sm.name; if (sm && sm.rungIndex != null) rung = sm.rungIndex; } catch (e) { /* the program's own name */ }
  const v = L.videoOf(id, rung, S.who()); // Round 6 (section 4): the checked video for this rung, or none
  return nav({ back: 'Workouts', backTo: 'workouts', title: name }) + pageTitle(name, esc(L.feelWhere(id) || 'Gentle start'))
    + `<div class="stack">${v ? videoCover(v, name) + `<p class="caption">Video: ${esc(v.channel)}</p>` : ''}
    <p class="sub">Setup: ${esc(String(m.setup || '').replace(/^./, (c) => c.toLowerCase()))}</p>
    <ol class="learn-points">${(m.points || []).map((p, k) => `<li><b>${k + 1}</b><span>${esc(p)}</span></li>`).join('')}</ol>
    ${right ? `<div class="card feelcard"><p>${icon('check')}<span>Feel it in the ${esc(right)}</span></p>${wrong ? `<p>${icon('x')}<span>Not in the ${esc(wrong)}</span></p>` : ''}</div>` : ''}
    ${m.squeeze ? `<p class="note">${icon('info')}<span>If you don't feel much: ${esc(m.squeeze.toLowerCase())}.</span></p>` : ''}</div>`;
}

// ------------------------------------------------------------------ Log a workout (screen 08)
const lw = { kind: 'band', name: '', min: '', date: '' };
export function logSheet(date) {
  lw.kind = 'band'; lw.name = ''; lw.min = ''; lw.date = date || S.today();
  if (lw.date > S.realToday()) lw.date = S.realToday();
  openSheet({ title: 'Log a workout', label: 'Log a workout', body: logBody(), doneLabel: 'Save', doneAct: 'w5-log-save', cancel: true });
  setTimeout(() => { const i = document.getElementById('lw-min'); if (i) i.focus(); }, 350);
}
function logBody() {
  const chip = (k, l) => `<button type="button" class="pick${lw.kind === k ? ' on' : ''}" data-act="w5-log-kind" data-v="${k}" aria-pressed="${lw.kind === k}">${l}</button>`;
  return `<div class="picks">${chip('band', 'Band workout')}${chip('walk', 'Walk')}${chip('other', 'Other')}</div>
    ${lw.kind === 'other' ? `<label class="field"><span class="sr">What did you do</span><input id="lw-name" type="text" maxlength="60" placeholder="What did you do?" value="${esc(lw.name)}" autocomplete="off"></label>` : ''}
    <div><div class="eyebrow" style="margin:0 4px 8px">How long</div><label class="minbox"><input id="lw-min" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="3" value="${esc(lw.min)}" aria-label="Minutes" autocomplete="off"><span>minutes</span></label></div>
    ${row({ label: 'Day', value: esc(dayName(lw.date) + ', ' + shortDate(lw.date)), act: 'w5-log-day', cls: 'no-ic field-row' })}`;
}
function dayPicker() {
  const days = []; for (let i = 0; i < 14; i++) days.push(L.addDays(S.realToday(), -i));
  return `<div class="inset">${days.map((d) => row({ label: (d === S.realToday() ? 'Today · ' : '') + dayName(d) + ', ' + shortDate(d), act: 'w5-log-pick', data: { 'data-d': d }, right: d === lw.date ? `<span class="row-value">${icon('check', 'ic-s')}</span>` : '', noChev: true })).join('')}</div>`;
}

export const actions = {
  'w5-log'(el) { logSheet(el && el.dataset && el.dataset.d ? el.dataset.d : S.realToday()); }, // (walk W17) also from Summary's Activity sheet, for the day open there
  'w5-log-kind'(el) { syncLw(); lw.kind = el.dataset.v; updateSheet({ title: 'Log a workout', body: logBody() }); },
  'w5-log-day'() { syncLw(); updateSheet({ title: 'Which day?', body: dayPicker() }); },
  'w5-log-pick'(el) { lw.date = el.dataset.d; updateSheet({ title: 'Log a workout', body: logBody() }); },
  'w5-log-save'() {
    syncLw();
    const m = Math.round(+lw.min);
    if (!(m >= 1 && m <= 600)) { toast('Type the minutes first.', { kind: 'err' }); const i = document.getElementById('lw-min'); if (i) i.focus(); return; }
    const op = S.write('r5Log', { kind: lw.kind, name: lw.kind === 'other' ? (lw.name || 'Other') : '', minutes: m, date: lw.date });
    closeSheet();
    logged(op, (lw.kind === 'walk' ? 'Walk' : lw.kind === 'band' ? 'Band workout' : (lw.name || 'Workout')) + ' · ' + m + ' min' + (lw.date !== S.realToday() ? ' on ' + dayName(lw.date) : '') + '. Logged.');
  },
  'w5-length'(el) { S.setUi('t5len_' + S.meId(), el.dataset.v); S.write('settings', { values: { program5: Object.assign({}, S.settings().program5 || {}, { length: el.dataset.v }) } }); rerender(); },
  'w5-lighter'() {
    const t = Train.today();
    const cur = Object.assign({}, S.settings().lighter || {});
    cur[S.realToday()] = !t.ready.on;
    S.write('settings', { values: { lighter: cur } });
    toast(!t.ready.on ? 'Lighter today: one set fewer, one rung lighter.' : 'Today\'s usual workout is back.', { icon: 'moon' });
  },
  'w5-start-now'() {
    S.write('settings', { values: { program5: Object.assign({}, S.settings().program5 || {}, { start: S.realToday(), startNow: true }) } });
    // (audit W18) on a day without a workout, say when Workout A is, as the card does
    const t = S.realToday(); let nd = ''; for (let i = 1; i <= 7 && !nd; i++) { const d = L.addDays(t, i); if ([0, 2, 4].indexOf(L.weekday(d)) >= 0 && !L.calDay(S.cal(), d).isRest) nd = d; }
    toast([0, 2, 4].indexOf(L.weekday(t)) >= 0 ? 'Your program starts today.' : 'Your program has started. Workout A is on ' + dayName(nd) + ', or today if you like.', { icon: 'check', ms: 4000 });
  },
  'w5-physio-go'() { S.write('settings', { values: { physio_go: S.realToday() } }); toast('Noted. The full program is next.', { icon: 'check' }); },
  'w5-early-light'() { const st = S.program(); S.write('settings', { values: { program5: Object.assign({}, S.settings().program5 || {}, { lightAt: st.n }) } }); toast('The Light week starts with your next workout.', { icon: 'moon' }); },
  'w5-day'(el) { S.view = el.dataset.d; go('summary'); }
};
function syncLw() {
  const m = document.getElementById('lw-min'); if (m) lw.min = m.value.replace(/\D/g, '').slice(0, 3);
  const n = document.getElementById('lw-name'); if (n) lw.name = n.value.trim().slice(0, 60);
}
void Train; void Plan;
