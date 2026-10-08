/* Our Plan — one audio pipeline for the whole app (Round 3.2, A1–A6).
 * - ONE <audio> element, created and unlocked inside the first tap (touchend / click / key: on iPhone a touch's pointerdown
 *   doesn't count as a tap), then reused for every line by swapping its source through a play queue. iPhone lets an element
 *   that once played inside a tap play again later without a tap, so lines started by a timer (workout cues) or by a
 *   network answer (Talk, Play after loading) play too. A fresh audio object is never made outside a tap.
 *   Why an <audio> element and not Web Audio: it plays with the ringer switch on silent, like a podcast, with no tricks.
 * - It is primed again (a silent clip) when the app comes back to the screen and after any microphone use, because
 *   recording changes the iPhone's audio session.
 * - Fixed workout lines are small mp3 files in the app (voice/<voice>/<id>.mp3, made once by tools/voice-lines.js),
 *   kept by the service worker for the chosen voice. Dynamic lines (coach replies, the plan) are made sentence by
 *   sentence through the back office: the first sentence plays while the rest loads; clips are cached on the phone.
 * - Fallback (A4): the phone's built-in voice is used only inside a running workout when a natural line isn't ready in
 *   time. Play, Talk and the Summary speaker never fall back: they say "Couldn't load the voice. Try again."
 *   Every fallback and failure goes to the Problems tab with the exact error.
 * - Never speaks on Shabbat or Yom Tov, and never on its own (rule 11): every line starts from a tap, Talk, a workout
 *   the person started, voice Preview or the iPhone check.
 */
import { call } from './api.js?v=d44773a102';
import { S } from './store.js?v=5199216217';
import { L, K, toast } from './core.js?v=c1a0501fca';

const CACHE = 'op-voice-v1';
const MAX_CACHED = 400;
const listeners = new Set();
const memo = new Map();      // clip key -> object URL
const inflight = new Map();  // clip key -> Promise (one request per line, even when Play and a prefetch ask at once)
let el = null;               // THE audio element
let primed = false;          // it has played inside a tap
let needsPrime = true;
let builtinPrimed = false;
let current = null;          // the job playing or loading: { key, paused, loading, mode, ... }
const queue = [];
let pumping = false;

function emit() { listeners.forEach((fn) => { try { fn(current); } catch (e) { /* ignore */ } }); }
function household() { return (S.data && S.data.household) || {}; }
function voiceName() { return household().voice || 'marin'; }
function quiet() { try { return !!(S.ready && S.quiet().quiet); } catch (e) { return false; } }
function named(name, message) { const e = new Error(message); e.name = name; return e; }
function audioSession(type) { try { if (navigator.audioSession && navigator.audioSession.type !== type) navigator.audioSession.type = type; } catch (e) { /* Safari 17+ only */ } }
/** Dynamic natural lines need the voice switched on, the coach connected and a connection. Fixed lines need none of that. */
export function naturalAvailable() { return household().voice_on !== false && S.hasCoach() && navigator.onLine !== false; }

// ------------------------------------------------------------------ the element, unlocked inside a tap
let silentUrlCache = null;
function silentUrl() { if (!silentUrlCache) silentUrlCache = toneUrl(440, 60, 0); return silentUrlCache; }
function element() {
  if (!el) {
    el = document.createElement('audio');
    el.id = 'op-voice';
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.preload = 'auto';
    el.hidden = true;
    (document.body || document.documentElement).appendChild(el);
  }
  return el;
}
function busyPlaying() { return !!(current && current.mode === 'audio' && el && !el.paused); }
function prime() {
  const a = el;
  if (!a || busyPlaying() || current) return;
  try {
    a.src = silentUrl();
    const p = a.play();
    if (p && p.then) p.then(() => { primed = true; needsPrime = false; }).catch(() => { /* not inside a tap: the next tap primes it */ });
    else { primed = true; needsPrime = false; }
  } catch (e) { /* ignore */ }
}
/** Runs inside every tap (capture phase): the first tap creates and unlocks the element; later taps re-prime it when needed. */
export function unlock() {
  element();
  if (!primed || needsPrime) prime();
  if (!builtinPrimed && window.speechSynthesis) {
    builtinPrimed = true; // iPhone's built-in voice also needs one tap first (used only as the workout fallback)
    try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } catch (e) { builtinPrimed = false; }
  }
}
['touchend', 'click', 'keydown'].forEach((t) => document.addEventListener(t, unlock, { capture: true, passive: true }));
document.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') unlock(); }, { capture: true, passive: true });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { needsPrime = true; if (primed) prime(); } });
/** After the microphone (Talk, the chat microphone, the iPhone check): the audio session changed, so prime again. */
export function afterMic() { needsPrime = true; audioSession('auto'); if (primed) prime(); }

