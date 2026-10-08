/* Summary (D1–D6): what's next, today at a glance, weight, the coach, your partner, and the craving plan.
 * Logging lives in each row's sheet, never on the Summary itself. */
import { L, K, esc, icon, chev, toast, openSheet, updateSheet, closeSheet, longDate, shortDate, clock, resizeImage, makeZip, shareOrDownload, todayISO, busy } from '../core.js?v=c1a0501fca';
import { S } from '../store.js?v=5199216217';
import { call } from '../api.js?v=d44773a102';
import { go, rerender } from '../nav.js?v=57c55c9996';
import { tabHead, greeting, card, listCard, row, trow, bar, primary, textBtn, iconBtn, seg, picks, sparkline, weightChart, nav, pageTitle, empty, swipe, checkCircle, initialOf, sectionTitle } from '../ui.js?v=b5958020ce';
import { logged, tipOnce, undoOp } from '../fx.js?v=34cbfc2a31';
import * as Voice from '../voice.js?v=decfa3dab7';
import * as Labs from './labs.js?v=422eee147f';

const hm = (t) => (t ? L.fmt12(t).replace(/ (am|pm)$/, '') : '');
let pulseStreak = false;
export function pulse() { pulseStreak = true; }

export function render(r) {
  const sub = r.parts[1];
  if (sub === 'weight') return weightPage();
  if (sub === 'labs') return Labs.renderPage(r.parts[2]);
  if (sub === 'photos') return photosPage();
  if (sub === 'doctor') return doctorPage(r.parts[2]);
  return summary();
}
export function afterRender(r) {
  if (r.parts[1]) return;
  if (S.setupDone()) Voice.prefetchText((S.dayPlan().lines || []).join(' ')); // A3: the speaker plays at once (once a day, then cached)
  if (pulseStreak) { pulseStreak = false; const f = document.querySelector('.head-line .flame'); if (f) { f.classList.add('pulse'); setTimeout(() => f.classList.remove('pulse'), 700); } }
}

// ------------------------------------------------------------------ the Summary screen (D1)
function headLine() {
  const today = S.today();
  const bits = [];
  const st = S.streak(S.meId());
  bits.push(`<span class="flame">${icon('flame')}<span>${st.current} ${st.current === 1 ? 'day' : 'days'}</span></span>`);
  const d = S.day(today);
  if (d.hebrew) bits.push(`<span>${esc(String(d.hebrew).replace(/\s+\d{4}$/, ''))}</span>`);
  const w = S.restWindow();
  if (w) bits.push(`<span>${esc(w.during ? w.label + ' ends ' + hm(w.end) : w.label + ' ' + hm(w.candles) + ' – ' + hm(w.end))}</span>`);
  return bits.join('<span class="dot" aria-hidden="true">·</span>');
}
function summary() {
  const me = S.me();
  const today = S.today();
  const head = tabHead({ eyebrow: longDate(today), title: greeting(me.name, S.minutes()), greet: true, line: headLine() });
  if (!S.setupDone()) {
    return `<div class="stack">${head}${card(`<div class="eyebrow">Welcome</div><h2 class="card-title">Let's set up your plan</h2><p class="sub">One question at a time. About three minutes.</p>${primary('Set up my plan', 'go', { 'data-to': 'setup' })}`, 'next')}</div>`;
  }
  return `<div class="stack">${head}${nextCard()}<div>${sectionTitle('Today')}${todayCard()}</div>${weightCard()}${coachCard()}${partnerCard()}${cravingCard()}</div>`;
}

function nextCard() {
  const n = S.next();
  const plan = S.dayPlan();
  const w = plan.workout;
  let c = 'accent', ey = 'Next up', title = '', line = '', btn = '';
  switch (n.key) {
    case 'weigh': c = 'weight'; title = 'Weigh in'; line = 'Before breakfast. Same scale, same time.'; btn = primary('Weigh in', 'weigh'); break;
    case 'workout': c = 'activity'; title = w.title + ' · ' + w.minutes + ' min'; line = w.where; btn = primary('Start workout', 'go', { 'data-to': 'workout' }); break;
    case 'walk': c = 'activity'; title = n.partial ? 'Walk ' + n.minutes + ' more minutes' : 'Walk ' + n.minutes + ' minutes'; line = 'Talk-but-not-sing pace. Stroller walks count.'; btn = primary('I walked', 'walked', { 'data-m': n.minutes }); break;
    case 'preshabbat': { const sh = L.weekday(S.today()) === 5; title = 'Get ready for ' + (sh ? 'Shabbat' : 'Yom Tov'); line = 'Candles at ' + hm(plan.candles) + '. Log today, then put the phone down.'; btn = primary('I\'m ready', 'preshabbat'); break; }
    case 'catchup': title = 'Catch up on Shabbat'; line = 'Two taps, and your streak is safe.'; btn = primary('Catch up', 'catchup-sheet'); break;
    case 'rest': ey = n.reason === 'yomtov' ? 'Yom Tov' : 'Shabbat'; title = n.reason === 'yomtov' ? 'Chag sameach' : 'Shabbat shalom'; line = 'Rest and enjoy. Your streak is safe.'; break;
    case 'motzei': ey = 'Shavua tov'; title = 'All caught up'; line = 'Rest well. Tomorrow is a fresh start.'; break;
    case 'fast': title = 'Fast day'; line = 'Workouts are paused. Water first when the fast ends.'; break;
    case 'sick': title = 'Rest and recover'; line = 'Fluids, sleep, simple food. Your streak is safe.'; break;
    default: title = 'All done for today'; line = 'Nice work. Protein first at dinner.';
  }
  const text = (plan.lines || []).join(' ');
  const quiet = S.quiet().quiet;
  const speak = quiet ? '' : `<button class="btn-icon speak" type="button" data-act="speak" data-vkey="plan:${esc(plan.date)}" data-text="${esc(text)}" aria-label="Read today's plan aloud">${icon('volume-2')}<span class="sr">Play</span></button>`;
  return card(`<div class="eyebrow">${esc(ey)}</div><h2 class="card-title">${esc(title)}</h2>${line ? `<p class="sub">${esc(line)}</p>` : ''}${speak}${btn}`, 'next' + (btn ? '' : ' done'), `style="--c-text: var(--${c === 'accent' ? 'text2' : c + '-text'})"`);
}

