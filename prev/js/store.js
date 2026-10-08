/* Our Plan — app state: cached server data, optimistic writes, and derived values. */
import { L, K, todayISO, nowMinutes, uid } from './core.js';
import { Config, LS, Queue, call } from './api.js';

const EMPTY_LOGS = { checkins: [], workouts: [], sets: [], weights: [], waists: [], sleep: [], steps: [], energy: [], supplog: [] };
const SKEY = () => 'op_state_' + (Config.token || '').slice(0, 10);
const listeners = new Set();
let version = 0;
const memo = new Map();
function cached(key, fn) {
  const k = version + '|' + key;
  if (memo.has(k)) return memo.get(k);
  if (memo.size > 400) memo.clear();
  const v = fn();
  memo.set(k, v);
  return v;
}

export const S = {
  data: null,
  syncing: false,
  lastSync: 0,
  error: null,
  ui: LS.json('op_ui', {}),

  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  changed() { version++; listeners.forEach((fn) => fn()); },
  load() { this.data = normalize(LS.json(SKEY(), null)); this.lastSync = +(LS.get(SKEY() + '_t') || 0); version++; return this.data; },
  persist() { if (this.data) { LS.set(SKEY(), JSON.stringify(this.data)); LS.set(SKEY() + '_t', String(this.lastSync)); } },
  setUi(k, v) { this.ui[k] = v; LS.set('op_ui', JSON.stringify(this.ui)); },

  /** Fetch everything from the server, then re-apply writes that haven't synced yet. */
  async sync() {
    if (this.syncing || !Config.token) return;
    this.syncing = true; this.changed();
    try {
      const data = await call('state', {}, { timeout: 60000 });
      this.data = normalize(data);
      Queue.items().forEach((op) => applyOptimistic(this.data, op));
      this.lastSync = Date.now();
      this.error = null;
      this.persist();
      if (this.onSynced) { try { this.onSynced(); } catch (e) { /* ignore */ } }
    } catch (e) {
      this.error = e;
    } finally {
      this.syncing = false;
      this.changed();
    }
  },

  /** Save something: instant on screen, queued for the server, synced in the background. */
  write(action, body, opts = {}) {
    const op = Queue.add(action, body);
    if (this.data && opts.optimistic !== false) { applyOptimistic(this.data, op); this.persist(); }
    this.changed();
    flushSoon();
    return op;
  },

  // ---------------------------------------------------------------- basics
  get ready() { return !!this.data; },
  today() { return todayISO(); },
  minutes() { return nowMinutes(); },
  me() { return this.data ? this.data.me : null; },
  meId() { return this.data ? this.data.me.id : ''; },
  people() { return this.data ? [this.data.me].concat(this.data.people || []) : []; },
  partner() { return this.data && this.data.people && this.data.people[0] || null; },
  person(id) { return this.people().find((p) => p.id === id) || null; },
  visible(id) { return !!(this.data && this.data.logs && this.data.logs[id]); },
  logs(id) { return (this.data && this.data.logs && this.data.logs[id]) || EMPTY_LOGS; },
  profile(id) { const p = this.person(id || this.meId()); return (p && p.profile) || {}; },
  settings(id) { const p = this.person(id || this.meId()); return (p && p.settings) || {}; },
  isOwner() { return !!(this.data && this.data.flags && this.data.flags.owner); },
  // ---------------------------------------------------------------- Round 2
  household() { return Object.assign({ voice: 'marin', voice_on: true, coach_tier: 'standard', budget_usd: 15, app_pointer: 'current', voices: [], shopping_day: 4, grocery_time: '19:00' }, (this.data && this.data.household) || {}); },
  ownerName() { return this.household().ownerName || (this.isOwner() ? (this.me() || {}).name : 'the owner'); },
  /** Protein for a day: target (B7) and grams from one-tap portions. */
  protein(id, date) {
    id = id || this.meId(); date = date || this.today();
    return cached('protein' + id + date, () => {
      const p = this.profile(id);
      const ws = this.logs(id).weights;
      const last = ws.length ? +ws[ws.length - 1].lbs : +p.weight_start;
      const t = L.proteinTarget({ weight: last, goal: +p.goal_weight, lifeStage: p.life_stage });
      const day = L.proteinOn(this.logs(id).checkins, date);
      return Object.assign({}, t, { have: day.grams, items: day.items, pct: Math.min(1, day.grams / t.grams) });
    });
  },
  labs(id) { return ((this.data && this.data.labs && this.data.labs[id || this.meId()]) || []); },
  notes(id) { return ((this.data && this.data.notes && this.data.notes[id || this.meId()]) || []); },
  recap() { return (this.data && this.data.recap) || null; },
  hasCoach() { return !!(this.data && this.data.flags && this.data.flags.hasKey); },
  setupDone(id) { return !!this.profile(id).setup_done; },
  cal() {
    const fallback = LS.json('op_cal', {});
    return Object.assign({}, fallback, (this.data && this.data.cal) || {});
  },
  day(date) { return L.calDay(this.cal(), date || this.today()); },
  quiet() { return L.quietState(this.cal(), this.today(), this.minutes(), { preMin: 15, postMin: 0 }); },
  /** "Shabbat 6:06 – 7:36" / "Shabbat ends 7:36" (A2). */
  restWindow() { return L.restWindow(this.cal(), this.today()); },

  // ---------------------------------------------------------------- plan
  mode(id, date) {
    const m = this.settings(id).mode;
    return m && m.key && L.activeMode(m, date || this.today()) ? m : null;
  },
  weekIndex(id) {
    const p = this.profile(id);
    const start = p.start_date || p.setup_done || this.today();
    return Math.max(0, Math.floor(L.daysBetween(start, this.today()) / 7));
  },
  latest(id, date) {
    return cached('latest' + id + date, () => {
      const out = {};
      this.logs(id).checkins.filter((c) => c.date === date).sort((a, b) => (String(a.ts) < String(b.ts) ? -1 : 1)).forEach((c) => { out[c.kind] = c; });
      return out;
    });
  },
  /**
   * THE day plan (C5). The back office sends it with every sync; the app uses it as long as nothing that decides
   * the plan has changed on this phone since. Otherwise it runs the very same shared function with the same inputs.
   */
  dayPlan(id, date) {
    id = id || this.meId(); date = date || this.today();
    return cached('dp' + id + date, () => {
      const ctx = this.planCtx(id, date);
      const srv = this.data && this.data.today;
      if (id === this.meId() && srv && srv.date === date && srv.key === L.planKey(ctx)) return srv;
      return L.todayPlan(ctx);
    });
  },
  planCtx(id, date) {
    const s = this.settings(id), p = this.profile(id);
    const start = p.start_date || p.setup_done || date;
    const m = s.mode && s.mode.key && L.activeMode(s.mode, date) ? s.mode : null;
    const en = this.logs(id).energy.filter((e) => e.date === date).map((e) => +e.level).pop();
    const meal = this.data && this.data.meal;
    return {
      date, days: this.cal(), schedule: s.schedule || null, mode: m, weigh: { mode: s.weigh_mode || 'daily', day: s.weigh_day == null ? 3 : s.weigh_day },
      activity: p.activity, weekIndex: Math.max(0, Math.floor(L.daysBetween(start, date) / 7)), versionPref: s.version_pref || null, minutesAvailable: p.minutes_available,
      safe: !!(this.person(id) || {}).safe, energy: en == null ? null : en, dayVersion: s.day_version && s.day_version.date === date ? +s.day_version.v : null,
      levels: this.levels(id), swaps: p.swaps || {}, exercises: this.library(), mealPlan: meal ? meal.plan : null, mealWeek: meal ? meal.weekStart : '', recipes: this.recipes()
    };
  },
  plan(id, date) { return this.dayPlan(id, date); },
  /** What's done today (minutes, workout, habits, weigh-in, protein, sleep, energy). */
  done(id, date) { id = id || this.meId(); date = date || this.today(); return cached('done' + id + date, () => L.dayDone(this.logs(id), date)); },
  /** Next up: the first undone item in today's plan. */
  next() {
    const id = this.meId(), today = this.today();
    const c = this.catchup(id);
    return L.nextUp({ plan: this.dayPlan(), done: this.done(), minutes: this.minutes(), quiet: this.quiet(), catchupPending: !!c && (!c.erevDone || !c.restDone), preShabbatDone: !!(this.latest(id, today).preshabbat) });
  },
  recipes() {
    return cached('recipes', () => {
      const custom = ((this.data && this.data.content && this.data.content.recipes) || []).filter((r) => r.status !== 'rejected');
      return custom.concat(K.RECIPES.filter((r) => !custom.some((c) => c.id === r.id)));
    });
  },
  recipe(id) { return this.recipes().find((r) => r.id === id) || null; },
  levels(id) { const p = this.profile(id); return p.levels || L.startingLevels({ activity: p.activity, safe: (this.person(id) || {}).safe, injuries: p.injuries || [] }); },
  library() {
    return cached('library', () => {
      const custom = ((this.data && this.data.content && this.data.content.exercises) || []).filter((e) => e.status === 'active');
      const ids = new Set(custom.map((e) => e.id));
      return K.EXERCISES.filter((e) => !ids.has(e.id)).concat(custom);
    });
  },
  exercise(id) { return this.library().find((e) => e.id === id) || null; },
  /** Today's session, straight from the day plan. */
  session(id, date) {
    const w = this.dayPlan(id, date).workout;
    return { version: w.minutes, type: w.kind, moves: w.moves || [], warmupMinutes: w.warmup || 2, cooldownMinutes: w.cooldown || 2 };
  },

  // ---------------------------------------------------------------- streaks & progress
  statuses(id) {
    return cached('st' + id, () => {
      const p = this.profile(id);
      const today = this.today();
      const start = p.start_date || p.setup_done || today;
      const from = start > L.addDays(today, -74) ? start : L.addDays(today, -74);
      const lg = this.logs(id);
      return L.buildStatuses({ from, to: today, days: this.cal(), schedule: this.settings(id).schedule, modeHistory: (this.person(id) || {}).modeHistory || [], checkins: lg.checkins, workouts: lg.workouts });
    });
  },
  streak(id) {
    return cached('streak' + id, () => {
      const p = this.profile(id);
      return L.computeStreak(this.statuses(id).statuses, this.today(), { startDate: p.start_date || p.setup_done });
    });
  },
  gap(id) { const p = this.profile(id); return L.currentGap(this.statuses(id).statuses, this.today(), p.start_date || p.setup_done); },
  series(id) { return cached('series' + id, () => L.trendSeries(this.logs(id).weights)); },
  week(id, ws) {
    ws = ws || L.weekStart(this.today());
    return cached('week' + id + ws, () => {
      const lg = this.logs(id);
      const st = this.statuses(id);
      return L.weekSummary({ weekStart: ws, checkins: latestOnly(lg.checkins), workouts: lg.workouts, steps: lg.steps, sleep: lg.sleep, statuses: st.statuses, types: st.types });
    });
  },
  stepTarget(id) {
    const p = this.profile(id);
    return L.stepTarget({ activity: p.activity, startDate: p.start_date, today: this.today(), steps: this.logs(id).steps });
  },
  supplements(id) { return ((this.data && this.data.supplements && this.data.supplements[id || this.meId()]) || []).filter((s) => s.status !== 'stopped'); },
  suppChecks(id) {
    const mine = this.supplements(id).filter((s) => s.status === 'active').map((s) => ({ catalogId: s.suppId, name: s.name }));
    return L.supplementChecks({ catalog: K.SUPPLEMENTS, mine, meds: this.profile(id).meds, safe: !!(this.person(id) || {}).safe });
  },
  /** Motzei Shabbat / after Yom Tov: is there an erev day still waiting to be logged? */
  catchup(id) {
    const today = this.today();
    const cal = this.cal();
    const q = this.quiet();
    if (q.quiet) return null;
    const todayDay = L.calDay(cal, today);
    // only right after a rest day ends (tonight) or the next day
    let restEnd = null;
    if (todayDay.isRest && todayDay.havdalah) restEnd = today;
    else if (L.calDay(cal, L.addDays(today, -1)).isRest) restEnd = L.addDays(today, -1);
    if (!restEnd) return null;
    let d = restEnd, rest = [];
    while (L.calDay(cal, d).isRest && rest.length < 4) { rest.unshift(d); d = L.addDays(d, -1); }
    const erev = d;
    const lg = this.logs(id);
    const has = (date, kinds) => lg.checkins.some((c) => c.date === date && kinds.indexOf(c.kind) >= 0);
    const erevDone = has(erev, ['catchup', 'workout', 'walk', 'preshabbat']) || lg.workouts.some((w) => w.date === erev);
    const restDone = rest.some((r) => has(r, ['shabbat']));
    if (erevDone && restDone) return null;
    if (this.ui['catchup_dismissed_' + restEnd]) return null;
    const p = this.profile(id);
    if (p.setup_done && erev < p.setup_done) return null;
    return { erev, rest, restEnd, erevDone, restDone, label: L.weekday(rest[rest.length - 1]) === 6 && rest.length === 1 ? 'Shabbat' : 'Shabbat / Yom Tov' };
  },
  unreadCheers() {
    const seen = this.ui.cheers_seen || '';
    return ((this.data && this.data.together && this.data.together.cheers) || []).filter((c) => c.to === this.meId() && c.ts > seen);
  },
  proposals() {
    if (!this.data) return [];
    const c = this.data.content || {};
    const out = [];
    (c.exercises || []).filter((x) => x.status === 'proposed').forEach((x) => out.push({ tab: 'Exercises', id: x.rowId, title: x.name, kind: 'exercise', detail: x.reason || '' }));
    (c.recipes || []).filter((x) => x.status === 'proposed').forEach((x) => out.push({ tab: 'Recipes', id: x.rowId, title: x.title, kind: 'recipe', detail: x.kind }));
    (c.ifthen || []).filter((x) => x.status === 'proposed').forEach((x) => out.push({ tab: 'IfThenPlans', id: x.rowId, title: x.situation, kind: 'plan', detail: '' }));
    (c.habits || []).filter((x) => x.status === 'proposed').forEach((x) => out.push({ tab: 'Settings', id: x.rowId, title: x.label, kind: 'habit', detail: x.why || '' }));
    this.supplements(this.meId()).filter((x) => x.status === 'proposed').forEach((x) => out.push({ tab: 'Supplements', id: x.id, title: x.name, kind: 'supplement', detail: (x.data && x.data.reason) || '' }));
    ((this.data.together && this.data.together.challenges) || []).filter((x) => x.status === 'proposed').forEach((x) => out.push({ tab: 'Challenges', id: x.rowId, title: x.title, kind: 'challenge', detail: x.description || '' }));
    return out;
  },
  habits(id) {
    const custom = ((this.data && this.data.content && this.data.content.habits) || []).filter((h) => h.status === 'active' && (!h.userId || h.userId === (id || this.meId())));
    return K.HABITS.concat(custom.map((h) => ({ key: h.key, label: h.label, short: h.label, why: h.why })));
  }
};

