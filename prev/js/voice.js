/* Our Plan — one natural voice everywhere (E1, E2): OpenAI text-to-speech through the back office.
 * - The first tap anywhere unlocks audio with a silent buffer, so the coach's voice can play later.
 * - Every line and every Talk turn plays through a fresh <audio> object, so the iPhone's audio session never
 *   stays locked after playback (and the microphone can start again).
 * - Clips are cached on the phone (repeats are free and instant). Falls back to the phone's built-in voice when
 *   offline, when the service fails, or when the household voice is switched off. Never speaks during Shabbat / Yom Tov.
 * - One Play/Pause control per text: the same key pauses and resumes.
 */
import { call } from './api.js';
import { S } from './store.js';

const CACHE = 'op-voice-v1';
const MAX_CACHED = 400;
const listeners = new Set();
const memo = new Map();
let unlocked = false;
let current = null;   // { key, chunks, i, paused, mode: 'audio'|'builtin', audio }
let gen = 0;
let naturalBroken = 0; // time of the last service failure: fall back for 2 minutes
let clipAudio = null;

function emit() { listeners.forEach((fn) => { try { fn(current); } catch (e) { /* ignore */ } }); }
function household() { return (S.data && S.data.household) || {}; }
function voiceName() { return household().voice || 'marin'; }
function quiet() { try { return !!(S.ready && S.quiet().quiet); } catch (e) { return false; } }
function audioSession(type) { try { if (navigator.audioSession && navigator.audioSession.type !== type) navigator.audioSession.type = type; } catch (e) { /* Safari 17+ only */ } }
export function naturalAvailable() {
  return household().voice_on !== false && S.hasCoach() && navigator.onLine !== false && Date.now() - naturalBroken > 120000;
}

// ------------------------------------------------------------------ unlock on the first tap (a silent buffer)
let silentUrlCache = null;
function silentUrl() { if (!silentUrlCache) silentUrlCache = makeTone(440, 40, 0); return silentUrlCache; }
export function unlock() {
  if (unlocked) return;
  unlocked = true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) { const ctx = new AC(); const b = ctx.createBuffer(1, 1, 22050); const src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(0); setTimeout(() => { try { ctx.close(); } catch (e) { /* ignore */ } }, 300); }
  } catch (e) { /* ignore */ }
  try { const a = new Audio(silentUrl()); a.setAttribute('playsinline', ''); const p = a.play(); if (p && p.catch) p.catch(() => { unlocked = false; }); } catch (e) { unlocked = false; }
}
document.addEventListener('pointerdown', unlock, { passive: true });
document.addEventListener('keydown', unlock);

