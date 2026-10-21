/* Round 5: the workout (screens 02–05, docs/round5-program.md parts 1–10). Full screen, no tab bar.
 * Learn screen the first time per move → each set waits for one big Done (the voice counts the tempo from ready-made
 * files; timers only for holds, rests, the side switch and the cool-down) → the effort tap and "Where did you feel it
 * most?" on the same sheet (the likely cause and the fix for a wrong place) → rest or the paired move → cool-down (Skip)
 * → Workout done. The state is saved after every tap and every step by wall clock: locking the phone mid-set pauses the
 * set and reopening resumes the same set with the same time left. Ask Coach mid-workout pauses the clock. */
import { L, K, esc, icon, toast, openSheet, closeSheet, updateSheet, keepAwake } from '../core.js?v=132c8397ab';
import { S } from '../store.js?v=016968e4cd';
import { call, LS } from '../api.js?v=b8330e966d';
import { go, rerender, route } from '../nav.js?v=57c55c9996';
import { primary, textBtn, iconBtn, ring, setRing, still, listCard, row } from '../ui.js?v=028af192f4';
import * as Voice from '../voice.js?v=893d365a5f';
import { logged } from '../fx.js?v=836f74c11e';

const SAVE = () => 'op_t5_' + S.meId();
const SAY = L.SAY5;
let T = null, tick = null;
const now = () => Date.now();
const fmt = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const M5 = (id) => L.MOVES5[id] || L.GENTLE5[id] || {};
/** Today's name for a move (its rung's name, "Box squat to a chair"), not the ladder's (audit Weak 7). */
const nm = (id) => ((T && T.sess && T.sess.moves) || {})[id] && T.sess.moves[id].name ? T.sess.moves[id].name : M5(id).name;

// ------------------------------------------------------------------ building today's workout (also used by the Workouts tab)
/** Everything the program needs today for a person: the session, the day's kind (make-up, late line), lighter, the gate. */
export function today(opts = {}) {
  const id = S.meId(), st = S.program(id), s = S.settings(id), who = S.who(id);
  const date = S.realToday();
  const lighterSet = (s.lighter || {})[date];
  const d = S.done(id, date);
  const ready = L.lighterToday({ manual: lighterSet, sleep: d.sleepHours, energy: d.energy });
  const gentle = who === 'f' && !st.gentle.done;
  const cal = S.cal(), cd = L.calDay(cal, date);
  const lastDates = (S.r5p(id) || { workouts: [] }).workouts.filter((w) => !w.gentle || true).map((w) => w.date);
  const ws = L.weekStart(date);
  const makeupThisWeek = ((S.r5p(id) || { workouts: [] }).workouts || []).some((w) => w.makeup && w.date >= ws);
  const kind = L.dayKind5({ today: date, minutes: S.dayMinutes() % 1440 + (S.dayMinutes() >= 1440 ? 1440 : 0), lastDates, started: st.start && !(S.settings(id).program5 || {}).startNow ? st.start : '', makeupThisWeek, restDay: cd.isRest, fast: cd.isFast, yRest: L.calDay(cal, L.addDays(date, -1)).isRest });
  const length = opts.length || S.ui['t5len_' + id] || st.length || 'regular';
  const next = st.next || {};
  const rungs = Object.assign({}, st.rungs);
  const sub = {};
  Object.keys(next).forEach((m) => {
    const c = next[m];
    if (!c || (c.after != null && st.done > c.after && (st.states[m] || {}).lastDate > (c.date || ''))) return; // used up by the move's next session
    if (c.change === 'one_rung_easier' && rungs[m] != null) rungs[m] = Math.max(0, rungs[m] - 1);
    if (c.change === 'drill') sub[m] = L.drillFor(m);
    if (c.change === 'swap') sub[m] = L.swapFor(m, rungs[m]);
  });
  const gateAns = opts.gate || '';
  const sess = gentle ? L.gentleSession({ done: st.gentle.sessions, learned: st.learned })
    : L.session5({ who, n: st.n, lightAt: st.lightAt, length: kind.shortOnly ? 'short' : length, rungs, eq: s.equipment, learned: st.learned, hingeUnlocked: st.hingeUnlocked,
      gateClear: st.gate.clear, gateOff: gateAns === 'off', lighter: ready.on, welcome: st.welcome, findings: st.findings, stuck: st.stuck, topBonus: st.topBonus, lastReps: st.lastReps,
      medians: L.personalMedians((S.r5p(id) || { workouts: [] }).workouts), history: st.history });
  // audit B3: nothing is spoken from 15 minutes before candles, so inside that window there's no workout, and before it a
  // workout that can't finish in time isn't offered
  const cq = L.calDay(cal, S.clockDate());
  const candles = cq.isErev && cq.candles ? L.hmToMin(cq.candles) : null;
  let k2 = kind;
  if (S.quiet().quiet) k2 = Object.assign({}, kind, { kind: 'rest' });
  else if (candles != null && S.minutes() + Math.ceil(L.plannedTotal(sess) / 60) > candles - 15) k2 = Object.assign({}, kind, { kind: 'shabbatsoon' });
  return { st, sess, kind: k2, ready, gentle, who, length: kind.shortOnly ? 'short' : length, sub, date };
}

// ------------------------------------------------------------------ start, save, resume
function save() { if (T) { T.savedAt = now(); try { LS.set(SAVE(), JSON.stringify(T)); } catch (e) { /* full */ } } }
function load() { const t = LS.json(SAVE(), null); return t && t.v === 5 && now() - (t.savedAt || 0) < 4 * 3600000 ? t : null; }
export function running() { return !!(T || load()); }
/** Start today's workout (from the Workouts tab). opts: { length, makeup } */
export function start(opts = {}) {
  const t = today(opts);
  if (!opts.session && ['rest', 'shabbatsoon', 'fast'].indexOf(t.kind.kind) >= 0) { toast('Not now: ' + (t.kind.kind === 'fast' ? 'a fast day.' : 'Shabbat or Yom Tov is close.'), { icon: 'moon' }); return; } // audit B3
  if (opts.session) { t.sess = opts.session; t.who = opts.session.who; t.gentle = !!opts.session.gentle; } // the real-clock rehearsal (9.2) picks the session
  T = { v: 5, who: t.who, date: S.realToday(), sess: t.sess, i: 0, started: now(), pausedMs: 0, pausedAt: 0, stepStart: now(), autoPaused: false,
    results: {}, rungs: {}, sub: Object.assign({}, t.sub), swaps: {}, notes: [], seenLearn: {}, makeup: !!opts.makeup, lighter: t.ready.on, welcome: !!t.st.welcome,
    gate: t.who === 'f' && !t.gentle ? '' : 'na', gateStop: !!t.st.gate.stop, voice: S.ui.flowVoice !== false, count: 0, side: 1, after: null, times: { sets: [], setups: [] }, answers: {}, anchorSeen: !!S.ui.t5_anchor_seen,
    length: t.length, effortHint: t.st.n >= 7 };
  Object.keys(t.sess.moves).forEach((m) => { T.rungs[m] = t.sess.moves[m].rungIndex; });
  keepAwake(true);
  Voice.precacheFixed(); // 4.10: the chosen voice's files stay on the phone, from the first workout on
  if (T.voice) Voice.prepare(lines(), { fixedOnly: true });
  save();
  go('workout');
  enterStep();
}
function lines() {
  const out = SAY.words.concat(SAY.count, [SAY.effort, SAY.where, SAY.top, SAY.rest, SAY.nextUp, SAY.lastSet, SAY.switchSides, SAY.warmup, SAY.cooldown, SAY.done]);
  T.sess.steps.forEach((s) => { if (s.line) out.push(s.line); if (s.move) { const m = M5(s.move); out.push(m.name + '.'); if (m.setup) out.push(m.setup); } });
  return out;
}
const step = () => (T ? T.sess.steps[T.i] : null);
function elapsedAll() { return Math.max(0, ((T.pausedAt || now()) - T.started - T.pausedMs) / 1000); }
function inStep() { return Math.max(0, ((T.pausedAt || now()) - T.stepStart) / 1000); }
function timeLeft() {
  const st = step();
  if (!st) return 0;
  const cur = st.type === 'rest' || st.type === 'cool' || (st.type === 'warm' && st.timed) ? Math.max(0, (st.seconds || st.planned) - inStep()) : Math.max(0, (st.planned || 0) - inStep());
  return L.timeLeft(T.sess, T.i, cur) - (T.seenLearn ? Object.keys(T.seenLearn).length * 0 : 0);
}

