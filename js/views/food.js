/* Round 4 food screens (section 3): Plan the week (R4PlanWeek), Change this meal (R4MealSwap), the Freezer, and the Plan
 * tab's meals card (R4Plan: today's meals, tap to change, "from Monday's supper", the thaw line) and rating card.
 * Every kosher and timing rule shown here is the same shared code the back office enforces (L.validateWeek). */
import { L, K, esc, icon, toast, openSheet, updateSheet, closeSheet, shortDate, dayName, busy, preparePhoto } from '../core.js?v=132c8397ab';
import { S } from '../store.js?v=229f42e888';
import { call } from '../api.js?v=b8330e966d';
import { go, rerender, route } from '../nav.js?v=57c55c9996';
import { nav, pageTitle, card, listCard, row, primary, textBtn, seg, picks, kindChip, sectionTitle, swipe } from '../ui.js?v=9375313392';

const MEALS = ['breakfast', 'lunch', 'dinner'];
const MEAL_NAME = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Supper' };
const DAY3 = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Shabbos'];
const r4 = () => (S.data && S.data.round4) || {};
/** The week being planned (Saturday night: the coming week) and its saved plan. */
export function weekStart() { return r4().week ? r4().week.weekStart : L.weekStart(S.today()); }
export function weekPlan() { return r4().week && r4().week.plan; }
/** This week's Round 4 plan (for today's meals), or the week being planned when it is this week. */
export function currentPlan() {
  const t = r4().thisWeek;
  if (t && t.plan) return t.plan;
  if (weekStart() === L.weekStart(S.today()) && weekPlan()) return weekPlan();
  const m = S.data && S.data.meal; // an older plan for this week (made before Round 4) still shows today's meals
  return m && m.weekStart === L.weekStart(S.today()) ? m.plan : null;
}
const recipesById = () => { const m = {}; S.recipes().forEach((r) => { m[r.id] = r; }); return m; };
const ratingOf = (id) => (r4().ratings || {})[id] || '';
function slotOf(plan, date, meal) { const d = plan && (plan.days || []).find((x) => x.date === date); return d ? d[meal] : null; }
function slotTitle(s, byId) { if (!s) return ''; const r = s.recipe_id ? byId[s.recipe_id] : null; return L.mealTitle(s.text, r); }
function fromLine(s) { if (!s || !s.leftoverOf) return ''; const [d] = String(s.leftoverOf).split(':'); return 'from ' + dayName(d) + '\'s supper'; }
export function ctxFor(plan) {
  const h = S.household(), mt = r4().mealTimes || { breakfast: '07:30', lunch: '12:30', dinner: '18:30' };
  const rt = r4().ratings || {};
  return { recipes: recipesById(), days: S.cal(), mealTimes: mt, gapHours: +h.meat_dairy_hours || 6, never: Object.keys(rt).filter((k) => rt[k] === 'never'), quick: ((plan && plan.inputs) || {}).busy || [], recent: {}, locked: {},
    proteinTargets: S.people().map((p) => S.protein(p.id).grams || 100) };
}

