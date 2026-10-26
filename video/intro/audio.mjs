import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const ffmpeg = require('ffmpeg-static');
const dir = path.resolve('data/intro');
export const cuts = [
  { a: 0, b: 4.12, at: 0.08, rate: 1.07, first: 0, last: 9 },
  { a: 4.28, b: 8.5, at: 4.02, rate: 1.1, first: 10, last: 16 },
  { a: 8.78, b: 10.15, at: 8.2, rate: 1, first: 17, last: 20 },
  { a: 10.3, b: 12.73, at: 10.02, rate: 1, first: 21, last: 26 },
  { a: 12.94, b: 14.94, at: 13.05, rate: 1, first: 27, last: 31 },
  { a: 14.96, b: 15.96, at: 16.0, rate: 1, first: 32, last: 34 },
  { a: 16.2, b: 17.94, at: 18.0, rate: 1, first: 35, last: 41 },
  { a: 18.1, b: 23.0, at: 21.0, rate: 1.02, first: 42, last: 53 },
  { a: 23.0, b: 24.04, at: 26.15, rate: 1, first: 54, last: 56 },
  { a: 24.1, b: 25.1, at: 28.2, rate: 1, first: 57, last: 59 },
  { a: 25.3, b: 26.3, at: 30.0, rate: 1, first: 60, last: 63 },
  { a: 26.44, b: 29.5, at: 32.0, rate: 1.06, first: 64, last: 70 },
  { a: 29.68, b: 33.35, at: 35.25, rate: 1, first: 71, last: 77 },
];
const original = JSON.parse(readFileSync(path.join(dir, 'voice-words.json'))).words;
const corrections = {
  0: 'Forty',
  2: 'Twelve',
  11: 'tadgobble.',
  13: 'finds.',
  16: 'time.',
  20: 'find.',
  24: 'wait,',
  26: 'exists?',
  29: 'real',
  31: 'previews.',
  34: 'corner.',
  41: 'stash.',
  43: 'something?',
  46: 'Gobbler.',
  49: 'link.',
  53: 'it.',
  56: 'people.',
  59: 'yours.',
  63: 'review.',
  65: 'doomscroll.',
  66: 'More,',
  67: 'yo,',
  70: 'this.',
  74: 'obsession.',
  75: 'tadgobble.',
  76: 'web.',
  77: 'app.',
};
let words = [];
for (const cut of cuts)
  for (let i = cut.first; i <= cut.last; i++) {
    const w = original[i];
    let start = w.start,
      end = w.end;
    if (i === 19) end = 9.64;
    if (i === 20) start = 9.65;
    if (i === 33) end = 15.42;
    if (i === 34) start = 15.42;
    if (i === 41) start = 17.34;
    words.push({
      word: corrections[i] || w.word,
      start: cut.at + (start - cut.a) / cut.rate,
      end: cut.at + (Math.max(start + 0.06, end) - cut.a) / cut.rate,
      index: i,
    });
  }
const groups = [
  [0, 1],
  [2, 4],
  [5, 7],
  [8, 9],
  [10, 11],
  [12, 13],
  [14, 16],
  [17, 20],
  [21, 23],
  [24, 26],
  [27, 29],
  [30, 31],
  [32, 34],
  [35, 38],
  [39, 41],
  [42, 43],
  [44, 46],
  [47, 49],
  [50, 53],
  [54, 56],
  [57, 59],
  [60, 63],
  [64, 65],
  [66, 70],
  [71, 74],
];
const captions = groups.map(([a, b]) => ({
  start: words[a].start,
  end: Math.min(words[b + 1]?.start ?? 40, words[b].end + 0.55),
  words: words.slice(a, b + 1),
}));
writeFileSync(path.join(dir, 'captions.json'), JSON.stringify(captions, null, 2));
writeFileSync(
  path.join(dir, 'audio-timeline.json'),
  JSON.stringify({ duration: 40, cuts, words }, null, 2),
);
const run = (args) =>
  new Promise((resolve, reject) => {
    const proc = spawn(ffmpeg, ['-hide_banner', '-y', ...args], { windowsHide: true });
    let log = '';
    proc.stderr.on('data', (b) => (log += b));
    proc.on('exit', (code) => (code ? reject(new Error(log.slice(-5000))) : resolve()));
  });
const filter =
  cuts
    .map(
      (c, i) =>
        `[0:a]atrim=start=${c.a}:end=${c.b},asetpts=PTS-STARTPTS,atempo=${c.rate},afade=t=in:st=0:d=0.008,afade=t=out:st=${(c.b - c.a) / c.rate - 0.012}:d=0.012,adelay=${Math.round(c.at * 1000)}:all=1[a${i}]`,
    )
    .join(';') +
  ';' +
  cuts.map((_, i) => `[a${i}]`).join('') +
  `amix=inputs=${cuts.length}:normalize=0,apad,atrim=0:40,loudnorm=I=-17:TP=-2:LRA=9[a]`;
await run([
  '-i',
  path.join(dir, 'voice-original.wav'),
  '-filter_complex',
  filter,
  '-map',
  '[a]',
  '-ar',
  '48000',
  path.join(dir, 'voice.wav'),
]);
// Original procedural score and sound design: no licensed music samples.
const sr = 48000,
  duration = 40,
  samples = new Float64Array(sr * duration),
  rand = (() => {
    let x = 721;
    return () => {
      x = (Math.imul(1664525, x) + 1013904223) >>> 0;
      return (x / 4294967296) * 2 - 1;
    };
  })();