// ------------------------------------------------------------------ voice: the tempo, from files only
function say(t, o = {}) { if (T && T.voice && t) Voice.say(t, Object.assign({ workout: true, fixedOnly: true }, o)); }
function sayNext(t) { say(t, { queue: true }); }
function mv(id) { const sub = T.sub[id]; return sub && sub.move ? sub.move : id; }
function moveNow(st) {
  const id = mv(st.move);
  const base = T.sess.moves[st.move] || {};
  const m = M5(id);
  if (st.gentle) return { id, name: st.name || m.name, range: [st.reps, st.reps], side: !!st.side, rung: { label: m.rung || '' }, beats: ['Down', 'two', 'three', 'Up'], repSec: 4, gentle: true };
  const lad = L.ladderOf(id, S.settings().equipment);
  const ri = T.sub[st.move] && T.sub[st.move].rung != null && T.rungs[id] == null ? T.sub[st.move].rung : (T.rungs[id] != null ? T.rungs[id] : base.rungIndex);
  const rung = lad[Math.max(0, Math.min(lad.length - 1, ri || 0))] || { label: 'Bodyweight' };
  const ctx = T.sess.ctx || {};
  const range = base.range || m.range || [10, 15];
  return { id, name: id === st.move ? base.name || m.name : m.name, range, side: !!m.side || (id === 'calf_raise' && rung.single), rung, rungIndex: ri || 0, beats: L.beats(id, rung, ctx), repSec: L.repSeconds(id, rung, ctx), finding: st.finding, slot: m.slot || '' };
}

// ------------------------------------------------------------------ the step machine
function enterStep() {
  const st = step();
  if (!st) return;
  if (st.type === 'pairgo' || st.type === 'taps') { T.i++; T.stepStart = now(); return enterStep(); }
  T.stepStart = now(); T.count = 0; T.side = 1; T.after = null; T.beat = -1;
  if (st.type === 'warm') { if (st.n === 1) say(SAY.warmup); sayNext(st.line); }
  else if (st.type === 'cool') { if (st.n === 1) say(SAY.cooldown); sayNext(st.line); }
  else if (st.type === 'rest') { say(st.setup ? SAY.setup : SAY.rest); if (st.anchor) sayNext(st.anchor === 'top' ? SAY.anchorTop : st.anchor === 'low' ? SAY.anchorLow : SAY.anchorChest); }
  else if (st.type === 'set') {
    const m = moveNow(st);
    if (needsLearn(st)) { T.learn = st.move; }
    else announceSet(st, m);
  } else if (st.type === 'done') { keepAwake(false); say(SAY.done); }
  save();
  rerender();
}
function announceSet(st, m) {
  T.learn = null;
  T.stepStart = now(); T.beat = -1;
  if (st.set === 1 || st.round === 1) { say(M5(m.id).name + '.'); sayNext(M5(m.id).setup); }
  else say(st.set === st.of ? SAY.lastSet : SAY.set(st.set));
  if (st.finding) sayNext(SAY.finding);
  if (st.calibrate) sayNext(SAY.calibrate);
  if (st.near) sayNext(SAY.near);
  const cue = T.nextCue && T.nextCue[m.id];
  if (cue) { sayNext(cue); delete T.nextCue[m.id]; }
  T.countFrom = now() + 4000; // the setup line first, then the count
}
function needsLearn(st) {
  if (st.type !== 'set' || !st.learnFirst) return false;
  const id = mv(st.move);
  return !T.seenLearn[id] && !(S.program().learned || {})[id];
}
function next() {
  if (!T || T.i >= T.sess.steps.length - 1) return;
  const st = step();
  if (st && st.type === 'rest' && st.setup) T.times.setups.push({ planned: st.planned, actual: Math.round(inStep()) });
  T.i++;
  // a move stopped for today (sharp pain with nothing easier): its sets and the walk to it are skipped (audit Weak 4)
  while (T.stopped && T.i < T.sess.steps.length - 1 && ((T.sess.steps[T.i].type === 'set' || T.sess.steps[T.i].type === 'pairgo') && T.stopped[T.sess.steps[T.i].move])) T.i++;
  enterStep();
}
function nextSetIndex() { for (let k = T.i + 1; k < T.sess.steps.length; k++) if (T.sess.steps[k].type === 'set') return k; return -1; }