// ------------------------------------------------------------------ clips
async function sha(text) {
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
  }
  return 'h' + L.voiceId(text);
}
function b64ToBlob(b64, mime) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime || 'audio/mpeg' });
}
/** A dynamic line in the household voice through the back office (cached on the phone by text hash). */
function clip(text, opts = {}) {
  const voice = opts.voice || voiceName();
  const key = voice + '|' + (opts.cue ? 'cue' : 'talk') + '|' + text;
  if (memo.has(key)) return Promise.resolve(memo.get(key));
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    const url = new URL('voice-cache/' + voice + '/' + await sha(key) + '.mp3', location.href).href;
    let cache = null;
    try { cache = await caches.open(CACHE); const hit = await cache.match(url); if (hit) { const u = URL.createObjectURL(await hit.blob()); memo.set(key, u); return u; } } catch (e) { cache = null; }
    const r = await call('speak', { text, cache: !!opts.cache, cue: !!opts.cue, voice: opts.preview ? voice : undefined, preview: !!opts.preview }, { timeout: 30000 });
    const blob = b64ToBlob(r.audio, r.mime);
    if (cache) {
      try {
        await cache.put(url, new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }));
        const keys = await cache.keys();
        for (let i = 0; i < keys.length - MAX_CACHED; i++) await cache.delete(keys[i]);
      } catch (e) { /* storage full: fine */ }
    }
    const u = URL.createObjectURL(blob);
    memo.set(key, u);
    return u;
  })();
  inflight.set(key, p);
  p.then(() => inflight.delete(key), () => inflight.delete(key));
  return p;
}
// fixed workout lines (A2): static files listed in voice/lines.json
let fixedIndex = null;
function fixedLines() {
  if (!fixedIndex) {
    fixedIndex = fetch(new URL('voice/lines.json?v=255d8a19b4', document.baseURI).href).then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
      .then((j) => ({ voices: new Set(j.voices || []), ids: new Set(Object.keys(j.lines || {})) }));
  }
  return fixedIndex;
}
async function fixedClip(text, voice) {
  const id = L.voiceId(text);
  const key = 'fixed|' + voice + '|' + id;
  if (memo.has(key)) return memo.get(key);
  const f = await fixedLines();
  if (!f.voices.has(voice) || !f.ids.has(id)) return null;
  const r = await fetch(new URL('voice/' + voice + '/' + id + '.mp3', document.baseURI).href);
  if (!r.ok) return null;
  const u = URL.createObjectURL(await r.blob());
  memo.set(key, u);
  return u;
}
/** A workout prefetches all its fixed lines when it starts (from the phone's own copy, so it's quick). */
export function prepare(texts) {
  const v = voiceName();
  return (texts || []).filter(Boolean).reduce((p, t) => p.then(async () => {
    const f = await fixedClip(t, v).catch(() => null);
    if (!f && naturalAvailable() && !quiet()) await clip(t, { voice: v, cache: true }).catch(() => null); // a move the coach added: made once, then free
  }), Promise.resolve());
}
/** A3: make a dynamic line in the background the moment its text arrives (first sentence first). Cached lines cost nothing. */
const prefetched = new Set();
export function prefetchText(text) {
  if (!text || !naturalAvailable() || quiet()) return;
  const voice = voiceName();
  const k = voice + '|' + text;
  if (prefetched.has(k)) return;
  prefetched.add(k);
  L.speechParts(text).reduce((p, t) => p.then(() => clip(t, { voice }).catch(() => null)), Promise.resolve());
}
/** Ask the service worker to keep the chosen voice's fixed lines on the phone. */
export function precacheFixed() {
  try { if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'voice', voice: voiceName() }); } catch (e) { /* ignore */ }
}
async function loadPart(text, opts, voice) {
  if (opts.tone) return opts.tone;
  if (opts.workout) { const f = await fixedClip(text, voice).catch(() => null); if (f) return f; }
  if (!opts.preview && !naturalAvailable()) {
    throw named('VoiceOff', household().voice_on === false ? 'The natural voice is switched off.' : (!S.hasCoach() ? 'The coach isn\'t connected.' : 'This phone is offline.'));
  }
  return clip(text, { voice, cue: opts.cue, cache: opts.cache || opts.workout, preview: opts.preview });
}

