/* The workout flow (D9): full screen, no tab bar. Warm-up → each set (rest between) → cool-down → done.
 * The media card shows the still of the move's verified form video; "Watch form" plays the video itself. */
import { L, K, esc, icon, toast, openSheet, closeSheet, keepAwake, dayName } from '../core.js?v=132c8397ab';
import { S } from '../store.js?v=229f42e888';
import { go, rerender } from '../nav.js?v=57c55c9996';
import { primary, textBtn, iconBtn, ring, setRing, videoFrame, videoStill, still, row, card, bar, picks } from '../ui.js?v=9375313392';
import * as Voice from '../voice.js?v=6f7b9b2130';
import { logged, tipOnce, reduceMotion } from '../fx.js?v=73177c13f1';
import { pulse } from './summary.js?v=789f6aceb5';

let G = null, raf = 0, clockTimer = null;
const fmt = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const fmtSec = (s) => String(Math.max(0, Math.round(s))); // rings show seconds ("60 seconds", never "1:00 seconds")
/** One cue line: the first sentence (the full how-to is in the move detail). */
const cueLine = (t) => K.SPOKEN.cueLine(t); // the same first sentence the voice says
const target = (m) => (m.unit === 'seconds' ? m.low + '–' + m.high + ' seconds' : m.low + '–' + m.high + (m.perSide ? ' each side' : ''));
const mid = (m) => Math.round((m.low + m.high) / 2);

const SP = K.SPOKEN;
function voiceOn() { return !!(G && G.voice); }
/** A fixed workout line now (it interrupts the line before), or after the current one (queue). Only while voice is on. */
function say(t, opts = {}) { if (voiceOn() && t) Voice.say(t, Object.assign({ workout: true }, opts)); }
function sayNext(t) { say(t, { queue: true }); }
/** Every fixed line this workout can say, prefetched when it starts (A2). */
function linesFor(moves) {
  const out = SP.count.concat([SP.rest, SP.nextUp, SP.halfway, SP.lastSet, SP.complete, SP.skip, SP.stop, SP.set(2), SP.set(3), SP.set(4), SP.set(5),
    SP.whichBand, SP.lighter, SP.moveUp, SP.bothSides, SP.switchSides, SP.twoDown]).concat(SP.base || []);
  K.WARMUP.steps.concat(K.COOLDOWN.steps).forEach((s) => out.push(SP.step(s)));
  moves.forEach((m) => { const ex = S.exercise(m.exerciseId) || {}; out.push(SP.move(m.name, ex.cue || ''), SP.name(m.name)); });
  return out;
}

function start() {
  const plan = S.dayPlan();
  const w = plan.workout;
  if (w.kind !== 'strength' && w.kind !== 'light') return false;
  const moves = w.moves;
  const short = w.minutes <= 10;
  const steps = [];
  const warm = short ? K.WARMUP.steps.slice(0, 4) : K.WARMUP.steps;
  warm.forEach((s, i) => steps.push({ type: 'warm', name: s.name, cue: s.cue, seconds: s.seconds, n: i + 1, of: warm.length }));
  moves.forEach((m, mi) => {
    for (let k = 1; k <= m.sets; k++) {
      steps.push({ type: 'work', mi, set: k });
      if (!(mi === moves.length - 1 && k === m.sets)) steps.push({ type: 'rest', seconds: m.rest, nextMi: k < m.sets ? mi : mi + 1, nextSet: k < m.sets ? k + 1 : 1 });
    }
  });
  const cool = short ? K.COOLDOWN.steps.slice(0, 3) : K.COOLDOWN.steps;
  cool.forEach((s, i) => steps.push({ type: 'cool', name: s.name, cue: s.cue, seconds: s.seconds, n: i + 1, of: cool.length }));
  steps.push({ type: 'done' });
  G = { plan, moves, steps, i: 0, started: Date.now(), pausedMs: 0, pausedAt: 0, voice: S.ui.flowVoice !== false, timer: null, feel: '', saved: false,
    // Round 4: the band program — a band per move (preset, changeable in one tap), reps you can adjust, effort per set
    band: !!w.band, said: {}, base: { pain: null, leaking: null, doming: null },
    results: moves.map((m) => ({ move: m, sets: [], rir: [], pain: false, band: m.band ? m.band.key : '', target: m.target || mid(m) })) };
  keepAwake(true);
  if (G.voice) Voice.prepare(linesFor(moves));
  enter();
  return true;
}
const step = () => G.steps[G.i];
function elapsed() { return Math.max(0, Math.round(((G.pausedAt || Date.now()) - G.started - G.pausedMs) / 1000)); }

