/* Plan (D7): today's workout, today's meals, and the week — groceries, recipes, supplements, ideas. */
import { L, K, esc, icon, chev, toast, openSheet, updateSheet, closeSheet, longDate, shortDate, dayName, busy } from '../core.js';
import { S } from '../store.js';
import { call } from '../api.js';
import { go, rerender } from '../nav.js';
import { tabHead, card, listCard, row, primary, textBtn, seg, picks, kindChip, nav, pageTitle, empty, checkCircle, sectionTitle, playCtl } from '../ui.js';
import * as Voice from '../voice.js';
import { logged } from '../fx.js';
import * as Groceries from './groceries.js';

export function render(r) {
  const sub = r.parts[1];
  if (sub === 'groceries') return Groceries.render(r);
  if (sub === 'week') return weekPage();
  if (sub === 'recipes') return recipesPage();
  if (sub === 'supplements') return supplementsPage();
  if (sub === 'make') return makePage();
  return planScreen();
}
export function afterRender(r) { if (r.parts[1] === 'groceries') Groceries.afterRender(r); }
export function leave(from, to) { Groceries.leave(from, to); }

// ------------------------------------------------------------------ the Plan screen (D7)
function planScreen() {
  const today = S.today();
  const head = tabHead({ eyebrow: longDate(today), title: 'Plan' });
  if (!S.setupDone()) return `<div class="stack">${head}${empty('calendar', 'Set up first', 'Answer a few questions so your plan fits you.', primary('Set up my plan', 'go', { 'data-to': 'setup' }))}</div>`;
  return `<div class="stack">${head}${workoutCard()}<div>${sectionTitle('Today\'s meals')}${mealsCard()}</div>${moreCard()}</div>`;
}

function workoutCard() {
  const plan = S.dayPlan();
  const w = plan.workout;
  const d = S.done();
  let body = '';
  if (w.kind === 'strength' || w.kind === 'light') {
    body = `<button type="button" class="sub one" data-act="moves-sheet" style="display:block;width:100%;min-height:44px;margin-top:4px;padding:0;border:0;background:none;text-align:left;cursor:pointer" aria-label="See the moves: ${esc(w.line)}">${esc(w.line)}</button>`
      + (w.kind === 'strength' ? seg([[10, '10 min'], [20, '20 min'], [30, '30 min']], w.minutes, 'set-version', { label: 'Workout length' }) : '')
      + primary(d.workoutDone ? 'Do it again' : 'Start workout', 'go', { 'data-to': 'workout' })
      + `<div class="center">${textBtn('Log it without the guide', 'log-workout')}</div>`;
  } else if (w.kind === 'walk') {
    const pick = S.ui.walkPick || plan.walkGoal;
    const mins = [10, 15, 20, 30].concat([10, 15, 20, 30].indexOf(+pick) < 0 ? [+pick] : []).sort((a, b) => a - b);
    body = `<p class="sub one">${esc(d.walkMin ? d.walkMin + ' of ' + plan.walkGoal + ' minutes so far.' : 'Walk ' + plan.walkGoal + ' minutes. Talk-but-not-sing pace.')}</p>`
      + picks(mins.map((m, i) => [m, i === mins.length - 1 ? m + ' min' : String(m), m + ' min']), 'walk-choose', pick, { label: 'Minutes walked', fit: true })
      + primary('I walked', 'walked', { 'data-m': pick })
      + `<div class="center">${textBtn('Log it without the guide', 'log-workout')}</div>`;
  } else {
    body = `<p class="sub">${esc(w.line)}</p>`;
  }
  return card(`<div class="eyebrow">Today's workout</div><h2 class="card-title">${esc(w.title)}</h2>${body}`, 'wkcard');
}

