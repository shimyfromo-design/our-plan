/* You (D12): the sheet behind your initial, and its pages — Settings, the partner's settings, Modes, iPhone Health,
 * Backups & your data, iPhone check, About & sources, and "Something's off". */
import { L, K, esc, icon, toast, openSheet, updateSheet, closeSheet, copyText, longDate, shortDate, resizeImage, busy, clock, timeAgo } from '../core.js?v=c1a0501fca';
import { S } from '../store.js?v=5199216217';
import { call, Config } from '../api.js?v=d44773a102';
import { go, rerender, route } from '../nav.js?v=57c55c9996';
import { nav, pageTitle, card, listCard, row, primary, textBtn, seg, empty, initialOf, sectionTitle, bar } from '../ui.js?v=b5958020ce';
import * as Voice from '../voice.js?v=decfa3dab7';
import * as PushClient from '../push.js?v=cfef6cc387';
import * as Mic from '../mic.js?v=99eadb1765';

const DAYS6 = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const MODE_LABEL = { sick: 'Sick', travel: 'Travel', busy: 'Busy week', maintenance: 'Maintenance', welcomeback: 'Welcome back' };
const MODE_SHORT = { sick: 'Workouts pause, streak safe', travel: '10-minute hotel-room workouts', busy: '10-minute versions', maintenance: 'Keep-it-off habits', welcomeback: 'Restart one level down' };
export const modeLabel = (k) => MODE_LABEL[k] || k;

export function render(r) {
  const p = r.parts[1];
  if (p === 'settings') return settingsPage();
  if (p === 'partner') return partnerPage();
  if (p === 'modes') return modesPage();
  if (p === 'health') return healthPage();
  if (p === 'backups') return backupsPage();
  if (p === 'check') return checkPage();
  if (p === 'about') return aboutPage();
  return '';
}
const back = (title) => nav({ back: 'Back', backTo: 'me', title });

// ------------------------------------------------------------------ the You sheet (D12)
export function openYou(onClose) {
  const me = S.me();
  const p = S.partner();
  const owner = S.isOwner();
  const mode = S.mode(S.meId());
  const health = S.logs(S.meId()).steps.some((x) => x.source === 'health' && x.date >= L.addDays(S.today(), -3));
  const chk = S.ui.phoneCheck;
  const chkValue = chk ? (chk.problems ? chk.problems + (chk.problems === 1 ? ' problem' : ' problems') : 'All good') : 'Not run yet';
  const sub = owner ? 'Owner' + (p ? ' · sharing with ' + p.name : '') : (p ? 'Sharing with ' + S.ownerName() : '');
  openSheet({ title: '', label: 'You', onClose, body: `<div class="you-top"><span class="initial big" aria-hidden="true">${esc(initialOf(me.name))}</span><h3>${esc(me.name)}</h3><p class="sub">${esc(sub)}</p></div>
    <div class="inset">${row({ icon: 'sliders-horizontal', label: 'Settings', value: owner && p ? 'You and ' + p.name : '', act: 'go', data: { 'data-to': 'me/settings' } })}${row({ icon: 'shield', label: 'Modes', value: mode ? modeLabel(mode.key) : 'Normal', act: 'go', data: { 'data-to': 'me/modes' } })}</div>
    <div class="inset">${row({ icon: 'heart', label: 'iPhone Health', value: health ? 'Steps on' : 'Off', act: 'go', data: { 'data-to': 'me/health' } })}${row({ icon: 'download', label: 'Backups & your data', value: 'Sunday', act: 'go', data: { 'data-to': 'me/backups' } })}</div>
    <div class="inset">${row({ icon: 'smartphone', label: 'iPhone check', value: chkValue, act: 'go', data: { 'data-to': 'me/check' } })}${row({ icon: 'flag', label: 'Something\'s off', act: 'off-sheet' })}${row({ icon: 'info', label: 'About & sources', value: 'Round 3.2', act: 'go', data: { 'data-to': 'me/about' } })}</div>
    <p class="caption center">Coach, voice and the monthly budget are set once for both of you.</p>` });
}

// ------------------------------------------------------------------ Settings
const NOTIFY_LABELS = {
  morning: ['Morning plan', 'Today in three lines'],
  workout: ['Workout', 'If not logged yet'],
  weighin: ['Weigh-in', 'On weigh-in days'],
  preshabbat: ['Before Shabbat', 'Before candles'],
  motzei: ['Motzei Shabbat', 'The catch-up'],
  cheer: ['Cheers', 'Held over Shabbat'],
  missyou: ['"We miss you"', 'After two quiet days'],
  weekly: ['Weekly review', 'Sunday morning'],
  couple: ['Couple check-in', 'With the Sunday recap'],
  grocery: ['Grocery list', 'Evening before shopping']
};
const FEATURE_LABELS = { chat: 'Coach chat', voice: 'Voice', listen: 'Listening', labs: 'Blood tests', plate: 'Plate tips', pantry: 'What can I make?', photo: 'Photos', morning: 'Morning messages', weekly: 'Weekly review', mealplan: 'Meal plans', research: 'Monthly research', recap: 'Sunday recap', notes: 'Coach memory', couple: 'Couple check-in' };
const sw = (key, on, extra = '') => `<input type="checkbox" class="switch" data-change="setting" data-key="${esc(key)}" ${on ? 'checked' : ''} ${extra} aria-label="${esc(key)}">`;
/** A settings row whose whole width toggles its switch (a <label>, as on iOS). */
function swRow(label, sub, key, on, forUser) {
  return `<label class="row no-ic"><span class="row-main"><span class="row-label">${esc(label)}</span>${sub ? `<span class="row-sub">${esc(sub)}</span>` : ''}</span>${sw(key, on, forUser ? `data-for="${esc(forUser)}"` : '').replace(`aria-label="${esc(key)}"`, `aria-label="${esc(label)}"`)}</label>`;
}

