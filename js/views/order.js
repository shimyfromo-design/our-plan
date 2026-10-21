/* Round 4 (section 5): the Breadberry order (R4Order). Built by rules from the week's plan through the store list, plus
 * the Every-week items and lines added during the week (typed or by voice), minus staples, fridge-snap items and freezer
 * meals. The person reads it and sends it from WhatsApp or email themselves — the app never sends it. */
import { L, esc, icon, toast, openSheet, updateSheet, closeSheet, copyText, busy, preparePhoto, dayName } from '../core.js?v=132c8397ab';
import { S } from '../store.js?v=229f42e888';
import { call } from '../api.js?v=b8330e966d';
import { rerender } from '../nav.js?v=57c55c9996';
import { nav, pageTitle, card, listCard, row, primary, textBtn, checkCircle } from '../ui.js?v=9375313392';
import * as Mic from '../mic.js?v=9ffe5ac9ff';
import * as Food from './food.js?v=24cb1aa60c';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Shabbos'];
const r4 = () => (S.data && S.data.round4) || {};
function list() { return ((r4().week && r4().week.grocery) || (S.data.meal && S.data.meal.grocery) || []).filter((g) => g.checked !== 'removed'); }
function recipesById() { const m = {}; S.recipes().forEach((r) => { m[r.id] = r; }); return m; }
/** (audit W2) A substitute example that fits the item, or a plain one. */
const SUB_HINTS = [[/salmon|tilapia|cod|flounder|branzino|fish/i, 'another white fish'], [/spinach|kale|arugula|lettuce|greens/i, 'another leafy green'], [/chicken breast/i, 'chicken cutlets'], [/chicken thigh/i, 'chicken drumsticks'], [/ground (beef|turkey|chicken)/i, 'another ground meat'], [/yogurt/i, 'another plain yogurt'], [/cheese/i, 'a similar cheese'], [/berries|strawberr|blueberr/i, 'frozen berries'], [/bread|rolls|pita|wrap/i, 'whole-wheat rolls']];
function subHint(item) { const h = SUB_HINTS.find((x) => x[0].test(String(item || ''))); return 'For example: ' + (h ? h[1] : 'a similar brand or size'); }
/** The order, exactly as the message will read. */
export function order() {
  const h = S.household(), st = h.store || {}, o = r4().order || {};
  const plan = Food.weekPlan() || Food.currentPlan();
  const hints = L.orderHints(plan, recipesById());
  return L.buildOrder({ grocery: list(), weekly: st.weekly || [], missing: o.missingLast || [], butcher: st.butcher || {}, notes: hints.notes, bags: hints.bags, learned: o.learned || {}, sub: st.sub || 'none', sender: (S.me().name || '').split(' ')[0], walkOrder: st.walkOrder });
}
export function render() {
  const h = S.household(), st = h.store || {}, o = r4().order || {};
  const ord = order();
  const day = DAYS[h.shopping_day == null ? 4 : +h.shopping_day];
  const est = ord.estimate ? 'about $' + ord.estimate + ' by your last receipts' : (Object.keys(o.learned || {}).length ? 'no prices for these yet' : 'no receipts yet');
  const head = nav({ back: 'Meals', backTo: 'meals', title: 'Groceries', right: `<button class="btn-text" type="button" data-act="go" data-to="meals/store">In-store list</button>` })
    + pageTitle('Groceries', (st.name || 'Breadberry') + ' order for ' + day + ' · ' + est); // (audit W10) one name: the row, the bar and the title say Groceries
  const voice = list().filter((g) => g.source === 'voice');
  const caption = [voice.length ? L.capItem(Food.andList(voice.map((g) => L.lowItem(g.item)))) + (voice.length === 1 ? ' was' : ' were') + ' added by voice' + (voice[0].ts ? ' on ' + dayName(L.nyDate(voice[0].ts)) : '') + '.' : '', (st.weekly || []).length ? 'Household items repeat every week.' : ''].filter(Boolean).join(' ');
  // each line is a tap: "If they don't have it" (substitute with … / don't substitute)
  const ln = (x, k, dot) => (k ? `<button type="button" class="ln" data-act="order-line" data-key="${esc(k)}">${esc(x)}${dot ? '&nbsp;·' : ''}</button>` : `<span class="ln">${esc(x)}${dot ? '&nbsp;·' : ''}</span>`);
  // the "·" is part of the item before it, so a line never starts with one
  const msg = ord.departments.map((d) => `<div class="dept"><b>${esc(d.name)}</b>${d.oneLine ? `<p>${d.items.map((x, i) => ln(x, d.keys[i], i < d.items.length - 1)).join(' ')}</p>` : d.items.map((x, i) => `<p>${ln(x, d.keys[i])}</p>`).join('')}</div>`).join('') + `<p class="closing">${esc(ord.closing)}</p>`;
  const can = !!st.whatsapp, mail = !!st.email;
  return head + `<div class="stack">
    <div class="ask-field order-add"><input id="order-add" type="text" placeholder="Add an item" autocomplete="off" data-enter="order-add" aria-label="Add item"><button type="button" class="mic-in" data-act="order-mic" aria-label="Add by voice">${icon(dictating ? 'mic-off' : 'mic')}</button></div>
    ${o.missingLast && o.missingLast.length ? `<p class="note">${icon('info')}<span>Missing last time: ${esc(Food.andList(o.missingLast.map((x) => L.lowItem(x))))}. They're on this order.</span></p>` : ''}
    ${ord.count ? `<div><div class="eyebrow" style="margin:0 4px 6px">The message ${esc(st.name || 'Breadberry')} gets</div>${card(`<div class="order-msg">${msg}</div>`)}${caption ? `<p class="caption" style="margin:8px 4px 0">${esc(caption)}</p>` : ''}</div>` : card('<p class="sub">Nothing on the order yet. Plan the week, or add items above.</p>')}
    ${ord.haves.length ? `<div><div class="eyebrow" style="margin:0 4px 6px">You have</div>${listCard(list().filter((g) => g.have).map((g) => row({ label: g.item, sub: 'From the fridge photo', value: 'Put back', act: 'order-putback', data: { 'data-key': g.key }, cls: 'no-ic', noChev: true })), 'no-ic')}</div>` : ''}
    <div>${can ? `<a class="btn-primary" href="${esc(L.waLink(st.whatsapp, ord.text))}" target="_blank" rel="noopener" data-send="whatsapp">${icon('message-square-text')}<span>Open in WhatsApp</span></a>` : primary('Add the store\'s WhatsApp number', 'go', { 'data-to': 'me/store' })}
      <div class="btn-row" style="margin-top:4px">${mail ? `<a class="btn-text" href="${esc(L.mailLink(st.email, day, ord.text))}" data-send="email">${icon('mail')}<span>Send by email</span></a>` : ''}${textBtn('Copy text', 'order-copy', {}, { icon: 'copy' })}</div>
      <p class="caption center" style="margin-top:6px">You read it and tap send in WhatsApp. The app never sends it by itself.</p></div>
    ${listCard([
      row({ icon: 'list-checks', label: 'When it arrives: what came', act: 'order-came' }),
      `<label class="row file-btn">${icon('receipt')}<span class="row-main"><span class="row-label">Snap the receipt</span><span class="row-sub">learns prices</span></span><input type="file" accept="image/*" capture="environment" data-change="order-receipt" aria-label="Snap the receipt"></label>`
    ])}</div>`;
}

let dictating = false;
function addLines(text, source) {
  const parts = String(text || '').split(/\s*(?:,|\band\b|\n|;)\s*/i).map((x) => x.trim()).filter((x) => x.length > 1).slice(0, 12);
  const ws = r4().week ? r4().week.weekStart : L.weekStart(S.today());
  parts.forEach((p) => {
    S.write('grocery', { op: 'add', item: p, weekStart: ws, source });
    const named = L.parseGroceryInput(p);
    const w = (S.data.round4 = S.data.round4 || {}).week = S.data.round4.week || { weekStart: ws };
    (w.grocery = w.grocery || []).push({ key: 'x_' + L.groceryKey(named.name), section: L.groceryAisle(named.name, ''), item: L.capItem(named.name), qty: named.qty || '', note: '', checked: false, source, ts: new Date().toISOString() });
  });
  return parts;
}
export function afterRender(r) {
  // the send links open WhatsApp or Mail; the tap also records the order (the Orders tab), never sends anything itself
  document.querySelectorAll('[data-send]').forEach((a) => {
    if (a.dataset.wired) return;
    a.dataset.wired = '1';
    a.addEventListener('click', () => { const o = order(); S.write('order', { op: 'sent', weekStart: (r4().week || {}).weekStart, channel: a.dataset.send, estimate: o.estimate, items: o.departments.reduce((x, d) => x.concat(d.items), []) }); });
  });
}
export const changes = {
  async 'order-receipt'(el) {
    const f = el.files && el.files[0];
    if (!f) return;
    toast('Reading the receipt…', { ms: 30000 });
    try {
      const p = await preparePhoto(f, 2000, 0.85);
      const r = await call('order', { op: 'receipt', data: p.data, weekStart: (r4().week || {}).weekStart }, { timeout: 120000 });
      await S.sync();
      toast('Learned ' + r.lines + ' prices' + (r.total ? ' · total $' + r.total : '') + '. The photo wasn\'t kept.', { ms: 6000 });
    } catch (e) { toast(e.message || 'That receipt couldn\'t be read.', { kind: 'err', ms: 6000 }); }
  }
};
export const actions = {
  'order-add'() {
    const inp = document.getElementById('order-add');
    const t = String((inp && inp.value) || '').trim();
    if (!t) return;
    addLines(t, '');
    inp.value = '';
    toast('Added.'); rerender();
  },
  'order-mic'() {
    if (dictating) {
      dictating = false; rerender();
      Mic.stop().then((rec) => Mic.transcribe(rec)).then((text) => {
        const added = addLines(text, 'voice');
        toast(added.length ? 'Added ' + Food.andList(added) + '.' : 'I didn\'t catch that. Try again a little closer to the phone.', { icon: 'mic' });
        rerender();
      }).catch((e) => toast(e.message, { kind: 'err' }));
      return;
    }
    Mic.start({ maxMs: 30000, bar: true, label: 'Listening', onAuto: () => { if (dictating) actions['order-mic'](); } }).catch((e) => { dictating = false; rerender(); toast(e.message || 'The microphone didn\'t start.', { kind: 'err' }); });
    dictating = true; rerender();
  },
  async 'order-copy'(el) {
    const o = order();
    await copyText(o.text);
    S.write('order', { op: 'sent', weekStart: (r4().week || {}).weekStart, channel: 'copy', estimate: o.estimate, items: o.departments.reduce((x, d) => x.concat(d.items), []) });
    toast('Copied. Paste it into WhatsApp or an email.');
  },
  'order-putback'(el) {
    S.write('order', { op: 'line', key: el.dataset.key, have: false, weekStart: (r4().week || {}).weekStart });
    const g = list().find((x) => x.key === el.dataset.key); if (g) g.have = '';
    rerender();
  },
  'order-line'(el) {
    const g = list().find((x) => x.key === el.dataset.key);
    if (!g) return;
    openSheet({ title: g.item, body: `<p class="sub">If they don't have it:</p><label class="field"><span>Substitute with</span><input id="sub-in" value="${esc(g.sub && g.sub !== 'none' ? g.sub : '')}" placeholder="${esc(subHint(g.item))}" autocomplete="off"></label>
      ${primary('Save', 'order-sub', { 'data-key': g.key })}${textBtn('Don\'t substitute', 'order-sub', { 'data-key': g.key, 'data-none': '1' }, { cls: 'block' })}` });
  },
  'order-sub'(el) {
    const v = el.dataset.none ? 'none' : String((document.getElementById('sub-in') || {}).value || '').trim() || 'none';
    S.write('order', { op: 'line', key: el.dataset.key, sub: v, weekStart: (r4().week || {}).weekStart });
    const g = list().find((x) => x.key === el.dataset.key); if (g) g.sub = v;
    closeSheet(); rerender();
  },
  'order-came'() { cameSheet(); },
  'came-toggle'(el) { const k = el.dataset.i; came[k] = !came[k]; cameSheet(); },
  'came-done'() {
    const items = lastItems();
    const missing = items.filter((x, i) => !came[i]).map((x) => x.replace(/ [\d½¼¾].*$/, '').replace(/,.*$/, ''));
    S.write('order', { op: 'came', weekStart: ((r4().order || {}).lastOrder || {}).weekStart, missing });
    const lo = (r4().order || {}).lastOrder; if (lo) lo.status = 'came';
    came = {};
    closeSheet();
    toast(missing.length ? L.capItem(Food.andList(missing.map((x) => L.lowItem(x)))) + ' will be on the next order.' : 'Everything came.');
  }
};
let came = {};
function lastItems() { const lo = (r4().order || {}).lastOrder; return lo && lo.items && lo.items.length ? lo.items : order().departments.reduce((x, d) => x.concat(d.items), []); }
/** 5.5: "Did everything come?" — the order as a checklist; what's left unchecked is missing. */
export function cameSheet() {
  const items = lastItems();
  if (!Object.keys(came).length) items.forEach((x, i) => { came[i] = true; });
  const body = `<p class="sub">Uncheck anything that didn't come. It goes on the next order.</p><div class="inset">${items.map((x, i) => `<button type="button" class="row check-item" data-act="came-toggle" data-i="${i}" aria-pressed="${!!came[i]}">${checkCircle(!!came[i])}<span class="row-main"><span class="row-label">${esc(x)}</span></span></button>`).join('')}</div>${primary('Done', 'came-done')}`;
  const open = document.querySelector('#sheet-root.open .sheet-body');
  if (open && open.dataset.kind === 'came') return updateSheet({ title: 'Did everything come?', body });
  const b = openSheet({ title: 'Did everything come?', body }); b.dataset.kind = 'came';
  return b;
}
/** The Plan card from 6 pm on shopping day. */
export function cameCard() {
  const h = S.household(), lo = (r4().order || {}).lastOrder;
  if (!lo || lo.status === 'came' || !lo.sentAt) return '';
  if (L.weekday(S.today()) !== (h.shopping_day == null ? 4 : +h.shopping_day) || S.minutes() < 18 * 60) return '';
  if (L.nyDate(lo.sentAt) < L.addDays(S.today(), -6)) return '';
  return card(`<div class="split"><p class="h3">Did everything come?</p>${textBtn('Check', 'order-came', {}, { cls: 'small' })}</div>`, 'came-card');
}
