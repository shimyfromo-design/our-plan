/* Coach (D10): one conversation. Type, dictate, Talk hands-free, or send a photo. Notes live behind the Notes pill. */
import { L, esc, icon, toast, openSheet, updateSheet, closeSheet, timeAgo, uid, resizeImage, dayName, clock, shortDate } from '../core.js';
import { S } from '../store.js';
import { call } from '../api.js';
import { go, back, rerender, route } from '../nav.js';
import { initialBtn, card, row, textBtn, primary, playCtl, iconBtn, empty, nav } from '../ui.js';
import * as Voice from '../voice.js';
import * as Mic from '../mic.js';
import { tipOnce, reduceMotion } from '../fx.js';
import { labCard } from './labs.js';
import { ideaCard } from './plan.js';
import * as Pages from './coachpages.js';

// pending: { text, cid, since, voice } · failed: { text, cid, message }
const chat = { pending: null, failed: null, draft: '', dictating: false, transcribing: false, slow: false, photo: null };
// Talk: 'off' | 'starting' | 'listening' | 'thinking' | 'speaking'
const talk = { state: 'off', muted: false, you: '', coach: '', silent: 0, level: 0, audio: null, stopReq: false };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function render(r) {
  const sub = r.parts[1];
  if (sub === 'talk') {
    if (talk.state === 'off') { setTimeout(() => go('coach', { replace: true }), 0); return chatScreen(); } // Talk only runs from a tap
    return talkScreen();
  }
  if (sub && Pages.has(sub)) return Pages.render(sub, r);
  return chatScreen();
}
export function afterRender(r) {
  if (r.parts[1] === 'talk') { paintOrb(); return; }
  if (r.parts[1]) return Pages.afterRender && Pages.afterRender(r);
  const t = document.getElementById('thread');
  if (t && t.lastElementChild) t.lastElementChild.scrollIntoView({ block: 'end' });
  const inp = document.getElementById('chat-in');
  if (inp) {
    const sync = () => {
      inp.style.height = 'auto'; inp.style.height = Math.min(140, inp.scrollHeight) + 'px';
      chat.draft = inp.value;
      const b = document.getElementById('talk-send');
      const has = !!inp.value.trim();
      if (b && (b.dataset.mode === 'send') !== has) { b.dataset.mode = has ? 'send' : 'talk'; b.dataset.act = has ? 'chat-send' : 'talk'; b.setAttribute('aria-label', has ? 'Send' : 'Talk'); b.innerHTML = icon(has ? 'arrow-up' : 'audio-lines'); }
    };
    inp.oninput = sync; sync();
    inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); actions['chat-send'](document.getElementById('talk-send')); } };
  }
}
export function leave(from, to) {
  if (from === 'coach/talk' && to !== 'coach/talk') endTalk();
  if (from === 'coach' && to !== 'coach' && chat.dictating) { Mic.cancel(); chat.dictating = false; }
}
/** The red listening bar's Stop button. */
export function micStop() { if (talk.state !== 'off') { endTalk(); rerender(); return; } if (chat.dictating) actions['chat-mic'](); else Mic.cancel(); }