function mealsCard() {
  const plan = S.dayPlan();
  const meals = plan.meals;
  if (!meals) return card(`<p class="sub">This week's kosher meal plan isn't ready yet.</p>${primary('Make this week\'s plan', 'meal-regen')}`);
  const labels = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: L.weekday(plan.date) === 5 ? 'Friday night' : (plan.type === 'shabbat' || plan.type === 'yomtov' ? 'Seudah' : 'Dinner') };
  return listCard(L.MEAL_KEYS.map((k) => {
    const m = meals[k];
    if (!m) return '';
    return row({ eyebrow: labels[k], labelHtml: `<span class="t">${esc(m.title)}</span>${kindChip(m.kind)}`, act: 'meal', data: { 'data-k': k }, cls: 'meal' });
  }), 'no-ic');
}

function moreCard() {
  const ws = L.weekStart(S.today());
  const wk = weekProgress(ws);
  const groc = ((S.data.meal && S.data.meal.grocery) || []).filter((g) => !g.checked).length;
  const supps = S.supplements().filter((s) => s.status === 'active');
  const taken = new Set(S.logs(S.meId()).supplog.filter((x) => x.date === S.today() && x.taken).map((x) => x.suppId));
  const toTake = supps.filter((s) => !taken.has(s.suppId)).length;
  return listCard([
    row({ icon: 'calendar-check', label: 'This week', value: wk.planned ? wk.done + ' of ' + wk.planned + ' done' : '', act: 'go', data: { 'data-to': 'plan/week' } }),
    row({ icon: 'shopping-cart', label: 'Groceries', value: groc ? groc + ' left' : '', act: 'go', data: { 'data-to': 'plan/groceries' } }),
    row({ icon: 'book-open', label: 'Recipes', value: String(uniqueRecipes(S.recipes().filter((r) => r.status !== 'proposed')).length), act: 'go', data: { 'data-to': 'plan/recipes' } }),
    row({ icon: 'pill', label: 'Supplements', value: supps.length ? (toTake ? toTake + ' to take' : 'All taken') : '', act: 'go', data: { 'data-to': 'plan/supplements' } }),
    row({ icon: 'camera', label: 'What can I make?', act: 'photo-sheet', data: { 'data-hint': 'pantry' } })
  ]);
}
/** Workouts and walks planned this week (Sunday–Friday) and how many are done. */
function weekProgress(ws) {
  let planned = 0, done = 0;
  for (let i = 0; i < 6; i++) {
    const date = L.addDays(ws, i);
    const p = S.dayPlan(S.meId(), date);
    const k = p.workout.kind;
    if (k !== 'strength' && k !== 'light' && k !== 'walk') continue;
    planned++;
    const d = S.done(S.meId(), date);
    if ((k === 'walk' && d.walkMin >= Math.max(1, Math.round(p.walkGoal * 0.8))) || (k !== 'walk' && d.workoutDone)) done++;
  }
  return { planned, done };
}

// ------------------------------------------------------------------ This week
function weekPage() {
  const ws = L.weekStart(S.today());
  const today = S.today();
  const meal = S.data.meal;
  const rows = [];
  for (let i = 0; i < 7; i++) {
    const date = L.addDays(ws, i);
    const p = S.dayPlan(S.meId(), date);
    const d = S.done(S.meId(), date);
    const k = p.workout.kind;
    const did = (k === 'walk' && d.walkMin > 0) || ((k === 'strength' || k === 'light') && d.workoutDone);
    const label = dayName(date) + (date === today ? ' · today' : '');
    const sub = p.workout.title + (k === 'strength' || k === 'light' ? ' · ' + p.workout.minutes + ' min' : (k === 'walk' ? ' · ' + p.walkGoal + ' min' : ''));
    rows.push(row({ label, sub, right: did ? `<span class="row-value t-accent">${icon('check', 'ic-s')}</span>` : (date < today && (k === 'strength' || k === 'light' || k === 'walk') ? '<span class="row-value">Missed</span>' : '') , cls: 'no-ic' }));
  }
  const mealRows = meal && meal.plan && meal.plan.days ? meal.plan.days.map((day) => {
    const p = L.todayPlan(Object.assign(S.planCtx(S.meId(), day.date), { date: day.date }));
    if (!p.meals) return '';
    return `<div><div class="eyebrow" style="margin:0 4px 6px">${esc(dayName(day.date))} · ${esc(shortDate(day.date))}</div>${listCard(L.MEAL_KEYS.map((k) => p.meals[k] ? row({ eyebrow: k, labelHtml: `<span class="t">${esc(p.meals[k].title)}</span>${kindChip(p.meals[k].kind)}`, act: p.meals[k].recipeId ? 'recipe' : '', data: { 'data-id': p.meals[k].recipeId }, cls: 'meal' }) : ''), 'no-ic')}</div>`;
  }).join('') : '';
  return nav({ back: 'Plan', backTo: 'plan', title: 'This week' }) + pageTitle('This week', esc(shortDate(ws)) + ' – ' + esc(shortDate(L.addDays(ws, 6))))
    + `<div class="stack">${listCard(rows, 'no-ic')}${mealRows ? sectionTitle('Meals') + `<div class="stack-s">${mealRows}</div>` : ''}
      <div class="center">${textBtn(S.hasCoach() ? 'Ask the coach for a new meal plan' : 'Shuffle the meal plan', 'meal-regen')}</div>
      <p class="caption center">Meat and dairy are never in the same meal. Fish is served apart from meat.</p></div>`;
}