function todayCard() {
  const plan = S.dayPlan();
  const d = S.done();
  const pr = S.protein();
  const habits = S.habits();
  const sleep = d.sleepHours;
  const goal = plan.activityGoal || 0;
  const sleepNum = sleep == null ? '—' : fmtH(sleep);
  const sleepOf = sleep == null ? (d.energy ? 'h · energy ' + d.energy : 'Tap to log') : 'h' + (d.energy ? ' · energy ' + d.energy : '');
  return `<section class="card list">
    ${trow({ icon: 'footprints', c: 'activity', label: 'Activity', num: `<span data-count="${d.activityMin}" data-count-key="act-${plan.date}">${d.activityMin}</span>`, of: goal ? 'of ' + goal + ' min' : 'min', pct: goal ? d.activityMin / goal : (d.activityMin ? 1 : 0), act: 'activity-sheet', aria: 'Activity, ' + d.activityMin + ' of ' + goal + ' minutes' })}
    ${trow({ icon: 'egg', c: 'protein', label: 'Protein', num: `<span data-count="${pr.have}" data-count-key="pro-${plan.date}">${pr.have}</span>`, of: 'of ' + pr.grams + ' g', pct: pr.pct, act: 'protein-sheet', aria: 'Protein, ' + pr.have + ' of ' + pr.grams + ' grams' })}
    ${trow({ icon: 'utensils', c: 'habits', label: 'Food habits', num: String(d.habitCount), of: 'of ' + habits.length, segs: { total: habits.length, on: Math.min(habits.length, d.habitCount) }, act: 'habits-sheet', aria: 'Food habits, ' + d.habitCount + ' of ' + habits.length })}
    ${trow({ icon: 'moon', c: 'sleep', label: 'Sleep & energy', num: sleepNum, of: sleepOf, pct: sleep == null ? 0 : sleep / 8, act: 'sleep-sheet', aria: 'Sleep and energy' + (sleep == null ? ', not logged' : ', ' + sleep + ' hours') })}
  </section>`;
}
const fmtH = (h) => String(Math.round(h * 10) / 10);

function weightCard() {
  const id = S.meId();
  const ws = S.logs(id).weights.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (String(a.ts) < String(b.ts) ? -1 : 1)));
  const series = S.series(id);
  const last = ws[ws.length - 1];
  const when = last ? (last.date === S.today() ? 'This morning' : last.date === L.addDays(S.today(), -1) ? 'Yesterday' : shortDate(last.date)) : '';
  // H1: the change line only from two weigh-ins on; over 2 weeks once there are 2 weeks, else since the first weigh-in
  let line = !last ? 'No weigh-ins yet' : '';
  if (series.length >= 2) {
    const from14 = L.trendAt(series, L.addDays(S.today(), -14));
    const a = from14 != null ? from14 : series[0].trend;
    const ch = L.round(series[series.length - 1].trend - a, 1);
    const span = from14 != null ? ' in 2 weeks' : ' since ' + shortDate(series[0].date);
    line = ch < 0 ? 'Down ' + Math.abs(ch) + ' lb' + span : ch > 0 ? 'Up ' + ch + ' lb' + span : 'Steady' + (from14 != null ? ' over 2 weeks' : span);
  }
  const right = ws.length < 3 ? `<span class="wait">Trend after a few more weigh-ins</span>` : sparkline(series, S.today());
  return `<button class="card wcard" type="button" data-act="go" data-to="summary/weight">
    <span class="wtop"><span class="eyebrow">Weight</span><span class="when">${esc(when)}${chev()}</span></span>
    <span class="wbody"><span class="grow"><span class="wcard-num"><b>${last ? esc(last.lbs) : '—'}</b>${last ? '<span>lb</span>' : ''}</span>${line ? `<span class="sub">${esc(line)}</span>` : ''}</span>${right}</span></button>`;
}

