/* Together (D13): the shared goal, both weeks side by side, cheers, and the Sunday recap, couple check-in and team challenge. */
import { L, K, esc, icon, toast, openSheet, updateSheet, closeSheet, shortDate, timeAgo, MONTHS } from '../core.js';
import { S } from '../store.js';
import { go, back, rerender } from '../nav.js';
import { tabHead, card, listCard, row, primary, textBtn, seg, empty, initialOf, playCtl } from '../ui.js';
import { logged } from '../fx.js';

const QUICK = ['Proud of you', 'You\'ve got this'];
const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'Sh'];

export function render(r) {
  if (r.parts[1] === 'recap') return recapPage();
  const ws = L.weekStart(S.today());
  const [, m, d] = ws.split('-').map(Number);
  const head = tabHead({ eyebrow: 'Week of ' + MONTHS[m - 1] + ' ' + d, title: 'Together' });
  const p = S.partner();
  if (!p) return `<div class="stack">${head}${empty('users', 'Waiting for your partner', 'Once your partner opens their personal link, you\'ll see both weeks here.', S.isOwner() ? primary('Share their link', 'go', { 'data-to': 'me/settings' }) : '')}</div>`;
  return `<div class="stack">${head}${goalCard(p)}${weekCard(p)}${cheersCard(p)}${rowsCard()}</div>`;
}

// ------------------------------------------------------------------ shared goal
function weekMinutes(id) {
  if (!S.visible(id)) return 0;
  const ws = L.weekStart(S.today());
  return S.logs(id).workouts.filter((w) => w.date >= ws && w.date <= L.addDays(ws, 6)).reduce((a, w) => a + (+w.minutes || +w.version || 0), 0);
}
function goalCard(p) {
  const g = (S.data.together && S.data.together.goal) || { type: 'minutes', target: 300 };
  const me = S.me();
  if (g.type === 'pounds') {
    const people = S.people().filter((x) => S.visible(x.id)).map((x) => ({ startWeight: +S.profile(x.id).weight_start || null, series: S.series(x.id), weekMinutes: 0 }));
    const prog = L.sharedGoalProgress(g, people);
    return card(`<div class="split"><span class="eyebrow">Shared goal</span>${textBtn('Change', 'goal-sheet', {}, { cls: 'small' })}</div>
      <div class="goal-num"><b>${esc(prog.value)}</b><span>of ${esc(prog.target)} pounds together</span></div><div style="margin-top:12px"><span class="bar goal"><i style="width:${(prog.pct * 100).toFixed(1)}%;background:var(--activity)"></i></span></div>`, 'goal');
  }
  const mine = weekMinutes(me.id), theirs = weekMinutes(p.id), total = mine + theirs, target = +g.target || 300;
  const a = Math.min(1, mine / target), b = Math.min(1 - a, theirs / target);
  return card(`<div class="split"><span class="eyebrow">Shared goal</span>${textBtn('Change', 'goal-sheet', {}, { cls: 'small' })}</div>
    <div class="goal-num"><b data-count="${total}" data-count-key="goal-${L.weekStart(S.today())}">${total}</b><span>of ${target} active minutes</span></div>
    <div style="margin-top:12px"><span class="bar goal" role="progressbar" aria-valuemin="0" aria-valuemax="${target}" aria-valuenow="${total}" aria-label="${total} of ${target} active minutes"><i style="width:${(a * 100).toFixed(1)}%;background:var(--activity)"></i><i style="width:${(b * 100).toFixed(1)}%;background:var(--partner)"></i></span></div>
    <div class="legend"><span style="--c: var(--activity)"><i></i>You ${mine}</span><span style="--c: var(--partner)"><i></i>${esc(p.name)} ${S.visible(p.id) ? theirs : '—'}</span></div>`, 'goal');
}

