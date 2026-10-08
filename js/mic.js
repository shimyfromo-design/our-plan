/* Our Plan — the microphone (E1).
 * - getUserMedia({audio: true}) is called first thing, inside the tap that starts it. The iPhone's audio session is
 *   switched to "play-and-record" just before (Round 2 left it on "playback", which blocked the microphone without
 *   ever showing the permission question — the Oct 7 report).
 * - On WebKit (iPhone) the sound is captured through Web Audio (AudioWorklet, ScriptProcessor as a fallback),
 *   resampled to 16 kHz mono and saved as 16-bit PCM WAV. Elsewhere MediaRecorder with the first type it supports.
 * - It can't get stuck: a hard stop at maxMs (60 s), and it stops when the screen is hidden or the app goes away.
 * - Every failure is logged to the Problems tab with the exact error name.
 * - Round 3.2 (A5): with { keep: true } (Talk) the stream stays open between turns, so the microphone is asked for once
 *   per Talk session; each turn only starts and stops capturing. close() (End, or the app going to the background)
 *   releases it. Every release primes the voice again, because recording changes the iPhone's audio session.
 */
import { icon, esc } from './core.js?v=c1a0501fca';
import { call } from './api.js?v=d44773a102';
import * as Voice from './voice.js?v=decfa3dab7';
import { encodeWav, resample, rms, createVad, joinFrames } from './wav.js?v=962fbb04c0';

const listeners = new Set();
let session = null;

const UA = () => navigator.userAgent || '';
export const isWebKit = () => /AppleWebKit/.test(UA()) && !/Chrome|Chromium|CriOS|Edg|OPR|Android/.test(UA());
export const supported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
/** Capturing right now. */
export const live = () => !!(session && session.capturing);
/** The microphone stream is open (capturing or kept open between Talk turns). */
export const open = () => !!session;
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function emit() { listeners.forEach((fn) => { try { fn(!!session); } catch (e) { /* ignore */ } }); }
function audioSession(type) { try { if (navigator.audioSession && navigator.audioSession.type !== type) navigator.audioSession.type = type; } catch (e) { /* Safari 17+ only */ } }

function pickMime() {
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => { try { return MediaRecorder.isTypeSupported(m); } catch (e) { return false; } }) || '';
}

/** A friendly error that keeps the exact name. */
function friendly(e) {
  const name = (e && e.name) || 'Error';
  const denied = /NotAllowed|Security|PermissionDenied/.test(name);
  const msg = denied ? 'Our Plan isn\'t allowed to use the microphone.'
    : /NotFound|DevicesNotFound/.test(name) ? 'No microphone was found on this phone.'
    : /NotReadable|TrackStart|Abort/.test(name) ? 'The microphone is busy. Close other apps that use it, then try again.'
    : /InvalidState|InvalidAccess/.test(name) ? 'The microphone couldn\'t start. Close Our Plan fully, open it again and try once more.'
    : /NotSupported|TypeError/.test(name) ? 'This phone can\'t record here. The keyboard\'s microphone still works.'
    : 'The microphone didn\'t start (' + name + ').';
  const err = new Error(msg);
  err.name = name; err.denied = denied; err.detail = (e && e.message) || '';
  return err;
}
function logFailure(err) {
  call('report', { message: 'Microphone: ' + err.name + ': ' + String(err.detail || err.message).slice(0, 200), where: 'mic', stack: 'webkit=' + isWebKit() + ' standalone=' + (navigator.standalone === true) + ' session=' + ((navigator.audioSession && navigator.audioSession.type) || 'n/a'), version: window.OUR_PLAN_VERSION || '' }).catch(() => {});
}

