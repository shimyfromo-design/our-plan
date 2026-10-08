/* Setup — one question per screen. Answers save locally as you go, and to the server at the end. */
import { L, K, esc, icon, toast, chev } from '../core.js';
import { S } from '../store.js';
import { LS } from '../api.js';
import { go, rerender } from '../nav.js';
import { primary, textBtn } from '../ui.js';
/** Setup's own small parts (restyled for Round 3): a big pick button and a multi-select button. */
const btn = (label, act, opts = {}) => primary(label, act, opts.data || {}, { disabled: opts.disabled });
const chip = (label, act, on, data = {}) => `<button type="button" class="${on ? 'on' : ''}" data-act="${esc(act)}" aria-pressed="${on ? 'true' : 'false'}" ${Object.keys(data).map((k) => k + '="' + esc(data[k]) + '"').join(' ')}>${esc(label)}</button>`;

const supName = (id) => (K.SUPPLEMENTS.find((s) => s.id === id) || {}).name || id;

function steps() {
  const d = draft();
  const list = [
    { key: 'intro', type: 'intro' },
    { key: 'weight_start', type: 'number', q: 'What do you weigh today?', sub: 'Pounds. Rough is fine — your trend line does the rest.', unit: 'lb', min: 60, max: 700, step: 0.1, required: true },
    { key: 'height_in', type: 'height', q: 'How tall are you?', required: true },
    { key: 'goal_weight', type: 'number', q: 'Do you have a goal weight?', sub: 'Optional. Skip if you\'d rather focus on how you feel.', unit: 'lb', min: 60, max: 700, step: 1 },
    { key: 'goal_nonscale', type: 'chips', q: 'What else do you want from this?', sub: 'Pick any. These count as much as the scale.', options: K.CHOICES.nonScale, other: true },
    { key: 'activity', type: 'choice', q: 'How active are you these days?', options: K.CHOICES.activity, required: true },
    { key: 'days', type: 'days', q: 'Which days could you realistically work out?', sub: 'And when? Shabbat is always a rest day.', required: true },
    { key: 'minutes_available', type: 'choice', q: 'How much time on a normal day?', sub: 'Ten minutes counts. You can always do more.', options: K.CHOICES.minutes, required: true },
    { key: 'equipment', type: 'chips', q: 'What do you have at home?', sub: 'We assume nothing fancy — a chair, a wall and the floor are enough.', options: K.CHOICES.equipment },
    { key: 'injuries', type: 'chips', q: 'Any injuries, pain or limits?', sub: 'We\'ll start those movements at the gentlest level.', options: K.CHOICES.injuries, other: true, noneLabel: 'None' },
    { key: 'life_stage', type: 'choice', q: 'Are any of these true right now?', sub: 'This turns on safe mode: gentler guidance and no weight-loss pacing unless your doctor set one.', options: K.CHOICES.lifeStage, required: true }
  ];
  K.PARQ.forEach((q, i) => list.push({ key: 'parq_' + i, type: 'yesno', q, sub: 'Health check ' + (i + 1) + ' of ' + K.PARQ.length + ' — based on the PAR-Q+.', idx: i }));
  const anyYes = (d.parq || []).some((x) => x === 'yes');
  const safe = anyYes || ['pregnant', 'nursing', 'postpartum'].indexOf(d.life_stage) >= 0;
  if (anyYes || ['pregnant', 'nursing', 'postpartum'].indexOf(d.life_stage) >= 0) list.push({ key: 'parq_result', type: 'parq_result' });
  if (!safe) list.push({ key: 'pace', type: 'pace', q: 'How fast do you want to go?', required: true });
  list.push(
    { key: 'foods_like', type: 'chips', q: 'Which foods do you love?', sub: 'We\'ll build meals around them.', options: K.CHOICES.foods, other: true },
    { key: 'foods_dislike', type: 'chips', q: 'Anything you don\'t eat or dislike?', options: K.CHOICES.foods, other: true, noneLabel: 'Nothing' },
    { key: 'cooking', type: 'choice', q: 'How do you feel about cooking?', options: K.CHOICES.cooking, required: true },
    { key: 'who_cooks', type: 'choice', q: 'Who cooks most meals?', options: K.CHOICES.whoCooks, required: true },
    { key: 'schedule', type: 'chips', q: 'What does a weekday look like?', options: K.CHOICES.schedule, other: true },
    { key: 'bedtime', type: 'time', q: 'What time do you usually go to bed?', sub: 'Kitchen closes 2–3 hours before. A steady bedtime helps everything.', required: true },
    { key: 'worked', type: 'chips', q: 'In past attempts, what worked?', options: K.CHOICES.worked, other: true },
    { key: 'didnt', type: 'chips', q: 'What didn\'t work?', options: K.CHOICES.didnt, other: true },
    { key: 'why', type: 'text', q: 'Why does this matter to you?', sub: 'One sentence. We\'ll show it back to you on hard days. Tap the microphone on your keyboard to talk.', placeholder: 'I want to…' },
    { key: 'meds', type: 'text', q: 'Any medications?', sub: 'Used only to check supplement interactions and for your doctor summary.', placeholder: 'e.g. none, or the names', noneLabel: 'None' },
    { key: 'supplements_start', type: 'chips', q: 'Any supplements you take now?', options: K.CHOICES.supplements.map((id) => [id, supName(id)]), noneLabel: 'None' },
    { key: 'email', type: 'email', q: 'Where should we email your morning plan?', sub: 'One short email a day, never on Shabbat or Yom Tov. You can turn it off any time.' },
    { key: 'done', type: 'done' }
  );
  return list;
}