// ------------------------------------------------------------------ the chat (D10)
function chatScreen() {
  // the Notes pill and your initial stay on the sticky bar, so they're reachable however far the chat scrolls
  const head = nav({ title: 'Coach', cls: 'tabnav', right: `<button class="pill-btn" type="button" data-act="notes-sheet">${icon('book-open')}<span>Notes</span></button>${initialBtn()}` }) + '<div class="head"><h1 class="title">Coach</h1></div>';
  if (!S.hasCoach()) {
    return head + empty('message-circle', 'The coach isn\'t connected yet', S.isOwner() ? 'Add your OpenAI key in Script Properties (SETUP.md). Everything else already works.' : 'The person who set up Our Plan still needs to connect the coach. Everything else already works.');
  }
  const thread = ((S.data.coach && S.data.coach.thread) || []).filter((m) => m.kind !== 'couple');
  const parts = [];
  let lastTs = '';
  thread.forEach((m, i) => {
    if (!lastTs || String(m.ts).slice(0, 10) !== String(lastTs).slice(0, 10) || Date.parse(m.ts) - Date.parse(lastTs) > 3 * 3600000) parts.push(`<p class="stamp">${esc(stampOf(m.ts))}</p>`);
    lastTs = m.ts;
    parts.push(bubble(m, i));
  });
  if (!thread.length && !chat.pending) parts.push(`<div class="msg"><div class="bubble">Hi ${esc(S.me().name)}. Tell me what you did, ask anything, or tap Talk and just speak.</div></div>`);
  if (chat.photo) parts.push(`<div class="msg me pending"><div class="bubble">${icon('camera', 'ic-s')} Photo</div></div>` + thinking(chat.photo.label));
  if (chat.pending) parts.push(`<div class="msg me pending"><div class="bubble">${esc(chat.pending.text)}</div></div>` + thinking(chat.transcribing ? 'Listening back' : (chat.slow || Date.now() - chat.pending.since > 25000 ? 'Still thinking, a few more seconds' : 'Thinking')));
  if (chat.failed) parts.push(`<div class="msg"><div class="bubble">${esc(chat.failed.message)}</div>${textBtn('Send again', 'chat-retry', {}, { cls: 'small' })}</div>`);
  const quiet = S.quiet().quiet;
  return head + `${reviewCard()}<div class="thread" id="thread">${parts.join('')}</div>${composer(quiet)}`;
}
function stampOf(ts) {
  const d = new Date(ts), today = S.today(), iso = L.addDays(today, 0);
  const date = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const t = clock(ts);
  if (date === iso) return 'Today ' + t;
  if (date === L.addDays(today, -1)) return 'Yesterday ' + t;
  if (L.daysBetween(date, today) < 7) return dayName(date) + ' ' + t;
  return shortDate(date) + ' ' + t;
}
function thinking(label) { return `<div class="msg"><div class="bubble" role="status" aria-label="${esc(label)}"><span class="typing"><i></i><i></i><i></i><em>${esc(label)}</em></span></div></div>`; }
function reviewCard() {
  const m = ((S.data.coach && S.data.coach.weekly) || {})[S.meId()];
  if (!m || (S.ui.reviewSeen && S.ui.reviewSeen >= m.ts)) return '';
  const meta = m.meta || {};
  const wins = (meta.wins || []).length, tries = (meta.tries || meta.changes || Pages.parseReview(m.text).tries).length;
  const bits = [].concat(wins ? [wins + (wins === 1 ? ' win' : ' wins')] : []).concat(tries ? [tries + (tries === 1 ? ' thing to try' : ' things to try')] : []);
  return `<button type="button" class="card review-card" data-act="go" data-to="coach/review" style="margin-top:12px">${icon('calendar-check')}<span class="grow"><span class="row-label b" style="display:block">Weekly review is ready</span>${bits.length ? `<span class="row-sub">${esc(bits.join(' · '))}</span>` : ''}</span>${icon('chevron-right', 'ic-s')}</button>`;
}
function bubble(m, i) {
  if (m.role === 'user') return `<div class="msg me"><div class="bubble">${m.kind === 'photo' ? icon('camera', 'ic-s') + ' ' : ''}${esc(m.text)}</div></div>`;
  const meta = m.meta || {};
  if (m.kind === 'photo' && meta.type === 'lab') return `<div class="msg">${labCard(meta, m.id)}</div>`;
  if (m.kind === 'photo' && meta.type === 'pantry' && (meta.ideas || []).length) return `<div class="msg" style="width:100%">${esc(m.text) ? `<div class="bubble">${esc(m.text)}</div>` : ''}${(meta.ideas || []).map((x, k) => `<div style="width:100%;margin-top:6px">${ideaCard(x, k)}</div>`).join('')}</div>`;
  const chips = (meta.actions || []).filter((a) => a.summary).map((a) => `<span class="logchip">${icon('check')}<span>${esc(a.summary)}</span>${a.undo && a.undo.id && !/^tmp/.test(a.undo.id) ? textBtn('Undo', 'undo', { 'data-tab': a.undo.tab, 'data-id': a.undo.id }) : ''}</span>`).join('');
  const open = new Set(S.proposals().map((p) => p.id));
  const props = (meta.proposals || []).filter((p) => open.has(p.id)).map((p) => `<div class="card tight cardmsg" style="margin-top:6px"><div class="eyebrow">Suggested ${esc(p.kind)}</div><p class="body" style="margin-top:2px">${esc(p.title)}</p><div class="btn-row" style="justify-content:flex-start;margin-left:-8px">${textBtn('Add', 'confirm', { 'data-tab': p.tab, 'data-id': p.id, 'data-accept': '1' })}${textBtn('No thanks', 'confirm', { 'data-tab': p.tab, 'data-id': p.id, 'data-accept': '0' })}</div></div>`).join('');
  const text = String(m.text || '').replace(/!(\s|$)/g, '.$1'); // calm tone: no exclamation points, even from the coach
  return `<div class="msg"><div class="bubble">${esc(text).replace(/\n/g, '<br>')}</div>${S.quiet().quiet ? '' : playCtl('msg:' + (m.id || i), text)}${chips}${props}</div>`;
}
function composer(quiet) {
  const has = !!chat.draft.trim();
  return `<div class="composer">
    ${iconBtn('camera', 'photo-sheet', 'Send a photo', { cls: 'cam' })}
    <div class="field-wrap"><textarea id="chat-in" rows="1" maxlength="2000" placeholder="${chat.dictating ? 'Listening' : 'Message'}" aria-label="Message">${esc(chat.draft)}</textarea>
      ${Mic.supported() && !quiet ? `<button type="button" class="mic-in${chat.dictating ? ' live' : ''}" data-act="chat-mic" aria-pressed="${chat.dictating}" aria-label="${chat.dictating ? 'Stop dictation' : 'Dictate'}" ${chat.transcribing ? 'disabled' : ''}>${icon(chat.dictating ? 'mic-off' : 'mic', 'ic-s')}</button>` : ''}</div>
    <button type="button" id="talk-send" class="btn-icon talk" data-mode="${has ? 'send' : 'talk'}" data-act="${has ? 'chat-send' : 'talk'}" aria-label="${has ? 'Send' : 'Talk'}" ${!has && quiet ? 'disabled' : ''}>${icon(has ? 'arrow-up' : 'audio-lines')}</button></div>`;
}