// ------------------------------------------------------------------ meal detail and recipes
function recipeBody(r, eyebrowText) {
  const text = r.title + '. Ingredients: ' + (r.ing || []).map((i) => i[0] + ' ' + i[1]).join(', ') + '. Steps: ' + (r.steps || []).join(' ');
  return `<div class="split"><span class="eyebrow">${esc(eyebrowText || '')}</span>${kindChip(r.kind)}</div>
    <p class="sub">${esc(r.minutes || '')} min · serves ${esc(r.serves || '')}</p>
    ${playCtl('recipe:' + r.id, text)}
    <div><div class="h3" style="margin-bottom:6px">Ingredients</div><ul class="bullets">${(r.ing || []).map((i) => `<li>${esc(i[0])} ${esc(i[1])}</li>`).join('')}</ul></div>
    <div><div class="h3" style="margin-bottom:6px">Steps</div><ol class="steps">${(r.steps || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>`;
}
function mealSheet(k) {
  const m = (S.dayPlan().meals || {})[k];
  if (!m) return;
  const r = m.recipeId ? S.recipe(m.recipeId) : null;
  const label = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }[k];
  openSheet({ title: r ? r.title : m.title, body: r ? recipeBody(r, label) : `<div class="eyebrow">${esc(label)}</div><p class="body">${esc(m.title)}</p><p class="sub">No recipe needed for this one.</p>` });
}
function recipeSheet(id) {
  const r = S.recipe(id);
  if (!r) return;
  openSheet({ title: r.title, body: recipeBody(r, r.meal || 'Recipe') });
}
function recipesPage() {
  const f = S.ui.recipeKind || 'all';
  const all = uniqueRecipes(S.recipes().filter((r) => r.status !== 'proposed'));
  const list = all.filter((r) => f === 'all' || (f === 'pareve' ? r.kind === 'pareve' || r.kind === 'fish' : r.kind === f));
  const known = new Set(all.map((r) => String(r.title || '').trim().toLowerCase()));
  const proposed = uniqueRecipes(S.recipes().filter((r) => r.status === 'proposed')).filter((r) => !known.has(String(r.title || '').trim().toLowerCase()));
  return nav({ back: 'Plan', backTo: 'plan', title: 'Recipes' }) + pageTitle('Recipes')
    + `<div class="stack">${proposed.length ? `<div>${sectionTitle('New from your coach')}${listCard(proposed.map((r) => row({ labelHtml: `<button type="button" class="row-label one" data-act="recipe" data-id="${esc(r.id)}" style="display:block;max-width:100%;background:none;border:0;padding:0;text-align:left;cursor:pointer;min-height:44px">${esc(r.title)}</button>`, right: `<span style="display:flex;align-items:center;flex:none">${textBtn('Keep', 'confirm', { 'data-tab': 'Recipes', 'data-id': r.rowId, 'data-accept': '1' })}${textBtn('No', 'confirm', { 'data-tab': 'Recipes', 'data-id': r.rowId, 'data-accept': '0' })}</span>`, cls: 'no-ic' })), 'no-ic')}</div>` : ''}
    ${seg([['all', 'All'], ['meat', 'Meat'], ['dairy', 'Dairy'], ['pareve', 'Pareve']], f, 'recipe-kind', { label: 'Kind' })}
    ${listCard(list.map((r) => row({ labelHtml: `<span class="t">${esc(r.title)}</span>`, sub: (r.minutes || '') + ' min · serves ' + (r.serves || ''), right: kindChip(r.kind), act: 'recipe', data: { 'data-id': r.id }, cls: 'meal' })), 'no-ic')}</div>`;
}