// ------------------------------------------------------------------ this week, side by side
function weekCard(p) {
  const ws = L.weekStart(S.today());
  const today = S.today();
  const head = DAY_LETTERS.map((l, i) => `<th scope="col" class="${L.addDays(ws, i) === today ? 'today' : ''}">${l}</th>`).join('');
  const line = (person, label, c) => {
    if (!S.visible(person.id)) return `<tr><th scope="row">${esc(label)}</th><td colspan="7" class="sub">Sharing is paused</td></tr>`;
    const st = S.statuses(person.id);
    const cells = Array.from({ length: 7 }, (_, i) => {
      const date = L.addDays(ws, i);
      const cal = S.day(date);
      let cls = 'todo', inner = '', label2 = 'still to come';
      if (cal.isRest) { cls = 'rest'; inner = icon('flame'); label2 = cal.isYomTov ? 'Yom Tov' : 'Shabbat'; }
      else if (date <= today) {
        const status = st.statuses[date];
        const d = S.done(person.id, date);
        if (status === 'done') { cls = 'full'; label2 = 'done'; }
        else if (d.activityMin || d.habitCount) { cls = 'part'; label2 = 'partly done'; }
        else if (date < today) { cls = 'miss'; label2 = status === 'neutral' ? 'rest day' : 'missed'; }
      }
      return `<td><span class="dotc ${cls}" style="--c: var(--${c})" role="img" aria-label="${esc(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Shabbat'][i] + ': ' + label2)}">${inner}</span></td>`;
    }).join('');
    return `<tr><th scope="row">${esc(label)}</th>${cells}</tr>`;
  };
  return card(`<h2 class="section" style="margin:0">This week, side by side</h2><table class="wk"><thead><tr><th></th>${head}</tr></thead><tbody>${line(S.me(), 'You', 'activity')}${line(p, p.name, 'partner')}</tbody></table>
    <p class="caption" style="margin-top:8px">Filled: done. Ring: partly done.</p>`);
}

// ------------------------------------------------------------------ cheers
function cheersCard(p) {
  const all = ((S.data.together && S.data.together.cheers) || []).filter((c) => c.kind !== 'nudge' || c.to === S.meId());
  const last = all.slice().sort((a, b) => (String(a.ts) < String(b.ts) ? 1 : -1))[0];
  const who = last ? (last.from === S.meId() ? S.me() : S.person(last.from) || {}) : null;
  return card(`<div class="split"><span class="eyebrow">Cheers</span>${all.length > 1 ? textBtn('All', 'cheers-all', {}, { cls: 'small' }) : ''}</div>
    ${last ? `<div class="cheer-last"><span class="initial mid" aria-hidden="true">${esc(initialOf(who.name))}</span><div><p>${esc(String(last.text || '').replace(/!/g, '.'))}</p><p class="caption">${esc(last.from === S.meId() ? 'You' : who.name || '')} · ${esc(timeAgo(last.ts))}</p></div></div>` : '<p class="sub" style="margin-top:6px">No cheers yet. Send the first one.</p>'}
    <div class="cheer-pills">${QUICK.map((q) => `<button type="button" data-act="cheer-send" data-text="${esc(q)}">${esc(q)}</button>`).join('')}<button type="button" data-act="cheer-sheet" aria-label="Write your own cheer">+</button></div>`);
}

