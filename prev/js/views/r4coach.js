/* Round 4 coach screens (section 7): game plans (R4GamePlan), the plateau card, Our month (R4OurMonth), the Together
 * cards (the month is ready, the Sunday coach meeting), "Fresh start", and Report a problem (the You sheet's row and the
 * startup guard's "Something went wrong" open it; it captures the screen, version, recent errors and taps). */
import { L, esc, icon, toast, openSheet, closeSheet, busy, preparePhoto, shortDate } from '../core.js?v=132c8397ab';
import { S } from '../store.js?v=016968e4cd';
import { call } from '../api.js?v=b8330e966d';
import { go, rerender, route } from '../nav.js?v=57c55c9996';
import { nav, pageTitle, card, row, primary, textBtn, listCard, empty } from '../ui.js?v=028af192f4';

const r4 = () => (S.data && S.data.round4) || {};

// ------------------------------------------------------------------ 7.1 game plans
export function coachCards() {
  const out = [];
  (r4().gamePlans || []).filter((g) => g.status === 'proposed').forEach((g) => out.push(row({ icon: 'calendar-days', label: g.situation, sub: 'From your coach, for ' + whenText(g.data), act: 'go', data: { 'data-to': 'coach/gameplan/' + g.id } })));
  const pl = r4().plateau;
  const plateauCard = pl && pl.meta && pl.meta.status === 'proposed' ? card(`<div class="eyebrow">Plateau: one change</div><p class="h3" style="margin-top:4px">${esc(pl.text)}</p>${pl.meta.why ? `<p class="sub" style="margin-top:4px">${esc(pl.meta.why)}</p>` : ''}
    <div class="picks fit" style="margin-top:12px"><button type="button" class="pick" data-act="plateau" data-op="ok" data-id="${esc(pl.id)}">OK</button><button type="button" class="pick" data-act="plateau" data-op="notnow" data-id="${esc(pl.id)}">Not now</button></div>`, 'plateau-card') : '';
  return (out.length ? listCard(out) : '') + plateauCard;
}
function whenText(d) {
  if (!d || !d.date) return 'soon';
  const n = L.daysBetween(S.today(), d.date);
  return n <= 0 ? 'now' : (n === 1 ? 'tomorrow' : L.WEEKDAYS[L.weekday(d.date)].replace('Shabbat', 'Shabbos'));
}
export function gamePlanPage(id) {
  const g = (r4().gamePlans || []).find((x) => x.id === id);
  const head = nav({ back: 'Coach', backTo: 'coach', title: g ? g.situation : 'Game plan' });
  if (!g) return head + '<p class="sub" style="padding:16px">This game plan has passed.</p>';
  const d = g.data || {};
  const start = d.date ? L.WEEKDAYS[L.weekday(d.date)].replace('Shabbat', 'Shabbos') + ', ' + longMonth(d.date) : '';
  const sub = (d.kind === 'chanukah' ? 'Starts ' + start.replace(/^(\w+),/, '$1 night,') : 'On ' + start) + (d.nights ? ' · ' + d.nights + ' nights' : '') + ' · for ' + (S.partner() && g.situation ? 'you' : 'you');
  return head + pageTitle(g.situation, sub) + `<div class="stack">
    ${card(g.rules.map((r) => `<div class="ifthen"><div class="eyebrow">If ${esc(r[0].replace(/^if\s+/i, ''))}</div><p class="body">${esc(r[1])}</p></div>`).join('') + (d.keepMoving ? `<div class="ifthen"><div class="eyebrow">Keep moving</div><p class="body">${esc(d.keepMoving)}</p></div>` : ''))}
    ${card(`<p class="note">${icon('heart')}<span>${esc(d.reassurance || 'One heavy night won\'t move your trend. The next morning starts fresh, and your streak is safe.')}</span></p>`)}
    ${g.status === 'active' ? '<p class="caption center">In your plan. The morning message carries one of these on those days.</p>' : primary('Add to our plan', 'gameplan-add', { 'data-id': g.id })}
    <div class="center">${textBtn('Change something', 'gameplan-change', { 'data-id': g.id })}</div></div>`;
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function longMonth(iso) { const [, m, d] = iso.split('-').map(Number); return MONTHS[m - 1] + ' ' + d; }

// ------------------------------------------------------------------ 7.5 Our month
export function togetherCards() {
  const out = [];
  const mo = r4().month;
  if (mo && L.daysBetween(L.nyDate(mo.ts), S.today()) <= 7 && (S.ui.monthSeen || '') < mo.id) out.push(row({ icon: 'sparkles', label: 'Our month is ready', sub: mo.meta.month ? mo.meta.month + ', in numbers' : 'In numbers and one note from the coach', act: 'go', data: { 'data-to': 'together/month' } }));
  // 7.6: Sundays, and Motzei Shabbat after the catch-up
  const wd = L.weekday(S.today()), motzei = wd === 6 && !S.quiet().quiet && S.minutes() >= 18 * 60;
  if ((wd === 0 || motzei) && S.partner() && (S.ui.meetingDone || '') !== L.weekStart(L.addDays(S.today(), wd === 6 ? 1 : 0))) out.push(row({ icon: 'message-square-text', label: 'Sunday coach meeting', sub: 'About 5 minutes, both of you', act: 'meeting' }));
  return out.length ? listCard(out) : '';
}
export function monthPage() {
  const mo = r4().month;
  const head = nav({ back: 'Together', backTo: 'together', title: 'Our month' });
  if (!mo) return head + pageTitle('Our month') + `<div class="stack">${empty('calendar-days', 'The first one comes on Rosh Chodesh', 'Your month in numbers, side by side, at 9 am on the first day.')}</div>`; // found at start (aa): the empty page looked broken
  const m = mo.meta || {}, n = m.numbers || {}, names = m.names || {};
  const me = S.meId(), p = S.partner();
  const ids = [me].concat(p ? [p.id] : []);
  const mine = (n.people || {})[me] || {};
  const weightCards = ids.map((id) => {
    const x = (n.people || {})[id];
    if (!x || x.change == null) return '';
    return card(`<div class="eyebrow">${esc((names[id] || (id === me ? S.me().name : p.name)) + '\'s weight trend')}</div><div class="bigline" style="margin-top:4px"><b class="num" style="font-size:var(--f34);font-weight:700;color:var(--weight-text, var(--text))">${x.change > 0 ? '+' : (x.change < 0 ? '−' : '')}${Math.abs(x.change)} lb</b></div><p class="sub">About ${Math.abs(x.perWeek)} lb a week: ${esc(x.pace)}.</p>`);
  }).join('');
  const photos = (mine.photos || []);
  const ph = photos.length >= 2 ? `<div class="month-photos">${[photos[0], photos[photos.length - 1]].map((x) => `<figure><img data-photo="${esc(x.id)}" alt="" src=""><figcaption class="caption">${esc(shortDate(x.date))}</figcaption></figure>`).join('')}</div>` : '';
  const stronger = ids.map((id) => ((n.people || {})[id] || {}).stronger || []).map((l, i) => l.slice(0, 1).map((s) => `<div class="split"><span class="body">${esc((names[ids[i]] || '') + ' · ' + exName(s.exerciseId))}</span><b>${esc(s.text)}</b></div>`).join('')).join('');
  return head + pageTitle('Our month', (m.next ? 'Rosh Chodesh ' + m.next : 'Rosh Chodesh')) + `<div class="stack">
    ${ph}${weightCards}
    <div class="tri">${[[n.bothActiveDays, 'days you were both active', 'day you were both active'], [n.walks, 'walks', 'walk'], [n.bests, 'new bests', 'new best']].map(([v, l, one]) => `<div class="stat"><b>${+v || 0}</b><span class="caption">${+v === 1 ? one : l}</span></div>`).join('')}</div>
    ${n.familyWalks ? `<p class="sub" style="margin:0 4px">${n.familyWalks === 1 ? 'One walk was' : n.familyWalks + ' of those walks were'} with the girls.</p>` : ''}
    ${stronger ? card(`<div class="eyebrow">Stronger</div><div class="best-rows">${stronger}</div>`) : ''}
    ${(n.topMeals || []).length ? card(`<div class="eyebrow">Best meals</div><p class="body" style="margin-top:4px">${esc(n.topMeals.join(' · '))}</p>`) : ''}
    ${card(`<div class="eyebrow">From the coach</div><p class="body" style="margin-top:4px">${esc(mo.text)}</p>`)}</div>`;
}
function exName(id) { const e = S.exercise(id); return e ? e.name.replace(/^Band /, '').toLowerCase() : String(id); }

// ------------------------------------------------------------------ 7.2 fresh start (Summary's streak line)
export function freshStart() { return !!r4().offYesterday; }

// ------------------------------------------------------------------ 7.7 Report a problem
const taps = [];
document.addEventListener('click', (e) => {
  const el = e.target.closest && e.target.closest('[data-act]');
  if (!el) return;
  taps.push((route().parts.join('/') || route().name) + ' · ' + el.dataset.act); // the action's name only, never typed text
  if (taps.length > 10) taps.shift();
}, true);
function errors() { try { return (window.__opErrors || []).slice(-20); } catch (e) { return []; } }
export function reportSheet() {
  openSheet({ title: 'Report a problem', body: `<p class="sub">What looks wrong? The app adds the screen, the version and the last few taps and errors (never what you typed).</p>
    <label class="field"><span>What happened</span><textarea id="rp-note" rows="3" placeholder="For example: the order shows eggs twice"></textarea></label>
    <label class="btn-text block file-btn">${icon('camera')}<span id="rp-photo-label">Add a screenshot (optional)</span><input type="file" accept="image/*" data-change="rp-photo" aria-label="Add a screenshot"></label>
    ${primary('Send', 'rp-send')}` });
}
let rpImage = '';
export const changes = {
  async 'rp-photo'(el) { const f = el.files && el.files[0]; if (!f) return; try { const p = await preparePhoto(f, 1400, 0.8); rpImage = p.data; const l = document.getElementById('rp-photo-label'); if (l) l.textContent = 'Screenshot added'; } catch (e) { toast('That picture couldn\'t be read.', { kind: 'err' }); } }
};
export const actions = {
  'gameplan-add'(el) { S.write('gamePlan', { op: 'activate', id: el.dataset.id }); const g = (r4().gamePlans || []).find((x) => x.id === el.dataset.id); if (g) g.status = 'active'; toast('Added to your plan.'); rerender(); },
  'gameplan-change'(el) { const g = (r4().gamePlans || []).find((x) => x.id === el.dataset.id); go('coach'); setTimeout(() => { const i = document.getElementById('chat-in'); if (i) { i.value = 'About my ' + (g ? g.situation : 'game plan') + ': '; i.focus(); } }, 300); },
  plateau(el) { S.write('plateau', { op: el.dataset.op, id: el.dataset.id }); const pl = r4().plateau; if (pl) pl.meta.status = el.dataset.op === 'ok' ? 'applied' : 'declined'; toast(el.dataset.op === 'ok' ? 'Done. It starts today.' : 'Okay. Maybe another time.'); rerender(); },
  'report-sheet'() { rpImage = ''; reportSheet(); },
  async 'rp-send'(el) {
    const note = String((document.getElementById('rp-note') || {}).value || '').trim();
    if (!note && !rpImage) { toast('Write a few words about what looks wrong.', { kind: 'err' }); return; }
    const meta = { route: route().parts.join('/') || route().name, version: window.OUR_PLAN_VERSION || '', at: new Date().toISOString(), errors: errors(), taps: taps.slice(-10) };
    await busy(el, async () => {
      try { await call('somethingOff', { note, image: rpImage || undefined, route: meta.route, version: meta.version, meta }, { timeout: 60000 }); closeSheet(); toast('Sent. Thank you.'); rpImage = ''; }
      catch (e) { toast(e.message, { kind: 'err', ms: 6000 }); }
    });
  }
};
export function afterMonth() {
  const mo = r4().month;
  if (mo && (S.ui.monthSeen || '') < mo.id) S.setUi('monthSeen', mo.id);
  // the month's two photos load like the progress photos page (kept on the phone after the first look)
  document.querySelectorAll('img[data-photo]').forEach((img) => { call('photoGet', { id: img.dataset.photo }).then((r) => { if (r && (r.dataUrl || r.data)) img.src = r.dataUrl || r.data; }).catch(() => {}); });
}
