/*
 * Our Plan — shared pure logic.
 * Runs unchanged in three places: the browser (window.OurPlanLogic), Google Apps Script
 * (concatenated into Code.gs, global OurPlanLogic) and Node tests (require()).
 * Rules: no I/O, no clocks, no timezone math. Dates are ISO strings "YYYY-MM-DD",
 * times are "HH:MM" (local Brooklyn time) or minutes since midnight.
 */
(function (root, factory) {
  var lib = factory();
  if (typeof module === 'object' && module.exports) { module.exports = lib; }
  else { root.OurPlanLogic = lib; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ---------------------------------------------------------------- dates
  var DAY_MS = 86400000;
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isISODate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
  function parseISO(d) { var p = String(d).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function toISO(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(iso, n) { return toISO(parseISO(iso) + n * DAY_MS); }
  function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / DAY_MS); }
  function weekday(iso) { return new Date(parseISO(iso)).getUTCDay(); } // 0 = Sunday
  function weekStart(iso) { return addDays(iso, -weekday(iso)); }      // weeks run Sunday..Shabbat
  function dateRange(from, to) { var out = []; for (var d = from; d <= to; d = addDays(d, 1)) out.push(d); return out; }
  function hmToMin(hm) { if (!hm) return null; var p = String(hm).split(':'); return (+p[0]) * 60 + (+p[1]); }
  function minToHM(m) { m = ((Math.round(m) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); }
  function fmt12(hmOrMin) {
    var m = typeof hmOrMin === 'number' ? hmOrMin : hmToMin(hmOrMin);
    if (m == null) return '';
    m = ((m % 1440) + 1440) % 1440;
    var h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? 'pm' : 'am';
    h = h % 12; if (h === 0) h = 12;
    return h + ':' + pad(mm) + ' ' + ap;
  }
  var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Shabbat'];
  var WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Shab'];
  function round(n, d) { var f = Math.pow(10, d || 0); return Math.round(n * f) / f; }
  function round5(n) { return Math.max(5, Math.round(n / 5) * 5); }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  // ------------------------------------------------------------- calendar
  /** Parse a Hebcal /hebcal JSON response (with d=on, c=on, maj/min/nx) into a map date -> day info. */
  function parseHebcal(json) {
    var days = {};
    var items = (json && json.items) || [];
    function day(d) {
      if (!days[d]) days[d] = emptyDay(d);
      return days[d];
    }
    items.forEach(function (it) {
      if (!it || !it.date) return;
      var date = String(it.date).slice(0, 10);
      if (!isISODate(date)) return;
      var d = day(date);
      var time = String(it.date).length > 10 ? String(it.date).slice(11, 16) : null;
      var title = String(it.title || '');
      switch (it.category) {
        case 'hebdate':
          d.hebrew = it.hdate || it.title_orig || title;
          d.hebrewHe = it.hebrew || '';
          break;
        case 'candles':
          d.candles = time;
          break;
        case 'havdalah':
          d.havdalah = time;
          break;
        case 'holiday':
          d.events.push(title);
          if (it.hdate && !d.hebrew) d.hebrew = it.hdate;
          if (it.yomtov === true) { d.isYomTov = true; d.holiday = title; }
          if (/CH['’]{2}M/.test(title) || /CH''M/.test(String(it.title_orig || ''))) d.isCholHamoed = true;
          if (title === 'Yom Kippur') { d.isFast = true; d.fastName = title; }
          if (/^Tish.a B.Av$/.test(title)) { d.isFast = true; d.fastName = title; }
          if (it.subcat === 'fast' && !/Bechorot/i.test(title)) { d.isFast = true; d.fastName = title; }
          break;
        case 'zmanim':
          if (it.subcat === 'fast') {
            if (/begins/i.test(title)) d.fastBegins = time;
            else if (/ends/i.test(title)) d.fastEnds = time;
          }
          break;
        case 'roshchodesh':
          d.isRoshChodesh = true;
          if (d.events.indexOf(title) < 0) d.events.push(title);
          break;
        case 'parashat':
          d.parsha = title;
          break;
        default:
          break;
      }
    });
    Object.keys(days).forEach(function (k) { finishDay(days[k]); });
    return days;
  }
  function emptyDay(date) {
    return {
      date: date, hebrew: '', hebrewHe: '', events: [], candles: null, havdalah: null,
      isShabbat: weekday(date) === 6, isYomTov: false, isRest: false, isErev: false,
      isFast: false, fastName: '', fastBegins: null, fastEnds: null,
      isRoshChodesh: false, isCholHamoed: false, parsha: '', holiday: '', known: false
    };
  }
  function finishDay(d) {
    d.isRest = d.isShabbat || d.isYomTov;
    d.isErev = !!d.candles && !d.isRest;
    d.known = true;
    return withRT(d);
  }
  /** A day with no Hebcal data: only the weekday is known. */
  function fallbackDay(date) { var d = emptyDay(date); d.isRest = d.isShabbat; d.known = false; return d; }
  function calDay(days, date) { return (days && days[date]) ? withRT(days[date]) : fallbackDay(date); }

  // ------------------------------------------------ sunset and Rabbeinu Tam (Round 3)
  // Shabbat and Yom Tov end a fixed 72 minutes after sunset. Candle lighting stays Hebcal's
  // (18 minutes before sunset); fast days keep Hebcal's regular nightfall.
  var BROOKLYN = { lat: 40.6501, lon: -73.94958 };
  var RT_MINUTES = 72;
  /** New York's offset from UTC in hours (DST from the 2nd Sunday of March to the 1st Sunday of November). */
  function nyOffset(date) {
    var y = date.slice(0, 4);
    var dstStart = y + '-03-' + pad(8 + (7 - weekday(y + '-03-01')) % 7);
    var dstEnd = y + '-11-' + pad(1 + (7 - weekday(y + '-11-01')) % 7);
    return date >= dstStart && date < dstEnd ? -4 : -5;
  }
  /** Sunset in New York local minutes after midnight (NOAA solar position, standard 0.833° refraction). */
  function sunsetMin(date, place) {
    place = place || BROOKLYN;
    var rad = Math.PI / 180;
    var p = date.split('-'), y = +p[0], m = +p[1], d = +p[2];
    var a = Math.floor((14 - m) / 12), yy = y + 4800 - a, mm = m + 12 * a - 3;
    var jdn = d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
    var t = 1080 - place.lon * 4; // minutes after 0h UTC; refined below
    for (var k = 0; k < 3; k++) {
      var T = (jdn - 0.5 + t / 1440 - 2451545) / 36525;
      var L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
      var M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
      var e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
      var C = Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * rad) * 0.000289;
      var om = 125.04 - 1934.136 * T;
      var lambda = L0 + C - 0.00569 - 0.00478 * Math.sin(om * rad);
      var eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(om * rad);
      var decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad)) / rad;
      var y2 = Math.pow(Math.tan(eps / 2 * rad), 2);
      var eqTime = 4 / rad * (y2 * Math.sin(2 * L0 * rad) - 2 * e * Math.sin(M * rad) + 4 * e * y2 * Math.sin(M * rad) * Math.cos(2 * L0 * rad) - 0.5 * y2 * y2 * Math.sin(4 * L0 * rad) - 1.25 * e * e * Math.sin(2 * M * rad));
      var cosH = (Math.cos(90.833 * rad) - Math.sin(place.lat * rad) * Math.sin(decl * rad)) / (Math.cos(place.lat * rad) * Math.cos(decl * rad));
      t = 720 - 4 * (place.lon - Math.acos(clamp(cosH, -1, 1)) / rad) - eqTime;
    }
    return t + nyOffset(date) * 60;
  }
  function sunsetHM(date) { return minToHM(Math.floor(sunsetMin(date))); }
  /** End of Shabbat / Yom Tov on this date: sunset + 72 minutes, rounded UP so it is never shown early. */
  function rtEnd(date) { return minToHM(Math.ceil(sunsetMin(date) + RT_MINUTES - 1e-9)); }
  /** Rabbeinu Tam times on a parsed day (idempotent): the end of the day, and second-night candles after it. */
  function withRT(d) {
    if (!d || d.rt || !isISODate(d.date)) return d;
    if (d.havdalah) d.havdalah = rtEnd(d.date);
    if (d.candles && (d.isShabbat || d.isYomTov)) d.candles = rtEnd(d.date);
    d.rt = true;
    return d;
  }
  /**
   * The Shabbat / Yom Tov window around a date, for header lines ("Shabbat 6:06 – 7:36", "Shabbat ends 7:36").
   * Returns null when nothing is coming within 6 days. {label, candles, end, endDate, during}
   */
  function restWindow(days, date) {
    var d = calDay(days, date);
    var start = null, i;
    if (d.isRest) { start = date; var back = addDays(date, -1); while (calDay(days, back).isRest && daysBetween(back, date) < 3) { start = back; back = addDays(back, -1); } start = addDays(start, -1); }
    else for (i = 0; i <= 6 && !start; i++) { var c = calDay(days, addDays(date, i)); if (c.isErev && c.candles) start = addDays(date, i); }
    if (!start) return null;
    var erev = calDay(days, start);
    var end = null, endDate = null, yomtov = false;
    for (i = 1; i <= 4; i++) {
      var r = calDay(days, addDays(start, i));
      if (!r.isRest) break;
      if (r.isYomTov) yomtov = true;
      if (r.havdalah) { end = r.havdalah; endDate = r.date; break; }
    }
    if (!end) return null;
    var label = yomtov ? 'Yom Tov' : 'Shabbat';
    return { label: label, candles: erev.candles || null, end: end, endDate: endDate, during: !!d.isRest };
  }

  /**
   * Is it Shabbat/Yom Tov right now (no emails, no nudges, no logging expected)?
   * opts.preMin: quiet starts this many minutes before candle lighting (default 15)
   * opts.postMin: quiet ends this many minutes after havdalah (default 0: havdalah is already sunset + 72)
   */
  function quietState(days, date, minutes, opts) {
    opts = opts || {};
    var pre = opts.preMin == null ? 15 : opts.preMin;
    var post = opts.postMin == null ? 0 : opts.postMin;
    var d = calDay(days, date);
    var wd = weekday(date);
    if (!d.known) {
      // Conservative fallback when the calendar could not be loaded.
      if (wd === 5 && minutes >= 15 * 60 + 30) return { quiet: true, reason: 'shabbat', until: null };
      if (wd === 6 && minutes < 21 * 60 + 45) return { quiet: true, reason: 'shabbat', until: '21:45' };
      return { quiet: false };
    }
    if (d.isRest) {
      var reason = d.isYomTov ? 'yomtov' : 'shabbat';
      if (d.havdalah) {
        var end = hmToMin(d.havdalah) + post;
        if (minutes >= end) return { quiet: false, justEnded: true };
        return { quiet: true, reason: reason, until: minToHM(end) };
      }
      return { quiet: true, reason: reason, until: null };
    }
    if (d.candles) {
      var start = hmToMin(d.candles) - pre;
      if (minutes >= start) {
        var next = calDay(days, addDays(date, 1));
        return { quiet: true, reason: next.isYomTov && !next.isShabbat ? 'yomtov' : 'shabbat', until: null };
      }
    }
    return { quiet: false };
  }

  // ------------------------------------------------------------- day plan
  var DEFAULT_SCHEDULE = { 0: 'strength', 1: 'walk', 2: 'strength', 3: 'walk', 4: 'strength', 5: 'light', 6: 'rest' };
  var NEUTRAL_TYPES = { shabbat: 1, yomtov: 1, fast: 1, sick: 1 };
  var MODE_DAYS = { sick: 3, travel: 7, busy: 7, welcomeback: 7, maintenance: 0 };

  /** mode: {key, since, until} or null. Returns the active mode key for a date, or ''. */
  function activeMode(mode, date) {
    if (!mode || !mode.key) return '';
    if (mode.since && date < mode.since) return '';
    if (mode.until && date > mode.until) return '';
    return mode.key;
  }
  /** Mode history (list of {key, since, until}) -> mode key for a date. Latest entry wins. */
  function modeOn(history, date) {
    var cur = null;
    (history || []).forEach(function (m) { if (m && (!m.since || m.since <= date)) cur = m; });
    return cur ? activeMode(cur, date) : '';
  }
  function modeUntil(key, startDate) {
    var n = MODE_DAYS[key];
    return n ? addDays(startDate, n - 1) : '';
  }

  /** The kind of day: strength | walk | light | rest | shabbat | yomtov | fast | sick */
  function dayType(opts) {
    var date = opts.date;
    var cal = opts.cal || fallbackDay(date);
    if (cal.isShabbat) return 'shabbat';
    if (cal.isYomTov) return 'yomtov';
    if (cal.isFast) return 'fast';
    var m = typeof opts.mode === 'string' ? opts.mode : activeMode(opts.mode, date);
    if (m === 'sick') return 'sick';
    var sched = opts.schedule || DEFAULT_SCHEDULE;
    var t = sched[weekday(date)] || sched[String(weekday(date))] || 'walk';
    if (t === 'rest') return 'rest';
    if (cal.isErev && weekday(date) !== 5 && t === 'strength') return 'light'; // erev Yom Tov: keep it light
    return t;
  }

  /** Is today a weigh-in day? weigh = {mode:'daily'|'weekly', day:3} */
  function isWeighInDay(opts) {
    var type = opts.type;
    if (NEUTRAL_TYPES[type]) return false;
    var weigh = opts.weigh || { mode: 'daily', day: 3 };
    var m = typeof opts.mode === 'string' ? opts.mode : activeMode(opts.mode, opts.date);
    var wmode = m === 'maintenance' ? 'weekly' : (weigh.mode || 'daily');
    if (wmode === 'daily') return true;
    var target = weigh.day == null ? 3 : +weigh.day;
    var wd = weekday(opts.date);
    if (wd === target) return true;
    // If the chosen day was blocked (fast / Yom Tov), weigh in on the next normal day.
    if (opts.days) {
      for (var back = 1; back <= 3; back++) {
        var prev = addDays(opts.date, -back);
        var pc = calDay(opts.days, prev);
        var blocked = pc.isShabbat || pc.isYomTov || pc.isFast;
        if (weekday(prev) === target) return blocked;
        if (!blocked) return false;
      }
    }
    return false;
  }

  /** Weekly aerobic minutes target, rising 15 min/week toward 150, then 10 min/week toward 200. */
  function weeklyWalkTarget(activity, weekIndex) {
    var base = { sitting: 60, some: 90, few: 120, very: 150 }[activity] || 90;
    var t = base;
    for (var i = 0; i < Math.max(0, weekIndex); i++) t += t < 150 ? 15 : (t < 200 ? 10 : 0);
    return Math.min(t, 300);
  }
  var WALK_SHARE = { walk: 0.25, strength: 0.15, light: 0.1, rest: 0.1 };
  function walkMinutesFor(type, weeklyTarget) {
    var share = WALK_SHARE[type];
    if (!share) return 0;
    return clamp(round5(weeklyTarget * share), 10, 60);
  }

  /** Daily step target: base by activity, +500 for each past week that averaged >=90% of its target; cap 10,000. */
  function stepTarget(opts) {
    var base = { sitting: 4000, some: 5500, few: 7000, very: 8500 }[opts.activity] || 5500;
    var start = opts.startDate, today = opts.today;
    if (!start || !today || start >= today) return base;
    var byDate = {};
    (opts.steps || []).forEach(function (s) { byDate[s.date] = +s.steps; });
    var target = base;
    var ws = weekStart(start);
    var thisWeek = weekStart(today);
    while (ws < thisWeek) {
      var vals = [];
      for (var i = 0; i < 7; i++) { var d = addDays(ws, i); if (byDate[d] != null) vals.push(byDate[d]); }
      if (vals.length >= 3) {
        var avg = vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
        if (avg >= 0.9 * target) target = Math.min(10000, target + 500);
      }
      ws = addDays(ws, 7);
    }
    return target;
  }

  /** Coach's pick of session length. */
  function pickVersion(opts) {
    var m = opts.mode || '';
    if (opts.type === 'light') return 10;
    if (m === 'busy' || m === 'travel' || m === 'sick') return 10;
    if (opts.energy != null && opts.energy <= 2) return 10;
    if (opts.pref) return +opts.pref;
    var avail = +opts.minutesAvailable || 20;
    if (avail < 20) return 10;
    if (avail < 30 || (opts.weekIndex || 0) < 2 || m === 'welcomeback') return 20;
    return 30;
  }

  /** Build the plan for a day: type, weigh-in, walk minutes, version and 3 plain lines. */
  function dayPlan(opts) {
    var date = opts.date;
    var cal = opts.cal || calDay(opts.days, date);
    var m = typeof opts.mode === 'string' ? opts.mode : activeMode(opts.mode, date);
    var type = dayType({ date: date, cal: cal, schedule: opts.schedule, mode: m });
    var weigh = isWeighInDay({ date: date, type: type, weigh: opts.weigh, mode: m, days: opts.days });
    var weeklyTarget = weeklyWalkTarget(opts.activity, opts.weekIndex || 0);
    var walkMin = walkMinutesFor(type, weeklyTarget);
    var version = (type === 'strength' || type === 'light')
      ? pickVersion({ type: type, mode: m, energy: opts.energy, pref: opts.versionPref, minutesAvailable: opts.minutesAvailable, weekIndex: opts.weekIndex })
      : 0;
    if (type === 'light') version = 10;
    var tomorrow = calDay(opts.days, addDays(date, 1));
    var yesterday = calDay(opts.days, addDays(date, -1));
    var plan = {
      date: date, type: type, mode: m, weighIn: weigh, walkMinutes: walkMin, weeklyWalkTarget: weeklyTarget,
      version: version, safe: !!opts.safe,
      fastTomorrow: !!tomorrow.isFast && !cal.isFast, afterFast: !!yesterday.isFast && !cal.isFast,
      isErev: !!cal.isErev, candles: cal.candles, havdalah: cal.havdalah, fastName: cal.fastName || tomorrow.fastName || '',
      cholHamoed: !!cal.isCholHamoed, roshChodesh: !!cal.isRoshChodesh,
      erevLabel: weekday(date) === 5 ? 'Erev Shabbat' : 'Erev Yom Tov',
      lines: []
    };
    plan.lines = planLines(plan);
    return plan;
  }

  function planLines(p) {
    var L = [];
    switch (p.type) {
      case 'shabbat':
        return ['Shabbat: a full rest day.', 'No workout, no counting. Eat the meals and enjoy them.', 'Protein first, then don\'t think about it.'];
      case 'yomtov':
        return ['Yom Tov: a full rest day.', 'Enjoy the meals: protein first, then don\'t count.', 'A relaxed family walk is a bonus, not a job.'];
      case 'fast':
        return ['Fast day: workouts are paused.', 'Rest, keep it calm, and skip the scale today.', 'After the fast: water first, then a light meal with protein. Go slow.'];
      case 'sick':
        return ['Sick mode: rest is the plan.', 'Drink fluids and sleep. A gentle walk only if you feel up to it.', 'Your streak is safe.'];
      case 'strength':
        L.push('Strength: ' + p.version + '-minute session' + (p.mode === 'travel' ? ' (hotel-room version)' : '') + '.');
        L.push('Walk ' + p.walkMinutes + ' minutes. Stroller and kids walks count.');
        break;
      case 'walk':
        L.push('Walk day: ' + p.walkMinutes + ' minutes at a pace where you can talk but not sing.');
        L.push('Family moves count: stroller, park, errands on foot.');
        break;
      case 'light':
        L.push((p.isErev ? p.erevLabel : 'Light day') + ': 10 easy minutes plus a short walk.');
        L.push(p.candles ? 'Candle lighting ' + fmt12(p.candles) + '. Log before then, then let it go.' : 'Keep it easy and get ready for Shabbat.');
        break;
      default:
        L.push('Rest day. A short walk if you feel like it.');
        L.push('Hit your food habits and get to bed on time.');
    }
    if (p.fastTomorrow) L.push('Fast tomorrow' + (p.fastName ? ' (' + p.fastName + ')' : '') + ': drink extra water today.');
    else if (p.afterFast) L.push('Day after a fast: go easy, drink well, protein at every meal.');
    else if (p.weighIn) L.push('Weigh in after waking, before eating. Same scale, same time.');
    else L.push('Protein first at every meal; water or seltzer to drink.');
    return L.slice(0, 3);
  }

  // ------------------------------------------------------------ exercises
  var PATTERNS = ['squat', 'push', 'hinge', 'pull', 'core', 'carry', 'calf'];
  var PATTERN_NAMES = { squat: 'Squat', push: 'Push', hinge: 'Hinge', pull: 'Pull / row', core: 'Core', carry: 'Carry', calf: 'Calves' };
  var MAX_BY_ACTIVITY = {
    sitting: { push: 2, squat: 2, hinge: 2, pull: 1, core: 2, carry: 1, calf: 1 },
    some: { push: 3, squat: 3, hinge: 2, pull: 2, core: 3, carry: 1, calf: 1 },
    few: { push: 3, squat: 3, hinge: 3, pull: 2, core: 4, carry: 2, calf: 2 },
    very: { push: 4, squat: 4, hinge: 3, pull: 3, core: 4, carry: 2, calf: 2 }
  };
  /** Week 1 starts one level below the assessed max; safe mode starts everything at level 1. */
  function startingLevels(profile) {
    profile = profile || {};
    var max = MAX_BY_ACTIVITY[profile.activity] || MAX_BY_ACTIVITY.some;
    var lv = {};
    PATTERNS.forEach(function (p) { lv[p] = Math.max(1, max[p] - 1); });
    if (profile.safe) { PATTERNS.forEach(function (p) { lv[p] = 1; }); return lv; }
    var inj = (profile.injuries || []).join(' ').toLowerCase();
    if (/knee/.test(inj)) { lv.squat = 1; lv.hinge = Math.min(lv.hinge, 2); }
    if (/shoulder|wrist/.test(inj)) { lv.push = 1; lv.core = Math.min(lv.core, 2); }
    if (/back/.test(inj)) { lv.hinge = Math.min(lv.hinge, 2); lv.core = Math.min(lv.core, 2); }
    if (/hip/.test(inj)) { lv.squat = Math.min(lv.squat, 2); lv.hinge = Math.min(lv.hinge, 2); }
    if (/ankle|foot|feet/.test(inj)) { lv.calf = 1; lv.carry = 1; }
    return lv;
  }

  function levelsFor(exercises, pattern) {
    return (exercises || []).filter(function (e) { return e.pattern === pattern && e.status !== 'proposed' && e.status !== 'rejected'; })
      .sort(function (a, b) { return a.level - b.level; });
  }
  function exerciseAt(exercises, pattern, level) {
    var list = levelsFor(exercises, pattern);
    if (!list.length) return null;
    var best = list[0];
    list.forEach(function (e) { if (e.level <= level) best = e; });
    return best;
  }
  function maxLevel(exercises, pattern) { var l = levelsFor(exercises, pattern); return l.length ? l[l.length - 1].level : 1; }

  var SESSION_PATTERNS = {
    10: [['squat', 2], ['push', 2], ['hinge', 2]],
    20: [['squat', 2], ['push', 2], ['hinge', 2], ['pull', 2], ['core', 2]],
    30: [['squat', 3], ['push', 3], ['hinge', 3], ['pull', 3], ['core', 2], ['carry', 2], ['calf', 2]]
  };
  var LIGHT_PATTERNS = [['calf', 2], ['core', 2], ['hinge', 2]];

  /** Build today's session from the library and the person's current levels. */
  function buildSession(opts) {
    var version = +opts.version || 20;
    var lib = opts.exercises || [];
    var levels = opts.levels || {};
    var swaps = opts.swaps || {}; // pattern -> exerciseId chosen via "this hurts"
    var spec = opts.type === 'light' ? LIGHT_PATTERNS : (SESSION_PATTERNS[version] || SESSION_PATTERNS[20]);
    var dropOne = opts.type === 'light' || opts.mode === 'welcomeback';
    var moves = [];
    spec.forEach(function (ps) {
      var pattern = ps[0], sets = ps[1];
      var lvl = levels[pattern] || 1;
      if (dropOne) lvl = Math.max(1, lvl - 1);
      var ex = null;
      if (swaps[pattern]) ex = lib.filter(function (e) { return e.id === swaps[pattern]; })[0] || null;
      if (!ex) ex = exerciseAt(lib, pattern, lvl);
      if (!ex) return;
      moves.push({
        exerciseId: ex.id, pattern: pattern, level: ex.level, name: ex.name, sets: sets,
        unit: ex.unit || 'reps', low: ex.low, high: ex.high, perSide: !!ex.perSide,
        rest: ex.unit === 'seconds' ? 45 : 60
      });
    });
    var warm = version >= 20 ? 3 : 2, cool = version >= 30 ? 3 : 2;
    return { version: version, type: opts.type || 'strength', moves: moves, warmupMinutes: warm, cooldownMinutes: cool };
  }

  /**
   * Auto-progression: top of the rep range on every set, without "hard" or pain,
   * two sessions in a row at the current level -> propose the next level. Pain -> propose the safer one.
   * history: [{date, workoutId, exerciseId, level, reps, seconds, felt, pain}]
   */
  function progressionCheck(history, exercise, opts) {
    opts = opts || {};
    if (!exercise) return { action: 'none' };
    var rows = (history || []).filter(function (h) { return h.exerciseId === exercise.id; });
    if (!rows.length) return { action: 'none' };
    var sessions = {};
    rows.forEach(function (r) { var k = r.workoutId || r.date; (sessions[k] = sessions[k] || { date: r.date, sets: [] }).sets.push(r); });
    var list = Object.keys(sessions).map(function (k) { return sessions[k]; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var last = list[list.length - 1];
    if (last.sets.some(function (s) { return truthy(s.pain); })) {
      return { action: 'down', to: exercise.saferId || null, reason: 'pain' };
    }
    if (list.length < 2) return { action: 'none' };
    var recent = list.slice(-2);
    if (opts.snoozedUntil && last.date <= opts.snoozedUntil) return { action: 'none', reason: 'snoozed' };
    var top = +exercise.high;
    var ok = recent.every(function (s) {
      return s.sets.length > 0 && s.sets.every(function (x) {
        var v = exercise.unit === 'seconds' ? +x.seconds : +x.reps;
        return v >= top && x.felt !== 'hard' && !truthy(x.pain);
      });
    });
    if (ok && exercise.harderId) return { action: 'up', to: exercise.harderId, reason: 'top-of-range-twice' };
    return { action: 'none' };
  }
  function truthy(v) { return v === true || v === 'TRUE' || v === 'true' || v === 1 || v === '1' || v === 'yes'; }

  // ------------------------------------------------------------- streaks
  /**
   * Status of one past day for one person.
   * logs: {checkins:[{kind,value}], workouts:[...], walks?}  (all for that date)
   */
  var HABIT_KEYS = ['protein_first', 'water_only', 'veg_dinner', 'three_meals', 'breakfast', 'kitchen_closed', 'planned_nosh'];
  function dayStatus(opts) {
    if (NEUTRAL_TYPES[opts.type]) return 'neutral';
    var c = opts.checkins || [];
    var yes = function (k) { return c.some(function (x) { return x.kind === k && truthy(x.value === 'yes' ? true : x.value); }); };
    // Round 3.2 (E1): a walk or workout counts from its own log row only; the "walk: yes" check-in written alongside it is
    // not a second source, so deleting the walk clears the day everywhere
    if ((opts.workouts || []).length || yes('catchup') || yes('preshabbat')) return 'done';
    var habitYes = c.filter(function (x) { return x.kind && x.kind.indexOf('habit:') === 0 && (x.value === 'yes' || truthy(x.value)); });
    var uniq = {};
    habitYes.forEach(function (x) { uniq[x.kind] = 1; });
    if (Object.keys(uniq).length >= 3) return 'done';
    if (opts.type === 'rest') return 'neutral';
    return 'miss';
  }

  /**
   * "Never miss twice": a single missed day is forgiven (it doesn't count, it doesn't break);
   * two missed days in a row end the streak. Rest days (Shabbat, Yom Tov, fasts, sick) are neutral.
   * statuses: map date -> 'done'|'miss'|'neutral'. today: ISO date (pending if not done yet).
   */
  function computeStreak(statuses, today, opts) {
    opts = opts || {};
    var limit = opts.lookback || 400;
    var count = 0, misses = 0, d = today, i = 0, lastMiss = null;
    var todayStatus = statuses[today];
    if (todayStatus === 'done') count = 1;
    d = addDays(today, -1);
    for (i = 0; i < limit; i++, d = addDays(d, -1)) {
      if (opts.startDate && d < opts.startDate) break;
      var s = statuses[d] || 'miss';
      if (s === 'neutral') continue;
      if (s === 'done') { count++; misses = 0; continue; }
      misses++;
      if (!lastMiss) lastMiss = d;
      if (misses >= 2) break;
    }
    var yesterdayStatus = prevNonNeutral(statuses, today, opts.startDate);
    return {
      current: count,
      missedLast: yesterdayStatus === 'miss',       // the previous real day was a miss: today matters
      todayDone: todayStatus === 'done'
    };
  }
  function prevNonNeutral(statuses, today, startDate) {
    var d = addDays(today, -1);
    for (var i = 0; i < 14; i++, d = addDays(d, -1)) {
      if (startDate && d < startDate) return null;
      var s = statuses[d] || 'miss';
      if (s !== 'neutral') return s;
    }
    return null;
  }
  /** Longest gap of consecutive non-neutral missed days ending yesterday (for "welcome back"). */
  function currentGap(statuses, today, startDate) {
    var gap = 0, d = addDays(today, -1);
    for (var i = 0; i < 60; i++, d = addDays(d, -1)) {
      if (startDate && d < startDate) break;
      var s = statuses[d] || 'miss';
      if (s === 'neutral') continue;
      if (s === 'done') break;
      gap++;
    }
    return gap;
  }

  /**
   * Status map for a date range. Uses the calendar, the schedule and mode history so rest days
   * (Shabbat, Yom Tov, fasts, sick days) are neutral.
   */
  function buildStatuses(opts) {
    var out = {}, types = {};
    var byDate = {};
    (opts.checkins || []).forEach(function (c) { (byDate[c.date] = byDate[c.date] || { c: [], w: [] }).c.push(c); });
    (opts.workouts || []).forEach(function (w) { (byDate[w.date] = byDate[w.date] || { c: [], w: [] }).w.push(w); });
    dateRange(opts.from, opts.to).forEach(function (d) {
      var t = dayType({ date: d, cal: calDay(opts.days, d), schedule: opts.schedule, mode: modeOn(opts.modeHistory, d) });
      types[d] = t;
      var b = byDate[d] || { c: [], w: [] };
      // latest value per kind wins (a later "no" undoes an earlier "yes")
      var latest = {};
      b.c.slice().sort(function (x, y) { return String(x.ts || '') < String(y.ts || '') ? -1 : 1; })
        .forEach(function (x) { latest[x.kind] = x; });
      var cs = Object.keys(latest).map(function (k) { return latest[k]; });
      out[d] = dayStatus({ type: t, checkins: cs, workouts: b.w });
    });
    return { statuses: out, types: types };
  }
  /** Best streak ever (same "never miss twice" rule, single forward pass). */
  function bestStreak(statuses, from, to) {
    var best = 0, count = 0, misses = 0;
    dateRange(from, to).forEach(function (d) {
      var s = statuses[d] || 'miss';
      if (s === 'neutral') return;
      if (s === 'done') { count++; misses = 0; if (count > best) best = count; return; }
      misses++;
      if (misses >= 2) count = 0;
    });
    return best;
  }

  // ------------------------------------------------------------- weight trend
  /** One value per date (the last one logged that day), sorted. */
  function dailyWeights(weights) {
    var by = {};
    (weights || []).forEach(function (w) {
      var v = +w.lbs;
      if (!w.date || !(v > 0)) return;
      if (!by[w.date] || String(w.ts || '') >= String(by[w.date].ts || '')) by[w.date] = { date: w.date, lbs: v, ts: w.ts || '' };
    });
    return Object.keys(by).sort().map(function (k) { return { date: k, lbs: by[k].lbs }; });
  }
  /**
   * 7-day weighted trend: for each weigh-in date, a weighted mean of the raw weigh-ins in the
   * last 7 days (today weight 7, yesterday 6, ... 6 days ago weight 1). Gaps are handled naturally.
   */
  function trendSeries(weights) {
    var pts = dailyWeights(weights);
    return pts.map(function (p, i) {
      var num = 0, den = 0;
      for (var j = i; j >= 0; j--) {
        var age = daysBetween(pts[j].date, p.date);
        if (age > 6) break;
        var w = 7 - age;
        num += w * pts[j].lbs; den += w;
      }
      return { date: p.date, raw: p.lbs, trend: round(num / den, 1) };
    });
  }
  /** Trend value on/before a date. */
  function trendAt(series, date) {
    var v = null;
    (series || []).forEach(function (p) { if (p.date <= date) v = p.trend; });
    return v;
  }
  /** Slope of the trend over the last `days` days, in lbs/week (negative = losing). */
  function trendRate(series, today, days) {
    days = days || 14;
    var from = addDays(today, -days);
    var pts = (series || []).filter(function (p) { return p.date >= from && p.date <= today; });
    if (pts.length < 4 || daysBetween(pts[0].date, pts[pts.length - 1].date) < 7) return null;
    var n = pts.length, sx = 0, sy = 0, sxx = 0, sxy = 0;
    pts.forEach(function (p) { var x = daysBetween(from, p.date), y = p.trend; sx += x; sy += y; sxx += x * x; sxy += x * y; });
    var denom = n * sxx - sx * sx;
    if (!denom) return null;
    return round(((n * sxy - sx * sy) / denom) * 7, 2);
  }
  /** Plateau: trend moved less than 0.5 lb over the last 21+ days with enough weigh-ins. */
  function isPlateau(series, today, opts) {
    opts = opts || {};
    var weeks = opts.weeks || 3;
    var from = addDays(today, -7 * weeks);
    var pts = (series || []).filter(function (p) { return p.date >= from && p.date <= today; });
    if (pts.length < 8) return false;
    if (daysBetween(pts[0].date, pts[pts.length - 1].date) < 7 * weeks - 4) return false;
    var startTrend = pts[0].trend, endTrend = pts[pts.length - 1].trend;
    return Math.abs(startTrend - endTrend) < (opts.threshold || 0.5);
  }
  /** Losing faster than ~2 lb/week sustained over two consecutive weeks. */
  function tooFast(series, today) {
    var r1 = trendRate(series, today, 7 + 7);
    var r2 = trendRate(series, addDays(today, -7), 14);
    return r1 != null && r2 != null && r1 < -2 && r2 < -2;
  }
  function recommendPace(weight) {
    var w = +weight || 0;
    return { low: round(Math.min(2, w * 0.005), 1), high: round(Math.min(2, w * 0.01), 1) };
  }

  // ------------------------------------------------------------- milestones
  var STREAK_MILESTONES = [7, 14, 30, 60, 100, 180, 365];
  /** All milestone keys earned so far (the caller stores new ones once). */
  function earnedMilestones(opts) {
    var out = [];
    var start = +opts.startWeight;
    var series = opts.series || [];
    var cur = series.length ? series[series.length - 1].trend : null;
    if (start > 0 && cur != null && series.length >= 3) {
      var lost = start - cur;
      if (lost >= start * 0.03) out.push({ key: 'loss_3pct', title: 'First 3% of your body weight' });
      if (lost >= start * 0.05) out.push({ key: 'loss_5pct', title: '5% of your body weight — a real health change' });
      if (lost >= start * 0.10) out.push({ key: 'loss_10pct', title: '10% of your body weight' });
      for (var t = 10; t <= lost + 0.0001 && t <= 200; t += 10) out.push({ key: 'loss_' + t + 'lb', title: t + ' pounds down' });
    }
    STREAK_MILESTONES.forEach(function (n) { if ((opts.bestStreak || 0) >= n) out.push({ key: 'streak_' + n, title: n + '-day streak' }); });
    (opts.levelUps || []).forEach(function (p) { out.push({ key: 'levelup_' + p, title: 'First level-up: ' + (PATTERN_NAMES[p] || p) }); });
    if (opts.active150) out.push({ key: 'active_150', title: 'First week with 150 active minutes' });
    if (opts.goalReached) out.push({ key: 'goal_reached', title: 'Goal reached' });
    return out;
  }

  // ------------------------------------------------------------- week summary
  function weekSummary(opts) {
    var ws = opts.weekStart, days = [];
    var totalWalk = 0, workouts = 0, habitYes = 0, habitDays = 0, stepVals = [], sleepVals = [];
    for (var i = 0; i < 7; i++) {
      var d = addDays(ws, i);
      var c = (opts.checkins || []).filter(function (x) { return x.date === d; });
      var w = (opts.workouts || []).filter(function (x) { return x.date === d; });
      var walkMin = 0;
      w.forEach(function (x) { if (x.kind === 'walk') walkMin += +x.minutes || 0; });
      var strength = w.filter(function (x) { return x.kind !== 'walk'; }).length;
      workouts += strength;
      totalWalk += walkMin;
      var hy = {};
      c.forEach(function (x) { if (x.kind.indexOf('habit:') === 0 && (x.value === 'yes' || truthy(x.value))) hy[x.kind] = 1; });
      var nh = Object.keys(hy).length;
      if (nh) { habitYes += nh; habitDays++; }
      var st = (opts.steps || []).filter(function (x) { return x.date === d; });
      if (st.length) stepVals.push(+st[st.length - 1].steps);
      var sl = (opts.sleep || []).filter(function (x) { return x.date === d; });
      if (sl.length) sleepVals.push(+sl[sl.length - 1].hours);
      days.push({
        date: d, type: opts.types ? opts.types[d] : '', status: opts.statuses ? opts.statuses[d] : '',
        strength: strength, walkMinutes: walkMin, habits: nh
      });
    }
    var avg = function (a) { return a.length ? round(a.reduce(function (x, y) { return x + y; }, 0) / a.length, 1) : null; };
    return {
      weekStart: ws, days: days, workouts: workouts, walkMinutes: totalWalk,
      habitsPerDay: habitDays ? round(habitYes / habitDays, 1) : 0,
      stepsAvg: avg(stepVals) == null ? null : Math.round(avg(stepVals)), sleepAvg: avg(sleepVals)
    };
  }

  // ------------------------------------------------------------- sleep
  /** Bedtime consistency: average absolute deviation from the median bedtime, in minutes. */
  function bedtimeSpread(bedtimes) {
    var mins = (bedtimes || []).filter(Boolean).map(function (t) { var m = hmToMin(t); return m < 12 * 60 ? m + 1440 : m; });
    if (mins.length < 3) return null;
    var s = mins.slice().sort(function (a, b) { return a - b; });
    var med = s[Math.floor(s.length / 2)];
    return Math.round(mins.reduce(function (a, m) { return a + Math.abs(m - med); }, 0) / mins.length);
  }

  // ------------------------------------------------------------- supplements
  /**
   * Overlaps (same nutrient from two products), medication interactions, timing notes, and
   * safe-mode warnings. catalog: [{id,name,contains:[...],interactions:[{match:[...],note}],timing}]
   * mine: [{catalogId|id, name}]  meds: free text
   */
  function supplementChecks(opts) {
    var catalog = opts.catalog || [];
    var byId = {};
    catalog.forEach(function (c) { byId[c.id] = c; });
    var mine = (opts.mine || []).map(function (s) { return byId[s.catalogId || s.id] || s; }).filter(Boolean);
    var overlaps = [], interactions = [], timing = [], cautions = [];
    var nutrients = {};
    mine.forEach(function (s) {
      (s.contains || []).forEach(function (n) { (nutrients[n] = nutrients[n] || []).push(s.name); });
    });
    Object.keys(nutrients).forEach(function (n) {
      if (nutrients[n].length > 1) overlaps.push({ nutrient: n, from: nutrients[n] });
    });
    var meds = String(opts.meds || '').toLowerCase();
    mine.forEach(function (s) {
      (s.interactions || []).forEach(function (rule) {
        var hit = (rule.match || []).filter(function (word) { return meds.indexOf(String(word).toLowerCase()) >= 0; });
        if (hit.length) interactions.push({ supplement: s.name, meds: hit, note: rule.note });
      });
      if (s.timing) timing.push({ supplement: s.name, note: s.timing });
      if (opts.safe && s.safeModeNote) cautions.push({ supplement: s.name, note: s.safeModeNote });
    });
    if (meds.trim() && mine.some(function (s) { return s.id === 'psyllium' || s.id === 'fiber'; })) {
      if (!interactions.some(function (i) { return /fiber|psyllium/i.test(i.supplement); })) {
        interactions.push({ supplement: 'Fiber / psyllium', meds: ['your medications'], note: 'Take fiber at least 2 hours apart from medications so it does not reduce how well they are absorbed.' });
      }
    }
    return { overlaps: overlaps, interactions: interactions, timing: timing, cautions: cautions };
  }
  function refillDue(item, today) {
    if (!item || !item.lastRefill || !(+item.refillDays > 0)) return null;
    var due = addDays(item.lastRefill, +item.refillDays);
    var left = daysBetween(today, due);
    return { due: due, daysLeft: left, soon: left <= 5 };
  }

  // ------------------------------------------------------------- right now
  /**
   * What should I do right now? Returns {key, title, sub, action}
   * ctx: {plan, minutes, quiet, logged:{weighed,workout,walk,habits,sleep}, bedtime:'23:00', catchupPending, preShabbatDone}
   */
  function nextAction(ctx) {
    var p = ctx.plan || { type: 'walk' };
    var t = ctx.minutes;
    var lg = ctx.logged || {};
    var bed = hmToMin(ctx.bedtime || '23:00');
    if (bed < 12 * 60) bed += 1440;
    if (ctx.quiet && ctx.quiet.quiet) return { key: ctx.quiet.reason === 'yomtov' ? 'yomtov' : 'shabbat', action: 'none' };
    if (p.type === 'shabbat' || p.type === 'yomtov') return { key: p.type, action: 'none' };
    if (ctx.catchupPending) return { key: 'catchup', action: 'catchup' };
    if (p.type === 'fast') return { key: 'fast', action: 'none' };
    if (p.type === 'sick') return { key: 'sick', action: lg.sleep ? 'none' : 'sleep' };
    if (p.weighIn && !lg.weighed && t < 12 * 60) return { key: 'weigh', action: 'weigh' };
    if (p.isErev && !ctx.preShabbatDone && p.candles && t >= hmToMin(p.candles) - 5 * 60) return { key: 'preshabbat', action: 'preshabbat' };
    if ((p.type === 'strength' || p.type === 'light') && !lg.workout && t < bed - 90) return { key: 'workout', action: 'workout' };
    if (p.type === 'walk' && !lg.walk && t < bed - 90) return { key: 'walk', action: 'walk' };
    if (t >= bed - 180 && t < bed && !lg.habits) return { key: 'habits', action: 'habits' };
    if (t >= bed - 180 && t < bed + 240) return { key: 'bedtime', action: 'none' };
    if (!lg.habits && t >= 17 * 60) return { key: 'habits', action: 'habits' };
    if (!lg.walk && (p.type === 'strength' || p.type === 'light') && t < bed - 120) return { key: 'walk', action: 'walk' };
    return { key: 'done', action: 'none' };
  }

  // ------------------------------------------------------------- the ONE day plan (Round 3, C5)
  var MEAL_KEYS = ['breakfast', 'lunch', 'dinner'];
  var REST_TITLES = { shabbat: 'Shabbat', yomtov: 'Yom Tov', fast: 'Fast day', sick: 'Rest and recover' };
  /** The inputs that decide a day's plan, as one string: the app uses the back office's plan while they match. */
  function planKey(ctx) {
    return JSON.stringify([ctx.date, ctx.schedule || null, ctx.mode || null, ctx.weigh || null, ctx.activity || '', ctx.weekIndex || 0,
      ctx.versionPref || null, ctx.minutesAvailable || null, !!ctx.safe, ctx.energy == null ? null : +ctx.energy, ctx.dayVersion || null,
      ctx.levels || {}, ctx.swaps || {}, (ctx.exercises || []).length, ctx.mealWeek || '']);
  }
  /**
   * THE plan for one person's day. Summary, Plan, the workout flow, reminders and the morning message all read
   * this one object, so they can never disagree. ctx = dayPlan's inputs plus
   * { exercises, levels, swaps, dayVersion (10/20/30 picked today), mealPlan: {days}, recipes: [..] }.
   */
  function todayPlan(ctx) {
    var base = dayPlan(ctx);
    var t = base.type;
    var kind = (t === 'strength' || t === 'light') ? t : (t === 'walk' ? 'walk' : (t === 'rest' ? 'rest' : 'none'));
    var version = base.version;
    if (kind === 'strength' && [10, 20, 30].indexOf(+ctx.dayVersion) >= 0) version = +ctx.dayVersion;
    var workout = { kind: kind, minutes: 0, moves: [], title: '', line: '', where: '', warmup: 0, cooldown: 0 };
    if (kind === 'strength' || kind === 'light') {
      var sess = buildSession({ type: kind, version: version, exercises: ctx.exercises || [], levels: ctx.levels || {}, swaps: ctx.swaps || {}, mode: base.mode });
      var names = sess.moves.map(function (m) { return m.name; });
      workout.minutes = sess.version; workout.moves = sess.moves; workout.warmup = sess.warmupMinutes; workout.cooldown = sess.cooldownMinutes;
      workout.title = kind === 'light' ? 'Light day' : 'Strength';
      // H3 (Round 3.2): two moves and "and N more", so the line fits on one line ("Sit-to-stand, countertop push-up and 4 more")
      var lc = names.map(function (n, i) { n = String(n).split(',')[0].trim(); return i && /^[A-Z][a-z]/.test(n) ? n.charAt(0).toLowerCase() + n.slice(1) : n; }); // "Sit-to-stand, with hands" → "Sit-to-stand"
      workout.line = lc.length <= 2 ? lc.join(' and ') : (lc.length === 3 ? lc[0] + ', ' + lc[1] + ' and ' + lc[2] : lc[0] + ', ' + lc[1] + ' and ' + (lc.length - 2) + ' more');
      workout.where = sess.moves.length + ' moves at home. No equipment.';
    } else if (kind === 'walk') {
      workout.minutes = base.walkMinutes; workout.title = 'Walk day'; workout.line = 'Walk ' + base.walkMinutes + ' minutes, at a pace where you can talk but not sing.';
    } else if (kind === 'rest') {
      workout.title = 'Rest day'; workout.line = 'A short walk if you feel like it.';
    } else {
      workout.title = REST_TITLES[t] || 'Rest day';
      workout.line = t === 'fast' ? 'Workouts are paused today.' : (t === 'sick' ? 'Rest is the plan. Your streak is safe.' : 'A full rest day. Your streak is safe.');
    }
    var walkGoal = (kind === 'walk' || kind === 'strength' || kind === 'light' || kind === 'rest') ? base.walkMinutes : 0;
    var items = [];
    if (base.weighIn) items.push('weigh');
    if (kind === 'strength' || kind === 'light') items.push('workout');
    if ((kind === 'walk' || kind === 'strength' || kind === 'light') && walkGoal) items.push('walk');
    var meals = null;
    var day = ((ctx.mealPlan && ctx.mealPlan.days) || []).filter(function (d) { return d && d.date === base.date; })[0];
    if (day) {
      var byId = {};
      (ctx.recipes || []).forEach(function (r) { byId[r.id] = r; });
      meals = {};
      MEAL_KEYS.forEach(function (k) {
        var m = day[k] || {};
        var r = m.recipe_id ? byId[m.recipe_id] : null;
        meals[k] = (m.text || r) ? { title: mealTitle(m.text, r), kind: r ? r.kind : (m.kind || ''), recipeId: r ? r.id : '' } : null;
      });
    }
    return {
      date: base.date, type: t, mode: base.mode, weighIn: base.weighIn, walkGoal: walkGoal,
      activityGoal: walkGoal + (kind === 'strength' || kind === 'light' ? workout.minutes : 0),
      workout: workout, items: items, meals: meals, lines: base.lines,
      isErev: base.isErev, candles: base.candles, havdalah: base.havdalah, fastName: base.fastName, afterFast: base.afterFast, fastTomorrow: base.fastTomorrow,
      weeklyWalkTarget: base.weeklyWalkTarget, version: workout.minutes, safe: base.safe, key: planKey(ctx)
    };
  }
  /** H3: a meal's name on Plan: short enough for one line, no period at the end ("Cottage cheese veggie omelet"). */
  function mealTitle(text, r) {
    var t = String(text || (r && r.title) || '').replace(/\s+/g, ' ').trim().replace(/[.!\s]+$/, '');
    var MAX = 27; // what fits on one line beside the Meat/Dairy chip on an iPhone
    if (t.length > MAX && r && (r.short || r.title) && String(r.short || r.title).length < t.length) t = String(r.short || r.title).replace(/[.!\s]+$/, '');
    if (t.length > MAX) { var cut = t.search(/[,:;(]| [—–-] | \/ | with | in /); if (cut >= 8) t = t.slice(0, cut).trim(); }
    return capItem(t); // anything still longer wraps to a second line (never "…")
  }
  /** What's already done on a date, from the logs: minutes, workout, habits, weigh-in, protein, sleep and energy. */
  function dayDone(lg, date, opts) {
    lg = lg || {};
    opts = opts || {};
    var latest = {};
    (lg.checkins || []).filter(function (c) { return c.date === date; }).sort(function (a, b) { return String(a.ts) < String(b.ts) ? -1 : 1; })
      .forEach(function (c) { latest[c.kind] = c; });
    var ws = (lg.workouts || []).filter(function (w) { return w.date === date; });
    var walkMin = 0, workoutMin = 0, strength = 0;
    ws.forEach(function (w) { if (w.kind === 'walk') walkMin += +w.minutes || 0; else { strength++; workoutMin += +w.minutes || +w.version || 0; } });
    var habits = {};
    Object.keys(latest).forEach(function (k) { if (k.indexOf('habit:') === 0 && (latest[k].value === 'yes' || truthy(latest[k].value))) habits[k.slice(6)] = true; });
    var sl = (lg.sleep || []).filter(function (x) { return x.date === date; }).pop();
    var en = (lg.energy || []).filter(function (x) { return x.date === date; }).pop();
    var protein = proteinOn(lg.checkins || [], date).grams;
    if (opts.proteinTarget && protein >= opts.proteinTarget) habits.protein_first = true; // E4: the Protein habit ticks itself at the target
    return {
      walkMin: walkMin, workoutMin: workoutMin, activityMin: walkMin + workoutMin,
      workoutDone: strength > 0, // from the workout rows only (E1)
      habits: habits, habitCount: Object.keys(habits).length,
      weighed: (lg.weights || []).some(function (w) { return w.date === date; }),
      sleepHours: sl ? +sl.hours : null, energy: en ? +en.level : null,
      protein: protein, preshabbat: !!latest.preshabbat
    };
  }
  /**
   * Next up: the first undone item in today's plan (the weigh-in before noon, the workout, the walk).
   * ctx: { plan, done, minutes, quiet, catchupPending, preShabbatDone }. Returns {key, ...}.
   */
  function nextUp(ctx) {
    var p = ctx.plan, d = ctx.done || {}, t = ctx.minutes;
    if (ctx.quiet && ctx.quiet.quiet) return { key: 'rest', reason: ctx.quiet.reason === 'yomtov' ? 'yomtov' : 'shabbat' };
    if (ctx.catchupPending) return { key: 'catchup' };
    if (p.type === 'shabbat' || p.type === 'yomtov') return { key: 'motzei' };
    if (p.type === 'fast') return { key: 'fast' };
    if (p.type === 'sick') return { key: 'sick' };
    if (p.isErev && !ctx.preShabbatDone && p.candles && t >= hmToMin(p.candles) - 5 * 60) return { key: 'preshabbat' };
    for (var i = 0; i < p.items.length; i++) {
      var it = p.items[i];
      if (it === 'weigh' && !d.weighed && t < 12 * 60) return { key: 'weigh' };
      if (it === 'workout' && !d.workoutDone) return { key: 'workout' };
      if (it === 'walk' && (d.walkMin || 0) < p.walkGoal) return { key: 'walk', minutes: p.walkGoal - (d.walkMin || 0), partial: (d.walkMin || 0) > 0 };
    }
    return { key: 'done' };
  }

  // ------------------------------------------------------------- groceries (Round 3, D8)
  var AISLES = ['Produce', 'Meat & fish', 'Dairy & eggs', 'Pantry', 'Frozen', 'Other'];
  // A small keyword map decides the aisle; the first match wins. Unknown items go to Other.
  var AISLE_WORDS = [
    ['Frozen', /\bfrozen\b|ice cream|ice pop/],
    ['Pantry', /peanut butter|almond butter|nut butter|butter beans|bread crumbs|\boil\b/],
    ['Produce', /lettuce|green beans|string beans|snap peas/],
    ['Meat & fish', /chicken|beef|steak|turkey|lamb|veal|brisket|london broil|flank|meatball|burger|salmon|tuna|tilapia|\bcod\b|\bfish|flounder|sardine|anchov|pastrami|salami|hot dog|schnitzel|jerky|sausage|ground meat/],
    ['Dairy & eggs', /\beggs?\b|milk|yogh?urt|cheese|cottage|butter(?!nut)|cream|labneh|feta|mozzarella|parmesan|ricotta|kefir/],
    ['Produce', /lettuce|romaine|spinach|kale|arugula|greens|cabbage|broccoli|cauliflower|carrot|celery|cucumber|tomato|bell pepper|peppers?$|jalape|onion|scallion|garlic|ginger|lemon|lime|orange|apple|banana|berr|grape|pear|peach|plum|melon|avocado|zucchini|squash|eggplant|potato|mushroom|parsley|cilantro|\bdill\b|\bmint\b|basil|herbs?\b|beet|radish|fruit|vegetable|veggie|edamame|sprout/],
    ['Pantry', /\boil\b|vinegar|flour|sugar|honey|rice|quinoa|pasta|noodle|\boats?\b|bread|pita|tortilla|wrap|cracker|cereal|beans?\b|lentil|chickpea|hummus|tahini|peanut|almond|pistachio|\bnuts?\b|seeds?\b|popcorn|chocolate|coffee|\btea\b|spice|\bsalt|paprika|cumin|za.?atar|cinnamon|chili|pepper flakes|black pepper|sauce|\bsoy\b|mustard|ketchup|mayo|broth|stock|harissa|gochujang|sriracha|cornstarch|skewer|pickle|olive|canned|crushed tomatoes|\bjar\b|seltzer|water/]
  ];
  var SECTION_AISLE = { 'Produce': 'Produce', 'Meat & poultry': 'Meat & fish', 'Fish': 'Meat & fish', 'Dairy & eggs': 'Dairy & eggs', 'Bakery': 'Pantry', 'Pantry': 'Pantry', 'Spices & sauces': 'Pantry', 'Frozen': 'Frozen' };
  function groceryAisle(name, section) {
    if (section === CHECK_AISLE) return section;
    // Round 3.2 (F5): the store table knows what an item is (crushed tomatoes are a can in Pantry, not Produce)
    var known = /\(/.test(String(name)) ? null : STORE_ITEMS.filter(function (r) { return r[3] !== 'name' && r[0].test(String(name || '').toLowerCase().trim()); })[0];
    if (known) return known[2];
    if (AISLES.indexOf(section) >= 0 && section !== 'Other' && !SECTION_AISLE[section]) return section;
    var n = String(name || '').toLowerCase();
    if (/\bcan(ned)?\b|crushed tomatoes|diced tomatoes|tomato (paste|sauce)|\bjar\b/.test(n)) return 'Pantry';
    for (var i = 0; i < AISLE_WORDS.length; i++) if (AISLE_WORDS[i][1].test(n)) return AISLE_WORDS[i][0];
    return SECTION_AISLE[section] || 'Other';
  }
  /** Capital first letter, the rest as typed ("bone-in chicken thighs" → "Bone-in chicken thighs"). */
  function capItem(s) { s = String(s || '').replace(/\s+/g, ' ').trim().replace(/\bgreek\b/gi, 'Greek'); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; } // H6: "Greek yogurt" everywhere
  /** "romaine (checked)" → name "Romaine", note "Bug-checked brand"; "(or …)" and other asides become the note. */
  function groceryName(raw) {
    var s = String(raw || ''), note = '';
    if (/\(\s*checked\s*\)/i.test(s)) { note = 'Bug-checked brand'; s = s.replace(/\(\s*checked\s*\)/ig, ''); }
    var m = /\(([^)]*)\)/.exec(s);
    if (m) { if (!note) note = capItem(m[1]); s = s.replace(m[0], ''); }
    return { name: capItem(s), note: note };
  }
  function groceryKey(name) { return String(name || '').toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').replace(/(e?s)$/, '').slice(0, 50); }
  var UNIT_PLURAL = { bunch: 'bunches', head: 'heads', clove: 'cloves', can: 'cans', jar: 'jars', pack: 'packs', bag: 'bags', box: 'boxes', bottle: 'bottles', piece: 'pieces', cup: 'cups', stick: 'sticks', container: 'containers', loaf: 'loaves', package: 'packages', carton: 'cartons', slice: 'slices' };
  var UNIT_SINGULAR = {};
  Object.keys(UNIT_PLURAL).forEach(function (k) { UNIT_SINGULAR[UNIT_PLURAL[k]] = k; UNIT_SINGULAR[k] = k; });
  var MEASURES = /^(lb|lbs|pound|pounds|oz|ounce|ounces|g|kg|ml|l|tbsp|tsp|cups?|bunch(es)?|heads?|cloves?|cans?|jars?|packs?|bags?|box(es)?|bottles?|pieces?|sticks?|containers?|loaf|loaves|packages?|cartons?|slices?|dozen)$/i;
  var PACKAGES = /^(cans?|jars?|packs?|bags?|box(es)?|bottles?|containers?|cartons?|packages?)$/i;
  var FRAC = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };
  function parseNum(s) {
    var m = /^(\d+(?:\.\d+)?)?\s*([¼½¾⅓⅔⅛])?(?:\s*(\d+)\/(\d+))?$/.exec(String(s).trim());
    if (!m || (!m[1] && !m[2] && !m[3])) return null;
    return (m[1] ? +m[1] : 0) + (m[2] ? FRAC[m[2]] : 0) + (m[3] ? +m[3] / +m[4] : 0);
  }
  function fmtNum(n) {
    var whole = Math.floor(n + 1e-9), f = n - whole;
    var near = [[0, ''], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾'], [1, '']].reduce(function (a, b) { return Math.abs(b[0] - f) < Math.abs(a[0] - f) ? b : a; });
    if (Math.abs(near[0] - f) > 0.05) return String(round(n, 1));
    if (near[0] === 1) return String(whole + 1);
    return (whole ? String(whole) : (near[1] ? '' : '0')) + near[1];
  }
  /** A quantity → {n, unit, pkg} ("2 heads" → {2,'head'}; "28 oz can" → a 28 oz package, counted as 1). */
  function parseQty(q) {
    var m = /^\s*([\d.\s/¼½¾⅓⅔⅛]+?)\s*([A-Za-z].*)?$/.exec(String(q || ''));
    if (!m) return null;
    var n = parseNum(m[1]);
    if (n == null) return null;
    var rest = String(m[2] || '').trim().toLowerCase();
    var words = rest.split(/\s+/).filter(Boolean);
    if (words.length === 2 && MEASURES.test(words[0]) && PACKAGES.test(words[1])) return { n: 1, unit: UNIT_SINGULAR[words[1]] || words[1], size: fmtNum(n) + ' ' + words[0] };
    if (words.length > 1) return null;
    var unit = words[0] || '';
    if (unit && !MEASURES.test(unit)) return null;
    return { n: n, unit: UNIT_SINGULAR[unit] || (unit === 'lbs' || unit === 'pounds' || unit === 'pound' ? 'lb' : unit) };
  }
  function qtyText(n, unit, size) {
    if (size) return (n === 1 ? '' : fmtNum(n) + ' × ') + size + ' ' + (n === 1 ? unit : (UNIT_PLURAL[unit] || unit));
    if (!unit) return fmtNum(n);
    return fmtNum(n) + ' ' + (n > 1 && UNIT_PLURAL[unit] ? UNIT_PLURAL[unit] : (unit === 'tbsp' ? 'Tbsp' : unit));
  }
  /** Add up quantities of one item: "2 heads" + "2 heads" → "4 heads"; different units stay listed ("1 Tbsp + 2 tsp"). */
  function sumQty(list) {
    var groups = [], loose = [];
    (list || []).filter(function (q) { return q != null && String(q).trim() !== ''; }).forEach(function (q) {
      String(q).split(/\s*\+\s*/).forEach(function (part) {
        var p = parseQty(part);
        if (!p) { if (loose.indexOf(part.trim()) < 0) loose.push(part.trim()); return; }
        var g = groups.filter(function (x) { return x.unit === p.unit && x.size === p.size; })[0];
        if (g) g.n += p.n; else groups.push({ n: p.n, unit: p.unit, size: p.size });
      });
    });
    // only the first part keeps a capital ("1 jar + as many as you like"); units like Tbsp keep theirs
    return groups.map(function (g) { return qtyText(g.n, g.unit, g.size); }).concat(loose).map(function (x, i) { return i && /^[A-Z][a-z]/.test(x) && !/^(Tbsp|Tsp)/.test(x) ? x.charAt(0).toLowerCase() + x.slice(1) : x; }).join(' + ');
  }
  /** Typed into the Add field: "2 lb chicken breast" → {name: "Chicken breast", qty: "2 lb"}. */
  function parseGroceryInput(text) {
    var t = String(text || '').replace(/\s+/g, ' ').trim();
    var m = /^([\d.¼½¾⅓⅔⅛/]+(?:\s*[¼½¾⅓⅔⅛])?)\s*(lb|lbs|pounds?|oz|ounces?|kg|g|cups?|tbsp|tsp|bunch(?:es)?|heads?|cloves?|cans?|jars?|packs?|bags?|box(?:es)?|bottles?|pieces?|sticks?|containers?|loaf|loaves|packages?|cartons?|dozen)?\b\s*(?:of\s+)?(.+)$/i.exec(t);
    if (m && m[3] && parseNum(m[1]) != null) {
      var unit = m[2] ? m[2].toLowerCase() : '';
      return { name: capItem(m[3]), qty: (fmtNum(parseNum(m[1])) + (unit ? ' ' + unit : '')).trim() };
    }
    return { name: capItem(t), qty: '' };
  }

  // ------------------------------------------------------------- the store list (Round 3.2, F)
  // Recipe lines and snack ideas become what you buy: one line per thing, in the unit the store sells it in, in the aisle
  // where it is. Spices, oils, sauces and other pantry staples go to "Check you have" by name only. Rules only: the same
  // plan always gives the same list, and it costs nothing.
  var CHECK_AISLE = 'Check you have';
  var STORE_PLURAL = { bunch: 'bunches', head: 'heads', bag: 'bags', can: 'cans', jar: 'jars', pack: 'packs', container: 'containers', carton: 'cartons', tub: 'tubs', piece: 'pieces', box: 'boxes', bottle: 'bottles' };
  // [pattern on the cleaned lowercase name, store name, aisle, store unit, extra] — first match wins. unit 'name' = no amount.
  var S_P = 'Produce', S_M = 'Meat & fish', S_D = 'Dairy & eggs', S_N = 'Pantry', S_F = 'Frozen', S_C = CHECK_AISLE;
  var STORE_ITEMS = [
    // staples first, so "red pepper flakes" never becomes a pepper
    [/pepper flakes|black pepper|^salt( and pepper)?$|kosher salt/, null, S_C, 'name'],
    [/^(sweet |hot )?paprika$/, 'Paprika', S_C, 'name'], [/^smoked paprika$/, 'Smoked paprika', S_C, 'name'],
    [/^cumin$|^ground cumin$/, 'Cumin', S_C, 'name'], [/^chili powder$/, 'Chili powder', S_C, 'name'], [/^oregano$/, 'Oregano', S_C, 'name'],
    [/^turmeric$/, 'Turmeric', S_C, 'name'], [/^za.?atar$/, 'Za\'atar', S_C, 'name'], [/^cinnamon$/, 'Cinnamon', S_C, 'name'],
    [/^harissa/, 'Harissa', S_C, 'name'], [/gochujang|sriracha/, 'Gochujang or sriracha', S_C, 'name'], [/chipotle/, 'Chipotle in adobo', S_C, 'name'],
    [/^olive oil$/, 'Olive oil', S_C, 'name'], [/^avocado oil$/, 'Avocado oil', S_C, 'name'], [/\boil$/, null, S_C, 'name'],
    [/^red wine vinegar$/, 'Red wine vinegar', S_C, 'name'], [/^rice vinegar$/, 'Rice vinegar', S_C, 'name'], [/vinegar$/, null, S_C, 'name'],
    [/^soy sauce$/, 'Soy sauce', S_C, 'name'], [/mustard$/, 'Dijon mustard', S_C, 'name'], [/mayo(nnaise)?$/, 'Light mayonnaise', S_C, 'name'],
    [/^honey$/, 'Honey', S_C, 'name'], [/^(brown )?sugar$/, 'Brown sugar', S_C, 'name'], [/^cornstarch$/, 'Cornstarch', S_C, 'name'],
    [/breadcrumbs|bread crumbs|oat flour/, 'Breadcrumbs or oat flour', S_C, 'name'], [/^rolled oats$|^oats$/, 'Rolled oats', S_C, 'name'],
    [/^chia/, 'Chia seeds', S_C, 'name'], [/^sesame seeds$/, 'Sesame seeds', S_C, 'name'], [/^chopped nuts$/, 'Chopped nuts', S_C, 'name'],
    [/coffee/, 'Coffee', S_C, 'name'], [/dark chocolate/, 'Dark chocolate', S_C, 'name'], [/^tahini$/, 'Tahini', S_C, 'name'], [/^skewers$/, 'Skewers', S_C, 'name'],
    // produce
    [/cucumbers?$/, 'Cucumbers', S_P, 'count'], [/^avocados?$/, 'Avocados', S_P, 'count'], [/spinach/, 'Baby spinach', S_P, 'bag'],
    [/^(bell|red|green|yellow) peppers?$/, 'Bell peppers', S_P, 'count'], [/^berries$|^fruit$|^mixed berries$/, 'Berries', S_P, 'container'],
    [/^broccoli$/, 'Broccoli', S_P, 'head'], [/^butter lettuce$/, 'Butter lettuce', S_P, 'head'], [/^romaine$/, 'Romaine', S_P, 'head'],
    [/^carrots?$|^baby carrots$/, 'Carrots', S_P, 'lb', { perLb: 6 }], [/^cauliflower$/, 'Cauliflower', S_P, 'head'],
    [/^celery$/, 'Celery', S_P, 'bunch', { perBunch: 9 }], [/^cilantro$/, 'Cilantro', S_P, 'bunch'], [/parsley/, 'Parsley', S_P, 'bunch'],
    [/^dill$/, 'Dill', S_P, 'bunch'], [/ginger/, 'Fresh ginger', S_P, 'piece'], [/rosemary|thyme/, 'Fresh rosemary and thyme', S_P, 'pack'],
    [/^garlic$/, 'Garlic', S_P, 'head', { cloves: 10 }], [/^green beans$|^string beans$/, 'Green beans', S_P, 'lb'],
    [/^lemons?$/, 'Lemons', S_P, 'count'], [/^limes?$/, 'Limes', S_P, 'count'], [/mixed greens|salad greens/, 'Mixed greens', S_P, 'bag', { cupsPer: 5 }],
    [/^mushrooms?$/, 'Mushrooms', S_P, 'pack', { perPack: 10 }], [/^red onions?$/, 'Red onions', S_P, 'count'],
    [/^(large |small |medium |yellow |white )?onions?$/, 'Onions', S_P, 'count'], [/^scallions?$|^green onions$/, 'Scallions', S_P, 'bunch'],
    [/^parsnips?$/, 'Parsnips', S_P, 'count'], [/^sweet potato(es)?$/, 'Sweet potatoes', S_P, 'count'], [/potato(es)?$/, 'Potatoes', S_P, 'count'],
    [/^red chil(i|ie|e)s?$/, 'Red chilies', S_P, 'count'], [/cabbage/, 'Shredded cabbage', S_P, 'bag'], [/^tomato(es)?$/, 'Tomatoes', S_P, 'count'],
    [/^zucchini$/, 'Zucchini', S_P, 'count'], [/^apples?$/, 'Apples', S_P, 'bag'], [/^grapes$/, 'Grapes', S_P, 'bag'],
    // meat and fish
    [/london broil/, 'London broil', S_M, 'lb'], [/^bone-in chicken thighs$/, 'Bone-in chicken thighs', S_M, 'lb'],
    [/^boneless chicken thighs/, 'Boneless chicken thighs', S_M, 'lb'], [/^chicken pieces$/, 'Chicken pieces', S_M, 'lb'],
    [/whole chicken|spatchcock/, 'Whole chicken', S_M, 'count'], [/^ground turkey/, 'Ground turkey', S_M, 'lb'], [/^ground chicken$/, 'Ground chicken', S_M, 'lb'],
    [/^lean beef/, 'Lean beef', S_M, 'lb'], [/^salmon fillets?$/, 'Salmon fillets', S_M, 'count'],
    // dairy and eggs
    [/^eggs?$/, 'Eggs', S_D, 'dozen'], [/^cottage cheese$/, 'Cottage cheese', S_D, 'tub', { cupsPer: 2 }], [/^feta/, 'Feta cheese', S_D, 'pack'],
    [/^milk$/, 'Milk', S_D, 'carton'], [/greek yogurt/, 'Plain Greek yogurt', S_D, 'tub', { cupsPer: 4 }], [/^string cheese$/, 'String cheese', S_D, 'pack'],
    [/^shredded cheese$/, 'Shredded cheese', S_D, 'bag'],
    // pantry: canned and dry goods you buy
    [/black or kidney beans|^black beans$|^kidney beans$/, 'Black or kidney beans', S_N, 'can'], [/^barley$/, 'Barley', S_N, 'bag'],
    [/broth|stock$/, 'Chicken broth', S_N, 'carton'], [/^crushed tomatoes$/, 'Crushed tomatoes', S_N, 'can'], [/^diced tomatoes$/, 'Diced tomatoes', S_N, 'can'],
    [/^dry mixed beans$/, 'Dry mixed beans', S_N, 'bag'], [/lentils$/, 'Red lentils', S_N, 'bag'], [/roasted red peppers/, 'Roasted red peppers', S_N, 'jar'],
    [/^tuna/, 'Tuna in water', S_N, 'can'], [/^pickles$/, 'Pickles', S_N, 'jar'], [/^hummus$/, 'Hummus', S_N, 'container'],
    [/^rice cakes$/, 'Rice cakes', S_N, 'pack'], [/^peanut butter$/, 'Peanut butter', S_N, 'jar'], [/^seltzer$/, 'Seltzer', S_N, 'pack'],
    [/^chickpeas$/, 'Chickpeas', S_N, 'can'], [/popcorn/, 'Popcorn kernels', S_N, 'bag'], [/^almonds or pistachios$|^almonds$|^pistachios$/, 'Almonds or pistachios', S_N, 'bag'],
    [/jerky|turkey sticks/, 'Beef jerky', S_N, 'pack'],
    // frozen
    [/^edamame$/, 'Edamame', S_F, 'bag']
  ];
  // snack ideas and dishes are not groceries: they become what you buy (or nothing)
  var STORE_SPLITS = [
    [/^leftover/, []],
    [/^veggie sticks and hummus$/, ['hummus']],            // the veggies are the carrots and cucumbers already on the list
    [/^rice cakes with peanut butter$/, ['rice cakes', 'peanut butter']],
    [/^string cheese and an apple$/, ['string cheese', 'apples']],
    [/^frozen grapes and seltzer$/, ['grapes', 'seltzer']],
    [/^cottage cheese with fruit$/, ['cottage cheese', 'berries']],
    [/^hard-boiled eggs$/, ['eggs']], [/^greek yogurt cup$/, ['greek yogurt']], [/^roasted chickpeas$/, ['chickpeas']],
    [/^air-popped popcorn$/, ['popcorn']], [/^beef jerky or turkey sticks$/, ['beef jerky']]
  ];
  var STORE_NOTES = { 'flank steak or london broil': 'Or flank steak', 'boneless chicken thighs or breasts': 'Or breasts', 'ground turkey or lean beef': 'Or lean beef', 'ground turkey (or beef)': 'Or lean beef',
    'lean beef (trimmed shoulder or brisket)': 'Trimmed shoulder or brisket', 'chicken, spatchcocked by the butcher': 'Ask the butcher to spatchcock it', 'whole chicken or 4 lb pieces': '', 'beef jerky or turkey sticks': 'Or turkey sticks, with a reliable hechsher',
    'black or kidney beans': '', 'cauliflower (or 1 lb baby potatoes)': 'Or 1 lb baby potatoes' };
  /** One grocery line → [{ key, name, aisle, unit, extra, qty, note }] (empty = not a grocery). */
  function storeItem(rawName, qty, section) {
    var raw = String(rawName || '').replace(/\s+/g, ' ').trim();
    var low = raw.toLowerCase();
    var note = /\(\s*(certified )?checked\s*\)/.test(low) ? 'Bug-checked brand' : '';
    var asideNote = STORE_NOTES[low] != null ? STORE_NOTES[low] : '';
    var clean = low.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
    var split = null;
    for (var s = 0; s < STORE_SPLITS.length && !split; s++) if (STORE_SPLITS[s][0].test(clean)) split = STORE_SPLITS[s][1];
    if (split) return split.map(function (n) { return storeItem(n, '', section)[0]; }).filter(Boolean).map(function (x) { if (!x.note && asideNote) x.note = asideNote; return x; });
    for (var i = 0; i < STORE_ITEMS.length; i++) {
      var r = STORE_ITEMS[i];
      if (!r[0].test(clean)) continue;
      var name = r[1] || capItem(clean);
      return [{ key: groceryKey(name), name: name, aisle: r[2], unit: r[3], extra: r[4] || {}, qty: qty, note: note || asideNote }];
    }
    // not in the table (a coach-made recipe): keep the name, guess the aisle, add the amounts up as before
    var nm = groceryName(raw);
    if (!nm.name) return [];
    var staple = /\b(spice|seasoning|powder|extract|sauce|vinegar|oil|syrup|flour|baking|yeast|salt|pepper$)\b/.test(clean);
    return [{ key: groceryKey(nm.name), name: nm.name, aisle: staple ? CHECK_AISLE : groceryAisle(nm.name, section), unit: staple ? 'name' : 'raw', extra: {}, qty: qty, note: nm.note }];
  }
  /** A loose amount → { n, unit, size }: "2½ lb", "28 oz can", "1 (4 lb)", "4 (6 oz)", "2–4", "3 cloves", "1 handful". */
  function looseQty(q) {
    var t = String(q || '').toLowerCase().trim();
    if (!t) return null;
    var size = '';
    var par = /\(([^)]*)\)/.exec(t);
    if (par) { size = par[1].trim(); t = t.replace(par[0], '').trim(); }
    t = t.replace(/^(about|around|roughly)\s+/, '');
    var range = /^([\d.¼½¾⅓⅔⅛/ ]+)\s*[–-]\s*([\d.¼½¾⅓⅔⅛/]+)\s*(.*)$/.exec(t);
    if (range) t = range[2] + (range[3] ? ' ' + range[3] : '');
    var m = /^(\d+\/\d+|[\d.]+(?:\s*[¼½¾⅓⅔⅛])?|[¼½¾⅓⅔⅛])\s*(.*)$/.exec(t);
    if (!m) return null;
    var n = parseNum(m[1].replace(/\s+/g, ''));
    if (n == null) return null;
    var rest = m[2].trim();
    var words = rest.split(/\s+/).filter(Boolean);
    if (words.length === 2 && /^(oz|ounce|ounces|lb|lbs)$/.test(words[0]) && PACKAGES.test(words[1])) return { n: 1, unit: UNIT_SINGULAR[words[1]] || words[1], size: fmtNum(n) + ' ' + (words[0] === 'lbs' ? 'lb' : words[0]), count: 1 }; // "28 oz can" = one can
    var u = words[0] || '';
    u = u === 'lbs' || u === 'pound' || u === 'pounds' ? 'lb' : (u === 'ounce' || u === 'ounces' ? 'oz' : (u === 'cups' ? 'cup' : (UNIT_SINGULAR[u] || u.replace(/s$/, ''))));
    return { n: n, unit: u, size: size };
  }
  function lbOf(p) {
    if (!p) return 0;
    if (p.unit === 'lb') return p.n;
    if (p.unit === 'oz') return p.n / 16;
    var sz = /([\d.¼½¾]+)\s*(lb|oz)/.exec(p.size || '');
    if (sz) { var v = parseNum(sz[1]) || 0; return p.n * (sz[2] === 'oz' ? v / 16 : v); }
    return 0;
  }
  function storeQty(it) {
    var parts = [].concat(it.qtys || []).map(looseQty).filter(Boolean);
    var x = it.extra || {}, unit = it.unit;
    var plural = function (n, u) { return fmtNum(n) + ' ' + (n === 1 ? u : (STORE_PLURAL[u] || u)); };
    if (unit === 'name') return '';
    if (unit === 'raw') return sumQty(it.qtys || []);
    if (unit === 'count') {
      var c = 0, size = '';
      parts.forEach(function (p) { if (!p.unit || /^(whole|large|medium|small|piece)$/.test(p.unit)) { c += p.n; if (p.size) size = p.size; } });
      c = Math.max(1, Math.ceil(c - 1e-9));
      return String(c) + (size ? ' (' + size + (c > 1 ? ' each' : '') + ')' : '');
    }
    if (unit === 'lb') {
      var lb = 0;
      parts.forEach(function (p) { lb += lbOf(p) || (!p.unit && x.perLb ? p.n / x.perLb : 0); });
      lb = x.perLb ? Math.ceil(lb - 1e-9) : Math.ceil(lb * 4 - 1e-9) / 4; // produce by the bag (whole pounds); meat to the quarter pound
      return lb ? fmtNum(lb) + ' lb' : '1 lb';
    }
    if (unit === 'head' && x.cloves) { // a head is about 10 cloves; loose cloves come out of the heads you buy
      var heads = 0, cloves = 0;
      parts.forEach(function (p) { if (p.unit === 'head') heads += p.n; else if (p.unit === 'clove') cloves += p.n; });
      return plural(Math.max(1, Math.max(Math.ceil(heads - 1e-9), Math.ceil(cloves / x.cloves - 1e-9))), 'head');
    }
    if (unit === 'bunch') {
      var b = 0;
      parts.forEach(function (p) { if (p.unit === 'bunch') b += p.n; else if (p.unit === 'stalk' && x.perBunch) b += p.n / x.perBunch; });
      return plural(Math.max(1, Math.ceil(b - 1e-9)), 'bunch');
    }
    if (unit === 'dozen') {
      var eggs = 0;
      parts.forEach(function (p) { eggs += p.unit === 'dozen' ? p.n * 12 : (!p.unit || p.unit === 'egg' ? p.n : 0); });
      return Math.max(1, Math.ceil(eggs / 12 - 1e-9)) + ' dozen';
    }
    if (unit === 'can') {
      var cans = 0, csize = '';
      parts.forEach(function (p) { if (p.unit === 'can') { cans += p.count || p.n; if (p.size) csize = p.size; } });
      cans = Math.max(1, cans);
      return plural(cans, 'can') + (csize ? ' (' + csize + ')' : '');
    }
    // packages (bag, tub, jar, pack, container, carton, piece, head): the explicit package count, cups turned into packages
    var pk = 0, cups = 0;
    parts.forEach(function (p) { if (p.unit === unit) pk += p.n; else if (p.unit === 'cup') cups += p.n; });
    if (x.cupsPer) pk += cups / x.cupsPer;
    if (x.perPack) parts.forEach(function (p) { if (!p.unit) pk += p.n / x.perPack; });
    return plural(Math.max(1, Math.ceil(pk - 1e-9)), unit);
  }
  /**
   * F: build the store list. entries: [{ item, qty, section }] (recipe lines and snack ideas).
   * Returns { items: [{ key, name, aisle, qty, note }] } — staples have aisle "Check you have" and no amount.
   */
  function storeList(entries) {
    var by = {}, order = [];
    (entries || []).forEach(function (e) {
      String(e.qty == null ? '' : e.qty).split(/\s*\+\s*/).forEach(function (q, qi) {
        if (qi && !q) return;
        storeItem(e.item, q, e.section).forEach(function (it) {
          if (!it.key) return;
          var cur = by[it.key];
          if (!cur) { cur = by[it.key] = { key: it.key, name: it.name, aisle: it.aisle, unit: it.unit, extra: it.extra, note: it.note || '', qtys: [] }; order.push(it.key); }
          if (it.qty) cur.qtys.push(it.qty);
          if (!cur.note && it.note) cur.note = it.note;
        });
      });
    });
    return { items: order.map(function (k) { var it = by[k]; return { key: it.key, name: it.name, aisle: it.aisle, qty: storeQty(it), note: it.note }; }) };
  }

  // ------------------------------------------------------------- shared goal
  function sharedGoalProgress(goal, people) {
    goal = goal || { type: 'minutes', target: 300 };
    if (goal.type === 'pounds') {
      var lost = 0;
      people.forEach(function (p) {
        var cur = p.series && p.series.length ? p.series[p.series.length - 1].trend : null;
        if (cur != null && p.startWeight) lost += Math.max(0, p.startWeight - cur);
      });
      return { type: 'pounds', value: round(lost, 1), target: +goal.target || 20, pct: clamp(lost / (+goal.target || 20), 0, 1) };
    }
    var mins = people.reduce(function (a, p) { return a + (p.weekMinutes || 0); }, 0);
    var target = +goal.target || 300;
    return { type: 'minutes', value: mins, target: target, pct: clamp(mins / target, 0, 1) };
  }

  // ------------------------------------------------------------- validation
  var LIMITS = {
    lbs: [60, 700], inches: [15, 90], hours: [0, 16], steps: [0, 100000], energy: [1, 5],
    reps: [0, 300], seconds: [0, 3600], minutes: [0, 600], sets: [1, 20], level: [1, 10]
  };
  function validNumber(kind, v) {
    var n = +v;
    var r = LIMITS[kind];
    return typeof v !== 'boolean' && v !== '' && v != null && isFinite(n) && (!r || (n >= r[0] && n <= r[1]));
  }

  // ============================================================= Round 2
  /** "dana" -> "Dana", "mary  ann" -> "Mary Ann". Leaves the rest of each word as typed. */
  function capName(s) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().replace(/(^|[\s\-'])([a-zà-þ])/g, function (m, pre, c) { return pre + c.toUpperCase(); });
  }

  // ------------------------------------------------------------- protein (B7)
  var LB_PER_KG = 2.20462;
  /**
   * Daily protein target in grams. Weight loss with strength training: 1.2-1.6 g/kg (Leidy et al.,
   * Am J Clin Nutr 2015). We use 1.4 g/kg of goal weight, or 1.2 g/kg of current weight when there
   * is no goal (so body fat doesn't inflate it). Pregnancy / nursing: 1.1 g/kg of current weight,
   * at least 71 g (Institute of Medicine RDA), no weight-loss adjustment.
   */
  function proteinTarget(opts) {
    var cur = +opts.weight || 0, goal = +opts.goal || 0;
    var stage = opts.lifeStage || '';
    var pregnantOrNursing = ['pregnant', 'nursing', 'postpartum'].indexOf(stage) >= 0;
    if (!cur && !goal) return { grams: 90, low: 80, high: 110, basis: 'default' };
    var g, basis;
    if (pregnantOrNursing) { g = Math.max(71, 1.1 * (cur || goal) / LB_PER_KG); basis = 'safe'; }
    else if (goal && (!cur || goal < cur)) { g = 1.4 * goal / LB_PER_KG; basis = 'goal'; }
    else { g = 1.2 * (cur || goal) / LB_PER_KG; basis = 'current'; }
    var grams = clamp(Math.round(g / 5) * 5, 60, 160);
    return { grams: grams, low: Math.round(grams * 0.85 / 5) * 5, high: Math.round(grams * 1.15 / 5) * 5, basis: basis };
  }
  /** Grams logged on a date from 'protein' check-ins (value = "portionId:grams"). */
  function proteinOn(checkins, date) {
    var total = 0, items = [];
    (checkins || []).forEach(function (c) {
      if (c.kind !== 'protein' || c.date !== date) return;
      var g = +String(c.value).split(':')[1];
      if (isFinite(g) && g > 0) { total += g; items.push(c); }
    });
    return { grams: Math.round(total), items: items };
  }

  // ------------------------------------------------------------- blood tests (B3)
  /** Common markers: canonical unit and conversions from other units seen on lab reports. */
  var LAB_MARKERS = {
    vitamin_d: { name: 'Vitamin D (25-OH)', unit: 'ng/mL', alt: { 'nmol/l': 1 / 2.496 } },
    b12: { name: 'Vitamin B12', unit: 'pg/mL', alt: { 'pmol/l': 1.355 } },
    folate: { name: 'Folate', unit: 'ng/mL', alt: { 'nmol/l': 1 / 2.266 } },
    ferritin: { name: 'Ferritin', unit: 'ng/mL', alt: { 'ug/l': 1, 'µg/l': 1, 'mcg/l': 1 } },
    iron: { name: 'Iron', unit: 'µg/dL', alt: { 'umol/l': 5.585, 'µmol/l': 5.585 } },
    hemoglobin: { name: 'Hemoglobin', unit: 'g/dL', alt: { 'g/l': 0.1 } },
    a1c: { name: 'Hemoglobin A1c', unit: '%', alt: { 'mmol/mol': 'a1c' } },
    glucose: { name: 'Glucose (fasting)', unit: 'mg/dL', alt: { 'mmol/l': 18.016 } },
    total_chol: { name: 'Total cholesterol', unit: 'mg/dL', alt: { 'mmol/l': 38.67 } },
    ldl: { name: 'LDL cholesterol', unit: 'mg/dL', alt: { 'mmol/l': 38.67 } },
    hdl: { name: 'HDL cholesterol', unit: 'mg/dL', alt: { 'mmol/l': 38.67 } },
    triglycerides: { name: 'Triglycerides', unit: 'mg/dL', alt: { 'mmol/l': 88.57 } },
    tsh: { name: 'TSH (thyroid)', unit: 'mIU/L', alt: { 'uiu/ml': 1, 'µiu/ml': 1, 'miu/l': 1 } },
    free_t4: { name: 'Free T4', unit: 'ng/dL', alt: { 'pmol/l': 1 / 12.87 } }
  };
  var LAB_KEYS = Object.keys(LAB_MARKERS);
  function normUnit(u) { return String(u || '').toLowerCase().replace(/\s+/g, '').replace('mcg', 'ug').replace('μ', 'µ'); }
  /** Value in the marker's canonical unit, or null if the unit can't be converted. */
  function labCanonical(key, value, unit) {
    var m = LAB_MARKERS[key];
    var v = +value;
    if (!m || value === '' || value == null || !isFinite(v)) return null;
    var u = normUnit(unit);
    if (!u || u === normUnit(m.unit) || (key === 'ferritin' && /ng\/ml/.test(u)) || (key === 'iron' && /ug\/dl|µg\/dl/.test(u))) return v;
    var f = m.alt[u] != null ? m.alt[u] : m.alt[u.replace('u', 'µ')];
    if (f === 'a1c') return round(v / 10.929 + 2.15, 1);
    return f ? round(v * f, 2) : null;
  }
  /**
   * Flag a lab value: {flag: 'low'|'high'|'normal'|'unknown', severity: 'ok'|'mild'|'see_doctor', note}.
   * Uses the lab's printed range first, then fixed, well-established cut-offs for common markers
   * (NIH ODS for vitamin D and B12, ADA for A1c and glucose, NCEP/ACC for lipids).
   */
  function labAssess(m) {
    var key = m.key, v = +m.value;
    var out = { flag: 'unknown', severity: 'ok', note: '' };
    if (m.value === '' || m.value == null || !isFinite(v)) {
      if (m.flag === 'high' || m.flag === 'low') { out.flag = m.flag; out.severity = 'mild'; out.note = 'Outside the lab\'s range.'; }
      return out;
    }
    var lo = m.refLow === '' || m.refLow == null ? null : +m.refLow, hi = m.refHigh === '' || m.refHigh == null ? null : +m.refHigh;
    if (lo != null && isFinite(lo) && v < lo) { out.flag = 'low'; out.severity = 'mild'; out.note = 'Below the lab\'s range.'; }
    else if (hi != null && isFinite(hi) && v > hi) { out.flag = 'high'; out.severity = 'mild'; out.note = 'Above the lab\'s range.'; }
    else if ((lo != null && isFinite(lo)) || (hi != null && isFinite(hi))) out.flag = 'normal';
    else if (m.flag === 'high' || m.flag === 'low') { out.flag = m.flag; out.severity = 'mild'; out.note = 'Marked ' + m.flag + ' by the lab.'; }
    var c = LAB_MARKERS[key] ? labCanonical(key, v, m.unit) : null;
    var set = function (flag, sev, note) {
      var rank = { ok: 0, mild: 1, see_doctor: 2 };
      if (rank[sev] >= rank[out.severity]) { out.flag = flag; out.severity = sev; out.note = note; }
      else if (out.flag === 'unknown') out.flag = flag;
    };
    if (c == null) return out;
    switch (key) {
      case 'vitamin_d':
        if (c < 12) set('low', 'see_doctor', 'In the deficient range (under 12 ng/mL).');
        else if (c < 20) set('low', 'mild', 'Below the level most people need (20 ng/mL).');
        else if (c > 100) set('high', 'see_doctor', 'Very high (over 100 ng/mL) — usually from supplements.');
        else if (c > 50) set('high', 'mild', 'Higher than needed (over 50 ng/mL).');
        else set('normal', 'ok', 'In a healthy range.');
        break;
      case 'b12':
        if (c < 200) set('low', 'see_doctor', 'Low (under 200 pg/mL).');
        else if (c < 300) set('low', 'mild', 'Borderline (200–300 pg/mL).');
        else set('normal', 'ok', 'In a healthy range.');
        break;
      case 'ferritin':
        if (c < 15) set('low', 'see_doctor', 'Iron stores are very low (under 15 ng/mL).');
        else if (c < 30) set('low', 'mild', 'Iron stores are on the low side (under 30 ng/mL).');
        else if (c > 1000) set('high', 'see_doctor', 'Very high (over 1,000 ng/mL).');
        else if (c > 300) set('high', 'mild', 'Higher than usual (over 300 ng/mL).');
        else set('normal', 'ok', 'In a healthy range.');
        break;
      case 'hemoglobin':
        if (c < 10) set('low', 'see_doctor', 'Low (under 10 g/dL).');
        else if (c < 12) set('low', 'mild', 'On the low side (under 12 g/dL).');
        break;
      case 'a1c':
        if (c >= 6.5) set('high', 'see_doctor', 'In the diabetes range (6.5% or higher).');
        else if (c >= 5.7) set('high', 'mild', 'In the prediabetes range (5.7–6.4%).');
        else set('normal', 'ok', 'In the normal range (under 5.7%).');
        break;
      case 'glucose':
        if (c >= 126) set('high', 'see_doctor', 'High for a fasting test (126 mg/dL or higher).');
        else if (c >= 100) set('high', 'mild', 'Above normal for a fasting test (100–125 mg/dL).');
        else if (c < 70) set('low', 'mild', 'Low (under 70 mg/dL).');
        else set('normal', 'ok', 'In the normal fasting range.');
        break;
      case 'ldl':
        if (c >= 190) set('high', 'see_doctor', 'Very high (190 mg/dL or higher).');
        else if (c >= 160) set('high', 'mild', 'High (160–189 mg/dL).');
        else if (c >= 130) set('high', 'mild', 'Borderline high (130–159 mg/dL).');
        else set('normal', 'ok', c < 100 ? 'Optimal (under 100 mg/dL).' : 'Near optimal (100–129 mg/dL).');
        break;
      case 'total_chol':
        if (c >= 240) set('high', 'mild', 'High (240 mg/dL or higher).');
        else if (c >= 200) set('high', 'mild', 'Borderline high (200–239 mg/dL).');
        else set('normal', 'ok', 'Desirable (under 200 mg/dL).');
        break;
      case 'hdl':
        if (c < 40) set('low', 'mild', 'Low — higher HDL is better (40+).');
        else set('normal', 'ok', c >= 60 ? 'Good — higher is better.' : 'In the usual range.');
        break;
      case 'triglycerides':
        if (c >= 500) set('high', 'see_doctor', 'Very high (500 mg/dL or higher).');
        else if (c >= 200) set('high', 'mild', 'High (200–499 mg/dL).');
        else if (c >= 150) set('high', 'mild', 'Borderline high (150–199 mg/dL).');
        else set('normal', 'ok', 'Normal (under 150 mg/dL).');
        break;
      case 'tsh':
        if (c < 0.1 || c > 10) set(c < 0.1 ? 'low' : 'high', 'see_doctor', 'Well outside the usual range (0.4–4.5).');
        else if (c < 0.4 || c > 4.5) set(c < 0.4 ? 'low' : 'high', 'mild', 'Outside the usual range (0.4–4.5).');
        else set('normal', 'ok', 'In the usual range.');
        break;
      default: break;
    }
    return out;
  }

  // ------------------------------------------------------------- iPhone Health numbers (B5)
  /** Parse "7,532", "182.4 lb", "82 kg", "27000" (sleep seconds), "450 min", "7:30" into app units. */
  function parseHealthNumber(kind, raw) {
    if (raw === undefined || raw === null) return null;
    var s = String(raw).trim().toLowerCase();
    if (!s) return null;
    var hm = /^(\d{1,2}):(\d{2})$/.exec(s);
    var n = hm ? +hm[1] + (+hm[2]) / 60 : +s.replace(/,/g, '').replace(/[^0-9.\-]/g, '');
    if (!isFinite(n) || s.replace(/[^0-9]/g, '') === '') return null;
    if (kind === 'steps') return Math.round(n);
    if (kind === 'weight') {
      if (/kg/.test(s)) n = n * LB_PER_KG;
      else if (/\bst\b|stone/.test(s)) n = n * 14;
      return round(n, 1);
    }
    if (kind === 'sleep') {
      if (hm) return round(n * 4, 0) / 4;
      // "7 hr 30 min", "7h 30m", "450 min", "7.5 hours"
      var hh = /(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b/.exec(s), mm = /(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)\b/.exec(s);
      if (hh) return Math.round((+hh[1] + (mm ? +mm[1] / 60 : 0)) * 4) / 4;
      if (mm) return Math.round((+mm[1] / 60) * 4) / 4;
      if (/sec|\bs\b/.test(s) || n > 24 * 60) n = n / 3600;
      else if (/min/.test(s) || n > 24) n = n / 60;
      return Math.round(n * 4) / 4;
    }
    return n;
  }

  // ------------------------------------------------------------- talking with the coach (B2)
  /** A short utterance that means "end the conversation". */
  function isStopPhrase(text) {
    var t = String(text || '').toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!t || t.split(' ').length > 5) return false;
    return /^(ok(ay)? )?(stop( talking| listening| please| now)?|that'?s (all|it)( for now)?|(good ?)?bye( now)?|end( the)?( conversation| chat)?|i'?m done|we'?re done|nothing else|no thanks|thank you that'?s all)( thanks| thank you)?$/.test(t);
  }

  /** Default workout reminder time from the setup answer "best time". */
  function workoutReminderTime(times) {
    var t = [].concat(times || []).join(' ').toLowerCase();
    if (/early|morning/.test(t)) return '07:30';
    if (/lunch|midday|noon/.test(t)) return '12:30';
    if (/afternoon/.test(t)) return '16:30';
    if (/asleep|night|late/.test(t)) return '20:30';
    if (/evening|after work/.test(t)) return '19:00';
    return '19:00';
  }

  // ------------------------------------------------------------- Round 3.2
  /**
   * Rule 10: THE one place that turns a moment into New York's date and clock (America/New_York, with daylight
   * saving from 2:00 am on the 2nd Sunday of March to 2:00 am on the 1st Sunday of November). Runs the same on the
   * phone, in the back office and in tests, whatever the machine's own time zone. t = Date | ISO string | ms | 'YYYY-MM-DD'.
   */
  function ny(t) {
    if (typeof t === 'string' && isISODate(t)) return { date: t, minutes: 0, hm: '00:00', weekday: weekday(t), offset: nyOffset(t) };
    var ms = t == null ? Date.now() : (t instanceof Date ? t.getTime() : (typeof t === 'number' ? t : Date.parse(t)));
    if (!isFinite(ms)) return null;
    var y = toISO(ms).slice(0, 4);
    var start = parseISO(y + '-03-' + pad(8 + (7 - weekday(y + '-03-01')) % 7)) + 7 * 3600000; // 2:00 am EST = 07:00 UTC
    var end = parseISO(y + '-11-' + pad(1 + (7 - weekday(y + '-11-01')) % 7)) + 6 * 3600000;   // 2:00 am EDT = 06:00 UTC
    var off = ms >= start && ms < end ? -4 : -5;
    var d = new Date(ms + off * 3600000);
    var date = d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
    var minutes = d.getUTCHours() * 60 + d.getUTCMinutes();
    return { date: date, minutes: minutes, hm: minToHM(minutes), weekday: d.getUTCDay(), offset: off };
  }
  /** The New York date of a moment ('' if it isn't a time). */
  function nyDate(t) { var n = ny(t); return n ? n.date : ''; }

  /**
   * A spoken line split for a fast first sound (A3): sentence by sentence, so the first sentence is made and played
   * while the rest loads. Decimals ("7.5 hours") never split; no part is over ~300 characters; tiny pieces ride along.
   */
  function speechParts(text) {
    var clean = String(text || '').replace(/[•·→]/g, ', ').replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    var sent = [], cur = '';
    for (var i = 0; i < clean.length; i++) {
      var ch = clean.charAt(i);
      cur += ch;
      if ('.!?'.indexOf(ch) >= 0) {
        while (i + 1 < clean.length && /[.!?"'’”)\]]/.test(clean.charAt(i + 1))) { i++; cur += clean.charAt(i); }
        if (i + 1 >= clean.length || clean.charAt(i + 1) === ' ') { sent.push(cur.trim()); cur = ''; }
      }
    }
    if (cur.trim()) sent.push(cur.trim());
    var out = [];
    sent.forEach(function (s) {
      while (s.length > 300) {
        var cut = s.lastIndexOf(', ', 280);
        if (cut < 80) cut = s.lastIndexOf(' ', 280);
        if (cut < 40) cut = 280;
        out.push(s.slice(0, cut + 1).trim());
        s = s.slice(cut + 1).trim();
      }
      if (s) out.push(s);
    });
    var merged = [];
    out.forEach(function (s) {
      var n = merged.length, last = merged[n - 1];
      if (n === 1 && last.length < 20 && (last + ' ' + s).length <= 80) merged[0] = last + ' ' + s;           // "Logged. Nice work."
      else if (n > 1 && last.length < 40 && (last + ' ' + s).length <= 300) merged[n - 1] = last + ' ' + s;  // fewer requests after the first
      else merged.push(s);
    });
    return merged;
  }
  /** A fixed spoken line's file id (A2): FNV-1a over the exact text. The build script and the app use this same function. */
  function voiceId(text) {
    var h = 0x811c9dc5, s = String(text || '');
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8) + s.length.toString(36);
  }

  /**
   * E5: the coach card shows a real sentence from the coach, never the plan. The morning message is written as three plan
   * lines ("Strength: 20 minutes…", "Walk: …", "Weigh in…") and then one line of encouragement: this returns the first
   * sentence of the first line that isn't a plan line ('' if there is none).
   */
  function coachSentence(text) {
    var lines = String(text || '').split(/\n+/).map(function (l) { return l.trim(); }).filter(Boolean);
    var planLike = function (l) {
      var t = l.toLowerCase();
      return /^(strength|walk(ing)?|weigh|rest|light|workout|cool-?down|warm-?up|shabbat|yom tov|fast|stretch|today'?s plan)\b[^.]{0,60}[:—–]/.test(t) ||
        /^(weigh in|walk \d|strength \d|rest day|light day|walk day)/.test(t) || /^\W*(strength|walk|light day|rest day)[^.]{0,20}\b\d+[- ]?(min|minutes?)\b/.test(t);
    };
    for (var i = 0; i < lines.length; i++) {
      if (planLike(lines[i])) continue;
      var first = speechParts(lines[i])[0] || '';
      var m = /^(.+?[.!?])(\s|$)/.exec(first);
      var s = (m ? m[1] : first).replace(/!/g, '.').trim();
      if (s.length >= 12) return s;
    }
    return '';
  }
  /** E4: the Protein sheet's line: grams to go and about how many 30 g palm-size portions that is. */
  function proteinLine(left) {
    left = Math.round(left);
    if (left <= 0) return 'Target reached for today.';
    if (left <= 20) return left + ' g to go. A yogurt or two eggs will do it.';
    var n = Math.max(1, Math.round(left / 30));
    var words = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
    return left + ' g to go. About ' + (words[n] || String(n)) + ' palm-size portion' + (n === 1 ? '' : 's') + '.';
  }
  /** H6: a list joined into a sentence: lowercase after the first item, except names and words like "Greek". */
  function joinList(items) {
    var keep = /^(Greek|Shabbat|Yom Tov|Friday|Monday|Tuesday|Wednesday|Thursday|Sunday|Motzei|Pesach|Sukkot|Hashem|Torah|Israeli|PAR-Q|ACSM|WHO|NIH|USDA|OK|I)\b/;
    return (items || []).filter(function (x) { return x != null && String(x).trim() !== ''; }).map(function (x, i) {
      x = String(x).trim();
      if (!i || keep.test(x) || /^[A-Z]{2,}/.test(x)) return x;
      return x.charAt(0).toLowerCase() + x.slice(1);
    }).join(', ');
  }

  return {
    // Round 3.2
    ny: ny, nyDate: nyDate, speechParts: speechParts, voiceId: voiceId, coachSentence: coachSentence, proteinLine: proteinLine, joinList: joinList, mealTitle: mealTitle,
    // dates
    pad: pad, isISODate: isISODate, addDays: addDays, daysBetween: daysBetween, weekday: weekday, weekStart: weekStart,
    dateRange: dateRange, hmToMin: hmToMin, minToHM: minToHM, fmt12: fmt12, WEEKDAYS: WEEKDAYS, WEEKDAYS_SHORT: WEEKDAYS_SHORT,
    round: round, clamp: clamp,
    // calendar
    parseHebcal: parseHebcal, fallbackDay: fallbackDay, calDay: calDay, quietState: quietState,
    BROOKLYN: BROOKLYN, RT_MINUTES: RT_MINUTES, nyOffset: nyOffset, sunsetMin: sunsetMin, sunsetHM: sunsetHM, rtEnd: rtEnd, withRT: withRT, restWindow: restWindow,
    // plan
    DEFAULT_SCHEDULE: DEFAULT_SCHEDULE, NEUTRAL_TYPES: NEUTRAL_TYPES, MODE_DAYS: MODE_DAYS,
    activeMode: activeMode, modeOn: modeOn, modeUntil: modeUntil, dayType: dayType, isWeighInDay: isWeighInDay,
    weeklyWalkTarget: weeklyWalkTarget, walkMinutesFor: walkMinutesFor, stepTarget: stepTarget, pickVersion: pickVersion,
    dayPlan: dayPlan, planLines: planLines,
    // exercise
    PATTERNS: PATTERNS, PATTERN_NAMES: PATTERN_NAMES, startingLevels: startingLevels, levelsFor: levelsFor,
    exerciseAt: exerciseAt, maxLevel: maxLevel, buildSession: buildSession, progressionCheck: progressionCheck, truthy: truthy,
    // streaks
    HABIT_KEYS: HABIT_KEYS, dayStatus: dayStatus, computeStreak: computeStreak, currentGap: currentGap,
    buildStatuses: buildStatuses, bestStreak: bestStreak,
    // weight
    dailyWeights: dailyWeights, trendSeries: trendSeries, trendAt: trendAt, trendRate: trendRate, isPlateau: isPlateau,
    tooFast: tooFast, recommendPace: recommendPace,
    // misc
    earnedMilestones: earnedMilestones, weekSummary: weekSummary, bedtimeSpread: bedtimeSpread,
    supplementChecks: supplementChecks, refillDue: refillDue, nextAction: nextAction, sharedGoalProgress: sharedGoalProgress,
    planKey: planKey, todayPlan: todayPlan, dayDone: dayDone, nextUp: nextUp, MEAL_KEYS: MEAL_KEYS,
    AISLES: AISLES, CHECK_AISLE: CHECK_AISLE, storeList: storeList, storeItem: storeItem, groceryAisle: groceryAisle, capItem: capItem, groceryName: groceryName, groceryKey: groceryKey, parseQty: parseQty, sumQty: sumQty, parseGroceryInput: parseGroceryInput,
    LIMITS: LIMITS, validNumber: validNumber,
    // Round 2
    capName: capName, proteinTarget: proteinTarget, proteinOn: proteinOn,
    LAB_MARKERS: LAB_MARKERS, LAB_KEYS: LAB_KEYS, labCanonical: labCanonical, labAssess: labAssess,
    parseHealthNumber: parseHealthNumber, isStopPhrase: isStopPhrase, workoutReminderTime: workoutReminderTime
  };
});