function coachCard() {
  const c = S.data.coach || {};
  // E5: a real sentence from the coach — today's morning message (its encouragement, never its plan lines), else the
  // latest thing the coach learned — never the plan title
  const morning = c.morning && L.nyDate(c.morning.ts) === S.today() ? L.coachSentence(c.morning.text) : '';
  const note = S.notes()[0];
  let text = toYou(morning || (note ? note.note : ''), S.me().name);
  if (!text) text = S.hasCoach() ? 'Tell the coach what you did, or ask anything.' : 'The coach joins once it\'s connected.';
  return `<button class="card coachcard" type="button" data-act="go" data-to="coach" style="text-align:left;width:100%;border:0"><div class="eyebrow">${icon('sparkles')}<span>Coach</span></div><p>${esc(text)}</p></button>`;
}
/** "Sam showed up most days" → "You showed up most days" (reviews and notes are sometimes written about the person). */
export function toYou(t, name) {
  t = String(t || '');
  const n = String(name || '').trim();
  if (!n || t.toLowerCase().indexOf(n.toLowerCase()) !== 0) return t;
  const rest = t.slice(n.length);
  if (/^'s\b/.test(rest)) return 'Your' + rest.slice(2);
  const m = /^ (\w+)/.exec(rest);
  if (!m) return t;
  const v = m[1], lv = v.toLowerCase();
  const irregular = { was: 'were', is: 'are', has: 'have', does: 'do', goes: 'go' };
  const verb = irregular[lv] || (/(ss|us|is)$/.test(lv) || !/s$/.test(lv) ? v : v.replace(/ies$/, 'y').replace(/(ch|sh|x|o)es$/, '$1').replace(/s$/, ''));
  return 'You ' + verb + rest.slice(1 + v.length);
}

function partnerCard() {
  const p = S.partner();
  if (!p) return '';
  let sub = 'Sharing is paused';
  if (S.visible(p.id)) {
    const d = S.done(p.id);
    const bits = [];
    bits.push(d.walkMin ? 'Walked ' + d.walkMin + ' min' : (d.workoutDone ? 'Worked out' : 'No walk yet'));
    bits.push(d.habitCount + ' of ' + S.habits(p.id).length + ' habits');
    sub = bits.join(' · ');
  }
  const sent = cheeredToday(p.id);
  return card(`<div class="prow"><span class="initial mid" aria-hidden="true">${esc(initialOf(p.name))}</span><span class="grow"><span class="row-label b" style="display:block">${esc(p.name)}</span><span class="row-sub">${esc(sub)}</span></span>
    ${iconBtn('heart', 'quick-cheer', sent ? 'Cheer sent to ' + p.name + ' today' : 'Send ' + p.name + ' a cheer', { on: sent, pressed: sent })}</div>`, 'tight');
}
function cheeredToday(pid) { return ((S.data.together && S.data.together.cheers) || []).some((c) => c.from === S.meId() && c.to === pid && todayISO(new Date(c.ts)) === S.today()); }
function cravingCard() {
  return `<button class="card craving" type="button" data-act="go" data-to="sos">${icon('life-buoy')}<span>Craving? 2-minute plan</span>${chev()}</button>`;
}

// ------------------------------------------------------------------ sheets (D2–D5, weigh-in, catch-up)
const sleepPick = { h: null, e: null, more: false };
function activitySheet() {
  const plan = S.dayPlan(), d = S.done(), goal = plan.activityGoal || 0;
  const lg = S.logs(S.meId());
  const today = S.today();
  const todays = lg.workouts.filter((w) => w.date === today).slice().sort((a, b) => (String(a.ts) < String(b.ts) ? -1 : 1));
  const steps = lg.steps.filter((x) => x.date === today && x.source === 'health').pop();
  const workoutDay = plan.workout.kind === 'strength' || plan.workout.kind === 'light';
  const loggedList = todays.length ? `<div><div class="eyebrow" style="margin:0 4px 6px">Logged today</div><div class="inset">${todays.map((w) => swipe(row({ icon: w.kind === 'walk' ? 'footprints' : 'timer', c: 'activity', label: w.kind === 'walk' ? 'Walk' : (w.kind === 'light' ? 'Light workout' : 'Strength workout'), sub: w.ts ? clock(w.ts) : '', value: (w.minutes || w.version || 0) + ' min' }), 'del-log', { 'data-tab': 'Workouts', 'data-id': w.id })).join('')}</div><p class="caption" style="margin:8px 4px 0">Swipe left on a line to remove it.</p></div>` : '';
  const body = `<div><div class="bigline"><b class="num" style="font-size:var(--f22);font-weight:700">${d.activityMin}</b><span>of ${goal} min</span></div><div style="margin-top:8px">${bar(goal ? d.activityMin / goal : 0, 'activity')}</div></div>
    <div><div class="eyebrow" style="margin:0 4px 8px">I walked</div>${picks([[10, '10'], [15, '15'], [20, '20'], [30, '30 min'], ['other', 'Other']], 'walk-pick', '', { label: 'Minutes walked', fit: true })}</div>
    ${workoutDay && !d.workoutDone ? primary('Start workout', 'go', { 'data-to': 'workout' }) : ''}
    <div class="center">${textBtn('Log a workout without the guide', 'log-workout')}</div>
    ${steps ? `<p class="sub center">${(+steps.steps).toLocaleString()} steps from iPhone Health · ${esc(clock(steps.ts))}</p>` : ''}
    ${loggedList}`;
  return updateOrOpen('activity', 'Activity', body);
}
function updateOrOpen(kind, title, body) {
  const open = document.querySelector('#sheet-root.open .sheet-body');
  if (open && open.dataset.kind === kind) return updateSheet({ title, body });
  const b = openSheet({ title, body, label: title });
  b.dataset.kind = kind;
  return b;
}
function proteinSheet() {
  const pr = S.protein();
  const portions = K.PROTEIN_PORTIONS.slice(0, 7);
  const left = Math.max(0, pr.grams - pr.have);
  const lineText = L.proteinLine(left); // E4: "125 g to go. About four palm-size portions."
  const items = (pr.items || []).slice().reverse().map((c) => {
    const [pid, g, name] = String(c.value).split(':');
    const p = K.PROTEIN_PORTIONS.find((x) => x.id === pid);
    return { id: c.id, ts: c.ts, g: +g, label: p ? p.label : (name ? L.capItem(name) : 'Something else') };
  });
  const tiles = portions.map((p) => `<button type="button" class="tile" data-act="protein" data-p="${esc(p.id)}" style="--c: var(--protein-text)" aria-label="${esc(p.label)}, plus ${p.g} grams"><b>${esc(p.label)}</b><span>+${p.g}</span></button>`).join('')
    + `<button type="button" class="tile add" data-act="protein-other"><b>+ Something else</b></button>`;
  const lg = items.length ? `<div><div class="eyebrow" style="margin:0 4px 6px">Logged today</div><div class="inset">${items.map((it) => swipe(row({ label: it.label, sub: it.ts ? clock(it.ts) : '', value: it.g + ' g', cls: 'no-ic' }), 'del-log', { 'data-tab': 'DailyCheckins', 'data-id': it.id })).join('')}</div><p class="caption" style="margin:8px 4px 0">Swipe left on a line to remove it.</p></div>` : '';
  const body = `<div><div class="bigline"><b class="big-num" data-count="${pr.have}">${pr.have}</b><span>of ${pr.grams} g today</span></div><div style="margin-top:10px">${bar(pr.pct, 'protein', 'thick')}</div><p class="sub" style="margin-top:10px">${esc(lineText)}</p></div>
    <div><div class="split" style="margin:0 4px 8px"><span class="eyebrow">Add a portion</span>${textBtn('Kosher ideas', 'protein-ideas', {}, { cls: 'small' })}</div><div class="tiles">${tiles}</div></div>${lg}`;
  return updateOrOpen('protein', 'Protein', body);
}
const habitInfo = {};
function habitsSheet() {
  const habits = S.habits();
  const d = S.done();
  const body = `<p class="bigline"><b class="num" style="font-size:var(--f22);font-weight:700">${d.habitCount}</b><span>of ${habits.length}</span></p>
    <div class="inset">${habits.map((h) => {
      const on = !!d.habits[h.key];
      return `<div class="row habit-row" style="cursor:default"><button type="button" class="grow" data-act="habit" data-key="${esc(h.key)}" aria-pressed="${on}" style="display:flex;align-items:center;gap:12px;background:none;border:0;padding:0;text-align:left;min-height:44px">${checkCircle(on)}<span class="row-main"><span class="row-label">${esc(h.short || h.label)}</span>${habitInfo[h.key] ? `<span class="row-sub">${esc(h.why || '')}</span>` : ''}</span></button><button type="button" class="info" data-act="habit-info" data-key="${esc(h.key)}" aria-label="What ${esc(h.short || h.label)} means" aria-expanded="${!!habitInfo[h.key]}">${icon('info')}</button></div>`;
    }).join('')}</div>`;
  return updateOrOpen('habits', 'Food habits', body);
}
function sleepSheet() {
  const d = S.done();
  if (sleepPick.h == null && d.sleepHours != null) sleepPick.h = Math.min(9, Math.round(d.sleepHours));
  if (sleepPick.e == null && d.energy != null) sleepPick.e = d.energy;
  const last = S.logs(S.meId()).sleep.slice(-1)[0];
  const body = `<div><div class="eyebrow" style="margin:0 4px 8px">Sleep last night</div>${picks([[5, '5'], [6, '6'], [7, '7'], [8, '8'], [9, '9'], ['more', 'More']], 'sleep-pick', sleepPick.more ? 'more' : sleepPick.h, { label: 'Hours of sleep', fit: true })}
      ${sleepPick.more ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><label class="field"><span>Hours</span><input id="sl-h" type="number" inputmode="decimal" step="0.25" min="0" max="16" value="${esc(d.sleepHours != null ? d.sleepHours : (last ? last.hours : 7))}"></label><label class="field"><span>Bedtime</span><input id="sl-b" type="time" value="${esc((last && last.bedtime) || S.profile().bedtime || '23:00')}"></label></div>` : ''}</div>
    <div><div class="eyebrow" style="margin:0 4px 8px">Energy today</div>${picks([[1, '1', 'Energy 1, drained'], [2, '2', 'Energy 2'], [3, '3', 'Energy 3'], [4, '4', 'Energy 4'], [5, '5', 'Energy 5, great']], 'energy-pick', sleepPick.e, { circle: true, label: 'Energy today', fit: true })}<p class="caption" style="margin:8px 4px 0">1 is drained, 5 is great.</p></div>`;
  const b = updateOrOpen('sleep', 'Sleep & energy', body);
  const done = document.querySelector('#sheet-root .sheet-head .btn-text');
  if (done) done.dataset.act = 'sleep-save';
  return b;
}
function weighSheet() {
  const ws = S.logs(S.meId()).weights;
  const last = ws.length ? ws[ws.length - 1].lbs : (S.profile().weight_start || '');
  openSheet({ title: 'Weigh-in', body: `<label class="field"><span>Pounds</span><input id="wt" class="big-input" type="number" inputmode="decimal" step="0.1" min="60" max="700" value="${esc(last)}" aria-label="Weight in pounds" autofocus></label>
    <label class="field"><span>Date</span><input id="wt-d" type="date" value="${esc(S.today())}" max="${esc(S.today())}"></label>`, doneAct: 'save-weight' });
}
function catchupSheet() {
  const c = S.catchup(S.meId());
  if (!c) { toast('All caught up.'); return; }
  const erevName = L.weekday(c.erev) === 5 ? 'Friday' : 'Erev Yom Tov';
  const part = (label, done, a, b) => row({ label, sub: done ? 'Logged' : '', right: done ? `<span class="row-value">${icon('check', 'ic-s')}</span>` : `<span style="display:flex;gap:4px">${a}${b}</span>` });
  openSheet({ title: 'Catch up', body: `<div class="inset">${part(erevName, c.erevDone, textBtn('Did it', 'catchup', { 'data-part': 'fri', 'data-v': 'done' }), textBtn('Skipped', 'catchup', { 'data-part': 'fri', 'data-v': 'skipped' }))}${part(c.label, c.restDone, textBtn('Rested', 'catchup', { 'data-part': 'sat', 'data-v': 'rested' }), textBtn('Walked', 'catchup', { 'data-part': 'sat', 'data-v': 'walked' }))}</div><p class="caption">Your streak is safe either way.</p>` });
}
function logWorkoutSheet() {
  const plan = S.dayPlan();
  const kind = plan.workout.kind === 'light' ? 'light' : 'strength';
  openSheet({ title: 'Log a workout', body: `<p class="sub">For a workout you did on your own.</p>
    <div><div class="eyebrow" style="margin:0 4px 8px">Minutes</div>${picks([[10, '10'], [20, '20'], [30, '30'], [45, '45 min']], 'logw-min', 20, { label: 'Workout minutes', fit: true })}</div>
    <div><div class="eyebrow" style="margin:0 4px 8px">How did it feel?</div><div class="feel">${['Easy', 'Just right', 'Hard'].map((f, i) => `<button type="button" data-act="logw-feel" data-v="${['easy', 'ok', 'hard'][i]}" class="${i === 1 ? 'on' : ''}" aria-pressed="${i === 1}">${f}</button>`).join('')}</div></div>
    ${primary('Save workout', 'logw-save', { 'data-kind': kind })}` });
}

// ------------------------------------------------------------------ the Weight page (D6)
const RANGES = { w: 7, m: 30, '6m': 182, y: 365 };
function weightPage() {
  const id = S.meId();
  const series = S.series(id);
  const range = S.ui.wRange3 || 'm';
  const to = S.today(), from = L.addDays(to, -RANGES[range]);
  const shown = series.filter((p) => p.date >= from);
  const cur = series.length ? series[series.length - 1].trend : null;
  const startT = shown.length ? shown[0].trend : null;
  const ch = cur != null && startT != null && shown.length >= 2 ? L.round(cur - startT, 1) : null;
  const span = shown.length ? shortDate(shown[0].date) + ' – ' + shortDate(to) : shortDate(from) + ' – ' + shortDate(to);
  const chLine = ch == null ? '' : (ch < 0 ? 'down ' + Math.abs(ch) + ' lb' : ch > 0 ? 'up ' + ch + ' lb' : 'steady'); // H1: no stray "—"
  const waists = S.logs(id).waists.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const wl = waists[waists.length - 1];
  const labs = S.labs(id);
  const labLast = labs.reduce((a, r) => (r.date > a ? r.date : a), '');
  const ask = Labs.askCount(id);
  const photos = ((S.data.photos || {})[id] || []);
  return nav({ back: 'Summary', backTo: 'summary', title: 'Weight', right: textBtn('Add', 'weigh', {}, { aria: 'Add a weigh-in' }) })
    + pageTitle('Weight')
    + `<div class="stack">${seg([['w', 'W', 'Week'], ['m', 'M', 'Month'], ['6m', '6M', 'Six months'], ['y', 'Y', 'Year']], range, 'w-range', { label: 'Range' })}
    <div style="padding:0 4px"><div class="eyebrow">Trend</div><div class="trendnum"><b>${cur == null ? '—' : esc(cur)}</b>${cur == null ? '' : '<span>lb</span>'}</div><p class="sub">${esc(span)}${chLine ? ' · ' + esc(chLine) : ''}</p></div>
    ${card(weightChart(series, from, to) + `<p class="caption" style="margin-top:8px;padding:0 8px">Dots are weigh-ins. The line is your trend.</p>`, 'chart-card')}
    ${listCard([
      row({ icon: 'ruler', c: 'weight', label: 'Waist', sub: wl ? 'Measured ' + dayWord(wl.date) : 'Once a week, at the belly button', value: wl ? esc(wl.inches) + ' in' : '', act: 'waist-sheet' }),
      row({ icon: 'droplet', c: 'weight', label: 'Blood tests', sub: ask ? `<i class="red-dot" aria-hidden="true"></i>${ask} to ask your doctor about` : (labLast ? 'Latest results' : 'None yet'), subCls: ask ? 'bad' : '', value: labLast ? shortDate(labLast) : '', act: 'go', data: { 'data-to': 'summary/labs' } }),
      row({ icon: 'camera', c: 'weight', label: 'Progress photos', sub: 'Monthly, private', value: photos.length ? String(photos.length) : '', act: 'go', data: { 'data-to': 'summary/photos' } }),
      row({ icon: 'file-text', c: 'weight', label: 'Doctor summary', sub: 'One page to print or share', act: 'go', data: { 'data-to': 'summary/doctor' } })
    ])}
    <button type="button" class="card craving" data-act="photo-sheet" data-hint="lab" style="min-height:56px">${icon('camera')}<span>Add a blood test</span>${chev()}</button></div>`;
}
function dayWord(date) {
  const t = S.today();
  if (date === t) return 'today';
  if (date === L.addDays(t, -1)) return 'yesterday';
  return L.daysBetween(date, t) < 7 ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Shabbat'][L.weekday(date)] : shortDate(date);
}
function waistSheet() {
  const last = S.logs(S.meId()).waists.slice(-1)[0];
  openSheet({ title: 'Waist', body: `<p class="sub">Tape at the belly button, relaxed, after breathing out.</p>
    <label class="field"><span>Inches</span><input id="waist-in" class="big-input" type="number" inputmode="decimal" step="0.25" min="15" max="90" value="${esc(last ? last.inches : '')}" autofocus></label>
    <label class="field"><span>Belt notch (optional)</span><input id="notch-in" type="text" placeholder="For example, 4th hole" value="${esc(last ? last.notch || '' : '')}"></label>
`, doneAct: 'save-waist' });
}

// ------------------------------------------------------------------ progress photos (monthly, private)
const photos = { cache: {}, loading: {}, error: '' };
function photosPage() {
  const id = S.meId();
  const list = ((S.data.photos || {})[id] || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const month = S.today().slice(0, 7);
  const a = list[0], b = list[list.length - 1];
  const thumb = (p) => {
    if (!p) return '';
    const src = photos.cache[p.id];
    if (!src && !photos.loading[p.id]) setTimeout(() => loadPhoto(p.id), 0);
    return `<figure>${src ? `<img src="${src}" alt="Progress photo, ${esc(shortDate(p.date))}">` : '<img alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">'}<figcaption>${esc(shortDate(p.date))} · ${esc(p.angle)}</figcaption></figure>`;
  };
  return nav({ back: 'Weight', backTo: 'summary/weight', title: 'Progress photos' }) + pageTitle('Progress photos', 'Monthly, same clothes, same light. Kept only in the owner\'s Google Drive.')
    + `<div class="stack">${list.length >= 2 ? card(`<div class="compare">${thumb(a)}${thumb(b)}</div>`) : list.length ? card(`<div class="compare">${thumb(list[0])}</div>`) : empty('camera', 'No photos yet', 'One photo a month is enough to see the change.')}
    ${list.some((p) => p.date.slice(0, 7) === month) ? '<p class="sub center">This month\'s photo is done.</p>' : ''}
    ${photos.error ? `<p class="note bad">${icon('circle-alert')}<span>${esc(photos.error)}</span></p>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${['front', 'side'].map((ang) => `<label class="card craving file-btn" style="min-height:56px;justify-content:center">${icon('camera')}<span style="flex:none">${ang === 'front' ? 'Front' : 'Side'}</span><input type="file" accept="image/*" capture="user" data-change="photo-upload" data-angle="${ang}" aria-label="${ang === 'front' ? 'Front' : 'Side'} photo"></label>`).join('')}</div></div>`;
}
async function loadPhoto(pid) {
  if (photos.loading[pid] || photos.cache[pid]) return;
  photos.loading[pid] = true;
  try { const r = await call('photoGet', { id: pid }); photos.cache[pid] = r.dataUrl; } catch (e) { photos.error = e.message; }
  photos.loading[pid] = false;
  rerender();
}

// ------------------------------------------------------------------ doctor summary (printable)
export function doctorHtml(id, standalone) {
  const p = S.person(id) || S.me();
  const prof = S.profile(id);
  const series = S.series(id);
  const lg = S.logs(id);
  const today = S.today();
  const cur = series.length ? series[series.length - 1].trend : null;
  const weeks = [1, 2, 3, 4].map((n) => S.week(id, L.addDays(L.weekStart(today), -7 * n)));
  const strengthPerWeek = L.round(weeks.reduce((a, w) => a + w.workouts, 0) / 4, 1);
  const walkPerWeek = Math.round(weeks.reduce((a, w) => a + w.walkMinutes, 0) / 4);
  const steps = lg.steps.filter((s) => s.date > L.addDays(today, -28));
  const sleep = lg.sleep.filter((s) => s.date > L.addDays(today, -28));
  const avg = (arr, k) => (arr.length ? L.round(arr.reduce((a, x) => a + +x[k], 0) / arr.length, 1) : '—');
  const waists = lg.waists.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const supps = S.supplements(id).filter((s) => s.status === 'active');
  const parq = (prof.parq || []).map((v, i) => (v === true || v === 'yes' ? K.PARQ[i] : null)).filter(Boolean);
  const body = `<div class="doc">
    <h1 class="title" style="font-size:var(--f26)">Health summary: ${esc(p.name)}</h1>
    <p class="sub">Prepared ${esc(longDate(today))} from self-reported data in the Our Plan app${prof.start_date ? ', tracking since ' + esc(shortDate(prof.start_date)) : ''}. Not a medical record.</p>
    <h2>Weight</h2><table><tr><th>Starting</th><td>${esc(prof.weight_start || '—')} lb</td></tr><tr><th>Current (7-day trend)</th><td>${cur == null ? '—' : esc(cur) + ' lb'}</td></tr>
    <tr><th>Change</th><td>${cur != null && prof.weight_start && series.length >= 2 ? L.round(cur - prof.weight_start, 1) + ' lb' : '—'}</td></tr><tr><th>Rate (last 2 weeks)</th><td>${esc(L.trendRate(series, today, 14) ?? '—')} lb/week</td></tr>
    <tr><th>Height</th><td>${prof.height_in ? Math.floor(prof.height_in / 12) + ' ft ' + (prof.height_in % 12) + ' in' : '—'}</td></tr><tr><th>Goal</th><td>${esc(prof.goal_weight || '—')} lb</td></tr></table>
    <h2>Waist</h2><p>${waists.length ? esc(waists[0].inches) + ' in on ' + esc(shortDate(waists[0].date)) + ', ' + esc(waists[waists.length - 1].inches) + ' in on ' + esc(shortDate(waists[waists.length - 1].date)) : 'Not measured yet.'}</p>
    <h2>Activity (last 4 weeks)</h2><table><tr><th>Strength sessions a week</th><td>${strengthPerWeek}</td></tr><tr><th>Walking minutes a week</th><td>${walkPerWeek}</td></tr><tr><th>Average daily steps</th><td>${steps.length ? Math.round(avg(steps, 'steps')).toLocaleString() : '—'}</td></tr></table>
    <h2>Sleep (last 4 weeks)</h2><table><tr><th>Average hours</th><td>${avg(sleep, 'hours')}</td></tr><tr><th>Bedtime consistency</th><td>${L.bedtimeSpread(sleep.map((s) => s.bedtime)) == null ? '—' : '± ' + L.bedtimeSpread(sleep.map((s) => s.bedtime)) + ' min'}</td></tr></table>
    ${Labs.doctorTable(id)}
    <h2>Medications (as entered)</h2><p>${esc(prof.meds || 'None listed')}</p>
    <h2>Supplements</h2>${supps.length ? `<ul>${supps.map((s) => `<li>${esc(s.name)}${s.dose ? ', ' + esc(s.dose) : ''}${s.timing ? ' (' + esc(s.timing) + ')' : ''}</li>`).join('')}</ul>` : '<p>None listed</p>'}
    ${parq.length ? `<h2>Health screen (PAR-Q+ based), answered yes</h2><ul>${parq.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>` : ''}
    <h2>Plan</h2><p>Habit-based eating (no calorie counting), strength training 2–3 times a week with gradual progression, walking toward 150+ minutes a week. Target pace about 0.5–1% of body weight a week.</p>
  </div>`;
  if (!standalone) return body;
  const css = 'body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;line-height:1.45}h1{font-size:24px}h2{font-size:17px;margin-top:22px}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:6px 8px;font-size:15px}th{width:55%;font-weight:600}';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Health summary, ${esc(p.name)}</title><style>${css}</style></head><body>${body}</body></html>`;
}
function doctorPage(want) {
  const id = want && S.visible(want) ? want : S.meId();
  const p = S.person(id) || S.me();
  const prof = S.profile(id);
  const series = S.series(id);
  const lg = S.logs(id);
  const today = S.today();
  const cur = series.length ? series[series.length - 1].trend : null;
  const weeks = [1, 2, 3, 4].map((n) => S.week(id, L.addDays(L.weekStart(today), -7 * n)));
  const steps = lg.steps.filter((x) => x.date > L.addDays(today, -28));
  const sleep = lg.sleep.filter((x) => x.date > L.addDays(today, -28));
  const avg = (arr, k) => (arr.length ? L.round(arr.reduce((a, x) => a + +x[k], 0) / arr.length, 1) : null);
  const waists = lg.waists.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const supps = S.supplements(id).filter((x) => x.status === 'active');
  const spread = L.bedtimeSpread(sleep.map((x) => x.bedtime));
  const kv = (label, value) => row({ label, value: value == null || value === '' ? '—' : esc(value), cls: 'no-ic' });
  const block = (title, rows) => `<div>${sectionTitle(title)}${listCard(rows, 'no-ic kv-list')}</div>`;
  const rate = L.trendRate(series, today, 14);
  return nav({ back: 'Weight', backTo: 'summary/weight', title: 'Doctor summary', right: textBtn('Print', 'print', {}, { aria: 'Print or save as PDF' }) })
    + pageTitle('Doctor summary', esc(p.name) + ' · ' + esc(shortDate(today)) + ' · self-reported, not a medical record')
    + `<div class="stack">
      ${block('Weight', [kv('Starting', prof.weight_start ? prof.weight_start + ' lb' : ''), kv('Now (7-day trend)', cur == null ? '' : cur + ' lb'), kv('Change', cur != null && prof.weight_start && series.length >= 2 ? L.round(cur - prof.weight_start, 1) + ' lb' : ''), kv('Last 2 weeks', rate == null ? '' : rate + ' lb a week'), kv('Height', prof.height_in ? Math.floor(prof.height_in / 12) + ' ft ' + (prof.height_in % 12) + ' in' : ''), kv('Goal', prof.goal_weight ? prof.goal_weight + ' lb' : ''),
        kv('Waist', waists.length ? waists[waists.length - 1].inches + ' in' : '')])}
      ${block('Last 4 weeks', [kv('Strength sessions a week', L.round(weeks.reduce((a, w) => a + w.workouts, 0) / 4, 1)), kv('Walking minutes a week', Math.round(weeks.reduce((a, w) => a + w.walkMinutes, 0) / 4)), kv('Average daily steps', steps.length ? Math.round(avg(steps, 'steps')).toLocaleString() : ''), kv('Average sleep', avg(sleep, 'hours') == null ? '' : avg(sleep, 'hours') + ' h'), kv('Bedtime spread', spread == null ? '' : '± ' + spread + ' min')])}
      ${Labs.doctorRows(id) ? block('Blood tests', Labs.doctorRows(id)) : ''}
      ${block('Medications and supplements', [row({ label: 'Medications', sub: esc(prof.meds || 'None listed'), cls: 'no-ic wrap' }), row({ label: 'Supplements', sub: esc(supps.length ? supps.map((x) => x.name + (x.dose ? ' ' + x.dose : '')).join(', ') : 'None listed'), cls: 'no-ic wrap' })])}
      <p class="caption" style="padding:0 4px">Print it or save it as a PDF from the top right.</p></div>`;
}

// ------------------------------------------------------------------ actions
const logw = { min: 20, felt: 'ok' };
export const actions = Object.assign({}, Labs.actions, {
  'activity-sheet'() { activitySheet(); },
  'protein-sheet'() { proteinSheet(); },
  'habits-sheet'() { habitsSheet(); },
  'sleep-sheet'() { sleepPick.h = null; sleepPick.e = null; sleepPick.more = false; sleepSheet(); },
  weigh() { weighSheet(); },
  'catchup-sheet'() { catchupSheet(); },
  'log-workout'() { logw.min = 20; logw.felt = 'ok'; logWorkoutSheet(); },
  'waist-sheet'() { waistSheet(); },
  walked(el) {
    const m = +el.dataset.m || S.dayPlan().walkGoal || 20;
    const op = S.write('logWalk', { date: S.today(), minutes: m });
    logged(op, 'Walk · ' + m + ' min. Logged.');
  },
  'walk-pick'(el) {
    if (el.dataset.v === 'other') {
      updateSheet({ title: 'Activity', body: `<label class="field"><span>Minutes walked</span><input id="walk-other" class="big-input" type="number" inputmode="numeric" min="1" max="300" autofocus data-enter="walk-other-save"></label>${primary('Save', 'walk-other-save')}` });
      setTimeout(() => { const i = document.getElementById('walk-other'); if (i) i.focus(); }, 50);
      return;
    }
    const op = S.write('logWalk', { date: S.today(), minutes: +el.dataset.v });
    logged(op, 'Walk · ' + el.dataset.v + ' min. Logged.');
    activitySheet();
  },
  'walk-other-save'() {
    const v = Math.round(+(document.getElementById('walk-other') || {}).value);
    if (!(v >= 1 && v <= 300)) { toast('Minutes should be between 1 and 300.', { kind: 'err' }); return; }
    const op = S.write('logWalk', { date: S.today(), minutes: v });
    logged(op, 'Walk · ' + v + ' min. Logged.');
    activitySheet();
  },
  'del-log'(el) {
    const id = el.dataset.id;
    if (!id) return;
    const m = /^tmp_(q[0-9a-f]+)/.exec(id);
    if (m) undoOp(m[1]); else S.write('retract', { tab: el.dataset.tab, id });
    toast('Removed.', { icon: 'trash-2' });
    const kind = (document.querySelector('#sheet-root .sheet-body') || {}).dataset;
    if (kind && kind.kind === 'protein') proteinSheet(); else if (kind && kind.kind === 'activity') activitySheet();
  },
  protein(el) {
    const p = K.PROTEIN_PORTIONS.find((x) => x.id === el.dataset.p);
    if (!p) return;
    const op = S.write('checkin', { date: S.today(), kind: 'protein', value: p.id + ':' + p.g });
    const pr = S.protein();
    logged(op, p.label + ' · ' + p.g + ' g. ' + (pr.have >= pr.grams ? 'Target reached.' : (pr.grams - pr.have) + ' g to go.'));
    proteinSheet();
  },
  'protein-other'() {
    const more = K.PROTEIN_PORTIONS.slice(7);
    updateSheet({ title: 'Protein', body: `<div class="inset">${more.map((p) => row({ label: p.label, value: '+' + p.g + ' g', act: 'protein', data: { 'data-p': p.id } })).join('')}</div>
      <div><div class="eyebrow" style="margin:0 4px 8px">Something else</div><div style="display:grid;grid-template-columns:2fr 1fr;gap:8px"><input id="po-name" class="input" type="text" maxlength="40" placeholder="Name" aria-label="Food name"><input id="po-g" class="input" type="number" inputmode="numeric" min="1" max="100" placeholder="Grams" aria-label="Grams of protein"></div></div>
      ${primary('Add', 'protein-custom')}${textBtn('Back', 'protein-sheet', {}, { cls: 'block' })}` });
  },
  'protein-custom'() {
    const g = Math.round(+(document.getElementById('po-g') || {}).value);
    const name = ((document.getElementById('po-name') || {}).value || '').trim();
    if (!(g >= 1 && g <= 100)) { toast('Grams should be between 1 and 100.', { kind: 'err' }); return; }
    const op = S.write('checkin', { date: S.today(), kind: 'protein', value: 'custom:' + g + (name ? ':' + name.replace(/:/g, ' ').slice(0, 30) : '') });
    logged(op, (name ? L.capItem(name) + ' · ' : '') + g + ' g. Logged.');
    proteinSheet();
  },
  'protein-ideas'() {
    const kinds = { meat: 'Meat', dairy: 'Dairy', pareve: 'Pareve' };
    updateSheet({ title: 'Kosher ideas', body: Object.keys(kinds).map((k) => `<div><div class="eyebrow" style="margin:0 4px 6px">${kinds[k]}</div><div class="inset">${(K.PROTEIN_IDEAS[k] || []).map((x) => row({ label: x })).join('')}</div></div>`).join('') + textBtn('Back to protein', 'protein-sheet', {}, { cls: 'block' }) });
  },
  habit(el) {
    const key = el.dataset.key;
    const cur = S.latest(S.meId(), S.today())['habit:' + key];
    const v = cur && cur.value === 'yes' ? 'no' : 'yes';
    const op = S.write('checkin', { date: S.today(), kind: 'habit:' + key, value: v });
    if (v === 'yes') logged(op, 'Logged.');
    habitsSheet();
  },
  'habit-info'(el) { habitInfo[el.dataset.key] = !habitInfo[el.dataset.key]; habitsSheet(); },
  'sleep-pick'(el) {
    if (el.dataset.v === 'more') { sleepPick.more = true; sleepPick.h = null; } else { sleepPick.more = false; sleepPick.h = +el.dataset.v; }
    sleepSheet();
  },
  'energy-pick'(el) { sleepPick.e = +el.dataset.v; sleepSheet(); },
  'sleep-save'() {
    const today = S.today();
    const d = S.done();
    let hours = sleepPick.h, bedtime = '';
    if (sleepPick.more) {
      hours = +(document.getElementById('sl-h') || {}).value;
      bedtime = (document.getElementById('sl-b') || {}).value || '';
      if (!L.validNumber('hours', hours)) { toast('Hours should be between 0 and 16.', { kind: 'err' }); return; }
    }
    let op = null;
    if (hours != null && (hours !== d.sleepHours || bedtime)) op = S.write('logSleep', { date: today, hours, bedtime });
    if (sleepPick.e != null && sleepPick.e !== d.energy) op = S.write('logEnergy', { date: today, level: sleepPick.e }) || op;
    closeSheet();
    if (op) logged(op, 'Sleep and energy logged.');
  },
  'save-weight'() {
    const v = +document.getElementById('wt').value;
    const date = (document.getElementById('wt-d') || {}).value || S.today();
    if (!L.validNumber('lbs', v)) { toast('That weight doesn\'t look right.', { kind: 'err' }); return; }
    if (date > S.today()) { toast('Pick today or an earlier day.', { kind: 'err' }); return; }
    const op = S.write('logWeight', { date, lbs: Math.round(v * 10) / 10 });
    closeSheet(); logged(op, 'Saved. Watch the trend, not the day.');
  },
  'save-waist'() {
    const v = +document.getElementById('waist-in').value;
    if (!L.validNumber('inches', v)) { toast('That measurement doesn\'t look right.', { kind: 'err' }); return; }
    const op = S.write('logWaist', { date: S.today(), inches: v, notch: document.getElementById('notch-in').value.trim() });
    closeSheet(); logged(op, 'Waist saved.');
  },
  catchup(el) {
    const c = S.catchup(S.meId());
    if (!c) return;
    const body = el.dataset.part === 'fri' ? { friDate: c.erev, fri: el.dataset.v } : { satDate: c.rest[c.rest.length - 1], sat: el.dataset.v };
    const op = S.write('catchup', body);
    logged(op, el.dataset.part === 'fri' ? 'Friday logged.' : 'Shabbat logged. Shavua tov.');
    const left = S.catchup(S.meId());
    if (left && (!left.erevDone || !left.restDone)) catchupSheet(); else closeSheet();
  },
  preshabbat() { const op = S.write('checkin', { date: S.today(), kind: 'preshabbat', value: 'yes' }); logged(op, 'All set. Shabbat shalom.'); },
  'quick-cheer'() {
    const p = S.partner();
    if (!p) return;
    if (cheeredToday(p.id)) { toast('You already cheered ' + p.name + ' today.', { icon: 'heart' }); return; }
    const op = S.write('cheer', { kind: 'cheer', text: K.CHEERS[0].replace(/!+/g, '.').replace(/[\s.]+$/, '') }); // H4: no period at the end
    logged(op, 'Cheer sent to ' + p.name + '.');
  },
  'w-range'(el) { S.setUi('wRange3', el.dataset.v); rerender(); },
  'logw-min'(el) { logw.min = +el.dataset.v; document.querySelectorAll('[data-act="logw-min"]').forEach((b) => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); },
  'logw-feel'(el) { logw.felt = el.dataset.v; document.querySelectorAll('[data-act="logw-feel"]').forEach((b) => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); },
  'logw-save'(el) {
    const op = S.write('logWorkout', { date: S.today(), kind: el.dataset.kind || 'strength', version: Math.min(30, logw.min), minutes: logw.min, felt: logw.felt, pain: false, sets: [] });
    closeSheet(); logged(op, 'Workout · ' + logw.min + ' min. Logged.');
  },
  print() { window.print(); },
  async 'export-data'(el) {
    await busy(el, async () => {
      try {
        const r = await call('exportData', {}, { timeout: 90000 });
        const files = {};
        Object.keys(r.files).forEach((k) => { files['our-plan-data/' + k] = '﻿' + r.files[k]; });
        files['our-plan-data/doctor-summary.html'] = doctorHtml(S.meId(), true);
        files['our-plan-data/README.txt'] = 'Our Plan data export, ' + todayISO() + '.\nEach CSV is one tab of the Google Sheet (rows you can see). Open them in Excel, Numbers or Google Sheets.\nRows are never deleted: edited rows have a "superseded_by" value pointing to the newer row.\n';
        const how = await shareOrDownload(makeZip(files), 'our-plan-' + todayISO() + '.zip', 'Our Plan data');
        if (how !== 'cancelled') toast('Export ready.');
      } catch (e) { toast(e.message, { kind: 'err' }); }
    });
  }
});
export const changes = {
  async 'photo-upload'(el) {
    const f = el.files && el.files[0];
    if (!f) return;
    toast('Uploading your photo…', { icon: 'camera', ms: 20000 });
    try {
      const data = await resizeImage(f, 1280, 0.8);
      const r = await call('photoUpload', { data, date: S.today(), angle: el.dataset.angle }, { timeout: 90000 });
      photos.cache[r.id] = data;
      const list = (S.data.photos[S.meId()] = S.data.photos[S.meId()] || []);
      list.push({ id: r.id, date: r.date, angle: r.angle });
      S.persist(); S.changed();
      toast('Photo saved to your Drive.');
    } catch (e) { toast(e.message, { kind: 'err' }); }
  }
};
