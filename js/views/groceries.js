/* Groceries (D8): one list for both phones, by aisle. "2 lb chicken breast" becomes Chicken breast · 2 lb,
 * checked items fold into "Bought", swipe left deletes, and both phones refresh on focus and every 30 seconds. */
import { L, K, esc, icon, toast, openSheet, copyText } from '../core.js?v=c1a0501fca';
import { S } from '../store.js?v=5199216217';
import { nav, pageTitle, iconBtn, swipe, checkCircle, textBtn } from '../ui.js?v=b5958020ce';
import { tipOnce } from '../fx.js?v=34cbfc2a31';
import { rerender } from '../nav.js?v=57c55c9996';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
let openBought = false, openCheck = false, timer = null, focusWired = false;
const CHECK = L.CHECK_AISLE; // F4: spices, oils and other staples, by name only, folded at the bottom

function items() { return ((S.data && S.data.meal && S.data.meal.grocery) || []).slice(); }
/** What's on the list to buy (not the "Check you have" staples). */
export function toBuy() { return items().filter((g) => g.section !== CHECK); }
function weekStart() { return (S.data.meal && S.data.meal.weekStart) || L.weekStart(S.today()); }

export function render() {
  const all = toBuy();
  const staples = items().filter((g) => g.section === CHECK && !g.checked).sort((x, y) => x.item.localeCompare(y.item));
  const left = all.filter((g) => !g.checked);
  const bought = all.filter((g) => g.checked);
  const p = S.partner();
  const hh = S.household();
  const line = [left.length + ' left', 'shopping ' + (DAYS[hh.shopping_day] || 'Thursday')].concat(p && S.visible(p.id) ? ['shared with ' + p.name] : []).join(' · ');
  const sections = L.AISLES.map((a) => {
    const its = left.filter((g) => (g.section || 'Other') === a).sort((x, y) => x.item.localeCompare(y.item));
    if (!its.length) return '';
    const info = a === 'Produce' ? `<button type="button" class="btn-text" data-act="aisle-info" data-a="${esc(a)}" aria-label="About buying produce">${icon('info')}</button>` : '';
    return `<div><div class="aisle"><span class="eyebrow">${esc(a)}</span>${info}</div><section class="card list glist">${its.map(itemRow).join('')}</section></div>`;
  }).join('');
  const theirs = p ? bought.filter((g) => g.by === p.id).length : 0;
  const boughtBlock = bought.length ? `<section class="card list glist"><button type="button" class="bought-row" data-act="bought-toggle" aria-expanded="${openBought}"><span class="row-label b">Bought · ${bought.length}</span><span class="row-value">${theirs && p ? esc(p.name) + ' got ' + theirs : ''}${icon(openBought ? 'chevron-down' : 'chevron-right', 'ic-s')}</span></button>${openBought ? bought.sort((x, y) => x.item.localeCompare(y.item)).map(itemRow).join('') : ''}</section>` : '';
  const checkBlock = staples.length ? `<section class="card list glist"><button type="button" class="bought-row" data-act="check-toggle" aria-expanded="${openCheck}"><span class="row-label b">Check you have · ${staples.length}</span><span class="row-value">${icon(openCheck ? 'chevron-down' : 'chevron-right', 'ic-s')}</span></button>${openCheck ? staples.map((g) => `<div class="row no-ic static"><span class="row-main"><span class="row-label">${esc(g.item)}</span></span>${textBtn('Add', 'grocery-need', { 'data-key': g.key, 'aria-label': 'Add ' + g.item + ' to the list' }, { cls: 'small' })}</div>`).join('') : ''}</section>` : '';
  return nav({ back: 'Plan', backTo: 'plan', title: 'Groceries', right: iconBtn('share', 'grocery-share', 'Share the list') })
    + pageTitle('Groceries', esc(line))
    + `<div class="stack"><div><label class="addfield">${icon('plus')}<input id="g-add" type="text" placeholder="Add item" aria-label="Add an item" enterkeyhint="done" data-enter="grocery-add" autocapitalize="sentences" autocomplete="off"></label><p class="hint" id="g-hint" hidden>Type an item, then press Return. For example: 2 lb chicken breast.</p></div>
      ${all.length ? sections + boughtBlock : `<div class="empty">${icon('shopping-cart')}<h3>Nothing on the list</h3><p>This week's meal plan fills it, or add items above.</p></div>`}${checkBlock}</div>`;
}
function itemRow(g) {
  const longQty = String(g.qty || '').length > 14; // a long amount goes under the name, so the name stays on one line
  const inner = `<button type="button" class="gitem${g.checked ? ' done' : ''}" data-act="grocery-check" data-key="${esc(g.key)}" aria-pressed="${!!g.checked}">${checkCircle(!!g.checked)}<span class="row-main"><span class="gname">${esc(g.item)}</span>${longQty ? `<span class="gqty below">${esc(g.qty)}</span>` : ''}${g.note ? `<span class="gnote">${esc(g.note)}</span>` : ''}</span>${g.qty && !longQty ? `<span class="gqty">${esc(g.qty)}</span>` : ''}</button>`;
  return swipe(inner, 'grocery-del', { 'data-key': g.key, 'aria-label': 'Delete ' + g.item });
}

