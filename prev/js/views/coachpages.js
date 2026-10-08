/* The Coach's own pages, from the Notes sheet (C3, D11): What the coach knows, My plan, Guides, Wish list,
 * and the weekly review. Built from the same parts: one title, cards of rows, one primary button. */
import { L, K, esc, icon, toast, openSheet, updateSheet, closeSheet, timeAgo, shortDate, copyText, shareOrDownload, busy, dayName } from '../core.js';
import { S } from '../store.js';
import { call } from '../api.js';
import { go, rerender } from '../nav.js';
import { nav, pageTitle, card, listCard, row, primary, textBtn, empty, playCtl, sectionTitle } from '../ui.js';
import { shortMarker } from './labs.js';

/** A stored note in plain words: dates read "Sept 28", and the blood-test note reads like a person wrote it. */
export function noteText(t) {
  return String(t || '')
    .replace(/^Blood test (\d{4}-\d{2}-\d{2}): (?:ask the doctor about )?(.+?)(?: flagged — encourage seeing their doctor)?\.?$/, (m, d, list) => 'Blood test ' + shortDate(d) + ': ask the doctor about ' + list.split(', ').map(shortMarker).join(', ') + '.')
    .replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (d) => shortDate(d))
    .replace(/!/g, '.');
}
/** Setup answers in a sentence: "Chicken, beef, spicy food" (only the first item keeps its capital). */
function listText(v) {
  return [].concat(v || []).filter((x) => x && x !== 'None').map((x, i) => (i && /^[A-Z][a-z]/.test(x) && !/^(Shabbat|Yom Tov|Pesach|Sukkot|Purim|Chanukah|Rosh)/.test(x) ? x.charAt(0).toLowerCase() + x.slice(1) : x)).join(', ');
}
/** The weekly review text → its parts: what happened, the things to try, the plan, together. */
export function parseReview(text) {
  const paras = String(text || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
  const out = { happened: '', tries: [], plan: '', together: '', other: [] };
  paras.forEach((p) => {
    let m;
    if ((m = /^This week:\s*(.*)$/i.exec(p))) out.tries = (m[1].match(/[^.!?]+[.!?]+/g) || [m[1]]).map((x) => x.trim()).filter(Boolean);
    else if ((m = /^Plan:\s*(.*)$/i.exec(p))) out.plan = m[1];
    else if ((m = /^Together:\s*(.*)$/i.exec(p))) out.together = m[1];
    else if (!out.happened) out.happened = p;
    else out.other.push(p);
  });
  return out;
}

const PAGES = new Set(['knows', 'plan', 'guides', 'wish', 'review']);
export const has = (p) => PAGES.has(p);
export function render(p) {
  if (p === 'knows') return knowsPage();
  if (p === 'plan') return planPage();
  if (p === 'guides') return guidesPage();
  if (p === 'wish') return wishPage();
  return reviewPage();
}
export function afterRender(r) {
  if (r.parts[1] === 'review') { const m = ((S.data.coach && S.data.coach.weekly) || {})[S.meId()]; if (m && (!S.ui.reviewSeen || S.ui.reviewSeen < m.ts)) S.setUi('reviewSeen', m.ts); }
}
const back = (title) => nav({ back: 'Coach', backTo: 'coach', title });

// ------------------------------------------------------------------ What the coach knows
const CATS = [['works', 'What works'], ['failed', 'What didn\'t work'], ['preference', 'Preferences'], ['injury', 'Injuries and limits'], ['note', 'Other notes']];
const SOURCE = { chat: 'from a chat', talk: 'from Talk', daily: 'from your chats', weekly: 'from a weekly review', pain: 'from "This hurts"', labs: 'from a blood test', self: 'added by you', owner: 'added by the owner', edited: 'edited', coach: 'from the coach' };
function who() { const id = S.ui.knowsWho; return id && S.visible(id) ? id : S.meId(); }
function knowsPage() {
  const id = who();
  const p = S.person(id);
  const people = S.people().filter((x) => S.visible(x.id));
  const notes = S.notes(id);
  const edit = id === S.meId() || S.isOwner();
  const mine = id === S.meId();
  const out = [back('What the coach knows'), pageTitle('What the coach knows', (mine ? '' : 'About ' + esc(p.name) + '. ') + (edit ? 'Change or delete anything.' : 'Only ' + esc(p.name) + ' or ' + esc(S.ownerName()) + ' can change these.'))];
  const body = [];
  if (!notes.length) body.push(empty('sparkles', 'Nothing yet', 'As you chat and log, the coach writes down what helps.'));
  CATS.forEach(([k, title]) => {
    const list = notes.filter((n) => n.category === k);
    if (!list.length) return;
    body.push(`<div>${sectionTitle(title)}${listCard(list.map((n) => row({ label: noteText(n.note), sub: (SOURCE[n.source] || 'from the coach') + ' · ' + timeAgo(n.ts), act: edit ? 'knows-edit' : '', data: { 'data-id': n.id } })), 'no-ic')}</div>`);
  });
  if (edit) body.push(primary('Add a note', 'knows-add'));
  const facts = profileFacts(id);
  if (facts.length) body.push(`<div>${sectionTitle('From the setup answers')}${listCard(facts.map(([k, v]) => row({ eyebrow: k, label: v })), 'no-ic')}${id === S.meId() ? `<div class="center">${textBtn('Change my answers', 'go', { 'data-to': 'setup' })}</div>` : ''}</div>`);
  const others = people.filter((x) => x.id !== id);
  if (others.length) body.push(listCard(others.map((x) => row({ icon: 'users', label: x.id === S.meId() ? 'Your notes' : x.name + '\'s notes', act: 'knows-who', data: { 'data-v': x.id } }))));
  return out.join('') + `<div class="stack">${body.join('')}</div>`;
}
function profileFacts(id) {
  const p = S.profile(id);
  const j = listText;
  return [['Worked before', j(p.worked)], ['Didn\'t work', j(p.didnt)], ['Loves', j(p.foods_like)], ['Doesn\'t eat', j(p.foods_dislike)], ['Injuries and limits', j(p.injuries) + (p.injuries_note ? ' (' + p.injuries_note + ')' : '')], ['Best time', j(p.times)]].filter(([, v]) => v);
}
function noteSheet(n) {
  const cat = (n && n.category) || 'note';
  openSheet({ title: n ? 'Edit note' : 'Add a note', body: `<label class="field"><span>What should the coach remember?</span><textarea id="kn-text" rows="3" maxlength="200" placeholder="For example: knees feel better with a box under me for squats">${esc(n ? n.note : '')}</textarea></label>
    <label class="field"><span>Kind of note</span><select id="kn-cat">${CATS.map(([k, t]) => `<option value="${k}" ${k === cat ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
    ${primary('Save', 'knows-save', { 'data-id': n ? n.id : '' })}${n ? textBtn('Forget this', 'knows-forget', { 'data-id': n.id }, { cls: 'block' }) : ''}`, done: false });
}

// ------------------------------------------------------------------ My plan: goals, levels and why
function planPage() {
  const id = S.meId();
  const p = S.profile(id);
  const s = S.settings(id);
  const sched = s.schedule || L.DEFAULT_SCHEDULE;
  const names = { strength: 'Strength', walk: 'Walk', light: 'Light', rest: 'Rest' };
  const lib = S.library();
  const levels = S.levels(id);
  const proposals = levelUps(id);
  const series = S.series(id);
  const cur = series.length ? series[series.length - 1].trend : null;
  const goals = [];
  if (p.goal_weight) goals.push(row({ label: 'Goal weight', value: esc(p.goal_weight) + ' lb' + (cur != null ? ' · now ' + esc(cur) : '') }));
  if (p.pace) goals.push(row({ label: 'Pace', value: 'About ' + esc(p.pace) + ' lb a week' }));
  if ((p.goal_nonscale || []).length) goals.push(row({ eyebrow: 'Beyond the scale', label: listText(p.goal_nonscale) }));
  if (p.why) goals.push(row({ eyebrow: 'Why', label: '"' + p.why + '"', act: 'why-sheet' }));
  return back('My plan') + pageTitle('My plan', 'Goals, levels and why.') + `<div class="stack">
    ${goals.length ? `<div>${sectionTitle('Goals')}${listCard(goals, 'no-ic')}</div>` : ''}
    ${proposals.length ? card(`<div class="eyebrow">Ready for the next level</div><p class="sub" style="margin-top:4px">Top of the range two sessions in a row, without it feeling hard.</p>${proposals.map((x) => `<div class="split" style="margin-top:8px"><span class="body">${esc(x.to.name)}</span>${textBtn('Level up', 'level-up', { 'data-p': x.pattern, 'data-l': x.to.level })}</div>`).join('')}`) : ''}
    <div>${sectionTitle('Your week')}${listCard([0, 1, 2, 3, 4, 5, 6].map((d) => row({ label: L.WEEKDAYS[d], value: d === 6 ? 'Rest' : esc(names[sched[d]] || sched[d]) })), 'no-ic')}<div class="center">${textBtn('Change my week', 'go', { 'data-to': 'me/settings' })}</div></div>
    <div>${sectionTitle('Levels')}${listCard(L.PATTERNS.map((pt) => { const ex = L.exerciseAt(lib, pt, levels[pt] || 1); return row({ label: L.PATTERN_NAMES[pt], sub: ex ? ex.name : '', value: 'Level ' + (levels[pt] || 1) + ' of ' + L.maxLevel(lib, pt), act: 'ladder-sheet', data: { 'data-p': pt } }); }), 'no-ic')}</div>
    <p class="caption center">Session length: ${s.version_pref ? s.version_pref + ' minutes, your choice' : 'the coach picks each day'}.</p></div>`;
}
function levelUps(id) {
  const lib = S.library();
  const hist = S.logs(id).sets.map((x) => ({ date: x.date, workoutId: x.workoutId, exerciseId: x.exerciseId, level: x.level, reps: x.reps, seconds: x.seconds, felt: x.felt, pain: x.pain }));
  const levels = S.levels(id);
  const snooze = S.profile(id).level_snooze || {};
  const out = [];
  L.PATTERNS.forEach((pt) => {
    const ex = L.exerciseAt(lib, pt, levels[pt] || 1);
    if (!ex) return;
    const r = L.progressionCheck(hist, ex, { snoozedUntil: snooze[ex.id] });
    if (r.action === 'up' && r.to) { const to = lib.find((e) => e.id === r.to); if (to) out.push({ pattern: pt, from: ex, to }); }
  });
  return out;
}

// ------------------------------------------------------------------ Guides (and game plans)
export function allPlans() {
  const custom = ((S.data && S.data.content && S.data.content.ifthen) || []).filter((p) => p.status !== 'rejected');
  const ids = new Set(custom.map((p) => p.id));
  return custom.concat(K.IF_THEN.filter((p) => !ids.has(p.id)).map((p) => ({ id: p.id, situation: p.situation, rules: p.rules, status: 'active', builtIn: true })));
}
function guidesPage() {
  const plans = allPlans();
  return back('Guides') + pageTitle('Guides', 'Food, sleep, Shabbat, fast days, travel.') + `<div class="stack">
    ${listCard(K.GUIDES.map((g) => row({ label: g.title, act: 'guide', data: { 'data-id': g.id } })), 'no-ic')}
    <div>${sectionTitle('Game plans')}<p class="sub" style="margin:0 4px 8px">Decide in advance: "If this happens, then I…"</p>
      ${listCard(plans.map((p) => row({ label: p.situation, sub: p.status === 'proposed' ? 'Suggested by the coach' : '', act: 'ifthen', data: { 'data-id': p.id } })), 'no-ic')}
      <div class="center">${textBtn('Add a game plan', 'ifthen-edit', { 'data-id': '' })}</div></div>
    ${K.CHIZUK.length ? `<div>${sectionTitle('Chizuk')}${listCard(K.CHIZUK.map((c) => row({ label: c.text, sub: c.source + (c.paraphrase ? ' (paraphrase)' : '') })), 'no-ic')}</div>` : ''}</div>`;
}
function ifThenSheet(id) {
  const p = allPlans().find((x) => x.id === id);
  if (!p) return;
  const text = p.rules.map((r) => 'If ' + r[0] + ', then ' + r[1] + '.').join(' ');
  openSheet({ title: p.situation, body: `<div class="inset">${p.rules.map((r) => row({ label: 'If ' + r[0], sub: 'Then ' + r[1] })).join('')}</div>${playCtl('ifthen:' + p.id, text)}
    ${p.status === 'proposed' ? `<div class="split">${textBtn('Keep it', 'confirm', { 'data-tab': 'IfThenPlans', 'data-id': p.rowId, 'data-accept': '1' })}${textBtn('No thanks', 'confirm', { 'data-tab': 'IfThenPlans', 'data-id': p.rowId, 'data-accept': '0' })}</div>` : textBtn('Edit', 'ifthen-edit', { 'data-id': p.id }, { cls: 'block' })}` });
}
function ifThenEdit(id) {
  const p = id ? allPlans().find((x) => x.id === id) : { situation: '', rules: [['', '']] };
  const rules = (p.rules || []).concat([['', '']]);
  updateSheet({ title: id ? 'Edit game plan' : 'New game plan', body: `<label class="field"><span>Situation</span><input id="it-sit" type="text" value="${esc(p.situation)}" placeholder="For example, an office birthday party"></label>
    ${rules.map((r) => `<div class="inset" style="padding:12px"><label class="field"><span>If…</span><input class="it-if" type="text" value="${esc(r[0])}" placeholder="the cake comes out"></label><label class="field" style="margin-top:8px"><span>Then I…</span><input class="it-then" type="text" value="${esc(r[1])}" placeholder="have a coffee and chat"></label></div>`).join('')}
    ${primary('Save', 'ifthen-save', { 'data-id': id || '' })}${id && !p.builtIn ? textBtn('Remove this plan', 'ifthen-remove', { 'data-id': id }, { cls: 'block' }) : ''}` });
}

// ------------------------------------------------------------------ Wish list
function wishPage() {
  const items = (S.data.wishlist || []).filter((w) => w.status !== 'deleted');
  return back('Wish list') + pageTitle('Wish list', 'Ideas for the app. Each one comes with a ready-made request for a future developer session.') + `<div class="stack">
    ${items.length ? listCard(items.map((w) => row({ label: w.request, sub: w.status === 'done' ? 'Done' : (w.why || ''), act: 'wish-open', data: { 'data-id': w.id } })), 'no-ic') : empty('star', 'Nothing yet', 'Tell the coach "I wish the app could…" and it lands here.')}
    ${primary('Add a wish', 'wish-sheet')}<div class="center">${textBtn('Export WISHLIST.md', 'wish-export', {}, { icon: 'download' })}</div></div>`;
}

// ------------------------------------------------------------------ the weekly review
function reviewPage() {
  const w = (S.data.coach && S.data.coach.weekly) || {};
  const blocks = S.people().filter((p) => S.visible(p.id)).map((p) => {
    const m = w[p.id];
    const head = esc(p.id === S.meId() ? 'Your week' : p.name + '\'s week') + (m ? ' · ' + esc(timeAgo(m.ts)) : '');
    if (!m) return `<div>${sectionTitle(p.id === S.meId() ? 'Your week' : p.name + '\'s week')}${card('<p class="sub">The first weekly review arrives Sunday morning.</p>')}</div>`;
    const r = parseReview(m.text);
    const first = (r.happened.match(/^.+?[.!?](\s|$)/) || [r.happened])[0].trim();
    const rows = [row({ icon: 'calendar-check', label: 'What happened', sub: esc(first), act: 'review-part', data: { 'data-p': p.id, 'data-k': 'happened' } })]
      .concat(r.tries.map((t) => row({ icon: 'check', label: t, cls: 'static' })))
      .concat(r.plan ? [row({ icon: 'calendar', label: 'Plan for the week', sub: esc(r.plan), act: 'review-part', data: { 'data-p': p.id, 'data-k': 'plan' } })] : [])
      .concat(r.together ? [row({ icon: 'users', label: 'Together', sub: esc(r.together), act: 'review-part', data: { 'data-p': p.id, 'data-k': 'together' } })] : []);
    return `<div><div class="split" style="margin:0 4px 8px"><span class="eyebrow">${head}</span>${playCtl('wk:' + p.id + ':' + m.ts, m.text)}</div>${listCard(rows)}</div>`;
  });
  const rs = S.data.coach && S.data.coach.research;
  if (rs) blocks.push(`<div><div class="eyebrow" style="margin:0 4px 8px">Monthly research check · ${esc(timeAgo(rs.ts))}</div>${listCard([row({ icon: 'book-open', label: 'What\'s new in the research', sub: esc((String(rs.text).match(/^.+?[.!?](\s|$)/) || [String(rs.text)])[0]), act: 'review-part', data: { 'data-k': 'research' } })])}</div>`);
  return back('Weekly review') + pageTitle('Weekly review') + `<div class="stack">${blocks.join('')}${S.isOwner() ? `<div class="center">${textBtn('Run the weekly review now', 'run-job', { 'data-job': 'weekly' })}</div>` : ''}</div>`;
}

// ------------------------------------------------------------------ actions
export const actions = {
  'review-part'(el) {
    const k = el.dataset.k;
    if (k === 'research') {
      const rs = S.data.coach.research;
      openSheet({ title: 'Research check', body: `${playCtl('research:' + rs.ts, rs.text)}<div class="prose">${String(rs.text).split(/\n+/).map((x) => `<p class="body">${esc(x)}</p>`).join('')}</div>${(rs.meta && rs.meta.sources || []).length ? `<div class="inset">${rs.meta.sources.map((x) => `<a class="row" href="${esc(x.url)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><span class="row-main"><span class="row-label">${esc(x.title)}</span></span>${icon('external-link', 'ic-s')}</a>`).join('')}</div>` : ''}` });
      return;
    }
    const m = ((S.data.coach && S.data.coach.weekly) || {})[el.dataset.p];
    if (!m) return;
    const r = parseReview(m.text);
    const text = k === 'plan' ? r.plan : k === 'together' ? r.together : [r.happened].concat(r.other).join('\n');
    openSheet({ title: { happened: 'What happened', plan: 'Plan for the week', together: 'Together' }[k], body: `<div class="prose">${text.split(/\n+/).map((x) => `<p class="body">${esc(x)}</p>`).join('')}</div>` });
  },
  'knows-who'(el) { S.setUi('knowsWho', el.dataset.v); rerender(); },
  'knows-add'() { noteSheet(null); },
  'knows-edit'(el) { noteSheet(S.notes(who()).find((x) => x.id === el.dataset.id)); },
  'knows-save'(el) {
    const text = document.getElementById('kn-text').value.trim();
    if (!text) { toast('Write a few words first.', { kind: 'err' }); return; }
    const category = document.getElementById('kn-cat').value;
    S.write('notes', Object.assign({ op: el.dataset.id ? 'edit' : 'add', userId: who(), text, category }, el.dataset.id ? { id: el.dataset.id } : {}));
    closeSheet(); toast('Saved. The coach will use it from now on.');
  },
  'knows-forget'(el) {
    const n = S.notes(who()).find((x) => x.id === el.dataset.id);
    if (!n || /^tmp_/.test(n.id)) return;
    S.write('notes', { op: 'forget', userId: who(), id: n.id });
    closeSheet(); toast('Forgotten.');
  },
  'why-sheet'() {
    openSheet({ title: 'My why', body: `<p class="sub">Shown back to you on hard days and in weekly reviews.</p><label class="field"><span>Why this matters to me</span><textarea id="why-in" rows="3" maxlength="400">${esc(S.profile().why || '')}</textarea></label>${primary('Save', 'why-save')}`, done: false });
  },
  'why-save'() { S.write('saveProfile', { values: { why: document.getElementById('why-in').value.trim() } }); closeSheet(); toast('Saved.'); },
  'level-up'(el) { S.write('setLevel', { pattern: el.dataset.p, level: +el.dataset.l, reason: 'Top of the range twice in a row' }); toast('Next level unlocked. Take it slow the first time.', { icon: 'star' }); },
  'ladder-sheet'(el) {
    const p = el.dataset.p;
    const cur = S.levels(S.meId())[p] || 1;
    openSheet({ title: L.PATTERN_NAMES[p], body: `<div class="inset">${L.levelsFor(S.library(), p).map((e) => row({ label: 'Level ' + e.level + ': ' + e.name, sub: e.level === cur ? 'Your level' : '', act: 'open-move', data: { 'data-id': e.id } })).join('')}</div>` });
  },
  guide(el) {
    const g = K.GUIDES.find((x) => x.id === el.dataset.id);
    if (!g) return;
    openSheet({ title: g.title, body: `${playCtl('guide:' + g.id, g.title + '. ' + g.body.join(' '))}<ul class="bullets">${g.body.map((b) => `<li class="body" style="margin-top:8px">${esc(b)}</li>`).join('')}</ul>` });
  },
  ifthen(el) { ifThenSheet(el.dataset.id); },
  'ifthen-edit'(el) { if (!document.querySelector('#sheet-root.open')) openSheet({ title: '', body: '' }); ifThenEdit(el.dataset.id); },
  'ifthen-save'(el) {
    const situation = document.getElementById('it-sit').value.trim();
    const ifs = Array.from(document.querySelectorAll('.it-if')).map((i) => i.value.trim());
    const thens = Array.from(document.querySelectorAll('.it-then')).map((i) => i.value.trim());
    const rules = ifs.map((x, i) => [x, thens[i]]).filter((r) => r[0] && r[1]);
    if (!situation || !rules.length) { toast('Add a situation and at least one if-then.', { kind: 'err' }); return; }
    const id = el.dataset.id;
    const known = id && (((S.data.content && S.data.content.ifthen) || []).some((p) => p.id === id) || K.IF_THEN.some((p) => p.id === id));
    S.write('ifThen', { op: known ? 'edit' : 'add', id, situation, rules, forBoth: true }, { optimistic: false });
    const c = S.data.content = S.data.content || {};
    c.ifthen = (c.ifthen || []).filter((p) => p.id !== id).concat([{ id: id || 'tmp_' + Date.now(), situation, rules, status: 'active' }]);
    S.persist(); S.changed();
    closeSheet(); toast('Game plan saved.');
  },
  'ifthen-remove'(el) {
    S.write('ifThen', { op: 'remove', id: el.dataset.id }, { optimistic: false });
    S.data.content.ifthen = S.data.content.ifthen.filter((p) => p.id !== el.dataset.id);
    S.persist(); S.changed(); closeSheet();
  },
  'wish-open'(el) {
    const w = (S.data.wishlist || []).find((x) => x.id === el.dataset.id);
    if (!w) return;
    openSheet({ title: 'Wish', body: `<p class="body">${esc(w.request)}</p>${w.why ? `<p class="sub">${esc(w.why)}</p>` : ''}${primary('Copy the request', 'wish-copy', { 'data-id': w.id }, { icon: 'copy' })}${w.status !== 'done' ? textBtn('Mark done', 'wish-done', { 'data-id': w.id }, { cls: 'block' }) : ''}` });
  },
  'wish-sheet'() {
    openSheet({ title: 'Add a wish', body: `<label class="field"><span>I wish the app could…</span><textarea id="wish-r" rows="3" maxlength="300"></textarea></label><label class="field"><span>Why (optional)</span><input id="wish-w" type="text" maxlength="300"></label>${primary('Add to the wish list', 'wish-save')}`, done: false });
  },
  async 'wish-save'(el) {
    const r = document.getElementById('wish-r').value.trim();
    if (!r) { toast('Describe your wish first.', { kind: 'err' }); return; }
    await busy(el, async () => {
      try { await call('wishlist', { op: 'add', request: r, why: document.getElementById('wish-w').value.trim() }); closeSheet(); await S.sync(); toast('Added to the wish list.'); }
      catch (e) { toast(e.message, { kind: 'err' }); }
    });
  },
  async 'wish-copy'(el) {
    const w = (S.data.wishlist || []).find((x) => x.id === el.dataset.id);
    toast((await copyText((w && (w.claude_prompt || w.request)) || '')) ? 'Copied. Paste it into a new Claude Code session.' : 'Couldn\'t copy.', { icon: 'copy' });
  },
  async 'wish-done'(el) { await busy(el, async () => { try { await call('wishlist', { op: 'done', id: el.dataset.id }); closeSheet(); await S.sync(); } catch (e) { toast(e.message, { kind: 'err' }); } }); },
  async 'wish-export'(el) {
    await busy(el, async () => {
      try { const r = await call('wishlist', { op: 'export' }); await shareOrDownload(new Blob([r.markdown], { type: 'text/markdown' }), 'WISHLIST.md', 'Wish list'); }
      catch (e) { toast(e.message, { kind: 'err' }); }
    });
  },
  async 'run-job'(el) {
    await busy(el, async () => {
      toast('Working on it. This can take a minute.', { icon: 'timer', ms: 60000 });
      try { await call('runJob', { job: el.dataset.job }, { timeout: 300000 }); await S.sync(); toast('Done.'); }
      catch (e) { toast(e.message, { kind: 'err' }); }
    });
  }
};
export { go, shortDate, dayName };