function add(at, len, fn, amp = 1) {
  const start = Math.round(at * sr),
    n = Math.round(len * sr);
  for (let i = 0; i < n && start + i < samples.length; i++)
    if (start + i >= 0) samples[start + i] += fn(i / sr, i) * amp;
}
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
const chords = [
  [45, 57, 60, 64, 67],
  [41, 53, 57, 60, 64],
  [48, 55, 60, 64, 67],
  [43, 55, 59, 62, 67],
];
for (let beat = 0; beat < 80; beat++) {
  const t = beat * 0.5,
    chord = chords[Math.floor(beat / 8) % 4],
    low = hz(chord[0]);
  add(
    t,
    0.25,
    (x) => Math.sin(2 * Math.PI * (49 * x + 3.6 * (1 - Math.exp(-x * 42)))) * Math.exp(-x * 21),
    0.42,
  );
  if (beat % 2)
    add(t, 0.15, (x) => rand() * Math.exp(-x * 36) * (0.5 + 0.5 * Math.sin(x * 1800)), 0.16);
  for (let sub = 0; sub < 2; sub++)
    add(t + sub * 0.25, 0.06, (x) => rand() * Math.exp(-x * 85), sub ? 0.055 : 0.07);
  add(
    t + 0.025,
    0.38,
    (x) =>
      (Math.sin(2 * Math.PI * low * x) + 0.22 * Math.sin(2 * Math.PI * low * 2 * x)) *
      Math.min(1, x * 60) *
      Math.exp(-x * 9),
    0.2,
  );
  if (beat % 4 === 2)
    add(t + 0.28, 0.18, (x) => Math.sin(2 * Math.PI * low * x) * Math.exp(-x * 16), 0.16);
  for (let step = 0; step < 2; step++) {
    const f = hz(chord[1 + ((beat + step) % 4)] + 12);
    add(
      t + step * 0.25 + 0.015,
      0.7,
      (x) =>
        (Math.sin(2 * Math.PI * f * x) + 0.18 * Math.sin(2 * Math.PI * f * 2.003 * x)) *
        Math.min(1, x * 180) *
        Math.exp(-x * 8),
      0.045,
    );
  }
}
const transitions = [4, 8, 10.1, 13, 16, 18, 21, 26, 28.2, 30, 32, 35];
for (const at of transitions)
  add(at - 0.16, 0.25, (x) => rand() * Math.sin((Math.PI * x) / 0.25) ** 2, 0.13);
for (const at of [
  8.85, 14.0, 16.75, 18.65, 19.85, 21.4, 22.3, 23.25, 25.35, 26.65, 27.25, 28.7, 30.25, 30.75,
]) {
  add(
    at,
    0.075,
    (x) => Math.sin(2 * Math.PI * (1500 * x - 2500 * x * x)) * Math.exp(-x * 65),
    0.14,
  );
}
add(9.2, 0.2, (x) => Math.sin(2 * Math.PI * (110 * x + 8 * x * x)) * Math.exp(-x * 20), 0.24);
for (const [i, f] of [523.25, 659.25, 783.99].entries())
  add(31 + i * 0.1, 0.45, (x) => Math.sin(2 * Math.PI * f * x) * Math.exp(-x * 10), 0.1);
const wave = Buffer.alloc(44 + samples.length * 2);
wave.write('RIFF');
wave.writeUInt32LE(wave.length - 8, 4);
wave.write('WAVE', 8);
wave.write('fmt ', 12);
wave.writeUInt32LE(16, 16);
wave.writeUInt16LE(1, 20);
wave.writeUInt16LE(1, 22);
wave.writeUInt32LE(sr, 24);
wave.writeUInt32LE(sr * 2, 28);
wave.writeUInt16LE(2, 32);
wave.writeUInt16LE(16, 34);
wave.write('data', 36);
wave.writeUInt32LE(samples.length * 2, 40);
for (let i = 0; i < samples.length; i++) {
  const t = i / sr,
    fade = Math.min(1, t / 0.08, (40 - t) / 0.8);
  wave.writeInt16LE(Math.round(Math.tanh(samples[i]) * fade * 32760), 44 + i * 2);
}
writeFileSync(path.join(dir, 'score.wav'), wave);
await run([
  '-i',
  path.join(dir, 'voice.wav'),
  '-i',
  path.join(dir, 'score.wav'),
  '-filter_complex',
  '[0:a]asplit=2[v][side];[1:a]volume=0.40[music];[music][side]sidechaincompress=threshold=0.03:ratio=5:attack=12:release=180[duck];[v][duck]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=8[a]',
  '-map',
  '[a]',
  '-ar',
  '48000',
  '-ac',
  '2',
  path.join(dir, 'master.wav'),
]);
const time = (t) => {
  let ms = Math.round(t * 1000);
  return `${String(Math.floor(ms / 3600000)).padStart(2, '0')}:${String(Math.floor(ms / 60000) % 60).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`;
};
mkdirSync('deliverables', { recursive: true });
writeFileSync(
  'deliverables/tadgobble-intro.srt',
  [...captions, { start: 37.2, end: 40, words: [{ word: 'tadgobble.web.app' }] }]
    .map(
      (c, i) =>
        `${i + 1}\n${time(c.start)} --> ${time(c.end)}\n${c.words.map((w) => w.word).join(' ')}\n`,
    )
    .join('\n'),
);
console.log('40-second voice, original score, sound design, and aligned captions ready.');