// ------------------------------------------------------------------ playback on the one element
function mediaError(a) {
  const c = a && a.error ? a.error.code : 0;
  return named('MediaError', ['', 'aborted', 'network error', 'could not decode the audio', 'format not supported'][c] || 'the audio element failed');
}
function playOn(url, job) {
  const a = element();
  return new Promise((resolve, reject) => {
    let started = false, done = false, stall = null;
    const off = () => { a.removeEventListener('playing', onPlaying); a.removeEventListener('ended', onEnded); a.removeEventListener('error', onError); clearTimeout(stall); job.end = null; };
    const end = (fn, v) => { if (done) return; done = true; off(); fn(v); };
    const onPlaying = () => { started = true; if (job.firstMs == null) { job.firstMs = Math.round(performance.now() - job.t0); emit(); } };
    const onEnded = () => end(resolve);
    const onError = () => end(reject, mediaError(a));
    a.addEventListener('playing', onPlaying);
    a.addEventListener('ended', onEnded);
    a.addEventListener('error', onError);
    job.end = () => end(resolve);
    // iPhone sometimes neither plays nor reports: a line that hasn't started in 8 seconds counts as failed
    stall = setTimeout(() => { if (!started && !job.paused) end(reject, named('StallError', 'The line did not start within 8 seconds.')); }, 8000);
    try { a.src = url; } catch (e) { end(reject, e); return; }
    let p;
    try { p = a.play(); } catch (e) { end(reject, e); return; }
    if (p && p.then) p.then(() => { started = true; if (job.firstMs == null) { job.firstMs = Math.round(performance.now() - job.t0); emit(); } }, (e) => end(reject, e));
  });
}
let builtin = null;
function pickBuiltin() {
  const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  builtin = vs.find((v) => /en-US/i.test(v.lang) && /Samantha|Aaron|Nicky|Google US/i.test(v.name)) || vs.find((v) => /^en-US/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
}
if (window.speechSynthesis) { pickBuiltin(); if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', pickBuiltin); }
function speakBuiltin(text) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    if (builtin) u.voice = builtin;
    const t = setTimeout(() => resolve(false), 15000);
    u.onend = () => { clearTimeout(t); resolve(true); };
    u.onerror = () => { clearTimeout(t); resolve(false); };
    speechSynthesis.speak(u);
  });
}

// ------------------------------------------------------------------ problems: every fallback and failure, with the exact error
const reportedVoice = new Set();
function logVoice(what, err, job, part) {
  const name = (err && err.name) || 'Error';
  const msg = 'Voice ' + what + ' (' + (job.opts.workout ? 'workout' : job.opts.kind || 'line') + '): ' + name + ': ' + String((err && err.message) || '').slice(0, 160);
  if (reportedVoice.has(msg) || reportedVoice.size > 30) return;
  reportedVoice.add(msg);
  const detail = 'part ' + (part + 1) + ' of ' + job.parts.length + ', ' + String(job.parts[part] || '').length + ' chars; primed=' + primed + '; online=' + (navigator.onLine !== false) + '; session=' + ((navigator.audioSession && navigator.audioSession.type) || 'n/a') + '; hidden=' + (document.visibilityState === 'hidden');
  call('report', { message: msg, where: 'voice', stack: detail, version: window.OUR_PLAN_VERSION || '' }).catch(() => {});
}

