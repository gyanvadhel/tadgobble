import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { blobPath } from '../../../lib/mascot.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const output = path.join(root, 'deliverables', 'linkedin-launch');
mkdirSync(output, { recursive: true });
const font = (index) => readFileSync(path.join(root, `public/fonts/font-${index}.woff2`)).toString('base64');

const gobble = (lookLeft = false) => `<svg viewBox="0 0 100 90" fill="none" aria-hidden="true">
  <path d="${blobPath}" fill="#39245a"/>
  <ellipse cx="34" cy="40" rx="10" ry="15" fill="#fffef6"/>
  <ellipse cx="61" cy="40" rx="10" ry="15" fill="#fffef6"/>
  <ellipse cx="${lookLeft ? 31 : 37}" cy="41" rx="4" ry="8" fill="#191a1c"/>
  <ellipse cx="${lookLeft ? 58 : 64}" cy="41" rx="4" ry="8" fill="#191a1c"/>
  <path d="M37 63Q50 75 65 61" stroke="#191a1c" stroke-width="4" stroke-linecap="round"/>
</svg>`;

const flower = `<svg viewBox="0 0 210 220" fill="none" aria-hidden="true">
  <path d="M103 198C95 166 114 140 104 91M102 177C69 176 47 159 48 141C77 141 94 151 102 177M107 150C133 147 154 125 154 109C123 112 111 129 107 150" stroke="#39245a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M104 91C88 113 58 110 66 88C35 94 32 66 58 60C33 37 58 21 77 39C75 11 107 10 113 34C131 9 156 31 140 51C170 49 176 81 145 86C164 109 133 125 117 101Z" fill="#ff7547" stroke="#39245a" stroke-width="3.5" stroke-linejoin="round"/>
  <ellipse cx="104" cy="67" rx="22" ry="20" fill="#f9f4a7" stroke="#39245a" stroke-width="3.5"/>
  <path d="M92 67C98 74 109 75 117 67" stroke="#39245a" stroke-width="3" stroke-linecap="round"/>
  <circle cx="94" cy="59" r="2.5" fill="#39245a"/><circle cx="113" cy="59" r="2.5" fill="#39245a"/>
</svg>`;