// ------------------------------------------------------------------ the red listening bar (dictation and checks)
function showBar(label) {
  let el = document.getElementById('mic-bar');
  if (!el) { el = document.createElement('div'); el.id = 'mic-bar'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = `${icon('mic', 'ic-s')}<span>${esc(label || 'Listening')}</span><span class="mic-time" id="mic-time">0:00</span><button type="button" data-act="mic-stop">Stop</button>`;
  el.classList.add('on');
}
function hideBar() { const el = document.getElementById('mic-bar'); if (el) { el.classList.remove('on'); el.innerHTML = ''; } }
function paintTime(s) { const t = document.getElementById('mic-time'); if (t) { const secs = Math.floor((Date.now() - s.started) / 1000); t.textContent = Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'); } }

/**
 * Start recording. Call it directly inside the tap. opts: { maxMs, vad, silenceMs, noSpeechMs, onAuto(reason), onLevel(level), bar, label }.
 * Resolves when recording; rejects with an Error that has .name (exact) and .denied.
 */
export function start(opts = {}) {
  if (session && session.keep) return session.capturing ? Promise.resolve() : nextTurn(session, opts); // Talk: same stream, no new question
  if (session) return Promise.resolve();
  if (!supported()) { const f = friendly({ name: 'NotSupportedError', message: 'navigator.mediaDevices.getUserMedia is missing' }); logFailure(f); return Promise.reject(f); }
  audioSession('play-and-record');
  let gum;
  try { gum = navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { gum = Promise.reject(e); } // first thing, inside the tap
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null;
  try { ctx = AC ? new AC() : null; if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); } catch (e) { ctx = null; }
  Voice.stop();
  const wavPath = isWebKit() || !window.MediaRecorder;
  const s = session = { ctx, opts, started: Date.now(), frames: [], chunks: [], rate: ctx ? ctx.sampleRate : 48000, vad: createVad(opts), level: 0, spoke: false, wav: wavPath && !!ctx, keep: !!opts.keep, capturing: true };
  if (opts.bar) showBar(opts.label);
  s.maxTimer = setTimeout(() => auto('max'), opts.maxMs || 60000);
  s.clock = setInterval(() => paintTime(s), 500);
  emit();
  return gum.then(async (stream) => {
    if (session !== s) { stream.getTracks().forEach((t) => t.stop()); const ab = new Error('Stopped'); ab.name = 'AbortError'; throw ab; }
    s.stream = stream;
    if (ctx) {
      const src = ctx.createMediaStreamSource(stream);
      s.src = src;
      const sink = ctx.createGain(); sink.gain.value = 0; sink.connect(ctx.destination);
      s.sink = sink;
      const onFrame = (f32) => {
        if (session !== s || !s.capturing) return; // between Talk turns the stream stays open but nothing is kept
        if (s.wav) s.frames.push(new Float32Array(f32));
        const lv = rms(f32);
        s.level = lv;
        if (opts.onLevel) { try { opts.onLevel(lv); } catch (e) { /* ignore */ } }
        const ev = s.vad.push(lv, Date.now() - s.started);
        if (s.vad.spoke) s.spoke = true;
        if (ev && opts.vad) auto(ev);
      };
      let ok = false;
      if (ctx.audioWorklet && window.AudioWorkletNode) {
        try {
          await ctx.audioWorklet.addModule(new URL('js/mictap.js?v=1f005f41d5', document.baseURI).href);
          const node = new AudioWorkletNode(ctx, 'op-tap');
          node.port.onmessage = (e) => onFrame(e.data);
          src.connect(node); node.connect(sink);
          s.node = node; ok = true;
        } catch (e) { ok = false; }
      }
      if (!ok && ctx.createScriptProcessor) {
        const sp = ctx.createScriptProcessor(4096, 1, 1);
        sp.onaudioprocess = (e) => onFrame(e.inputBuffer.getChannelData(0));
        src.connect(sp); sp.connect(sink);
        s.node = sp; ok = true;
      }
      if (!ok) s.wav = false;
    }
    if (!s.wav) startRecorder(s);
  }).catch((e) => {
    if (session === s) release();
    const f = e && e.name === 'AbortError' && e.message === 'Stopped' ? e : friendly(e);
    if (f.message !== 'Stopped') logFailure(f);
    throw f;
  });
}
function startRecorder(s) {
  if (!window.MediaRecorder) throw Object.assign(new Error('No way to record audio here'), { name: 'NotSupportedError' });
  const mime = pickMime();
  const rec = s.rec = new MediaRecorder(s.stream, mime ? { mimeType: mime } : undefined);
  s.mime = rec.mimeType || mime || 'audio/webm';
  s.chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size && session === s && s.rec === rec) s.chunks.push(e.data); };
  rec.start(250);
}
/** Talk: the next turn on the stream that is already open. */
function nextTurn(s, opts) {
  Voice.stop();
  s.opts = opts; s.started = Date.now(); s.frames = []; s.chunks = []; s.vad = createVad(opts); s.level = 0; s.spoke = false; s.capturing = true;
  if (opts.bar) showBar(opts.label);
  s.maxTimer = setTimeout(() => auto('max'), opts.maxMs || 60000);
  s.clock = setInterval(() => paintTime(s), 500);
  try { if (s.ctx && s.ctx.state === 'suspended') s.ctx.resume().catch(() => {}); if (!s.wav && s.stream) startRecorder(s); }
  catch (e) { const f = friendly(e); logFailure(f); close(); return Promise.reject(f); }
  emit();
  return Promise.resolve();
}
/** End one recording: a kept (Talk) stream stays open; anything else releases the microphone. */
function endTurn(s) {
  if (!s.keep) { release(); return; }
  s.capturing = false;
  clearTimeout(s.maxTimer); clearInterval(s.clock);
  hideBar();
  emit();
}
function auto(reason) {
  if (!session) return;
  const cb = session.opts.onAuto;
  if (cb) { session.opts.onAuto = null; try { cb(reason); } catch (e) { /* ignore */ } }
  else cancel();
}
function release() {
  const s = session;
  if (!s) return null;
  session = null;
  clearTimeout(s.maxTimer); clearInterval(s.clock);
  try { if (s.node) { s.node.disconnect(); if (s.node.port) s.node.port.onmessage = null; if (s.node.onaudioprocess) s.node.onaudioprocess = null; } } catch (e) { /* ignore */ }
  try { if (s.src) s.src.disconnect(); } catch (e) { /* ignore */ }
  try { if (s.stream) s.stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* ignore */ }
  try { if (s.ctx && s.ctx.state !== 'closed') s.ctx.close(); } catch (e) { /* ignore */ }
  audioSession('auto');
  hideBar();
  emit();
  Voice.afterMic(); // recording changed the iPhone's audio session: prime the voice again
  return s;
}
/** Stop and return { blob, mime, seconds, spoke }. Releases the microphone (a Talk stream stays open for the next turn). */
export function stop() {
  const s = session;
  if (!s || !s.capturing) return Promise.resolve(null);
  const seconds = Math.max(0, (Date.now() - s.started) / 1000);
  if (s.wav || !s.rec) {
    const frames = s.frames, spoke = s.spoke;
    s.frames = [];
    endTurn(s);
    const pcm = resample(joinFrames(frames), s.rate, 16000);
    return Promise.resolve({ blob: new Blob([encodeWav(pcm, 16000)], { type: 'audio/wav' }), mime: 'audio/wav', seconds: Math.round(seconds), spoke });
  }
  const rec = s.rec, chunks = s.chunks, spoke = s.spoke;
  return new Promise((resolve) => {
    const finish = () => resolve({ blob: new Blob(chunks, { type: s.mime }), mime: s.mime, seconds: Math.round(seconds), spoke });
    const t = setTimeout(finish, 1500); // never wait forever for the recorder
    try {
      rec.onstop = () => { clearTimeout(t); finish(); };
      if (rec.state !== 'inactive') rec.stop(); else { clearTimeout(t); finish(); }
    } catch (e) { clearTimeout(t); finish(); }
    endTurn(s);
  });
}
function stopRec(rec) { if (rec) { try { if (rec.state !== 'inactive') rec.stop(); } catch (e) { /* ignore */ } } }
/** Stop and throw the recording away (a Talk stream stays open; use close() to release it). */
export function cancel() {
  const s = session;
  if (!s) return;
  if (s.keep) { if (s.capturing) { const rec = s.rec; endTurn(s); stopRec(rec); } return; }
  release(); stopRec(s.rec);
}
/** Release the microphone completely (Talk's End, or the app going to the background). */
export function close() { const s = release(); if (s) stopRec(s.rec); }

/** Send a recording to the back office and get the words back. */
export async function transcribe(rec, opts = {}) {
  if (!rec || !rec.blob || (rec.blob.size < 800 && !opts.allowSilence)) return '';
  const b64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1] || ''); r.onerror = reject; r.readAsDataURL(rec.blob); });
  const out = await call('transcribe', { audio: b64, mime: rec.mime, seconds: rec.seconds }, { timeout: 60000 });
  return (out && out.text) || '';
}

// Never leave the microphone on by accident.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') close(); });
window.addEventListener('pagehide', close);