// ------------------------------------------------------------------ the clock (wall clock; one tick drives everything)
function startTick() {
  clearInterval(tick);
  tick = setInterval(onTick, 250);
}
function onTick() {
  if (!T || route().name !== 'workout') return;
  const st = step();
  if (!st) return;
  const left = timeLeft();
  const tl = document.getElementById('t5-left');
  if (tl) tl.textContent = fmt(left);
  if (T.pausedAt) return;
  if (st.type === 'rest' || st.type === 'cool' || (st.type === 'warm' && st.timed) || T.switching) {
    const total = T.switching ? L.TIMING.switchSide : (st.seconds || st.planned);
    const startAt = T.switching ? T.switching : T.stepStart;
    const remain = Math.max(0, total - (now() - startAt) / 1000);
    setRing('t5-ring', remain / Math.max(1, total), fmt(remain));
    const r = Math.ceil(remain);
    if (r <= 3 && r >= 1 && T.said !== r + ':' + T.i) { T.said = r + ':' + T.i; say(String(r), { cue: true }); }
    if (remain <= 0) {
      if (T.switching) { T.switching = 0; T.side = 2; T.countFrom = now() + 1500; T.beat = -1; T.count = 0; say(SAY.otherSide); save(); rerender(); return; }
      if (T.voice) Voice.beep();
      next();
    }
    return;
  }
  // rep sets and warm-up reps: the voice counts the tempo; the set never ends on a timer (only Done ends it)
  if ((st.type === 'set' && !T.learn && !T.after) || (st.type === 'warm' && !st.timed)) {
    if (!T.countFrom || now() < T.countFrom) return;
    const m = st.type === 'set' ? moveNow(st) : { beats: ['Down', 'Up'], range: [st.reps, st.reps], repSec: Math.max(2, Math.round((st.planned - 6) / Math.max(1, st.reps))) };
    const beats = m.beats.length ? m.beats : ['Down', 'two', 'three', 'Up'];
    const beatMs = st.type === 'warm' ? (m.repSec * 1000) / beats.length : 1000;
    const b = Math.floor((now() - T.countFrom) / beatMs);
    const cap = st.type === 'warm' ? st.reps : (T.dropMode || st.finding || st.calibrate || st.near ? 30 : m.range[1]);
    // the count follows the clock (it catches up after the phone was busy); the voice says each beat as it comes
    const reps = Math.min(cap, Math.floor((b + 1) / beats.length));
    if (b !== T.beat) {
      if (b === T.beat + 1 && T.count < cap && st.type === 'set') say(beats[b % beats.length], { cue: true });
      T.beat = b;
    }
    if (reps !== T.count && reps >= 0) {
      T.count = reps;
      const n = document.getElementById('t5-count');
      if (n) n.textContent = String(T.count);
      if (T.count === cap && st.type === 'set') sayNext(SAY.top);
    }
  }
}
function pause(on, auto) {
  if (!T) return;
  if (on && !T.pausedAt) { T.pausedAt = now(); T.autoPaused = !!auto; Voice.pause(); }
  else if (!on && T.pausedAt) {
    const d = now() - T.pausedAt;
    T.pausedMs += d; T.stepStart += d; if (T.countFrom) T.countFrom += d; if (T.switching) T.switching += d;
    T.pausedAt = 0; T.autoPaused = false; Voice.resume();
  }
  save();
}
// 4.7: a lock, a call or closing the app mid-set pauses the set (same set, same time left); timers keep the wall clock
document.addEventListener('visibilitychange', () => {
  if (!T || route().name !== 'workout') return;
  const st = step();
  const counting = st && ((st.type === 'set' && !T.switching) || (st.type === 'warm' && !st.timed) || T.learn);
  if (document.visibilityState === 'hidden') { if (counting && !T.pausedAt) pause(true, true); else save(); }
  else { keepAwake(true); if (T.autoPaused) pause(false); rerender(); }
});
window.addEventListener('pagehide', () => { if (T) { const st = step(); if (st && st.type === 'set' && !T.pausedAt) pause(true, true); else save(); } });