const spark = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 4L58 32L83 16L68 42L96 50L68 58L83 84L58 68L50 96L42 68L17 84L32 58L4 50L32 42L17 16L42 32Z" fill="currentColor"/></svg>`;

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tadgobble — your work deserves witnesses</title>
<style>
@font-face{font-family:Bricolage;src:url(data:font/woff2;base64,${font(1)}) format('woff2');font-weight:400 800;font-display:block}
@font-face{font-family:DM;src:url(data:font/woff2;base64,${font(2)}) format('woff2');font-weight:400 700;font-display:block}
*{box-sizing:border-box}html,body{margin:0}body{background:#eae7e9;font-family:DM,Arial,sans-serif;color:#39245a}
.poster{width:1080px;height:1350px;position:relative;overflow:hidden;background:#f9f4a7;isolation:isolate}
.brand{position:absolute;left:65px;top:54px;display:flex;align-items:center;gap:12px;font:750 46px/1 Bricolage,sans-serif;letter-spacing:-2.4px}
.brand svg{width:49px;height:46px}
.hello{position:absolute;right:69px;top:56px;margin:0;text-align:right;font-size:24px;line-height:1.22;letter-spacing:-.35px}
h1{position:absolute;left:61px;top:168px;margin:0;font:800 151px/.89 Bricolage,sans-serif;letter-spacing:-6.1px}
h1 span{display:block}
.intro{position:absolute;left:70px;top:598px;font-size:32px;line-height:1.3;letter-spacing:-.65px;margin:0}
.stage{position:absolute;left:65px;top:677px;width:949px;height:378px;background:#c5b5f5;border-radius:50%;transform:rotate(1deg)}
.paper{position:absolute;border-radius:4px;box-shadow:0 9px 0 #39245a18;overflow:hidden}
.paper-label{position:absolute;left:20px;bottom:17px;font-size:22px;font-weight:600;line-height:1;letter-spacing:-.4px}
.sketch{width:238px;height:282px;left:93px;top:704px;background:#fffef6;transform:rotate(-11deg);z-index:2}
.sketch>svg{position:absolute;width:202px;height:212px;left:19px;top:18px}
.design{width:246px;height:300px;left:305px;top:688px;background:#39245a;color:#f9f4a7;transform:rotate(4deg);z-index:3}
.design-type{position:absolute;left:21px;top:23px;font:750 62px/.91 Bricolage,sans-serif;letter-spacing:-3.1px}
.design .spark{position:absolute;right:21px;bottom:57px;width:69px;height:69px;color:#ff7547;transform:rotate(14deg)}
.spark svg{width:100%;height:100%}
.app{width:214px;height:237px;left:518px;top:751px;background:#fffef6;transform:rotate(-7deg);z-index:4}
.window-bar{height:30px;background:#f0ecf6;display:flex;align-items:center;gap:6px;padding:0 12px}
.window-bar i{width:6px;height:6px;border-radius:50%;background:#39245a}
.app-interior{position:absolute;left:15px;right:15px;top:43px;background:#f9f4a7;height:136px;border-radius:4px}
.app-interior>svg{position:absolute;width:90px;height:81px;left:45px;top:5px}
.app-control{position:absolute;left:34px;right:34px;bottom:15px;height:20px;border-radius:12px;background:#39245a}
.gobble{position:absolute;width:306px;height:276px;left:713px;top:751px;transform:rotate(8deg);z-index:5;filter:drop-shadow(0 10px 0 #39245a16)}
.gobble svg{width:100%;height:100%}
.gobble-caption{position:absolute;left:765px;top:1032px;font-size:24px;letter-spacing:-.4px;transform:rotate(4deg);margin:0}
.invitation{position:absolute;left:0;right:0;bottom:0;height:237px;background:#39245a;color:#f9f4a7;padding:40px 69px}
.invitation h2{font:700 61px/1.08 Bricolage,sans-serif;letter-spacing:-2.2px;margin:0 0 25px}
.invitation a{color:inherit;text-decoration:none;font-size:34px;font-weight:550;line-height:1.3;letter-spacing:-.6px}
.free{position:absolute;right:69px;bottom:53px;color:#c5b5f5;font-size:25px;line-height:1.3;letter-spacing:-.25px}
@page{size:1080px 1350px;margin:0}@media print{body{background:white}}
</style></head><body>
<main class="poster" aria-label="Tadgobble launch poster">
  <header class="brand">${gobble()}<span>tadgobble.</span></header>
  <p class="hello">made it?<br>feed the gobble.</p>
  <h1><span>ur work</span><span>deserves</span><span>witnesses.</span></h1>
  <p class="intro">Art, design &amp; tiny apps. All welcome.</p>
  <div class="stage" aria-hidden="true"></div>
  <div class="paper sketch">${flower}<span class="paper-label">your art.</span></div>
  <div class="paper design"><div class="design-type">made<br>at<br>2am.</div><div class="spark">${spark}</div><span class="paper-label">your design.</span></div>
  <div class="paper app"><div class="window-bar"><i></i><i></i><i></i></div><div class="app-interior">${gobble()}<div class="app-control"></div></div><span class="paper-label">your tiny app.</span></div>
  <div class="gobble">${gobble(true)}</div>
  <p class="gobble-caption">let him see it.</p>
  <footer class="invitation"><h2>share what you made.</h2><a href="https://tadgobble.web.app">tadgobble.web.app</a><span class="free">free to share.</span></footer>
</main></body></html>`;

writeFileSync(path.join(output, 'editable-poster.html'), html);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 2 });
  await page.goto(pathToFileURL(path.join(output, 'editable-poster.html')).href);
  await page.evaluate(() => document.fonts.ready);
  const master = await page.locator('.poster').screenshot({ path: path.join(output, 'tadgobble-poster-master.png') });
  const png = await sharp(master).resize(1080, 1350).png().toBuffer();
  writeFileSync(path.join(output, 'tadgobble-poster.png'), png);
  await sharp(png).jpeg({ quality: 96, chromaSubsampling: '4:4:4' }).toFile(path.join(output, 'tadgobble-poster.jpg'));
  await sharp(png).resize(540, 675).png().toFile(path.join(output, 'poster-preview.png'));
  const textBounds = await page.locator('h1 span,.brand,.hello,.intro,.paper-label,.gobble-caption,.invitation h2,.invitation a,.free').evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect();
    return { text: element.textContent, left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom) };
  }));
  const outside = textBounds.filter(box => box.left < 0 || box.top < 0 || box.right > 1080 || box.bottom > 1350);
  if (outside.length) throw new Error(`Text outside poster: ${JSON.stringify(outside)}`);
  const metadata = await sharp(path.join(output, 'tadgobble-poster.png')).metadata();
  const masterMetadata = await sharp(path.join(output, 'tadgobble-poster-master.png')).metadata();
  console.log(JSON.stringify({ output, dimensions: [metadata.width, metadata.height], master: [masterMetadata.width, masterMetadata.height], textBounds }, null, 2));
} finally {
  await browser.close();
}

writeFileSync(path.join(output, 'posting-copy.txt'), `Your friend spends 12 hours making something incredible.\n\nThe group chat says “nice bro.”\n\nThat cannot be the entire marketing strategy.\n\nSo I built Tadgobble: a free showcase for art, design, and tiny apps. For artwork, a photo and a title are enough to submit. No portfolio or website needed.\n\nIt’s early, and I’m looking for our first artists, designers, students, and builders to help shape it.\n\nMade something you’re proud of? I’d love to see it.\nhttps://tadgobble.web.app\n\nur work deserves witnesses.\n\nALT TEXT\nA butter-yellow Tadgobble poster with large purple text reading “ur work deserves witnesses.” Below, an illustrated orange flower, a purple typography design, and a tiny app sit on a lavender oval. Gobble, the smiling purple blob mascot, looks at the work. Text reads “Art, design & tiny apps. All welcome.” The footer says “share what you made”, “tadgobble.web.app”, and “free to share.”\n`);

writeFileSync(path.join(output, 'README.txt'), `TADGOBBLE — LAUNCH POSTER\n\nUpload tadgobble-poster.png or tadgobble-poster.jpg: 1080 × 1350, portrait 4:5.\nThe master PNG is 2160 × 2700 for larger reuse.\nUse posting-copy.txt for suggested caption and image alt text.\nPut the clickable site URL in your post; the URL printed on the poster is part of the image.\n\neditable-poster.html is self-contained, with embedded original SVG artwork and fonts.\nThe artwork illustrates the kinds of work welcomed; it is not a collection of user submissions.\nNo social post has been published.\n\nSource: design/social/linkedin-launch/render.mjs\nRebuild from the project root: rtk proxy node design/social/linkedin-launch/render.mjs\n`);

writeFileSync(path.join(output, 'font-licenses.txt'), readFileSync(path.join(root, 'deliverables', 'first-post', 'font-licenses.txt')));