function householdCard() {
  const h = S.household();
  const owner = S.isOwner();
  const usage = S.data.usage || {};
  const budget = +h.budget_usd || 15, cost = +usage.cost || 0;
  const voices = h.voices && h.voices.length ? h.voices : [{ id: 'marin', label: 'Marin', desc: 'Warm and clear' }];
  const setBy = owner ? '' : `<p class="note" style="margin:0 4px 8px">${icon('lock')}<span>Set by ${esc(S.ownerName())}</span></p>`;
  const voiceRows = voices.map((v) => row({ label: v.label + (h.voice === v.id ? ' · chosen' : ''), sub: v.desc, right: owner ? `<span style="display:flex;gap:2px">${textBtn('Preview', 'voice-preview', { 'data-v': v.id }, { cls: 'small' })}${h.voice === v.id ? '' : textBtn('Use', 'set-voice', { 'data-v': v.id }, { cls: 'small' })}</span>` : '', cls: 'no-ic' }));
  const by = Object.keys(usage.byJob || {}).sort((a, b) => usage.byJob[b] - usage.byJob[a]);
  return `<div>${sectionTitle('For both of you')}${setBy}
    ${listCard([
      row({ label: 'Coach brain', sub: 'Premium costs more', right: owner ? `<div style="width:170px">${seg([['standard', 'Standard'], ['premium', 'Premium']], h.coach_tier || 'standard', 'set-tier', { label: 'Coach brain' })}</div>` : `<span class="row-value">${h.coach_tier === 'premium' ? 'Premium' : 'Standard'}</span>`, cls: 'no-ic' }),
      owner ? swRow('Natural voice', h.voice_on !== false ? 'An AI voice by OpenAI' : 'Off: only workout cues speak', 'voice_on', h.voice_on !== false) : row({ label: 'Natural voice', value: h.voice_on !== false ? 'On' : 'Off', cls: 'no-ic' })
    ], 'no-ic')}
    <div style="margin-top:12px">${listCard(voiceRows, 'no-ic')}</div>
    <div style="margin-top:12px">${listCard([
      row({ label: 'Monthly budget', sub: '$' + cost.toFixed(2) + ' of $' + budget.toFixed(2) + ' this month', value: owner ? 'Change' : '', act: owner ? 'budget-sheet' : '', cls: 'no-ic' }),
      `<div class="row static no-ic nosep" style="min-height:0;padding-top:0;padding-bottom:14px">${bar(Math.min(1, cost / budget), cost / budget >= 0.8 ? 'problem' : 'accent')}</div>`,
      ...(owner ? by.map((k) => row({ label: FEATURE_LABELS[k] || k, value: '$' + (+usage.byJob[k]).toFixed(2), cls: 'no-ic' })) : [])
    ], 'no-ic')}</div>
    <div style="margin-top:12px">${listCard([
      row({ label: 'Shopping day', right: owner ? `<select class="time-in" data-change="household-num" data-key="shopping_day" aria-label="Shopping day">${DAYS6.map((d, i) => `<option value="${i}" ${+h.shopping_day === i ? 'selected' : ''}>${d}</option>`).join('')}</select>` : `<span class="row-value">${esc(DAYS6[+h.shopping_day] || 'Thursday')}</span>`, cls: 'no-ic' }),
      row({ label: 'Grocery reminder', sub: 'Evening before', right: owner ? `<input type="time" class="time-in" value="${esc(h.grocery_time || '19:00')}" data-change="household-val" data-key="grocery_time" aria-label="Grocery reminder time">` : `<span class="row-value">${esc(L.fmt12(h.grocery_time || '19:00'))}</span>`, cls: 'no-ic' }),
      owner ? row({ label: 'App version', sub: h.app_pointer === 'previous' ? 'Using the previous version' : 'Using the newest version · ' + esc(window.OUR_PLAN_VERSION || ''), value: h.app_pointer === 'previous' ? 'Switch back' : 'Go back', act: h.app_pointer === 'previous' ? 'pointer-current' : 'pointer-sheet', cls: 'no-ic' }) : ''
    ], 'no-ic')}</div></div>`;
}
function notifyBlock(target, forUser) {
  const s = target.settings || {};
  const n = s.notify || {};
  const st = PushClient.status();
  const on = (t) => !n[t] || n[t].on !== false;
  const timeOf = (t) => (n[t] && n[t].time) || (t === 'workout' ? L.workoutReminderTime((S.profile(target.id) || {}).times) : '');
  const fa = forUser ? ` data-for="${esc(forUser)}"` : '';
  const rows = Object.keys(NOTIFY_LABELS).map((t) => {
    const [label, sub] = NOTIFY_LABELS[t];
    let extra = '';
    if (t === 'morning') extra = `<input type="time" class="time-in" value="${esc(s.morning_time || '07:00')}" data-change="setting-val" data-key="morning_time"${fa} aria-label="Morning plan time">`;
    else if (t === 'workout' || t === 'weighin' || t === 'missyou') extra = `<input type="time" class="time-in" value="${esc(timeOf(t))}" data-change="notify-time" data-t="${t}"${fa} aria-label="${esc(label)} time">`;
    else if (t === 'preshabbat') extra = `<select class="time-in" data-change="setting-val" data-key="friday_lead_min" data-num="1"${fa} aria-label="How long before candle lighting">${[30, 60, 90, 120].map((m) => `<option value="${m}" ${+(s.friday_lead_min || 90) === m ? 'selected' : ''}>${m} min</option>`).join('')}</select>`;
    const sid = 'nt-' + t + (forUser ? '-p' : '');
    return `<div class="row no-ic"><label class="row-main" style="cursor:pointer;min-height:44px;justify-content:center" for="${sid}"><span class="row-label">${esc(label)}</span><span class="row-sub">${esc(sub)}</span></label><span style="display:flex;align-items:center;gap:8px">${extra}<input type="checkbox" class="switch" id="${sid}" data-change="notify" data-t="${t}"${fa} ${on(t) ? 'checked' : ''} aria-label="${esc(label)}"></span></div>`;
  });
  const device = forUser ? '' : (st === 'on' ? `<p class="sub" style="margin:0 4px 8px">${icon('check', 'ic-xs')} On for this phone. ${textBtn('Send a test', 'notify-test', {}, { cls: 'small' })}${textBtn('Turn off', 'notify-off', {}, { cls: 'small' })}</p>`
    : st === 'needs-install' ? `<p class="note" style="margin:0 4px 8px">${icon('info')}<span>Open Our Plan from its Home Screen icon to turn these on.</span></p>`
    : st === 'denied' ? `<p class="note" style="margin:0 4px 8px">${icon('info')}<span>Blocked. iPhone Settings → Notifications → Our Plan → Allow Notifications.</span></p>`
    : st === 'unsupported' ? '<p class="sub" style="margin:0 4px 8px">This browser can\'t show notifications. Emails still work.</p>'
    : `<div style="margin:0 0 12px">${primary('Turn on notifications', 'notify-on', {}, { icon: 'bell' })}</div>`);
  return `<div>${sectionTitle('Notifications')}${device}${listCard(rows, 'no-ic')}<p class="caption" style="margin:8px 4px 0">Never during Shabbat or Yom Tov.</p></div>`;
}
function emailBlock(target, forUser) {
  const s = target.settings || {};
  const p = forUser ? S.me() : S.partner();
  return `<div>${sectionTitle('Emails')}${listCard([
    swRow('Morning plan', '', 'email_morning', s.email_morning !== false, forUser),
    swRow('Before Shabbat', (s.friday_lead_min || 90) + ' minutes before candle lighting', 'email_friday', s.email_friday !== false, forUser),
    swRow('Weekly review', 'Sunday', 'email_weekly', s.email_weekly !== false, forUser),
    swRow('Couple check-in and recap', '', 'email_couple', s.email_couple !== false, forUser),
    row({ label: 'Couple check-in on', right: `<select class="time-in" data-change="setting-val" data-key="couple_time" ${forUser ? `data-for="${esc(forUser)}"` : ''} aria-label="Couple check-in on"><option value="motzei" ${s.couple_time !== 'sunday' ? 'selected' : ''}>Motzei Shabbat</option><option value="sunday" ${s.couple_time === 'sunday' ? 'selected' : ''}>Sunday evening</option></select>`, cls: 'no-ic' }),
    swRow('When ' + (p ? p.name : 'my partner') + ' sends a cheer', '', 'email_cheers', !!s.email_cheers, forUser),
    swRow('Monthly research check', '', 'email_research', s.email_research !== false, forUser)
  ], 'no-ic')}</div>`;
}
function weekBlock(target, forUser) {
  const s = target.settings || {};
  const sched = s.schedule || L.DEFAULT_SCHEDULE;
  const fa = forUser ? ` data-for="${esc(forUser)}"` : '';
  return `<div>${sectionTitle(forUser ? target.name + '\'s week' : 'My week')}${listCard([0, 1, 2, 3, 4, 5].map((d) => row({ label: DAYS6[d], right: `<select class="time-in" data-change="sched" data-d="${d}"${fa} aria-label="${DAYS6[d]}">${['strength', 'walk', 'light', 'rest'].map((t) => `<option value="${t}" ${sched[d] === t ? 'selected' : ''}>${t[0].toUpperCase() + t.slice(1)}</option>`).join('')}</select>`, cls: 'no-ic' }))
    .concat([row({ label: 'Shabbat', value: 'Rest', cls: 'no-ic' }),
      row({ label: 'Weigh-ins', right: `<select class="time-in" data-change="setting-val" data-key="weigh_mode"${fa} aria-label="Weigh-ins"><option value="daily" ${s.weigh_mode !== 'weekly' ? 'selected' : ''}>Daily</option><option value="weekly" ${s.weigh_mode === 'weekly' ? 'selected' : ''}>Weekly</option></select>`, cls: 'no-ic' }),
      s.weigh_mode === 'weekly' ? row({ label: 'Weigh-in day', right: `<select class="time-in" data-change="setting-val" data-key="weigh_day" data-num="1"${fa} aria-label="Weigh-in day">${DAYS6.map((d, i) => `<option value="${i}" ${+s.weigh_day === i ? 'selected' : ''}>${d}</option>`).join('')}</select>`, cls: 'no-ic' }) : '',
      row({ label: 'Workout length', right: `<select class="time-in" data-change="setting-val" data-key="version_pref" data-num="1"${fa} aria-label="Workout length"><option value="" ${!s.version_pref ? 'selected' : ''}>Coach picks</option>${[10, 20, 30].map((m) => `<option value="${m}" ${+s.version_pref === m ? 'selected' : ''}>${m} min</option>`).join('')}</select>`, cls: 'no-ic' })]), 'no-ic')}</div>`;
}
function settingsPage() {
  const s = S.settings();
  const p = S.partner();
  const owner = S.isOwner();
  return back('Settings') + pageTitle('Settings') + `<div class="stack">
    ${householdCard()}
    ${owner && p ? listCard([row({ icon: 'user', label: p.name + '\'s settings', sub: 'Notifications, emails and week', act: 'go', data: { 'data-to': 'me/partner' } })]) : ''}
    ${notifyBlock(S.me(), null)}
    <div>${sectionTitle('Sharing')}${listCard([swRow('Share everything with ' + (p ? p.name : 'my partner'), 'Only you can change this', 'share', s.share !== false)], 'no-ic')}</div>
    ${emailBlock(S.me(), null)}
    ${weekBlock(S.me(), null)}
    <div>${sectionTitle('App')}${listCard([swRow('Daily chizuk line', 'On guarding your health', 'chizuk', !!s.chizuk),
      row({ label: 'Look', right: `<div style="width:190px">${seg([['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], S.ui.theme || s.theme || 'auto', 'set-theme', { label: 'Look' })}</div>`, cls: 'no-ic' })], 'no-ic')}</div>
    <div>${sectionTitle('Profile')}${listCard([row({ label: 'Redo my setup questions', sub: 'Weight, goals, food, health', act: 'go', data: { 'data-to': 'setup' } }), row({ label: 'Medications', sub: esc(S.profile().meds || 'None listed'), act: 'meds-sheet' })], 'no-ic')}</div>
    <div>${sectionTitle('Privacy')}${listCard([row({ label: 'Copy my private link', act: 'copy-link' }), row({ label: 'Make a new link', sub: 'The old one stops working', act: 'rotate' }),
      owner && p ? row({ label: 'Show ' + p.name + '\'s link', act: 'partner-link' }) : '', owner ? row({ label: 'Add a person', act: 'add-person' }) : '', row({ label: 'Forget me on this phone', act: 'forget' })], 'no-ic')}</div></div>`;
}
/** The owner sees and changes the partner's settings — except her sharing switch (C6). */
function partnerPage() {
  const p = S.partner();
  if (!S.isOwner() || !p) return back('Settings') + empty('lock', 'Nothing here', 'Only the owner can change someone else\'s settings.');
  const full = Object.assign({}, p, { settings: p.settings || {} });
  return nav({ back: 'Settings', backTo: 'me/settings', title: p.name }) + pageTitle(p.name + '\'s settings', `Sharing is ${full.settings.share !== false ? 'on' : 'off'}. Only ${esc(p.name)} can change it.`)
    + `<div class="stack">${notifyBlock(full, p.id)}${emailBlock(full, p.id)}${weekBlock(full, p.id)}<div>${sectionTitle('App')}${listCard([swRow('Daily chizuk line', '', 'chizuk', !!full.settings.chizuk, p.id)], 'no-ic')}</div></div>`;
}

// ------------------------------------------------------------------ Modes
function modesPage() {
  const cur = S.mode(S.meId());
  const on = (k) => (cur ? cur.key === k : k === 'none');
  const tick = `<span class="row-value t-accent">${icon('check', 'ic-s')}</span>`;
  return back('Modes') + pageTitle('Modes', cur && cur.until ? esc(modeLabel(cur.key)) + ' until ' + esc(shortDate(cur.until)) + ', then back to normal.' : 'One tap. Each one turns itself off.') + `<div class="stack">
    ${listCard([row({ label: 'Normal', sub: 'Your usual plan', right: on('none') ? tick : '', act: on('none') ? '' : 'mode-sheet', data: { 'data-m': 'none' }, noChev: true })].concat(K.MODES.map((m) => row({ label: m.label, sub: MODE_SHORT[m.key] || m.desc, right: on(m.key) ? tick : '', act: 'mode-sheet', data: { 'data-m': m.key }, noChev: true }))), 'no-ic')}</div>`;
}

// ------------------------------------------------------------------ iPhone Health (E9): a daily automation that runs on its own
function healthLink() { return Config.apiUrl() + '?action=health&t=' + encodeURIComponent(Config.token); }
function healthPage() {
  const lg = S.logs(S.meId());
  const last = lg.steps.filter((x) => x.source === 'health').pop();
  const status = last ? (+last.steps).toLocaleString() + ' steps · as of ' + clock(last.ts) + (last.date !== S.today() ? ' on ' + shortDate(last.date) : '') : 'Nothing imported yet';
  return back('iPhone Health') + pageTitle('iPhone Health', 'Steps arrive by themselves every evening.') + `<div class="stack">
    ${listCard([row({ icon: 'footprints', c: 'activity', label: 'Last import', sub: esc(status) })])}
    ${primary('Copy my Health link', 'copy-health', {}, { icon: 'copy' })}
    ${listCard([
      row({ icon: 'smartphone', label: '1 · Make the Shortcut', sub: 'Steps today → your Health link', act: 'health-steps', data: { 'data-k': 'shortcut' } }),
      row({ icon: 'calendar-check', label: '2 · Make it run by itself', sub: 'Time of Day · 9:45 PM · Daily', act: 'health-steps', data: { 'data-k': 'auto' } }),
      row({ icon: 'info', label: 'Optional · when you open Our Plan', sub: 'App → Our Plan → Is Opened', act: 'health-steps', data: { 'data-k': 'open' } })
    ])}
    <p class="caption" style="padding:0 4px">Your Health link is private, like your personal link.</p></div>`;
}
const HEALTH_STEPS = {
  shortcut: ['Make the Shortcut', [
    'Open the <b>Shortcuts</b> app. On the <b>Shortcuts</b> tab, tap <b>+</b>. Name it <b>Our Plan Steps</b>.',
    'Tap <b>Add Action</b>, search <b>Find Health Samples</b>, add it. Set <b>Type</b> to <b>Steps</b> and <b>Start Date</b> to <b>is today</b>.',
    'Add <b>Calculate Statistics</b>. Set it to <b>Sum</b>.',
    'Add <b>Text</b>.',
    'In the Text box, paste your Health link. Right after it, type <b>&amp;steps=</b> and tap <b>Statistics</b> in the bar above the keyboard.',
    'Add <b>Get Contents of URL</b>. It uses the Text automatically.',
    'Tap <b>▶</b> to test. Allow Health access if asked. You should see "Thanks. Logged … steps."'], ''],
  auto: ['Make it run by itself', [
    'In Shortcuts, tap the <b>Automation</b> tab, then <b>+</b>.',
    'Choose <b>Time of Day</b>. Set <b>9:45 PM</b> and <b>Daily</b>.',
    'Choose <b>Run Immediately</b>, and make sure <b>Ask Before Running</b> is off. Tap <b>Next</b>.',
    'Pick <b>Our Plan Steps</b>. Tap <b>Done</b>.'], 'Our Plan keeps the latest number for each day, so running it more than once is fine. iPhones lock Health data while the phone is locked; if 9:45 pm finds it locked, the next run catches up.'],
  open: ['When you open Our Plan', [
    'If the Shortcuts app lists <b>Our Plan</b> under <b>App</b> when you make a new automation, you can add a second one: <b>App</b> → <b>Our Plan</b> → <b>Is Opened</b> → <b>Run Immediately</b> → <b>Our Plan Steps</b>.'], 'Optional. The 9:45 pm automation is enough on its own.']
};

// ------------------------------------------------------------------ Backups & your data
const bk = { list: null, busy: false, error: '' };
function backupsPage() {
  if (bk.list === null && !bk.busy) loadBackups();
  return back('Backups & your data') + pageTitle('Backups & your data', 'Every Sunday, to Google Drive. The newest 12 are kept.') + `<div class="stack">
    ${bk.busy ? '<div class="sk card short" aria-busy="true"></div>' : (bk.list && bk.list.length ? listCard(bk.list.slice().reverse().map((b) => row({ icon: 'download', label: String(b.name).replace(/\d{4}-\d{2}-\d{2}/, (d) => shortDate(d)) }))) : card('<p class="sub">The first backup runs this Sunday.</p>'))}
    ${bk.error ? `<p class="note bad">${icon('circle-alert')}<span>${esc(bk.error)}</span></p>` : ''}
    ${primary('Export all my data', 'export-data', {}, { icon: 'download' })}
    <div class="center">${S.isOwner() ? textBtn('Back up now', 'backup-now') : ''}${textBtn('Export the wish list', 'wish-export')}</div>
    <p class="caption center">The export is a ZIP with every tab as a spreadsheet file, plus your doctor summary.</p></div>`;
}
async function loadBackups() {
  bk.busy = true; bk.error = '';
  try { bk.list = await call('backups'); } catch (e) { bk.error = e.message; bk.list = []; }
  bk.busy = false; rerender();
}

// ------------------------------------------------------------------ iPhone check (E11): real tests on this phone
// Round 3.2 (A6): Voice is three real tests — a short line, a long paragraph (seconds to first sound), and a line started by
// a 3-second timer like a workout cue. C2: a failed Notifications row has a Turn on button right there.
const CHECKS = [['notify', 'Notifications', 'bell'], ['mic', 'Microphone', 'mic'], ['voice', 'Voice · short line', 'volume-2'], ['voice-long', 'Voice · long paragraph', 'volume-2'], ['voice-timer', 'Voice · cue after a timer', 'timer'], ['health', 'Health link', 'heart']];
const chk = { running: '', results: {} };
function checkPage() {
  const res = Object.assign({}, (S.ui.phoneCheck && S.ui.phoneCheck.results) || {}, chk.results);
  const bad = CHECKS.filter(([k]) => res[k] && !res[k].ok).length;
  const ran = CHECKS.filter(([k]) => res[k]).length;
  const summary = !ran ? 'Not run yet' : (bad ? bad + (bad === 1 ? ' problem' : ' problems') : (ran === CHECKS.length ? 'All good' : 'So far so good'));
  const pushOff = PushClient.status() === 'off'; // "Turn on" only where it can work (installed app, not blocked)
  return back('iPhone check') + pageTitle('iPhone check', esc(summary)) + `<div class="stack">
    ${listCard(CHECKS.map(([k, label, ic]) => {
      const r = res[k];
      let state = chk.running === k ? '<span class="state"><span class="spin" aria-hidden="true"></span>Checking</span>' : (r ? `<span class="state ${r.ok ? 'pass' : 'fail'}">${icon(r.ok ? 'check' : 'circle-alert')}${r.ok ? 'Pass' : 'Fail'}</span>` : '<span class="row-value">Tap to test</span>');
      // C2: notifications that aren't on: the whole row is a Turn on button (the permission question comes from this tap)
      const turnOn = k === 'notify' && pushOff && chk.running !== k && (!r || !r.ok);
      if (turnOn) state = '<span class="row-value turn-on">Turn on</span>';
      return row({ icon: ic, label, sub: r ? esc(r.detail) : '', right: state, act: turnOn ? 'notify-turn-on' : 'check-run', data: { 'data-k': k }, cls: 'check-row', aria: turnOn ? 'Turn on notifications' : label + ' test' });
    }))}
    ${primary(ran ? 'Run all again' : 'Run all', 'check-all')}
    <div class="center">${textBtn('Something\'s off', 'off-sheet', {}, { icon: 'flag' })}</div>
    <p class="caption center">Each test runs for real on this phone. Problems go to the owner's nightly report with the exact error.</p></div>`;
}
function saveCheck(k, ok, detail) {
  chk.results[k] = { ok, detail, at: Date.now() };
  const all = Object.assign({}, (S.ui.phoneCheck && S.ui.phoneCheck.results) || {}, chk.results);
  S.setUi('phoneCheck', { results: all, problems: Object.values(all).filter((r) => !r.ok).length, at: Date.now() });
  call('phoneCheck', { check: k, ok, detail: String(detail).slice(0, 300), device: PushClient.isIOS() ? (PushClient.standalone() ? 'iPhone app' : 'iPhone Safari') : 'browser', version: window.OUR_PLAN_VERSION || '' }).catch(() => {});
}
async function runCheck(k) {
  chk.running = k; rerender();
  try {
    if (k === 'notify') {
      const st = PushClient.status();
      if (st !== 'on') saveCheck(k, false, { off: 'Not turned on for this phone.', denied: 'Blocked in iPhone Settings.', 'needs-install': 'Open Our Plan from the Home Screen icon.', unsupported: 'This browser can\'t show notifications.' }[st] || st);
      else {
        const nonce = 'c' + Date.now().toString(36);
        const got = PushClient.waitFor(nonce, 30000);
        const r = await call('pushSelfTest', { nonce }, { timeout: 30000 });
        if (!r.sent) saveCheck(k, false, r.error || 'Nothing was sent.');
        else saveCheck(k, await got, (await got) ? 'A test notification arrived.' : 'Sent, but it didn\'t arrive within 30 seconds.');
      }
    } else if (k === 'mic') {
      const started = Mic.start({ maxMs: 2500, bar: true, label: 'Testing the microphone' }); // inside the tap
      await started;
      await new Promise((res) => setTimeout(res, 2000));
      const rec = await Mic.stop();
      const text = await Mic.transcribe(rec, { allowSilence: true });
      saveCheck(k, true, text ? 'Heard: "' + text.slice(0, 60) + '"' : 'Recorded 2 seconds and sent them. Nothing was said.');
    } else if (k === 'voice' || k === 'voice-long' || k === 'voice-timer') {
      const r = await (k === 'voice' ? Voice.testShort() : k === 'voice-long' ? Voice.testLong() : Voice.testTimer(3000));
      saveCheck(k, r.ok, r.detail);
    } else if (k === 'health') {
      const r = await fetch(healthLink() + '&check=1', { credentials: 'omit' }).then((x) => x.json());
      saveCheck(k, !!(r && r.ok), r && r.ok ? 'The link opens your own data.' : ((r && r.error && r.error.message) || 'The link didn\'t answer.'));
    }
  } catch (e) {
    saveCheck(k, false, ((e && e.name && e.name !== 'Error') ? e.name + ': ' : '') + ((e && e.message) || String(e)));
  }
  chk.running = ''; rerender();
}

// ------------------------------------------------------------------ About & sources
function aboutPage() {
  return back('About & sources') + pageTitle('About & sources', 'Round 3.2 · version ' + esc(window.OUR_PLAN_VERSION || '')) + `<div class="stack">
    <div class="app-mark about-mark"><img src="icons/icon-512-v32.png" alt="Our Plan icon"></div>
    ${card(`<p class="body">A private plan for two: habits instead of counting, strength and walking that fit real life, Shabbat and Yom Tov built in, and one coach who knows you both.</p><p class="sub" style="margin-top:8px">Not medical advice. If something hurts, or you feel chest pain, dizziness or shortness of breath, stop and call your doctor.</p>`)}
    <div>${sectionTitle('Privacy')}${listCard(['Your data lives in one Google Sheet in the owner\'s Google account. Photos stay in the owner\'s Google Drive.', 'No ads, analytics or trackers. The only outside services are Google, OpenAI (for the coach), Hebcal (Jewish calendar) and YouTube (exercise videos you tap to play).', 'Shabbat and Yom Tov end 72 minutes after sunset (Rabbeinu Tam).'].map((t) => row({ label: t })), 'no-ic')}</div>
    <div>${sectionTitle('Sources')}${listCard(Object.keys(K.SOURCES).map((k) => `<a class="row" href="${esc(K.SOURCES[k].url)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><span class="row-main"><span class="row-label">${esc(K.SOURCES[k].title)}</span></span>${icon('external-link', 'ic-s')}</a>`).concat([`<a class="row" href="${esc(K.PARQ_URL)}" target="_blank" rel="noopener" style="text-decoration:none;color:inherit"><span class="row-main"><span class="row-label">PAR-Q+ (the official health screening form)</span></span>${icon('external-link', 'ic-s')}</a>`]), 'no-ic')}</div>
    <p class="caption" style="padding:0 4px">Jewish calendar data from Hebcal.com (CC BY 4.0), Brooklyn, NY. Icons by Lucide (ISC License). Exercise videos belong to their YouTube channels. Chizuk lines are paraphrases linked to Sefaria.</p></div>`;
}

// ------------------------------------------------------------------ Something's off
const off = { image: '', route: '' };
function offSheet(keep) {
  if (!keep) off.route = route().parts.join('/');
  const note = keep && document.getElementById('off-note') ? document.getElementById('off-note').value : '';
  const body = `<p class="sub">${S.isOwner() ? 'What looks wrong? It goes into tonight\'s problem report, ready to fix.' : 'Tell ' + esc(S.ownerName()) + ' what looks wrong. It goes into tonight\'s problem report.'}</p>
    <label class="field"><span>What happened?</span><textarea id="off-note" rows="3" maxlength="1000" placeholder="For example: my streak shows 0 but I logged yesterday">${esc(note)}</textarea></label>
    ${off.image ? `<div class="photo-prev"><img src="${off.image}" alt="Your screenshot"></div>${textBtn('Remove the picture', 'off-clear', {}, { cls: 'block' })}` : `<div class="inset"><label class="row file-btn">${icon('image')}<span class="row-main"><span class="row-label">Add a screenshot or photo</span></span><input type="file" accept="image/*" data-change="off-photo" aria-label="Add a screenshot or photo"></label></div>`}
    ${primary('Send', 'off-send')}`;
  if (keep && document.getElementById('off-note')) updateSheet({ title: 'Something\'s off', body }); else openSheet({ title: 'Something\'s off', body });
}
export function applyTheme() {
  const t = S.ui.theme || (S.data && S.data.me && S.data.me.settings && S.data.me.settings.theme) || 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('op_theme', t); } catch (e) { /* ignore */ }
}

// ------------------------------------------------------------------ actions
const forOf = (el) => el.dataset.for || undefined;
function partnerSched() { const p = S.partner(); return Object.assign({}, (p && p.settings && p.settings.schedule) || L.DEFAULT_SCHEDULE); }
export const actions = {
  'off-sheet'() { closeSheet(); setTimeout(() => offSheet(false), 0); },
  async 'off-send'(el) {
    const note = document.getElementById('off-note').value.trim();
    if (!note && !off.image) { toast('Write a few words about what looks off.', { kind: 'err' }); return; }
    await busy(el, async () => {
      try { await call('somethingOff', { note, image: off.image || undefined, route: off.route, version: window.OUR_PLAN_VERSION || '' }, { timeout: 90000 }); off.image = ''; closeSheet(); toast('Sent to ' + S.ownerName() + '. Thank you.'); }
      catch (e) { toast(e.message, { kind: 'err' }); }
    });
  },
  'off-clear'() { off.image = ''; offSheet(true); },
  async 'voice-preview'(el) { await busy(el, () => Voice.preview(el.dataset.v, 'Hi. I\'m your coach. Logged. Nice work.').catch((e) => toast(e.message || 'The preview didn\'t play.', { kind: 'err' }))); },
  'set-voice'(el) { S.write('settings', { values: { voice: el.dataset.v } }); toast('Voice changed for both of you.'); },
  'set-tier'(el) { S.write('settings', { values: { coach_tier: el.dataset.v } }); },
  'set-theme'(el) { S.setUi('theme', el.dataset.v); applyTheme(); S.write('settings', { values: { theme: el.dataset.v } }); },
  'budget-sheet'() {
    const h = S.household();
    openSheet({ title: 'Monthly budget', body: `<p class="sub">All AI features together. Most months cost a few dollars. At 80% you get a heads-up; at 100% the coach switches to Standard and the voice to the built-in one, so it never just stops.</p><label class="field"><span>Dollars per month</span><input id="budget-in" class="big-input" type="number" inputmode="decimal" min="1" max="500" step="1" value="${esc(h.budget_usd || 15)}"></label>${primary('Save', 'budget-save')}`, done: false });
  },
  'budget-save'() {
    const v = +document.getElementById('budget-in').value;
    if (!(v >= 1 && v <= 500)) { toast('Choose between $1 and $500.', { kind: 'err' }); return; }
    S.write('settings', { values: { budget_usd: Math.round(v * 100) / 100 } }); closeSheet(); toast('Budget saved.');
  },
  'pointer-sheet'() {
    openSheet({ title: 'Go back?', body: `<p class="body">Both phones will open the previous version of the app next time they're opened. Your data, links and settings stay exactly as they are.</p><p class="sub">Use this only if an update misbehaves. You can switch back here.</p>${primary('Go back to the previous version', 'pointer-previous')}`, doneLabel: 'Cancel' });
  },
  async 'pointer-previous'(el) {
    await busy(el, async () => {
      try {
        const r = await fetch('prev/js/version.js', { cache: 'no-store' });
        if (!r.ok) throw new Error('There is no previous version yet.');
        await call('settings', { values: { app_pointer: 'previous' } });
        try { localStorage.setItem('op_prev_ok', '1'); } catch (e) { /* ignore */ }
        if (window.OurPlanPointer) window.OurPlanPointer.follow('previous');
      } catch (e) { toast(e.message, { kind: 'err' }); }
    });
  },
  'pointer-current'() { S.write('settings', { values: { app_pointer: 'current' } }); toast('Using the newest version.'); },
  async 'notify-on'(el) {
    const on = PushClient.turnOn(); // C1: the permission question first, inside the tap, nothing awaited before it
    await busy(el, async () => {
      try { await on; toast('Notifications are on.', { icon: 'bell' }); S.sync(); } catch (e) { toast(e.message, { kind: 'err', ms: 7000 }); }
    });
    rerender();
  },
  async 'notify-off'(el) { await busy(el, async () => { try { await PushClient.disable(); toast('Off on this phone.'); } catch (e) { toast(e.message, { kind: 'err' }); } }); rerender(); },
  async 'notify-test'(el) {
    await busy(el, async () => {
      try { const r = await call('pushTest', {}); toast(r.sent ? 'Sent. It should arrive in a few seconds.' : 'Nothing was sent. Try turning notifications off and on.', { icon: 'bell', ms: 5000 }); }
      catch (e) { toast(e.message, { kind: 'err' }); }
    });
  },
  'mode-sheet'(el) {
    const k = el.dataset.m;
    const cur = S.mode(S.meId());
    if (k === 'none') { if (cur) actions.mode(el); return; }
    const m = K.MODES.find((x) => x.key === k);
    if (!m) return;
    const isOn = cur && cur.key === k;
    openSheet({ title: m.label, body: `<p class="body">${esc(m.desc)}</p><p class="sub">${m.days ? 'Turns itself off after ' + m.days + ' days.' : 'Stays on until you turn it off.'}</p>${isOn ? primary('Turn off', 'mode', { 'data-m': 'none' }) : primary('Turn on', 'mode', { 'data-m': k })}` });
  },
  'health-steps'(el) {
    const [title, steps, note] = HEALTH_STEPS[el.dataset.k] || [];
    if (!title) return;
    openSheet({ title, body: `<ol class="steps">${steps.map((t) => `<li class="body">${t}</li>`).join('')}</ol>${note ? `<p class="caption">${esc(note)}</p>` : ''}` });
  },
  mode(el) { const m = el.dataset.m; closeSheet(); S.write('setMode', { mode: m }); toast(m === 'none' ? 'Back to your normal plan.' : modeLabel(m) + ' mode on.', { icon: 'shield' }); },
  'meds-sheet'() {
    openSheet({ title: 'Medications', body: `<p class="sub">Used to check supplement interactions and shown on your doctor summary.</p><label class="field"><span>Medications</span><textarea id="meds-in" rows="3" maxlength="600">${esc(S.profile().meds || '')}</textarea></label>${primary('Save', 'meds-save')}`, done: false });
  },
  'meds-save'() { S.write('saveProfile', { values: { meds: document.getElementById('meds-in').value.trim() } }); closeSheet(); toast('Saved.'); },
  async 'copy-link'() { toast((await copyText(Config.personalLink())) ? 'Copied. Keep it private.' : 'Couldn\'t copy.', { icon: 'copy' }); },
  async 'copy-health'() { toast((await copyText(healthLink())) ? 'Health link copied. Paste it in step 5.' : 'Couldn\'t copy.', { icon: 'copy', ms: 5000 }); },
  async rotate(el) {
    openSheet({ title: 'Make a new link?', body: `<p class="body">Your old link, and the Home Screen icon made from it, will stop working. You'll add the new one to your Home Screen.</p>${primary('Make a new link', 'rotate-yes')}`, doneLabel: 'Cancel' });
  },
  async 'rotate-yes'(el) {
    await busy(el, async () => {
      try { const r = await call('rotateToken', {}); Config.setLink(r.token, Config.api); await copyText(Config.personalLink()); closeSheet(); toast('New link copied. Open it in Safari and add it to your Home Screen again.', { icon: 'link', ms: 7000 }); }
      catch (e) { toast(e.message, { kind: 'err' }); }
    });
  },
  async 'partner-link'(el) {
    await busy(el, async () => {
      try { const r = await call('partnerLink', {}); openSheet({ title: (r.name || 'Partner') + '\'s link', body: `<p class="sub">Send it only to ${esc(r.name || 'them')}, by text or email.</p><p class="mono">${esc(r.link)}</p>${primary('Copy link', 'copy-any', { 'data-text': r.link })}` }); }
      catch (e) { toast(e.message, { kind: 'err' }); }
    });
  },
  async 'copy-any'(el) { toast((await copyText(el.dataset.text)) ? 'Copied.' : 'Couldn\'t copy.', { icon: 'copy' }); },
  'add-person'() {
    openSheet({ title: 'Add a person', body: `<p class="sub">They get their own private link, plan and coach chat.</p><label class="field"><span>First name</span><input id="ap-n" type="text" maxlength="40" autocapitalize="words"></label><label class="field"><span>Email (optional)</span><input id="ap-e" type="email" maxlength="120"></label>${primary('Create their link', 'add-person-save')}`, done: false });
  },
  async 'add-person-save'(el) {
    const n = document.getElementById('ap-n').value.trim();
    if (!n) return;
    await busy(el, async () => {
      try { const r = await call('addPerson', { name: n, email: document.getElementById('ap-e').value.trim() }); updateSheet({ title: L.capName(n) + '\'s link', body: `<p class="mono">${esc(r.link)}</p>${primary('Copy link', 'copy-any', { 'data-text': r.link })}` }); S.sync(); }
      catch (e) { toast(e.message, { kind: 'err' }); }
    });
  },
  forget() {
    openSheet({ title: 'Forget me here?', body: `<p class="body">Your private link is removed from this phone. You can open it again from your email.</p>${primary('Forget me on this phone', 'forget-yes')}`, doneLabel: 'Cancel' });
  },
  'forget-yes'() { Config.forget(); location.href = location.pathname; },
  async 'backup-now'(el) {
    await busy(el, async () => {
      try { await call('backupNow', {}, { timeout: 120000 }); bk.list = null; toast('Backup saved to Drive.'); } catch (e) { bk.error = e.message; }
    });
    rerender();
  },
  'check-run'(el) { if (!chk.running) runCheck(el.dataset.k); },
  /** C2: the failed Notifications row turns them on (the question is asked first thing in this tap), then runs its test. */
  'notify-turn-on'() {
    if (chk.running) return;
    const on = PushClient.turnOn(); // nothing is awaited before this
    chk.running = 'notify'; rerender();
    on.then(() => { chk.running = ''; S.sync(); return runCheck('notify'); }, (e) => { chk.running = ''; saveCheck('notify', false, e.message); rerender(); toast(e.message, { kind: 'err', ms: 7000 }); });
  },
  async 'check-all'(el) {
    if (chk.running) return;
    // the permission questions need this tap: notifications first, then the microphone, with nothing awaited before either
    const push = PushClient.status() === 'off' && typeof Notification !== 'undefined' && Notification.permission === 'default' ? PushClient.turnOn().catch((e) => e) : null;
    const micStart = Mic.start({ maxMs: 2500, bar: true, label: 'Testing the microphone' }).catch((e) => e);
    if (push) { chk.running = 'notify'; rerender(); const p = await push; if (p instanceof Error) saveCheck('notify', false, p.message); else S.sync(); chk.running = ''; }
    for (const [k] of CHECKS) {
      if (k === 'notify' && push && chk.results.notify && !chk.results.notify.ok) continue; // just failed to turn on: shown above
      if (k === 'mic') {
        chk.running = 'mic'; rerender();
        const r = await micStart;
        if (r instanceof Error || (r && r.name)) saveCheck('mic', false, (r.name ? r.name + ': ' : '') + (r.message || ''));
        else {
          try { await new Promise((res) => setTimeout(res, 2000)); const rec = await Mic.stop(); const text = await Mic.transcribe(rec, { allowSilence: true }); saveCheck('mic', true, text ? 'Heard: "' + text.slice(0, 60) + '"' : 'Recorded 2 seconds and sent them. Nothing was said.'); }
          catch (e) { saveCheck('mic', false, (e.name && e.name !== 'Error' ? e.name + ': ' : '') + e.message); }
        }
        chk.running = ''; continue;
      }
      await runCheck(k);
    }
    rerender();
  }
};
export const changes = {
  setting(el) { S.write('settings', { forUser: forOf(el), values: { [el.dataset.key]: el.checked } }); },
  'setting-val'(el) { const v = el.dataset.num ? (el.value === '' ? null : +el.value) : el.value; S.write('settings', { forUser: forOf(el), values: { [el.dataset.key]: v } }); },
  'household-num'(el) { S.write('settings', { values: { [el.dataset.key]: +el.value } }); toast('Saved for both of you.'); },
  'household-val'(el) { if (/^\d{2}:\d{2}$/.test(el.value)) { S.write('settings', { values: { [el.dataset.key]: el.value } }); toast('Saved for both of you.'); } },
  notify(el) { S.write('settings', { forUser: forOf(el), values: { notify: { [el.dataset.t]: { on: el.checked } } } }); },
  'notify-time'(el) { if (/^\d{2}:\d{2}$/.test(el.value)) S.write('settings', { forUser: forOf(el), values: { notify: { [el.dataset.t]: { time: el.value } } } }); },
  sched(el) {
    const forUser = forOf(el);
    const s = forUser ? partnerSched() : Object.assign({}, S.settings().schedule || L.DEFAULT_SCHEDULE);
    s[el.dataset.d] = el.value; s[6] = 'rest';
    S.write('settings', { forUser, values: { schedule: s } });
  },
  async 'off-photo'(el) {
    const f = el.files && el.files[0];
    if (!f) return;
    try { off.image = await resizeImage(f, 1400, 0.8); offSheet(true); } catch (e) { toast(e.message, { kind: 'err' }); }
  }
};
export { timeAgo, go };
