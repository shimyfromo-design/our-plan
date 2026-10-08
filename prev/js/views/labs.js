/* Blood tests: the results page (Weight › Blood tests), the result card in the coach chat (D10b) and the
 * doctor-summary table. Every result says to ask your doctor; serious flags say so plainly. */
import { L, esc, icon, toast, openSheet, closeSheet, shortDate } from '../core.js';
import { S } from '../store.js';
import { nav, pageTitle, card, listCard, row, textBtn, empty, primary } from '../ui.js';

function valueText(r) { return (r.value !== '' && r.value != null ? r.value : (r.text || '—')); }
function rangeText(r) {
  if (r.refText) return 'Lab range ' + r.refText;
  if (r.refLow !== '' && r.refLow != null && r.refHigh !== '' && r.refHigh != null) return 'Lab range ' + r.refLow + '–' + r.refHigh;
  if (r.refHigh !== '' && r.refHigh != null) return 'Lab range under ' + r.refHigh;
  if (r.refLow !== '' && r.refLow != null) return 'Lab range over ' + r.refLow;
  return '';
}
const out = (r) => r.flag === 'low' || r.flag === 'high';
function flagCell(r) { return out(r) ? `<span class="flag-bad">${r.flag === 'low' ? 'Low' : 'High'}</span>` : `<span class="flag-ok">${r.flag === 'normal' ? 'Normal' : '—'}</span>`; }
function markerKey(r) { return r.key && r.key !== 'other' ? r.key : 'o:' + String(r.marker).toLowerCase(); }
/** "Vitamin D, 25-Hydroxy" → "Vitamin D"; "LDL Cholesterol Calc" → "LDL cholesterol". */
export function shortMarker(name) {
  const t = String(name || '').replace(/\s*\(.*?\)/g, '').split(',')[0].replace(/\s+calc(ulated)?\.?$/i, '').trim();
  return t.replace(/\b(Cholesterol|Glucose|Iron|Ferritin|Folate|Hemoglobin|Triglycerides)\b/g, (w) => w.toLowerCase()).replace(/^./, (c) => c.toUpperCase());
}
/** The latest result of each marker. */
function latestByMarker(id) {
  const by = {};
  S.labs(id).forEach((r) => { const k = markerKey(r); if (!by[k] || r.date > by[k].date || (r.date === by[k].date && String(r.id) > String(by[k].id))) by[k] = r; });
  return Object.values(by);
}
/** How many markers (latest result of each) are outside the lab's range. */
export function askCount(id) { return latestByMarker(id).filter(out).length; }

/** The chat card for a read blood test (D10b). meta: {date, markers, explanation, seeDoctor, proposals, safe} */
export function labCard(meta, msgId) {
  const ms = meta.markers || [];
  const flagged = ms.filter(out);
  const doc = meta.seeDoctor || [];
  const head = flagged.length ? (flagged.length === 1 ? '1 thing to look at' : flagged.length + ' things to look at') : 'Everything in range';
  const open = new Set(S.proposals().map((p) => p.id));
  const props = (meta.proposals || []).filter((p) => open.has(p.id));
  return `<div class="card cardmsg" role="group" aria-label="Blood test results">
    <div class="eyebrow">Blood test · ${esc(meta.date ? shortDate(meta.date) : '')}</div>
    <p class="lab-h">${esc(head)}</p>
    <table class="labtable"><tbody>${ms.map((r) => `<tr><td>${esc(shortMarker(r.marker))}</td><td>${esc(valueText(r))} <span class="t-2">${esc(r.unit || '')}</span></td><td>${flagCell(r)}</td></tr>`).join('')}</tbody></table>
    <p class="${doc.length ? 'note bad' : 'body'}" style="margin-top:10px">${doc.length ? icon('circle-alert') : ''}<span>${esc(sentence(flagged, doc))}</span></p>
    ${meta.explanation ? textBtn('What this means', 'lab-explain', { 'data-id': msgId || '' }, { cls: 'small' }) : ''}
    ${props.map((p) => textBtn('Add ' + shortName(p.title) + ' to supplements', 'confirm', { 'data-tab': p.tab, 'data-id': p.id, 'data-accept': '1' })).join('')}
    <p class="caption">Saved to Weight</p></div>`;
}
function sentence(flagged, doc) {
  const names = (list) => { const n = list.map(shortMarker); return n.length > 2 ? n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1] : n.join(' and '); };
  if (doc.length) return 'Please see your doctor soon to ask about ' + names(doc) + '.';
  if (flagged.length) return 'Ask your doctor about ' + names(flagged.map((r) => r.marker)) + ' at your next visit.';
  return 'Everything is in the lab\'s range; ask your doctor if you have questions.';
}
const shortName = (t) => String(t || '').replace(/^Vitamin D3?.*$/i, 'D3').replace(/\s*\(.*\)$/, '');

