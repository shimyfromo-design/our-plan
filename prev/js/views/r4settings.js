/* Round 4 settings and one-time questions: Equipment (2.1), the injuries question (2.9), weekly minutes and "On the road"
 * days (2.10, 3.2), Meal times (3.2), Store (5.1), Events (7.1). Pages live under #/me/…; the owner can edit the partner's
 * equipment and week (?for=<id>), never her "Keep it gentle". */
import { L, K, esc, icon, toast, openSheet, updateSheet, closeSheet } from '../core.js?v=132c8397ab';
import { S } from '../store.js?v=016968e4cd';
import { go, rerender, route } from '../nav.js?v=57c55c9996';
import { nav, pageTitle, listCard, row, primary, textBtn, sectionTitle, picks, card } from '../ui.js?v=028af192f4';
import { bandChip } from './workout.js?v=764b9c066a';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const back = (title) => nav({ back: 'Settings', backTo: 'me/settings', title });
let sheetFor = ''; // a sheet opened from the partner's settings page (data-for) edits theirs
const forId = () => { const p = route().params || {}; const f = sheetFor || p.for; return f && S.isOwner() ? f : ''; };
const remember = (el) => { sheetFor = (el && el.dataset && el.dataset.for) || ''; };
const target = () => { const f = forId(); return f ? (S.data.people || []).find((x) => x.id === f) || S.me() : S.me(); };
const settingsOf = (t) => (t && t.id === S.meId() ? S.settings() : ((t && t.settings) || {}));
function save(values, forUser) { S.write('settings', forUser ? { values, forUser } : { values }); }

export function render(r) {
  const p = r.parts[1];
  if (p === 'equipment') return equipmentPage();
  if (p === 'meals') return mealTimesPage();
  if (p === 'store') return storePage();
  if (p === 'events') return eventsPage();
  return '';
}
export const PAGES = ['equipment', 'meals', 'store', 'events'];

// ------------------------------------------------------------------ 2.1 Equipment
function equipmentPage() {
  const t = target(), s = settingsOf(t);
  const eq = s.equipment || K.EQUIPMENT_DEFAULT;
  const ladder = L.bandLadder(eq);
  const title = forId() ? t.name + '\'s equipment' : 'Equipment';
  return back(title) + pageTitle(title, eq.brand + ' tube bands, stackable') + `<div class="stack">
    <div>${sectionTitle('Tube bands')}${listCard(eq.tubes.map((b, i) => row({ labelHtml: bandChip(L.bandLadder({ tubes: [b] })[0]).replace('class="bandchip"', 'class="bandchip bare"'), act: 'eq-band', data: { 'data-i': i }, cls: 'no-ic' })), 'no-ic')}
      <p class="caption" style="margin:8px 4px 0">Check the colors and pounds on the box. Tap a band to change it.</p></div>
    <div>${sectionTitle('Stacks the app uses')}${listCard(ladder.filter((x) => x.colors.length > 1).map((x) => row({ labelHtml: bandChip(x).replace('class="bandchip"', 'class="bandchip bare"'), cls: 'no-ic' })), 'no-ic')}</div>
    <div>${sectionTitle('Also in the box')}${listCard([row({ label: 'Fabric loops', sub: esc((eq.loops || []).join(' · ')), cls: 'no-ic wrap' }), row({ label: 'Door anchor, handles, ankle straps', value: 'Yes', cls: 'no-ic' })], 'no-ic')}</div>
    <div>${sectionTitle('Dumbbells')}${listCard([row({ label: 'Pairs', value: esc((eq.dumbbells || [5, 10]).map((w) => w + ' lb').join(' and ')), cls: 'no-ic' }),
      row({ label: 'Adjustable dumbbells', sub: eq.adjustable ? esc((eq.adjustable.name ? eq.adjustable.name + ' · ' : '') + eq.adjustable.min + ' to ' + eq.adjustable.max + ' lb, ' + eq.adjustable.step + '-lb steps') : 'The dumbbell moves follow their weight steps', value: eq.adjustable ? '' : 'Add', act: 'eq-adj', cls: 'no-ic wrap' })], 'no-ic')}</div>
    <div class="center">${textBtn('Back to the WHATAFIT set', 'eq-reset')}</div></div>`;
}

