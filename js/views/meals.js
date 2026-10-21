/* Round 5 (section 7): the Meals tab (M1, M2, screen 09), Plan the week one question per screen (M3), next week one day
 * per screen (screen 10, swipe like Apple Calendar), the Recipes photo grid (M5). Round 4's planning, swaps and locks, the
 * order, Cook mode, the freezer, ratings, import and the coach change keep working here (their pages live in food.js,
 * recipe.js, order.js, groceries.js and cook.js). */
import { L, K, esc, icon, toast, longDate, shortDate, dayName, busy } from '../core.js?v=132c8397ab';
import { S } from '../store.js?v=229f42e888';
import { call, LS } from '../api.js?v=b8330e966d';
import { go, rerender } from '../nav.js?v=57c55c9996';
import { tabHead, card, listCard, row, primary, textBtn, seg, nav, pageTitle, sectionTitle, kindChip } from '../ui.js?v=9375313392';
import * as Food from './food.js?v=24cb1aa60c';
import * as Recipe from './recipe.js?v=57fba85ae3';
import * as Order from './order.js?v=c5692bde2e';
import * as Groceries from './groceries.js?v=0c65ce3293';
import * as Plan from './plan.js?v=5d0bdc692d';
import { photoOf, mealPhoto } from './dishes.js?v=b6544095a8';

const r4 = () => (S.data && S.data.round4) || {};
const MEAL_LABEL = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Supper' };
const TIMES = () => Object.assign({ breakfast: '07:30', lunch: '12:30', dinner: '18:30' }, r4().mealTimes || {}, (S.household().meal_times ? { breakfast: S.household().meal_times.breakfast, lunch: S.household().meal_times.lunch, dinner: S.household().meal_times.supper } : {}));
const hm = (t) => { const m = L.hmToMin(t || '18:30'); return L.fmt12(m).replace(/ (am|pm)$/, ''); };
const ui = { day: '', nextIdx: 0, q: 0, recipeKind: 'all', recipeQ: '' };

export function render(r) {
  const sub = r.parts[1];
  if (sub === 'week' && r.parts[2] === 'plan') return planFlow();
  if (sub === 'next') return nextWeek();
  if (sub === 'recipes') return recipesGrid();
  if (sub === 'recipe') return Recipe.render(r);
  if (sub === 'groceries' || sub === 'order') return Order.render(r);
  if (sub === 'store') return Groceries.render(r);
  if (sub === 'freezer') return Food.render(r);
  if (sub === 'week') return tab(); // (walk W22) Round 4's This week page ("bands · 10 min", Round 3's recipe sheet) is the Meals tab now
  if (sub === 'make') return Plan.render({ name: 'plan', parts: ['plan', sub], params: r.params });
  return tab();
}
export function afterRender(r) {
  if (r.parts[1] === 'groceries' || r.parts[1] === 'order') Order.afterRender(r);
  if (r.parts[1] === 'store') Groceries.afterRender(r);
  Food.afterRender(r);
  if (r.parts[1] === 'next') wireSwipe();
  // audit Weak 12: the recipe search filters as you type (the screen keeps the field's focus and caret on redraw)
  const q = r.parts[1] === 'recipes' && document.getElementById('m5-rq');
  if (q && !q.dataset.live) { q.dataset.live = '1'; q.addEventListener('input', () => { ui.recipeQ = q.value || ''; rerender(); }); }
}
export function leave(from, to) { Groceries.leave(from, to); Food.leave(from, to); }

// ------------------------------------------------------------------ photos (7.6): a dish photo, the page's photo, the built-in's, else the kind's tile
export function tile(recipe, kind, text) {
  const url = photoOf(recipe) || (!recipe && text ? mealPhoto(text) : ''); // Round 6 (1.8): a written meal's own photo
  const k = kind || (recipe && recipe.kind) || 'pareve';
  return url ? `<span class="mphoto"><img src="${esc(url)}" alt="" loading="lazy" onerror="this.remove()"></span>` : `<span class="mphoto k-${esc(k === 'fish' ? 'pareve' : k)}" aria-hidden="true"></span>`;
}