export function afterRender() {
  clearInterval(timer);
  timer = setInterval(() => { if (document.visibilityState === 'visible' && !S.syncing) S.sync(); }, 30000);
  if (!focusWired) {
    focusWired = true;
    window.addEventListener('focus', () => { if (location.hash.indexOf('#/plan/groceries') === 0) S.sync(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && location.hash.indexOf('#/plan/groceries') === 0) S.sync(); });
  }
  if (items().length) tipOnce('groceries', 'Swipe left on an item to delete it.');
}
export function leave(from, to) { if (from === 'plan/groceries' && to !== 'plan/groceries') clearInterval(timer); }

function listText() {
  const left = toBuy().filter((g) => !g.checked);
  const out = [];
  L.AISLES.forEach((a) => {
    const its = left.filter((g) => (g.section || 'Other') === a);
    if (!its.length) return;
    out.push(a.toUpperCase());
    its.forEach((g) => out.push(g.item + (g.qty ? ' (' + g.qty + ')' : '')));
    out.push('');
  });
  return out.join('\n').trim();
}

export const actions = {
  'grocery-add'() {
    const inp = document.getElementById('g-add');
    const hint = document.getElementById('g-hint');
    const v = (inp.value || '').trim();
    if (!v) { if (hint) hint.hidden = false; inp.focus(); return; }
    if (hint) hint.hidden = true;
    const parsed = L.parseGroceryInput(v);
    const named = L.groceryName(parsed.name);
    const known = L.storeItem(named.name, '', '')[0]; // F3: the store name ("onion" joins "Onions")
    if (known) named.name = known.name;
    const aisle = known && known.aisle !== CHECK ? known.aisle : (known ? 'Pantry' : L.groceryAisle(named.name, ''));
    inp.value = '';
    const key = L.groceryKey(named.name);
    const list = S.data.meal = S.data.meal || { weekStart: weekStart(), plan: null, grocery: [] };
    list.grocery = list.grocery || [];
    const have = list.grocery.find((g) => !g.checked && (g.key === key || g.key === 'x_' + key));
    if (have && have.section === CHECK) { have.section = 'Pantry'; have.qty = parsed.qty || ''; toast('Added ' + named.name + '.', { icon: 'plus', ms: 1600 }); }
    else if (have) { have.qty = L.sumQty([have.qty, parsed.qty]); toast(named.name + (parsed.qty ? ': now ' + have.qty : ' is already on the list') + '.'); }
    else { list.grocery.push({ key: 'x_' + key, section: aisle, item: named.name, qty: parsed.qty, note: named.note, checked: false, by: S.meId(), pending: true }); toast('Added ' + named.name + (parsed.qty ? ' · ' + parsed.qty : '') + '.', { icon: 'plus', ms: 1600 }); }
    S.write('grocery', { op: 'add', item: v, weekStart: weekStart() }, { optimistic: false });
    S.persist(); S.changed();
    setTimeout(() => { const i = document.getElementById('g-add'); if (i) i.focus(); }, 30);
  },
  'grocery-check'(el) {
    const it = items().find((g) => g.key === el.dataset.key);
    if (!it) return;
    S.write('grocery', { op: it.checked ? 'uncheck' : 'check', key: it.key, weekStart: weekStart() });
  },
  'grocery-del'(el) {
    const key = el.dataset.key;
    const it = items().find((g) => g.key === key);
    if (!it) return;
    S.data.meal.grocery = S.data.meal.grocery.filter((g) => g.key !== key);
    S.write('grocery', { op: 'remove', key, weekStart: weekStart() }, { optimistic: false });
    S.persist(); S.changed();
    toast('Deleted ' + it.item + '.', { icon: 'trash-2' });
  },
  'bought-toggle'() { openBought = !openBought; rerender(); },
  'check-toggle'() { openCheck = !openCheck; rerender(); },
  /** F4: a staple you're out of goes onto the list (Pantry). */
  'grocery-need'(el) {
    const it = items().find((g) => g.key === el.dataset.key);
    if (!it) return;
    it.section = 'Pantry';
    S.write('grocery', { op: 'need', key: it.key, weekStart: weekStart() }, { optimistic: false });
    S.persist(); S.changed();
    toast('Added ' + it.item + '.', { icon: 'plus', ms: 1600 });
  },
  'aisle-info'() { openSheet({ title: 'Produce', body: `<p class="body">${esc(K.GROCERY_NOTE)}</p>` }); },
  async 'grocery-share'() {
    const text = listText();
    try { if (navigator.share) { await navigator.share({ title: 'Groceries', text }); return; } } catch (e) { if (e.name === 'AbortError') return; }
    toast((await copyText(text)) ? 'List copied. Paste it anywhere.' : 'Couldn\'t copy the list.', { icon: 'copy' });
  }
};