// ------------------------------------------------------------------ 3.2 Meal times (household)
function mealTimesPage() {
  const h = S.household(), mt = h.meal_times || { breakfast: '07:30', lunch: '12:30', supper: '18:30' }, owner = S.isOwner();
  const tin = (k, label) => row({ label, right: owner ? `<input type="time" class="time-in" value="${esc(mt[k])}" data-change="meal-time" data-k="${k}" aria-label="${esc(label)} time">` : `<span class="row-value">${esc(L.fmt12(mt[k]))}</span>`, cls: 'no-ic' });
  return back('Meal times') + pageTitle('Meal times', 'For both of you') + `<div class="stack">
    ${listCard([tin('breakfast', 'Breakfast'), tin('lunch', 'Lunch'), tin('supper', 'Supper')], 'no-ic')}
    <div>${listCard([row({ label: 'Hours between meat and dairy', right: owner ? `<select class="time-in" data-change="md-hours" aria-label="Hours between meat and dairy">${[1, 3, 5.5, 6].map((n) => `<option value="${Math.ceil(n)}" ${+(h.meat_dairy_hours || 6) === Math.ceil(n) ? 'selected' : ''}>${Math.ceil(n)}</option>`).join('')}</select>` : `<span class="row-value">${+(h.meat_dairy_hours || 6)}</span>`, cls: 'no-ic' })], 'no-ic')}
    <p class="caption" style="margin:8px 4px 0">The week's plan never puts a dairy meal within these hours after a meat meal. Supper reminders and the after-supper walk use these times.</p></div></div>`;
}

// ------------------------------------------------------------------ 5.1 Store (household, owner)
function storePage() {
  const h = S.household(), st = h.store || {}, owner = S.isOwner();
  if (!owner) return back('Store') + pageTitle('Store') + `<p class="note">${icon('lock')}<span>Set by ${esc(S.ownerName())}</span></p>`;
  const weekly = st.weekly || [];
  const butcher = Object.keys(st.butcher || {});
  const walk = st.walkOrder || ['Produce', 'Butcher', 'Fish', 'Dairy', 'Grocery', 'Household'];
  return back('Store') + pageTitle(st.name || 'Breadberry', 'Where the weekly order goes') + `<div class="stack">
    <div>${listCard([
      row({ label: 'WhatsApp number', sub: st.whatsapp ? 'Saved' : 'Not set yet', act: 'store-field', data: { 'data-k': 'whatsapp' }, cls: 'no-ic' }),
      row({ label: 'Email address', sub: st.email ? 'Saved' : 'Not set yet', act: 'store-field', data: { 'data-k': 'email' }, cls: 'no-ic' })
    ], 'no-ic')}<p class="caption" style="margin:8px 4px 0">Kept only in your Google Sheet.</p></div>
    <div>${sectionTitle('Every week')}${listCard(weekly.map((w, i) => row({ label: w.item, value: esc(w.qty || ''), act: 'store-weekly', data: { 'data-i': i }, cls: 'no-ic' })).concat([row({ label: 'Add an item', act: 'store-weekly', data: { 'data-i': -1 }, cls: 'no-ic' })]), 'no-ic')}</div>
    <div>${sectionTitle('Butcher notes')}${listCard(butcher.map((k) => row({ label: k, sub: esc(st.butcher[k]), act: 'store-butcher', data: { 'data-k': k }, cls: 'no-ic' })).concat([row({ label: 'Add a standing note', sub: 'For example: ground beef, ground twice', act: 'store-butcher', data: { 'data-k': '' }, cls: 'no-ic' })]), 'no-ic')}</div>
    <div>${sectionTitle('If something\'s out')}${listCard([row({ label: 'Don\'t substitute', right: st.sub !== 'similar' ? icon('check', 'ic-s t-accent') : '', act: 'store-sub', data: { 'data-v': 'none' }, cls: 'no-ic', noChev: true }), row({ label: 'A similar item is fine', right: st.sub === 'similar' ? icon('check', 'ic-s t-accent') : '', act: 'store-sub', data: { 'data-v': 'similar' }, cls: 'no-ic', noChev: true })], 'no-ic')}</div>
    <div>${sectionTitle('Walk order')}${listCard(walk.map((d, i) => row({ label: (i + 1) + '. ' + d, act: 'store-walk', data: { 'data-i': i }, cls: 'no-ic' })), 'no-ic')}<p class="caption" style="margin:8px 4px 0">The in-store list follows this order. Tap a row to move it.</p></div></div>`;
}
function setStore(patch) {
  const st = Object.assign({}, S.household().store || {}, patch);
  save({ store: st });
  rerender();
}

