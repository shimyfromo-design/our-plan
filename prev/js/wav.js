/* Our Plan — pure audio helpers for the microphone (E1): resample to 16 kHz mono, encode 16-bit PCM WAV
 * (the format OpenAI reliably accepts from Safari), loudness, and turn-taking (voice activity detection).
 * No browser APIs here, so the tests run them in Node. */

/** Downsample (or upsample) mono samples. Averages the samples each output sample covers (a box filter), so speech stays clean. */
export function resample(input, fromRate, toRate) {
  if (!input || !input.length) return new Float32Array(0);
  if (fromRate === toRate) return Float32Array.from(input);
  const ratio = fromRate / toRate;
  const n = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const start = i * ratio, end = Math.min(input.length, start + ratio);
    if (ratio <= 1) { // upsampling: linear interpolation
      const p = Math.floor(start), f = start - p, a = input[p] || 0, b = input[Math.min(input.length - 1, p + 1)] || 0;
      out[i] = a + (b - a) * f;
      continue;
    }
    let sum = 0, cnt = 0;
    for (let k = Math.floor(start); k < end; k++) { sum += input[k]; cnt++; }
    out[i] = cnt ? sum / cnt : 0;
  }
  return out;
}

/** A 16-bit PCM mono WAV file (ArrayBuffer) from float samples in [-1, 1]. */
export function encodeWav(samples, rate) {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE');
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] || 0));
    v.setInt16(44 + i * 2, s < 0 ? Math.round(s * 32768) : Math.round(s * 32767), true);
  }
  return buf;
}

/** Join recorded frames into one Float32Array. */
export function joinFrames(frames) {
  const total = frames.reduce((a, f) => a + f.length, 0);
  const out = new Float32Array(total);
  let o = 0;
  frames.forEach((f) => { out.set(f, o); o += f.length; });
  return out;
}

/** Root-mean-square loudness of a frame. */
export function rms(frame) {
  if (!frame || !frame.length) return 0;
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] * frame[i];
  return Math.sqrt(sum / frame.length);
}

/**
 * Turn-taking. Learns the room's noise for the first 400 ms, then: speech = louder than 3× the noise (at least 0.018)
 * for 140 ms; the turn ends after `silenceMs` of quiet following speech ("silence"), or when nobody speaks for
 * `noSpeechMs` ("nospeech"). push(level, ageMs) returns 'silence' | 'nospeech' | null.
 */
export function createVad(opts = {}) {
  const silenceMs = opts.silenceMs || 1200, noSpeechMs = opts.noSpeechMs || 8000;
  const st = { floor: 0, samples: 0, speaking: false, spoke: false, loudSince: 0, lastLoud: 0, done: false };
  st.push = (level, age) => {
    if (st.done) return null;
    if (age < 400) { st.floor = (st.floor * st.samples + level) / (st.samples + 1); st.samples++; return null; }
    const thr = Math.max(0.018, st.floor * 3);
    if (level > thr) {
      if (!st.loudSince) st.loudSince = age;
      if (age - st.loudSince >= 140) { st.speaking = true; st.spoke = true; }
      st.lastLoud = age;
    } else st.loudSince = 0;
    if (st.spoke && age - st.lastLoud > silenceMs) { st.done = true; return 'silence'; }
    if (!st.spoke && age > noSpeechMs) { st.done = true; return 'nospeech'; }
    return null;
  };
  return st;
}