// ------------------------------------------------------------------ the queue
function settle(job, result) { if (job.settled) return; job.settled = true; job.resolve(result); }
function clearAll() {
  queue.splice(0).forEach((j) => { j.cancelled = true; settle(j, { ok: false, stopped: true }); });
  const c = current;
  if (c) { c.cancelled = true; if (c.end) c.end(); }
  try { if (el && !el.paused) el.pause(); } catch (e) { /* ignore */ }
  try { if (window.speechSynthesis && speechSynthesis.speaking) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
}
async function pump() {
  if (pumping) return;
  pumping = true;
  try { while (queue.length) await run(queue.shift()); } finally { pumping = false; }
}
function race(p, ms) { return Promise.race([p, new Promise((r) => setTimeout(() => r({ timeout: true }), ms))]); }
async function run(job) {
  if (job.cancelled) { if (current === job) { current = null; emit(); } settle(job, { ok: false, stopped: true }); return; }
  current = job;
  job.loading = true;
  emit();
  const voice = job.opts.voice || voiceName();
  const loads = [];
  const load = (i) => loads[i] || (loads[i] = loadPart(job.parts[i], job.opts, voice).then((url) => ({ url }), (err) => ({ err })));
  load(0);
  if (job.parts.length > 1 && !job.opts.workout) load(1); // A3: two sentences on the way at once, so there's no gap after the first
  let natural = true, err = null;
  for (let i = 0; i < job.parts.length && !job.cancelled; i++) {
    job.loading = true; emit();
    const limit = job.opts.workout ? 2500 : 30000; // a workout cue that isn't ready in time is said by the built-in voice
    let r = await race(load(i), limit);
    if (i + 1 < job.parts.length) load(i + 1); // the next sentence loads while this one plays
    if (i + 2 < job.parts.length && !job.opts.workout) load(i + 2);
    if (job.cancelled) break;
    job.loading = false;
    if (r.url) {
      try { job.mode = 'audio'; emit(); await playOn(r.url, job); continue; }
      catch (e) { if (job.cancelled) break; r = { err: e }; }
    }
    err = r.err || named('TimeoutError', 'The voice wasn\'t ready within ' + Math.round(limit / 1000) + ' seconds.');
    natural = false;
    if (job.opts.workout) {
      if (!(err.name === 'VoiceOff')) logVoice('fallback to the built-in voice', err, job, i);
      job.mode = 'builtin'; emit();
      await speakBuiltin(job.parts[i]);
      continue;
    }
    if (err.name !== 'VoiceOff' && !job.opts.tone) logVoice('failed', err, job, i);
    break;
  }
  const stopped = !!job.cancelled;
  const ok = !stopped && (natural || !!job.opts.workout);
  if (current === job) { current = null; emit(); }
  settle(job, { ok, stopped, natural: !stopped && natural, firstMs: job.firstMs, error: ok || stopped ? null : err });
}
/**
 * Say something through the one pipeline. opts: { key (Play/Pause), workout (fixed lines first; the built-in voice only
 * when a line isn't ready in time), cue (crisp counting), queue (wait for the current line), voice, preview, kind }.
 * Resolves { ok, stopped, natural, firstMs, error } when finished or stopped.
 */
export function say(text, opts = {}) {
  if (quiet()) return Promise.resolve({ ok: false, quiet: true });
  const parts = opts.workout ? [String(text || '').trim()].filter(Boolean) : L.speechParts(text);
  if (!parts.length) return Promise.resolve({ ok: true });
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  const job = { key: opts.key || null, parts, opts, paused: false, loading: true, mode: '', t0: performance.now(), firstMs: null, resolve };
  if (!opts.queue) clearAll();
  queue.push(job);
  if (!opts.queue || !current) { current = job; emit(); } // Play shows its spinner at once, even while a stopped line winds down
  pump();
  return done;
}
export function stop() { clearAll(); }
export function pause() {
  const c = current;
  if (!c || c.paused) return;
  c.paused = true;
  try { if (c.mode === 'builtin' && window.speechSynthesis) speechSynthesis.pause(); else if (el) el.pause(); } catch (e) { /* ignore */ }
  emit();
}
export function resume() {
  const c = current;
  if (!c || !c.paused) return;
  c.paused = false;
  try { if (c.mode === 'builtin' && window.speechSynthesis) speechSynthesis.resume(); else if (el && c.mode === 'audio') { const p = el.play(); if (p && p.catch) p.catch(() => {}); } } catch (e) { /* ignore */ }
  emit();
}
const FAIL_TEXT = 'Couldn\'t load the voice. Try again.';
function failMessage(r) {
  if (r.error && r.error.name === 'VoiceOff') return household().voice_on === false ? 'The natural voice is off. The owner can turn it on in Settings.' : r.error.message;
  return FAIL_TEXT;
}
/** One control per text (Play, the Summary speaker): the same key pauses and resumes; never the built-in voice. */
export function toggle(key, text, opts = {}) {
  if (current && current.key === key) { if (current.paused) resume(); else pause(); return Promise.resolve({ ok: true }); }
  return say(text, Object.assign({ kind: 'play' }, opts, { key })).then((r) => {
    if (!r.ok && !r.stopped && !r.quiet) toast(failMessage(r), { kind: 'err', ms: 5000 });
    return r;
  });
}
/** Talk (A5): speak a reply through the pipeline; the caller shows the text if it fails. first = { text, audio } — the first
 * sentence's audio that came with the answer, so the voice starts the moment the reply arrives. */
export function speakReply(text, first) {
  const clean = String(text || '').replace(/!(\s|$)/g, '.$1');
  if (first && first.audio && first.text) {
    const key = voiceName() + '|talk|' + first.text;
    if (!memo.has(key)) { try { memo.set(key, URL.createObjectURL(b64ToBlob(first.audio, first.mime))); } catch (e) { /* the pipeline fetches it */ } }
  }
  L.speechParts(clean).slice(1).forEach((p) => { clip(p, {}).catch(() => null); }); // the rest loads while the first plays
  return say(clean, { key: 'talk', kind: 'talk' });
}
export const speaking = () => !!current;
export const nowPlaying = () => current;
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** The owner's voice preview in Settings (any of the four voices). */
export function preview(voice, text) {
  return toggle('preview:' + voice, text, { voice, preview: true, kind: 'preview' });
}

// ------------------------------------------------------------------ iPhone check (A6): three real tests
export const TEST_SHORT = 'This is your coach. The voice works.';
export const TEST_LONG = 'Here is a longer line, like a coach reply or your plan for today. It is made one sentence at a time, so the first sentence plays while the rest is still loading. If all three sentences sound like the same warm voice, long lines work too.';
function testDetail(r, what) {
  if (r.quiet) return { ok: false, detail: 'Voice rests on Shabbat and Yom Tov.' };
  if (!r.ok) return { ok: false, detail: (r.error ? (r.error.name !== 'Error' ? r.error.name + ': ' : '') + r.error.message : 'It didn\'t play.') };
  const secs = r.firstMs != null ? ' First sound after ' + (r.firstMs / 1000).toFixed(1) + ' s.' : '';
  return { ok: !!r.natural, natural: !!r.natural, firstMs: r.firstMs, detail: (r.natural ? what + ' played in the natural voice.' : what + ' played in the built-in voice, not the natural one.') + secs };
}
export async function testShort() { return testDetail(await say(TEST_SHORT, { key: 'check:short', kind: 'check' }), 'The short line'); }
export async function testLong() { return testDetail(await say(TEST_LONG, { key: 'check:long', kind: 'check' }), 'The long paragraph'); }
/** A fixed line started by a 3-second timer after the tap, like a workout cue. */
export function testTimer(ms = 3000) {
  return new Promise((res) => setTimeout(async () => {
    const r = await say(K.SPOKEN.nextUp, { key: 'check:timer', workout: true, kind: 'check' });
    res(testDetail(r, 'The cue started by a timer'));
  }, ms));
}

// ------------------------------------------------------------------ the go beep (through the same element, in the queue)
function toneUrl(freq, ms, vol) {
  const rate = 22050, n = Math.floor(rate * ms / 1000);
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / (rate * 0.01), (n - i) / (rate * 0.04));
    v.setInt16(44 + i * 2, Math.sin(2 * Math.PI * freq * i / rate) * 32767 * vol * env, true);
  }
  return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
}
let goTone = null;
/** A soft beep when a timed set or a rest ends (workouts only). */
export function beep() {
  if (quiet()) return;
  if (!goTone) goTone = toneUrl(1320, 220, 0.2);
  let resolve;
  const done = new Promise((r) => { resolve = r; });
  queue.push({ key: 'beep', parts: ['beep'], opts: { tone: goTone, kind: 'beep' }, paused: false, t0: performance.now(), resolve });
  pump();
  return done;
}
