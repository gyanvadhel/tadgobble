// Procedural soundtrack + SFX for the "how to post" video, synced to composition.html's timeline.
// 120 BPM grid; writes data/post/audio.wav (stereo 16-bit, 44.1 kHz).
import { writeFileSync, mkdirSync } from 'node:fs';
mkdirSync('data/post', { recursive: true });
const SR = 44100,
  LEN = 27,
  N = Math.ceil(SR * LEN);
const L = new Float32Array(N),
  R = new Float32Array(N);
const BEAT = 0.5;
let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
function add(t0, dur, fn, gain = 1, pan = 0) {
  const s0 = Math.floor(t0 * SR),
    n = Math.floor(dur * SR);
  const gl = gain * Math.min(1, 1 - pan),
    gr = gain * Math.min(1, 1 + pan);
  for (let i = 0; i < n && s0 + i < N; i++) {
    if (s0 + i < 0) continue;
    const v = fn(i / SR);
    L[s0 + i] += v * gl;
    R[s0 + i] += v * gr;
  }
}
const kick = (t, g = 0.85) =>
  add(t, 0.35, (x) => Math.sin(2 * Math.PI * (50 * x + (90 * (1 - Math.exp(-x * 30))) / 30)) * Math.exp(-x * 9), g);
const clap = (t) => add(t, 0.18, (x) => noise() * Math.exp(-x * 26) * (x < 0.01 ? x / 0.01 : 1), 0.3);
const hat = (t, g = 0.08) => {
  let p = 0;
  add(t, 0.06, (x) => {
    const n = noise();
    const v = n - p;
    p = n;
    return v * Math.exp(-x * 70);
  }, g, 0.3);
};
const pluck = (t, f, dur = 0.24, g = 0.22) =>
  add(t, dur, (x) => (Math.sin(2 * Math.PI * f * x) + 0.4 * Math.sin(4 * Math.PI * f * x) + 0.2 * Math.sin(6 * Math.PI * f * x)) * Math.exp(-x * 11), g);
const marimba = (t, f, g = 0.12, pan = 0) =>
  add(t, 0.4, (x) => (Math.sin(2 * Math.PI * f * x) + 0.25 * Math.sin(2 * Math.PI * f * 4 * x) * Math.exp(-x * 30)) * Math.exp(-x * 9), g, pan);
const pop = (t, g = 0.45) => add(t, 0.16, (x) => Math.sin(2 * Math.PI * (300 * x + 2600 * x * x)) * Math.exp(-x * 22), g);
const tick = (t, f = 1800, g = 0.16) => add(t, 0.05, (x) => Math.sin(2 * Math.PI * f * x) * Math.exp(-x * 90), g);
const thunk = (t) =>
  add(t, 0.22, (x) => Math.sin(2 * Math.PI * (140 - 60 * x) * x) * Math.exp(-x * 20) * 0.7 + noise() * Math.exp(-x * 80) * 0.2, 0.7);
const ding = (t, f = 1318.5, g = 0.14) =>
  add(t, 1.2, (x) => (Math.sin(2 * Math.PI * f * x) + 0.5 * Math.sin(4 * Math.PI * f * x) * Math.exp(-x * 6) + 0.3 * Math.sin(3 * Math.PI * f * x)) * Math.exp(-x * 4.5), g, -0.1);
const whoosh = (t, dur = 0.35, g = 0.5) => {
  let lp = 0;
  add(t, dur + 0.05, (x) => {
    const p = Math.min(1, x / dur);
    lp += (noise() - lp) * (0.03 + p * 0.4);
    return lp * p * p * (x > dur ? Math.exp(-(x - dur) * 60) : 1);
  }, g);
};
const riser = (t, dur) => {
  let lp = 0;
  add(t, dur, (x) => {
    const p = x / dur;
    lp += (noise() - lp) * (0.02 + p * 0.5);
    return lp * p * p * 0.9;
  }, 0.45);
};
const sparkle = (t) => {
  for (let k = 0; k < 7; k++)
    add(t + k * 0.045, 0.3, (x) => Math.sin(2 * Math.PI * hz(84 + [0, 4, 7, 12, 16, 19, 24][k]) * x) * Math.exp(-x * 14), 0.07, k % 2 ? 0.5 : -0.5);
};
const burst = (t) => add(t, 0.5, (x) => noise() * Math.exp(-x * 9), 0.2);

