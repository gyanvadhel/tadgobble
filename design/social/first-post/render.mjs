import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { blobPath } from '../../../lib/mascot.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const out=path.join(root,'deliverables','first-post');
mkdirSync(out,{recursive:true});
const font=(n)=>readFileSync(path.join(root,`public/fonts/font-${n}.woff2`)).toString('base64');
const gobble=(color='#39245a',hungry=false)=>`<svg viewBox="0 0 100 90" fill="none" aria-hidden="true"><path d="${blobPath}" fill="${color}"/><ellipse cx="34" cy="40" rx="10" ry="15" fill="#fffef6"/><ellipse cx="61" cy="40" rx="10" ry="15" fill="#fffef6"/><ellipse cx="37" cy="42" rx="4" ry="8" fill="#191a1c"/><ellipse cx="64" cy="42" rx="4" ry="8" fill="#191a1c"/>${hungry?'<ellipse cx="50" cy="65" rx="12" ry="10" fill="#191a1c"/>':'<path d="M37 63Q50 75 65 61" stroke="#191a1c" stroke-width="4" stroke-linecap="round"/>'}</svg>`;
const logo=(light=false)=>`<header class="brand">${gobble(light?'#f9f4a7':'#39245a')}<span>tadgobble.</span></header>`;
const petals=Array.from({length:7},(_,i)=>`<ellipse cx="150" cy="83" rx="29" ry="48" transform="rotate(${i*360/7} 150 140)"/>`).join('');
const flower=`<svg viewBox="0 0 300 330" aria-hidden="true"><g fill="none" stroke="#39245a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M149 159Q132 241 155 310M148 264Q77 271 83 222Q127 223 148 264M147 237Q210 222 222 184Q164 183 147 237"/>${petals}<circle cx="150" cy="140" r="28" fill="#ff7547" stroke="#39245a"/></g></svg>`;