/** The same dish saved by several weekly plans shows once (the newest copy). */
function uniqueRecipes(list) {
  const by = new Map();
  list.forEach((r) => by.set(String(r.title || '').trim().toLowerCase(), r));
  return Array.from(by.values());
}

// ------------------------------------------------------------------ supplements & superfoods (moved here from More)
function supplementsPage() {
  const id = S.meId();
  const mine = S.supplements(id).filter((s) => s.status === 'active');
  const proposed = S.supplements(id).filter((s) => s.status === 'proposed');
  const taken = new Set(S.logs(id).supplog.filter((x) => x.date === S.today() && x.taken).map((x) => x.suppId));
  const checks = S.suppChecks(id);
  const warn = [];
  checks.overlaps.forEach((o) => warn.push('Double dose? ' + o.nutrient.replace('_', ' ') + ' is in ' + o.from.join(' and ') + '. Check the total.'));
  checks.interactions.concat(checks.cautions).forEach((x) => warn.push(x.supplement + ': ' + x.note));
  checks.timing.forEach((t) => warn.push(t.supplement + ': ' + t.note));
  return nav({ back: 'Plan', backTo: 'plan', title: 'Supplements' }) + pageTitle('Supplements', 'And superfoods')
    + `<div class="stack">${proposed.map((s) => card(`<div class="eyebrow">Coach suggests</div><p class="body" style="margin-top:4px">${esc(s.name)}</p><p class="sub">${esc((s.data && s.data.reason) || '')} Check with your doctor first.</p><div class="split">${textBtn('Add', 'confirm', { 'data-tab': 'Supplements', 'data-id': s.id, 'data-accept': '1' })}${textBtn('No thanks', 'confirm', { 'data-tab': 'Supplements', 'data-id': s.id, 'data-accept': '0' })}</div>`)).join('')}
    <div>${sectionTitle('Today')}${mine.length ? listCard(mine.map((s) => {
      const r = L.refillDue({ lastRefill: s.lastRefill, refillDays: s.refillDays }, S.today());
      const on = taken.has(s.suppId);
      return `<div class="row"><button type="button" data-act="supp-toggle" data-s="${esc(s.suppId)}" aria-pressed="${on}" style="display:flex;align-items:center;gap:12px;background:none;border:0;padding:0;text-align:left;flex:1;min-height:44px">${checkCircle(on)}<span class="row-main"><span class="row-label">${esc(s.name)}${s.dose ? ' · ' + esc(s.dose) : ''}</span><span class="row-sub">${esc(s.timing || '')}${r ? ' · refill ' + (r.daysLeft <= 0 ? 'now' : 'in ' + r.daysLeft + ' days') : ''}</span></span></button><button type="button" class="btn-icon" style="background:none;margin-right:-15px" data-act="supp-more" data-id="${esc(s.id)}" data-s="${esc(s.suppId)}" aria-label="More about ${esc(s.name)}">${chev()}</button></div>`;
    }), 'no-ic') : card('<p class="sub">Nothing on your list yet. Add what you take so we can check timing, overlaps and refills.</p>')}
    <div class="center">${textBtn('Add a supplement', 'supp-add', {}, { icon: 'plus' })}</div></div>
    ${listCard([
      warn.length ? row({ icon: 'info', label: 'Worth knowing', value: String(warn.length), act: 'supp-warn' }) : '',
      row({ icon: 'droplet', label: 'Blood tests', sub: 'Results and what to ask your doctor', act: 'go', data: { 'data-to': 'summary/labs' } })
    ])}
    <div>${sectionTitle('What the evidence says')}${listCard([
      row({ icon: 'pill', label: 'Supplements', value: String(K.SUPPLEMENTS.filter((x) => x.category !== 'food').length), act: 'evidence', data: { 'data-k': 'mine' } }),
      row({ icon: 'sparkles', label: 'Superfoods', value: String(K.SUPPLEMENTS.filter((x) => x.category === 'food').length), act: 'evidence', data: { 'data-k': 'food' } })
    ])}</div></div>`;
}
function suppSheet(sid) {
  const s = K.SUPPLEMENTS.find((x) => x.id === sid);
  if (!s) { toast('This one is a custom item. Ask your coach about it.', { icon: 'info' }); return; }
  const mine = S.supplements(S.meId()).some((x) => x.suppId === sid && x.status === 'active');
  const blocks = [['How', s.how], ['Timing', s.timing], ['Kosher', s.kosher && s.kosher !== '—' ? s.kosher : ''], ['Cautions', s.cautions]].filter((b) => b[1]);
  openSheet({ title: s.name, body: `<div class="eyebrow">${s.category === 'food' ? 'Superfood' : 'Supplement'} · evidence: ${esc(K.RATING_LABEL[s.rating] || s.rating)}${s.category !== 'food' && s.weightLoss ? ' · weight loss: ' + esc(K.RATING_LABEL[s.weightLoss] || s.weightLoss) : ''}</div>
    <p class="body">${esc(s.summary)}</p>
    ${blocks.map(([h, t]) => `<div><div class="h3">${esc(h)}</div><p class="sub" style="margin-top:4px">${esc(t)}</p></div>`).join('')}
    ${(s.interactions || []).length ? `<div><div class="h3">Medication interactions</div><ul class="bullets" style="margin-top:4px">${s.interactions.map((i) => `<li class="sub">${esc(i.note)}</li>`).join('')}</ul></div>` : ''}
    ${(s.sources || []).length ? `<div class="inset">${s.sources.map((k) => K.SOURCES[k]).filter(Boolean).map((src) => `<a class="row" href="${esc(src.url)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><span class="row-main"><span class="row-label">${esc(src.title)}</span></span>${icon('external-link', 'ic-s')}</a>`).join('')}</div>` : ''}
    <p class="caption">Not medical advice. Check with your doctor or pharmacist before starting anything new.</p>
    ${s.category !== 'food' && s.rating !== 'not' && !mine ? primary('Add to my list', 'supp-add-id', { 'data-s': s.id }) : ''}` });
}

