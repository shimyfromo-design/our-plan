/*
 * Our Plan — Round 4 shared pure logic (extends OurPlanLogic; no I/O, no clocks).
 * Runs unchanged in the browser (after logic.js and content.js), in Apps Script (concatenated into Code.gs after them)
 * and in Node tests (require('./logic4.js') returns the extended logic object).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(require('./logic.js'), require('./content.js')); }
  else { factory(root.OurPlanLogic, root.OurPlanContent); }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (L, K) {
  'use strict';

  // ------------------------------------------------------------- 1.1 one bubble per message
  // A plate photo's answer was saved as "plate" and "photo"; the phone's own copy of an exchange (u<cid>, c<cid>) could sit
  // next to the saved rows after a sync. Same person, same kind of answer, same text within 2 minutes = one bubble.
  var KIND_GROUP = { plate: 'photo' };
  function dedupeMessages(thread) {
    var out = [], saved = {};
    (thread || []).forEach(function (m) { if (m && m.cid) saved[String(m.cid).replace(/^r:/, '')] = true; });
    (thread || []).forEach(function (m) {
      if (!m) return;
      var local = /^[uc](m[0-9a-z]+)$/.exec(String(m.id || ''));
      if (local && saved[local[1]]) return; // the saved rows for this exchange are already here
      var kind = KIND_GROUP[m.kind] || m.kind, t = Date.parse(m.ts) || 0, text = String(m.text || '').trim();
      var dup = text && out.some(function (x) {
        return (x.userId || '') === (m.userId || '') && x.role === m.role && (KIND_GROUP[x.kind] || x.kind) === kind && String(x.text || '').trim() === text && Math.abs((Date.parse(x.ts) || 0) - t) <= 120000;
      });
      if (!dup) out.push(m);
    });
    return out;
  }

  // ------------------------------------------------------------- 2.1 the band ladder
  function cap1(s) { s = String(s || '').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : ''; }
  function tubesOf(eq) {
    eq = eq || K.EQUIPMENT_DEFAULT;
    return (eq.tubes || []).filter(function (t) { return t && cap1(t.color) && +t.lb > 0; }).map(function (t) { return { color: cap1(t.color), lb: +t.lb }; })
      .sort(function (a, b) { return a.lb - b.lb; });
  }
  function stepOf(bands) {
    bands = bands.slice().sort(function (a, b) { return b.lb - a.lb; });
    var lb = bands.reduce(function (s, b) { return s + b.lb; }, 0);
    var colors = bands.map(function (b) { return b.color; });
    var short = colors.map(function (c) { return c.toLowerCase(); }).join(' + ');
    return { key: colors.join('+').toLowerCase(), lb: lb, colors: colors, short: short, label: cap1(short) + (bands.length > 1 ? '' : ' band') + ' · ' + lb + ' lb', name: short + ' · ' + lb + ' lb' };
  }
  /**
   * Single bands by pounds, then stacks for the totals no single band gives, one smallest band apart, up to 100 lb.
   * A two-band stack leaves out the lightest band when it can, then uses the heaviest band; three bands only when no pair
   * makes the total (heaviest first). WHATAFIT: 10 … 50, black + blue 60, red + blue 70, red + green 80, red + black 90,
   * red + black + yellow 100.
   */
  function bandLadder(eq) {
    var tubes = tubesOf(eq), steps = [], seen = {};
    if (!tubes.length) return steps;
    tubes.forEach(function (t) { if (!seen[t.lb]) { seen[t.lb] = 1; steps.push(stepOf([t])); } });
    var unit = tubes[0].lb, total = tubes.reduce(function (s, t) { return s + t.lb; }, 0), lightest = tubes[0];
    for (var T = tubes[tubes.length - 1].lb + unit; T <= Math.min(100, total); T += unit) {
      if (seen[T]) continue;
      var pairs = [];
      for (var i = 0; i < tubes.length; i++) for (var j = i + 1; j < tubes.length; j++) if (tubes[i].lb + tubes[j].lb === T) pairs.push([tubes[j], tubes[i]]);
      pairs.sort(function (a, b) { var la = a[1] === lightest ? 1 : 0, lb2 = b[1] === lightest ? 1 : 0; return la - lb2 || b[0].lb - a[0].lb; });
      var pick = pairs[0];
      if (!pick) { // three bands, heaviest first
        var left = T, used = [];
        tubes.slice().reverse().forEach(function (t) { if (used.length < 3 && t.lb <= left) { used.push(t); left -= t.lb; } });
        if (!left) pick = used;
      }
      if (pick) { seen[T] = 1; steps.push(stepOf(pick)); }
    }
    return steps;
  }
  function loopLadder(eq) {
    return ((eq || K.EQUIPMENT_DEFAULT).loops || ['Light', 'Medium', 'Heavy']).filter(Boolean).map(function (n, i) { n = cap1(n); return { key: 'loop:' + n.toLowerCase(), lb: 0, rank: i, colors: [n], short: n.toLowerCase() + ' loop', label: n + ' loop', name: n.toLowerCase() + ' loop' }; });
  }
  function ladderFor(ex, eq) { return !ex || ex.equipment === 'none' || !ex.equipment ? [] : (ex.equipment === 'loop' ? loopLadder(eq) : bandLadder(eq)); }
  function stepIndex(ladder, key) { for (var i = 0; i < ladder.length; i++) if (ladder[i].key === key) return i; return -1; }
  function startIndex(ex, ladder) {
    if (!ladder.length) return -1;
    if (ex.equipment === 'loop') { var m = stepIndex(ladder, 'loop:' + String(K.BAND_START.loop).toLowerCase()); return m >= 0 ? m : Math.min(1, ladder.length - 1); }
    var lb = K.BAND_START[ex.id] || 20, best = 0;
    ladder.forEach(function (s, i) { if (s.lb <= lb) best = i; });
    return best;
  }

  // ------------------------------------------------------------- 2.6 the next step
  var TOP_REPS = 15, LOW_REPS = 8;
  /** The sessions of one move, oldest first: [{ date, workoutId, band, sets: [{ reps, seconds, rir, pain }] }] */
  function moveSessions(sets, exerciseId) {
    var by = {}, order = [];
    (sets || []).forEach(function (s) {
      if (s.exerciseId !== exerciseId) return;
      var k = s.workoutId || s.date;
      if (!by[k]) { by[k] = { date: s.date, workoutId: k, band: s.band || '', sets: [] }; order.push(k); }
      if (s.band) by[k].band = s.band;
      by[k].sets.push({ reps: +s.reps || 0, seconds: +s.seconds || 0, rir: s.rir === '' || s.rir == null ? null : +s.rir, pain: L.truthy(s.pain), setNo: +s.setNo || 0 });
    });
    return order.map(function (k) { return by[k]; }).sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
  }
  /**
   * Per move, the last two sessions: both at the top of the range (15) with 3+ left on every set → one step up; both with a
   * set under 8 or nothing left on every set → one step down. Never more than one step a week per move.
   * opts: { date, holdUp (no step up: a sore back's two pain-free weeks), maxLb }
   */
  function bandNext(sets, exerciseId, ladder, opts) {
    opts = opts || {};
    var list = moveSessions(sets, exerciseId).filter(function (s) { return s.band; });
    if (list.length < 2) return { action: 'none' };
    var a = list[list.length - 2], b = list[list.length - 1];
    if (a.band !== b.band && opts.date && L.daysBetween(b.date, opts.date) < 7) return { action: 'none', reason: 'changed this week' };
    if (a.band !== b.band) return { action: 'none' }; // a new band needs two sessions of its own
    var idx = stepIndex(ladder, b.band);
    if (idx < 0) return { action: 'none' };
    var easy = function (s) { return s.sets.length && s.sets.every(function (x) { return x.reps >= TOP_REPS && x.rir != null && x.rir >= 3; }); };
    var hard = function (s) { return s.sets.length && (s.sets.some(function (x) { return x.reps > 0 && x.reps < LOW_REPS; }) || s.sets.every(function (x) { return x.rir === 0; })); };
    if (easy(a) && easy(b) && idx < ladder.length - 1 && !opts.holdUp && !(opts.maxLb && ladder[idx + 1].lb > opts.maxLb)) return { action: 'up', from: ladder[idx], to: ladder[idx + 1] };
    if (hard(a) && hard(b) && idx > 0) return { action: 'down', from: ladder[idx], to: ladder[idx - 1] };
    return { action: 'none' };
  }

  // ------------------------------------------------------------- 2.7 ready score, 2.8 the nursing-safe phase, 2.9 injuries
  /** Under 6 hours of sleep last night or low energy this morning → a lighter day (never a harder one). */
  function readyScore(o) {
    o = o || {};
    if (o.off) return { lighter: false, off: true };
    var h = o.sleepHours == null || o.sleepHours === '' ? null : +o.sleepHours, e = o.energy == null || o.energy === '' ? null : +o.energy;
    var lowSleep = h != null && h > 0 && h < 6, lowEnergy = e != null && e <= 2;
    return { lighter: lowSleep || lowEnergy, hours: h, lowSleep: lowSleep, lowEnergy: lowEnergy,
      note: lowSleep ? 'Short night (' + fmtH(h) + '), so today is lighter.' : (lowEnergy ? 'Low energy this morning, so today is lighter.' : '') };
  }
  function fmtH(h) { var r = Math.round(h * 2) / 2; return (r % 1 ? String(r).replace('.5', '½') : String(r)) + ' h'; }
  var INJURY_KEYS = ['knees', 'back', 'shoulders', 'wrists', 'neck'];
  var INJURY_LABELS = { knees: 'Knees', back: 'Lower back', shoulders: 'Shoulders', wrists: 'Wrists', neck: 'Neck' };
  function injuryKeys(list) {
    var t = [].concat(list || []).join(' ').toLowerCase(), out = [];
    if (/knee/.test(t)) out.push('knees');
    if (/back/.test(t)) out.push('back');
    if (/shoulder/.test(t)) out.push('shoulders');
    if (/wrist/.test(t)) out.push('wrists');
    if (/neck/.test(t)) out.push('neck');
    return out;
  }
  /** Nursing-safe: base phase until the doctor or midwife OK and two weeks after it (+1 week per "yes" chip). */
  function trainingPhase(o) {
    o = o || {};
    if (!o.safe) return 'full';
    if (o.doctorOk !== 'yes' || !o.okDate) return 'base';
    var end = L.addDays(o.okDate, 14 + 7 * (+o.extend || 0));
    if (o.date < end) return 'base';
    return o.gentle === false ? 'full' : 'gentle';
  }

  // ------------------------------------------------------------- 2.3 sessions
  var BAND_ORDER = ['squat', 'pull', 'push', 'hinge', 'press', 'core', 'glutes'];
  var BAND_PICK = { squat: 'band_squat', pull: 'pull_2', push: 'band_chest_press', hinge: 'band_rdl', press: 'band_ohp' };
  var BASE_MOVES = ['base_breathing', 'heel_slides', 'glute_bridge_band', 'core_2', 'core_1', 'clamshell', 'push_1', 'core_3'];
  var GENTLE_MAX_LB = 30;
  /**
   * The band program's strength day. ctx: { version 10|20|30, exercises, equipment, sets (history), sessionNo, injuries
   * (keys), injuriesSince, date, phase, ready: readyScore(), painDates: { exerciseId: date } }.
   */
  function bandSession(ctx) {
    var lib = ctx.exercises || K.EXERCISES, byId = {};
    lib.forEach(function (e) { byId[e.id] = e; });
    var version = [10, 20, 30].indexOf(+ctx.version) >= 0 ? +ctx.version : 20;
    var inj = ctx.injuries || [], has = function (k) { return inj.indexOf(k) >= 0; };
    var phase = ctx.phase || 'full', ready = ctx.ready || {}, n = +ctx.sessionNo || 0;
    var specs = [];
    if (phase === 'base') {
      var bsets = version >= 20 ? 2 : 1;
      BASE_MOVES.forEach(function (id) { if (byId[id]) specs.push({ id: id, sets: bsets }); });
    } else {
      var sets = version === 10 ? 1 : (version === 30 ? 3 : 2);
      var neckFresh = has('neck') && ctx.injuriesSince && ctx.date && L.daysBetween(ctx.injuriesSince, ctx.date) < 14;
      BAND_ORDER.forEach(function (p) {
        if (version === 10 && p === 'press') return;
        var id = BAND_PICK[p];
        if (p === 'core') id = has('back') || n % 2 ? 'core_1' : 'pallof';
        if (p === 'glutes') id = has('knees') || n % 2 === 0 ? 'glute_bridge_band' : 'lateral_walk';
        if (p === 'push' && has('wrists')) id = 'push_1';
        if (p === 'press' && (has('shoulders') || neckFresh)) id = version === 30 ? null : 'band_pull_apart';
        if (id && byId[id]) specs.push({ id: id, sets: sets });
      });
      if (version === 30) {
        specs.push({ id: 'band_pull_apart', sets: 2 });
        specs.push({ id: phase === 'gentle' ? 'core_3' : 'core_4', sets: 2 });
      }
    }
    var lad = { band: bandLadder(ctx.equipment), loop: loopLadder(ctx.equipment) };
    var moves = specs.map(function (sp) {
      var ex = byId[sp.id];
      var ladder = ex.equipment === 'loop' ? lad.loop : (ex.equipment === 'band' ? lad.band : []);
      var hist = moveSessions(ctx.sets, ex.id);
      var last = hist[hist.length - 1] || null;
      var idx = -1, change = null;
      if (ladder.length) {
        idx = last && last.band ? stepIndex(ladder, last.band) : -1;
        if (idx < 0) idx = startIndex(ex, ladder);
        var painRecent = ctx.painDates && ctx.painDates[ex.id] && ctx.date && L.daysBetween(ctx.painDates[ex.id], ctx.date) < 14;
        var backHold = ex.id === 'band_rdl' && has('back') && ((ctx.injuriesSince && ctx.date && L.daysBetween(ctx.injuriesSince, ctx.date) < 14) || painRecent);
        var maxLb = phase === 'gentle' ? GENTLE_MAX_LB : (ex.pattern === 'hinge' && has('back') ? GENTLE_MAX_LB : 0);
        change = bandNext(ctx.sets, ex.id, ladder, { date: ctx.date, holdUp: backHold, maxLb: maxLb });
        if (change.action === 'up') idx = Math.min(ladder.length - 1, idx + 1);
        if (change.action === 'down') idx = Math.max(0, idx - 1);
        if (!last && phase === 'gentle') idx = Math.max(0, idx - 1); // gentle phase, first time on a move: one step lighter
        if (maxLb) while (idx > 0 && ladder[idx].lb > maxLb) idx--;
        if (ready.lighter) idx = Math.max(0, idx - 1);
      }
      var lastSet = last ? last.sets[last.sets.length - 1] : null;
      // 2.3: every band move works in 8–15 reps a set
      var lo = ladder.length && ex.unit === 'reps' ? LOW_REPS : ex.low, hi = ladder.length && ex.unit === 'reps' ? TOP_REPS : ex.high;
      var target = ex.unit === 'seconds' ? Math.round((ex.low + ex.high) / 2) : Math.min(hi, Math.max(lo, 10));
      if (lastSet && ex.unit !== 'seconds' && !ex.base) {
        target = lastSet.reps || target;
        if (change && change.action === 'up') target = LOW_REPS;
        else if (change && change.action === 'down') target = 12;
        else target = Math.min(TOP_REPS, target + (lastSet.rir >= 3 ? 2 : (lastSet.rir >= 1 ? 1 : 0)));
        target = Math.max(lo, Math.min(hi, target));
      }
      var setsN = ready.lighter ? Math.max(1, sp.sets - 1) : sp.sets;
      var note = ex.anchor === 'chest' ? (ex.id === 'band_chest_press' && has('shoulders') ? 'Door anchor low' : 'Door anchor at chest height') : '';
      if (ex.id === 'band_squat' && has('knees')) note = 'To a chair, box depth';
      if (ex.id === 'pull_2' && has('wrists')) note = (note ? note + ' · ' : '') + 'Straight wrists';
      return {
        exerciseId: ex.id, pattern: ex.pattern, level: ex.level, name: ex.name, sets: setsN, unit: ex.unit || 'reps', low: lo, high: hi, perSide: !!ex.perSide,
        rest: ex.unit === 'seconds' || phase === 'base' ? 45 : (version === 30 ? 75 : 60), equipment: ex.equipment || 'none',
        band: idx >= 0 ? ladder[idx] : null, target: target, note: note, change: change && change.action !== 'none' ? { action: change.action, to: change.to.key } : null,
        lastTime: lastSet && (lastSet.reps || lastSet.seconds) ? (ex.unit === 'seconds' ? lastSet.seconds + ' seconds' : lastSet.reps + (last.band ? ' on ' + stepShort(last.band, ladder) : '')) : ''
      };
    });
    return { version: version, type: 'strength', band: true, phase: phase, lighter: !!ready.lighter, moves: moves, warmupMinutes: version >= 20 ? 3 : 2, cooldownMinutes: version >= 30 ? 3 : 2 };
  }
  function stepShort(key, ladder) { var i = stepIndex(ladder || [], key); return i >= 0 ? ladder[i].short : String(key || '').replace(/\+/g, ' + ').replace(/^loop:/, '') + (/^loop:/.test(key) ? ' loop' : ''); }

  /** The inputs the band program needs, from the logs (the app and the back office both call this). */
  function bandInputs(o) {
    var s = o.settings || {}, p = o.profile || {};
    var sets = (o.sets || []).filter(function (x) { return !o.since || x.date >= o.since; });
    var sessions = {};
    sets.forEach(function (x) { if (x.band) sessions[x.workoutId || x.date] = 1; });
    var painDates = {};
    sets.forEach(function (x) { if (L.truthy(x.pain) && (!painDates[x.exerciseId] || x.date > painDates[x.exerciseId])) painDates[x.exerciseId] = x.date; });
    var gentle = s.keep_gentle == null ? true : !!s.keep_gentle;
    return {
      on: s.band_program !== false, equipment: s.equipment || null, injuries: injuryKeys(p.injuries), injuriesSince: p.injuries_since || '',
      sessionNo: Object.keys(sessions).length, painDates: painDates,
      phase: trainingPhase({ safe: !!o.safe, doctorOk: s.doctor_ok && s.doctor_ok.answer, okDate: s.doctor_ok && s.doctor_ok.date, extend: s.base_extend || 0, gentle: gentle, date: o.date }),
      ready: readyScore({ sleepHours: o.sleepHours, energy: o.energy, off: s.ready_off === o.date }),
      sets: sets
    };
  }
  /** Round 4 wraps the one day plan: a strength day becomes the band program (light days and walks unchanged). */
  var baseTodayPlan = L.todayPlan, basePlanKey = L.planKey;
  function planKey4(ctx) {
    var b = ctx.band;
    if (!b || !b.on) return basePlanKey(ctx);
    return basePlanKey(ctx) + JSON.stringify(['b', b.equipment, b.injuries, b.injuriesSince, b.sessionNo, b.phase, b.ready && b.ready.lighter, (b.sets || []).length, b.sets && b.sets.length ? b.sets[b.sets.length - 1].date : '']);
  }
  function todayPlan4(ctx) {
    var plan = baseTodayPlan(ctx);
    var b = ctx.band;
    if (b && b.on && plan.workout.kind === 'strength') {
      var sess = bandSession({ version: plan.workout.minutes, exercises: ctx.exercises, equipment: b.equipment, sets: b.sets, sessionNo: b.sessionNo, injuries: b.injuries, injuriesSince: b.injuriesSince, date: ctx.date, phase: b.phase, ready: b.ready, painDates: b.painDates });
      var w = plan.workout;
      w.moves = sess.moves; w.band = true; w.phase = sess.phase; w.lighter = sess.lighter; w.readyNote = b.ready && b.ready.lighter ? b.ready.note : '';
      w.warmup = sess.warmupMinutes; w.cooldown = sess.cooldownMinutes;
      w.title = sess.phase === 'base' ? 'Gentle start' : 'Full body · bands';
      var names = sess.moves.map(function (m) { return m.name.replace(/^Band /, '').replace(/^Breathing and pelvic floor$/, 'Breathing'); });
      var lc = names.map(function (x, i) { return i ? x.charAt(0).toLowerCase() + x.slice(1) : x.charAt(0).toUpperCase() + x.slice(1); });
      w.line = lc.length <= 2 ? lc.join(' and ') : lc[0] + ', ' + lc[1] + ' and ' + lc[2] + (lc.length > 3 ? ' and ' + (lc.length - 3) + ' more' : '');
      if (lc.length > 3) w.line = lc[0] + ', ' + lc[1] + ', ' + lc[2] + ' and ' + (lc.length - 3) + ' more';
      w.where = sess.moves.length + ' moves at home with your bands.';
    }
    plan.key = planKey4(ctx);
    return plan;
  }

  // ------------------------------------------------------------- 2.10 active minutes, 2.12 new bests
  /** The weekly goal: 150 rising 10% a week (to the nearest 5) up to 250; nursing-safe 150, no rise while "Keep it gentle". */
  function weeklyGoal(o) {
    o = o || {};
    var g = o.setting || {};
    if (g.fixed) return +g.fixed;
    var base = +g.base || 150, start = g.start || o.date, top = +g.top || 250;
    if (o.gentle || g.rise === false) return base;
    var weeks = Math.max(0, Math.floor(L.daysBetween(L.weekStart(start), L.weekStart(o.date)) / 7));
    return Math.min(top, Math.max(base, Math.round(base * Math.pow(1.1, weeks) / 5) * 5));
  }
  /** Sunday–Shabbos: workouts and walks, plus steps above 3,000 a day at 100 a minute (60 a day at most), as walking. */
  function activeWeek(o) {
    var ws = L.weekStart(o.date), days = L.dateRange(ws, L.addDays(ws, 6));
    var logged = 0, fromSteps = 0, walkBy = {};
    (o.workouts || []).forEach(function (w) { if (w.date >= ws && w.date <= o.date) { logged += +w.minutes || +w.version || 0; if (w.kind === 'walk') walkBy[w.date] = (walkBy[w.date] || 0) + (+w.minutes || 0); } });
    var stepsBy = {};
    (o.steps || []).forEach(function (s) { if (s.date >= ws && s.date <= o.date) stepsBy[s.date] = Math.max(stepsBy[s.date] || 0, +s.steps || 0); });
    days.forEach(function (d) { var m = Math.min(60, Math.max(0, Math.floor(((stepsBy[d] || 0) - 3000) / 100))); fromSteps += Math.max(0, m - (walkBy[d] || 0)); });
    var goal = +o.goal || 150, elapsed = L.daysBetween(ws, o.date) + 1;
    var minutes = logged + fromSteps;
    return { minutes: minutes, logged: logged, fromSteps: fromSteps, goal: goal, pct: Math.min(1, minutes / Math.max(1, goal)), behind: minutes < goal * elapsed / 7, daysElapsed: elapsed };
  }
  /** New bests per move: the heaviest step, then the most reps on it; timed moves by seconds. */
  function bestOf(sets, exerciseId, ladder) {
    var best = null;
    (sets || []).forEach(function (s) {
      if (s.exerciseId !== exerciseId) return;
      var lb = s.band ? (function () { var i = stepIndex(ladder || [], s.band); return i >= 0 ? (ladder[i].lb || i) : 0; })() : 0;
      var v = { lb: lb, reps: +s.reps || 0, seconds: +s.seconds || 0, band: s.band || '' };
      if (!best || v.lb > best.lb || (v.lb === best.lb && (v.reps > best.reps || v.seconds > best.seconds))) best = v;
    });
    return best;
  }
  function newBests(before, session, ladderOf) {
    var out = [], seen = {};
    (session || []).forEach(function (s) {
      if (seen[s.exerciseId]) return; seen[s.exerciseId] = 1;
      var lad = ladderOf ? ladderOf(s.exerciseId) : [];
      var now = bestOf(session, s.exerciseId, lad), was = bestOf(before, s.exerciseId, lad);
      if (!now || !(now.reps || now.seconds)) return;
      if (!was) return; // the first time isn't a "best", it's a start
      if (now.lb > was.lb || (now.lb === was.lb && (now.reps > was.reps || now.seconds > was.seconds))) out.push({ exerciseId: s.exerciseId, best: now, text: now.seconds && !now.reps ? fmtSecs(now.seconds) : now.reps + (now.band ? ' on ' + stepShort(now.band, lad) : '') });
    });
    return out;
  }
  function fmtSecs(s) { s = Math.round(+s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  // ------------------------------------------------------------- section 3: the week's plan (rules checked in code)
  var MEAT_RE = /\b(chicken|beef|steak|turkey|meat|brisket|lamb|veal|schnitzel|cholent|meatballs?|burgers?|cheeseburgers?|salami|pastrami|deli|flanken|shawarma|london broil|liver|kishke|hot dogs?)\b/i;
  var DAIRY_RE = /\b(cheeses?|cheeseburgers?|milk|butter|yogurt|yoghurt|feta|mozzarella|parmesan|ricotta|labneh|latte|kefir|whey|cream|ziti|lasagna|pizza)\b/i;
  var PAREVE_LIKE = /\b(peanut|almond|cashew|sunflower|apple|cocoa|shea|nut|coconut|oat|soy|rice) (butter|milk|cream)\b|\bbutter (lettuce|beans?)\b|\bbutternut\b|\bcream of tartar\b|\bpareve (cream|milk|cheese)\b/gi;
  var FISH_RE = /\b(salmon|tuna|fish|tilapia|cod|sardines?|herring|gefilte|trout|flounder|sole|halibut|lox)\b/i;
  var VEG_RE = /\b(salad|broccoli|spinach|carrots?|zucchini|peppers?|cauliflower|green beans|cabbage|slaw|cucumbers?|tomato(es)?|kale|lettuce|romaine|greens|asparagus|eggplant|mushrooms?|squash|vegetables?|veggies?|beets?|celery|peas|brussels|sweet potato(es)?|parsnips?|leeks?|onions?)\b/i;
  var PERISHABLE_RE = /\b(spinach|baby spinach|berries|mixed greens|lettuce|romaine|salmon|fish|cilantro|parsley|dill|mushrooms?|peppers?|avocados?|zucchini)\b/i;
  var MEAL_SLOTS = ['breakfast', 'lunch', 'dinner'];
  var DEFAULT_TIMES = { breakfast: '07:30', lunch: '12:30', dinner: '18:30' };
  function textOf(slot, recipe) { return [slot && slot.text, recipe && recipe.title, recipe && (recipe.ing || []).map(function (i) { return i[1]; }).join(' '), slot && (slot.ing || []).map(function (i) { return i[1] || i; }).join(' ')].filter(Boolean).join(' '); }
  /** A meal's kind: the recipe's, the slot's, or from its words (meat > dairy > fish > pareve). */
  function kindOf(slot, recipe) {
    if (recipe && recipe.kind) return recipe.kind;
    if (slot && slot.kind && /^(meat|dairy|pareve|fish)$/.test(slot.kind)) return slot.kind;
    var t = String(textOf(slot, recipe)).replace(PAREVE_LIKE, ' ');
    return MEAT_RE.test(t) ? 'meat' : (DAIRY_RE.test(t) ? 'dairy' : (FISH_RE.test(t) ? 'fish' : 'pareve'));
  }
  /** Meat with dairy, or meat with fish, in one meal. */
  function mixes(slot, recipe) {
    var t = String(textOf(slot, recipe)).replace(PAREVE_LIKE, ' ');
    var k = kindOf(slot, recipe);
    var meat = MEAT_RE.test(t) || k === 'meat', dairy = DAIRY_RE.test(t) || k === 'dairy', fish = FISH_RE.test(t) || k === 'fish';
    return (meat && dairy) || (meat && fish);
  }
  /** About how much protein a serving gives (the recipe's own number, else from its ingredients). The coach's estimate. */
  var PROTEIN_PER = [[/chicken|turkey|beef|steak|brisket|flanken|london broil|lamb|veal|meat/, 'lb', 95], [/salmon|fish|cod|tilapia|trout|halibut/, 'lb', 90], [/tuna/, 'can', 25],
    [/eggs?\b/, 'count', 6], [/greek yogurt|yogurt/, 'cup', 20], [/cottage cheese/, 'cup', 25], [/feta|cheese|mozzarella/, 'oz', 6], [/lentils/, 'cup', 18], [/chickpeas|beans/, 'can', 20], [/tofu/, 'lb', 36], [/milk/, 'cup', 8], [/oats/, 'cup', 10]];
  function proteinOf(recipe) {
    if (!recipe) return 0;
    if (+recipe.proteinG > 0) return +recipe.proteinG;
    var total = 0;
    (recipe.ing || []).forEach(function (i) {
      var item = String(i[1] || '').toLowerCase(), q = L.parseQty(i[0] || '') || {};
      var each = /^(\d+(?:\.\d+)?)\s*\(\s*(\d+(?:\.\d+)?)(?:\s*[–-]\s*\d+(?:\.\d+)?)?\s*(lb|oz)/.exec(String(i[0] || '')); // "4 (6 oz)", "1 (4–5 lb)"
      if (each) q = { n: +each[1] * +each[2], unit: each[3] };
      PROTEIN_PER.some(function (p) {
        if (!p[0].test(item)) return false;
        var n = +q.n || 1, u = String(q.unit || '');
        if (p[1] === 'lb') total += (u === 'oz' ? n / 16 : (u === 'lb' ? n : (/\((\d+(?:\.\d+)?) ?(lb|oz)/.test(i[0]) ? n * 0.5 : n * 0.4))) * p[2];
        else if (p[1] === 'cup') total += (u === 'cup' ? n : (u === 'tub' ? n * 3 : n)) * p[2];
        else if (p[1] === 'oz') total += (u === 'oz' ? n : n * 4) * p[2];
        else total += n * p[2];
        return true;
      });
    });
    return Math.round(total / Math.max(1, +recipe.serves || 4));
  }
  function minutesOf(slot, recipe) { return +(slot && slot.minutes) || +(recipe && recipe.minutes) || 0; }
  /**
   * Day kinds from the calendar: fast (no meals, a break-fast supper), erev (a light supper), yomtov and shabbat
   * (Shabbos-style meals), normal. days: the calendar map; date: ISO.
   */
  function dayKind(days, date) {
    var d = L.calDay(days, date);
    if (d.isFast) return 'fast';
    if (L.weekday(date) === 6) return 'shabbat';
    if (d.isYomTov) return 'yomtov';
    if (d.isErev || L.weekday(date) === 5) return 'erev';
    return 'normal';
  }
  function slotLabel(date, meal) { return L.WEEKDAYS[L.weekday(date)] + ' ' + (meal === 'dinner' ? 'supper' : meal); }
  /**
   * 3.4: every rule, in code, never trusted to the model. plan: { days: [{ date, breakfast, lunch, dinner }] };
   * ctx: { recipes (by id), days (calendar), mealTimes, gapHours, never (ids), recent (id → last week used, from the last
   * 2 weeks), locked (previous locked slots: "date:meal" → slot), quick (dates), gentleText (no weight-loss words) }.
   * Returns [{ date, meal, rule, text }].
   */
  function validateWeek(plan, ctx) {
    var errs = [], byId = ctx.recipes || {}, times = ctx.mealTimes || DEFAULT_TIMES, gap = (+ctx.gapHours || 6) * 60;
    var cooked = {}; // slot key → cooked earlier this week (for leftovers)
    var used = {};
    var push = function (date, meal, rule, text) { errs.push({ date: date, meal: meal, rule: rule, text: text }); };
    (plan.days || []).slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).forEach(function (day) {
      var dk = dayKind(ctx.days, day.date);
      var meatAt = null;
      MEAL_SLOTS.forEach(function (m) {
        var s = day[m] || {}, key = day.date + ':' + m, r = s.recipe_id ? byId[s.recipe_id] : null;
        var lock = ctx.locked && ctx.locked[key];
        if (lock && (s.recipe_id || null) !== (lock.recipe_id || null) && String(s.text || '') !== String(lock.text || '')) push(day.date, m, 'locked', slotLabel(day.date, m) + ' is locked and must stay "' + lock.text + '".');
        if (s.recipe_id && !r) push(day.date, m, 'unknown', slotLabel(day.date, m) + ' uses a recipe id that isn\'t in the library.');
        var kind = kindOf(s, r);
        if (s.kind && !/^(meat|dairy|pareve|fish)$/.test(s.kind)) push(day.date, m, 'kind', slotLabel(day.date, m) + ' has no valid kind.');
        if (mixes(s, r)) push(day.date, m, 'mix', slotLabel(day.date, m) + ' mixes meat with dairy or fish.');
        if (dk === 'fast' && m !== 'dinner' && (s.recipe_id || (s.text && !/^fast/i.test(s.text)))) push(day.date, m, 'fast', slotLabel(day.date, m) + ' is a fast: no meal.');
        if (r && (ctx.never || []).indexOf(r.id) >= 0) push(day.date, m, 'never', slotLabel(day.date, m) + ': "' + r.title + '" was marked Never again.');
        if (r && ctx.recent && ctx.recent[r.id] && !lock) push(day.date, m, 'repeat', slotLabel(day.date, m) + ': "' + r.title + '" was in the last two weeks.');
        if (r && used[r.id] && !s.leftoverOf && !lock && m !== 'breakfast') push(day.date, m, 'twice', slotLabel(day.date, m) + ': "' + r.title + '" is already this week.');
        if (m === 'dinner' && (ctx.quick || []).indexOf(day.date) >= 0 && !s.leftoverOf && !s.freezer && minutesOf(s, r) > 25) push(day.date, m, 'quick', slotLabel(day.date, m) + ' is a busy night: 25 minutes or less.');
        // erev Shabbos or Yom Tov: supper is the Shabbos or Yom Tov meal; the day's lunch stays light
        if (m === 'lunch' && dk === 'erev' && minutesOf(s, r) > 30 && !s.leftoverOf) push(day.date, m, 'erev', slotLabel(day.date, m) + ' is erev Shabbos or Yom Tov: keep lunch light.');
        if (s.leftoverOf) { if (!cooked[s.leftoverOf]) push(day.date, m, 'leftover', slotLabel(day.date, m) + ' is a leftover of a meal not cooked earlier this week.'); }
        else if (s.recipe_id || s.text) cooked[key] = true;
        if (r) used[r.id] = true;
        var t = L.hmToMin(times[m] || DEFAULT_TIMES[m]);
        if (kind === 'meat') meatAt = t;
        // the wait counts from the end of the meat meal (30 minutes after it starts)
        if (kind === 'dairy' && meatAt != null && t - meatAt < gap + 30) push(day.date, m, 'gap', slotLabel(day.date, m) + ' is dairy within ' + (gap / 60) + ' hours of a meat meal that day.');
        if (ctx.gentleText && /\b(lose|losing|loss|deficit|diet|cut calories|slim)\b/i.test(String(s.text || '') + ' ' + String(s.girlsNote || ''))) push(day.date, m, 'gentle', slotLabel(day.date, m) + ' talks about weight loss.');
      });
    });
    return errs;
  }
  /** What the week gives: protein days on target (both), vegetables at every supper, perishables used first. */
  function weekChecks(plan, ctx) {
    var byId = ctx.recipes || {}, targets = ctx.proteinTargets || [], out = { proteinDays: 0, days: 0, vegSuppers: 0, suppers: 0, usesFirst: [] };
    (plan.days || []).forEach(function (day) {
      if (dayKind(ctx.days, day.date) === 'fast') return;
      out.days++;
      var g = 0;
      MEAL_SLOTS.forEach(function (m) { var s = day[m] || {}; var r = s.recipe_id ? byId[s.recipe_id] : null; g += s.leftoverOf ? proteinOf(byId[(lookupSlot(plan, s.leftoverOf) || {}).recipe_id]) : (r ? proteinOf(r) : (+s.proteinG || 0)); });
      if (targets.every(function (t) { return g >= 0.6 * t; })) out.proteinDays++;
      var sup = day.dinner || {};
      if (sup.recipe_id || sup.text) { out.suppers++; if (VEG_RE.test(textOf(sup, sup.recipe_id ? byId[sup.recipe_id] : null))) out.vegSuppers++; }
    });
    var first = {};
    (plan.days || []).slice(0, 3).forEach(function (day) { MEAL_SLOTS.forEach(function (m) { var s = day[m] || {}, r = s.recipe_id ? byId[s.recipe_id] : null; (r ? r.ing || [] : []).forEach(function (i) { var mm = PERISHABLE_RE.exec(String(i[1] || '')); if (mm) first[mm[1].toLowerCase().replace(/^baby /, '')] = 1; }); }); });
    out.usesFirst = (plan.usesFirst && plan.usesFirst.length ? plan.usesFirst : Object.keys(first)).slice(0, 3);
    return out;
  }
  function lookupSlot(plan, key) { var p = String(key || '').split(':'); var d = (plan.days || []).filter(function (x) { return x.date === p[0]; })[0]; return d ? d[p[1]] : null; }
  /**
   * The rule-based week (no AI, $0): used when the coach's draft fails twice, for the failing slots only, and by the
   * simulator. ctx as validateWeek plus { weekStart, library (array), freezer [{id,name}], lunchesOut (dates), seed }.
   */
  function ruleWeek(ctx) {
    var lib = (ctx.library || []).filter(function (r) { return r.status !== 'proposed' && (ctx.never || []).indexOf(r.id) < 0; });
    var by = function (meal) { return lib.filter(function (r) { return r.meal === meal; }); };
    var dinners = by('dinner').filter(function (r) { return !(ctx.recent || {})[r.id]; });
    if (dinners.length < 4) dinners = by('dinner');
    var breakfasts = by('breakfast'), lunches = by('lunch');
    var n = +ctx.seed || 0, out = [], freezer = (ctx.freezer || []).slice();
    for (var i = 0; i < 7; i++) {
      var d = L.addDays(ctx.weekStart, i), dk = dayKind(ctx.days, d), quick = (ctx.quick || []).indexOf(d) >= 0;
      var day = { date: d };
      if (dk === 'fast') { day.breakfast = { recipe_id: null, text: 'Fast day', kind: 'pareve' }; day.lunch = { recipe_id: null, text: 'Fast day', kind: 'pareve' }; day.dinner = { recipe_id: 'r_lentil_soup', text: 'Break the fast: water, lentil soup and eggs', kind: 'pareve' }; }
      else if (dk === 'shabbat' || dk === 'yomtov') { day.breakfast = { recipe_id: null, text: 'Kiddush: protein and salad first', kind: 'pareve' }; day.lunch = { recipe_id: 'r_lighter_cholent', text: 'Lighter cholent, salads', kind: 'meat' }; day.dinner = { recipe_id: 'r_steak_salad', text: 'Seudah shlishis: salads, eggs, leftover chicken', kind: 'meat' }; }
      else {
        var bf = breakfasts[(n + i) % Math.max(1, breakfasts.length)];
        day.breakfast = bf ? { recipe_id: bf.id, text: bf.title, kind: bf.kind } : { recipe_id: null, text: 'Eggs and toast', kind: 'pareve' };
        var lu = (ctx.lunchesOut || []).indexOf(d) >= 0 ? (lib.filter(function (r) { return r.id === 'r_tuna_wraps'; })[0] || lunches[0]) : lunches[(n + i) % Math.max(1, lunches.length)];
        if (i > 0 && out[i - 1].dinner && out[i - 1].dinner.recipe_id && dk !== 'erev') day.lunch = { recipe_id: null, text: (byIdTitle(lib, out[i - 1].dinner.recipe_id) || 'Supper') + ', leftovers', leftoverOf: out[i - 1].date + ':dinner', kind: out[i - 1].dinner.kind };
        else day.lunch = lu ? { recipe_id: lu.id, text: lu.title, kind: lu.kind } : { recipe_id: null, text: 'Salad bowl with eggs', kind: 'pareve' };
        if (dk === 'erev') day.dinner = { recipe_id: 'r_roast_chicken', text: 'Chicken soup, roast chicken, salads', kind: 'meat' };
        else if (quick && freezer.length) { var f = freezer.shift(); day.dinner = { recipe_id: f.recipe_id || null, text: 'Freezer: ' + f.name, kind: f.kind || 'meat', freezer: f.id, minutes: 15 }; }
        else {
          var pool = quick ? dinners.filter(function (r) { return +r.minutes <= 25; }) : dinners;
          var di = pool[(n * 3 + i) % Math.max(1, pool.length)];
          day.dinner = di ? { recipe_id: di.id, text: di.title, kind: di.kind, minutes: di.minutes } : { recipe_id: null, text: 'Eggs and salad', kind: 'pareve', minutes: 15 };
        }
        // never dairy within the gap after a meat lunch
        if (day.lunch.kind === 'meat' && day.dinner.kind === 'dairy') { var alt = dinners.filter(function (r) { return r.kind !== 'dairy' && (!quick || +r.minutes <= 25); })[0]; if (alt) day.dinner = { recipe_id: alt.id, text: alt.title, kind: alt.kind, minutes: alt.minutes }; }
      }
      out.push(day);
    }
    return { days: out };
  }
  function byIdTitle(lib, id) { var r = lib.filter(function (x) { return x.id === id; })[0]; return r ? r.title : ''; }
  /** A supper changed: the meals planned as its leftovers follow it (not the locked ones). Returns the changed slot keys. */
  function followLeftovers(plan, date, lib) {
    var key = date + ':dinner', sup = lookupSlot(plan, key), moved = [];
    (plan.days || []).forEach(function (d) {
      MEAL_SLOTS.forEach(function (m) {
        var s = d[m];
        if (!s || s.leftoverOf !== key || s.locked) return;
        if (!sup || (!sup.text && !sup.recipe_id)) d[m] = { recipe_id: null, text: 'Salad bowl with eggs', kind: 'pareve' };
        else d[m] = { recipe_id: null, text: ((sup.recipe_id && byIdTitle(lib || [], sup.recipe_id)) || String(sup.text || 'Supper').replace(/^Freezer: /, '')) + ', leftovers', leftoverOf: key, kind: sup.kind || 'pareve' };
        moved.push(d.date + ':' + m);
      });
    });
    return moved;
  }

  // ------------------------------------------------------------- section 4: recipes (import, typed, changes) and 6.3 timers
  function decodeHtml(s) { return String(s || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&rsquo;|&#8217;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&frac12;/g, '½').replace(/&frac14;/g, '¼').replace(/&frac34;/g, '¾').replace(/&#(\d+);/g, function (m, n) { return String.fromCharCode(+n); }).replace(/\s+/g, ' ').trim(); }
  /** "PT1H10M" → 70 */
  function isoMinutes(d) { var m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(String(d || '')); return m ? (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0; }
  /** schema.org Recipe JSON-LD in a page (no AI, $0) → { title, minutes, serves, ingredients[], steps[] } or null. */
  function parseJsonLd(html) {
    var re = /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi, m, found = null;
    var walk = function (o) {
      if (!o || found) return;
      if (Array.isArray(o)) { o.forEach(walk); return; }
      if (typeof o !== 'object') return;
      var t = o['@type'];
      if (t === 'Recipe' || (Array.isArray(t) && t.indexOf('Recipe') >= 0)) { found = o; return; }
      if (o['@graph']) walk(o['@graph']);
      if (o.mainEntity) walk(o.mainEntity);
    };
    while ((m = re.exec(String(html || ''))) && !found) { try { walk(JSON.parse(m[1].trim())); } catch (e) { /* a broken block: next */ } }
    if (!found) return null;
    var steps = [];
    var addStep = function (s) {
      if (!s) return;
      if (typeof s === 'string') { String(s).split(/\n+/).forEach(function (x) { x = decodeHtml(x); if (x) steps.push(x); }); return; }
      if (Array.isArray(s)) { s.forEach(addStep); return; }
      if (s['@type'] === 'HowToSection') { addStep(s.itemListElement); return; }
      if (s.text) steps.push(decodeHtml(s.text)); else if (s.name) steps.push(decodeHtml(s.name));
    };
    addStep(found.recipeInstructions);
    var y = found.recipeYield; if (Array.isArray(y)) y = y[0];
    return {
      title: decodeHtml(found.name || ''), minutes: isoMinutes(found.totalTime) || (isoMinutes(found.prepTime) + isoMinutes(found.cookTime)) || 0,
      serves: parseInt(String(y || '').replace(/[^\d]/g, ''), 10) || 0,
      ingredients: [].concat(found.recipeIngredient || found.ingredients || []).map(decodeHtml).filter(Boolean),
      steps: steps.filter(Boolean)
    };
  }
  /** Typed in: the first line is the title; "Ingredients" / "Steps" headings (or a blank line) split the rest. */
  function parseTypedRecipe(text) {
    var lines = String(text || '').replace(/\r/g, '').split('\n').map(function (l) { return l.trim(); });
    while (lines.length && !lines[0]) lines.shift();
    if (!lines.length) return null;
    var title = lines.shift().replace(/^title:\s*/i, ''), ing = [], steps = [], part = 'ing', sawBlank = false;
    lines.forEach(function (l) {
      if (!l) { if (ing.length) sawBlank = true; return; }
      if (/^(ingredients?)\s*:?$/i.test(l)) { part = 'ing'; return; }
      if (/^(steps?|directions?|method|instructions?|preparation)\s*:?$/i.test(l)) { part = 'steps'; return; }
      if (part === 'ing' && sawBlank && (/^\d+[.)]\s/.test(l) || l.length > 60)) part = 'steps';
      if (part === 'ing') ing.push(l.replace(/^[-•*]\s*/, '')); else steps.push(l.replace(/^(\d+[.)]|step \d+:?)\s*/i, ''));
    });
    var mins = 0, serves = 0;
    var tm = /(\d+)\s*(hours?|hrs?|h)\b(?:\s*(\d+)\s*(min|minutes))?|(\d+)\s*(min|minutes)\b/i.exec(text);
    if (tm) mins = tm[1] ? (+tm[1] * 60 + (+tm[3] || 0)) : +tm[5];
    var sv = /serves\s*(\d+)/i.exec(text); if (sv) serves = +sv[1];
    return { title: title, minutes: mins, serves: serves, ingredients: ing.filter(function (l) { return !/^(serves|prep|cook|total)\b/i.test(l); }), steps: steps };
  }
  var AISLE_SECTION = { 'Produce': 'Produce', 'Meat & fish': 'Meat & poultry', 'Dairy & eggs': 'Dairy & eggs', 'Pantry': 'Pantry', 'Frozen': 'Frozen', 'Other': 'Pantry' };
  /** "2 lb chicken thighs" → ["2 lb", "chicken thighs", "Meat & poultry"] (the recipe's own words kept). */
  function ingredientLine(line) {
    var p = L.parseGroceryInput(String(line || '')) || {};
    var name = p.name || String(line || '');
    var sec = FISH_RE.test(name) ? 'Fish' : (AISLE_SECTION[L.groceryAisle(name, '')] || 'Pantry');
    return [p.qty || '', name, sec];
  }
  /** The import's three checks: its kind (meat and dairy together blocks it), store sizes, timer steps. */
  function recipeChecks(r) {
    var ing = (r.ingredients || []).map(ingredientLine);
    var probe = { text: r.title, ing: ing };
    var mix = mixes(probe, null);
    var kind = kindOf(probe, null);
    var store = L.storeList(ing.map(function (i) { return { item: i[1], qty: i[0], section: i[2] }; })).items;
    return { ing: ing, kind: kind, mixes: mix, storeCount: store.length, store: store, timed: (r.steps || []).filter(function (s) { return stepTimers(s).length; }).length };
  }
  /** 6.3: times in a step ("20 minutes", "1 hour", "8–10 min" → the lower number) → [{ minutes, text }]. */
  function stepTimers(step) {
    var out = [], re = /(\d+(?:\.\d+)?|an?|one|two|three|half an?)(?:\s*(?:–|-|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|minutes?|mins?)\b/gi, m;
    var WORD = { a: 1, an: 1, one: 1, two: 2, three: 3, 'half a': 0.5, 'half an': 0.5 };
    while ((m = re.exec(String(step || '')))) {
      var n = WORD[m[1].toLowerCase()] != null ? WORD[m[1].toLowerCase()] : +m[1];
      var minutes = /^h/i.test(m[3]) ? n * 60 : n;
      if (minutes > 0 && minutes <= 720) out.push({ minutes: Math.round(minutes), text: m[0] });
    }
    return out;
  }
  /** A coach change applied to a copy of the recipe (the phone shows it before anything is saved). */
  function applyChange(recipe, ch) {
    var r = JSON.parse(JSON.stringify(recipe || {}));
    r.ing = (r.ing || []).map(function (i) { return i.slice(); });
    (ch.changedIngredients || []).forEach(function (c) {
      var key = String(c.name || '').toLowerCase();
      var hit = r.ing.filter(function (i) { return String(i[1]).toLowerCase().indexOf(key) >= 0 || key.indexOf(String(i[1]).toLowerCase()) >= 0; })[0];
      if (hit) hit[0] = String(c.to || hit[0]); else r.ing.push([String(c.to || ''), String(c.name || ''), 'Pantry']);
    });
    r.steps = (r.steps || []).slice();
    (ch.changedSteps || []).forEach(function (c) { var n = (+c.no || 0) - 1; if (n >= 0 && n < r.steps.length) r.steps[n] = String(c.to || r.steps[n]); else if (c.to) r.steps.push(String(c.to)); });
    (ch.addedLines || []).forEach(function (l) { if (l) r.ing.push(ingredientLine(l)); });
    if (ch.girlsNote) r.girlsNote = String(ch.girlsNote);
    return r;
  }

  // ------------------------------------------------------------- section 5: the Breadberry order (rules only, $0)
  var DEPTS = ['Produce', 'Butcher', 'Fish', 'Dairy', 'Grocery', 'Household'];
  var HOUSEHOLD_RE = /\b(diapers?|wipes|paper towels?|toilet paper|tissues|foil|plastic wrap|ziploc|bags|dish soap|detergent|sponges?|garbage|trash|napkins|cups|plates|batteries)\b/i;
  var PREP_RE = /\b(pounded thin|pounded|skin ?off|skinless|boneless|thick cut|thin cut|trimmed|ground twice|ground|cubed|cut in \w+|sliced thin|sliced|butterflied|spatchcocked|french(ed)?|bone-in|second cut|first cut)\b/i;
  function deptOf(name, aisle) {
    if (HOUSEHOLD_RE.test(name)) return 'Household';
    if (aisle === 'Produce') return 'Produce';
    if (aisle === 'Meat & fish') return FISH_RE.test(name) ? 'Fish' : 'Butcher';
    if (aisle === 'Dairy & eggs') return 'Dairy';
    return FISH_RE.test(name) && /\b(fillets?|fresh)\b/i.test(name) ? 'Fish' : 'Grocery';
  }
  function words(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 2; }); }
  /** 5.6: a receipt line → the store-list item it is (by shared words), or null. */
  function matchReceipt(line, names) {
    var lw = words(line), best = null, score = 0;
    (names || []).forEach(function (n) {
      var nw = words(n); if (!nw.length) return;
      var hit = nw.filter(function (w) { return lw.some(function (x) { return x === w || x.replace(/s$/, '') === w.replace(/s$/, ''); }); }).length;
      var s = hit / nw.length;
      if (s > score) { score = s; best = n; }
    });
    return score >= 0.5 ? best : null;
  }
  /**
   * The order. o: { grocery: [{ key, section, item, qty, note, checked, have, source, sub, onList }], weekly: [{ item, qty }],
   * missing: [names], butcher: { item: note }, notes: { key: "pounded thin" } (from the recipes), bags: { key: n },
   * learned: { key: { name, price } } (from receipts), sub: 'none'|'similar', sender, walkOrder }.
   * Returns { departments: [{ name, lines: [text] }], text, haves: [names], missing: [names], estimate, count }.
   */
  /** A receipt's item name as order wording: no sizes or pack words (the list's amount follows it), common receipt
   * abbreviations spelled out, capitals only where they belong. "LG EGGS DOZ" → "Large eggs"; "Carrots 1lb bag" → "Carrots".
   * Returns '' when nothing readable is left (the list's own name is used then). */
  var ABBR = { lg: 'large', sm: 'small', med: 'medium', org: 'organic', bnls: 'boneless', sknls: 'skinless', chkn: 'chicken', chk: 'chicken', grnd: 'ground', frz: 'frozen', frzn: 'frozen', wht: 'white', whl: 'whole', ff: 'fat-free', lf: 'low-fat' };
  function cleanStoreName(name) {
    var s = String(name || '').trim();
    if (!s) return '';
    var letters = s.replace(/[^A-Za-z]/g, '');
    if (letters && letters === letters.toUpperCase()) s = s.toLowerCase();
    s = s.replace(/\b\d+(\.\d+)?\s*(fl\.?\s*oz|lbs?|oz|ct|pk|pack|count|doz|dozen|g|kg|ml|l|qt|gal|pt)\b\.?/gi, ' ')
      .replace(/\b(doz|dozen|bag|bags|tub|jar|can|cans|carton|bunch|head|pk|ct|ea|each|x\d+)\b\.?/gi, ' ')
      .replace(/\b[a-z]+\b/gi, function (w) { return ABBR[w.toLowerCase()] || w; })
      .replace(/[\s,.;:-]+$/, '').replace(/^[\s,.;:-]+/, '').replace(/\s+/g, ' ').trim();
    return /[a-z]{3,}/i.test(s) ? L.capItem(s) : '';
  }
  /** "Plain Greek yogurt" → "plain Greek yogurt" (inside a sentence). */
  function lowItem(s) { s = L.capItem(s); return s ? s.charAt(0).toLowerCase() + s.slice(1) : ''; }
  function buildOrder(o) {
    var by = {}, haves = [], lines = 0, est = 0, priced = 0;
    DEPTS.forEach(function (d) { by[d] = []; });
    var seen = {};
    (o.grocery || []).forEach(function (g) {
      if (g.checked === 'removed' || g.section === L.CHECK_AISLE) return;
      if (g.have) { haves.push(g.item); return; }
      var key = g.key || L.groceryKey(g.item);
      if (seen[key]) return; seen[key] = 1;
      var learned = (o.learned || {})[key.replace(/^x_/, '')] || null;
      var name = (learned && cleanStoreName(learned.name)) || g.item;
      var dept = deptOf(g.item, g.section);
      var qty = g.qty ? ' ' + g.qty : '';
      var bits = [];
      var note = (o.notes || {})[key] || '';
      var stand = (o.butcher || {})[Object.keys(o.butcher || {}).filter(function (k) { return L.groceryKey(k) === key.replace(/^x_/, '') || String(g.item).toLowerCase().indexOf(String(k).toLowerCase()) >= 0; })[0]] || '';
      if (dept === 'Butcher' || dept === 'Fish') {
        if (note) bits.push(note);
        if (stand && stand.toLowerCase() !== note.toLowerCase()) bits.push(stand);
        var n = +(o.bags || {})[key] || 0;
        if (n > 1) bits.push('pack in ' + n + ' bags');
      } else if (g.note && !/^or /i.test(g.note) && dept !== 'Produce') bits.push(g.note.toLowerCase());
      var line = name + qty + (bits.length ? ', ' + bits.join(', ') : '');
      if (g.sub && g.sub !== 'none') line += '. If no ' + String(g.item).toLowerCase().split(' ')[0] + ', ' + g.sub + '.';
      else if (g.sub === 'none' && o.sub === 'similar') line += ' (no substitute)';
      by[dept].push({ line: line, key: key, sep: dept === 'Butcher' || dept === 'Fish' || (g.sub && g.sub !== 'none') });
      lines++;
      if (learned && +learned.price > 0) { est += +learned.price * Math.max(1, parseFloat(g.qty) || 1); priced++; }
    });
    (o.weekly || []).forEach(function (w) {
      var key = L.groceryKey(w.item);
      if (!w.item || seen[key]) return; seen[key] = 1;
      // "Diapers size 5", not "Diapers size 5 1": one of an item whose name ends in a number needs no amount
      var wq = String(w.qty || '').trim(), skipQty = !wq || (wq === '1' && /\d\s*$/.test(w.item));
      by[HOUSEHOLD_RE.test(w.item) ? 'Household' : deptOf(w.item, L.groceryAisle(w.item, ''))].push({ line: L.capItem(w.item) + (skipQty ? '' : ' ' + wq) });
      lines++;
    });
    (o.missing || []).forEach(function (m) {
      var key = L.groceryKey(m);
      if (!m || seen[key]) return; seen[key] = 1;
      by[deptOf(m, L.groceryAisle(m, ''))].push({ line: L.capItem(m) });
      lines++;
    });
    var order = (o.walkOrder && o.walkOrder.length ? o.walkOrder : DEPTS).filter(function (d) { return DEPTS.indexOf(d) >= 0; });
    DEPTS.forEach(function (d) { if (order.indexOf(d) < 0) order.push(d); });
    var departments = order.filter(function (d) { return by[d].length; }).map(function (d) {
      return { name: d, items: by[d].map(function (x) { return x.line; }), keys: by[d].map(function (x) { return x.key || ''; }), oneLine: d !== 'Butcher' && d !== 'Fish' && !by[d].some(function (x) { return x.sep; }) };
    });
    var closing = (o.sub === 'similar' ? 'If something\'s out, a similar item is fine.' : 'Please don\'t substitute anything else.') + ' Thank you, ' + (o.sender || '');
    var text = departments.map(function (d) { return d.name + '\n' + (d.oneLine ? d.items.join(' · ') : d.items.join('\n')); }).join('\n\n') + '\n\n' + closing.trim();
    return { departments: departments, text: text, closing: closing.trim(), haves: haves, missing: (o.missing || []).slice(), count: lines, estimate: priced ? Math.round(est) : 0 };
  }
  function waLink(number, text) { return 'https://wa.me/' + String(number || '').replace(/[^\d]/g, '') + '?text=' + encodeURIComponent(text || ''); }
  function mailLink(email, day, text) { return 'mailto:' + encodeURIComponent(email || '').replace(/%40/g, '@') + '?subject=' + encodeURIComponent('Order for ' + day) + '&body=' + encodeURIComponent(text || ''); }
  /** From the week's recipes: prep notes per store item ("pounded thin") and how many meals use it (bags). */
  function orderHints(plan, recipes) {
    var notes = {}, bags = {};
    ((plan && plan.days) || []).forEach(function (d) {
      MEAL_SLOTS.forEach(function (m) {
        var s = d[m]; if (!s || !s.recipe_id || s.leftoverOf || s.freezer) return;
        var r = recipes[s.recipe_id]; if (!r) return;
        var counted = {};
        (r.ing || []).forEach(function (i) {
          L.storeItem(i[1], i[0], i[2]).forEach(function (it) {
            if (!it.key || it.aisle !== 'Meat & fish') return;
            var pm = PREP_RE.exec(String(i[1] || '') + ' ' + String(i[0] || ''));
            if (pm && !notes[it.key] && String(it.name).toLowerCase().indexOf(pm[1].toLowerCase()) < 0) notes[it.key] = pm[1].toLowerCase();
            if (!counted[it.key]) { counted[it.key] = 1; bags[it.key] = (bags[it.key] || 0) + 1 + (s.cookDouble ? 1 : 0); }
          });
        });
      });
    });
    return { notes: notes, bags: bags };
  }

  // ------------------------------------------------------------- section 7: the coach's dates and numbers
  /** 7.2: an off day — a normal day with nothing active and no food logged, or 2+ habits missed with nothing active. */
  function isOffDay(o) {
    if (!o || (o.type && ['shabbat', 'yomtov', 'fast', 'sick', 'rest'].indexOf(o.type) >= 0)) return false;
    var d = o.done || {};
    var active = d.workoutDone || (d.walkMin || 0) > 0 || (d.activityMin || 0) > 0;
    if (active) return false;
    var habits = d.habitCount || 0, protein = d.protein || 0;
    return (!habits && !protein) || habits <= (o.habitTotal || 7) - 2;
  }
  /** 7.3: three weeks with 3+ weigh-ins each and the 21-day trend moving less than 0.3 lb a week. */
  function plateauOf(weights, today) {
    var ws = (weights || []).filter(function (w) { return w && w.date && w.date <= today && w.date > L.addDays(today, -21); });
    for (var k = 0; k < 3; k++) { var a = L.addDays(today, -21 + 7 * k), b = L.addDays(a, 6); if (ws.filter(function (w) { return w.date >= a && w.date <= b; }).length < 3) return { plateau: false, reason: 'weigh-ins' }; }
    var series = L.trendSeries(weights);
    var rate = L.trendRate(series, today, 21);
    if (rate == null) return { plateau: false };
    return { plateau: Math.abs(rate) < 0.3, rate: rate };
  }
  /** 7.5: the pace line, by code. */
  function paceLine(perWeek) {
    var x = Math.abs(+perWeek || 0);
    if (x > 2) return 'faster than we like: tell your doctor';
    if (x >= 0.5) return 'a healthy, steady pace';
    return 'slow and steady is fine';
  }
  /** 7.1: Yom Tov, Chanukah and Purim from the calendar, plus the person's simchas → [{ key, name, date, nights, kind }]. */
  function upcomingEvents(days, from, to, personal) {
    var out = [], seen = {};
    L.dateRange(from, to).forEach(function (d) {
      var x = days && days[d]; if (!x) return;
      (x.events || []).forEach(function (e) {
        var name = null;
        if (/^Chanukah: 1 Candle/.test(e)) name = 'Chanukah';
        else if (/^Purim$/.test(e)) name = 'Purim';
        else if (x.isYomTov) name = String(e).replace(/ (I|II|III|IV|V|VI|VII|VIII|\d)$/, '').replace(/^Erev /, '').trim();
        if (!name || /^(Chanukah|Purim)$/.test(name) === false && !x.isYomTov) return;
        var key = name.toLowerCase().replace(/[^a-z]+/g, '-') + '-' + d.slice(0, 4);
        if (seen[key]) return;
        seen[key] = 1;
        var start = name === 'Chanukah' ? d : d;
        out.push({ key: key, name: name, date: start, kind: name === 'Chanukah' || name === 'Purim' ? name.toLowerCase() : 'yomtov', nights: name === 'Chanukah' ? 8 : 0 });
      });
    });
    (personal || []).forEach(function (e) { if (e && e.date >= from && e.date <= to) out.push({ key: 'event-' + e.id, name: e.kind === 'other' ? (e.note || 'The event') : e.kind.charAt(0).toUpperCase() + e.kind.slice(1), date: e.date, kind: e.kind, note: e.note || '' }); });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
  }
  /** A game plan is made 3 days before (or as soon as possible within those 3 days). */
  function gamePlanDue(ev, today) { var n = L.daysBetween(today, ev.date); return n >= 0 && n <= 3; }
  /** 7.5: the month's numbers, by code. per: { id: { workouts, weights, milestones, sets, photos } }, ratings, month: [from, to]. */
  function monthNumbers(o) {
    var from = o.from, to = o.to, ids = Object.keys(o.per || {});
    var activeDays = {};
    ids.forEach(function (id) { (o.per[id].workouts || []).forEach(function (w) { if (w.date >= from && w.date <= to) (activeDays[w.date] = activeDays[w.date] || {})[id] = 1; }); });
    var both = Object.keys(activeDays).filter(function (d) { return ids.every(function (id) { return activeDays[d][id]; }); }).length;
    var walks = 0, family = 0, bests = 0;
    var people = {};
    ids.forEach(function (id) {
      var p = o.per[id];
      (p.workouts || []).forEach(function (w) { if (w.date >= from && w.date <= to && w.kind === 'walk') { walks++; if (L.truthy(w.family)) family++; } });
      bests += (p.milestones || []).filter(function (m) { return /^pr:/.test(m.key || '') && m.date >= from && m.date <= to; }).length;
      var series = L.trendSeries((p.weights || []).filter(function (w) { return w.date <= to; }));
      var a = L.trendAt(series, from), b = L.trendAt(series, to), start = from;
      if (a == null) { var first = series.filter(function (x) { return x.date >= from && x.date <= to; })[0]; a = first ? first.trend : null; start = first ? first.date : from; }
      var weeks = Math.max(1, L.daysBetween(start, to) / 7);
      var change = a != null && b != null ? Math.round((b - a) * 10) / 10 : null;
      var stronger = [];
      var byEx = {};
      (p.sets || []).filter(function (s) { return s.date >= from && s.date <= to && (s.band || s.reps); }).forEach(function (s) { (byEx[s.exerciseId] = byEx[s.exerciseId] || []).push(s); });
      Object.keys(byEx).forEach(function (ex) {
        var l = byEx[ex].sort(function (x, y) { return x.date < y.date ? -1 : 1; }), f = l[0], z = l[l.length - 1];
        if (f.band && z.band && f.band !== z.band) stronger.push({ exerciseId: ex, text: f.band.replace(/\+/g, ' + ') + ' → ' + z.band.replace(/\+/g, ' + ') });
        else if (+z.reps > +f.reps) stronger.push({ exerciseId: ex, text: f.reps + ' → ' + z.reps + ' reps' });
      });
      people[id] = { change: change, perWeek: change == null ? null : Math.round(change / weeks * 10) / 10, pace: change == null ? '' : paceLine(change / weeks), stronger: stronger.slice(0, 2), photos: (p.photos || []).filter(function (x) { return x.date >= from && x.date <= to; }).sort(function (x, y) { return x.date < y.date ? -1 : 1; }) };
    });
    return { from: from, to: to, bothActiveDays: both, walks: walks, familyWalks: family, bests: bests, people: people, topMeals: (o.loved || []).slice(0, 3) };
  }

  var R4 = {
    dedupeMessages: dedupeMessages,
    isOffDay: isOffDay, plateauOf: plateauOf, paceLine: paceLine, upcomingEvents: upcomingEvents, gamePlanDue: gamePlanDue, monthNumbers: monthNumbers,
    buildOrder: buildOrder, cleanStoreName: cleanStoreName, lowItem: lowItem, waLink: waLink, mailLink: mailLink, orderHints: orderHints, matchReceipt: matchReceipt, deptOf: deptOf, DEPTS: DEPTS,
    isoMinutes: isoMinutes, parseJsonLd: parseJsonLd, parseTypedRecipe: parseTypedRecipe, ingredientLine: ingredientLine, recipeChecks: recipeChecks, stepTimers: stepTimers, applyChange: applyChange, decodeHtml: decodeHtml,
    kindOf: kindOf, mixes: mixes, proteinOf: proteinOf, dayKind: dayKind, validateWeek: validateWeek, weekChecks: weekChecks, ruleWeek: ruleWeek, lookupSlot: lookupSlot, followLeftovers: followLeftovers, VEG_RE: VEG_RE, slotLabel: slotLabel, MEAL_TIMES: DEFAULT_TIMES,
    bandLadder: bandLadder, loopLadder: loopLadder, ladderFor: ladderFor, stepIndex: stepIndex, startIndex: startIndex, stepShort: stepShort,
    moveSessions: moveSessions, bandNext: bandNext, readyScore: readyScore, injuryKeys: injuryKeys, INJURY_KEYS: INJURY_KEYS, INJURY_LABELS: INJURY_LABELS,
    trainingPhase: trainingPhase, bandSession: bandSession, bandInputs: bandInputs, todayPlan: todayPlan4, planKey: planKey4, todayPlanBase: baseTodayPlan,
    weeklyGoal: weeklyGoal, activeWeek: activeWeek, bestOf: bestOf, newBests: newBests, fmtSecs: fmtSecs, GENTLE_MAX_LB: GENTLE_MAX_LB, BASE_MOVES: BASE_MOVES
  };
  Object.keys(R4).forEach(function (k) { L[k] = R4[k]; });
  return L;
});