// ------------------------------------------------------------------ sending (never twice, no false errors)
async function waitForReply(cid, voice) {
  const until = Date.now() + 180000;
  chat.slow = true;
  while (Date.now() < until) {
    await sleep(3500);
    try {
      const s = await call('chatResult', { cid, withAudio: !!voice }, { timeout: 30000 });
      if (s.status === 'done') return s.result;
      if (s.status === 'missing') return { missing: true };
    } catch (e) { /* offline for a moment: keep waiting */ }
  }
  return null;
}
export async function send(text, opts = {}) {
  text = String(text || '').trim();
  if (!text || chat.pending) return null;
  const cid = (opts.retry && chat.failed && chat.failed.cid) || uid('m');
  chat.pending = { text, cid, since: Date.now(), voice: !!opts.voice };
  chat.failed = null; chat.draft = ''; chat.slow = false;
  const inp = document.getElementById('chat-in');
  if (inp) inp.value = '';
  if (!opts.voice) rerender();
  const tick = setInterval(() => { if (chat.pending && route().name === 'coach' && !route().parts[1]) rerender(); else if (!chat.pending) clearInterval(tick); }, 12000);
  let r = null;
  try {
    r = await call('coachChat', { text, cid, withAudio: !!opts.voice, source: opts.voice ? 'talk' : 'chat' }, { timeout: 120000 });
    if (r && r.pending) r = await waitForReply(cid, opts.voice);
  } catch (e) {
    if (e.retryable || e.code === 'network' || e.code === 'bad_response') r = await waitForReply(cid, opts.voice);
    else { chat.pending = null; chat.failed = { text, cid, message: e.message }; clearInterval(tick); rerender(); return null; }
  }
  clearInterval(tick);
  chat.pending = null; chat.slow = false;
  if (!r) { toast('Your coach is taking longer than usual. The answer will appear here.', { ms: 6000 }); setTimeout(() => S.sync(), 20000); rerender(); return null; }
  if (r.missing) { chat.failed = { text, cid, message: 'This message didn\'t reach your coach.' }; rerender(); return null; }
  const th = S.data.coach.thread = S.data.coach.thread || [];
  const now = new Date().toISOString();
  if (!th.some((m) => m.id === 'u' + cid)) {
    th.push({ id: 'u' + cid, ts: now, role: 'user', kind: 'chat', text, meta: opts.voice ? { voice: true } : {} });
    th.push({ id: 'c' + cid, ts: now, role: 'coach', kind: 'chat', text: r.reply, meta: { actions: r.actions, proposals: r.proposals } });
  }
  S.persist(); S.changed();
  if (r.actions && r.actions.length) setTimeout(() => S.sync(), 1500);
  return r;
}

