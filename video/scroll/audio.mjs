// A calm, dreamy bed for the scroll video: warm pad, soft electric-piano arpeggios, a gentle lo-fi pulse,
// reverb + echo, and a soft swell/chime each time the story changes scene. Writes data/scroll/audio.wav.
// Usage: node video/scroll/audio.mjs [duration] [sceneTime ...]
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('data/scroll', { recursive: true });
const SR = 44100;
const LEN = Number(process.argv[2]) || 26.6;
const SCENES = process.argv.slice(3).map(Number).filter((x) => x > 0);
const N = Math.ceil(SR * LEN);
const mk = () => new Float32Array(N);
const pad = [mk(), mk()], ep = [mk(), mk()], fx = [mk(), mk()], drum = [mk(), mk()];
let seed = 11;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const noise = () => rnd() * 2 - 1;
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
function add(bus, t0, dur, fn, gain = 1, pan = 0) {
  const s0 = Math.floor(t0 * SR), n = Math.floor(dur * SR);
  const gl = gain * Math.min(1, 1 - pan), gr = gain * Math.min(1, 1 + pan);
  for (let i = 0; i < n; i++) {
    const k = s0 + i;
    if (k < 0 || k >= N) continue;
    const v = fn(i / SR);
    bus[0][k] += v * gl;
    bus[1][k] += v * gr;
  }
}

const BPM = 72, BEAT = 60 / BPM, CH = BEAT * 4; // one chord per bar (3.33s)
const chords = [
  { bass: 41, notes: [53, 57, 60, 64] }, // Fmaj7
  { bass: 40, notes: [52, 55, 59, 62] }, // Em7
  { bass: 38, notes: [50, 53, 57, 60, 64] }, // Dm9
  { bass: 36, notes: [48, 55, 59, 62] }, // Cadd9
  { bass: 41, notes: [53, 57, 60, 64] }, // Fmaj7
  { bass: 45, notes: [57, 60, 64, 67] }, // Am7
  { bass: 46, notes: [58, 62, 65, 69] }, // Bbmaj7
  { bass: 41, notes: [53, 57, 60, 64, 69] }, // Fmaj7 (rest)
];
const bars = Math.ceil(LEN / CH);
const swing = 0.04;

for (let b = 0; b < bars; b++) {
  const c = chords[b % chords.length], t0 = b * CH, last = t0 + CH >= LEN - 0.01;
  // Pad: slow-attack, lowpassed detuned triangles
  for (const m of c.notes) {
    for (const det of [-0.07, 0.07]) {
      let lp = 0;
      const f = hz(m) * (1 + det / 12);
      add(pad, t0 - 0.3, CH + 1.2, (x) => {
        const ph = (x * f) % 1, tri = 4 * Math.abs(ph - 0.5) - 1;
        lp += (tri - lp) * 0.06;
        const env = Math.min(1, x / 0.9) * Math.max(0, Math.min(1, (CH + 1.2 - x) / 1.1));
        return lp * env;
      }, 0.05, m % 2 ? 0.35 : -0.35);
    }
  }
  // Bass: soft sine + 2nd harmonic, two gentle pulses per bar
  for (const off of [0, 2 * BEAT]) {
    const f = hz(c.bass);
    add(drum, t0 + off, last ? CH * 1.5 : BEAT * 2, (x) => (Math.sin(2 * Math.PI * f * x) + 0.35 * Math.sin(4 * Math.PI * f * x)) * Math.min(1, x / 0.03) * Math.exp(-x * (last ? 0.9 : 1.6)), 0.2);
  }
  // Electric piano arpeggio (eighths)
  const pat = [0, 2, 1, 3, 2, 3, 1, 2];
  for (let i = 0; i < 8; i++) {
    if (last && i > 2) break;
    const t = t0 + i * (BEAT / 2) + (i % 2 ? swing : 0);
    if (t < 0.35) continue;
    const m = c.notes[pat[i] % c.notes.length] + 12;
    const f = hz(m), vel = 0.55 + 0.45 * ((i % 4 === 0) ? 1 : 0.6);
    add(ep, t, 2.4, (x) => {
      const I = 1.6 * Math.exp(-x * 7);
      const env = Math.min(1, x / 0.006) * Math.exp(-x * 2.6);
      return (Math.sin(2 * Math.PI * f * x + I * Math.sin(2 * Math.PI * f * x)) + 0.12 * Math.sin(2 * Math.PI * f * 4 * x) * Math.exp(-x * 18)) * env;
    }, 0.075 * vel, ((i * 37) % 11) / 11 * 1.2 - 0.6);
  }
  // A high sparkle note on the first beat of every other bar
  if (b % 2 === 0 && t0 > 1) {
    const f = hz(c.notes[c.notes.length - 1] + 24);
    add(ep, t0 + BEAT * 1.5, 2.5, (x) => Math.sin(2 * Math.PI * f * x) * Math.exp(-x * 2.2) * Math.min(1, x / 0.004), 0.035, 0.5);
  }
}

