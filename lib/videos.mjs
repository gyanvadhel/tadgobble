import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import * as media from 'mediabunny';
import { get, run, id, now } from './db.mjs';
import { AppError, rateLimit } from './auth.mjs';
import { storeCover, coverDir, coverInfo } from './covers.mjs';
import { inspectVideo, readVideoForm } from '../supabase/functions/_shared/video.mjs';

export async function uploadVideo(req, userId) {
  rateLimit('video-upload:' + userId, 10, 3600000);
  let file, poster, metadata;
  try {
    ({ file, poster } = await readVideoForm(req));
    metadata = await inspectVideo(file, media);
  } catch (error) {
    throw new AppError(error.message);
  }
  const cover = await storeCover(Buffer.from(await poster.arrayBuffer()), userId, 'upload');
  const vid = id(),
    filename = vid + (metadata.mime === 'video/webm' ? '.webm' : '.mp4');
  try {
    writeFileSync(path.join(coverDir, filename), Buffer.from(await file.arrayBuffer()));
    run(
      'INSERT INTO video_assets (id,cover_id,owner_id,filename,mime,duration,width,height,bytes,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      vid,
      cover.id,
      userId,
      filename,
      metadata.mime,
      metadata.duration,
      metadata.width,
      metadata.height,
      metadata.bytes,
      now(),
    );
    return coverInfo(cover);
  } catch (error) {
    for (const name of [filename, cover.id + '.webp']) {
      try {
        unlinkSync(path.join(coverDir, name));
      } catch {}
    }
    run('DELETE FROM product_covers WHERE id=?', cover.id);
    throw error;
  }
}
function readableVideo(videoId, user) {
  const video = get('SELECT * FROM video_assets WHERE id=?', videoId);
  if (
    !video ||
    !(
      user?.id === video.owner_id ||
      user?.role === 'admin' ||
      get("SELECT id FROM products WHERE cover_id=? AND status='published'", video.cover_id)
    )
  )
    throw new AppError('This video is unavailable.', 404);
  return video;
}
export function videoLink(videoId, user) {
  const video = readableVideo(videoId, user);
  return { id: video.id, url: '/api/videos/' + video.id, mime: video.mime };
}
export function videoResponse(req, videoId, user) {
  const video = readableVideo(videoId, user);
  let bytes;
  try {
    bytes = readFileSync(path.join(coverDir, video.filename));
  } catch {
    throw new AppError('This video is unavailable.', 404);
  }
  const headers = {
    'Content-Type': video.mime,
    'Cache-Control': 'private, no-store',
    'Accept-Ranges': 'bytes',
    'X-Content-Type-Options': 'nosniff',
  };
  const range = req.headers.get('range');
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    let start = m?.[1] ? Number(m[1]) : 0,
      end = m?.[2] ? Number(m[2]) : bytes.length - 1;
    if (m && !m[1] && m[2]) {
      start = Math.max(0, bytes.length - Number(m[2]));
      end = bytes.length - 1;
    }
    if (
      !m ||
      (!m[1] && !m[2]) ||
      start >= bytes.length ||
      start > end ||
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end)
    )
      return new Response(null, {
        status: 416,
        headers: { ...headers, 'Content-Range': `bytes */${bytes.length}` },
      });
    end = Math.min(end, bytes.length - 1);
    return new Response(bytes.subarray(start, end + 1), {
      status: 206,
      headers: {
        ...headers,
        'Content-Length': String(end - start + 1),
        'Content-Range': `bytes ${start}-${end}/${bytes.length}`,
      },
    });
  }
  return new Response(bytes, { headers: { ...headers, 'Content-Length': String(bytes.length) } });
}