// ------------------------------------------------------------------ recap, couple check-in, team challenge
function rowsCard() {
  const ws = L.weekStart(S.today());
  const r = S.recap();
  const coupleMine = ((S.data.together && S.data.together.couple) || []).some((c) => c.userId === S.meId() && c.weekStart === ws);
  const ct = S.settings().couple_time === 'sunday' ? 'Sun evening' : 'Motzei Shabbat';
  const ch = ((S.data.together && S.data.together.challenges) || []).filter((c) => c.weekStart >= L.addDays(ws, -7));
  const active = ch.find((c) => c.status === 'active');
  const proposed = ch.find((c) => c.status === 'proposed');
  const daysLeft = Math.max(0, L.daysBetween(S.today(), L.addDays(ws, 5)) + 1);
  return listCard([
    row({ icon: 'calendar-check', label: 'Sunday recap', sub: 'Your week together', value: r && r.meta ? 'Sun' : '', act: 'go', data: { 'data-to': 'together/recap' } }),
    row({ icon: 'heart', label: 'Couple check-in', sub: '10 minutes with the coach', value: coupleMine ? 'Done' : ct, act: 'couple-sheet' }),
    row({ icon: 'star', label: 'Team challenge', sub: active ? active.title : (proposed ? 'Suggested: ' + proposed.title : 'Ask the coach for one'), value: active ? plural(daysLeft, 'day') + ' left' : '', act: 'challenge-sheet' })
  ]);
}
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

function cheerSheet() {
  const p = S.partner();
  openSheet({ title: 'Cheer ' + p.name, body: `<label class="field"><span>Your own words</span><input id="cheer-in" type="text" maxlength="280" placeholder="Write a few words" enterkeyhint="send" data-enter="cheer-custom" autocapitalize="sentences" autofocus></label>
    ${primary('Send', 'cheer-custom')}
    <div class="inset">${K.CHEERS.map((c) => row({ label: c.replace(/!/g, '.'), act: 'cheer-send', data: { 'data-text': c.replace(/!/g, '.'), 'data-close': '1' } })).join('')}${row({ label: 'Gentle nudge: "' + K.NUDGE + '"', act: 'nudge' })}</div>` });
}
function coupleSheet() {
  const ws = L.weekStart(S.today());
  const list = ((S.data.together && S.data.together.couple) || []).filter((c) => c.weekStart === ws);
  const mine = list.find((c) => c.userId === S.meId());
  const summary = S.data.coach && S.data.coach.couple;
  if (mine) {
    const show = (c, name) => `<div><div class="eyebrow" style="margin:0 4px 6px">${esc(name)}</div><div class="inset" style="padding:12px 16px">${K.COUPLE_QUESTIONS.map((q) => (c.answers && c.answers[q.key] ? `<p class="h3">${esc(q.q)}</p><p class="sub" style="margin:2px 0 10px">${esc(c.answers[q.key])}</p>` : '')).join('')}</div></div>`;
    const theirs = list.filter((c) => c.userId !== S.meId() && c.answers);
    openSheet({ title: 'Couple check-in', body: show(mine, 'You') + (theirs.length ? theirs.map((c) => show(c, (S.person(c.userId) || {}).name || '')).join('') : `<p class="sub">Waiting for ${esc((S.partner() || {}).name || 'your partner')}.</p>`)
      + (summary && String(summary.ts).slice(0, 10) >= ws ? `<div class="card" style="background:var(--inset)"><div class="eyebrow">From the coach</div><p class="body" style="margin-top:4px">${esc(summary.text)}</p>${playCtl('couple:' + ws, summary.text)}</div>` : '') });
    return;
  }
  openSheet({ title: 'Couple check-in', body: `<p class="sub">Ten minutes, three questions: what went well, what was hard, and one thing you'll do for each other.</p>
    ${K.COUPLE_QUESTIONS.map((q) => `<label class="field"><span>${esc(q.q)}</span><textarea id="cq-${q.key}" rows="3" maxlength="600"></textarea></label>`).join('')}
    ${primary('Save my answers', 'couple-save')}` });
}
function challengeSheet() {
  const ws = L.weekStart(S.today());
  const list = ((S.data.together && S.data.together.challenges) || []).filter((c) => c.weekStart >= L.addDays(ws, -7));
  const rs = (S.data.together && S.data.together.rewards) || [];
  const mins = S.people().filter((x) => S.visible(x.id)).reduce((a, x) => a + S.week(x.id).walkMinutes, 0);
  const block = (c) => {
    if (c.status === 'proposed') return `<div class="inset" style="padding:12px 16px"><div class="eyebrow">Coach suggests</div><p class="body" style="margin-top:4px">${esc(c.title)}</p><p class="sub">${esc(c.description || '')}</p><div class="split">${textBtn('Accept', 'challenge', { 'data-op': 'accept', 'data-id': c.id })}${textBtn('Not this week', 'challenge', { 'data-op': 'decline', 'data-id': c.id })}</div></div>`;
    if (c.status === 'active') return `<div class="inset" style="padding:12px 16px"><p class="body">${esc(c.title)}</p><p class="sub">${esc(c.description || '')}</p>${c.target && /min/i.test(c.unit || '') ? `<p class="sub" style="margin-top:6px">${mins} of ${c.target} ${esc(c.unit)}</p>` : ''}<div class="center">${textBtn('We did it', 'challenge', { 'data-op': 'done', 'data-id': c.id })}</div></div>`;
    if (c.status === 'done') return `<p class="sub">${icon('check', 'ic-s')} ${esc(c.title)}, done.</p>`;
    return '';
  };
  openSheet({ title: 'Team challenge', body: (list.length ? list.map(block).join('') : '<p class="sub">The coach suggests a friendly team challenge every Sunday with the weekly review.</p>')
    + `<div class="center">${textBtn('Add our own', 'challenge-new')}</div>
    <div><div class="eyebrow" style="margin:0 4px 6px">Rewards</div>${rs.length ? `<div class="inset">${rs.map((r) => row({ label: r.title, sub: r.unlock ? 'When: ' + r.unlock : '', right: r.status === 'claimed' ? '<span class="row-value">Enjoyed</span>' : textBtn(r.status === 'earned' ? 'Enjoyed it' : 'We earned it', 'reward', { 'data-op': r.status === 'earned' ? 'claim' : 'earn', 'data-id': r.id }, { cls: 'small' }) })).join('')}</div>` : '<p class="sub">Pick rewards together for milestones: a date night, new walking shoes.</p>'}
      <div class="center">${textBtn('Add a reward', 'reward-new')}</div></div>` });
}

