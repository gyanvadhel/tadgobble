import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { dataDir, all, get, run, id, now } from './db.mjs';
import { AppError, rateLimit } from './auth.mjs';
import { captureWebsite } from './capture.mjs';

export const coverDir = path.join(dataDir, 'covers');
mkdirSync(coverDir, { recursive: true });
export const coverInfo = (cover) => ({
  id: cover.id,
  url: `/api/covers/${cover.id}`,
  kind: cover.kind,
  created_at: cover.created_at,
});

function cleanAbandonedCovers() {
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  for (const cover of all(
    'SELECT * FROM product_covers WHERE created_at<? AND id NOT IN (SELECT cover_id FROM products WHERE cover_id IS NOT NULL)',
    cutoff,
  )) {
    try {
      unlinkSync(path.join(coverDir, cover.filename));
    } catch {}
    run('DELETE FROM product_covers WHERE id=?', cover.id);
  }
}

export async function storeCover(bytes, userId, kind, sourceUrl = '') {
  let output;
  try {
    const image = sharp(bytes, { limitInputPixels: 25_000_000, failOn: 'error' });
    const metadata = await image.metadata();
    if (!['png', 'jpeg', 'webp'].includes(metadata.format) || (metadata.pages || 1) > 1)
      throw new Error();
    if (metadata.width < 160 || metadata.height < 120)
      throw new AppError('Use an image at least 160 × 120 pixels.');
    output = await image
      .rotate()
      .resize(1600, 1200, { fit: 'cover', position: 'centre' })
      .flatten({ background: '#ffffff' })
      .webp({ quality: 84 })
      .toBuffer();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('Choose a valid, still JPG, PNG, or WebP image under 5 MB.');
  }
  cleanAbandonedCovers();
  const cover = { id: id(), kind, created_at: now() };
  const filename = `${cover.id}.webp`;
  writeFileSync(path.join(coverDir, filename), output);
  try {
    run(
      'INSERT INTO product_covers VALUES (?,?,?,?,?,?)',
      cover.id,
      userId,
      filename,
      kind,
      sourceUrl,
      cover.created_at,
    );
  } catch (error) {
    unlinkSync(path.join(coverDir, filename));
    throw error;
  }
  return coverInfo(cover);
}

export async function uploadCover(req, userId) {
  rateLimit(`cover-upload:${userId}`, 20, 3600000);
  const limit = 6 * 1024 * 1024;
  if (Number(req.headers.get('content-length')) > limit)
    throw new AppError('Keep your image under 5 MB.', 413);
  const chunks = [];
  let size = 0;
  const reader = req.body?.getReader();
  if (!reader) throw new AppError('Choose a cover image.');
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new AppError('Keep your image under 5 MB.', 413);
    }
    chunks.push(Buffer.from(value));
  }
  let form;
  try {
    form = await new Response(Buffer.concat(chunks), {
      headers: { 'Content-Type': req.headers.get('content-type') || '' },
    }).formData();
  } catch {
    throw new AppError('Choose a cover image to upload.');
  }
  const file = form.get('file');
  if (!file || typeof file === 'string' || !file.size || file.size > 5 * 1024 * 1024)
    throw new AppError('Choose an image under 5 MB.');
  return storeCover(Buffer.from(await file.arrayBuffer()), userId, 'upload');
}

export async function automaticCover(url, userId, refresh = false) {
  if (!refresh) {
    const cached = get(
      "SELECT * FROM product_covers WHERE owner_id=? AND source_url=? AND kind='capture' AND created_at>? ORDER BY created_at DESC LIMIT 1",
      userId,
      url,
      new Date(Date.now() - 86400000).toISOString(),
    );
    if (cached) return coverInfo(cached);
  }
  rateLimit(`cover-capture:${userId}`, 10, 3600000);
  rateLimit('cover-capture:global', 80, 3600000);
  try {
    const { image } = await captureWebsite(url);
    return await storeCover(image, userId, 'capture', url);
  } catch (error) {
    if (error.message.includes('camera is busy')) throw new AppError(error.message, 429);
    throw new AppError(
      'We couldn’t capture this page. Try again, upload a cover, or continue without one.',
      422,
    );
  }
}

export function ownedCover(value, userId) {
  if (!value) return null;
  if (
    typeof value !== 'string' ||
    !get('SELECT id FROM product_covers WHERE id=? AND owner_id=?', value, userId)
  )
    throw new AppError('Choose a cover uploaded or captured from your account.');
  return value;
}

export function coverResponse(coverId, user) {
  const cover = get('SELECT * FROM product_covers WHERE id=?', coverId);
  const published =
    cover && get("SELECT id FROM products WHERE cover_id=? AND status='published'", coverId);
  if (!cover || (!published && user?.role !== 'admin' && (!user || user.id !== cover.owner_id)))
    throw new AppError('Cover not found.', 404);
  let bytes;
  try {
    bytes = readFileSync(path.join(coverDir, cover.filename));
  } catch {
    throw new AppError('Cover not found.', 404);
  }
  return new Response(bytes, {
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(bytes.length),
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
}