const prog = [[48, [60, 64, 67, 72]], [45, [57, 60, 64, 69]], [41, [57, 60, 65, 69]], [43, [59, 62, 67, 71]]];
const chordAt = (t) => prog[Math.floor(t / 2) % 4];
const GROOVE = 6.5,
  END = 23.4,
  OUT = 27;
for (let b = 0; b * BEAT < OUT - 0.5; b++) {
  const t = b * BEAT,
    [root, notes] = chordAt(t);
  const full = t >= GROOVE && t < END,
    tail = t >= END;
  if (t >= 1) {
    hat(t + BEAT / 2, tail ? 0.04 : 0.07);
    if (full) hat(t, 0.05);
  }
  if (full) {
    kick(t);
    if (b % 2 === 1) clap(t);
  }
  if (t >= 0.5) {
    pluck(t, hz(root), 0.22, full ? 0.26 : tail ? 0.2 : 0.14);
    if (full) pluck(t + 0.25, hz(root + 12), 0.16, 0.13);
    marimba(t, hz(notes[(b * 2) % 4] + (full ? 12 : 0)), full ? 0.1 : 0.12, -0.25);
    marimba(t + 0.25, hz(notes[(b * 2 + 1) % 4] + (full ? 12 : 0)), full ? 0.08 : 0.1, 0.25);
  }
}
// Story intro
pop(0.05);
tick(0.5, 1400);
tick(0.75, 1500);
for (const t of [1.5, 3.0, 4.5]) whoosh(t - 0.15, 0.3, 0.25);
// Build into the circle wipe
riser(4.6, 1.2);
for (let i = 0; i < 6; i++) tick(4.9 + i * 0.15, 1000 + i * 90);
whoosh(5.5, 0.3, 0.55);
kick(6.5, 1.0);
sparkle(6.5);
pop(6.9, 0.3);
// Step changes
for (const t of [10.4, 14.2, 16.9, 19.7]) whoosh(t - 0.3);
// Taps (match composition)
for (const t of [8.55, 11.0, 15.4]) {
  pop(t, 0.35);
  tick(t + 0.02, 2200, 0.2);
}
thunk(18.05);
pop(18.05, 0.3);
ding(8.8, 1174.7, 0.1); // photo lands
for (let k = 0; k < 11; k++) tick(11.35 + k * 0.085, 1500 + (k % 3) * 130, 0.2); // typing
ding(15.45, 1568, 0.09); // checkbox
// It's live
burst(18.55);
ding(18.55);
ding(18.63, 1568, 0.1);
ding(18.71, 1975.5, 0.1);
sparkle(18.55);
kick(18.55, 1.0);
// Chips
[21.0, 21.28, 21.56].forEach((t, i) => {
  pop(t, 0.42);
  tick(t, 1500 + i * 200, 0.2);
});
// End card
whoosh(23.0, 0.35, 0.5);
kick(23.4, 1.0);
for (const n of [60, 64, 67, 72]) marimba(23.4, hz(n + 12), 0.12);
ding(23.4);
pop(24.5, 0.4);
ding(24.5, 1568, 0.08);

let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR,
    fade = t > 25.9 ? Math.max(0, 1 - (t - 25.9) / 1.0) : t < 0.02 ? t / 0.02 : 1;
  L[i] = Math.tanh(L[i] * fade * 1.1);
  R[i] = Math.tanh(R[i] * fade * 1.1);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const scale = 0.89 / peak,
  buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(L[i] * scale * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(R[i] * scale * 32767), 46 + i * 4);
}
writeFileSync('data/post/audio.wav', buf);
console.log('wrote data/post/audio.wav, peak', peak.toFixed(2));