// ------------------------------------------------------------------ the Sunday recap story
function slide(inner) { return `<section class="story-slide">${inner}</section>`; }
function stat(n, label) { return `<div class="story-stat"><b>${esc(n)}</b><span>${esc(label)}</span></div>`; }
function recapPage() {
  const r = S.recap();
  if (!r || !r.meta || !r.meta.people) return `<div class="story"><div class="story-top">${'<button class="btn-icon" type="button" data-act="back" data-to="together" aria-label="Close">' + icon('x') + '</button>'}</div>${empty('calendar-check', 'No recap yet', 'Your first weekly recap appears Motzei Shabbat or Sunday evening.', primary('Back to Together', 'back', { 'data-to': 'together' }))}</div>`;
  const ws = r.meta.week, people = r.meta.people;
  const cols = (fn) => `<div class="story-cols">${people.map((p) => `<div class="card tight"><div class="row-label b">${esc(p.name)}</div>${fn(p)}</div>`).join('')}</div>`;
  const total = people.reduce((a, p) => a + p.walkMinutes + p.workouts * 20, 0);
  const slides = [
    slide(`<div class="eyebrow">Sunday recap</div><h1 class="title">Your week${people.length > 1 ? ' together' : ''}</h1><p class="sub">${esc(shortDate(ws))} – ${esc(shortDate(L.addDays(ws, 6)))}</p><div class="goal-num"><b>${total}</b><span>active minutes</span></div>${cols((p) => stat(p.daysDone, 'active days') + stat(p.streak, 'day streak'))}`),
    slide(`<h2 class="section">Moving</h2>${cols((p) => stat(p.workouts, 'strength sessions') + stat(p.walkMinutes, 'walk minutes'))}`),
    slide(`<h2 class="section">Weight trend</h2>${cols((p) => (p.weight ? stat((p.weight.change <= 0 ? '−' : '+') + Math.abs(p.weight.change), 'lb this week') : '<p class="sub">No weigh-ins this week.</p>'))}<p class="caption">Measured by the 7-day trend, not one morning.</p>`),
    slide(`<h2 class="section">Habits</h2>${cols((p) => stat(p.habitsPerDay || 0, 'food habits a day') + stat(p.proteinDays, 'days on protein'))}`),
    slide(`<h2 class="section">Wins</h2>${cols((p) => (p.wins && p.wins.length ? `<ul class="bullets">${p.wins.map((w) => `<li class="sub">${esc(w)}</li>`).join('')}</ul>` : '<p class="sub">Every day you showed up counts.</p>'))}`),
    slide(`<h2 class="section">From your coach</h2><p class="body">${esc(r.text)}</p>${playCtl('recap:' + ws, r.text)}${people.length > 1 ? primary('Start our couple check-in', 'recap-couple') : ''}`)
  ];
  return `<div class="story" role="region" aria-label="Weekly recap"><div class="story-top"><div class="story-progress" aria-hidden="true">${slides.map((_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div><button class="btn-icon" type="button" data-act="back" data-to="together" aria-label="Close">${icon('x')}</button></div>
    <div class="story-track" id="story-track">${slides.join('')}</div>
    <div class="story-nav">${textBtn('Back', 'recap-step', { 'data-d': '-1' })}${textBtn('Next', 'recap-step', { 'data-d': '1' })}</div></div>`;
}
export function afterRender(r) {
  if (r.parts[1] !== 'recap') return;
  const t = document.getElementById('story-track');
  if (!t || t.dataset.wired) return;
  t.dataset.wired = '1';
  t.addEventListener('scroll', () => { const i = Math.round(t.scrollLeft / t.clientWidth); document.querySelectorAll('.story-progress i').forEach((el, k) => el.classList.toggle('on', k <= i)); }, { passive: true });
}

