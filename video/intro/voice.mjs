import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const output = path.resolve('data/intro');
mkdirSync(output, { recursive: true });
export const segments = [
  { start: 0, end: 4, text: 'Forty tabs. Twelve saved reels. Where was that one app?' },
  { start: 4, end: 8, text: 'Meet tadgobble. Good finds. Questionable screen time.' },
  { start: 8, end: 13, text: 'Feed Gobble a find. Get your next, wait, this exists?' },
  {
    start: 13,
    end: 21,
    text: 'Peek at real website previews. Find your corner. Save the good stuff to your stash.',
  },
  {
    start: 21,
    end: 26,
    text: 'Made something? Become a Gobbler. Drop your link. Let people find it.',
  },
  { start: 26, end: 32, text: 'Pick your people. Make it yours. Send it for review.' },
  { start: 32, end: 35, text: 'Less doomscroll. More, yo, look at this.' },
  { start: 35, end: 40, text: 'Find your next obsession. Tadgobble dot web dot app.' },
];
writeFileSync(path.join(output, 'script.json'), JSON.stringify(segments, null, 2));
const key = process.env.OPENAI_API_KEY;
if (!key) throw new Error('OPENAI_API_KEY is not configured.');
const speechPath = path.join(output, 'voice-original.wav');
if (!existsSync(speechPath)) {
  const response = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: 'marin',
      response_format: 'wav',
      input: segments.map((s) => s.text).join('\n\n'),
      instructions:
        'Read this product intro in clear conversational English. Young, warm, confident, quick-witted, lightly mischievous. A cool friend showing you their favorite new website, with a slightly deadpan smile on "Questionable screen time". Punchy energetic pacing, approximately 150 words per minute. Short natural pauses between paragraphs. Never shout. No exaggerated announcer voice. Pronounce tadgobble as TAD-gobble, two syllables with a hard g. Gobble is GOB-ul. Gobbler is GOB-ler. Keep every word, add none. Let the last URL land clearly.',
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) {
    let code = 'unknown';
    try {
      code = (await response.json()).error?.code || code;
    } catch {}
    throw new Error(`Speech request failed: HTTP ${response.status}, code ${code}`);
  }
  writeFileSync(speechPath, Buffer.from(await response.arrayBuffer()));
  console.log('AI voiceover generated.');
}
const transcriptPath = path.join(output, 'voice-words.json');
if (!existsSync(transcriptPath)) {
  const body = new FormData();
  body.set('file', new Blob([readFileSync(speechPath)], { type: 'audio/wav' }), 'voice.wav');
  body.set('model', 'whisper-1');
  body.set('response_format', 'verbose_json');
  body.append('timestamp_granularities[]', 'word');
  body.set('language', 'en');
  body.set('prompt', 'tadgobble, Gobble, Gobbler, doomscroll.');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body,
    signal: AbortSignal.timeout(120000),
  });
  if (!response.ok) throw new Error(`Caption alignment failed: HTTP ${response.status}`);
  const result = await response.json();
  writeFileSync(transcriptPath, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify({ duration: result.duration, text: result.text, words: result.words?.length }),
  );
}