const html=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Tadgobble — first post</title><style>
@font-face{font-family:Bricolage;src:url(data:font/woff2;base64,${font(1)}) format('woff2');font-weight:400 800;font-display:block}
@font-face{font-family:DM;src:url(data:font/woff2;base64,${font(2)}) format('woff2');font-weight:400 700;font-display:block}
*{box-sizing:border-box}html,body{margin:0}body{background:#e8e8e8;color:#39245a;font-family:DM,Arial,sans-serif}.slide{position:relative;width:1080px;height:1350px;overflow:hidden;margin:0 0 30px;background:#f9f4a7}.brand{position:absolute;top:66px;left:72px;display:flex;align-items:center;gap:14px;font:750 47px/.95 Bricolage,sans-serif;letter-spacing:-2.8px}.brand svg{width:50px;height:48px}.headline{font-family:Bricolage,sans-serif;font-weight:800;letter-spacing:-.04em;line-height:.88;margin:0}.foot{position:absolute;left:76px;right:76px;bottom:64px;display:flex;align-items:center;justify-content:space-between;font-size:28px;line-height:1.35}.swipe{display:flex;align-items:center;gap:20px;font-size:26px}.swipe svg{width:33px;height:25px}.arrow{fill:none;stroke:currentColor;stroke-width:3.3;stroke-linecap:round;stroke-linejoin:round}
.one .headline{position:absolute;left:64px;top:213px;font-size:238px}.one .tagline{position:absolute;left:78px;top:765px;font:650 66px/1.03 Bricolage,sans-serif;letter-spacing:-1.5px;margin:0;z-index:2}.one .gobble-main{position:absolute;width:518px;height:466px;left:548px;top:689px;transform:rotate(-10deg)}.one .gobble-main svg{width:100%;height:100%}.one .hungry-note{position:absolute;left:698px;top:1123px;font-size:27px;transform:rotate(-7deg)}.one .hungry-note span{font-size:31px}
.two{background:#39245a;color:#fffef6}.two .brand{color:#f9f4a7}.two .headline{position:absolute;left:70px;top:200px;font-size:163px;letter-spacing:-.04em;line-height:.9}.papers{position:absolute;left:63px;top:685px;width:960px;height:440px}.paper{position:absolute;border-radius:5px;background:#fffef6;color:#39245a}.sketch{width:319px;height:370px;left:0;top:13px;transform:rotate(-9deg);box-shadow:0 12px 0 #1c10313d}.sketch svg{width:240px;height:269px;position:absolute;left:37px;top:34px}.paper span{position:absolute;left:25px;bottom:22px;font-size:25px;font-weight:600}.design{width:318px;height:340px;left:292px;top:35px;background:#c5b5f5;transform:rotate(5deg);box-shadow:0 12px 0 #1c103150}.design .design-word{position:absolute;left:24px;top:42px;font:800 76px/.84 Bricolage,sans-serif;letter-spacing:-4px}.design .orange{position:absolute;left:206px;top:193px;width:58px;height:58px;border-radius:50%;background:#ff7547}.app{left:585px;top:4px;width:330px;height:350px;transform:rotate(13deg);background:#f9f4a7;box-shadow:0 12px 0 #1c103150}.app .bar{height:45px;border-bottom:2px solid #39245a3f;display:flex;align-items:center;gap:9px;padding:0 18px}.app .bar i{width:9px;height:9px;border-radius:50%;background:#39245a}.app svg{position:absolute;width:153px;left:89px;top:70px}.app .button{position:absolute;left:50px;right:50px;top:221px;height:40px;border:2px solid #39245a;border-radius:24px}.two .foot{display:block;font:550 39px/1.25 Bricolage,sans-serif;letter-spacing:-1px;bottom:66px}.two .foot span{color:#c5b5f5}.three{background:#c5b5f5}.three .headline{position:absolute;left:71px;top:211px;font-size:139px;line-height:.94;letter-spacing:-.04em}.share-note{position:absolute;left:86px;top:560px;z-index:2;background:#fffef6;width:585px;height:402px;transform:rotate(-4deg);padding:52px 46px;box-shadow:0 12px 0 #39245a15}.share-note::before{position:absolute;content:'';width:154px;height:47px;background:#f9f4a7db;left:215px;top:-19px;transform:rotate(8deg)}.share-note h2{font:700 62px/.96 Bricolage,sans-serif;letter-spacing:-2.5px;margin:0 0 25px}.share-note p{font:400 28px/1.35 DM,sans-serif;margin:0;width:450px}.share-note .tiny{font-size:23px;margin-top:20px}.three .gobble-main{position:absolute;left:678px;top:660px;width:352px;transform:rotate(11deg)}.three .gobble-main svg{width:100%;height:auto}.three .gobble-caption{position:absolute;left:713px;top:988px;font-size:26px;transform:rotate(7deg)}.three .cta{position:absolute;left:75px;bottom:133px;font:750 70px/.95 Bricolage,sans-serif;letter-spacing:-2.6px;margin:0}.three .foot{font-size:29px;bottom:62px}.three .url{font-weight:650;letter-spacing:-.6px}
@media print{body{background:white}.slide{break-after:page;margin:0}}@page{size:1080px 1350px;margin:0}
</style></head><body>
<section class="slide one" aria-label="Slide 1: introducing Tadgobble">${logo()}
<h1 class="headline">you<br>cooked.</h1>
<p class="tagline">we brought the<br>chronically<br>online.</p>
<div class="gobble-main">${gobble('#39245a',true)}</div>
<footer class="foot"><span>meet tadgobble.</span><span class="swipe">swipe, gobbler <svg viewBox="0 0 34 24"><path class="arrow" d="M2 12h29m-9-9 9 9-9 9"/></svg></span></footer></section>
<section class="slide two" aria-label="Slide 2: a home for creative work">${logo(true)}
<h1 class="headline">ur work<br>deserves<br>witnesses.</h1>
<div class="papers"><div class="paper sketch">${flower}<span>that sketch.</span></div><div class="paper design"><div class="design-word">good<br>weird<br>stuff.</div><div class="orange"></div><span>that design.</span></div><div class="paper app"><div class="bar"><i></i><i></i><i></i></div>${gobble()}<div class="button"></div><span>that tiny app.</span></div></div>
<footer class="foot">art. design. tiny apps.<br><span>all ur weird little side quests.</span></footer></section>
<section class="slide three" aria-label="Slide 3: how to share art">${logo()}
<h1 class="headline">no portfolio?<br>no problem.</h1>
<div class="share-note"><h2>got art?<br>photo + title.</h2><p>that’s enough to send it<br>our way.</p><p class="tiny">reviewed before it goes live.</p></div>
<div class="gobble-main">${gobble()}</div><div class="gobble-caption">let him see it.</div>
<p class="cta">drop ur work.</p>
<footer class="foot"><span class="url">tadgobble.web.app</span><span>link in bio</span></footer></section>
</body></html>`;

writeFileSync(path.join(out,'editable-post.html'),html);
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:1});
  await page.goto(pathToFileURL(path.join(out,'editable-post.html')).href);
  await page.evaluate(()=>document.fonts.ready);
  for(let i=0;i<3;i++) {
    const name=`0${i+1}-${['you-cooked','your-work','drop-your-work'][i]}`;
    const png=await page.locator('.slide').nth(i).screenshot({path:path.join(out,name+'.png')});
    await sharp(png).jpeg({quality:96,chromaSubsampling:'4:4:4'}).toFile(path.join(out,name+'.jpg'));
  }
  const panels=await Promise.all(['01-you-cooked','02-your-work','03-drop-your-work'].map(async(name,i)=>({input:await sharp(path.join(out,name+'.png')).resize(360,450).png().toBuffer(),left:24+i*384,top:24})));
  await sharp({create:{width:1176,height:498,channels:3,background:'#e6e2e9'}}).composite(panels).png().toFile(path.join(out,'carousel-preview.png'));
  const bounds=await page.locator('.slide').evaluateAll(slides=>slides.map(slide=>({
    slide:slide.getAttribute('aria-label'),
    text:[...slide.querySelectorAll('h1,h2,p,footer')].map(el=>({text:el.innerText.replaceAll('\n',' / '),right:Math.round(el.getBoundingClientRect().right-slide.getBoundingClientRect().left),bottom:Math.round(el.getBoundingClientRect().bottom-slide.getBoundingClientRect().top)})),
  })));
  console.log(JSON.stringify({output:out,dimensions:'1080x1350',bounds},null,2));
}finally{await browser.close();}