// ------------------------------------------------------------------ clips
async function sha(text) {
  if (window.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
  }
  let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return 'h' + (h >>> 0).toString(16) + text.length;
}
function b64ToBlob(b64, mime) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime || 'audio/mpeg' });
}
/** An object URL for a spoken line in the household voice (cached), or null if unavailable. */
async function clip(text, opts = {}) {
  const voice = opts.voice || voiceName();
  const key = voice + '|' + (opts.cue ? 'cue' : 'talk') + '|' + text;
  if (memo.has(key)) return memo.get(key);
  const url = new URL('voice-cache/' + voice + '/' + await sha(key) + '.mp3', location.href).href;
  let cache = null;
  try { cache = await caches.open(CACHE); const hit = await cache.match(url); if (hit) { const u = URL.createObjectURL(await hit.blob()); memo.set(key, u); return u; } } catch (e) { cache = null; }
  if (!opts.preview && !naturalAvailable()) return null;
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
}
/** Fetch lines ahead of time (exercise names, "3, 2, 1") so they play instantly later. */
export function prefetch(lines, opts = {}) {
  if (!naturalAvailable() || quiet()) return;
  lines.filter(Boolean).reduce((p, t) => p.then(() => clip(t, Object.assign({ cache: true }, opts)).catch(() => null)), Promise.resolve());
}
/** Split long text into speakable chunks (sentences, about 400 characters each). */
export function chunks(text) {
  const clean = String(text || '').replace(/[•·→]/g, ', ').replace(/\s+/g, ' ').trim();
  if (clean.length <= 420) return clean ? [clean] : [];
  const parts = clean.match(/[^.!?]+[.!?]+["')]*\s*|[^.!?]+$/g) || [clean];
  const out = [];
  let buf = '';
  parts.forEach((p) => { if ((buf + p).length > 400 && buf) { out.push(buf.trim()); buf = ''; } buf += p; });
  if (buf.trim()) out.push(buf.trim());
  return out;
}

// ------------------------------------------------------------------ playback: a fresh <audio> for every line
function playUrl(url, holder) {
  return new Promise((resolve, reject) => {
    const a = new Audio();
    a.setAttribute('playsinline', '');
    a.preload = 'auto';
    if (holder) holder.audio = a;
    a.onended = () => { a.onended = null; a.onerror = null; resolve(); };
    a.onerror = () => { a.onended = null; a.onerror = null; reject(new Error('audio')); };
    audioSession('playback');
    a.src = url;
    const p = a.play();
    if (p && p.catch) p.catch(reject);
  });
}
let builtin = null;
function pickBuiltin() {
  const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  builtin = vs.find((v) => /en-US/i.test(v.lang) && /Samantha|Aaron|Nicky|Google US/i.test(v.name)) || vs.find((v) => /^en-US/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
}
if (window.speechSynthesis) { pickBuiltin(); if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', pickBuiltin); }
function speakBuiltin(text, rate) {
  return new Promise((resolve) => {
    if (!window.speechSynthesis) { resolve(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    if (builtin) u.voice = builtin;
    u.rate = rate || 1;
    u.onend = () => resolve(true); u.onerror = () => resolve(false);
    speechSynthesis.speak(u);
  });
}

// ------------------------------------------------------------------ public API
/**
 * Say something. opts: { key (for Play/Pause), cache (reusable line), cue (crisp counting), queue (wait for the
 * current line) }. Resolves when finished or stopped.
 */
export async function say(text, opts = {}) {
  const parts = chunks(text);
  if (!parts.length || quiet()) return;
  if (opts.queue && current) await new Promise((r) => { const t = setInterval(() => { if (!current) { clearInterval(t); r(); } }, 120); });
  else stop();
  const my = ++gen;
  const me = { key: opts.key || null, chunks: parts, i: 0, paused: false, mode: 'audio', audio: null };
  current = me;
  emit();
  try {
    let next = naturalAvailable() ? clip(parts[0], opts).catch(() => null) : Promise.resolve(null);
    for (let i = 0; i < parts.length; i++) {
      if (my !== gen) return;
      me.i = i;
      let url = await next;
      if (my !== gen) return;
      next = i + 1 < parts.length && naturalAvailable() ? clip(parts[i + 1], opts).catch(() => null) : Promise.resolve(null);
      if (url) {
        me.mode = 'audio'; emit();
        try { await playUrl(url, me); } catch (e) { url = null; }
        if (my !== gen) return;
      }
      if (!url) {
        if (naturalAvailable() && navigator.onLine !== false) naturalBroken = Date.now();
        me.mode = 'builtin'; emit();
        await speakBuiltin(parts[i], opts.rate);
      }
      if (my !== gen) return;
    }
  } finally {
    if (my === gen && current === me) { current = null; emit(); }
  }
}
export function stop() {
  gen++;
  const c = current;
  if (c && c.audio) { try { c.audio.pause(); c.audio.onended = null; c.audio.onerror = null; } catch (e) { /* ignore */ } }
  try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) { /* ignore */ }
  if (current) { current = null; emit(); }
}
export function pause() {
  const c = current;
  if (!c || c.paused) return;
  c.paused = true;
  try { if (c.mode === 'audio' && c.audio) c.audio.pause(); else if (window.speechSynthesis) speechSynthesis.pause(); } catch (e) { /* ignore */ }
  emit();
}
export function resume() {
  const c = current;
  if (!c || !c.paused) return;
  c.paused = false;
  try { if (c.mode === 'audio' && c.audio) c.audio.play(); else if (window.speechSynthesis) speechSynthesis.resume(); } catch (e) { /* ignore */ }
  emit();
}
/** One control per text: the same key pauses and resumes; another key starts fresh. */
export function toggle(key, text, opts = {}) {
  if (current && current.key === key) { if (current.paused) resume(); else pause(); return; }
  say(text, Object.assign({}, opts, { key }));
}
export const speaking = () => !!current;
export const nowPlaying = () => current;
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** Spoken confirmations ("Logged. Nice work. Keep going.") — only when that setting is on. */
export function confirm(text) { if (S.settings().spoken !== false) say(text, { cache: true }); }

/** Talk: play one reply's audio (base64 mp3) through a fresh audio object. Resolves when it ends or is stopped. */
export function playClip(b64) {
  stopClip();
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(b64ToBlob(b64, 'audio/mpeg'));
      const a = new Audio();
      a.setAttribute('playsinline', '');
      clipAudio = a;
      const done = () => { a.onended = null; a.onerror = null; URL.revokeObjectURL(url); if (clipAudio === a) clipAudio = null; resolve(); };
      a.onended = done; a.onerror = done;
      audioSession('playback');
      a.src = url;
      const p = a.play();
      if (p && p.catch) p.catch(done);
    } catch (e) { resolve(); }
  });
}
export function stopClip() { const a = clipAudio; clipAudio = null; if (a) { try { a.pause(); if (a.onended) a.onended(); } catch (e) { /* ignore */ } } }

/** The owner's voice preview in Settings (any of the four voices). */
export async function preview(voice, text) {
  stop();
  const my = ++gen;
  const me = { key: 'preview:' + voice, chunks: [text], i: 0, paused: false, mode: 'audio', audio: null };
  current = me; emit();
  try { const url = await clip(text, { voice, preview: true, cache: true }); if (my === gen && url) await playUrl(url, me); }
  finally { if (my === gen && current === me) { current = null; emit(); } }
}
/** iPhone check: speak one line and report how it went. */
export async function test(text) {
  if (quiet()) return { ok: false, detail: 'Voice rests on Shabbat and Yom Tov.' };
  stop();
  try {
    if (naturalAvailable()) {
      const url = await clip(text, { cache: true });
      if (url) { await playUrl(url, {}); return { ok: true, detail: 'Played in the natural voice.' }; }
    }
    const ok = await speakBuiltin(text);
    return ok ? { ok: true, detail: 'Played in the phone\'s built-in voice' + (household().voice_on === false ? ' (natural voice is off).' : '.') } : { ok: false, detail: 'No voice could play.' };
  } catch (e) {
    return { ok: false, detail: ((e && e.name && e.name !== 'Error') ? e.name + ': ' : '') + ((e && e.message) || 'The voice didn\'t play.') };
  }
}

// ------------------------------------------------------------------ soft beeps for countdowns
let tones = null;
function makeTone(freq, ms, vol) {
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
/** A soft beep: 'tick' for 3-2-1, 'go' when the set starts or the rest ends. */
export function beep(kind = 'tick') {
  if (quiet()) return;
  if (!tones) tones = { tick: makeTone(880, 110, 0.18), go: makeTone(1320, 220, 0.2) };
  try { const a = new Audio(tones[kind] || tones.tick); a.setAttribute('playsinline', ''); const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
}