// ------------------------------------------------------------------ the Plan tab's meals (R4Plan, 3.7)
export function mealsCard() {
  const plan = currentPlan();
  const today = S.today(), byId = recipesById();
  if (!plan) {
    return `<div>${sectionTitle('Today\'s meals')}${card(`<p class="sub">This week's meals aren't planned yet. Plan them together in a few taps.</p>${textBtn('Plan the week', 'go', { 'data-to': 'plan/week/plan' }, { cls: 'block', icon: 'calendar-days' })}`)}</div>`;
  }
  const rows = MEALS.map((k) => {
    const s = slotOf(plan, today, k);
    if (!s || (!s.text && !s.recipe_id)) return '';
    const r = s.recipe_id ? byId[s.recipe_id] : null;
    const mins = +s.minutes || (r && +r.minutes) || 0;
    let eyebrow = MEAL_NAME[k];
    if (k === 'lunch' && s.leftoverOf) eyebrow += ' · ' + fromLine(s);
    if (k === 'dinner' && mins && !s.leftoverOf && !s.freezer) eyebrow += ' · ' + mins + ' min';
    let sub = '';
    if (k === 'dinner') sub = thawLine(plan, today, s);
    const act = k === 'dinner' && r ? 'go' : 'meal-change';
    const data = k === 'dinner' && r ? { 'data-to': 'plan/recipe/' + r.id } : { 'data-date': today, 'data-meal': k };
    return row({ eyebrow, labelHtml: `<span class="t">${esc(slotTitle(s, byId))}</span>${kindChip(L.kindOf(s, r))}`, sub: sub ? esc(sub) : '', act, data, cls: 'meal' });
  });
  return `<div>${sectionTitle('Today\'s meals', '<span class="caption">Tap one to change it</span>')}${listCard(rows, 'no-ic today-meals')}</div>`;
}
/** 6.2: "Take it out tonight" (tomorrow's freezer supper) / "Thawing in the fridge since last night" (today's). */
export function thawLine(plan, date, s) {
  const fr = r4().freezer || [];
  const isFreezer = (x) => x && (x.freezer || (x.recipe_id && fr.some((f) => f.recipe_id && f.recipe_id === x.recipe_id)));
  if (isFreezer(s)) return 'Thawing in the fridge since last night';
  const tom = slotOf(plan, L.addDays(date, 1), 'dinner');
  if (isFreezer(tom)) return 'Take tomorrow\'s ' + String(tom.text || 'supper').replace(/^Freezer: /, '').toLowerCase() + ' out tonight';
  return '';
}
/** 3.8: the day after a supper, one line on Plan: "How was the chicken?" (one tap; swipe to dismiss). */
export function ratingCard() {
  const plan = currentPlan() || (S.data.meal && S.data.meal.plan);
  const y = L.addDays(S.today(), -1);
  const s = slotOf(plan, y, 'dinner');
  if (!s || !s.recipe_id || s.leftoverOf) return '';
  const r = recipesById()[s.recipe_id];
  if (!r || ratingOf(r.id) && ((S.ui.rated || {})[r.id] || '') >= y) return '';
  if ((S.ui.rateHidden || {})[y] || (S.ui.rated || {})[r.id] === y) return '';
  // Round 6 (1.9): it names the day and the meal ("How was Tuesday's supper?" with the dish under it), never a guessed word
  const q = L.weekday(y) === 5 ? 'How was Friday night\'s meal?' : 'How was ' + dayName(y) + '\'s supper?';
  const inner = `<div class="card rate-card"><p class="h3">${esc(q)}</p><p class="sub">${esc(L.mealTitle(r.title, r))}</p><div class="picks fit" style="margin-top:10px">${[['loved', 'Loved it'], ['fine', 'Fine'], ['never', 'Never again']].map(([v, l]) => `<button type="button" class="pick" data-act="rate" data-id="${esc(r.id)}" data-v="${v}">${l}</button>`).join('')}</div></div>`;
  return swipe(inner, 'rate-hide', { 'data-d': y }, 'Hide');
}
/** Plan tab rows (3.7). */
export function moreRows() {
  const plan = weekPlan() || currentPlan();
  const meals = plan ? (plan.days || []).reduce((a, d) => a + MEALS.filter((m) => d[m] && (d[m].text || d[m].recipe_id) && !/^fast day/i.test(d[m].text || '')).length, 0) : 0;
  const fr = (r4().freezer || []).reduce((a, f) => a + (+f.portions || 0), 0);
  const added = ((r4().week && r4().week.grocery) || (S.data.meal && S.data.meal.grocery) || []).filter((g) => /^x_/.test(g.key) || g.source === 'voice').length;
  return [
    row({ icon: 'calendar-days', label: 'This week\'s plan', value: meals ? meals + ' meals' : 'Plan it', act: 'go', data: { 'data-to': 'plan/week/plan' } }),
    row({ icon: 'shopping-cart', label: 'Groceries', value: added ? added + ' added' : '', act: 'go', data: { 'data-to': 'plan/order' } }),
    row({ icon: 'book-open', label: 'Recipes', value: String(S.recipes().filter((r) => r.status !== 'proposed' && r.status !== 'rejected').length), act: 'go', data: { 'data-to': 'plan/recipes' } }),
    row({ icon: 'snowflake', label: 'Freezer', value: fr ? fr + (fr === 1 ? ' meal' : ' meals') : 'Empty', act: 'go', data: { 'data-to': 'plan/freezer' } })
  ];
}

