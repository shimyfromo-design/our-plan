/* The workout flow (D9): full screen, no tab bar. Warm-up → each set (rest between) → cool-down → done.
 * The media card shows the still of the move's verified form video; "Watch form" plays the video itself. */
import { L, K, esc, icon, toast, openSheet, closeSheet, keepAwake, dayName } from '../core.js';
import { S } from '../store.js';
import { go, rerender } from '../nav.js';
import { primary, textBtn, iconBtn, ring, setRing, videoFrame, videoStill, still, row } from '../ui.js';
import * as Voice from '../voice.js';
import { logged, tipOnce, reduceMotion } from '../fx.js';
import { pulse } from './summary.js';

let G = null, raf = 0, clockTimer = null;
const fmt = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
const fmtSec = (s) => String(Math.max(0, Math.round(s))); // rings show seconds ("60 seconds", never "1:00 seconds")
/** One cue line: the first sentence (the full how-to is in the move detail). */
const cueLine = (t) => { const x = String(t || '').trim(); const m = /^(.+?[.!?])(s|$)/.exec(x); return (m ? m[1] : x).replace(/!/g, '.'); };
const target = (m) => (m.unit === 'seconds' ? m.low + '–' + m.high + ' seconds' : m.low + '–' + m.high + (m.perSide ? ' each side' : ''));
const mid = (m) => Math.round((m.low + m.high) / 2);

function voiceOn() { return !!(G && G.voice); }
function say(t) { if (voiceOn()) Voice.say(t, { cache: true }); }

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
  G = { plan, moves, steps, i: 0, started: Date.now(), pausedMs: 0, pausedAt: 0, voice: S.ui.flowVoice !== false, results: moves.map((m) => ({ move: m, sets: [], pain: false })), timer: null, feel: '', saved: false };
  keepAwake(true);
  if (G.voice) Voice.prefetch(['3', '2', '1', 'Rest.', 'Workout complete. Nice work.'].concat(moves.map((m) => m.name + '.')));
  enter();
  return true;
}
const step = () => G.steps[G.i];
function elapsed() { return Math.max(0, Math.round(((G.pausedAt || Date.now()) - G.started - G.pausedMs) / 1000)); }