// ------------------------------------------------------------------ the tab (M1, M2, screen 09)
function plannedThisWeek() { return !!Food.currentPlan() && Food.weekStart() === L.weekStart(S.realToday()) ? true : !!(r4().thisWeek && r4().thisWeek.plan); }
/** 7.3: from Motzei Shabbos until the week is planned, the card sits on top. */
function planCardDue() {
  const today = S.realToday(), cal = S.cal();
  const wd = L.weekday(today);
  const ws = L.weekStart(today);
  const planned = !!(r4().thisWeek && r4().thisWeek.plan) || (Food.weekStart() === ws && !!Food.weekPlan());
  if (wd === 6) { // Shabbos day: only after havdalah (Motzei Shabbos), for the coming week
    const d = L.calDay(cal, today);
    const hv = typeof d.havdalah === 'number' ? d.havdalah : L.hmToMin(d.havdalah || '');
    const after = !!d.havdalah && S.dayMinutes() >= hv; // "19:15" in the calendar; after midnight it's still Saturday's app day until 4 am (audit Weak 5)
    return after && !(Food.weekStart() === L.addDays(ws, 7) && Food.weekPlan());
  }
  return !planned;
}
function tab() {
  const today = S.realToday();
  const day = ui.day || today;
  const head = tabHead({ eyebrow: longDate(today), title: 'Meals' });
  const plan = Food.currentPlan();
  const planCard = planCardDue() ? card(`<div class="plan-due">${icon('calendar-days')}<b>${L.weekday(today) === 6 ? 'Next week isn\'t planned yet' : 'This week isn\'t planned yet'}</b></div><p class="sub">Three quick questions, then the coach drafts all 7 days and the Breadberry order.</p>${primary(L.weekday(today) === 6 ? 'Plan next week' : 'Plan this week', 'go', { 'data-to': 'meals/week/plan' })}`, 'plan-card') : '';
  const strip = weekStrip(day);
  const dk = L.calDay(S.cal(), day);
  const shabbos = L.weekday(day) === 6 || dk.isYomTov;
  const title = day === today ? (shabbos ? 'Shabbos' : 'Today') : L.weekday(day) === 6 ? 'Shabbos' : dayName(day); // found at start (r): one word on Meals, as in M2
  const rows = dayRows(plan, day);
  const cookNow = !planCard && day === today && S.minutes() >= 15 * 60 && plannedSupper(plan, today);
  return `<div class="stack">${head}${planCard}${strip}
    <div>${sectionTitle(title, day !== today ? `<button type="button" class="btn-text small" data-act="m5-day" data-d="">Back to today</button>` : (shabbos ? `<span class="caption">${esc(shortDate(day))}</span>` : ''))}${rows || card('<p class="sub">Nothing planned for this day yet.</p>')}</div>
    ${cookNow ? primary('Cook supper', 'go', { 'data-to': 'cook/' + plannedSupper(plan, today).id }) : ''}
    ${L.weekday(day) === 0 && plan ? Food.prepCard(plan) : ''}
    ${day === today ? Food.ratingCard() : ''}
    ${Order.cameCard ? Order.cameCard() : ''}
    ${listCard([
      row({ icon: 'shopping-cart', label: 'Groceries', value: esc(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][+S.household().shopping_day || 4]), act: 'go', data: { 'data-to': 'meals/groceries' } }),
      row({ icon: 'book-open', label: 'Recipes', value: String(usableRecipes().length), act: 'go', data: { 'data-to': 'meals/recipes' } }),
      planRow(today)
    ])}</div>`;
}
/** (audit B3) The planning row says what it opens: the back office plans this week from Sunday to Friday and next week
 *  from Motzei Shabbat (Round 4). A week that's already planned is never drawn again from here. */
