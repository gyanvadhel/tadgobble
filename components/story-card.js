// Draws share images for Instagram and other apps. Two sizes:
//  - story (1080×1920, 9:16): everything stays inside the area Instagram leaves
//    clear of its own buttons (top and bottom 250px).
//  - post (1080×1350, 4:5): the tallest size the feed shows without cropping, so
//    nothing gets cut when someone picks "Post" instead of "Story". Side margins
//    also survive the 3:4 crop of the profile grid.
import { productSceneColor } from './product-showcase';
import { profileColors } from '../lib/blob-options.mjs';

const W = 1080,
  INK = '#39245a',
  BUTTER = '#f9f4a7',
  DISPLAY = "'Bricolage Grotesque', Arial, sans-serif",
  BODY = "'DM Sans', Arial, sans-serif";

export const shareFormats = {
  story: { h: 1920, top: 260, pillY: 1580, imgMaxH: 950, titleMax: 2, bigTitle: 150 },
  post: { h: 1350, top: 110, pillY: 1190, imgMaxH: 600, titleMax: 2, bigTitle: 124 },
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Breaks text into at most `max` lines that fit `width`, ending with … if cut.
function wrap(ctx, text, width, max) {
  const lines = [];
  let line = '';
  for (const word of String(text || '').split(/\s+/)) {
    const next = line ? line + ' ' + word : word;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > max) {
    lines.length = max;
    let last = lines[max - 1];
    while (last && ctx.measureText(last + '…').width > width) last = last.slice(0, -1);
    lines[max - 1] = last.trimEnd() + '…';
  }
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

async function setup(format) {
  await Promise.all(
    [`700 88px ${DISPLAY}`, `500 40px ${BODY}`, `600 34px ${BODY}`].map((f) =>
      document.fonts?.load(f),
    ),
  ).catch(() => {});
  const f = shareFormats[format] || shareFormats.story;
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: f.h });
  return { f, canvas, ctx: canvas.getContext('2d') };
}

// The address pill at the bottom, so people know where to find it.
function pill(ctx, f, site, text) {
  ctx.font = `600 34px ${BODY}`;
  const label = text || site.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const width = ctx.measureText(label).width + 84;
  roundRect(ctx, 90, f.pillY, width, 80, 40);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.fillStyle = BUTTER;
  ctx.fillText(label, 132, f.pillY + 52);
}

async function toFile(canvas, base, format) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not draw the share image.');
  const name = (base || 'tadgobble').replace(/[^\w-]/g, '') + `-${format}.png`;
  return new File([blob], name, { type: 'image/png' });
}

// A piece of work: the cover on its colour, the title, the creator.
export async function workCard(product, site, format = 'story') {
  const { f, canvas, ctx } = await setup(format);
  ctx.fillStyle = productSceneColor(product);
  ctx.fillRect(0, 0, W, f.h);

  const by = product.sponsored
    ? 'Paid feature'
    : product.owner_name
      ? 'by ' + product.owner_name
      : 'An editorial find';
  const img = product.cover?.url ? await loadImage(product.cover.url).catch(() => null) : null;
  // Measure everything first so the picture and words sit centred together
  // between the top of the frame and the address pill.
  const titleSize = img ? 88 : f.bigTitle;
  ctx.font = `700 ${titleSize}px ${DISPLAY}`;
  const title = wrap(ctx, product.name, W - 180, img ? f.titleMax : 4);
  ctx.font = `500 44px ${BODY}`;
  const tagline = !img && product.tagline ? wrap(ctx, product.tagline, W - 180, 3) : [];
  const scale = img ? Math.min(900 / img.width, f.imgMaxH / img.height) : 0,
    imgW = img ? img.width * scale : 0,
    imgH = img ? img.height * scale : 0;
  const gap = format === 'post' ? 80 : 110;
  const blockH =
    (img ? imgH + gap : 0) +
    title.length * titleSize * 1.02 +
    (tagline.length ? 30 + tagline.length * 58 : 0) +
    80;
  const room = f.pillY - 30 - f.top;
  let y = f.top + Math.max(0, (room - blockH) / 2);

  if (img) {
    const x = (W - imgW) / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(57,36,90,.28)';
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 24;
    roundRect(ctx, x, y, imgW, imgH, 28);
    ctx.fillStyle = '#fffdf8';
    ctx.fill();
    ctx.restore();
    ctx.save();
    roundRect(ctx, x, y, imgW, imgH, 28);
    ctx.clip();
    ctx.drawImage(img, x, y, imgW, imgH);
    ctx.restore();
    y += imgH + gap;
  } else y += titleSize * 0.8;

  ctx.fillStyle = INK;
  ctx.font = `700 ${titleSize}px ${DISPLAY}`;
  title.forEach((line, i) => ctx.fillText(line, 90, y + i * titleSize * 1.02));
  y += (title.length - 1) * titleSize * 1.02;
  ctx.font = `500 44px ${BODY}`;
  tagline.forEach((line, i) => ctx.fillText(line, 90, y + 80 + i * 58));
  if (tagline.length) y += 30 + tagline.length * 58;
  ctx.font = `500 40px ${BODY}`;
  ctx.globalAlpha = 0.8;
  ctx.fillText(wrap(ctx, by, W - 180, 1)[0], 90, y + 70);
  ctx.globalAlpha = 1;

  pill(ctx, f, site);
  return toFile(canvas, product.slug, format);
}

