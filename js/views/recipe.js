/* Round 4 recipes (section 4): the recipe page (R4Recipe) — rating, ingredients, Change with coach (the change is shown
 * before anything is saved), Cook with timers — and Add a recipe (R4Import): a link, a photo of a page, or typed. */
import { L, K, esc, icon, toast, openSheet, updateSheet, closeSheet, busy, preparePhoto } from '../core.js?v=6da4f78540';
import { S } from '../store.js?v=fdd30405e3';
import { call } from '../api.js?v=c229a379f9';
import { go, rerender, route } from '../nav.js?v=57c55c9996';
import { nav, card, row, primary, textBtn, kindChip } from '../ui.js?v=fb1a8d342d';
import * as Mic from '../mic.js?v=48b20bbac8';

const KIND = { meat: 'Meat', dairy: 'Dairy', pareve: 'Pareve', fish: 'Pareve' };
let ch = null; // { id, request, change, loading }
let showAll = false;
const ratingOf = (id) => ((S.data.round4 || {}).ratings || {})[id] || '';
const fmtMin = (m) => (m >= 60 ? Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '') : m + ' min');

export function render(r) {
  const rec = S.recipe(r.parts[2]);
  const head = nav({ back: 'Plan', backTo: 'plan', title: 'Recipe', right: rec ? `<button class="btn-text" type="button" data-act="go" data-to="cook/${esc(rec.id)}">Cook with timers</button>` : '' });
  if (!rec) return head + '<p class="sub" style="padding:16px">This recipe isn\'t in your recipes anymore.</p>';
  if (!ch || ch.id !== rec.id) { ch = { id: rec.id, request: '', change: null }; showAll = false; }
  const rt = ratingOf(rec.id);
  const meta = [rec.minutes ? fmtMin(+rec.minutes) : '', rec.serves ? 'serves ' + rec.serves : '', KIND[rec.kind] || '', rec.source ? 'from ' + rec.source : ''].filter(Boolean).join(' · ');
  const ing = rec.ing || [];
  const list = (showAll ? ing : ing.slice(0, 4)).map((i) => `<div class="split ing-row"><span class="body">${esc(L.capItem(i[1]))}</span><span class="sub">${esc(i[0])}</span></div>`).join('');
  const more = !showAll && (ing.length > 4 || (rec.steps || []).length) ? `<button type="button" class="btn-text small" data-act="recipe-all">${ing.length > 4 ? 'and ' + (ing.length - 4) + ' more · ' : ''}${(rec.steps || []).length} steps</button>` : '';
  const steps = showAll ? `<div class="h3" style="margin-top:12px">Steps</div><ol class="steps">${(rec.steps || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : '';
  return head + `<div class="stack">
    ${rec.photo ? `<img class="recipe-photo" src="${esc(rec.photo)}" alt="">` : ''}
    <div><h1 class="title" style="font-size:var(--f28)">${esc(rec.title)}</h1><p class="sub" style="margin-top:4px">${esc(meta)}</p></div>
    <div class="picks fit" role="group" aria-label="Rate this meal">${[['loved', 'Loved it'], ['never', 'Never again']].map(([v, l]) => `<button type="button" class="pick rate-btn${rt === v ? ' on ' + v : ''}" aria-pressed="${rt === v}" data-act="recipe-rate" data-v="${v}">${v === 'loved' ? icon('heart', 'ic-s') : ''}<span>${l}</span></button>`).join('')}</div>
    ${card(`<div class="eyebrow">Ingredients</div><div class="ing-list">${list}</div>${more}${steps}`)}
    ${changeCard(rec)}
  </div>`;
}
function changeCard(rec) {
  const c = ch.change;
  let inner = `<div class="eyebrow">${icon('sparkles', 'ic-s')} Change with coach</div>`;
  if (!c) {
    inner += `${askField('Make it for 8, milder for the girls')}<div style="margin-top:8px">${textBtn('Ask the coach', 'recipe-change')}</div>`;
    return card(inner, 'change-card');
  }
  const rows = (c.changedIngredients || []).map((x) => diffRow(x.name, x.from, x.to)).concat((c.changedSteps || []).map((x) => diffRow('Step ' + x.no, x.from, x.to))).concat((c.addedLines || []).map((l) => diffRow('Add', '', l)));
  inner += `<p class="body" style="margin-top:6px">${esc(ch.request)}</p>
    <div class="diff"><p class="sub">Here's the change. Nothing is saved until you say so.</p>${rows.join('')}${c.note ? `<p class="sub" style="margin-top:8px">${esc(c.note)}</p>` : ''}${c.girlsNote ? `<p class="note">${icon('hand-heart')}<span>${esc(c.girlsNote)}</span></p>` : ''}</div>
    ${primary('Save changes', 'recipe-save', { 'data-as': 'replace' })}
    <div class="btn-row">${textBtn('Save as a new recipe', 'recipe-save', { 'data-as': 'new' })}${textBtn('Keep the original', 'recipe-keep')}</div>
    <div style="margin-top:12px">${askField('Ask for another change')}</div>`;
  return card(inner, 'change-card');
}
function askField(ph) {
  return `<div class="ask-field"><input id="rc-ask" type="text" placeholder="${esc(ph)}" autocomplete="off" data-enter="recipe-change"><button type="button" class="mic-in" data-act="dictate" data-for="rc-ask" aria-label="Speak instead">${icon(Mic.open && Mic.open() ? 'mic-off' : 'mic')}</button></div>`;
}
function diffRow(name, from, to) {
  return `<div class="diff-row"><span class="body">${esc(L.capItem(name))}</span><span class="diff-vals">${from ? `<s class="sub">${esc(from)}</s>` : ''}<b>${esc(to)}</b></span></div>`;
}

// ------------------------------------------------------------------ Add a recipe (R4Import, 4.2)
let imp = null; // { mode, found, recipe, checks, message }
function importSheet() {
  const m = imp.mode;
  // three tiles (mockup R4Import): the chosen one outlined
  let body = `<div class="imp-tiles" role="group" aria-label="How to add">${[['link', 'Paste a link', 'link'], ['photo', 'Photo a page', 'camera'], ['text', 'Type it', 'pen-line']].map(([v, l, ic]) => `<button type="button" class="imp-tile" data-act="imp-mode" data-v="${v}" aria-pressed="${m === v}">${icon(ic)}<span>${l}</span></button>`).join('')}</div>`;
  if (m === 'link') body += `<label class="field"><span>Link</span><input id="imp-url" type="url" inputmode="url" placeholder="https://" autocomplete="off" value="${esc(imp.url || '')}"></label>${textBtn('Find the recipe', 'imp-go')}`;
  else if (m === 'photo') body += `<label class="btn-text block file-btn">${icon('camera')}<span>Take or choose a photo</span><input type="file" accept="image/*" data-change="imp-photo" aria-label="Photo a page"></label>`;
  else body += `<label class="field"><span>Title, ingredients and steps</span><textarea id="imp-text" rows="8" placeholder="Sticky silan chicken&#10;&#10;Ingredients&#10;3 lb chicken drumsticks&#10;…&#10;&#10;Steps&#10;1. Heat the oven to 400°F.">${esc(imp.text || '')}</textarea></label>${textBtn('Check it', 'imp-go')}`;
  if (imp.message) body += `<p class="note">${icon('info')}<span>${esc(imp.message)}</span></p>`;
  if (imp.found) {
    const r = imp.recipe, c = imp.checks;
    const meta = [r.minutes ? fmtMin(r.minutes) : '', r.serves ? 'serves ' + r.serves : '', c.ingredients + ' ingredients', c.steps + ' steps'].filter(Boolean).join(' · ');
    const line = (ok, t) => `<div class="check-line">${icon(ok ? 'check' : 'circle-alert', 'ic-s ' + (ok ? 't-accent' : 't-problem'))}<span class="body">${esc(t)}</span></div>`;
    body += card(`<div class="eyebrow">Found it</div><p class="h3" style="margin-top:4px">${esc(r.title)}</p><p class="sub">${esc(meta)}</p>
      ${c.mixes ? line(false, 'This mixes meat and dairy') : line(true, (KIND[c.kind] || 'Pareve') + ', nothing ' + (c.kind === 'dairy' ? 'meat' : 'dairy') + ' in it')}
      ${line(true, 'Amounts turned into Breadberry sizes')}${line(true, 'Steps split for the cooking timers')}`, 'found')
      + '<p class="caption">Copied word for word from the page, never made up. Check it once before you cook.</p>'
      + (c.mixes ? '<p class="sub">Fix the ingredients (Type it) before adding.</p>' : primary('Add to recipes', 'imp-add'));
  }
  const open = document.querySelector('#sheet-root.open .sheet-body');
  if (open && open.dataset.kind === 'import') return updateSheet({ title: 'Add a recipe', body });
  const b = openSheet({ title: 'Add a recipe', body, label: 'Add a recipe', doneLabel: 'Cancel' });
  b.dataset.kind = 'import';
  return b;
}
async function runImport(body, el) {
  imp.message = ''; imp.found = false;
  await busy(el, async () => {
    try {
      const r = await call('recipe', Object.assign({ op: 'import' }, body), { timeout: 120000 });
      if (r.found) { imp.found = true; imp.recipe = r.recipe; imp.checks = r.checks; } else imp.message = r.message;
    } catch (e) { imp.message = e.message; }
  });
  importSheet();
}

// ------------------------------------------------------------------ dictation into a field (a tap starts, a tap stops)
let dict = null;
function dictate(el) {
  const id = el.dataset.for;
  if (dict) {
    const d = dict; dict = null;
    Mic.stop().then((rec) => Mic.transcribe(rec)).then((text) => {
      const inp = document.getElementById(d.id);
      if (inp && text) inp.value = (inp.value ? inp.value.trim() + ' ' : '') + text;
      if (!text) toast('I didn\'t catch that. Try again a little closer to the phone.', { icon: 'mic' });
    }).catch((e) => toast(e.message, { kind: 'err' }));
    return;
  }
  dict = { id };
  Mic.start({ maxMs: 60000, bar: true, label: 'Listening', onAuto: () => { if (dict) dictate(el); } }).catch((e) => { dict = null; toast(e.message || 'The microphone didn\'t start.', { kind: 'err' }); });
}
export { dictate };

export const changes = {
  async 'imp-photo'(el) {
    const f = el.files && el.files[0];
    if (!f) return;
    try { const p = await preparePhoto(f); await runImport({ mode: 'photo', data: p.data }, null); } catch (e) { imp.message = e.message || 'That photo couldn\'t be read.'; importSheet(); }
  }
};
export const actions = {
  dictate(el) { dictate(el); },
  'recipe-all'() { showAll = true; rerender(); },
  'recipe-rate'(el) {
    const id = route().parts[2];
    S.write('rateRecipe', { recipeId: id, rating: el.dataset.v });
    S.data.round4 = S.data.round4 || {}; S.data.round4.ratings = Object.assign({}, S.data.round4.ratings || {}, { [id]: el.dataset.v });
    toast(el.dataset.v === 'never' ? 'Got it. The planner leaves it out.' : 'Saved. The planner brings it back.');
    rerender();
  },
  async 'recipe-change'(el) {
    const inp = document.getElementById('rc-ask');
    const ask = String((inp && inp.value) || '').trim();
    if (!ask) { toast('Say or type what should change.', { kind: 'err' }); return; }
    await busy(el, async () => {
      try { const r = await call('recipe', { op: 'change', recipeId: ch.id, request: ask }, { timeout: 120000 }); ch.request = ask; ch.change = r.change; rerender(); }
      catch (e) { toast(e.message, { kind: 'err', ms: 6000 }); }
    });
  },
  async 'recipe-save'(el) {
    const as = el.dataset.as;
    await busy(el, async () => {
      try {
        const r = await call('recipe', { op: 'save', recipeId: ch.id, change: ch.change, as }, { timeout: 60000 });
        await S.sync();
        ch = null;
        toast(as === 'new' ? 'Saved as a new recipe.' : 'Saved.');
        if (as === 'new' && r.recipeId) go('plan/recipe/' + r.recipeId, { replace: true }); else rerender();
      } catch (e) { toast(e.message, { kind: 'err', ms: 6000 }); }
    });
  },
  'recipe-keep'() { ch.change = null; ch.request = ''; toast('The original stays.'); rerender(); },
  'recipe-import'() { imp = { mode: 'link' }; importSheet(); },
  'imp-mode'(el) { imp.mode = el.dataset.v; imp.found = false; imp.message = ''; importSheet(); },
  'imp-go'(el) {
    if (imp.mode === 'link') { imp.url = (document.getElementById('imp-url') || {}).value || ''; runImport({ mode: 'link', url: imp.url }, el); }
    else { imp.text = (document.getElementById('imp-text') || {}).value || ''; runImport({ mode: 'text', text: imp.text }, el); }
  },
  async 'imp-add'(el) {
    await busy(el, async () => {
      try {
        const r = await call('recipe', { op: 'add', recipe: imp.recipe }, { timeout: 60000 });
        await S.sync(); closeSheet(); toast('Added to your recipes.');
        go('plan/recipe/' + r.recipeId);
      } catch (e) { toast(e.message, { kind: 'err', ms: 6000 }); }
    });
  }
};