// ------------------------------------------------------------------ 7.1 Events (simchas)
function eventsPage() {
  const t = target(), s = settingsOf(t), ev = (s.events || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  return back('Events') + pageTitle('Events', 'A game plan comes three days before') + `<div class="stack">
    ${listCard(ev.map((e) => row({ label: cap(e.kind) + (e.note ? ' · ' + e.note : ''), sub: L.WEEKDAYS[L.weekday(e.date)] + ', ' + e.date.slice(5).replace('-', '/'), act: 'event-del', data: { 'data-id': e.id }, value: 'Remove', cls: 'no-ic', noChev: true })).concat([row({ label: 'Add an event', act: 'event-add', cls: 'no-ic' })]), 'no-ic')}
    <p class="caption" style="margin:0 4px">Yom Tov, Chanukah and Purim come from the calendar by themselves.</p></div>`;
}
const cap = (t) => String(t || '').charAt(0).toUpperCase() + String(t || '').slice(1);

// ------------------------------------------------------------------ 2.9 the injuries question (once per person)
let injPick = null;
export function injuriesSheet() {
  const p = S.profile();
  if (!injPick) injPick = new Set(L.injuryKeys(p.injuries));
  const chips = L.INJURY_KEYS.map((k) => [k, L.INJURY_LABELS[k]]).concat([['none', 'None']]);
  const body = `<p class="sub">The coach picks safer moves around them.</p>
    <div class="picks" role="group" aria-label="Pain or old injuries">${chips.map(([k, l]) => { const on = k === 'none' ? injPick.size === 0 && injPick.none : injPick.has(k); return `<button type="button" class="pick${on ? ' on' : ''}" aria-pressed="${on}" data-act="inj-pick" data-k="${k}">${esc(l)}</button>`; }).join('')}</div>
    <label class="field"><span>Tell the coach more</span><textarea id="inj-note" rows="2" placeholder="Optional">${esc(p.injuries_note || '')}</textarea></label>
    ${primary('Save', 'inj-save')}`;
  const open = document.querySelector('#sheet-root.open .sheet-body');
  if (open && open.dataset.kind === 'injuries') return updateSheet({ title: 'Any pain or old injuries?', body });
  const b = openSheet({ title: 'Any pain or old injuries?', body, label: 'Any pain or old injuries?' });
  b.dataset.kind = 'injuries';
  return b;
}
/** First open after the update: asked once per person (after What's new). */
export function maybeAsk() {
  if (!S.ready || !S.setupDone() || S.ui.injAsked || document.querySelector('#sheet-root.open')) return;
  if (S.profile().injuries_asked) return;
  S.setUi('injAsked', true);
  injPick = null;
  injuriesSheet();
}

export const actions = {
  'inj-pick'(el) {
    const k = el.dataset.k;
    if (k === 'none') { injPick = new Set(); injPick.none = true; }
    else { if (injPick.has(k)) injPick.delete(k); else injPick.add(k); injPick.none = false; }
    injuriesSheet();
  },
  'inj-sheet'() { injPick = null; injuriesSheet(); },
  'inj-save'() {
    const keys = Array.from(injPick || []);
    const note = (document.getElementById('inj-note') || {}).value || '';
    S.write('injuries', { keys, note });
    // on this phone right away (the back office keeps the history)
    const pr = (S.data.me.profile = S.data.me.profile || {});
    pr.injuries = keys.map((k) => L.INJURY_LABELS[k]); pr.injuries_asked = S.today();
    if (keys.join() !== L.injuryKeys(pr.injuries).join()) pr.injuries_since = S.today();
    S.persist(); S.changed();
    closeSheet();
    toast(keys.length ? 'Saved. The coach will work around it.' : 'Saved.');
  },
  'eq-band'(el) {
    sheetFor = '';
    const t = target(), s = settingsOf(t), eq = JSON.parse(JSON.stringify(s.equipment || K.EQUIPMENT_DEFAULT)), i = +el.dataset.i, b = eq.tubes[i];
    openSheet({ title: 'Band', body: `<label class="field"><span>Color</span><input id="eq-color" value="${esc(b.color)}" autocomplete="off"></label><label class="field"><span>Pounds</span><input id="eq-lb" type="number" inputmode="numeric" value="${esc(b.lb)}"></label>${primary('Save', 'eq-save', { 'data-i': i })}` });
  },
  'eq-save'(el) {
    const t = target(), s = settingsOf(t), eq = JSON.parse(JSON.stringify(s.equipment || K.EQUIPMENT_DEFAULT)), i = +el.dataset.i;
    const color = String((document.getElementById('eq-color') || {}).value || '').trim(), lb = Math.round(+(document.getElementById('eq-lb') || {}).value);
    if (!color || !(lb > 0 && lb <= 200)) { toast('Add a color and pounds between 1 and 200.', { kind: 'err' }); return; }
    eq.tubes[i] = { color: color.charAt(0).toUpperCase() + color.slice(1).toLowerCase(), lb };
    save({ equipment: eq }, forId());
    if (t.id === S.meId()) S.data.me.settings.equipment = eq; else t.settings = Object.assign({}, t.settings, { equipment: eq });
    closeSheet(); rerender();
  },
  // Round 5 (3.3, 8.1): adjustable dumbbells; the dumbbell rungs follow their steps (Bowflex SelectTech 552: 5 to 52.5 lb, 2.5-lb steps to 25)
  'eq-adj'() {
    sheetFor = forId();
    const a = (settingsOf(target()).equipment || {}).adjustable || { name: 'SelectTech 552', min: 5, max: 52.5, step: 2.5 };
    openSheet({ title: 'Adjustable dumbbells', body: `<label class="field"><span>Name</span><input id="adj-name" value="${esc(a.name || '')}" autocomplete="off"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px"><label class="field"><span>Lightest</span><input id="adj-min" type="text" inputmode="decimal" value="${esc(a.min)}"></label><label class="field"><span>Heaviest</span><input id="adj-max" type="text" inputmode="decimal" value="${esc(a.max)}"></label><label class="field"><span>Step</span><input id="adj-step" type="text" inputmode="decimal" value="${esc(a.step)}"></label></div>
      <p class="caption">In pounds, per dumbbell. Above 25 lb the steps are 5 lb.</p>${primary('Save', 'eq-adj-save')}${(settingsOf(target()).equipment || {}).adjustable ? textBtn('Remove', 'eq-adj-remove', {}, { cls: 'block t-problem' }) : ''}` });
  },
  'eq-adj-save'() {
    const t = target(), s = settingsOf(t), eq = JSON.parse(JSON.stringify(s.equipment || K.EQUIPMENT_DEFAULT));
    const v = (id) => +String((document.getElementById(id) || {}).value || '').replace(',', '.');
    const a = { name: String((document.getElementById('adj-name') || {}).value || '').trim().slice(0, 40), min: v('adj-min'), max: v('adj-max'), step: v('adj-step') };
    if (!(a.min > 0 && a.max > a.min && a.max <= 150 && a.step > 0 && a.step <= 10)) { toast('Check the pounds: lightest, heaviest and the step.', { kind: 'err' }); return; }
    eq.adjustable = a; eq.dumbbells = eq.dumbbells || [5, 10];
    save({ equipment: eq }, forId());
    if (t.id === S.meId()) S.data.me.settings.equipment = eq; else t.settings = Object.assign({}, t.settings, { equipment: eq });
    closeSheet(); rerender(); toast('Saved. The dumbbell moves follow these steps.');
  },
  'eq-adj-remove'() {
    const t = target(), s = settingsOf(t), eq = JSON.parse(JSON.stringify(s.equipment || K.EQUIPMENT_DEFAULT));
    delete eq.adjustable; save({ equipment: eq }, forId());
    if (t.id === S.meId()) S.data.me.settings.equipment = eq; else t.settings = Object.assign({}, t.settings, { equipment: eq });
    closeSheet(); rerender();
  },
  'eq-reset'() { sheetFor = ''; const t = target(); save({ equipment: K.EQUIPMENT_DEFAULT }, forId()); if (t.id === S.meId()) S.data.me.settings.equipment = K.EQUIPMENT_DEFAULT; rerender(); toast('Back to the WHATAFIT set.'); },
  'meal-time'(el) { const mt = Object.assign({ breakfast: '07:30', lunch: '12:30', supper: '18:30' }, S.household().meal_times || {}); mt[el.dataset.k] = el.value; save({ meal_times: mt }); },
  'md-hours'(el) { save({ meat_dairy_hours: +el.value }); },
  'store-field'(el) {
    const k = el.dataset.k, st = S.household().store || {};
    openSheet({ title: k === 'whatsapp' ? 'WhatsApp number' : 'Email address', body: `<label class="field"><span>${k === 'whatsapp' ? 'Number with the country code, digits only' : 'Address'}</span><input id="store-val" ${k === 'whatsapp' ? 'type="tel" inputmode="tel"' : 'type="email" inputmode="email"'} value="${esc(st[k] || '')}" autocomplete="off"></label>${primary('Save', 'store-field-save', { 'data-k': k })}` });
  },
  'store-field-save'(el) { const v = String((document.getElementById('store-val') || {}).value || '').trim(); closeSheet(); setStore({ [el.dataset.k]: el.dataset.k === 'whatsapp' ? v.replace(/[^\d]/g, '') : v }); },
  'store-weekly'(el) {
    const i = +el.dataset.i, w = (S.household().store || {}).weekly || [], cur = i >= 0 ? w[i] : { item: '', qty: '' };
    openSheet({ title: i >= 0 ? 'Every week' : 'Add to every week', body: `<label class="field"><span>Item</span><input id="sw-item" value="${esc(cur.item)}" autocomplete="off"></label><label class="field"><span>How many</span><input id="sw-qty" value="${esc(cur.qty || '')}" autocomplete="off"></label>${primary('Save', 'store-weekly-save', { 'data-i': i })}${i >= 0 ? textBtn('Remove', 'store-weekly-del', { 'data-i': i }, { cls: 'block t-problem' }) : ''}` });
  },
  'store-weekly-save'(el) {
    const i = +el.dataset.i, w = ((S.household().store || {}).weekly || []).slice();
    const item = String((document.getElementById('sw-item') || {}).value || '').trim(), qty = String((document.getElementById('sw-qty') || {}).value || '').trim();
    if (!item) { toast('Add the item.', { kind: 'err' }); return; }
    if (i >= 0) w[i] = { item, qty }; else w.push({ item, qty });
    closeSheet(); setStore({ weekly: w });
  },
  'store-weekly-del'(el) { const w = ((S.household().store || {}).weekly || []).slice(); w.splice(+el.dataset.i, 1); closeSheet(); setStore({ weekly: w }); },
  'store-butcher'(el) {
    const k = el.dataset.k, b = (S.household().store || {}).butcher || {};
    openSheet({ title: 'Butcher note', body: `<label class="field"><span>Item</span><input id="sb-item" value="${esc(k)}" autocomplete="off"></label><label class="field"><span>Standing note</span><input id="sb-note" value="${esc(b[k] || '')}" autocomplete="off"></label>${primary('Save', 'store-butcher-save', { 'data-k': k })}${k ? textBtn('Remove', 'store-butcher-del', { 'data-k': k }, { cls: 'block t-problem' }) : ''}` });
  },
  'store-butcher-save'(el) {
    const b = Object.assign({}, (S.household().store || {}).butcher || {});
    const item = String((document.getElementById('sb-item') || {}).value || '').trim(), note = String((document.getElementById('sb-note') || {}).value || '').trim();
    if (!item || !note) { toast('Add the item and the note.', { kind: 'err' }); return; }
    if (el.dataset.k && el.dataset.k !== item) delete b[el.dataset.k];
    b[item] = note; closeSheet(); setStore({ butcher: b });
  },
  'store-butcher-del'(el) { const b = Object.assign({}, (S.household().store || {}).butcher || {}); delete b[el.dataset.k]; closeSheet(); setStore({ butcher: b }); },
  'store-sub'(el) { setStore({ sub: el.dataset.v }); },
  'store-walk'(el) {
    const i = +el.dataset.i, walk = ((S.household().store || {}).walkOrder || ['Produce', 'Butcher', 'Fish', 'Dairy', 'Grocery', 'Household']);
    openSheet({ title: walk[i], body: `<div class="inset">${i > 0 ? textBtn('Move up', 'store-walk-move', { 'data-i': i, 'data-d': -1 }, { cls: 'block' }) : ''}${i < walk.length - 1 ? textBtn('Move down', 'store-walk-move', { 'data-i': i, 'data-d': 1 }, { cls: 'block' }) : ''}</div>` });
  },
  'store-walk-move'(el) {
    const walk = ((S.household().store || {}).walkOrder || ['Produce', 'Butcher', 'Fish', 'Dairy', 'Grocery', 'Household']).slice();
    const i = +el.dataset.i, j = i + +el.dataset.d;
    [walk[i], walk[j]] = [walk[j], walk[i]];
    closeSheet(); setStore({ walkOrder: walk });
  },
  'event-add'() {
    sheetFor = '';
    openSheet({ title: 'Add an event', body: `<label class="field"><span>Date</span><input id="ev-date" type="date" value="${esc(L.addDays(S.today(), 7))}"></label>
      <div class="picks" role="group" aria-label="Kind">${['wedding', 'bar mitzvah', 'kiddush', 'party', 'other'].map((k, i) => `<button type="button" class="pick${i === 0 ? ' on' : ''}" aria-pressed="${i === 0}" data-act="ev-kind" data-k="${k}">${cap(k)}</button>`).join('')}</div>
      <label class="field"><span>Note</span><input id="ev-note" placeholder="Optional" autocomplete="off"></label>${primary('Add', 'event-save')}` });
  },
  'ev-kind'(el) { document.querySelectorAll('[data-act="ev-kind"]').forEach((b) => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); },
  'event-save'() {
    const date = (document.getElementById('ev-date') || {}).value, note = String((document.getElementById('ev-note') || {}).value || '').trim();
    const kind = ((document.querySelector('[data-act="ev-kind"].on') || {}).dataset || {}).k || 'other';
    if (!L.isISODate(date)) { toast('Pick a date.', { kind: 'err' }); return; }
    const t = target(), ev = (settingsOf(t).events || []).concat([{ id: 'e' + Date.now().toString(36), date, kind, note }]);
    save({ events: ev }, forId()); if (t.id === S.meId()) S.data.me.settings.events = ev;
    closeSheet(); rerender();
  },
  'event-del'(el) { sheetFor = ''; const t = target(), ev = (settingsOf(t).events || []).filter((e) => e.id !== el.dataset.id); save({ events: ev }, forId()); if (t.id === S.meId()) S.data.me.settings.events = ev; rerender(); },
  'week-minutes'(el) {
    remember(el);
    const t = target(), s = settingsOf(t), g = s.weekly_minutes || {};
    const gentle = !!(S.person(t.id) || {}).safe && s.keep_gentle !== false;
    openSheet({ title: 'Weekly minutes', body: `<p class="sub">Workouts and walks, Sunday to Shabbos. Steps from iPhone Health count as walking above 3,000 a day.</p>
      <label class="field"><span>Goal this week</span><input id="wm-base" type="number" inputmode="numeric" value="${esc(L.weeklyGoal({ setting: g, date: S.today(), gentle }))}"></label>
      ${gentle ? '<p class="caption">No weekly rise while "Keep it gentle" is on.</p>' : `<div class="split"><span class="row-label">Rise 10% a week, up to 250</span><input type="checkbox" class="switch" id="wm-rise" ${g.rise !== false ? 'checked' : ''} aria-label="Rise 10% a week"></div>`}
      ${primary('Save', 'week-minutes-save')}` });
  },
  'week-minutes-save'() {
    const t = target(), base = Math.round(+(document.getElementById('wm-base') || {}).value), rise = document.getElementById('wm-rise') ? document.getElementById('wm-rise').checked : false;
    if (!(base >= 30 && base <= 600)) { toast('Choose between 30 and 600 minutes.', { kind: 'err' }); return; }
    const v = { base, start: S.today(), rise };
    save({ weekly_minutes: v }, forId()); if (t.id === S.meId()) S.data.me.settings.weekly_minutes = v;
    closeSheet(); rerender();
  },
  'road-days'(el) {
    remember(el);
    const t = target(), d = settingsOf(t).road_days || (t.id === S.household().ownerId ? [1, 2, 3, 4] : []);
    openSheet({ title: 'On the road', body: `<p class="sub">Packable lunches on these days, and steps count toward your active minutes.</p><div class="picks" role="group" aria-label="On the road days">${DAYS.slice(0, 5).map((n, i) => `<button type="button" class="pick${d.indexOf(i) >= 0 ? ' on' : ''}" aria-pressed="${d.indexOf(i) >= 0}" data-act="road-pick" data-d="${i}">${n.slice(0, 3)}</button>`).join('')}</div>${primary('Save', 'road-save')}` });
  },
  'road-pick'(el) { const on = !el.classList.contains('on'); el.classList.toggle('on', on); el.setAttribute('aria-pressed', on); },
  'road-save'() {
    const t = target(), d = Array.from(document.querySelectorAll('[data-act="road-pick"].on')).map((b) => +b.dataset.d);
    save({ road_days: d }, forId()); if (t.id === S.meId()) S.data.me.settings.road_days = d;
    closeSheet(); rerender();
  }
};