function planRow(today) {
  const ws = Food.weekStart(), next = ws > L.weekStart(today), planned = !!Food.weekPlan();
  if (next) return row({ icon: 'calendar-days', label: planned ? 'Next week' : 'Plan next week', act: 'go', data: { 'data-to': planned ? 'meals/next' : 'meals/week/plan' } });
  if (!planned) return row({ icon: 'calendar-days', label: 'Plan this week', act: 'go', data: { 'data-to': 'meals/week/plan' } });
  return row({ icon: 'calendar-days', label: 'Plan next week', value: 'Motzei Shabbat' });
}
function weekStrip(day) {
  const ws = L.weekStart(day), today = S.realToday();
  const days = [0, 1, 2, 3, 4, 5, 6].map((i) => L.addDays(ws, i));
  return `<div class="wstrip" role="group" aria-label="Pick a day">${days.map((d) => {
    const on = d === day, isT = d === today, rest = L.calDay(S.cal(), d).isRest;
    return `<button type="button" class="wday${on ? ' on' : ''}${isT ? ' today' : ''}" data-act="m5-day" data-d="${d}" aria-pressed="${on}" aria-label="${esc(dayName(d) + ', ' + shortDate(d) + (rest && L.weekday(d) !== 6 ? ', Yom Tov' : ''))}"><span>${'SMTWTFS'.charAt(L.weekday(d))}</span><b>${+d.slice(8)}</b>${rest ? icon('flame', 'rest-ic') : ''}</button>`;
  }).join('')}</div>`;
}
function plannedSupper(plan, date) {
  const s = slot(plan, date, 'dinner');
  const r = s && s.recipe_id ? S.recipe(s.recipe_id) : null;
  return r && !s.leftoverOf ? r : null;
}
function slot(plan, date, meal) { const d = plan && (plan.days || []).find((x) => x.date === date); return d ? d[meal] : null; }
/** Breakfast, Lunch and Supper as labeled rows with a photo square, the time, the name, minutes and kind; a Shabbos day has its own three. */
function dayRows(plan, date, swapMode) {
  if (!plan) return '';
  const T = TIMES(), dk = L.calDay(S.cal(), date);
  const fri = L.weekday(date) === 5, sat = L.weekday(date) === 6 || dk.isYomTov;
  let slots = [['breakfast', 'Breakfast', T.breakfast], ['lunch', 'Lunch', T.lunch], ['dinner', 'Supper', T.dinner]];
  if (fri) slots = [['breakfast', 'Breakfast', T.breakfast], ['lunch', 'Lunch', T.lunch], ['dinner', 'Friday night', '']];
  if (sat) slots = [['lunch', 'Shabbos lunch', ''], ['dinner', 'Seudah shlishis', '']];
  // Round 4's guests line, kept: the meal with guests says how many people (the four of you plus the guests)
  const guests = ((plan.inputs || {}).guests || []);
  const guestsAt = (k, label) => guests.find((g) => String(g.meal).toLowerCase() === label.toLowerCase() || (g.meal === 'Sunday supper' && k === 'dinner' && L.weekday(date) === 0));
  const out = slots.map(([k, label0, time]) => {
    const gq = guestsAt(k, label0), label = label0 + (gq ? ' · ' + (4 + (+gq.count || 0)) + ' people' : '');
    const s = slot(plan, date, k);
    if (!s || (!s.text && !s.recipe_id)) return '';
    const r = s.recipe_id ? S.recipe(s.recipe_id) : null;
    const kind = L.kindOf(s, r);
    const mins = +s.minutes || (r && +r.minutes) || 0;
    const sub = s.leftoverOf ? 'From ' + dayName(String(s.leftoverOf).split(':')[0]) + '\'s supper' : (s.freezer ? 'From the freezer' : (mins ? mins + ' min' : ''));
    const kindWord = { meat: 'Meat', dairy: 'Dairy', pareve: 'Pareve', fish: 'Pareve' }[kind] || '';
    const startBy = k === 'dinner' && !fri && !sat && mins && !s.leftoverOf && !s.freezer && time ? 'Start by ' + hm(minToHm(L.hmToMin(time) - mins)) : '';
    const thaw = k === 'dinner' ? Food.thawLine(plan, date, s) : '';
    // found at start (s): leftovers carry the name of the supper they come from (audit Weak 11: and its photo and recipe)
    const src = s.leftoverOf ? slot(plan, String(s.leftoverOf).split(':')[0], 'dinner') : null;
    const rr = r || (src && src.recipe_id ? S.recipe(src.recipe_id) : null);
    const to = rr && !swapMode ? 'meals/recipe/' + rr.id : '';
    const title = src && (src.text || src.recipe_id) ? L.mealTitle(src.text, src.recipe_id ? S.recipe(src.recipe_id) : null) : L.mealTitle(String(s.text || '').replace(/^freezer:\s*/i, ''), r); // (walk W21) "From the freezer" is the line under it
    return `<button type="button" class="mealrow" ${to ? `data-act="go" data-to="${esc(to)}"` : `data-act="meal-change" data-date="${esc(date)}" data-meal="${k}"`}>${tile(rr, kind, (src && src.text) || s.text)}<span class="mr-main"><span class="mr-eyebrow">${esc(label.toUpperCase())}${time ? '<span> · ' + esc(hm(time)) + '</span>' : ''}</span><span class="mr-title">${esc(title)}</span><span class="mr-sub">${esc([sub, kindWord].filter(Boolean).join(' · '))}</span>${startBy || thaw ? `<span class="mr-sub">${esc(startBy || thaw)}</span>` : ''}</span>${icon('chevron-right', 'chev')}</button>`;
  }).filter(Boolean);
  return out.length ? `<section class="card list meals5">${out.join('')}</section>` : '';
}
function minToHm(m) { m = ((m % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function usableRecipes() { return S.recipes().filter((r) => r.status !== 'proposed' && r.status !== 'rejected' && r.meal !== 'side'); }

// ------------------------------------------------------------------ Plan the week: one question per screen (M3), then the week by day
function planFlow() {
  const ws = Food.weekStart();
  const inp = Food.inputs();
  const steps = ['busy', 'guests', 'lunch'];
  const k = Math.min(ui.q, 2);
  const label = 'Plan the week · ' + shortDate(ws).replace(/ \d+$/, '') + ' ' + +ws.slice(8) + '–' + +L.addDays(ws, 6).slice(8);
  const dots = `<div class="qdots" aria-hidden="true">${steps.map((_, i) => `<i class="${i === k ? 'on' : ''}"></i>`).join('')}</div>`;
  const owner = S.person(S.household().ownerId) || S.me();
  let body = '', primaryBtn = '', secondary = '';
  if (k === 0) {
    body = `<h1 class="title">Any busy nights?</h1><p class="sub">Those nights get a supper you can make in 25 minutes.</p>
      <div class="card list">${[0, 1, 2, 3, 4].map((i) => { const d = L.addDays(ws, i), on = (inp.busy || []).indexOf(d) >= 0; return `<button type="button" class="row no-ic" data-act="busy-night" data-d="${d}" aria-pressed="${on}"><span class="row-main"><span class="row-label">${esc(dayName(d))}</span></span>${on ? icon('check', 'ic-s t-accent') : ''}</button>`; }).join('')}</div>
      <p class="caption">Friday and Shabbos are planned for you.</p>`;
    primaryBtn = primary('Next', 'm5-q', { 'data-q': '1' }); secondary = textBtn('No busy nights', 'm5-nobusy');
  } else if (k === 1) {
    const g = (inp.guests || [])[0];
    body = `<h1 class="title">Any guests?</h1><p class="sub">The meal with guests gets more food and a dish that serves a crowd.</p>
      <div class="card list">${['Friday night', 'Shabbos lunch', 'Seudah shlishis', 'Sunday supper'].map((m) => { const on = g && g.meal === m; return `<button type="button" class="row no-ic" data-act="m5-guest" data-m="${esc(m)}" aria-pressed="${!!on}"><span class="row-main"><span class="row-label">${esc(m)}</span>${on ? `<span class="row-sub">${g.count} more people</span>` : ''}</span>${on ? icon('check', 'ic-s t-accent') : ''}</button>`; }).join('')}</div>
      ${g ? `<div class="stepline"><span class="sub">How many more people</span>${'<span class="stepper">' + `<button type="button" class="btn-icon" data-act="m5-guests-n" data-d="-1" aria-label="One fewer">${icon('minus')}</button><b>${g.count}</b><button type="button" class="btn-icon" data-act="m5-guests-n" data-d="1" aria-label="One more">${icon('plus')}</button>` + '</span>'}</div>` : ''}`;
    primaryBtn = primary('Next', 'm5-q', { 'data-q': '2' }); secondary = textBtn('No guests', 'm5-noguests');
  } else {
    const road = S.settings(owner.id).road_days || [1, 2, 3, 4];
    body = `<h1 class="title">${esc(owner.name)}'s lunches</h1><p class="sub">On the road days get a lunch that travels.</p>
      <div class="card list">${[0, 1, 2, 3, 4].map((i) => { const on = road.indexOf(i) >= 0; return `<button type="button" class="row no-ic" data-act="m5-road" data-i="${i}" aria-pressed="${on}"><span class="row-main"><span class="row-label">${esc(dayName(L.addDays(ws, i)))}</span><span class="row-sub">${on ? 'On the road' : 'At home'}</span></span>${on ? icon('check', 'ic-s t-accent') : ''}</button>`; }).join('')}</div>`;
    primaryBtn = primary('Draw the week', 'm5-draft', {}, { icon: 'sparkles' }); secondary = textBtn('Back', 'm5-q', { 'data-q': '1' });
  }
  return `<div class="qflow">${nav({ back: 'Meals', backTo: 'meals', title: 'Plan the week' })}${dots}<p class="caption">${esc(label)}</p>${body}<div class="flow-actions">${primaryBtn}<div class="center">${secondary}</div></div></div>`;
}
/** Screen 10: next week, one day per screen; swipe or the arrows, the dots for the days. */
function nextWeek() {
  const plan = Food.weekPlan() || Food.currentPlan();
  const ws = Food.weekStart();
  if (!plan) return nav({ back: 'Meals', backTo: 'meals', title: 'Next week' }) + pageTitle('Next week') + `<div class="stack">${card(`<p class="sub">Not planned yet.</p>${primary('Plan the week', 'go', { 'data-to': 'meals/week/plan' })}`)}</div>`;
  const cur = ws === L.weekStart(S.realToday());
  // (audit W16) this week opens on today, not on a Sunday already past; the arrows still reach the days before
  const seen = ws + '|' + S.realToday();
  if (ui.nextSeen !== seen) { ui.nextSeen = seen; ui.nextIdx = cur ? L.weekday(S.realToday()) : 0; }
  const i = Math.max(0, Math.min(6, ui.nextIdx));
  ui.nextIdx = i; // the arrows and the swipe move from the day shown
  const date = L.addDays(ws, i);
  const p = S.partner();
  const here = p && (r4().week && r4().week.presence || {})[p.id] && Date.now() - Date.parse(r4().week.presence[p.id]) < 120000;
  const busyN = ((plan.inputs || {}).busy || []).indexOf(date) >= 0;
  const ch = L.weekChecks(plan, Food.ctxFor(plan));
  const ok = ch.proteinDays >= ch.days - 1 && ch.vegSuppers === ch.suppers;
  const uses = ch.usesFirst.length ? ' Uses the ' + Food.andList(ch.usesFirst) + ' before they turn.' : ''; // Round 4's third check, kept
  return nav({ back: 'Meals', backTo: 'meals', title: cur ? 'This week' : 'Next week', right: here ? `<span class="caption here">${esc(p.name)} is here too</span>` : '' })
    + pageTitle(cur ? 'This week' : 'Next week', esc(shortDate(ws) + '–' + +L.addDays(ws, 6).slice(8)) + ' · swipe for the next day')
    + `<div class="stack"><div class="dayhead" id="m5-swipe">${textBtn('', 'm5-next', { 'data-d': '-1' }, { icon: 'chevron-left', aria: 'The day before', cls: i === 0 ? 'hide' : '' })}<div class="center"><h2 class="dh-title">${esc(dayName(date) + ', ' + shortDate(date))}</h2>${busyN ? '<p class="dh-tag">Busy night</p>' : ''}</div>${textBtn('', 'm5-next', { 'data-d': '1' }, { icon: 'chevron-right', aria: 'The next day', cls: i === 6 ? 'hide' : '' })}</div>
    <div class="qdots" aria-hidden="true">${[0, 1, 2, 3, 4, 5, 6].map((k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
    ${dayRows(plan, date, true) || card('<p class="sub">Nothing planned for this day.</p>')}
    <p class="caption" style="padding:0 4px">Tap a meal to swap or lock it.</p>
    ${card(`<div class="check-line">${icon(ok ? 'check' : 'circle-alert', 'ic-s ' + (ok ? 't-accent' : 't-2'))}<span class="body">${esc((ok ? 'The week checks out: protein on target ' + ch.proteinDays + ' of ' + ch.days + ' days, vegetables at every supper.' : 'Protein on target ' + ch.proteinDays + ' of ' + ch.days + ' days; vegetables at ' + ch.vegSuppers + ' of ' + ch.suppers + ' suppers.') + uses)}</span></div>`)}
    ${i === 0 ? Food.prepCard(plan) : ''}
    ${primary('Looks good', 'm5-looks-good')}<div class="center">${textBtn('Try different meals', 'week-draft', { 'data-again': '1' })}
      <label class="btn-text block file-btn">${icon('camera')}<span>Snap the fridge first</span><input type="file" accept="image/*" capture="environment" data-change="fridge-snap" aria-label="Snap the fridge first"></label></div></div>`;
}
function wireSwipe() {
  const el = document.getElementById('app');
  if (!el || el.dataset.m5swipe) return;
  el.dataset.m5swipe = '1';
  let x0 = null, y0 = null;
  el.addEventListener('touchstart', (e) => { if (!document.getElementById('m5-swipe')) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 == null || !document.getElementById('m5-swipe')) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && x0 === null && e.changedTouches[0].clientX > 24) { ui.nextIdx = Math.max(0, Math.min(6, ui.nextIdx + (dx < 0 ? 1 : -1))); rerender(); }
  }, { passive: true });
}

// ------------------------------------------------------------------ Recipes (M5)
function recipesGrid() {
  const q = ui.recipeQ.toLowerCase();
  const list = usableRecipes().filter((r) => (ui.recipeKind === 'all' || (ui.recipeKind === 'pareve' ? r.kind === 'pareve' || r.kind === 'fish' : r.kind === ui.recipeKind)) && (!q || r.title.toLowerCase().indexOf(q) >= 0))
    .map((r, i) => ({ r, i, p: photoOf(r) ? 0 : 1 })).sort((a, b) => a.p - b.p || a.i - b.i).map((x) => x.r); // (walk W20) a recipe still waiting for its photo goes after the ones with photos
  const fr = (r4().freezer || []).reduce((a, f) => a + (+f.portions || 0), 0);
  const group = (title, rs) => rs.length ? `<div>${sectionTitle(title, `<span class="caption">${rs.length}</span>`)}<div class="rgrid">${rs.map((r) => `<button type="button" class="rcard" data-act="go" data-to="meals/recipe/${esc(r.id)}">${tile(r)}<b>${esc(L.mealTitle(r.title, r).replace(/(\w)-(\w)/g, '$1‑$2'))}</b><span class="sub">${esc([(r.minutes ? r.minutes + ' min' : ''), { meat: 'Meat', dairy: 'Dairy', pareve: 'Pareve', fish: 'Pareve' }[r.kind] || ''].filter(Boolean).join(' · '))}</span></button>`).join('')}</div></div>` : '';
  const sup = list.filter((r) => !r.meal || r.meal === 'dinner' || r.meal === 'shabbat');
  const other = list.filter((r) => r.meal === 'breakfast' || r.meal === 'lunch');
  return nav({ back: 'Meals', backTo: 'meals', title: 'Recipes', right: `<button type="button" class="btn-icon" data-act="recipe-import" aria-label="Add a recipe">${icon('plus')}</button>` }) + pageTitle('Recipes')
    + `<div class="stack"><label class="field search"><span class="sr">Search recipes</span><input id="m5-rq" type="search" value="${esc(ui.recipeQ)}" placeholder="Search ${usableRecipes().length} recipes" data-change="m5-rq" autocomplete="off"></label>
    ${seg([['all', 'All'], ['meat', 'Meat'], ['dairy', 'Dairy'], ['pareve', 'Pareve']], ui.recipeKind, 'm5-rkind', { label: 'Kind' })}
    ${listCard([row({ icon: 'snowflake', label: 'In the freezer', value: String(fr), act: 'go', data: { 'data-to': 'meals/freezer' } }), row({ icon: 'refrigerator', label: 'What can I make?', act: 'go', data: { 'data-to': 'meals/make' } })])}
    ${group('Suppers', sup)}${group('Breakfast and lunch', other)}${!list.length ? card('<p class="sub">No recipes match.</p>') : ''}</div>`;
}

export const changes = { 'm5-rq'(el) { ui.recipeQ = el.value || ''; rerender(); } };
export const actions = {
  'm5-day'(el) { ui.day = el.dataset.d || ''; rerender(); },
  'm5-q'(el) { ui.q = +el.dataset.q; rerender(); window.scrollTo(0, 0); },
  'm5-nobusy'() { const v = Object.assign({ busy: [], guests: [] }, Food.inputs()); v.busy = []; Food.setInputs(v); ui.q = 1; rerender(); },
  'm5-noguests'() { const v = Object.assign({ busy: [], guests: [] }, Food.inputs()); v.guests = []; Food.setInputs(v); ui.q = 2; rerender(); },
  'm5-guest'(el) { const v = Object.assign({ busy: [], guests: [] }, Food.inputs()); const g = (v.guests || [])[0]; v.guests = g && g.meal === el.dataset.m ? [] : [{ meal: el.dataset.m, count: g ? g.count : 4 }]; Food.setInputs(v); rerender(); },
  'm5-guests-n'(el) { const v = Object.assign({ busy: [], guests: [] }, Food.inputs()); const g = (v.guests || [])[0]; if (!g) return; g.count = Math.max(1, Math.min(40, g.count + (+el.dataset.d))); Food.setInputs(v); rerender(); },
  'm5-road'(el) { const owner = S.person(S.household().ownerId) || S.me(); const cur = (S.settings(owner.id).road_days || [1, 2, 3, 4]).slice(); const i = +el.dataset.i; const nx = cur.indexOf(i) >= 0 ? cur.filter((x) => x !== i) : cur.concat([i]).sort(); S.write('settings', Object.assign({ values: { road_days: nx } }, owner.id !== S.meId() ? { forUser: owner.id } : {})); },
  async 'm5-draft'(el) {
    const v = Object.assign({ busy: [], guests: [] }, Food.inputs());
    await busy(el, async () => {
      try {
        toast('The coach is drawing your week…', { ms: 30000 });
        await call('planWeek', { op: 'draft', weekStart: Food.weekStart(), busy: v.busy, guests: v.guests }, { timeout: 180000 });
        await S.sync();
        ui.q = 0; ui.nextIdx = 0;
        toast('Your week is ready. Swipe through the days.', { ms: 4000 });
        go('meals/next');
      } catch (e) { toast(e.message, { kind: 'err', ms: 6000 }); }
    });
  },
  'm5-next'(el) { ui.nextIdx = Math.max(0, Math.min(6, ui.nextIdx + (+el.dataset.d))); rerender(); },
  'm5-looks-good'() { go('meals/groceries'); },
  'm5-rkind'(el) { ui.recipeKind = el.dataset.v; rerender(); }
};