// ------------------------------------------------------------------ actions
export const actions = {
  'cheer-sheet'() { if (S.partner()) cheerSheet(); },
  'cheer-send'(el) {
    const op = S.write('cheer', { kind: 'cheer', text: el.dataset.text });
    if (el.dataset.close) closeSheet();
    logged(op, 'Sent to ' + ((S.partner() || {}).name || 'your partner') + '.');
  },
  'cheer-custom'() {
    const inp = document.getElementById('cheer-in');
    const v = (inp && inp.value || '').trim();
    if (!v) { if (inp) { inp.placeholder = 'Write a few words first'; inp.focus(); } return; }
    inp.value = '';
    const op = S.write('cheer', { kind: 'cheer', text: v });
    closeSheet(); logged(op, 'Sent.');
  },
  'cheers-all'() {
    const all = ((S.data.together && S.data.together.cheers) || []).slice().reverse().slice(0, 30);
    openSheet({ title: 'Cheers', body: `<div class="inset">${all.map((c) => row({ label: String(c.text || '').replace(/!/g, '.'), sub: (c.from === S.meId() ? 'You' : (S.person(c.from) || {}).name || '') + ' · ' + timeAgo(c.ts) })).join('')}</div>` });
  },
  nudge() { S.write('cheer', { kind: 'nudge' }); closeSheet(); toast('Nudge sent, gently.', { icon: 'heart' }); },
  'couple-sheet'() { coupleSheet(); },
  'couple-save'() {
    const answers = {};
    K.COUPLE_QUESTIONS.forEach((q) => { answers[q.key] = document.getElementById('cq-' + q.key).value.trim(); });
    if (!answers.well && !answers.hard && !answers.for_partner) { toast('Answer at least one question.', { kind: 'err' }); return; }
    S.write('coupleCheckin', { answers });
    closeSheet(); toast('Saved. Thank you for doing this together.', { icon: 'heart' });
    setTimeout(() => S.sync(), 4000);
  },
  'challenge-sheet'() { challengeSheet(); },
  challenge(el) { S.write('challenge', { op: el.dataset.op, id: el.dataset.id }); closeSheet(); toast(el.dataset.op === 'done' ? 'Team win.' : (el.dataset.op === 'accept' ? 'Challenge on.' : 'Skipped this week.'), { icon: 'star' }); },
  'challenge-new'() {
    updateSheet({ title: 'Our own challenge', body: `<label class="field"><span>Name</span><input id="ch-t" type="text" placeholder="For example, walk together 3 evenings"></label>
      <label class="field"><span>Details (optional)</span><input id="ch-d" type="text"></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label class="field"><span>Target</span><input id="ch-n" type="number" inputmode="numeric"></label><label class="field"><span>Unit</span><input id="ch-u" type="text" placeholder="minutes"></label></div>
      ${primary('Start this week', 'challenge-save')}` });
  },
  'challenge-save'() {
    const t = document.getElementById('ch-t').value.trim();
    if (!t) { toast('Give it a name.', { kind: 'err' }); return; }
    const body = { op: 'add', title: L.capItem(t), description: document.getElementById('ch-d').value.trim(), target: +document.getElementById('ch-n').value || null, unit: document.getElementById('ch-u').value.trim() };
    S.write('challenge', body, { optimistic: false });
    S.data.together.challenges.push({ id: 'tmp', rowId: 'tmp', weekStart: L.weekStart(S.today()), title: body.title, description: body.description, target: body.target, unit: body.unit, status: 'active' });
    S.persist(); S.changed(); closeSheet();
  },
  reward(el) { S.write('reward', { op: el.dataset.op, id: el.dataset.id }); closeSheet(); },
  'reward-new'() {
    updateSheet({ title: 'Add a reward', body: `<label class="field"><span>Reward</span><input id="rw-t" type="text" maxlength="120" placeholder="${esc(K.REWARD_IDEAS[0])}"></label>
      <label class="field"><span>When we earn it</span><input id="rw-u" type="text" maxlength="120" placeholder="For example, a 30-day streak"></label>${primary('Add reward', 'reward-save')}` });
  },
  'reward-save'() {
    const t = document.getElementById('rw-t').value.trim();
    if (!t) { toast('Name the reward.', { kind: 'err' }); return; }
    S.write('reward', { op: 'add', title: L.capItem(t), unlock: document.getElementById('rw-u').value.trim() });
    closeSheet();
  },
  'goal-sheet'() {
    const g = (S.data.together && S.data.together.goal) || { type: 'minutes', target: 300 };
    openSheet({ title: 'Shared goal', body: `${seg([['minutes', 'Active minutes'], ['pounds', 'Pounds together']], g.type, 'goal-type', { label: 'Kind of goal' })}
      <label class="field"><span>Target</span><input id="goal-n" type="number" inputmode="numeric" value="${esc(g.target)}"></label>${primary('Save', 'goal-save', { 'data-t': g.type })}` });
  },
  'goal-type'(el) {
    document.querySelectorAll('[data-act="goal-type"]').forEach((b) => { const on = b === el; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    document.querySelector('[data-act="goal-save"]').dataset.t = el.dataset.v;
    document.getElementById('goal-n').value = el.dataset.v === 'pounds' ? 20 : 300;
  },
  'goal-save'(el) {
    const n = +document.getElementById('goal-n').value;
    if (!(n > 0)) { toast('Enter a target.', { kind: 'err' }); return; }
    S.write('settings', { values: { shared_goal: { type: el.dataset.t, target: n } } });
    closeSheet(); toast('Shared goal updated.');
  },
  'recap-step'(el) { const t = document.getElementById('story-track'); if (t) t.scrollBy({ left: t.clientWidth * +el.dataset.d, behavior: 'smooth' }); },
  'recap-couple'() { back('together'); setTimeout(() => coupleSheet(), 350); }
};
export { go, rerender };