// ------------------------------------------------------------------ Plan the week (R4PlanWeek, 3.3–3.5)
export function render(r) {
  if (r.parts[1] === 'freezer') return freezerPage();
  return weekScreen();
}
export const inputs = () => { const p = weekPlan(); const ui = (S.ui.weekInputs || {})[weekStart()]; return ui || (p && p.inputs) || { busy: [], guests: [] }; };
export function setInputs(v) { const all = Object.assign({}, S.ui.weekInputs || {}); all[weekStart()] = v; S.setUi('weekInputs', all); }
function weekScreen() {
  const ws = weekStart(), plan = weekPlan(), byId = recipesById(), inp = inputs();
  const p = S.partner();
  const here = p && (r4().week && r4().week.presence || {})[p.id] && Date.now() - Date.parse(r4().week.presence[p.id]) < 120000;
  const head = nav({ back: 'Meals', backTo: 'meals', title: 'Plan the week', right: here ? `<span class="caption here">${esc(p.name)} is here too</span>` : '' })
    + pageTitle('Plan the week', 'Sunday, ' + shortDate(ws) + ' – Shabbos, ' + shortDate(L.addDays(ws, 6)));
  const owner = S.person(S.household().ownerId) || S.me();
  const road = (S.settings(owner.id).road_days || [1, 2, 3, 4]);
  const guests = inp.guests || [];
  const quick = card(`<div class="eyebrow">This week</div>
    <p class="row-label" style="margin-top:8px">Busy nights (quick suppers)</p>
    <div class="picks fit" role="group" aria-label="Busy nights" style="margin-top:8px">${[0, 1, 2, 3, 4].map((i) => { const d = L.addDays(ws, i), on = (inp.busy || []).indexOf(d) >= 0; return `<button type="button" class="pick${on ? ' on' : ''}" aria-pressed="${on}" data-act="busy-night" data-d="${d}">${DAY3[i]}</button>`; }).join('')}</div>
    <div class="inset">${row({ label: 'Guests', sub: guests.length ? esc(guests.map((g) => g.meal + ', ' + g.count + ' more').join('; ')) : 'None', act: 'guests-sheet', cls: 'no-ic wrap' })}${row({ label: owner.name + '\'s lunch', sub: road.length ? 'On the road ' + rangeText(road) : 'At home', act: 'road-days', cls: 'no-ic wrap' })}</div>`, 'quick');
  if (!plan) {
    return head + `<div class="stack">${quick}${primary('Draw the week', 'week-draft', {}, { icon: 'sparkles' })}<p class="caption center">The coach drafts suppers, lunches and Shabbos. Every meal is checked for meat and dairy, timing and your busy nights.</p>
      <div class="center">${textBtn('Workouts and walks this week', 'go', { 'data-to': 'workouts/week' })}</div></div>`;
  }
  const days = (plan.days || []).slice(0, 6).map((d, i) => dayCard(d, i, plan, byId));
  const sat = (plan.days || [])[6] || {}, fri = (plan.days || [])[5] || {};
  const cal = L.calDay(S.cal(), fri.date || L.addDays(ws, 5));
  const lunchGuests = guests.find((g) => /shabbos lunch/i.test(g.meal));
  const shab = card(`<div class="eyebrow">Shabbos${cal.candles ? ' · candles ' + esc(L.fmt12(cal.candles)) : ''}</div><div class="inset">
    ${shabRow('Friday night', fri, 'dinner', byId)}${shabRow('Shabbos lunch' + (lunchGuests ? ' · ' + (2 + lunchGuests.count + 2) + ' people' : ''), sat, 'lunch', byId)}${shabRow('Seudah shlishis', sat, 'dinner', byId)}</div>`, 'shab');
  const ch = L.weekChecks(plan, ctxFor(plan));
  const checks = card(`<div class="eyebrow">The week checks out</div><div class="checks">
    ${checkLine(ch.proteinDays >= ch.days - 1, 'Protein on target ' + ch.proteinDays + ' of ' + ch.days + ' days for both', 'By the coach\'s estimate, from the recipes')}
    ${checkLine(ch.vegSuppers === ch.suppers, ch.vegSuppers === ch.suppers ? 'Vegetables at every supper' : 'Vegetables at ' + ch.vegSuppers + ' of ' + ch.suppers + ' suppers')}
    ${ch.usesFirst.length ? checkLine(true, 'Uses the ' + andList(ch.usesFirst) + ' before they turn') : ''}</div>`);
  return head + `<div class="stack">${quick}
    <div>${sectionTitle('The week', '<span class="caption">Tap a meal to change or lock it</span>')}<div class="stack-s">${days.join('')}${shab}</div></div>
    ${checks}
    ${plan.why ? `<p class="sub" style="margin:0 4px">${esc(plan.why)}</p>` : ''}
    ${prepCard(plan)}
    <div>${primary('Make the Breadberry order', 'go', { 'data-to': 'meals/groceries' })}
      <label class="btn-text block file-btn" style="margin-top:4px">${icon('camera')}<span>Snap the fridge first</span><input type="file" accept="image/*" capture="environment" data-change="fridge-snap" aria-label="Snap the fridge first"></label></div>
    <div class="center">${textBtn('Draw the week again', 'week-draft', { 'data-again': '1' })}<p class="caption">Locked meals stay.</p></div>
    <div class="center">${textBtn('Workouts and walks this week', 'go', { 'data-to': 'workouts/week' })}</div></div>`;
}
/** 6.4: the plan's Sunday prep steps, longest first (Cook mode runs them as one session). */
export function prepSteps(plan) {
  const out = [];
  ((plan && plan.days) || []).forEach((d) => MEALS.forEach((m) => { const s = d[m]; ((s && s.prepAhead) || []).forEach((p) => out.push({ text: p.text, minutes: +p.minutes || 10, for: (s.text || '') })); }));
  return out.sort((a, b) => b.minutes - a.minutes);
}
export function prepCard(plan) {
  const steps = prepSteps(plan);
  if (!steps.length) return '';
  const total = steps.reduce((a, s) => a + s.minutes, 0);
  return card(`<div class="split"><span class="eyebrow">Sunday prep</span><span class="sub">about ${total} min</span></div>
    <ol class="steps prep">${steps.map((s) => `<li><span class="body">${esc(s.text)}</span> <span class="sub">${s.minutes} min</span></li>`).join('')}</ol>
    ${textBtn('Start in Cook mode', 'go', { 'data-to': 'cook/prep' }, { icon: 'chef-hat' })}`, 'prep-card');
}
export function andList(a) { a = (a || []).filter(Boolean); return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
function rangeText(days) { const s = days.slice().sort(); const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']; return s.length > 2 && s[s.length - 1] - s[0] === s.length - 1 ? names[s[0]] + '–' + names[s[s.length - 1]] : s.map((d) => names[d]).join(', '); }
function checkLine(ok, text, sub) { return `<div class="check-line">${icon(ok ? 'check' : 'circle-alert', 'ic-s ' + (ok ? 't-accent' : 't-2'))}<span><span class="body">${esc(text)}</span>${sub ? `<span class="caption" style="display:block">${esc(sub)}</span>` : ''}</span></div>`; }
function shabRow(label, day, meal, byId) {
  const s = day[meal] || {};
  return row({ label, sub: esc(slotTitle(s, byId) || 'Not planned'), act: 'meal-change', data: { 'data-date': day.date, 'data-meal': meal }, right: s.locked ? icon('lock', 'ic-s t-2') : '', cls: 'no-ic wrap' });
}
function dayCard(d, i, plan, byId) {
  const dk = L.dayKind(S.cal(), d.date), cal = L.calDay(S.cal(), d.date);
  const tags = [DAY3[i].toUpperCase()];
  if (cal.holiday) tags.push(cal.holiday.toUpperCase());
  else if (dk === 'fast') tags.push('FAST');
  else if (((plan.inputs || {}).busy || []).indexOf(d.date) >= 0) tags.push('QUICK');
  else if (dk === 'erev') tags.push('LIGHT');
  // erev Shabbos: the card is the light daytime (Friday night is in the Shabbos card)
  const mainMeal = dk === 'erev' && L.weekday(d.date) === 5 ? 'lunch' : 'dinner';
  const sup = d[mainMeal] || {}, r = sup.recipe_id ? byId[sup.recipe_id] : null;
  const small = [MEALS.slice(0, mainMeal === 'lunch' ? 1 : 2).map((m) => { const s = d[m] || {}; return slotTitle(s, byId) + (s.leftoverOf ? ', ' + fromLine(s) : ''); }).filter(Boolean).join(' · ')];
  if (sup.cookDouble) small.push('cook double, freeze half');
  if (sup.freezer) small.push('from the freezer');
  return `<div class="card daycard"><button type="button" class="dc-main" data-act="meal-change" data-date="${esc(d.date)}" data-meal="${mainMeal}" aria-label="${esc(dayName(d.date))} ${mainMeal === 'lunch' ? 'lunch' : 'supper'}: ${esc(slotTitle(sup, byId))}. Change it">
      <span class="split"><span class="eyebrow">${esc(tags.join(' · '))}</span><span class="dc-right">${sup.locked ? icon('lock', 'ic-s t-2') : ''}${kindChip(L.kindOf(sup, r))}</span></span>
      <span class="dc-title">${esc(slotTitle(sup, byId) || 'Not planned')}</span></button>
    <button type="button" class="dc-sub" data-act="day-meals" data-date="${esc(d.date)}" aria-label="${esc(dayName(d.date))} breakfast and lunch">${esc(small.filter(Boolean).join(' · '))}</button></div>`;
}

// ------------------------------------------------------------------ Change this meal (R4MealSwap, 3.6)
let swap = null; // { date, meal, mode: 'recipes'|'own', q, ideas, kind, loading }
function swapSheet() {
  const { date, meal } = swap;
  const plan = weekPlan() && slotOf(weekPlan(), date, meal) ? weekPlan() : currentPlan();
  const cur = slotOf(plan, date, meal) || {};
  const byId = recipesById(), label = dayName(date) + ' ' + (meal === 'dinner' ? 'supper' : meal);
  const ctx = ctxFor(plan);
  const kindNow = L.kindOf(cur, cur.recipe_id ? byId[cur.recipe_id] : null);
  const minutes = (L.dayKind(S.cal(), date) === 'normal' && ctx.quick.indexOf(date) >= 0 && meal === 'dinner') ? 25 : Math.max(30, +cur.minutes || 60);
  let body = `<div class="eyebrow">${esc(label)}</div>` + seg([['recipes', 'From recipes'], ['own', 'Type my own']], swap.mode, 'swap-mode', { label: 'Choose how' });
  if (swap.mode === 'own') {
    body += `<label class="field"><span>The meal</span><input id="own-text" value="${esc(swap.text || '')}" placeholder="For example: mushroom barley soup" autocomplete="off"></label>
      <div class="picks fit" role="group" aria-label="Kind">${[['meat', 'Meat'], ['dairy', 'Dairy'], ['pareve', 'Pareve']].map(([k, l]) => `<button type="button" class="pick${swap.kind === k ? ' on' : ''}" aria-pressed="${swap.kind === k}" data-act="own-kind" data-k="${k}">${l}</button>`).join('')}</div>
      <label class="field"><span>Ingredients (optional, one per line)</span><textarea id="own-ing" rows="3" placeholder="1 lb mushrooms&#10;1 cup pearl barley">${esc(swap.ing || '')}</textarea></label>
      <p class="caption">They go on the order through the store list.</p>${primary('Save', 'own-save')}`;
  } else {
    const q = String(swap.q || '').toLowerCase();
    // (walk W19) a breakfast is chosen from breakfasts; every name as on the meal rows and the grid
    const cands = S.recipes().filter((r) => r.status !== 'proposed' && r.status !== 'rejected' && r.meal !== 'side' && (meal !== 'breakfast' || r.meal === 'breakfast') && (!q || r.title.toLowerCase().indexOf(q) >= 0));
    const fit = cands.map((r) => {
      const test = JSON.parse(JSON.stringify(plan || { days: [] }));
      const day = (test.days || []).find((x) => x.date === date);
      if (day) day[meal] = { recipe_id: r.id, text: r.title, kind: r.kind, minutes: +r.minutes || 0 };
      const errs = L.validateWeek({ days: day ? [day] : [] }, Object.assign({}, ctx, { recipes: byId })).filter((e) => e.meal === meal || e.rule === 'gap');
      return { r, why: errs.map((e) => whyNot(e, r, date, meal, plan, byId)).filter(Boolean)[0] || '' };
    }).sort((a, b) => (!!a.why - !!b.why) || (mealFit(b.r, meal) - mealFit(a.r, meal)) || (ratingOf(b.r.id) === 'loved') - (ratingOf(a.r.id) === 'loved'));
    const rowsHtml = fit.slice(0, 24).map(({ r, why }) => row({ label: L.mealTitle(r.title, r), sub: why ? esc(why) : esc((r.minutes ? r.minutes + ' min' : '') + (ratingOf(r.id) === 'loved' ? ' · you loved it' : '')), right: kindChip(r.kind), act: why ? '' : 'swap-pick', data: { 'data-id': r.id }, cls: 'no-ic' + (why ? ' dim' : '') })).join('');
    const ideas = swap.ideas ? swap.ideas.map((x) => row({ label: x.title, sub: x.minutes + ' min', right: kindChip(x.kind), act: 'swap-idea', data: { 'data-t': x.title, 'data-k': x.kind, 'data-m': x.minutes }, cls: 'no-ic' })).join('') : '';
    body += `<label class="field search"><span class="sr">Search recipes</span><input id="swap-q" type="search" value="${esc(swap.q || '')}" placeholder="Search recipes" data-change="swap-search" autocomplete="off"></label>
      <div class="inset">${row({ icon: 'sparkles', label: 'Something like this', sub: '3 ideas from the coach, ' + (kindNow === 'fish' ? 'pareve' : kindNow) + ', under ' + (minutes >= 60 ? 'an hour' : minutes + ' minutes'), act: 'swap-like', data: { 'data-k': kindNow, 'data-m': minutes }, cls: 'wrap' })}${ideas}</div>
      <div><div class="eyebrow" style="margin:0 4px 6px">Fits ${esc(label)}</div><div class="inset">${rowsHtml || row({ label: 'No recipes match', cls: 'no-ic' })}</div></div>`;
  }
  const locked = !!cur.locked;
  body += `<div><label class="row no-ic lockrow" for="lock-sw"><span class="row-main"><span class="row-label">Lock this meal</span></span><input type="checkbox" class="switch" id="lock-sw" data-change="swap-lock" ${locked ? 'checked' : ''} aria-label="Lock this meal"></label><p class="caption" style="margin:6px 4px 0">Locked meals stay when the coach redraws the week.</p></div>`;
  const open = document.querySelector('#sheet-root.open .sheet-body');
  if (open && open.dataset.kind === 'swap') return updateSheet({ title: 'Change this meal', body });
  const b = openSheet({ title: 'Change this meal', body, label: 'Change ' + label });
  b.dataset.kind = 'swap';
  return b;
}
/** Suppers first for a supper, breakfasts for a breakfast (then everything else). */
function mealFit(r, meal) { const m = r.meal || 'dinner'; return meal === 'dinner' ? (m === 'dinner' || m === 'shabbat' ? 2 : (m === 'lunch' ? 1 : 0)) : (m === meal ? 2 : (meal === 'lunch' && m === 'dinner' ? 1 : 0)); }
function whyNot(e, r, date, meal, plan, byId) {
  if (!e) return '';
  const k = { meat: 'Meat', dairy: 'Dairy', pareve: 'Pareve', fish: 'Pareve' }[r.kind] || '';
  if (e.rule === 'gap') { const other = meal === 'dinner' ? 'lunch' : 'breakfast'; const o = slotOf(plan, date, other); return k + ' · ' + (o && L.kindOf(o, o.recipe_id ? byId[o.recipe_id] : null) === 'meat' ? other : 'a meal') + ' is meat today'; }
  if (e.rule === 'quick') return 'Over 25 minutes · busy night';
  if (e.rule === 'never') return 'Never again';
  if (e.rule === 'mix') return 'Mixes meat and dairy';
  if (e.rule === 'fast') return 'Fast day';
  if (e.rule === 'twice') return 'Already this week';
  if (e.rule === 'repeat') return 'In the last two weeks';
  if (e.rule === 'erev') return 'Too long for erev Shabbos';
  return '';
}
async function saveSlot(body, el) {
  await busy(el, async () => {
    try {
      await call('planWeek', Object.assign({ op: 'slot', weekStart: weekStart(), date: swap.date, meal: swap.meal }, body), { timeout: 60000 });
      await S.sync();
      closeSheet(); toast('Saved. Both phones have it.');
    } catch (e) { toast(e.message, { kind: 'err', ms: 6000 }); }
  });
}

// ------------------------------------------------------------------ the Freezer (3.9)
function freezerPage() {
  const list = r4().freezer || [];
  return nav({ back: 'Recipes', backTo: 'meals/recipes', title: 'Freezer' }) + pageTitle('Freezer', list.length ? 'Busy nights use these first' : 'Cook double, freeze half')
    + `<div class="stack">${list.length ? listCard(list.map((f) => row({ icon: 'snowflake', label: f.name, sub: 'Frozen ' + esc(shortDate(f.frozenOn || S.today())), value: f.portions + (f.portions === 1 ? ' meal' : ' meals'), act: 'freezer-item', data: { 'data-id': f.id } }))) : card('<p class="sub">Nothing in the freezer list yet. A supper marked "cook double" adds its extra here when you tap Cooked.</p>')}
      ${primary('Add to the freezer', 'freezer-add')}</div>`;
}

export const changes = {
  'swap-search'(el) { swap.q = el.value; swapSheet(); },
  'swap-lock'(el) {
    const plan = weekPlan() && slotOf(weekPlan(), swap.date, swap.meal) ? weekPlan() : currentPlan();
    const cur = slotOf(plan, swap.date, swap.meal) || {};
    saveSlot(Object.assign(cur.recipe_id ? { recipeId: cur.recipe_id } : (cur.text ? { text: cur.text, kind: cur.kind || 'pareve' } : {}), { lock: el.checked }), null);
  },
  async 'fridge-snap'(el) {
    const f = el.files && el.files[0];
    if (!f) return;
    toast('Looking at your fridge…', { ms: 20000 });
    try {
      const p = await preparePhoto(f);
      const r = await call('fridgeSnap', { data: p.data, weekStart: weekStart() }, { timeout: 120000 });
      await S.sync();
      toast(r.have && r.have.length ? 'You have ' + andList(r.have.map((x) => L.lowItem(x))) + '. Off the order.' : 'Nothing on the order was in the photo.', { ms: 6000 });
    } catch (e) { toast(e.message || 'That photo couldn\'t be read.', { kind: 'err', ms: 6000 }); }
  }
};
export const actions = {
  'busy-night'(el) { const v = Object.assign({ busy: [], guests: [] }, inputs()); const d = el.dataset.d; v.busy = v.busy.indexOf(d) >= 0 ? v.busy.filter((x) => x !== d) : v.busy.concat([d]); setInputs(v); rerender(); },
  'guests-sheet'() {
    const g = inputs().guests || [];
    const meals = ['Friday night', 'Shabbos lunch', 'Seudah shlishis', 'Sunday supper'];
    openSheet({ title: 'Guests', body: `<div class="picks" role="group" aria-label="Which meal">${meals.map((m, i) => `<button type="button" class="pick${(g[0] ? g[0].meal === m : i === 1) ? ' on' : ''}" data-act="guest-meal" data-m="${esc(m)}">${esc(m)}</button>`).join('')}</div>
      <label class="field"><span>How many more people</span><input id="guest-n" type="number" inputmode="numeric" value="${esc(g[0] ? g[0].count : 4)}"></label>${primary('Save', 'guests-save')}${g.length ? textBtn('No guests', 'guests-clear', {}, { cls: 'block' }) : ''}` });
  },
  'guest-meal'(el) { document.querySelectorAll('[data-act="guest-meal"]').forEach((b) => b.classList.toggle('on', b === el)); },
  'guests-save'() {
    const meal = ((document.querySelector('[data-act="guest-meal"].on') || {}).dataset || {}).m || 'Shabbos lunch';
    const n = Math.round(+(document.getElementById('guest-n') || {}).value);
    if (!(n > 0 && n <= 40)) { toast('How many more people? 1 to 40.', { kind: 'err' }); return; }
    const v = Object.assign({ busy: [], guests: [] }, inputs()); v.guests = [{ meal, count: n }]; setInputs(v); closeSheet(); rerender();
  },
  'guests-clear'() { const v = Object.assign({ busy: [], guests: [] }, inputs()); v.guests = []; setInputs(v); closeSheet(); rerender(); },
  async 'week-draft'(el) {
    const v = Object.assign({ busy: [], guests: [] }, inputs());
    await busy(el, async () => {
      try {
        toast('The coach is drawing your week…', { ms: 30000 });
        await call('planWeek', { op: 'draft', weekStart: weekStart(), busy: v.busy, guests: v.guests }, { timeout: 180000 });
        await S.sync();
        toast('Your week is ready. Tap a meal to change or lock it.', { ms: 4000 });
      } catch (e) { toast(e.message, { kind: 'err', ms: 6000 }); }
    });
  },
  'meal-change'(el) { swap = { date: el.dataset.date, meal: el.dataset.meal, mode: 'recipes', q: '', ideas: null, kind: 'pareve' }; swapSheet(); },
  'day-meals'(el) {
    const d = el.dataset.date, plan = weekPlan() || currentPlan(), byId = recipesById();
    openSheet({ title: dayName(d), body: `<div class="inset">${MEALS.map((m) => { const s = slotOf(plan, d, m) || {}; return row({ eyebrow: MEAL_NAME[m], labelHtml: `<span class="t">${esc(slotTitle(s, byId) || 'Not planned')}</span>${kindChip(L.kindOf(s, s.recipe_id ? byId[s.recipe_id] : null))}`, sub: s.leftoverOf ? esc(fromLine(s)) : '', act: 'meal-change', data: { 'data-date': d, 'data-meal': m }, cls: 'meal' }); }).join('')}</div>` });
  },
  'swap-mode'(el) { swap.mode = el.dataset.v; swapSheet(); },
  'own-kind'(el) { swap.kind = el.dataset.k; swap.text = (document.getElementById('own-text') || {}).value || swap.text; swap.ing = (document.getElementById('own-ing') || {}).value || swap.ing; swapSheet(); },
  'own-save'(el) {
    const text = String((document.getElementById('own-text') || {}).value || '').trim();
    if (!text) { toast('Name the meal.', { kind: 'err' }); return; }
    saveSlot({ text, kind: swap.kind || 'pareve', ingredients: (document.getElementById('own-ing') || {}).value || '' }, el);
  },
  'swap-pick'(el) { saveSlot({ recipeId: el.dataset.id }, el); },
  'swap-idea'(el) { saveSlot({ text: el.dataset.t, kind: el.dataset.k, minutes: +el.dataset.m }, el); },
  async 'swap-like'(el) {
    const plan = weekPlan() || currentPlan(), cur = slotOf(plan, swap.date, swap.meal) || {};
    await busy(el, async () => {
      try {
        const r = await call('planWeek', { op: 'likeThis', text: cur.text || '', kind: el.dataset.k, minutes: +el.dataset.m, slotLabel: dayName(swap.date) + ' ' + swap.meal }, { timeout: 60000 });
        swap.ideas = r.ideas || [];
        swapSheet();
      } catch (e) { toast(e.message, { kind: 'err', ms: 6000 }); }
    });
  },
  rate(el) {
    S.write('rateRecipe', { recipeId: el.dataset.id, rating: el.dataset.v });
    S.data.round4 = S.data.round4 || {}; S.data.round4.ratings = Object.assign({}, S.data.round4.ratings || {}, { [el.dataset.id]: el.dataset.v });
    S.setUi('rated', Object.assign({}, S.ui.rated || {}, { [el.dataset.id]: S.today() }));
    toast(el.dataset.v === 'never' ? 'Got it. It won\'t come back.' : (el.dataset.v === 'loved' ? 'Noted. It\'ll come around again.' : 'Noted.'));
    rerender();
  },
  'rate-hide'(el) { S.setUi('rateHidden', Object.assign({}, S.ui.rateHidden || {}, { [el.dataset.d]: true })); rerender(); },
  'freezer-add'() {
    openSheet({ title: 'Add to the freezer', body: `<label class="field"><span>What</span><input id="fz-name" placeholder="For example: chicken soup" autocomplete="off"></label><label class="field"><span>Meals</span><input id="fz-n" type="number" inputmode="numeric" value="1"></label>${primary('Add', 'freezer-save')}` });
  },
  'freezer-save'() {
    const name = String((document.getElementById('fz-name') || {}).value || '').trim(), n = Math.round(+(document.getElementById('fz-n') || {}).value || 1);
    if (!name) { toast('What went into the freezer?', { kind: 'err' }); return; }
    S.write('freezer', { op: 'add', name, portions: n });
    S.data.round4 = S.data.round4 || {}; (S.data.round4.freezer = S.data.round4.freezer || []).push({ id: 'tmp' + Date.now(), name: L.capItem(name), portions: n, frozenOn: S.today() });
    closeSheet(); rerender();
  },
  'freezer-item'(el) {
    const f = (r4().freezer || []).find((x) => x.id === el.dataset.id);
    if (!f) return;
    openSheet({ title: f.name, body: `<p class="sub">${f.portions} ${f.portions === 1 ? 'meal' : 'meals'} left.</p><div class="inset">${textBtn('We used one', 'freezer-use', { 'data-id': f.id }, { cls: 'block' })}${textBtn('Remove from the list', 'freezer-del', { 'data-id': f.id }, { cls: 'block t-problem' })}</div>` });
  },
  'freezer-use'(el) { S.write('freezer', { op: 'use', id: el.dataset.id }); const f = (r4().freezer || []).find((x) => x.id === el.dataset.id); if (f) f.portions = Math.max(0, f.portions - 1); if (f && !f.portions) S.data.round4.freezer = r4().freezer.filter((x) => x !== f); closeSheet(); rerender(); },
  'freezer-del'(el) { S.write('freezer', { op: 'remove', id: el.dataset.id }); S.data.round4.freezer = (r4().freezer || []).filter((x) => x.id !== el.dataset.id); closeSheet(); rerender(); }
};
let presenceTimer = null;
export function afterRender(r) {
  if (r.parts[1] === 'week' && r.parts[2] === 'plan') {
    call('planWeek', { op: 'presence' }).catch(() => {});
    clearInterval(presenceTimer);
    presenceTimer = setInterval(() => { if (document.visibilityState !== 'visible' || route().parts[2] !== 'plan') { clearInterval(presenceTimer); return; } call('planWeek', { op: 'presence' }).catch(() => {}); if (!S.syncing) S.sync(); }, 30000);
  }
}
export function leave(from, to) { if (from === 'plan/week/plan' && to !== from) clearInterval(presenceTimer); }
