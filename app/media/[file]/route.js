import { statSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { get, mediaDir } from '../../../lib/db.mjs';
import { currentUser } from '../../../lib/auth.mjs';
export const dynamic = 'force-dynamic';
export async function GET(req, { params }) {
  const file = (await params).file;
  if (!/^[a-f0-9-]+-reel\.mp4$/.test(file)) return new Response('Not found', { status: 404 });
  const j = get('SELECT status FROM jobs WHERE output_file=?', file);
  if (
    !j ||
    (!['approved', 'queued', 'publishing', 'published', 'needs_attention'].includes(j.status) &&
      currentUser(req)?.role !== 'admin')
  )
    return new Response('Not found', { status: 404 });
  const location = path.join(mediaDir, file);
  let size;
  try {
    size = statSync(location).size;
  } catch {
    return new Response('Not found', { status: 404 });
  }
  let start = 0,
    end = size - 1,
    status = 200;
  const range = req.headers.get('range');
  if (range) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range);
    if (!match)
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : end;
    if (start > end || end >= size)
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    status = 206;
  }
  const headers = {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Content-Length': String(end - start + 1),
    'Cache-Control': 'private, max-age=0',
  };
  if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  return new Response(Readable.toWeb(createReadStream(location, { start, end })), {
    status,
    headers,
  });
}
