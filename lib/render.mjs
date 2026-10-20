import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { mediaDir } from './db.mjs';
import { brand } from './brand.mjs';
const require = createRequire(import.meta.url);
export function ffmpegPath() {
  return process.env.FFMPEG_PATH || require('ffmpeg-static');
}
export async function command(args, timeout = 120_000) {
  return new Promise((resolve, reject) => {
    const p = spawn(ffmpegPath(), args, { windowsHide: true, shell: false });
    let err = '';
    const timer = setTimeout(() => {
      p.kill();
      reject(new Error('Video rendering exceeded two minutes. Try a shorter demo.'));
    }, timeout);
    p.stderr.on('data', (b) => {
      err = (err + b.toString()).slice(-16000);
    });
    p.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
    p.on('close', (code) => {
      clearTimeout(timer);
      code === 0
        ? resolve(err)
        : reject(new Error(`Video processing failed (${code}). ${err.slice(-1200)}`));
    });
  });
}
const xml = (s) =>
  String(s).replace(
    /[<>&"']/g,
    (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c],
  );
function lines(text, max = 32) {
  const out = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    if ((line + ' ' + word).length > max && line) {
      out.push(line);
      line = '';
    }
    line += (line ? ' ' : '') + word;
  }
  if (line) out.push(line);
  return out;
}
export async function renderReel(job, product) {
  if (!/^[a-f0-9-]+\.mp4$/.test(job.source_file || ''))
    throw new Error('A valid uploaded source clip is required.');
  const source = path.join(mediaDir, job.source_file);
  if (!existsSync(source)) throw new Error('The source clip is missing. Upload it again.');
  const words = lines(product.tagline, 32).slice(0, 3);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="1920" fill="#f6f5f0"/><rect x="0" y="0" width="1080" height="16" fill="#d5f568"/><text x="64" y="100" font-family="Arial" font-size="34" font-weight="bold" fill="#242424">${xml(brand.name)} / fresh internet finds</text><text x="64" y="210" font-family="Arial" font-size="76" font-weight="bold" fill="#242424">${xml(product.name.slice(0, 24))}</text>${words.map((w, i) => `<text x="64" y="${282 + i * 48}" font-family="Arial" font-size="40" fill="#51625b">${xml(w)}</text>`).join('')}<rect x="58" y="418" width="964" height="1064" rx="16" fill="#e6e8de"/><text x="64" y="1580" font-family="Arial" font-size="32" fill="#51625b">${xml(product.category)} · ${xml(product.pricing.slice(0, 45))}</text><text x="64" y="1680" font-family="Arial" font-size="54" font-weight="bold" fill="#242424">Your next internet side quest.</text><text x="64" y="1750" font-family="Arial" font-size="36" fill="#51625b">Explore this product · link in bio</text><text x="64" y="1840" font-family="Arial" font-size="28" fill="#51625b">${product.sponsored ? 'Paid feature' : 'Independent product discovery'}</text></svg>`;
  const overlay = path.join(mediaDir, `${job.id}-frame.png`);
  await sharp(Buffer.from(svg)).png().toFile(overlay);
  const output = `${job.id}-reel.mp4`;
  await command([
    '-hide_banner',
    '-y',
    '-loop',
    '1',
    '-i',
    overlay,
    '-protocol_whitelist',
    'file,pipe,crypto',
    '-i',
    source,
    '-filter_complex',
    '[1:v]scale=960:1060:force_original_aspect_ratio=decrease,pad=960:1060:(ow-iw)/2:(oh-ih)/2:color=0xe6e8de[demo];[0:v][demo]overlay=60:420:shortest=1[v]',
    '-map',
    '[v]',
    '-an',
    '-t',
    '30',
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '22',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    path.join(mediaDir, output),
  ]);
  const bytes = readFileSync(path.join(mediaDir, output));
  if (bytes.length < 1000) throw new Error('The rendered video is empty.');
  writeFileSync(
    path.join(mediaDir, `${job.id}-package.json`),
    JSON.stringify(
      {
        product: product.name,
        source: product.source,
        script: job.script,
        caption: job.caption,
        storyboard: JSON.parse(job.storyboard),
        video: output,
        renderedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  return output;
}