// ------------------------------------------------------------------ Talk (D10a)
function talkScreen() {
  const label = { starting: 'Listening', listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking' }[talk.state] || 'Listening';
  return `<div class="talkscreen">
    <div class="talk-state ${talk.state === 'listening' && !talk.muted ? 'listening' : ''}" role="status" aria-live="polite"><i aria-hidden="true"></i>${esc(talk.muted ? 'Muted' : label)}</div>
    <div class="orb ${talk.state === 'thinking' ? 'thinking' : ''}" aria-hidden="true"><span class="r r1"></span><span class="r r2"></span><span class="r r3">${Array.from({ length: 7 }, () => '<i></i>').join('')}</span></div>
    <div class="talk-lines"><div class="eyebrow">Coach</div><p class="coach-line">${esc(talk.coach || 'Go ahead. I\'m listening.')}</p>
      <div class="eyebrow you">You</div><p class="you-line" aria-live="polite">${esc(talk.you || '')}</p></div>
    <div class="talk-buttons">
      <button type="button" class="${talk.muted ? 'muted' : ''}" data-act="talk-mute" aria-pressed="${talk.muted}"><span class="circ">${icon('mic-off')}</span>${talk.muted ? 'Unmute' : 'Mute'}</button>
      <button type="button" class="end" data-act="talk-end"><span class="circ">${icon('x')}</span>End</button>
      <button type="button" data-act="talk-chat"><span class="circ">${icon('message-circle')}</span>Show chat</button></div>
    <p class="talk-hint">Say "stop" when you're done.</p></div>`;
}
function paintOrb() {
  const bars = document.querySelectorAll('.orb .r3 i');
  if (!bars.length) return;
  const lv = talk.state === 'listening' && !talk.muted ? Math.min(1, talk.level * 14) : (talk.state === 'speaking' ? 0.35 + 0.25 * Math.sin(Date.now() / 140) : 0.1);
  bars.forEach((b, i) => { const shape = 1 - Math.abs(i - 3) * 0.17; b.style.height = Math.round(10 + 46 * Math.max(0.08, lv * shape * (reduceMotion() ? 0.5 : (0.75 + 0.25 * Math.sin(Date.now() / 90 + i))))) + 'px'; });
  if (talk.state !== 'off' && route().parts[1] === 'talk') requestAnimationFrame(paintOrb);
}
function setTalk(state) { talk.state = state; if (route().parts[1] === 'talk') rerender(); }
async function talkLoop() {
  while (talk.state !== 'off') {
    if (talk.muted) { await sleep(250); continue; }
    if (!Mic.live()) {
      try { await Mic.start({ vad: true, maxMs: 60000, silenceMs: 1200, noSpeechMs: 9000, bar: false, onLevel: (lv) => { talk.level = lv; }, onAuto: (why) => { talk.why = why; } }); }
      catch (e) { endTalk(); showMicHelp(e); return; }
    }
    setTalk('listening');
    talk.why = '';
    while (talk.state === 'listening' && !talk.why && !talk.muted && Mic.live()) await sleep(120);
    if (talk.state === 'off') return;
    if (talk.muted) { Mic.cancel(); continue; }
    const rec = await Mic.stop();
    if (talk.state === 'off') return;
    if (!rec || !rec.spoke || talk.why === 'nospeech') {
      talk.silent++;
      if (talk.silent >= 2) { talk.coach = 'Talk ended. I didn\'t hear anything.'; endTalk(); rerender(); return; }
      continue;
    }
    talk.silent = 0;
    setTalk('thinking');
    let text = '';
    try { text = (await Mic.transcribe(rec)).trim(); } catch (e) { talk.coach = e.message; continue; }
    if (talk.state === 'off') return;
    if (!text) { talk.coach = 'I didn\'t catch that. Try once more.'; continue; }
    talk.you = text;
    if (L.isStopPhrase(text)) { endTalk(); rerender(); return; }
    rerender();
    const r = await send(text, { voice: true });
    if (talk.state === 'off') return;
    if (!r) { talk.coach = 'The coach didn\'t answer in time. Your message is saved.'; continue; }
    talk.coach = r.reply;
    setTalk('speaking');
    if (r.audio && r.audio.audio) await Voice.playClip(r.audio.audio);
    else await Voice.say(r.reply, { key: 'talk' });
    if (talk.state === 'off') return;
  }
}
function endTalk() {
  if (talk.state === 'off') return;
  talk.state = 'off'; talk.muted = false; talk.silent = 0;
  Mic.cancel();
  Voice.stopClip();
  Voice.stop();
}
function showMicHelp(e) {
  if (e && e.denied) {
    openSheet({ title: 'Allow the microphone', body: `<p class="body">Our Plan needs the microphone to hear you.</p><div class="inset" style="padding:12px 16px"><ol class="steps"><li class="sub">Open the iPhone <b>Settings</b> app.</li><li class="sub">Tap <b>Apps</b>, then <b>Safari</b> (or <b>Our Plan</b>).</li><li class="sub">Tap <b>Microphone</b> and choose <b>Allow</b> or <b>Ask</b>.</li><li class="sub">Come back and tap the microphone again.</li></ol></div>` });
  } else toast((e && e.message) || 'The microphone didn\'t start.', { kind: 'err', ms: 6000 });
}

// ------------------------------------------------------------------ photo (D10b): the backend decides what it is
function photoSheet(hint) {
  const input = (capture, label) => `<label class="row file-btn" style="cursor:pointer">${icon(capture ? 'camera' : 'image')}<span class="row-main"><span class="row-label">${label}</span></span><input type="file" accept="image/*" ${capture ? 'capture="environment"' : ''} data-change="photo-chosen" data-hint="${esc(hint || '')}" aria-label="${label}"></label>`;
  const sub = hint === 'lab' ? 'A clear, flat photo of the results page.' : hint === 'pantry' ? 'Your fridge, pantry or counter. You\'ll get three kosher ideas.' : 'A lab report, your fridge, or a plate. The coach works out which.';
  openSheet({ title: 'Photo', body: `<p class="sub">${esc(sub)}</p><div class="inset">${input(true, 'Take photo')}${input(false, 'Choose from library')}</div>` });
}
async function sendPhoto(file, hint) {
  closeSheet();
  if (route().name !== 'coach' || route().parts[1]) go('coach');
  chat.photo = { label: hint === 'lab' ? 'Reading your results' : 'Looking at your photo' };
  rerender();
  try {
    const data = await resizeImage(file, hint === 'lab' ? 1800 : 1280, hint === 'lab' ? 0.85 : 0.75);
    const r = await call('photo', { data, hint: hint || '' }, { timeout: 180000 });
    const th = S.data.coach.thread = S.data.coach.thread || [];
    (r.messages || []).forEach((m) => { if (!th.some((x) => x.id === m.id)) th.push(m); });
    if (r.labs) { const labs = (S.data.labs = S.data.labs || {}); labs[S.meId()] = (labs[S.meId()] || []).concat(r.labs); }
    S.persist();
    setTimeout(() => S.sync(), 2500);
  } catch (e) { toast(e.message, { kind: 'err', ms: 6000 }); }
  chat.photo = null;
  S.changed();
}

// ------------------------------------------------------------------ Coach notes sheet (D11)
function notesSheet() {
  const notes = S.notes();
  const wish = (S.data.wishlist || []).filter((w) => w.status !== 'deleted' && w.status !== 'done');
  const since = L.addDays(S.today(), -7);
  const learned = notes.filter((n) => (n.date || String(n.ts).slice(0, 10)) >= since).slice(0, 5);
  openSheet({ title: 'Coach notes', body: `<div class="inset">
      ${row({ icon: 'sparkles', label: 'What the coach knows', sub: 'See, change or delete anything', value: notes.length + (notes.length === 1 ? ' note' : ' notes'), act: 'go', data: { 'data-to': 'coach/knows' } })}
      ${row({ icon: 'calendar-check', label: 'My plan', sub: 'Goals, levels and why', act: 'go', data: { 'data-to': 'coach/plan' } })}
      ${row({ icon: 'book-open', label: 'Guides', sub: 'Food, sleep, Shabbat, fast days, travel', act: 'go', data: { 'data-to': 'coach/guides' } })}
      ${row({ icon: 'star', label: 'Wish list', sub: 'Ideas the coach has for the app', value: wish.length ? wish.length + (wish.length === 1 ? ' idea' : ' ideas') : 'None yet', act: 'go', data: { 'data-to': 'coach/wish' } })}</div>
    <div><div class="eyebrow" style="margin:0 4px 6px">Learned this week</div>${learned.length ? `<div class="inset">${learned.map((n) => row({ label: Pages.noteText(n.note), value: dayName(n.date || String(n.ts).slice(0, 10)).slice(0, 3) })).join('')}</div>` : '<p class="sub" style="padding:0 4px">Nothing new yet.</p>'}
    <p class="caption" style="margin:8px 4px 0">The coach saves what it learns from your chats here.</p></div>` });
}

// ------------------------------------------------------------------ actions
export const actions = Object.assign({}, Pages.actions, {
  'notes-sheet'() { notesSheet(); },
  'chat-send'(el) { const inp = document.getElementById('chat-in'); if (inp && inp.value.trim()) send(inp.value); },
  'chat-retry'() { if (chat.failed) send(chat.failed.text, { retry: true }); },
  /** Dictation: the first tap starts the microphone inside the tap; the second tap stops and writes the words in the box. */
  'chat-mic'() {
    if (chat.transcribing) return;
    if (chat.dictating) {
      chat.dictating = false;
      chat.transcribing = true; rerender();
      Mic.stop().then((rec) => Mic.transcribe(rec)).then((text) => {
        const inp = document.getElementById('chat-in');
        const base = (inp ? inp.value : chat.draft).trim();
        chat.draft = (base ? base + ' ' : '') + (text || '');
        if (!text) toast('I didn\'t catch that. Try again a little closer to the phone.', { icon: 'mic' });
      }).catch((e) => toast(e.message, { kind: 'err' })).then(() => { chat.transcribing = false; rerender(); setTimeout(() => { const i = document.getElementById('chat-in'); if (i) i.focus(); }, 50); });
      return;
    }
    const inp = document.getElementById('chat-in');
    if (inp) chat.draft = inp.value;
    const started = Mic.start({ maxMs: 60000, bar: true, label: 'Listening', onAuto: () => { if (chat.dictating) actions['chat-mic'](); } }); // getUserMedia runs inside this tap
    chat.dictating = true; rerender();
    started.then(() => tipOnce('dictate', 'Tap the microphone again when you\'re done.')).catch((e) => { chat.dictating = false; rerender(); showMicHelp(e); });
  },
  /** Talk: the microphone starts inside the tap, then the Talk screen opens. */
  talk() {
    if (S.quiet().quiet) { toast('Talk rests on Shabbat and Yom Tov.', { icon: 'moon' }); return; }
    if (chat.dictating) { Mic.cancel(); chat.dictating = false; }
    Voice.unlock();
    talk.state = 'starting'; talk.you = ''; talk.coach = ''; talk.silent = 0; talk.muted = false;
    const started = Mic.start({ vad: true, maxMs: 60000, silenceMs: 1200, noSpeechMs: 9000, bar: false, onLevel: (lv) => { talk.level = lv; }, onAuto: (why) => { talk.why = why; } });
    go('coach/talk');
    started.then(() => talkLoop()).catch((e) => { endTalk(); back('coach'); showMicHelp(e); });
  },
  'talk-mute'() { talk.muted = !talk.muted; if (talk.muted) Mic.cancel(); rerender(); },
  'talk-end'() { endTalk(); back('coach'); },
  'talk-chat'() { endTalk(); go('coach', { replace: true }); },
  'photo-sheet'(el) { photoSheet(el.dataset.hint); },
  confirm(el) {
    const accept = el.dataset.accept === '1';
    S.write('confirm', { tab: el.dataset.tab, id: el.dataset.id, accept });
    toast(accept ? 'Added.' : 'Okay, skipped.');
    if (accept) setTimeout(() => S.sync(), 3000);
  },
  undo(el) { S.write('retract', { tab: el.dataset.tab, id: el.dataset.id }); el.closest('.logchip') && el.closest('.logchip').remove(); toast('Undone.', { icon: 'rotate-ccw' }); }
});
export const changes = Object.assign({}, Pages.changes || {}, {
  'photo-chosen'(el) { const f = el.files && el.files[0]; if (f) sendPhoto(f, el.dataset.hint); }
});
export { send as sendToCoach };