// A maker's profile: their photo (or initial), name, what they make, and their link.
export async function profileCard(profile, site, format = 'story') {
  const { f, canvas, ctx } = await setup(format);
  ctx.fillStyle = profileColors.find((c) => c.id === profile.color)?.hex || profileColors[0].hex;
  ctx.fillRect(0, 0, W, f.h);

  const photo = profile.avatar?.url ? await loadImage(profile.avatar.url).catch(() => null) : null;
  const size = format === 'post' ? 300 : 380;
  ctx.font = `700 120px ${DISPLAY}`;
  const name = wrap(ctx, profile.name, W - 180, 2);
  ctx.font = `500 46px ${BODY}`;
  const about = profile.specialty ? wrap(ctx, profile.specialty, W - 180, 2) : [];
  const blockH = size + 120 + name.length * 124 + (about.length ? 20 + about.length * 60 : 0) + 90;
  let y = f.top + Math.max(0, (f.pillY - 30 - f.top - blockH) / 2);

  // A round portrait with a soft shadow, or their first letter on Gobble purple.
  const cx = 90 + size / 2,
    cy = y + size / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(57,36,90,.25)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 20;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = photo ? '#fffdf8' : INK;
  ctx.fill();
  ctx.restore();
  if (photo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.clip();
    const s = Math.max(size / photo.width, size / photo.height);
    ctx.drawImage(
      photo,
      cx - (photo.width * s) / 2,
      cy - (photo.height * s) / 2,
      photo.width * s,
      photo.height * s,
    );
    ctx.restore();
  } else {
    ctx.fillStyle = BUTTER;
    ctx.font = `700 ${size * 0.5}px ${DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((profile.name || '?').trim()[0]?.toUpperCase() || '?', cx, cy + size * 0.03);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }
  y += size + 120 + 100;

  ctx.fillStyle = INK;
  ctx.font = `700 120px ${DISPLAY}`;
  name.forEach((line, i) => ctx.fillText(line, 90, y + i * 124));
  y += (name.length - 1) * 124;
  ctx.font = `500 46px ${BODY}`;
  about.forEach((line, i) => ctx.fillText(line, 90, y + 80 + i * 60));
  if (about.length) y += 20 + about.length * 60;
  ctx.font = `500 40px ${BODY}`;
  ctx.globalAlpha = 0.8;
  ctx.fillText('@' + profile.username, 90, y + 80);
  ctx.globalAlpha = 1;

  const host = site.replace(/^https?:\/\//, '').replace(/\/$/, '');
  pill(ctx, f, site, `${host}/profile/${profile.username}`);
  return toFile(canvas, profile.username, format);
}

// Kept for anything still importing the old name.
export const storyCard = (product, site) => workCard(product, site, 'story');