// Lo-fi pulse: soft kick on 1 & 3, muted brush on 2 & 4, tiny hats — arrives after the first bar, drops out at the end
for (let beat = 0; beat * BEAT < LEN - 3.5; beat++) {
  const t = beat * BEAT;
  if (t < CH) continue;
  if (beat % 4 === 0 || beat % 4 === 2)
    add(drum, t, 0.4, (x) => Math.sin(2 * Math.PI * (46 * x + (70 * (1 - Math.exp(-x * 26))) / 26)) * Math.exp(-x * 9), 0.34);
  if (beat % 4 === 1 || beat % 4 === 3) {
    let lp = 0;
    add(drum, t, 0.28, (x) => { lp += (noise() - lp) * 0.22; return lp * Math.exp(-x * 14); }, 0.16, 0.1);
  }
  let p = 0;
  for (const o of [0, BEAT / 2 + swing]) {
    add(drum, t + o, 0.05, (x) => { const n = noise(), v = n - p; p = n; return v * Math.exp(-x * 90); }, o ? 0.03 : 0.018, -0.25);
  }
}

// Scene changes: a soft rising swell into the boundary, then a glassy chime and a low bloom
for (const tb of SCENES) {
  let lp = 0;
  add(fx, tb - 1.1, 1.1, (x) => { const p = x / 1.1; lp += (noise() - lp) * (0.015 + p * 0.25); return lp * p * p * p; }, 0.5);
  const bell = (f, g, d = 0) => add(fx, tb + d, 2.6, (x) => Math.sin(2 * Math.PI * f * x + 1.1 * Math.exp(-x * 9) * Math.sin(2 * Math.PI * f * 2.01 * x)) * Math.exp(-x * 2.4) * Math.min(1, x / 0.004), g, d ? 0.4 : -0.3);
  bell(1396.9, 0.09);
  bell(2093, 0.05, 0.12);
  add(fx, tb, 1.6, (x) => Math.sin(2 * Math.PI * (60 - 14 * Math.min(1, x)) * x) * Math.exp(-x * 2.6), 0.4);
}
// Intro bloom
add(fx, 0.0, 1.8, (x) => Math.sin(2 * Math.PI * 87 * x) * Math.exp(-x * 1.8) * Math.min(1, x / 0.2), 0.25);
// Vinyl dust
for (let k = 0; k < 90; k++) { const t = rnd() * LEN, g = 0.01 + rnd() * 0.02; add(fx, t, 0.012, (x) => noise() * Math.exp(-x * 400), g, rnd() * 2 - 1); }

// Echo on the piano (ping-pong, dotted eighth)
const dly = Math.floor(SR * BEAT * 0.75);
for (let i = dly; i < N; i++) {
  ep[0][i] += ep[1][i - dly] * 0.34;
  ep[1][i] += ep[0][i - dly] * 0.34;
}
// Reverb (Schroeder-style) on pad + piano + fx
const combs = (ds, fb) => ds.map((d) => ({ d: Math.floor(d * SR / 44100), buf: new Float32Array(Math.floor(d * SR / 44100)), i: 0, lp: 0, fb }));
const runReverb = (src, c, ap) => {
  const out = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    let s = 0;
    for (const k of c) { const y = k.buf[k.i]; k.lp += (y - k.lp) * 0.35; k.buf[k.i] = src[n] + k.lp * k.fb; k.i = (k.i + 1) % k.d; s += y; }
    out[n] = s * 0.25;
  }
  for (const d of ap) {
    const buf = new Float32Array(d); let i = 0;
    for (let n = 0; n < N; n++) { const y = buf[i], x = out[n]; buf[i] = x + y * 0.5; out[n] = y - x * 0.5; i = (i + 1) % d; }
  }
  return out;
};
const wetSrc = mk();
for (let n = 0; n < N; n++) wetSrc[n] = (pad[0][n] + pad[1][n] + ep[0][n] + ep[1][n] + fx[0][n] + fx[1][n]) * 0.5;
const wl = runReverb(wetSrc, combs([1116, 1188, 1277, 1356], 0.86), [225, 556]);
const wr = runReverb(wetSrc, combs([1139, 1211, 1300, 1379], 0.86), [248, 579]);

const L = mk(), R = mk();
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const fade = (t < 0.4 ? t / 0.4 : 1) * (t > LEN - 1.4 ? Math.max(0, (LEN - t) / 1.4) : 1);
  L[i] = Math.tanh((pad[0][i] + ep[0][i] + fx[0][i] + drum[0][i] + wl[i] * 0.55) * fade * 1.05);
  R[i] = Math.tanh((pad[1][i] + ep[1][i] + fx[1][i] + drum[1][i] + wr[i] * 0.55) * fade * 1.05);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const scale = 0.85 / peak, buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(L[i] * scale * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(R[i] * scale * 32767), 46 + i * 4);
}
writeFileSync('data/scroll/audio.wav', buf);
console.log('wrote data/scroll/audio.wav', LEN + 's', 'scenes', SCENES.join(','), 'peak', peak.toFixed(2));