const HOUSEHOLD = ['coach_tier', 'voice', 'voice_on', 'budget_usd', 'app_pointer', 'shopping_day', 'grocery_time'];
/** Names always shown with a capital first letter (A3), even from an older cached copy. */
function normalize(d) {
  if (!d || !d.me) return d;
  d.me.name = L.capName(d.me.name);
  (d.people || []).forEach((p) => { p.name = L.capName(p.name); });
  if (d.household && d.household.ownerName) d.household.ownerName = L.capName(d.household.ownerName);
  return d;
}

function latestOnly(checkins) {
  const by = {};
  checkins.slice().sort((a, b) => (String(a.ts) < String(b.ts) ? -1 : 1)).forEach((c) => { by[c.date + '|' + c.kind] = c; });
  return Object.keys(by).map((k) => by[k]);
}

const flushSoon = (() => { let t = null; return () => { clearTimeout(t); t = setTimeout(() => S.flush && S.flush(), 150); }; })();

/** Make a queued write visible right away (and again after each sync until it reaches the server). */
export function applyOptimistic(data, op) {
  if (!data || !data.me) return;
  const me = data.me.id;
  const b = op.body || {};
  const lg = data.logs[me] = data.logs[me] || JSON.parse(JSON.stringify(EMPTY_LOGS));
  const ts = new Date(op.ts).toISOString();
  const date = b.date || todayISO(new Date(op.ts));
  const pid = 'tmp_' + op.cid;
  const exists = (arr) => arr.some((r) => r.id === pid);
  switch (op.action) {
    case 'checkin':
      if (exists(lg.checkins)) return;
      lg.checkins.push({ id: pid, ts, date, kind: b.kind, value: b.value, pending: true });
      if (b.kind === 'workout' && b.value === 'yes') lg.workouts.push({ id: pid + 'w', ts, date, kind: b.workoutKind || 'strength', version: b.version, minutes: b.minutes || b.version, source: 'quick', pending: true });
      if (b.kind === 'walk' && b.value === 'yes') lg.workouts.push({ id: pid + 'w', ts, date, kind: 'walk', minutes: b.minutes || 20, family: !!b.family, source: 'quick', pending: true });
      if (b.kind === 'supplements' && b.value === 'yes') ((data.supplements && data.supplements[me]) || []).filter((s) => s.status === 'active').forEach((s) => lg.supplog.push({ id: pid + s.suppId, ts, date, suppId: s.suppId, taken: true, pending: true }));
      break;
    case 'logWorkout':
      if (exists(lg.workouts)) return;
      if (b.replaces) lg.workouts = lg.workouts.filter((w) => w.id !== b.replaces);
      lg.workouts.push({ id: pid, ts, date, kind: b.kind || 'strength', version: b.version, minutes: b.minutes || b.version, felt: b.felt, pain: !!b.pain, pending: true });
      (b.sets || []).forEach((s, i) => lg.sets.push({ id: pid + 's' + i, workoutId: pid, date, exerciseId: s.exerciseId, pattern: s.pattern, level: s.level, setNo: s.setNo, reps: s.reps, seconds: s.seconds, felt: s.felt, pain: !!s.pain, pending: true }));
      break;
    case 'logWalk':
      if (exists(lg.workouts)) return;
      if (b.replaces) lg.workouts = lg.workouts.filter((w) => w.id !== b.replaces);
      lg.workouts.push({ id: pid, ts, date, kind: 'walk', minutes: +b.minutes, steps: b.steps, family: !!b.family, pending: true });
      if (b.steps) lg.steps.push({ id: pid + 's', ts, date, steps: +b.steps, pending: true });
      break;
    case 'logWeight': if (!exists(lg.weights)) lg.weights.push({ id: pid, ts, date, lbs: +b.lbs, pending: true }); break;
    case 'logWaist': if (!exists(lg.waists)) lg.waists.push({ id: pid, ts, date, inches: +b.inches, notch: b.notch, pending: true }); break;
    case 'logSleep': if (!exists(lg.sleep)) lg.sleep.push({ id: pid, ts, date, hours: +b.hours, bedtime: b.bedtime || '', pending: true }); break;
    case 'logSteps': if (!exists(lg.steps)) lg.steps.push({ id: pid, ts, date, steps: +b.steps, pending: true }); break;
    case 'logEnergy': if (!exists(lg.energy)) lg.energy.push({ id: pid, ts, date, level: +b.level, pending: true }); break;
    case 'logSupplement': if (!exists(lg.supplog)) lg.supplog.push({ id: pid, ts, date, suppId: b.suppId, taken: !!b.taken, pending: true }); break;
    case 'catchup':
      if (exists(lg.checkins)) return;
      if (b.friDate && b.fri) lg.checkins.push({ id: pid, ts, date: b.friDate, kind: 'catchup', value: b.fri === 'done' ? 'yes' : 'no', pending: true });
      if (b.satDate && b.sat) lg.checkins.push({ id: pid + 's', ts, date: b.satDate, kind: 'shabbat', value: b.sat, pending: true });
      break;
    case 'retract':
      ['checkins', 'workouts', 'weights', 'waists', 'sleep', 'steps', 'energy', 'supplog'].forEach((k) => { lg[k] = lg[k].filter((r) => r.id !== b.id); });
      if (data.together) data.together.cheers = data.together.cheers.filter((c) => c.id !== b.id);
      break;
    case 'cheer':
      data.together = data.together || { cheers: [] };
      if (!data.together.cheers.some((c) => c.id === pid)) data.together.cheers.push({ id: pid, ts, from: me, to: (data.people[0] || {}).id, kind: b.kind, text: b.kind === 'nudge' ? K.NUDGE : b.text, pending: true });
      break;
    case 'grocery':
      // Round 3: add/remove are applied by the Groceries page itself (with merging); checks remember who
      if (data.meal && (b.op === 'check' || b.op === 'uncheck')) data.meal.grocery.forEach((g) => { if (g.key === b.key) { g.checked = b.op === 'check'; g.by = me; } });
      if (data.meal && b.op === 'remove') data.meal.grocery = data.meal.grocery.filter((g) => g.key !== b.key);
      break;
    case 'settings': {
      const target = b.forUser ? (data.people || []).find((p) => p.id === b.forUser) : data.me;
      Object.keys(b.values || {}).forEach((k) => {
        const v = b.values[k];
        if (k === 'shared_goal') { if (data.together) data.together.goal = v; return; }
        if (HOUSEHOLD.indexOf(k) >= 0) { data.household = Object.assign({}, data.household || {}, { [k]: v }); return; }
        if (!target) return;
        target.settings = target.settings || {};
        if (k === 'notify') {
          const cur = target.settings.notify || {};
          const n = Object.assign({}, cur);
          Object.keys(v || {}).forEach((t) => { n[t] = Object.assign({}, cur[t] || {}, v[t]); });
          target.settings.notify = n;
        } else if (k === 'tour_seen' || k === 'tips_seen') target.settings[k] = Object.assign({}, target.settings[k] || {}, v);
        else target.settings[k] = v;
      });
      break;
    }
    case 'notes': {
      const uid2 = b.userId || me;
      const list = (data.notes = data.notes || {})[uid2] = (data.notes[uid2] || []);
      if (b.op === 'add' && !list.some((n) => n.id === pid)) list.unshift({ id: pid, ts, note: b.text, category: b.category || 'note', source: 'self', pending: true });
      if (b.op === 'edit') list.forEach((n) => { if (n.id === b.id) { n.note = b.text; if (b.category) n.category = b.category; n.pending = true; } });
      if (b.op === 'forget') data.notes[uid2] = list.filter((n) => n.id !== b.id);
      break;
    }
    case 'labEdit':
      Object.values(data.labs || {}).forEach((rows) => rows.forEach((r) => { if (r.id === b.id) { r.value = +b.value; const a = L.labAssess({ key: r.key, value: +b.value, unit: r.unit, refLow: r.refLow, refHigh: r.refHigh }); r.flag = a.flag; r.severity = a.severity; r.pending = true; } }));
      break;
    case 'setMode':
      data.me.settings.mode = b.mode === 'none' ? { key: '', since: todayISO(), until: '' } : { key: b.mode, since: todayISO(), until: L.modeUntil(b.mode, todayISO()) };
      break;
    case 'saveProfile':
      data.me.profile = Object.assign({}, data.me.profile, b.values || {});
      if (b.done && !data.me.profile.setup_done) {
        data.me.profile.setup_done = todayISO();
        data.me.profile.start_date = data.me.profile.start_date || todayISO();
        data.me.profile.levels = L.startingLevels({ activity: data.me.profile.activity, safe: data.me.safe, injuries: data.me.profile.injuries || [] });
      }
      break;
    case 'setLevel':
      data.me.profile.levels = Object.assign({}, data.me.profile.levels || {}, { [b.pattern]: +b.level });
      if (data.me.profile.swaps) delete data.me.profile.swaps[b.pattern];
      break;
    case 'swap':
      data.me.profile.swaps = Object.assign({}, data.me.profile.swaps || {});
      if (b.to) data.me.profile.swaps[b.pattern] = b.to; else delete data.me.profile.swaps[b.pattern];
      break;
    case 'snoozeLevel':
      data.me.profile.level_snooze = Object.assign({}, data.me.profile.level_snooze || {}, { [b.exerciseId]: todayISO() });
      break;
    case 'confirm': {
      const c = data.content || {};
      const set = (arr, key) => (arr || []).forEach((x) => { if (x[key] === b.id) x.status = b.accept ? 'active' : 'rejected'; });
      set(c.exercises, 'rowId'); set(c.recipes, 'rowId'); set(c.ifthen, 'rowId'); set(c.habits, 'rowId');
      set(data.supplements && data.supplements[me], 'id');
      set(data.together && data.together.challenges, 'rowId');
      break;
    }
    case 'challenge':
      ((data.together && data.together.challenges) || []).forEach((x) => { if (x.id === b.id || x.rowId === b.id) x.status = { accept: 'active', decline: 'declined', done: 'done' }[b.op] || x.status; });
      break;
    case 'reward':
      if (data.together) {
        if (b.op === 'add') data.together.rewards.push({ id: pid, title: b.title, unlock: b.unlock, status: 'idea', pending: true });
        else data.together.rewards.forEach((r) => { if (r.id === b.id) r.status = { earn: 'earned', claim: 'claimed', remove: 'deleted' }[b.op]; });
        data.together.rewards = data.together.rewards.filter((r) => r.status !== 'deleted');
      }
      break;
    case 'coupleCheckin':
      if (data.together && !data.together.couple.some((c) => c.id === pid)) data.together.couple.push({ id: pid, ts, weekStart: L.weekStart(todayISO()), userId: me, answers: b.answers, pending: true });
      break;
    case 'supplements': {
      const list = data.supplements[me] = data.supplements[me] || [];
      if (b.op === 'add' && !list.some((s) => s.suppId === b.suppId && s.status !== 'stopped')) {
        const cat = K.SUPPLEMENTS.find((s) => s.id === b.suppId);
        list.push({ id: pid, suppId: b.suppId, name: cat ? cat.name : b.name, dose: b.dose || '', timing: cat ? cat.timingShort : '', status: 'active', ts, pending: true });
      }
      if (b.op === 'stop') list.forEach((s) => { if (s.id === b.id) s.status = 'stopped'; });
      if (b.op === 'refill') list.forEach((s) => { if (s.id === b.id) { s.lastRefill = b.date || todayISO(); s.refillDays = b.refillDays || s.refillDays || 30; } });
      break;
    }
    default: break;
  }
}

export function newCid() { return uid('c'); }