// ------------------------------------------------------------------ What can I make? (typed; the photo goes through the camera)
const pantry = { busy: false, error: '', result: null, kind: 'any', text: '' };
function makePage() {
  const r = pantry.result;
  return nav({ back: 'Plan', backTo: 'plan', title: 'What can I make?' }) + pageTitle('What can I make?', 'Three kosher ideas from what you have.')
    + `<div class="stack">${seg([['any', 'You pick'], ['meat', 'Meat'], ['dairy', 'Dairy'], ['pareve', 'Pareve']], pantry.kind, 'pantry-kind', { label: 'Meat, dairy or pareve' })}
      <label class="field"><span>What do you have?</span><textarea id="pantry-text" rows="3" maxlength="600" placeholder="For example: chicken thighs, rice, peppers, eggs">${esc(pantry.text)}</textarea></label>
      ${primary('Get ideas', 'pantry-go')}
      <div class="center">${textBtn('Use a photo instead', 'photo-sheet', { 'data-hint': 'pantry' }, { icon: 'camera' })}</div>
      ${pantry.error ? `<p class="note bad">${icon('circle-alert')}<span>${esc(pantry.error)}</span></p>` : ''}
      ${r && r.needKind ? `<p class="note">${icon('info')}<span>${esc(r.question || 'Meat or dairy tonight?')} Pick one above and tap Get ideas again.</span></p>` : ''}
      ${r ? (r.ideas.length ? r.ideas.map(ideaCard).join('') : card('<p class="sub">No ideas fit that combination. Try another kind or add a few more items.</p>')) : ''}</div>`;
}
export function ideaCard(x, i) {
  return card(`<div class="split"><span class="eyebrow">${esc(x.minutes)} min · serves ${esc(x.serves)}</span>${kindChip(x.kind)}</div><h3 class="card-title" style="font-size:var(--f22)">${esc(x.title)}</h3>
    ${x.uses && x.uses.length ? `<p class="sub">You have: ${esc(x.uses.join(', '))}</p>` : ''}${x.also_need && x.also_need.length ? `<p class="sub">You'd need: ${esc(x.also_need.join(', '))}</p>` : ''}
    <ol class="steps" style="margin-top:8px">${(x.steps || []).map((s) => `<li class="sub">${esc(s)}</li>`).join('')}</ol>
    <div class="center">${x.saved ? `<p class="sub">${icon('check', 'ic-s')} Saved to your recipes</p>` : textBtn('Save to my recipes', 'pantry-save', { 'data-i': i })}</div>`);
}

// ------------------------------------------------------------------ actions
export const actions = Object.assign({}, Groceries.actions, {
  'set-version'(el) { S.write('settings', { values: { day_version: { date: S.today(), v: +el.dataset.v } } }); },
  'walk-choose'(el) { S.setUi('walkPick', +el.dataset.v); rerender(); },
  meal(el) { mealSheet(el.dataset.k); },
  recipe(el) { if (el.dataset.id) recipeSheet(el.dataset.id); },
  'recipe-kind'(el) { S.setUi('recipeKind', el.dataset.v); rerender(); },
  'supp-warn'() {
    const id = S.meId();
    const checks = S.suppChecks(id);
    const warn = [];
    checks.overlaps.forEach((o) => warn.push('Double dose? ' + o.nutrient.replace('_', ' ') + ' is in ' + o.from.join(' and ') + '. Check the total.'));
    checks.interactions.concat(checks.cautions).forEach((x) => warn.push(x.supplement + ': ' + x.note));
    checks.timing.forEach((t) => warn.push(t.supplement + ': ' + t.note));
    openSheet({ title: 'Worth knowing', body: `<ul class="bullets">${warn.map((w) => `<li class="body">${esc(w)}</li>`).join('')}</ul><p class="caption">Check with your doctor or pharmacist before starting, stopping or changing anything.</p>` });
  },
  evidence(el) {
    const food = el.dataset.k === 'food';
    const cat = K.SUPPLEMENTS.filter((x) => (food ? x.category === 'food' : x.category !== 'food'));
    openSheet({ title: food ? 'Superfoods' : 'Supplements', body: `<div class="inset">${cat.map((x) => row({ label: x.name, value: K.RATING_LABEL[x.rating] || x.rating, act: 'supp-info', data: { 'data-s': x.id } })).join('')}</div>
      <p class="caption">Evidence for health in general${food ? '' : '; the weight-loss evidence is inside each one'}. Kosher: buy products with a reliable hechsher. Watch for gelatin capsules, fish-oil sourcing and dairy whey.</p>` });
  },
  async 'meal-regen'(el) {
    await busy(el, async () => {
      try { await call('mealPlan', {}, { timeout: 120000 }); await S.sync(); toast('New plan ready. Groceries updated.'); }
      catch (e) { toast(e.message, { kind: 'err' }); }
    });
  },
  'supp-toggle'(el) {
    const on = el.getAttribute('aria-pressed') === 'true';
    const op = S.write('logSupplement', { date: S.today(), suppId: el.dataset.s, taken: !on });
    if (!on) logged(op, 'Taken. Logged.');
  },
  'supp-more'(el) {
    const s = S.supplements(S.meId()).find((x) => x.id === el.dataset.id);
    if (!s) return;
    openSheet({ title: s.name, body: `<div class="inset">${row({ label: 'About this supplement', act: 'supp-info', data: { 'data-s': s.suppId } })}${row({ label: 'Refilled today', act: 'supp-refill', data: { 'data-id': s.id } })}${row({ label: 'Stop taking it', act: 'supp-stop', data: { 'data-id': s.id } })}</div>` });
  },
  'supp-info'(el) { closeSheet(); setTimeout(() => suppSheet(el.dataset.s), 0); },
  'supp-refill'(el) { S.write('supplements', { op: 'refill', id: el.dataset.id, date: S.today(), refillDays: 30 }); closeSheet(); toast('Got it. We\'ll remind you in about a month.'); },
  'supp-stop'(el) { S.write('supplements', { op: 'stop', id: el.dataset.id }); closeSheet(); toast('Stopped.'); },
  'supp-add'() {
    const have = new Set(S.supplements(S.meId()).map((s) => s.suppId));
    openSheet({ title: 'Add a supplement', body: `<p class="sub">Check with your doctor or pharmacist first, especially with medications, pregnancy or nursing.</p>
      <div class="inset">${K.SUPPLEMENTS.filter((s) => s.category !== 'food' && s.rating !== 'not' && !have.has(s.id)).map((s) => row({ label: s.name, sub: s.timingShort || '', act: 'supp-add-id', data: { 'data-s': s.id } })).join('')}</div>
      <label class="field"><span>Something else</span><input id="supp-custom" type="text" maxlength="80" placeholder="Name" enterkeyhint="done" autocapitalize="words" data-enter="supp-add-custom"></label><p class="hint" id="supp-custom-hint" hidden>Type the name first, then tap Add.</p>${primary('Add', 'supp-add-custom')}` });
  },
  'supp-add-id'(el) { S.write('supplements', { op: 'add', suppId: el.dataset.s }); closeSheet(); toast('Added to your list.'); },
  'supp-add-custom'() {
    const inp = document.getElementById('supp-custom');
    const v = inp.value.trim();
    if (!v) { const h = document.getElementById('supp-custom-hint'); if (h) h.hidden = false; inp.focus(); return; }
    S.write('supplements', { op: 'add', suppId: 'custom_' + v.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 30), name: L.capItem(v) });
    closeSheet(); toast('Added.');
  },
  'pantry-kind'(el) { pantry.kind = el.dataset.v; const box = document.getElementById('pantry-text'); if (box) pantry.text = box.value; rerender(); },
  async 'pantry-go'(el) {
    const box = document.getElementById('pantry-text');
    pantry.text = box ? box.value.trim() : pantry.text;
    if (!pantry.text) { pantry.error = 'Type a few things you have, or use a photo.'; rerender(); return; }
    pantry.error = ''; pantry.result = null;
    await busy(el, async () => {
      try { pantry.result = await call('pantryIdeas', { text: pantry.text, kind: pantry.kind }, { timeout: 120000 }); }
      catch (e) { pantry.error = e.message; }
    });
    rerender();
  },
  async 'pantry-save'(el) {
    const idea = pantry.result && pantry.result.ideas[+el.dataset.i];
    if (!idea) return;
    await busy(el, async () => {
      try {
        const r = await call('saveRecipe', { recipe: idea });
        idea.saved = r.recipeId;
        const c = S.data.content = S.data.content || {};
        (c.recipes = c.recipes || []).push({ id: r.recipeId, rowId: r.id, title: idea.title, kind: idea.kind, meal: idea.meal, minutes: idea.minutes, serves: idea.serves, ing: (idea.ingredients || []).map((x) => [x.qty, x.item, x.section]), steps: idea.steps, status: 'active' });
        S.persist(); S.changed();
        toast('Saved to your recipes.');
      } catch (e) { toast(e.message, { kind: 'err' }); }
    });
  }
  // ("I walked" is shared with Summary: summary.js handles the walked action)
});
export const changes = Object.assign({}, Groceries.changes || {});
export { ideaCard as pantryIdeaCard, go };