function enter() {
  cancelAnimationFrame(raf);
  G.timer = null;
  const st = step();
  if (st.type === 'warm' || st.type === 'cool') { say(SP.step(st)); startTimer(st.seconds, () => next()); }
  else if (st.type === 'rest') { say(SP.rest); startTimer(st.seconds, () => next()); }
  else if (st.type === 'work') {
    const m = G.moves[st.mi];
    const ex = S.exercise(m.exerciseId) || {};
    if (st.set === 1) {
      if (G.band && G.plan.workout.lighter && !G.said.lighter) { G.said.lighter = 1; say(SP.lighter); sayNext(SP.move(m.name, ex.cue || '')); }
      else say(SP.move(m.name, ex.cue || ''));
      if (G.band && m.band && !m.lastTime) sayNext(SP.whichBand);
      if (G.band && m.perSide) sayNext(SP.bothSides);
      if (G.band && !G.said.tempo && m.unit === 'reps' && m.band) { G.said.tempo = 1; sayNext(SP.twoDown); }
    } else { say(st.set === m.sets ? SP.lastSet : SP.set(st.set)); sayNext(SP.name(m.name)); }
    if (m.unit === 'seconds') startTimer(mid(m), () => { recordSet(mid(m)); next(); }, 4);
  } else if (st.type === 'done') { keepAwake(false); say(SP.complete); if (G.band) { finishBand(); if (G.nextTime && G.nextTime.some((n) => n.action === 'up')) sayNext(SP.moveUp); } }
  rerender();
}
function startTimer(seconds, onDone, lead = 0) {
  G.timer = { total: seconds, endsAt: Date.now() + (seconds + lead) * 1000, paused: false, left: seconds, onDone, said: {} };
  loop();
}
function loop() {
  cancelAnimationFrame(raf);
  const frame = () => {
    if (!G || !G.timer) return;
    const t = G.timer;
    if (!t.paused) {
      const ms = Math.max(0, t.endsAt - Date.now());
      const left = Math.ceil(ms / 1000);
      if (left !== t.left) {
        t.left = left;
        const st = step();
        // "Next up" 10 seconds before a rest ends; "Halfway" in a timed move; then 3, 2, 1 exactly on time
        if (st.type === 'rest' && left === 10 && t.total >= 20 && !t.said.next && G.moves[st.nextMi]) { t.said.next = 1; say(SP.nextUp); sayNext(SP.name(G.moves[st.nextMi].name)); }
        if (st.type === 'work' && t.total >= 20 && left === Math.round(t.total / 2) && !t.said.half) { t.said.half = 1; say(SP.halfway); }
        if (left >= 1 && left <= 3 && !t.said[left]) { t.said[left] = 1; say(SP.count[3 - left], { cue: true }); }
      }
      setRing('flow-ring', Math.min(1, ms / 1000 / Math.max(1, t.total)), fmtSec(Math.min(t.total, left)));
      paintProgress();
      if (ms <= 0) { if (voiceOn()) Voice.beep(); const cb = t.onDone; G.timer = null; if (cb) cb(); return; }
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
function recordSet(v) { const st = step(); if (st && st.type === 'work') G.results[st.mi].sets[st.set - 1] = v; }
function next() { if (G.i < G.steps.length - 1) { G.i++; enter(); } }
function prev() { if (G.i > 0) { G.i--; while (G.i > 0 && step().type === 'rest') G.i--; enter(); } }
function moveIndexOf(st) { return st.type === 'work' ? st.mi : (st.type === 'rest' ? st.nextMi : (st.type === 'cool' || st.type === 'done' ? G.moves.length : -1)); }
/** H2: the segments are the steps of the part you're in — warm-up steps, then one per move, then cool-down steps —
 * and every finished step is filled (the current one fills as its timer runs). */
function segCount(st) { return st.type === 'warm' || st.type === 'cool' ? st.of : G.moves.length; }
function paintProgress() {
  const segs = document.querySelectorAll('.flow-prog u');
  if (!segs.length || !G) return;
  const st = step();
  const timerPart = () => (G.timer ? Math.max(0, Math.min(1, 1 - G.timer.left / Math.max(1, G.timer.total))) : 0);
  if (st.type === 'warm' || st.type === 'cool') {
    segs.forEach((u, i) => { const f = i < st.n - 1 ? 1 : (i === st.n - 1 ? timerPart() : 0); u.style.width = (f * 100).toFixed(1) + '%'; });
  } else {
    G.moves.forEach((m, i) => {
      const done = G.results[i].sets.filter((x) => x != null).length;
      let f = Math.min(1, done / m.sets);
      if (st.type === 'work' && st.mi === i && G.timer && G.moves[i].unit === 'seconds') f = Math.min(1, (done + timerPart()) / m.sets);
      if (segs[i]) segs[i].style.width = (f * 100).toFixed(1) + '%';
    });
  }
  const c = document.getElementById('flow-clock');
  if (c) c.textContent = fmt(elapsed());
}

// ------------------------------------------------------------------ render
export function render() {
  if (!G && !start()) {
    return `<div class="flow"><div class="flow-top">${iconBtn('x', 'flow-close', 'Close')}<span></span><span></span></div><div class="empty">${icon('calendar')}<h3>No workout today</h3><p>${esc(S.dayPlan().workout.line)}</p>${primary('Back to Plan', 'flow-close')}</div></div>`;
  }
  const st = step();
  if (st.type === 'done') return completeScreen();
  const mi = moveIndexOf(st);
  const top = `<div class="flow-top">${iconBtn('x', 'flow-end', 'End workout')}
    <div class="flow-clock"><b id="flow-clock">${fmt(elapsed())}</b><span>${esc(whereText(st))}</span></div>
    ${iconBtn(G.voice ? 'volume-2' : 'volume-x', 'flow-voice', G.voice ? 'Voice on' : 'Voice off', { pressed: G.voice })}</div>
    <div class="flow-prog" aria-hidden="true">${Array.from({ length: segCount(st) }, () => '<i><u></u></i>').join('')}</div>`;
  let body = '';
  const t = G.timer;
  const pauseLabel = G.pausedAt ? 'Resume' : 'Pause';
  if (st.type === 'work' && G.band && G.moves[st.mi].unit === 'reps') {
    body = bandWork(st);
  } else if (st.type === 'work') {
    const m = G.moves[st.mi];
    const ex = S.exercise(m.exerciseId) || {};
    const pic = still(ex.video);
    const nextName = upcomingName();
    body = `${media(m.name, pic, m.exerciseId)}
      <div class="eyebrow act">${esc(L.PATTERN_NAMES[m.pattern] || m.pattern)} · Set ${st.set} of ${m.sets}</div>
      <h1 class="move-name">${esc(m.name)}</h1>
      <p class="move-cue">${esc(cueLine(ex.cue))}</p>
      ${m.unit === 'seconds' ? ring('flow-ring', t ? t.left / Math.max(1, t.total) : 1, fmtSec(t ? Math.min(t.total, t.left) : mid(m)), 'seconds', { cls: 'small' })
        : `<div class="reps"><div class="reps-n"><b>${mid(m)}</b><span>reps${m.perSide ? ' each side' : ''}</span></div><p class="sub">Aim for ${esc(m.low + '–' + m.high)}</p></div>`}
      ${nextName ? `<p class="next-line">Next: ${esc(nextName)}</p>` : ''}
      <div class="flow-actions">${primary('Done with this set', 'flow-done')}
      <div class="btn-row">${G.i > firstWork() ? textBtn('Back', 'flow-back') : ''}${textBtn(pauseLabel, 'flow-pause')}${textBtn('This hurts', 'flow-hurts')}</div></div>`;
  } else if (st.type === 'rest') {
    const nm = G.moves[st.nextMi];
    const nex = nm ? S.exercise(nm.exerciseId) || {} : {};
    const pic = nm ? still(nex.video) : '';
    body = `<div class="eyebrow act">Rest</div><h1 class="move-name">Breathe</h1>
      ${ring('flow-ring', t ? t.left / Math.max(1, t.total) : 1, fmtSec(t ? Math.min(t.total, t.left) : st.seconds), 'seconds')}
      ${nm ? `<div class="card nextup">${pic ? `<img src="${esc(pic)}" alt="" loading="lazy">` : '<span class="ph"></span>'}<span class="grow"><span class="eyebrow">Next up</span><span class="row-label b" style="display:block">${esc(nm.name)}${st.nextSet > 1 ? ' · set ' + st.nextSet : ''}</span><span class="row-sub">${esc(target(nm))}</span></span></div>` : ''}
      <div class="flow-actions"><div class="btn-row">${textBtn('Skip rest', 'flow-skip')}</div></div>`;
  } else {
    // H2: warm-up and cool-down steps use the move frame: the routine's video still above, the ring where the rep number is
    const routine = st.type === 'warm' ? K.WARMUP : K.COOLDOWN;
    body = `${media(st.name, still(routine.video), '', routine.video && routine.video.id)}
      <div class="eyebrow act">${st.type === 'warm' ? 'Warm-up' : 'Cool-down'} · ${st.n} of ${st.of}</div><h1 class="move-name">${esc(st.name)}</h1><p class="move-cue">${esc(cueLine(st.cue))}</p>
      ${ring('flow-ring', t ? t.left / Math.max(1, t.total) : 1, fmtSec(t ? Math.min(t.total, t.left) : st.seconds), 'seconds', { cls: 'small' })}
      <div class="flow-actions">${primary('Next', 'flow-next')}<div class="btn-row">${G.i > 0 ? textBtn('Back', 'flow-back') : ''}${textBtn(pauseLabel, 'flow-pause')}${textBtn('This hurts', 'flow-hurts')}</div></div>`;
  }
  return `<div class="flow">${top}${body}</div>`;
}
function firstWork() { return 0; }

// ------------------------------------------------------------------ Round 4: the band program's set screen (R4BandWorkout)
const ladderOf = (m) => L.ladderFor(S.exercise(m.exerciseId) || { equipment: m.equipment }, S.settings().equipment);
function stepByKey(m, key) { const lad = ladderOf(m); return lad[L.stepIndex(lad, key)] || null; }
/** The band as a chip: its color dot (black gets a light ring) and its name and pounds. */
export function bandChip(step, act, data = {}) {
  if (!step) return '';
  const dots = step.colors.map((c) => `<i class="bdot${/^black$/i.test(c) ? ' ring' : ''}" style="background:${K.BAND_DOTS[c.toLowerCase()] || 'var(--text3)'}"></i>`).join('');
  const label = step.lb ? step.label : step.label;
  const attrs = Object.entries(data).map(([k, v]) => `${k}="${esc(v)}"`).join(' ');
  return act ? `<button type="button" class="bandchip" data-act="${act}" ${attrs} aria-label="Band: ${esc(label)}. Change it">${dots}<span>${esc(label)}</span></button>` : `<span class="bandchip">${dots}<span>${esc(label)}</span></span>`;
}
function bandWork(st) {
  const m = G.moves[st.mi], r = G.results[st.mi];
  const ex = S.exercise(m.exerciseId) || {};
  const pic = still(ex.video);
  const step = r.band ? stepByKey(m, r.band) : null;
  const first = m.band && !m.lastTime && st.set === 1 && !r.picked;
  let bandLine = '';
  if (first) {
    // the first time this move runs: "Which band?" — the ladder around the suggested step, one tap
    const lad = ladderOf(m), at = Math.max(0, L.stepIndex(lad, r.band));
    const from = Math.max(0, Math.min(at - 2, lad.length - 5));
    bandLine = `<div class="which"><span class="h3">Which band?</span><div class="picks">${lad.slice(from, from + 5).map((s) => `<button type="button" class="pick bandpick${s.key === r.band ? ' on' : ''}" aria-pressed="${s.key === r.band}" data-act="band-pick" data-k="${esc(s.key)}">${bandChip(s).replace('class="bandchip"', 'class="bandchip bare"')}</button>`).join('')}</div></div>`;
  } else if (step) bandLine = `<div class="bandline">${bandChip(step, 'flow-band')}${m.note ? `<span class="sub">${esc(m.note)}</span>` : ''}</div>`;
  else if (m.note) bandLine = `<div class="bandline"><span class="sub">${esc(m.note)}</span></div>`;
  const reps = r.sets[st.set - 1] != null ? r.sets[st.set - 1] : r.target;
  return `${media(m.name, pic, m.exerciseId)}
    <div class="eyebrow act">${esc(L.PATTERN_NAMES[m.pattern] || (m.pattern === 'press' ? 'Press' : m.pattern === 'glutes' ? 'Glutes' : m.pattern === 'base' ? 'Gentle start' : m.pattern))} · Set ${st.set} of ${m.sets}</div>
    <h1 class="move-name">${esc(m.name)}</h1>
    ${bandLine}
    <div class="reps4"><button type="button" class="reps4-n" data-act="flow-reps" aria-label="${reps} reps${m.perSide ? ' each side' : ''}. Change the number">${reps}</button>
      <span class="reps4-side"><b>reps${m.perSide ? ' each side' : ''}</b>${m.lastTime ? `<span>Last time: ${esc(m.lastTime)}</span>` : `<span>Aim for ${m.low}–${m.high}</span>`}</span></div>
    <div class="flow-actions"><div class="card effort"><p class="h3">How many more could you have done?</p>
      <div class="feel three" role="group" aria-label="Reps left">${[[0, '0', 'all out'], [1, '1–2', 'just right'], [3, '3+', 'easy']].map(([v, n, l]) => `<button type="button" data-act="flow-effort" data-v="${v}" aria-label="${esc(n)}, ${esc(l)}"><b>${n}</b><span>${l}</span></button>`).join('')}</div></div>
      <div class="btn-row">${G.i > firstWork() ? textBtn('Back', 'flow-back') : ''}${textBtn(G.pausedAt ? 'Resume' : 'Pause', 'flow-pause')}${textBtn('This hurts', 'flow-hurts')}</div></div>`;
}
/** After the last step: new bests, next time's band changes, this week's active minutes. */
function finishBand() {
  if (G.finished) return;
  G.finished = true;
  const today = S.today(), lg = S.logs(S.meId());
  const before = (lg.sets || []).filter((x) => x.date <= today);
  const mine = [];
  G.results.forEach((r) => r.sets.forEach((v, i) => { if (v != null) mine.push({ exerciseId: r.move.exerciseId, workoutId: 'now', date: today, reps: r.move.unit === 'seconds' ? null : v, seconds: r.move.unit === 'seconds' ? v : null, band: r.band, rir: r.rir[i] == null ? null : r.rir[i], setNo: i + 1 }); }));
  G.bests = L.newBests(before, mine, (id) => L.ladderFor(S.exercise(id), S.settings().equipment)).map((b) => Object.assign(b, { name: (S.exercise(b.exerciseId) || {}).name || '' }));
  G.nextTime = [];
  G.results.forEach((r) => {
    if (!r.band) return;
    const lad = ladderOf(r.move);
    const n = L.bandNext(before.concat(mine.filter((x) => x.exerciseId === r.move.exerciseId)), r.move.exerciseId, lad, { date: L.addDays(today, 7) });
    if (n.action !== 'none') G.nextTime.push({ action: n.action, name: r.move.name, from: n.from, to: n.to });
  });
}
function bandCompleteScreen() {
  const mins = elapsed();
  const sets = G.results.reduce((a, r) => a + r.sets.filter((x) => x != null).length, 0);
  const movesDone = G.results.filter((r) => r.sets.some((x) => x != null)).length;
  const s = S.settings(), gentle = !!(S.person(S.meId()) || {}).safe && s.keep_gentle !== false;
  const lg = S.logs(S.meId());
  const goal = L.weeklyGoal({ setting: s.weekly_minutes, date: S.today(), gentle });
  const wk = L.activeWeek({ date: S.today(), workouts: lg.workouts.concat(G.saved ? [] : [{ date: S.today(), kind: 'strength', minutes: Math.max(1, Math.round(mins / 60)) }]), steps: lg.steps, goal });
  const bests = (G.bests || []).slice(0, 3);
  const nt = (G.nextTime || [])[0];
  const lower = (t) => String(t || '').toLowerCase();
  const ntCard = nt ? card(`<div class="eyebrow">Next time</div><div class="nt-line"><span class="nt-dots">${bandDots(nt.from)}${icon('arrow-right', 'ic-s')}${bandDots(nt.to)}</span><span class="h3">${esc(nt.name.replace(/^Band /, '').replace(/^./, (c) => c.toUpperCase()))} moves ${nt.action === 'up' ? 'up' : 'down'} to ${esc(nt.to.short)}</span></div>
      <p class="sub">${nt.action === 'up' ? 'You hit 15 reps with 3 or more left, twice. ' + esc(cap(nt.to.short)) + (nt.to.lb ? ' is ' + nt.to.lb + ' lb' : '') + '; aim for 8.' : 'The last two sessions were a real fight. ' + esc(cap(nt.to.short)) + (nt.to.lb ? ' is ' + nt.to.lb + ' lb' : '') + '; aim for 12.'}</p>${(G.nextTime.length > 1 ? `<p class="caption">${G.nextTime.slice(1).map((x) => esc(x.name) + ' moves ' + x.action + ' to ' + esc(x.to.short)).join(' · ')}</p>` : '')}`) : '';
  const base = G.plan.workout.phase === 'base';
  const chip = (k, label) => `<div class="split basechk"><span class="row-label">${label}</span>${['yes', 'no'].map((v) => `<button type="button" class="pick${G.base[k] === v ? ' on' : ''}" aria-pressed="${G.base[k] === v}" data-act="base-chip" data-k="${k}" data-v="${v}">${v === 'yes' ? 'Yes' : 'No'}</button>`).join('')}</div>`;
  return `<div class="flow"><div class="flow-top"><span></span><span></span><span></span></div>
    <div class="done-ring small" role="img" aria-label="Done">${icon('check')}</div>
    <h1 class="done-title">Workout done</h1>
    <p class="body center t-2" style="margin-top:4px">${Math.max(1, Math.round(mins / 60))} min · ${movesDone} ${movesDone === 1 ? 'move' : 'moves'} · ${sets} ${sets === 1 ? 'set' : 'sets'}</p>
    <div class="stack-s" style="margin-top:20px">
    ${bests.length ? card(`<div class="eyebrow" style="display:flex;align-items:center;gap:8px">${icon('trophy', 'ic-s t-activity')}<span>New best</span></div><div class="best-rows">${bests.map((b) => `<div class="split"><span class="body">${esc(b.name)}</span><b class="num">${esc(b.text)}</b></div>`).join('')}</div>`) : ''}
    ${ntCard}
    ${card(`<div class="split"><span class="eyebrow">Active this week</span><span class="sub">goal ${wk.goal} min</span></div><div class="bigline" style="margin-top:4px"><b class="num" style="font-size:var(--f34);font-weight:700;color:var(--activity-text)">${wk.minutes}</b><span>min</span></div><div style="margin-top:8px">${bar(wk.pct, 'activity')}</div>
      <p class="sub" style="margin-top:8px">${wk.minutes >= wk.goal ? 'Goal reached this week.' : (wk.behind ? 'A 10-minute walk after supper keeps you on pace.' : 'You\'re on pace this week.')}${wk.fromSteps ? ' ' + wk.fromSteps + ' min from steps.' : ''}</p>`)}
    ${base ? card(`<p class="h3">After a gentle session</p><div class="stack-s" style="margin-top:8px">${chip('pain', 'Any pain?')}${chip('leaking', 'Any leaking?')}${chip('doming', 'Belly doming?')}</div>`) : ''}
    </div>
    <div class="flow-actions">${primary('Done', 'flow-finish')}</div></div>`;
}
function bandDots(step) { return step ? step.colors.map((c) => `<i class="bdot${/^black$/i.test(c) ? ' ring' : ''}" style="background:${K.BAND_DOTS[c.toLowerCase()] || 'var(--text3)'}"></i>`).join('') : ''; }
function cap(t) { t = String(t || ''); return t.charAt(0).toUpperCase() + t.slice(1); }
function media(name, pic, exId, vid) {
  if (!pic) return `<div class="media plain"><b>${esc(name)}</b></div>`;
  return `<button type="button" class="media" data-act="flow-video" data-id="${esc(exId || '')}" ${vid ? `data-vid="${esc(vid)}"` : ''} aria-label="Watch the form video for ${esc(name)}"><img src="${esc(pic)}" alt="" data-name="${esc(name)}"><span class="play">${icon('play')}</span><span class="watch">${icon('play')}Watch form</span></button>`;
}
function whereText(st) {
  if (st.type === 'warm') return 'Warm-up ' + st.n + ' of ' + st.of;
  if (st.type === 'cool') return 'Cool-down ' + st.n + ' of ' + st.of;
  const mi = st.type === 'work' ? st.mi : st.nextMi;
  return 'Move ' + (Math.min(mi, G.moves.length - 1) + 1) + ' of ' + G.moves.length;
}
function upcomingName() {
  for (let k = G.i + 1; k < G.steps.length; k++) {
    const s = G.steps[k];
    if (s.type === 'work') { const m = G.moves[s.mi]; return s.mi === step().mi ? m.name + ', set ' + s.set : m.name; }
    if (s.type === 'cool') return 'Cool-down';
  }
  return '';
}
function completeScreen() {
  if (G.band) return bandCompleteScreen();
  const mins = elapsed();
  const movesDone = G.results.filter((r) => r.sets.some((x) => x != null)).length;
  const sets = G.results.reduce((a, r) => a + r.sets.filter((x) => x != null).length, 0);
  const st = S.streak(S.meId());
  const streak = st.todayDone ? st.current : st.current + 1;
  const part = S.minutes() < 12 * 60 ? 'morning' : S.minutes() < 17 * 60 ? 'afternoon' : 'evening';
  const p = S.partner();
  return `<div class="flow"><div class="flow-top"><span></span><span></span><span></span></div>
    <div class="done-ring" role="img" aria-label="Done">${icon('check')}</div>
    <h1 class="done-title">Workout complete</h1>
    <p class="body center t-2" style="margin-top:4px">${esc(G.plan.workout.title)} · ${esc(dayName(S.today()))} ${part}</p>
    <div class="stats">
      <div class="stat act"><span class="caption">Time</span><b>${fmt(mins)}</b></div>
      <div class="stat"><span class="caption">Moves</span><b>${movesDone} of ${G.moves.length}</b></div>
      <div class="stat"><span class="caption">Sets</span><b>${sets}</b></div>
      <div class="stat"><span class="caption">Streak</span><b>${icon('flame')}${streak} ${streak === 1 ? 'day' : 'days'}</b></div></div>
    <p class="h3" style="margin-top:24px">How did it feel?</p>
    <div class="feel" style="margin-top:10px">${[['easy', 'Easy'], ['ok', 'Just right'], ['hard', 'Hard']].map(([k, l]) => `<button type="button" data-act="flow-feel" data-v="${k}" class="${G.feel === k ? 'on' : ''}" aria-pressed="${G.feel === k}">${l}</button>`).join('')}</div>
    <p class="caption" style="margin-top:8px">The coach uses this to set next week's level.</p>
    ${p && S.settings().share !== false ? `<p class="sub" style="margin-top:12px">${esc(p.name)} will see this on Together.</p>` : ''}
    <div class="flow-actions">${primary('Done', 'flow-finish')}</div></div>`;
}
export function afterRender() {
  if (!G) return;
  paintProgress();
  document.querySelectorAll('.media img').forEach((img) => {
    img.addEventListener('error', () => { const b = img.closest('.media'); if (b) b.outerHTML = `<div class="media plain"><b>${esc(img.dataset.name || '')}</b></div>`; }, { once: true });
  });
  if (G.timer && !G.timer.paused) loop();
  clearInterval(clockTimer);
  clockTimer = setInterval(() => { if (!G) { clearInterval(clockTimer); return; } const c = document.getElementById('flow-clock'); if (c) c.textContent = fmt(elapsed()); }, 1000);
}
export function leave(from, to) {
  if (from !== 'workout' || to === 'workout') return;
  if (G && step().type === 'done' && !G.saved) save();
  stop();
}
function stop() { cancelAnimationFrame(raf); clearInterval(clockTimer); Voice.stop(); keepAwake(false); G = null; }

/** Save what was done. Overall feel goes on every set, so "Easy" twice in a row proposes the next level. */
function save(minutes) {
  if (!G || G.saved) return null;
  G.saved = true;
  // Round 4: in the band program the effort taps say how it felt (all easy → easy, any all-out → hard)
  const rirs = [].concat(...G.results.map((r) => r.rir.filter((x) => x != null)));
  const felt = G.band ? (rirs.length && rirs.every((x) => x >= 3) ? 'easy' : (rirs.some((x) => x === 0) ? 'hard' : 'ok')) : (G.feel || 'ok');
  const sets = [];
  G.results.forEach((r) => r.sets.forEach((v, i) => {
    if (v == null) return;
    const m = r.move;
    sets.push({ exerciseId: m.exerciseId, pattern: m.pattern, level: m.level, setNo: i + 1, reps: m.unit === 'seconds' ? null : v, seconds: m.unit === 'seconds' ? v : null, felt, pain: !!r.pain, band: r.band || '', rir: r.rir[i] == null ? '' : r.rir[i] });
  }));
  if (G.band && G.plan.workout.phase === 'base' && ['pain', 'leaking', 'doming'].some((k) => G.base[k])) S.write('baseCheck', { pain: G.base.pain === 'yes', leaking: G.base.leaking === 'yes', doming: G.base.doming === 'yes' });
  if (!sets.length) return null;
  const mins = Math.max(1, Math.round((minutes || elapsed()) / 60));
  return S.write('logWorkout', { date: S.today(), kind: G.plan.workout.kind, version: G.plan.workout.minutes, minutes: Math.min(mins, G.plan.workout.minutes + 20), felt, pain: G.results.some((r) => r.pain), sets });
}

// ------------------------------------------------------------------ move detail (D9f)
export function moveSheet(id) {
  const ex = S.exercise(id);
  if (!ex) return;
  const lib = S.library();
  const cur = S.levels(S.meId())[ex.pattern] || 1;
  const easier = ex.saferId ? lib.find((e) => e.id === ex.saferId) : null;
  const harder = ex.harderId ? lib.find((e) => e.id === ex.harderId) : null;
  openSheet({ title: ex.name, body: `<div class="eyebrow">${esc(L.PATTERN_NAMES[ex.pattern])} · Level ${ex.level}</div>
    ${ex.video ? videoStill(ex.video, ex.name) : ''}
    <div><div class="h3">How to do it</div><p class="sub" style="margin-top:4px">${esc(ex.cue)}</p></div>
    <div><div class="h3">What you should feel</div><p class="sub" style="margin-top:4px">${esc(ex.feel)}</p></div>
    <div><div class="h3">Common mistakes</div><ul class="bullets" style="margin-top:4px">${(ex.mistakes || []).map((m) => `<li class="sub">${esc(m)}</li>`).join('')}</ul></div>
    ${ex.safety ? `<p class="note">${icon('shield')}<span>${esc(ex.safety)}</span></p>` : ''}
    ${easier || harder ? `<div class="inset">${easier ? row({ label: 'Easier: ' + easier.name, act: 'open-move', data: { 'data-id': easier.id } }) : ''}${harder ? row({ label: 'Harder: ' + harder.name, act: 'open-move', data: { 'data-id': harder.id } }) : ''}</div>` : ''}
    ${ex.level !== cur ? textBtn('Use this level from now on', 'level-set', { 'data-p': ex.pattern, 'data-l': ex.level }, { cls: 'block' }) : '<p class="caption center">This is your current level.</p>'}` });
}
function movesSheet() {
  const w = S.dayPlan().workout;
  openSheet({ title: w.title + ' · ' + w.minutes + ' min', body: `<div class="inset">${w.moves.map((m) => row({ label: m.name, sub: L.PATTERN_NAMES[m.pattern] + ' · ' + m.sets + ' × ' + target(m), act: 'open-move', data: { 'data-id': m.exerciseId } })).join('')}</div><p class="caption">Plus a ${w.warmup}-minute warm-up and a ${w.cooldown}-minute cool-down.</p>` });
}

// ------------------------------------------------------------------ actions
export const actions = {
  'flow-done'() { const st = step(); if (st.type !== 'work') return; const m = G.moves[st.mi]; recordSet(m.unit === 'seconds' ? (G.timer ? Math.max(0, G.timer.total - G.timer.left) : mid(m)) : mid(m)); G.timer = null; next(); },
  'flow-next'() { G.timer = null; next(); },
  'flow-skip'() { G.timer = null; next(); },
  'flow-back'() {
    G.timer = null; prev();
    // Round 4 (2.5): Back undoes the set you go back to (its effort tap and reps)
    const st = step();
    if (G.band && st.type === 'work') { const r = G.results[st.mi]; r.sets[st.set - 1] = null; r.rir[st.set - 1] = null; rerender(); }
  },
  /** Round 4 (2.5): one tap says how many more you could have done, and completes the set. */
  'flow-effort'(el) {
    const st = step(); if (st.type !== 'work') return;
    const r = G.results[st.mi], m = G.moves[st.mi], v = +el.dataset.v;
    const reps = r.sets[st.set - 1] != null ? r.sets[st.set - 1] : r.target;
    r.sets[st.set - 1] = reps; r.rir[st.set - 1] = v; r.picked = true;
    r.target = Math.max(m.low, Math.min(m.high, reps + (v >= 3 ? 2 : (v === 0 ? -1 : 0))));
    G.timer = null; next();
  },
  'band-pick'(el) { const st = step(); const r = G.results[st.mi]; r.band = el.dataset.k; r.picked = true; rerender(); },
  'flow-band'() {
    const st = step(); if (st.type !== 'work') return;
    const m = G.moves[st.mi], r = G.results[st.mi], lad = ladderOf(m);
    openSheet({ title: 'Which band?', body: `<div class="inset">${lad.map((s) => `<button type="button" class="row" data-act="band-set" data-k="${esc(s.key)}">${bandChip(s).replace('class="bandchip"', 'class="bandchip bare"')}<span class="row-main"></span>${s.key === r.band ? icon('check', 'ic-s t-accent') : ''}</button>`).join('')}</div><p class="caption">Stack bands to go heavier. The app remembers this band for next time.</p>` });
  },
  'band-set'(el) { const st = step(); G.results[st.mi].band = el.dataset.k; closeSheet(); rerender(); },
  'flow-reps'() {
    const st = step(); const m = G.moves[st.mi], r = G.results[st.mi];
    const cur = r.sets[st.set - 1] != null ? r.sets[st.set - 1] : r.target;
    const opts = []; for (let n = Math.max(1, m.low - 4); n <= m.high + 5; n++) opts.push([n, String(n)]);
    openSheet({ title: 'How many reps?', body: picks(opts, 'reps-set', cur, { label: 'Reps' }) });
  },
  'reps-set'(el) { const st = step(); const r = G.results[st.mi]; r.target = +el.dataset.v; if (r.sets[st.set - 1] != null) r.sets[st.set - 1] = +el.dataset.v; closeSheet(); rerender(); },
  'base-chip'(el) { G.base[el.dataset.k] = el.dataset.v; rerender(); },
  'flow-pause'() {
    if (G.pausedAt) {
      const pausedFor = Date.now() - G.pausedAt;
      G.pausedMs += pausedFor; G.pausedAt = 0;
      if (G.timer) { G.timer.endsAt += pausedFor; G.timer.paused = false; loop(); }
      Voice.resume();
    } else { G.pausedAt = Date.now(); if (G.timer) G.timer.paused = true; Voice.pause(); }
    rerender();
  },
  'flow-hurts'() {
    const st = step();
    if (st.type === 'warm' || st.type === 'cool') { toast('Skip that one. If the pain continues, stop and check with a doctor.', { icon: 'shield', ms: 6000 }); say(SP.skip); G.timer = null; next(); return; }
    if (st.type !== 'work') return;
    const m = G.moves[st.mi];
    G.results[st.mi].pain = true;
    const ex = S.exercise(m.exerciseId);
    const safer = ex && ex.saferId ? S.exercise(ex.saferId) : null;
    S.write('swap', { pattern: m.pattern, from: m.exerciseId, to: safer ? safer.id : null });
    toast(safer ? 'Stopped. Next time: ' + safer.name + '. If the pain continues, check with a doctor.' : 'Stopped. We\'ll skip it from now on.', { icon: 'shield', ms: 6000 });
    say(SP.stop);
    G.timer = null;
    while (G.i < G.steps.length - 1 && ((step().type === 'work' && step().mi === st.mi) || (step().type === 'rest' && step().nextMi === st.mi))) G.i++;
    enter();
  },
  'flow-voice'() { G.voice = !G.voice; S.setUi('flowVoice', G.voice); if (!G.voice) Voice.stop(); rerender(); },
  'flow-video'(el) {
    const ex = el.dataset.id ? S.exercise(el.dataset.id) : null;
    const routine = !ex && el.dataset.vid ? [K.WARMUP, K.COOLDOWN].find((r) => r.video && r.video.id === el.dataset.vid) : null;
    const v = ex ? ex.video : (routine ? routine.video : null);
    if (!v) return;
    const title = ex ? ex.name : routine.title;
    if (G && G.timer && !G.pausedAt) actions['flow-pause']();
    Voice.stop();
    openSheet({ title, body: videoFrame(v.id, title) + `${v.channel ? `<p class="caption">Video: ${esc(v.channel)}</p>` : ''}` });
  },
  'flow-end'() {
    if (elapsed() < 60) { stop(); go('plan', { replace: true }); return; }
    openSheet({ title: 'End the workout?', body: `<p class="sub">The sets you did are saved.</p>${primary('End workout', 'flow-end-yes')}${textBtn('Keep going', 'sheet-close', {}, { cls: 'block' })}` });
  },
  'flow-end-yes'() {
    closeSheet();
    const op = save();
    stop();
    go('plan', { replace: true });
    if (op) logged(op, 'Saved the sets you did.');
  },
  'flow-close'() { stop(); go('plan', { replace: true }); },
  'flow-feel'(el) { G.feel = el.dataset.v; document.querySelectorAll('[data-act="flow-feel"]').forEach((b) => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); },
  'flow-finish'() {
    const op = save();
    stop();
    pulse();
    go('summary', { replace: true });
    if (op) logged(op, 'Workout saved.');
  },
  'video-play'(el) { el.outerHTML = videoFrame(el.dataset.vid, el.dataset.title); },
  'open-move'(el) { closeSheet(); setTimeout(() => moveSheet(el.dataset.id), 0); },
  'moves-sheet'() { movesSheet(); },
  'level-set'(el) { S.write('setLevel', { pattern: el.dataset.p, level: +el.dataset.l, reason: 'Chose this level' }); closeSheet(); toast('Level updated.'); }
};
export { reduceMotion };