/** Weight › Blood tests: the latest result for each marker, flagged ones first. */
export function renderPage(want) {
  const id = want && S.visible(want) ? want : S.meId();
  const p = S.person(id);
  const rows = S.labs(id);
  const head = nav({ back: 'Weight', backTo: 'summary/weight', title: 'Blood tests' }) + pageTitle('Blood tests', id === S.meId() ? '' : esc(p.name) + '\'s results');
  if (!rows.length) return head + empty('droplet', 'No blood tests yet', 'Add a photo of your latest results and the coach explains them in plain English.', id === S.meId() ? primary('Add a blood test', 'photo-sheet', { 'data-hint': 'lab' }, { icon: 'camera' }) : '');
  const g = {};
  rows.forEach((r) => { (g[markerKey(r)] = g[markerKey(r)] || []).push(r); });
  Object.values(g).forEach((list) => list.sort((a, b) => (a.date < b.date ? 1 : -1)));
  const keys = Object.keys(g).sort((a, b) => {
    const rank = (r) => (r.severity === 'see_doctor' ? 0 : out(r) ? 1 : 2);
    return rank(g[a][0]) - rank(g[b][0]) || g[a][0].marker.localeCompare(g[b][0].marker);
  });
  const ask = keys.filter((k) => out(g[k][0])).length;
  const dates = (k) => new Set(g[k].map((r) => r.date)).size;
  return head + `<div class="stack">${ask ? `<p class="note bad" style="padding:0 4px">${icon('circle-alert')}<span>${ask} to ask your doctor about</span></p>` : ''}
    ${listCard(keys.map((k) => { const r = g[k][0]; return row({ label: r.marker, sub: shortDate(r.date) + (dates(k) > 1 ? ' · ' + dates(k) + ' results' : ''), right: `<span class="row-value${out(r) ? ' bad' : ''}">${out(r) ? '<i class="red-dot" aria-hidden="true"></i>' : ''}${esc(valueText(r))} ${esc(r.unit || '')}</span>`, act: 'lab-marker', data: { 'data-id': r.id } }); }))}
    <p class="caption" style="padding:0 4px">Discuss your results with your doctor. They are also on your doctor summary.</p>
    ${id === S.meId() ? primary('Add a blood test', 'photo-sheet', { 'data-hint': 'lab' }, { icon: 'camera' }) : ''}</div>`;
}
function markerSheet(rowId) {
  const all = Object.values((S.data && S.data.labs) || {}).flat();
  const r = all.find((x) => x.id === rowId);
  if (!r) return;
  const hist = all.filter((x) => markerKey(x) === markerKey(r)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const mine = S.labs(S.meId()).some((x) => x.id === r.id);
  const a = L.labAssess({ key: r.key, value: r.value, unit: r.unit, refLow: r.refLow, refHigh: r.refHigh, flag: r.flag });
  openSheet({ title: r.marker, body: `<div><div class="eyebrow">${esc(shortDate(r.date))}</div><p class="bigline"><b class="num" style="font-size:var(--f34);font-weight:700">${esc(valueText(r))}</b><span>${esc(r.unit || '')} · ${out(r) ? (r.flag === 'low' ? 'Low' : 'High') : 'Normal'}</span></p>
      <p class="sub">${esc(rangeText(r))}${a.note ? (rangeText(r) ? '. ' : '') + esc(a.note) : ''}</p></div>
    ${r.severity === 'see_doctor' ? `<p class="note bad">${icon('circle-alert')}<span>Please see your doctor about this result.</span></p>` : ''}
    ${hist.length > 1 ? `<div class="inset">${hist.map((x) => row({ label: shortDate(x.date), value: esc(valueText(x)) + ' ' + esc(x.unit || '') })).join('')}</div>` : ''}
    ${mine && r.value !== '' && r.value != null ? `<label class="field"><span>Read wrong? Type the number as printed</span><input id="lab-fix" type="number" inputmode="decimal" step="any" value="${esc(r.value)}" data-enter="lab-fix" data-id="${esc(r.id)}"></label>${textBtn('Save the correction', 'lab-fix', { 'data-id': r.id }, { cls: 'block' })}` : ''}
    <p class="caption">Ask your doctor about this result.</p>` });
}
/** The doctor summary page (on screen): one row per marker, the latest result. */
export function doctorRows(id) {
  const latest = latestByMarker(id).sort((a, b) => a.marker.localeCompare(b.marker));
  if (!latest.length) return null;
  return latest.map((r) => row({ label: shortMarker(r.marker), sub: shortDate(r.date) + (rangeText(r) ? ' · ' + esc(rangeText(r)) : ''), right: `<span class="row-value${out(r) ? ' bad' : ''}">${out(r) ? '<i class="red-dot" aria-hidden="true"></i>' : ''}${esc(valueText(r))} ${esc(r.unit || '')}</span>`, cls: 'no-ic' }));
}
/** The doctor summary's table: the latest of each marker. */
export function doctorTable(id) {
  const rows = S.labs(id);
  if (!rows.length) return '';
  const by = {};
  rows.forEach((r) => { const k = markerKey(r); if (!by[k] || r.date > by[k].date) by[k] = r; });
  const latest = Object.values(by).sort((a, b) => a.marker.localeCompare(b.marker));
  return `<h2>Blood tests (latest of each, read from photos; please confirm against the lab report)</h2><table>${latest.map((r) => `<tr><th>${esc(r.marker)} (${esc(shortDate(r.date))})</th><td>${esc(valueText(r) + (r.unit ? ' ' + r.unit : ''))}${rangeText(r) ? ' · ' + esc(rangeText(r)) : ''}${out(r) ? ' · <b>' + esc(r.flag) + '</b>' : ''}</td></tr>`).join('')}</table>`;
}

export const actions = {
  'lab-marker'(el) { markerSheet(el.dataset.id); },
  'lab-explain'(el) {
    const m = ((S.data.coach && S.data.coach.thread) || []).find((x) => String(x.id) === el.dataset.id);
    const meta = (m && m.meta) || {};
    openSheet({ title: 'What this means', body: `<p class="body">${esc(String(meta.explanation || '').replace(/!/g, '.'))}</p><p class="caption">Ask your doctor about these results.</p>` });
  },
  'lab-fix'(el) {
    const inp = document.getElementById('lab-fix');
    const id = el.dataset.id;
    const v = +inp.value;
    if (!isFinite(v) || inp.value === '') { toast('Enter the number as printed.', { kind: 'err' }); return; }
    S.write('labEdit', { id, value: v });
    closeSheet(); toast('Corrected.');
  }
};