function enter() {
  cancelAnimationFrame(raf);
  G.timer = null;
  const st = step();
  if (st.type === 'warm' || st.type === 'cool') { say(st.name + '. ' + st.cue); startTimer(st.seconds, () => next()); }
  else if (st.type === 'rest') { say('Rest.'); startTimer(st.seconds, () => next()); }
  else if (st.type === 'work') {
    const m = G.moves[st.mi];
    const ex = S.exercise(m.exerciseId) || {};
    say(st.set === 1 ? m.name + '. ' + (ex.cue || '') : 'Set ' + st.set + '. ' + m.name + '.');
    if (m.unit === 'seconds') startTimer(mid(m), () => { recordSet(mid(m)); next(); }, 4);
  } else if (st.type === 'done') { keepAwake(false); say('Workout complete. Nice work.'); }
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
      if (left !== t.left) { t.left = left; if (left >= 1 && left <= 3 && !t.said[left] && voiceOn()) { t.said[left] = 1; Voice.beep('tick'); Voice.say(String(left), { cache: true, cue: true }); } }
      setRing('flow-ring', Math.min(1, ms / 1000 / Math.max(1, t.total)), fmtSec(Math.min(t.total, left)));
      paintProgress();
      if (ms <= 0) { if (voiceOn()) Voice.beep('go'); const cb = t.onDone; G.timer = null; if (cb) cb(); return; }
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
}
function recordSet(v) { const st = step(); if (st && st.type === 'work') G.results[st.mi].sets[st.set - 1] = v; }
function next() { if (G.i < G.steps.length - 1) { G.i++; enter(); } }
function prev() { if (G.i > 0) { G.i--; while (G.i > 0 && step().type === 'rest') G.i--; enter(); } }
function moveIndexOf(st) { return st.type === 'work' ? st.mi : (st.type === 'rest' ? st.nextMi : (st.type === 'cool' || st.type === 'done' ? G.moves.length : -1)); }
function paintProgress() {
  const segs = document.querySelectorAll('.flow-prog u');
  if (!segs.length || !G) return;
  const st = step();
  G.moves.forEach((m, i) => {
    const done = G.results[i].sets.filter((x) => x != null).length;
    let f = Math.min(1, done / m.sets);
    if (st.type === 'work' && st.mi === i && G.timer && G.moves[i].unit === 'seconds') f = Math.min(1, (done + (1 - G.timer.left / Math.max(1, G.timer.total))) / m.sets);
    if (segs[i]) segs[i].style.width = (f * 100).toFixed(1) + '%';
  });
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
    <div class="flow-prog" aria-hidden="true">${G.moves.map(() => '<i><u></u></i>').join('')}</div>`;
  let body = '';
  const t = G.timer;
  const pauseLabel = G.pausedAt ? 'Resume' : 'Pause';
  if (st.type === 'work') {
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
    body = `<div class="eyebrow act">${st.type === 'warm' ? 'Warm-up' : 'Cool-down'} · ${st.n} of ${st.of}</div><h1 class="move-name">${esc(st.name)}</h1><p class="move-cue">${esc(cueLine(st.cue))}</p>
      ${ring('flow-ring', t ? t.left / Math.max(1, t.total) : 1, fmtSec(t ? Math.min(t.total, t.left) : st.seconds), 'seconds')}
      <div class="flow-actions">${primary('Next', 'flow-next')}<div class="btn-row">${G.i > 0 ? textBtn('Back', 'flow-back') : ''}${textBtn(pauseLabel, 'flow-pause')}${textBtn('This hurts', 'flow-hurts')}</div></div>`;
  }
  return `<div class="flow">${top}${body}</div>`;
}
function firstWork() { return 0; }
function media(name, pic, exId) {
  if (!pic) return `<div class="media plain"><b>${esc(name)}</b></div>`;
  return `<button type="button" class="media" data-act="flow-video" data-id="${esc(exId)}" aria-label="Watch the form video for ${esc(name)}"><img src="${esc(pic)}" alt="" data-name="${esc(name)}"><span class="play">${icon('play')}</span><span class="watch">${icon('play')}Watch form</span></button>`;
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
  const felt = G.feel || 'ok';
  const sets = [];
  G.results.forEach((r) => r.sets.forEach((v, i) => {
    if (v == null) return;
    const m = r.move;
    sets.push({ exerciseId: m.exerciseId, pattern: m.pattern, level: m.level, setNo: i + 1, reps: m.unit === 'seconds' ? null : v, seconds: m.unit === 'seconds' ? v : null, felt, pain: !!r.pain });
  }));
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
  'flow-back'() { G.timer = null; prev(); },
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
    if (st.type === 'warm' || st.type === 'cool') { toast('Skip that one. If the pain continues, stop and check with a doctor.', { icon: 'shield', ms: 6000 }); say('Skip that one.'); G.timer = null; next(); return; }
    if (st.type !== 'work') return;
    const m = G.moves[st.mi];
    G.results[st.mi].pain = true;
    const ex = S.exercise(m.exerciseId);
    const safer = ex && ex.saferId ? S.exercise(ex.saferId) : null;
    S.write('swap', { pattern: m.pattern, from: m.exerciseId, to: safer ? safer.id : null });
    toast(safer ? 'Stopped. Next time: ' + safer.name + '. If the pain continues, check with a doctor.' : 'Stopped. We\'ll skip it from now on.', { icon: 'shield', ms: 6000 });
    say('Stop that one.');
    G.timer = null;
    while (G.i < G.steps.length - 1 && ((step().type === 'work' && step().mi === st.mi) || (step().type === 'rest' && step().nextMi === st.mi))) G.i++;
    enter();
  },
  'flow-voice'() { G.voice = !G.voice; S.setUi('flowVoice', G.voice); if (!G.voice) Voice.stop(); rerender(); },
  'flow-video'(el) {
    const ex = S.exercise(el.dataset.id);
    if (!ex || !ex.video) return;
    if (G && G.timer && !G.pausedAt) actions['flow-pause']();
    Voice.stop();
    openSheet({ title: ex.name, body: videoFrame(ex.video.id, ex.name) + `${ex.video.channel ? `<p class="caption">Video: ${esc(ex.video.channel)}</p>` : ''}` });
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
    Voice.confirm(K.SAY.yes);
    if (op) logged(op, 'Workout saved.');
  },
  'video-play'(el) { el.outerHTML = videoFrame(el.dataset.vid, el.dataset.title); },
  'open-move'(el) { closeSheet(); setTimeout(() => moveSheet(el.dataset.id), 0); },
  'moves-sheet'() { movesSheet(); },
  'level-set'(el) { S.write('setLevel', { pattern: el.dataset.p, level: +el.dataset.l, reason: 'Chose this level' }); closeSheet(); toast('Level updated.'); }
};
export { reduceMotion };