// ------------------------------------------------------------------ screens
export function render() {
  if (!T) { T = load(); if (T) { if (!T.pausedAt) { /* reopened: a set resumes where it was */ } startTick(); keepAwake(true); } }
  if (!T) return `<div class="flow"><div class="empty">${icon('dumbbell')}<h3>No workout running</h3><p>Start one from Workouts.</p>${primary('Go to Workouts', 'go', { 'data-to': 'workouts' })}</div></div>`;
  if (!tick) startTick();
  if (T.autoPaused && document.visibilityState === 'visible') pause(false); // back from a lock, a call or another screen: same set, same time left
  const st = step();
  if (T.gate === '') return gateScreen();
  if (T.learnOpen) return learnScreen(T.learnOpen, true);
  if (st.type === 'set' && T.learn) return learnScreen(mv(st.move), false);
  if (st.type === 'set') return setScreen(st);
  if (st.type === 'warm') return warmScreen(st);
  if (st.type === 'rest') return restScreen(st);
  if (st.type === 'cool') return coolScreen(st);
  if (st.type === 'gentleq') return gentleQ();
  if (st.type === 'done') return doneScreen();
  setTimeout(() => { if (T && step() === st) next(); }, 0); // a step with no screen of its own moves on
  return '';
}
export function leave(from, to) { if (from === 'workout' && to !== 'workout' && T && step() && step().type !== 'done') pause(true, true); }
function top(label, sub) {
  return `<div class="flow-top">${iconBtn('x', 't5-end', 'End workout')}<div class="flow-clock"><b>${esc(label)}</b><span>${esc(sub)}</span></div>${iconBtn(T.voice ? 'volume-2' : 'volume-x', 't5-voice', T.voice ? 'Voice on' : 'Voice off', { pressed: T.voice, c: 'accent' })}</div>`;
}
function leftTop(extra) { return top('', '').replace('<b></b>', `<b id="t5-left">${fmt(timeLeft())}</b>`).replace('<span></span>', `<span>left${extra ? ' · ' + esc(extra) : ''}</span>`); }
function movesOrder() { const ids = []; T.sess.steps.forEach((s) => { if (s.type === 'set' && ids.indexOf(s.move) < 0) ids.push(s.move); }); return ids; }
function progress(cur) {
  const ids = movesOrder();
  const at = Math.max(0, ids.indexOf(cur));
  return `<div class="flow-prog" aria-hidden="true">${ids.map((_, k) => `<i><u style="width:${k < at ? 100 : (k === at ? 45 : 0)}%"></u></i>`).join('')}</div>`;
}
function media(id, label) { const m = M5(id); return mediaV((S.who() === 'f' && m.herVideo) || m.video, label || m.name || ''); }
function mediaV(v, name) {
  if (!v) return `<div class="media plain"><b>${esc(name)}</b></div>`;
  return `<button type="button" class="media" data-act="t5-video" data-vid="${esc(v.id)}" data-start="${v.start || 0}" aria-label="Play the form video for ${esc(name)}"><img src="${esc(still(v))}" alt="" loading="lazy"><span class="play">${icon('play')}</span></button>`;
}
function gateScreen() {
  const her = L.HER_START_LINE;
  return `<div class="flow">${top('Before you start', T.sess.line)}<div class="stack" style="margin-top:16px">
    <p class="note">${icon('droplet')}<span>${esc(her)}</span></p>
    <h1 class="move-name">All good since last time?</h1>
    <p class="sub">No new leaking, heaviness or pain.</p>
    <div class="picks fit" style="margin-top:8px"><button type="button" class="pick" data-act="t5-gate" data-v="ok">All good</button><button type="button" class="pick" data-act="t5-gate" data-v="off">Something felt off</button></div>
  </div></div>`;
}
function learnScreen(id, fromInfo) {
  const m = M5(id), f = L.FEEL[L.feelKind(id)] || { right: [], wrong: {} };
  const ids = movesOrder();
  const right = (f.right || []).map((c) => c.toLowerCase()).join(' and ');
  const wrong = Object.keys(f.wrong || {}).map((c) => c.split(':')[0].toLowerCase()).filter((c, i, a) => a.indexOf(c) === i).join(' or ');
  const anchor = !T.anchorSeen && m.anchor && !fromInfo;
  const her = S.who() === 'f';
  return `<div class="flow">${top('Learn', 'Move ' + (Math.max(0, ids.indexOf(T.learn || id)) + 1) + ' of ' + ids.length)}${progress(T.learn || id)}
    ${anchor ? `<div class="card" style="margin-bottom:12px"><div class="eyebrow">First, the door anchor</div><ol class="steps">${L.DOOR_ANCHOR.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>${her ? `<p class="sub" style="margin-top:8px">${esc(L.DOOR_ANCHOR.latex.replace('{owner}', S.ownerName()))}</p>` : ''}</div>` : ''}
    ${media(id, m.name)}
    <div class="eyebrow act">New move · ${esc(m.slot || 'Gentle start')}</div>
    <h1 class="move-name">${esc((T.sess.moves[id] && T.sess.moves[id].name) || m.name)}</h1>
    <p class="move-cue" style="-webkit-line-clamp:4;line-clamp:4">Setup: ${esc(String(m.setup || '').replace(/^./, (c) => c.toLowerCase()))}</p>
    <ol class="learn-points">${(m.points || []).map((p, k) => `<li><b>${k + 1}</b><span>${esc(p)}</span></li>`).join('')}</ol>
    ${right ? `<div class="card feelcard"><p>${icon('check')}<span>Feel it in the ${esc(right)}</span></p>${wrong ? `<p>${icon('x')}<span>Not in the ${esc(wrong)}</span></p>` : ''}</div>` : ''}
    <div class="flow-actions">${primary('I\'m ready', fromInfo ? 't5-learn-close' : 't5-ready')}<div class="center">${textBtn('Watch again', 't5-video', { 'data-vid': ((her && m.herVideo) || m.video || {}).id || '', 'data-start': ((m.video || {}).start || 0) })}</div></div></div>`;
}
function setScreen(st) {
  const m = moveNow(st);
  const sideTxt = m.side ? (T.side === 1 ? 'first side' : 'other side') : '';
  const flag = T.dropMode ? SAY.dropSet : (st.finding ? 'This set is a test: keep going until you could do about 3 more.' : (st.calibrate ? SAY.calibrate : (st.near ? SAY.near : '')));
  const target = st.finding || st.calibrate || st.near ? 'up to 30' : (m.range[0] === m.range[1] ? 'of ' + m.range[0] : 'of ' + m.range[0] + '–' + m.range[1]);
  const body = T.switching ? `<div style="margin:16px 0">${ring('t5-ring', 1, String(L.TIMING.switchSide), 'switch sides')}</div>`
    : `<div class="repcount"><b id="t5-count">${T.count}</b><span><span class="of">${esc(target)} reps${m.side ? ' ' + esc(sideTxt) : ''}</span><span class="sub">${icon('volume-2')}${T.voice ? 'The voice counts with you' : 'Count at your own pace'}</span></span></div>`;
  const done = T.switching ? '' : `<button type="button" class="btn-done" data-act="t5-done"><b>${m.side && T.side === 1 ? 'Done with this side' : 'Done'}</b><span>tap when you finish the ${m.side && T.side === 1 ? 'side' : 'set'}</span></button>`;
  return `<div class="flow">${leftTop('Move ' + (movesOrder().indexOf(st.move) + 1) + ' of ' + movesOrder().length)}${progress(st.move)}
    ${media(m.id, m.name)}
    <div class="eyebrow act">${esc((m.slot || 'Gentle start') + ' · set ' + st.set + ' of ' + st.of)}</div>
    <div class="split" style="align-items:center"><h1 class="move-name">${esc(m.name)}</h1>${iconBtn('info', 't5-info', 'How to do ' + m.name, { data: { 'data-id': m.id } })}</div>
    <p class="move-cue">${esc(M5(m.id).setup || '')}</p>
    ${m.rung && m.rung.label && rungText(m) ? `<p class="rungline">${esc(rungText(m))}</p>` : ''}
    ${flag ? `<p class="note">${icon('info')}<span>${esc(flag)}</span></p>` : ''}
    ${T.pausedAt ? `<p class="note">${icon('pause')}<span>Paused</span></p>` : ''}
    ${body}
    <div class="flow-actions">${done}<div class="t5-bar">${textBtn('Back', 't5-back')}${textBtn(T.pausedAt ? 'Resume' : 'Pause', 't5-pause')}${textBtn('Ask Coach', 't5-ask')}${textBtn('This hurts', 't5-hurts')}</div></div>
    ${T.after ? afterSheet(st, m) : ''}</div>`;
}
/** The rung in words, without repeating the move's name ("Box squat to a chair · arms forward" → "Arms forward"). */
function rungText(m) { const t = String(m.rung.label || '').replace(new RegExp('^' + String(m.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' · ', 'i'), ''); return t === m.name ? '' : cap(t); }
const EFFORT = [['0', 'all out'], ['1-2', 'just right'], ['3+', 'easy']];
function afterSheet(st, m) {
  const a = T.after;
  const nextIdx = nextSetIndex();
  const following = T.sess.steps[T.i + 1];
  const restFirst = following && following.type === 'rest';
  const nx = nextIdx >= 0 ? T.sess.steps[nextIdx] : null;
  const nxName = nx ? nm(mv(nx.move)) : '';
  let go2 = nx ? (restFirst ? (following.setup ? 'Set up for ' + nxName.toLowerCase() : 'Rest ' + fmt(following.seconds) + ', then ' + (nx.move === st.move ? 'set ' + nx.set : nxName.toLowerCase())) : 'Next: ' + nxName) : 'Finish';
  if (st.gentle || a.drop) return `<div class="t5-scrim"></div><div class="t5-sheet" role="dialog" aria-label="Set done"><div class="grab"></div><div class="sub">${esc(m.name)} · ${a.drop ? 'drop set' : 'set ' + st.set} done</div>
    <div class="split" style="align-items:center"><b class="t5-reps">${a.reps} reps</b><span class="stepper">${iconBtn('minus', 't5-reps', 'One rep fewer', { data: { 'data-d': -1 } })}${iconBtn('plus', 't5-reps', 'One rep more', { data: { 'data-d': 1 } })}</span></div>${primary(go2, 't5-continue')}</div>`;
  const v = a.chip ? L.feelVerdict(m.id, a.chip, a.follow) : null;
  const chips = L.chipsFor(m.id);
  const first = chips.slice(0, L.chipsFirst(m.id));
  if (a.chip && first.indexOf(a.chip) < 0 && a.chip !== 'Didn\'t feel much') first.push(a.chip);
  const shown = a.more ? chips : first.concat(['Didn\'t feel much']);
  const ask = v && v.kind === 'ask' ? v.follow : null;
  const fixCard = v && v.kind === 'wrong' ? `<div class="card fixcard"><div class="eyebrow warn">Likely cause</div><p>${esc(v.cause)}</p><div class="eyebrow">Next set</div><p>${esc(v.fix)}${a.newRung ? ' ' + esc(a.newRung) : ''}</p></div>`
    : (v && (v.kind === 'right') ? `<p class="note">${icon('check')}<span>Right where it should be.</span></p>` : (v && v.kind === 'cue' ? `<p class="note">${icon('info')}<span>Next set: ${esc(v.cue)}.</span></p>` : ''));
  const ready = a.tap && (a.chip && (!v || v.kind !== 'ask'));
  return `<div class="t5-scrim"></div><div class="t5-sheet" role="dialog" aria-label="Set done"><div class="grab"></div>
    <div class="sub">${esc(m.name)} · set ${st.set} done</div>
    <div class="split" style="align-items:center"><b class="t5-reps">${a.reps} reps</b><span class="stepper">${iconBtn('minus', 't5-reps', 'One rep fewer', { data: { 'data-d': -1 } })}${iconBtn('plus', 't5-reps', 'One rep more', { data: { 'data-d': 1 } })}</span></div>
    <h3 class="q">How many more could you have done?</h3>
    <div class="feel three">${EFFORT.map(([k, h]) => `<button type="button" data-act="t5-tap" data-v="${k}" class="${a.tap === k ? 'on' : ''}" aria-pressed="${a.tap === k}"><b>${k === '1-2' ? '1–2' : k}</b><span>${h}</span></button>`).join('')}</div>
    ${T.effortHint ? '<p class="caption">A rep clearly slower than your first = about 2 left.</p>' : ''}
    <h3 class="q">Where did you feel it most?</h3>
    <div class="chips-wrap">${shown.map((c) => `<button type="button" class="chip-btn${a.chip === c ? ' on' + (v && v.kind === 'wrong' ? ' warn' : '') : ''}" data-act="t5-chip" data-v="${esc(c)}" aria-pressed="${a.chip === c}">${esc(c)}</button>`).join('')}${a.more ? '' : `<button type="button" class="chip-btn" data-act="t5-more">Somewhere else</button>`}</div>
    ${ask ? `<h3 class="q">${esc(ask.q)}</h3><div class="picks fit">${ask.a.map((x) => `<button type="button" class="pick${a.follow === x ? ' on' : ''}" data-act="t5-follow" data-v="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
    ${fixCard}
    ${primary(go2, 't5-continue', {}, { disabled: !ready })}</div>`;
}
function warmScreen(st) {
  const timed = st.timed;
  return `<div class="flow">${leftTop('Warm-up ' + st.n + ' of ' + st.of)}<div class="flow-prog" aria-hidden="true">${Array.from({ length: st.of }, (_, k) => `<i><u style="width:${k < st.n - 1 ? 100 : 0}%"></u></i>`).join('')}</div>
    ${st.n === 1 ? mediaV(L.WARM_VIDEO, 'the warm-up') : (st.id === 'pullapart' ? mediaV(L.PULLAPART_VIDEO, 'the band pull-apart') : '')}
    <div class="eyebrow act">Warm-up</div><h1 class="move-name">${esc(st.name)}</h1><p class="move-cue" style="-webkit-line-clamp:4;line-clamp:4">${esc(st.line)}</p>
    ${timed ? `<div style="margin:12px 0">${ring('t5-ring', 1, fmt(st.seconds), 'left')}</div>` : `<div class="repcount"><b id="t5-count">${T.count}</b><span><span class="of">of ${st.reps}</span></span></div>`}
    <div class="flow-actions">${timed ? primary('Skip', 't5-next') : `<button type="button" class="btn-done" data-act="t5-next"><b>Done</b><span>tap when you finish</span></button>`}<div class="t5-bar">${textBtn('Back', 't5-back')}${textBtn(T.pausedAt ? 'Resume' : 'Pause', 't5-pause')}</div></div></div>`;
}
function restScreen(st) {
  const nx = T.sess.steps[nextSetIndex()];
  const name = nx ? nm(mv(nx.move)) : '';
  const total = st.seconds || st.planned;
  const left = Math.max(0, total - inStep());
  return `<div class="flow">${leftTop(st.setup ? 'Set up' : 'Rest')}${progress(nx ? nx.move : '')}
    <div class="eyebrow act" style="text-align:center">${st.first ? 'Set up the door anchor' : (st.setup ? 'Set up for the next pair' : 'Rest')}</div>
    <div style="margin:12px 0">${ring('t5-ring', left / Math.max(1, total), fmt(left), st.setup ? 'to set up' : 'rest')}</div>
    ${st.anchor ? `<p class="note">${icon('info')}<span>${esc(st.anchor === 'top' ? 'Move the anchor to the top of the door.' : st.anchor === 'low' ? 'Move the anchor low.' : 'Move the anchor to chest height.')}</span></p>` : ''}
    ${nx ? `<p class="next-line">Next: ${esc(name)} · set ${nx.set} of ${nx.of}</p>` : ''}
    <div class="flow-actions">${primary(st.setup ? 'I\'m set' : 'Skip rest', 't5-next')}<div class="t5-bar">${textBtn('Back', 't5-back')}${textBtn(T.pausedAt ? 'Resume' : 'Pause', 't5-pause')}</div></div></div>`;
}
function coolScreen(st) {
  const total = st.seconds;
  return `<div class="flow">${leftTop('Cool-down ' + st.n + ' of ' + st.of)}<div class="flow-prog" aria-hidden="true">${Array.from({ length: st.of }, (_, k) => `<i><u style="width:${k < st.n - 1 ? 100 : 0}%"></u></i>`).join('')}</div>
    <div class="eyebrow act">Cool-down</div><h1 class="move-name">${esc(st.name)}</h1><p class="move-cue" style="-webkit-line-clamp:4;line-clamp:4">${esc(st.line)}</p>
    <div style="margin:12px 0">${ring('t5-ring', Math.max(0, total - inStep()) / total, fmt(Math.max(0, total - inStep())), 'left')}</div>
    <div class="flow-actions">${primary('Next', 't5-next')}<div class="center">${textBtn('Skip the cool-down', 't5-skipcool')}</div></div></div>`;
}
function gentleQ() {
  const a = T.answers;
  const q = (k, text, opts) => `<h3 class="q">${esc(text)}</h3><div class="picks fit">${opts.map(([v, l]) => `<button type="button" class="pick${a[k] === v ? ' on' : ''}" data-act="t5-gq" data-k="${k}" data-v="${v}" aria-pressed="${a[k] === v}">${esc(l)}</button>`).join('')}</div>`;
  return `<div class="flow">${top('Two questions', T.sess.line)}<div class="stack" style="margin-top:16px">
    ${q('q1', 'Any leaking, heaviness or pain that\'s new or worse since you started?', [['no', 'No'], ['little', 'A little'], ['yes', 'Yes']])}
    ${q('q2', 'Was your breathing steady the whole time?', [['yes', 'Yes'], ['no', 'No']])}</div>
    <div class="flow-actions">${primary('Finish', 't5-next', {}, { disabled: !(a.q1 && a.q2) })}</div></div>`;
}
function feltLine(sets, id) {
  const wrong = sets.filter((x) => x.wrongKey);
  if (!sets.some((x) => x.chip)) return { ok: true, text: '' };
  if (!wrong.length) return { ok: true, text: sets.some((x) => L.feelVerdict(id, x.chip, x.follow).kind === 'right') ? 'Right place' : 'Fine' };
  const last = sets[sets.length - 1];
  const chip = wrong[0].chip.toLowerCase();
  return { ok: false, text: (wrong.length === 1 ? cap(chip) + ' once' : cap(chip) + ' ' + wrong.length + ' times') + (last && !last.wrongKey ? ', then right' : '') };
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function nextTimeLines() {
  if (T.sess.gentle) return [];
  const st = S.program(), out = [];
  Object.keys(T.results).forEach((id) => {
    const sets = T.results[id];
    if (!sets.length || !L.MOVES5[id]) return;
    const prev = (st.sessionsByMove || {})[id] || [];
    const sess = prev.concat([{ date: S.realToday(), n: T.sess.n, block: T.sess.block, rung: sets[0].rung, sets: sets.map((x) => ({ reps: x.reps, tap: x.tap, wrong: !!x.wrongKey, wrongKey: x.wrongKey, chip: x.chip, pain: x.pain, finding: /finding/.test(x.flags), calibrate: /calib/.test(x.flags), drop: /drop/.test(x.flags) })), wrongTwice: L.inSession(id, sets).easier > 0, swappedTo: T.swaps[id] != null ? T.swaps[id] : null }]);
    const ms = L.moveState(id, sess, { who: T.who, eq: S.settings().equipment });
    // audit (Weak 3, 7): today's name for the move and the whole new rung ("goblet box squat · one 5 lb", not "goblet box squat")
    const lad = L.ladderOf(id, S.settings().equipment), name = (T.sess.moves[id] || {}).name || L.MOVES5[id].name;
    const nextLabel = String((lad[ms.rung] || {}).label || '');
    if (ms.note === 'up') out.push(name + ' moves up to ' + nextLabel.charAt(0).toLowerCase() + nextLabel.slice(1) + '.');
    else if (ms.note === 'down') out.push(name + ': one rung easier next time.');
    else if (ms.note === 'top') out.push(name + ': the top of the range goes up by 3.');
  });
  if (T.results.hinge_drill) {
    const drills = st.drillSessions + 1;
    if (!st.hingeUnlocked) out.unshift(L.hingeUnlocked(((st.sessionsByMove || {}).hinge_drill || []).map((x) => ({ sets: x.sets })).concat([{ sets: T.results.hinge_drill }])) ? 'The loaded hinge unlocks next time.' : 'Hinge drill again' + (drills >= 1 ? '. Two good sessions and the loaded hinge unlocks.' : '.'));
  }
  if (!out.length) out.push('The same rungs next time. Keep the reps clean.');
  return out;
}
function doneScreen() {
  const mins = Math.max(1, Math.round(elapsedAll() / 60));
  const ids = Object.keys(T.results);
  const sets = ids.reduce((a, id) => a + T.results[id].filter((x) => !/drop/.test(x.flags)).length, 0);
  const lg = S.logs(S.meId());
  const wk = L.activeWeek({ date: S.realToday(), workouts: lg.workouts.concat(T.savedId ? [] : [{ date: S.realToday(), kind: 'strength', minutes: mins }]), steps: lg.steps, goal: S.minutesGoal() });
  const felt = ids.filter((id) => L.MOVES5[id]).map((id) => { const f = feltLine(T.results[id], id); return f.text ? row({ labelHtml: esc(nm(id)), value: esc(f.text), cls: f.ok ? 'felt-ok' : 'felt-warn', icon: f.ok ? 'check' : 'circle-alert' }) : ''; });
  const lines = nextTimeLines();
  return `<div class="flow done5"><div class="done-head"><b class="done-min">${mins} min</b><h1 class="title">Workout done</h1><p class="sub">${ids.length} moves · ${sets} sets · ${esc(T.sess.gentle ? 'gentle start' : T.sess.line.toLowerCase())}</p>${T.welcome ? `<p class="sub">${esc(L.SAY5.welcome)}</p>` : ''}</div>
    ${felt.filter(Boolean).length ? `<h2 class="section">Where you felt it</h2>${listCard(felt)}` : ''}
    ${lines.length ? `<h2 class="section">Next time</h2><section class="card"><div class="stack-s">${lines.map((l) => `<p>${esc(l)}</p>`).join('')}</div></section>` : ''}
    ${listCard([row({ icon: 'activity', c: 'activity', label: 'Active this week', value: wk.minutes + ' of ' + wk.goal + ' min' })])}
    <div class="flow-actions">${primary('Done', 't5-finish')}</div></div>`;
}

// ------------------------------------------------------------------ saving
function finishAndSave() {
  if (!T || T.savedId) return;
  const sets = [];
  Object.keys(T.results).forEach((id) => T.results[id].forEach((x) => sets.push(Object.assign({ move: id, slot: (M5(id).slot || '') }, x))));
  const body = { date: T.date, n: T.sess.n, block: T.sess.block, letter: T.sess.letter, length: T.sess.length, gentle: !!T.sess.gentle, planned: L.plannedTotal(T.sess), minutes: Math.max(1, Math.round(elapsedAll() / 60)), startedAt: new Date(T.started).toISOString(),
    gate: T.gate === 'na' ? '' : T.gate, gateStop: T.gateStop, makeup: T.makeup, lighter: T.lighter, welcome: T.welcome, swaps: T.swaps, times: T.times, answers: T.sess.gentle ? Object.assign({ finished: true }, T.answers) : null, sets, notes: T.notes };
  const op = S.write('r5Workout', body);
  T.savedId = op.cid;
  save();
  return op;
}
function recordSet(st, m, a) {
  const flags = [st.finding ? 'finding' : '', st.calibrate ? 'calib' : '', st.near ? 'near' : '', a.drop ? 'drop' : '', T.sub[st.move] ? 'swap' : ''].filter(Boolean).join(',');
  const v = a.chip ? L.feelVerdict(m.id, a.chip, a.follow) : null;
  const rec = { setNo: (T.results[m.id] || []).length + 1, rung: m.rungIndex, rungKey: m.rung.key || '', band: m.rung.band || '', reps: a.reps, tap: a.tap || '', chip: a.chip === 'Didn\'t feel much' ? 'Didn\'t feel much' : (a.chip || ''), follow: a.follow || '', wrongKey: v && v.kind === 'wrong' ? v.key : '', pain: !!a.pain, flags, seconds: Math.round(a.seconds || 0), side: m.side ? 'each' : '' };
  (T.results[m.id] = T.results[m.id] || []).push(rec);
  T.times.sets.push({ planned: st.planned, actual: Math.round(a.seconds || 0) });
  // part 5, rules 1–4: the next set's cue, a rung change, the same wrong answer twice, the drill
  if (v && v.kind === 'wrong') {
    (T.nextCue = T.nextCue || {})[m.id] = v.fix;
    if (v.rung) T.rungs[m.id] = Math.max(0, (T.rungs[m.id] != null ? T.rungs[m.id] : m.rungIndex) - 1);
    const ins = L.inSession(m.id, T.results[m.id]);
    if (ins.drill && !T.sub[st.move]) { T.sub[st.move] = L.drillFor(m.id); T.notes.push('Felt ' + v.key.replace(':', ' → ') + ' twice on ' + L.MOVES5[m.id].name + '; switched to the drill for the rest of the session.'); }
    else if (ins.easier && !(T.eased || {})[m.id]) { (T.eased = T.eased || {})[m.id] = 1; T.rungs[m.id] = Math.max(0, (T.rungs[m.id] != null ? T.rungs[m.id] : m.rungIndex) - 1); }
  } else if (v && v.kind === 'cue') (T.nextCue = T.nextCue || {})[m.id] = cap(v.cue) + '.';
  if (st.calibrate) say(SAY.calibrated);
}

// ------------------------------------------------------------------ Ask Coach mid-workout (4.6) and This hurts (part 6)
function liveContext() {
  const st = step(), m = st && st.type === 'set' ? moveNow(st) : null;
  if (!m) return null;
  const done = (T.results[m.id] || []).map((x, k) => 'set ' + (k + 1) + ': ' + x.reps + ' reps, tap ' + (x.tap || '?') + (x.chip ? ', felt ' + x.chip + (x.follow ? ' → ' + x.follow : '') : '')).join('; ');
  const lastWhere = (T.results[m.id] || []).filter((x) => x.chip).map((x) => x.chip + (x.follow ? ' → ' + x.follow : '')).pop() || '';
  return { name: m.name, set: st.set, of: st.of, rung: m.rung.label || '', range: m.range[0] + '–' + m.range[1], sets: done, where: lastWhere };
}
function askSheet(reply, busyNow, asked) {
  const live = liveContext() || {}, st = step(), m = st && st.type === 'set' ? moveNow(st) : null;
  const rt = m ? rungText(m) : '';
  // audit Weak 14: the question stays above its answer
  return `<p class="sub">${esc(live.name ? live.name + ' · set ' + live.set + ' of ' + live.of + (rt ? ' · ' + rt : '') : 'Your workout')}. The clock is paused.</p>
    ${asked ? `<p class="caption" style="margin:12px 4px 4px">You asked: ${esc(asked)}</p>` : ''}
    ${reply ? `<div class="card"><p>${esc(reply)}</p></div>` : ''}
    <label class="field"><span>Ask about this move</span><textarea id="t5-q" rows="2" maxlength="600" placeholder="Ask anything about this set"></textarea></label>
    ${primary(busyNow ? 'Asking' : 'Ask', 't5-ask-send', {}, { disabled: !!busyNow })}`;
}

// ------------------------------------------------------------------ actions
export const actions = {
  't5-start'(el) { start({ length: el.dataset.len || '', makeup: el.dataset.makeup === '1' }); },
  't5-gate'(el) {
    T.gate = el.dataset.v;
    if (T.gate === 'off') {
      const t = today({ gate: 'off' });
      T.sess = t.sess; Object.keys(t.sess.moves).forEach((m) => { T.rungs[m] = t.sess.moves[m].rungIndex; });
      const st = S.program();
      if (st.gate.offRun >= 1) T.gateStop = true;
      toast(st.gate.offRun >= 1 ? 'Twice in a row: lower-body and core moves stay where they are. A pelvic health physio can check what\'s going on.' : 'Lower-body and core moves are one rung easier today. If it keeps happening, a pelvic health physio can help.', { icon: 'heart', ms: 7000 });
    }
    save(); enterStep();
  },
  't5-ready'() { const st = step(); T.seenLearn[mv(st.move)] = true; if (M5(mv(st.move)).anchor && !T.anchorSeen) { T.anchorSeen = true; S.setUi('t5_anchor_seen', true); } announceSet(st, moveNow(st)); save(); rerender(); },
  't5-info'(el) { T.learnOpen = el.dataset.id; pause(true); rerender(); },
  't5-learn-close'() { T.learnOpen = null; pause(false); rerender(); },
  't5-video'(el) { const id = el.dataset.vid; if (!id) return; const box = document.querySelector('.flow .media'); const html = `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1&rel=0&modestbranding=1&start=${+el.dataset.start || 0}" title="Form video" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`; if (box) box.outerHTML = html; else el.insertAdjacentHTML('afterend', html); },
  't5-done'() {
    const st = step(); if (!st || st.type !== 'set' || T.after) return;
    const m = moveNow(st);
    if (T.pausedAt) pause(false);
    if (m.side && T.side === 1) { T.side1 = T.count; T.switching = now(); say(SAY.switchSides); save(); rerender(); return; }
    const reps = st.gentle ? st.reps : Math.max(m.side ? Math.min(T.side1 || T.count, T.count) : T.count, 0);
    T.after = { reps: reps || (st.gentle ? st.reps : m.range[0]), tap: '', chip: '', follow: '', more: false, seconds: inStep(), drop: !!T.dropMode };
    if (!st.gentle && !T.dropMode) say(SAY.effort);
    save(); rerender();
  },
  't5-reps'(el) { if (!T.after) return; T.after.reps = Math.max(0, Math.min(60, T.after.reps + (+el.dataset.d))); save(); rerender(); },
  't5-tap'(el) { if (!T.after) return; const first = !T.after.tap; T.after.tap = el.dataset.v; if (first) say(SAY.where); save(); rerender(); },
  't5-chip'(el) {
    const st = step(), m = moveNow(st);
    T.after.chip = el.dataset.v; T.after.follow = '';
    const v = L.feelVerdict(m.id, T.after.chip, '');
    T.after.newRung = v.kind === 'wrong' && v.rung ? 'Next set: ' + ((L.ladderOf(m.id, S.settings().equipment)[Math.max(0, (T.rungs[m.id] != null ? T.rungs[m.id] : m.rungIndex) - 1)] || {}).label || 'one rung easier') + '.' : '';
    if (v.kind === 'wrong') say(v.fix);
    save(); rerender();
  },
  't5-follow'(el) {
    const st = step(), m = moveNow(st);
    T.after.follow = el.dataset.v;
    const v = L.feelVerdict(m.id, T.after.chip, T.after.follow);
    T.after.newRung = v.kind === 'wrong' && v.rung ? 'Next set: ' + ((L.ladderOf(m.id, S.settings().equipment)[Math.max(0, (T.rungs[m.id] != null ? T.rungs[m.id] : m.rungIndex) - 1)] || {}).label || 'one rung easier') + '.' : '';
    if (v.kind === 'wrong') say(v.fix);
    save(); rerender();
  },
  't5-more'() { T.after.more = true; rerender(); },
  't5-continue'() {
    const st = step(); if (!st || !T.after) return;
    const m = moveNow(st);
    recordSet(st, m, T.after);
    T.after = null;
    // the drop set (part 4: him, Full, Harder, the last face pull): one position closer, until 0 left; logged, never counted
    if (st.dropSet && !T.dropMode) { T.dropMode = true; T.count = 0; T.beat = -1; T.stepStart = now(); T.countFrom = now() + 3000; say(SAY.dropSet); save(); rerender(); return; }
    T.dropMode = false;
    next();
  },
  't5-next'() {
    const st = step();
    if (st && st.type === 'gentleq') { T.sess.steps[T.i].answered = true; }
    if (st && st.type === 'warm' && T.pausedAt) pause(false);
    next();
  },
  't5-gq'(el) { T.answers[el.dataset.k] = el.dataset.v; save(); rerender(); },
  't5-skipcool'() { while (T && step() && step().type === 'cool') T.i++; T.i--; next(); },
  't5-back'() {
    if (!T || T.i === 0) return;
    T.after = null; T.switching = 0;
    let k = T.i - 1;
    while (k > 0 && ['pairgo', 'taps', 'rest'].indexOf(T.sess.steps[k].type) >= 0) k--;
    const prev = T.sess.steps[k];
    if (prev && prev.type === 'set') { const id = mv(prev.move); const arr = T.results[id] || []; arr.pop(); T.times.sets.pop(); }
    T.i = k; enterStep();
  },
  't5-pause'() { pause(!T.pausedAt); rerender(); },
  't5-voice'() { T.voice = !T.voice; S.setUi('flowVoice', T.voice); if (!T.voice) Voice.stop(); save(); rerender(); },
  't5-end'() {
    const anyDone = Object.keys(T.results).some((k) => T.results[k].length);
    openSheet({ title: 'End the workout?', body: `<p class="sub">${anyDone ? 'What you did so far is saved and counts.' : 'Nothing is saved yet.'}</p>${primary(anyDone ? 'Save and end' : 'End', 't5-end-yes')}<div class="center">${textBtn('Keep going', 'sheet-close')}</div>` });
  },
  't5-end-yes'() { closeSheet(); const anyDone = Object.keys(T.results).some((k) => T.results[k].length); if (anyDone) { const op = finishAndSave(); if (op) logged(op, 'Workout saved.'); } clear(); go('workouts'); },
  't5-finish'() { const op = finishAndSave(); clear(); go('workouts'); if (op) logged(op, 'Workout saved.'); },
  't5-ask'() {
    pause(true); rerender();
    openSheet({ title: 'Ask Coach', body: askSheet('', false), onClose: () => { pause(false); rerender(); } });
  },
  async 't5-ask-send'() {
    const q = (document.getElementById('t5-q') || {}).value || '';
    if (!q.trim()) return;
    updateSheet({ title: 'Ask Coach', body: askSheet('', true, q.trim()) });
    try {
      const cid = 'a' + Date.now().toString(36);
      let r = await call('coachChat', { text: q.trim(), cid, live: liveContext(), source: 'ask' }, { timeout: 120000 });
      for (let k = 0; r && r.pending && k < 40; k++) { await new Promise((ok) => setTimeout(ok, 3000)); const s = await call('chatResult', { cid: r.cid || cid }).catch(() => null); if (s && s.status === 'done') r = s.result; }
      updateSheet({ title: 'Ask Coach', body: askSheet((r && r.reply) || 'Your coach is taking longer than usual. The answer will be in Coach.', false, q.trim()) });
      S.sync();
    } catch (e) { updateSheet({ title: 'Ask Coach', body: askSheet(e.message || 'Couldn\'t reach your coach.', false, q.trim()) }); }
  },
  't5-hurts'() {
    pause(true); rerender();
    const st = step(), m = st && st.type === 'set' ? moveNow(st) : null;
    openSheet({ title: 'This hurts', onClose: () => { if (T && T.pausedAt && !T.autoPaused) { pause(false); rerender(); } }, body: `<p class="sub">${esc(m ? m.name : 'This move')}. How does it hurt?</p>
      <div class="inset">${row({ label: 'A dull ache, 3 or less out of 10', sub: 'Normal if it settles by tomorrow morning', act: 't5-hurt', data: { 'data-v': 'dull' } })}${row({ label: 'Sharp, or more than 3', sub: 'Stop this move today; an easier swap', act: 't5-hurt', data: { 'data-v': 'sharp' } })}${row({ label: 'Wrist or thumb', sub: 'Grip changes', act: 't5-hurt', data: { 'data-v': 'wrist' } })}</div>` });
  },
  't5-hurt'(el) {
    const st = step(); const m = st && st.type === 'set' ? moveNow(st) : null;
    closeSheet();
    if (!m) { pause(false); rerender(); return; }
    const v = el.dataset.v;
    if (v === 'dull') { toast('Keep going gently. A dull ache that settles by morning is normal.', { icon: 'info', ms: 6000 }); pause(false); rerender(); return; }
    if (v === 'wrist') { toast(L.WRIST_LINE, { icon: 'info', ms: 9000 }); pause(false); rerender(); return; }
    // sharp or above 3: stop this move today and swap it (part 6)
    const sw = L.swapFor(m.id, m.rungIndex);
    (T.results[m.id] = T.results[m.id] || []).push({ setNo: (T.results[m.id] || []).length + 1, rung: m.rungIndex, rungKey: m.rung.key || '', reps: null, tap: '', chip: '', follow: '', wrongKey: '', pain: true, flags: 'hurts', seconds: 0, side: '' });
    if (sw.move === m.id && sw.rung >= m.rungIndex) {
      // nothing easier: the move stops for today (part 6)
      T.notes.push('"This hurts" (sharp or above 3) on ' + m.name + '; stopped for today');
      T.stopped = Object.assign({}, T.stopped, { [st.move]: true });
      toast('Stopped for today: ' + m.name + '. It comes back next time if it feels fine.', { icon: 'shield', ms: 7000 });
      pause(false); T.after = null; T.count = 0;
      next(); save(); rerender(); return;
    }
    T.notes.push('"This hurts" (sharp or above 3) on ' + m.name + '; swapped: ' + sw.line);
    if (sw.move !== m.id) { T.sub[st.move] = { move: sw.move, rung: sw.rung }; T.rungs[sw.move] = sw.rung; }
    else T.rungs[m.id] = sw.rung;
    T.swaps[m.id] = sw.move === m.id ? sw.rung : m.rungIndex - 1 >= 0 ? m.rungIndex - 1 : 0;
    toast('Stopped. ' + sw.line, { icon: 'shield', ms: 6000 });
    pause(false); T.after = null; T.count = 0; T.stepStart = now(); T.countFrom = now() + 4000; T.beat = -1; say(M5(mv(st.move)).name + '.');
    save(); rerender();
  }
};
function clear() { clearInterval(tick); tick = null; T = null; LS.del(SAVE()); keepAwake(false); Voice.stop(); }
export function afterRender() { if (T && step() && (step().type === 'set' || step().type === 'warm')) { /* the count node is redrawn by the tick */ } }
export { feltLine, nextTimeLines };
window.__opTrain = { state: () => T, step: () => step(), timeLeft: () => (T ? timeLeft() : 0), elapsed: () => (T ? elapsedAll() : 0), // the browser tests read the clock here
  rehearse: (o) => { const all = {}; Object.keys(L.MOVES5).forEach((k) => { all[k] = 2; }); const sess = o.gentle ? L.gentleSession({ done: 0 }) : L.session5(Object.assign({ hingeUnlocked: o.n > 3, learned: o.n > 6 && o.n < 19 ? all : (o.n >= 22 ? all : {}), findings: o.n > 6 ? all : {} }, o)); start({ session: sess }); return { planned: L.plannedTotal(sess) }; } };
void K;
