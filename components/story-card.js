// Draws a 9:16 Instagram-story image for a piece of work: the cover on its
// colour, the title, the creator and the site address. Everything stays inside
// the area Instagram leaves clear of its own buttons (top and bottom 250px).
import { productSceneColor } from './product-showcase';

const W = 1080,
  H = 1920,
  INK = '#39245a',
  DISPLAY = "'Bricolage Grotesque', Arial, sans-serif",
  BODY = "'DM Sans', Arial, sans-serif";

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
  for (const word of text.split(/\s+/)) {
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

export async function storyCard(product, site) {
  await Promise.all(
    [`700 88px ${DISPLAY}`, `500 40px ${BODY}`].map((f) => document.fonts?.load(f)),
  ).catch(() => {});
  const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = productSceneColor(product);
  ctx.fillRect(0, 0, W, H);

  const by = product.sponsored
    ? 'Paid feature'
    : product.owner_name
      ? 'by ' + product.owner_name
      : 'An editorial find';
  const img = product.cover?.url ? await loadImage(product.cover.url) : null;
  // Measure everything first so the picture and words sit centred together
  // between the top of the frame and the address pill.
  ctx.font = `700 ${img ? 88 : 150}px ${DISPLAY}`;
  const titleSize = img ? 88 : 150,
    title = wrap(ctx, product.name, W - 180, img ? 2 : 4);
  ctx.font = `500 44px ${BODY}`;
  const tagline = !img && product.tagline ? wrap(ctx, product.tagline, W - 180, 3) : [];
  const scale = img ? Math.min(900 / img.width, 950 / img.height) : 0,
    imgW = img ? img.width * scale : 0,
    imgH = img ? img.height * scale : 0;
  const blockH =
    (img ? imgH + 110 : 0) +
    title.length * titleSize * 1.02 +
    (tagline.length ? 30 + tagline.length * 58 : 0) +
    80;
  let y = 260 + Math.max(0, (1290 - blockH) / 2);

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
    y += imgH + 110;
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

  // A small pill so people know where to find it.
  ctx.font = `600 34px ${BODY}`;
  const label = site.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const pill = ctx.measureText(label).width + 84;
  roundRect(ctx, 90, 1580, pill, 80, 40);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.fillStyle = '#f9f4a7';
  ctx.fillText(label, 132, 1632);

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('Could not draw the story image.');
  const name = (product.slug || 'tadgobble').replace(/[^\w-]/g, '') + '-story.png';
  return new File([blob], name, { type: 'image/png' });
}