const DKEY = () => 'op_setup_' + S.meId();
function draft() {
  const d = LS.json(DKEY(), null);
  if (d) return d;
  const p = Object.assign({}, S.profile());
  return Object.assign({ equipment: ['Chair', 'Wall', 'Floor'], parq: [], bedtime: '23:00', email: (S.me() || {}).email || '' }, p, { _i: 0 });
}
function saveDraft(d) { LS.set(DKEY(), JSON.stringify(d)); }

export function render() {
  const d = draft();
  const list = steps();
  const i = Math.min(d._i || 0, list.length - 1);
  const st = list[i];
  const pct = Math.round((i / (list.length - 1)) * 100);
  const top = `<div class="setup-top">${i > 0 ? `<button class="nav-back" type="button" data-act="su-back" aria-label="Back">${chev('left')}<span>Back</span></button>` : (S.setupDone() ? textBtn('Close', 'go', { 'data-to': 'summary' }) : '<span></span>')}
    <div class="setup-prog" role="progressbar" aria-label="Setup progress" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="width:${pct}%"></i></div><span class="caption" style="text-align:right">${i + 1}/${list.length}</span></div>`;
  return `<div class="setup">${top}<div class="setup-body">${body(st, d)}</div></div>`;
}

function nextBtn(label, disabled) { return `<div class="setup-actions">${btn(label || 'Next', 'su-next', { disabled })}</div>`; }
function body(st, d) {
  const v = d[st.key];
  switch (st.type) {
    case 'intro':
      return `<div class="app-mark">${icon('sparkles')}</div><h1>Hi, ${esc(S.me().name)}.</h1><p class="body">Let's build a plan around your real life: kosher, Shabbat, work and family.</p><p class="sub">About 3 minutes. One question at a time. You can change anything later.</p>${nextBtn('Let\'s start')}`;
    case 'number':
      return `<h1>${esc(st.q)}</h1>${st.sub ? `<p class="sub">${esc(st.sub)}</p>` : ''}<label class="field"><input id="su-in" class="big-input" type="number" inputmode="decimal" step="${st.step}" min="${st.min}" max="${st.max}" value="${esc(v == null ? '' : v)}" aria-label="${esc(st.q)}" autofocus><span class="caption" style="display:block;text-align:center;margin-top:6px">${esc(st.unit)}</span></label>
        ${nextBtn()}${!st.required ? `<div class="center">${textBtn('Skip', 'su-skip')}</div>` : ''}`;
    case 'height': {
      const h = +v || 66;
      return `<h1>${esc(st.q)}</h1><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label class="field"><span>Feet</span><select id="su-ft">${[4, 5, 6, 7].map((f) => `<option ${Math.floor(h / 12) === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
        <label class="field"><span>Inches</span><select id="su-inch">${Array.from({ length: 12 }, (_, n) => `<option ${h % 12 === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>${nextBtn()}`;
    }
    case 'choice':
      return `<h1>${esc(st.q)}</h1>${st.sub ? `<p class="sub">${esc(st.sub)}</p>` : ''}<div class="choices">${st.options.map(([k, l]) => `<button class="choice${v === k ? ' on' : ''}" data-act="su-choice" data-v="${esc(k)}">${esc(l)}${v === k ? icon('check') : ''}</button>`).join('')}</div>`;
    case 'yesno': {
      const a = (d.parq || [])[st.idx];
      return `<p class="caption">${esc(st.sub)}</p><h1>${esc(st.q)}</h1><div class="choices">${['no', 'yes'].map((x) => `<button class="choice${a === x ? ' on' : ''}" data-act="su-parq" data-v="${x}">${x === 'yes' ? 'Yes' : 'No'}</button>`).join('')}</div>`;
    }
    case 'parq_result': {
      const preg = ['pregnant', 'nursing', 'postpartum'].indexOf(d.life_stage) >= 0;
      return `<div class="app-mark">${icon('shield')}</div><h1>Check with your doctor before starting</h1>
        <p class="body">${preg ? 'Since you\'re ' + esc({ pregnant: 'pregnant', nursing: 'nursing', postpartum: 'recently postpartum' }[d.life_stage]) + ', please talk to your doctor or midwife before becoming more active.' : 'One or more of your answers means it\'s wise to get your doctor\'s OK first.'}</p>
        <p>Until then, your plan stays gentle: easiest levels, short sessions, walking, and food habits. No weight-loss pace unless your doctor sets one, and no new supplements without them.</p>
        <p class="caption">This screen is based on the PAR-Q+. The full official form is at <a href="${esc(K.PARQ_URL)}" target="_blank" rel="noopener">eparmedx.com</a>.</p>${nextBtn('I understand')}`;
    }
    case 'pace': {
      const w = +d.weight_start || 180;
      const opts = [['0.5', 'Gentle', 0.005], ['0.75', 'Steady (recommended)', 0.0075], ['1', 'Faster', 0.01]].map(([k, l, f]) => [k, l, Math.min(2, Math.round(w * f * 10) / 10)]);
      return `<h1>${esc(st.q)}</h1><p class="sub">Research supports about 0.5–1% of body weight a week — fast enough to see, slow enough to keep.</p>
        <div class="choices">${opts.map(([k, l, lbs]) => `<button class="choice${String(d.pace_pct) === k ? ' on' : ''}" data-act="su-pace" data-v="${k}" data-lbs="${lbs}"><span>${esc(l)}</span><span class="sub">${lbs} lb / week</span></button>`).join('')}</div>`;
    }
    case 'chips': {
      const sel = Array.isArray(v) ? v : [];
      const opts = st.options.map((o) => (Array.isArray(o) ? o : [o, o]));
      const others = sel.filter((x) => !opts.some((o) => o[0] === x) && x !== 'None');
      return `<h1>${esc(st.q)}</h1>${st.sub ? `<p class="sub">${esc(st.sub)}</p>` : ''}
        <div class="multi">${st.noneLabel ? chip(st.noneLabel, 'su-none', sel.length === 1 && sel[0] === 'None', {}) : ''}${opts.map(([k, l]) => chip(l, 'su-chip', sel.indexOf(k) >= 0, { 'data-v': k })).join('')}${others.map((x) => chip(x, 'su-chip', true, { 'data-v': x })).join('')}</div>
        ${st.other ? `<label class="addfield" style="background:var(--card)">${icon('plus')}<input id="su-other" type="text" maxlength="60" placeholder="Something else" aria-label="Something else" enterkeyhint="done" autocapitalize="sentences" data-enter="su-other"><button type="button" class="btn-text small" data-act="su-other">Add</button></label><p class="hint" id="su-other-hint" hidden>Type something first, then tap Add.</p>` : ''}
        ${st.key === 'injuries' ? `<label class="field"><span>Anything we should know? (optional)</span><input id="su-note" type="text" maxlength="200" value="${esc(d.injuries_note || '')}"></label>` : ''}
        ${nextBtn()}`;
    }
    case 'days': {
      const sel = Array.isArray(d.days) ? d.days : [];
      const times = Array.isArray(d.times) ? d.times : [];
      return `<h1>${esc(st.q)}</h1><p class="sub">${esc(st.sub)}</p>
        <div class="multi">${K.CHOICES.days.map(([k, l]) => chip(l, 'su-day', sel.indexOf(k) >= 0, { 'data-v': k })).join('')}</div>
        <p class="h3">Best time</p><div class="multi">${K.CHOICES.times.map((t) => chip(t, 'su-time', times.indexOf(t) >= 0, { 'data-v': t })).join('')}</div>${nextBtn('Next', !sel.length)}`;
    }
    case 'time':
      return `<h1>${esc(st.q)}</h1><p class="sub">${esc(st.sub)}</p><label class="field"><input id="su-in" type="time" value="${esc(v || '23:00')}" aria-label="${esc(st.q)}"></label>${nextBtn()}`;
    case 'text':
      return `<h1>${esc(st.q)}</h1><p class="sub">${esc(st.sub)}</p>${st.noneLabel ? chip(st.noneLabel, 'su-text-none', v === 'None', {}) : ''}<label class="field"><textarea id="su-in" rows="3" maxlength="500" placeholder="${esc(st.placeholder || '')}" aria-label="${esc(st.q)}">${esc(v && v !== 'None' ? v : '')}</textarea></label>${nextBtn()}<div class="center">${textBtn('Skip', 'su-skip')}</div>`;
    case 'email':
      return `<h1>${esc(st.q)}</h1><p class="sub">${esc(st.sub)}</p><label class="field"><input id="su-in" type="email" inputmode="email" autocomplete="email" value="${esc(v || '')}" placeholder="name@example.com" aria-label="Email"></label>${nextBtn()}<div class="center">${textBtn('No emails, thanks', 'su-skip')}</div>`;
    case 'done': {
      const lv = L.startingLevels({ activity: d.activity, safe: isSafeDraft(d), injuries: d.injuries || [] });
      const sched = scheduleFromDays(d.days);
      return `<div class="app-mark">${icon('check')}</div><h1>Your plan is ready</h1>
        <ul class="bullets"><li><b>Your week:</b> ${[0, 1, 2, 3, 4, 5].map((x) => L.WEEKDAYS_SHORT[x] + ' ' + sched[x]).join(' · ')} · Shabbat rest</li>
        <li><b>Week 1 starts gentle:</b> ${L.PATTERNS.map((p) => L.PATTERN_NAMES[p] + ' ' + lv[p]).join(', ')} — one level below what you can do, so you finish feeling good.</li>
        <li><b>Food:</b> seven simple habits. No counting.</li>
        ${isSafeDraft(d) ? '<li><b>Safe mode is on.</b> Check with your doctor before stepping up.</li>' : `<li><b>Pace:</b> about ${esc(d.pace || '')} lb a week, judged by your trend line.</li>`}</ul>
        ${nextBtn('Go to my plan')}`;
    }
    default: return '';
  }
}
function isSafeDraft(d) { return (d.parq || []).some((x) => x === 'yes') || ['pregnant', 'nursing', 'postpartum'].indexOf(d.life_stage) >= 0; }
/** Turn "days I can work out" into a week: strength on up to 3 well-spaced days, walks on the rest, Friday light. */
export function scheduleFromDays(days) {
  const chosen = (days || []).map(Number).filter((x) => x >= 0 && x <= 5).sort();
  const sched = { 0: 'walk', 1: 'walk', 2: 'walk', 3: 'walk', 4: 'walk', 5: 'light', 6: 'rest' };
  const pool = chosen.filter((x) => x !== 5);
  const strength = [];
  pool.forEach((x) => { if (strength.length < 3 && !strength.some((s) => Math.abs(s - x) < 2)) strength.push(x); });
  pool.forEach((x) => { if (strength.length < 2 && strength.indexOf(x) < 0) strength.push(x); });
  if (!strength.length) [0, 2, 4].forEach((x) => strength.push(x));
  strength.forEach((x) => { sched[x] = 'strength'; });
  return sched;
}

function advance(d) { d._i = (d._i || 0) + 1; saveDraft(d); rerender(); window.scrollTo(0, 0); }
function current() { const d = draft(); const list = steps(); return { d, st: list[Math.min(d._i || 0, list.length - 1)] }; }

export const actions = {
  'su-back'() { const d = draft(); d._i = Math.max(0, (d._i || 0) - 1); saveDraft(d); rerender(); },
  'su-skip'() { const { d, st } = current(); if (st.type === 'email') d.email = ''; else if (!d[st.key]) d[st.key] = st.type === 'chips' ? [] : ''; advance(d); },
  'su-choice'(el) { const { d, st } = current(); d[st.key] = el.dataset.v; saveDraft(d); setTimeout(() => advance(draft()), 120); rerender(); },
  'su-parq'(el) { const { d, st } = current(); d.parq = (d.parq || []).slice(); d.parq[st.idx] = el.dataset.v; saveDraft(d); setTimeout(() => advance(draft()), 120); rerender(); },
  'su-pace'(el) { const { d } = current(); d.pace = +el.dataset.lbs; d.pace_pct = el.dataset.v; saveDraft(d); setTimeout(() => advance(draft()), 120); rerender(); },
  'su-chip'(el) {
    const { d, st } = current();
    const sel = (Array.isArray(d[st.key]) ? d[st.key] : []).filter((x) => x !== 'None');
    const v = el.dataset.v;
    d[st.key] = sel.indexOf(v) >= 0 ? sel.filter((x) => x !== v) : sel.concat(v);
    saveDraft(d); rerender();
  },
  'su-none'() { const { d, st } = current(); d[st.key] = ['None']; saveDraft(d); rerender(); },
  /** A4: adds with text (button or Return), clears the box, ignores duplicates, hints when empty. */
  'su-other'() {
    const inp = document.getElementById('su-other');
    const hint = document.getElementById('su-other-hint');
    const raw = (inp && inp.value || '').replace(/\s+/g, ' ').trim();
    if (!raw) { if (hint) hint.hidden = false; if (inp) inp.focus(); return; }
    const v = raw.charAt(0).toUpperCase() + raw.slice(1);
    const { d, st } = current();
    const list = (Array.isArray(d[st.key]) ? d[st.key] : []).filter((x) => x !== 'None');
    inp.value = ''; // clear before redrawing, so the typed text doesn't come back
    if (list.some((x) => String(x).toLowerCase() === v.toLowerCase())) { toast('Already added.'); return; }
    d[st.key] = list.concat(v);
    saveDraft(d); rerender();
    toast('Added: ' + v, { icon: 'check', ms: 1400 });
    setTimeout(() => { const i = document.getElementById('su-other'); if (i) i.focus(); }, 30);
  },
  'su-day'(el) { const { d } = current(); const s = Array.isArray(d.days) ? d.days : []; d.days = s.indexOf(el.dataset.v) >= 0 ? s.filter((x) => x !== el.dataset.v) : s.concat(el.dataset.v); saveDraft(d); rerender(); },
  'su-time'(el) { const { d } = current(); const s = Array.isArray(d.times) ? d.times : []; d.times = s.indexOf(el.dataset.v) >= 0 ? s.filter((x) => x !== el.dataset.v) : s.concat(el.dataset.v); saveDraft(d); rerender(); },
  'su-text-none'() { const { d, st } = current(); d[st.key] = 'None'; advance(d); },
  'su-next'() {
    const { d, st } = current();
    const inp = document.getElementById('su-in');
    if (st.type === 'number') {
      const raw = inp.value.trim();
      if (!raw) { if (st.required) { toast('Enter a number to continue.', { kind: 'err' }); return; } d[st.key] = ''; }
      else {
        const n = +raw;
        if (!L.validNumber('lbs', n)) { toast('That number doesn\'t look right.', { kind: 'err' }); return; }
        d[st.key] = Math.round(n * 10) / 10;
      }
    }
    if (st.type === 'height') d.height_in = (+document.getElementById('su-ft').value) * 12 + (+document.getElementById('su-inch').value);
    if (st.type === 'time') d[st.key] = inp.value || '23:00';
    if (st.type === 'text') d[st.key] = inp.value.trim() || d[st.key] || '';
    if (st.type === 'email') {
      const e = inp.value.trim();
      if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { toast('That email doesn\'t look right.', { kind: 'err' }); return; }
      d.email = e;
    }
    if (st.key === 'injuries') { const n = document.getElementById('su-note'); if (n) d.injuries_note = n.value.trim(); }
    if (st.type === 'done') return finish(d);
    advance(d);
  }
};

function finish(d) {
  const values = {};
  ['weight_start', 'height_in', 'goal_weight', 'goal_nonscale', 'pace', 'activity', 'days', 'times', 'minutes_available', 'equipment', 'injuries', 'injuries_note', 'life_stage',
    'foods_like', 'foods_dislike', 'cooking', 'who_cooks', 'schedule', 'bedtime', 'worked', 'didnt', 'why', 'meds', 'supplements_start'].forEach((k) => { if (d[k] !== undefined) values[k] = d[k]; });
  ['goal_nonscale', 'injuries', 'foods_dislike', 'supplements_start', 'equipment'].forEach((k) => { if (Array.isArray(values[k])) values[k] = values[k].filter((x) => x !== 'None'); });
  if (values.meds === 'None') values.meds = '';
  values.parq = (d.parq || []).map((x) => x === 'yes');
  values.minutes_available = +values.minutes_available || 20;
  const first = !S.setupDone();
  S.write('saveProfile', { values, done: true, email: d.email || '' });
  const settings = { schedule: scheduleFromDays(d.days), email_morning: !!d.email };
  S.write('settings', { values: settings });
  // The server records the first weigh-in and the supplement list on first setup; show them right away.
  if (first && S.data) {
    const me = S.meId();
    const lg = S.data.logs[me];
    if (values.weight_start && lg && !lg.weights.some((w) => w.date === S.today())) lg.weights.push({ id: 'tmp_setup_w', ts: new Date().toISOString(), date: S.today(), lbs: values.weight_start, pending: true });
    const list = S.data.supplements[me] = S.data.supplements[me] || [];
    (values.supplements_start || []).forEach((id) => { if (!list.some((s) => s.suppId === id)) list.push({ id: 'tmp_' + id, suppId: id, name: supName(id), status: 'active', timing: (K.SUPPLEMENTS.find((s) => s.id === id) || {}).timingShort || '', pending: true }); });
    S.persist();
  }
  LS.del(DKEY());
  toast('Your plan is ready.', { icon: 'sparkles' });
  go('summary', { replace: true });
  setTimeout(() => S.sync(), 5000);
}
