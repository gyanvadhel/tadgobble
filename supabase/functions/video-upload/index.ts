import { createClient } from 'npm:@supabase/supabase-js@2';
import * as media from 'npm:mediabunny@1.62.0';
import { inspectVideo, readVideoForm } from '../_shared/video.mjs';

const origins = new Set([
  'https://tadgobble.web.app',
  'https://tadgobble.firebaseapp.com',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:4186',
]);
Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': origins.has(origin) ? origin : 'https://tadgobble.web.app',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  const reply = (status: number, data: object) =>
    new Response(JSON.stringify(data), { status, headers });
  if (origin && !origins.has(origin)) return reply(403, { error: 'Not allowed.' });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' });
  const url = Deno.env.get('SUPABASE_URL')!;
  const member = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('authorization') || '' } },
    auth: { persistSession: false },
  });
  const { data: uid, error: gateError } = await member.rpc('tg_video_upload_gate');
  if (gateError || !uid)
    return reply(403, { error: gateError?.message || 'Sign in to upload a video.' });
  let file, poster, metadata;
  try {
    ({ file, poster } = await readVideoForm(req));
    metadata = await inspectVideo(file, media);
  } catch (error) {
    return reply(400, {
      error: error instanceof Error ? error.message : 'This video could not be prepared.',
    });
  }
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const cid = crypto.randomUUID(),
    vid = crypto.randomUUID();
  const posterPath = `${uid}/${cid}.webp`,
    videoPath = `${uid}/${vid}.${metadata.mime === 'video/webm' ? 'webm' : 'mp4'}`;
  const check = (result: any) => {
    if (result.error) throw new Error('Video upload could not finish. Please try again.');
    return result.data;
  };
  try {
    check(
      await admin.storage
        .from('covers')
        .upload(posterPath, poster, { contentType: 'image/webp', upsert: false }),
    );
    check(
      await admin.storage
        .from('videos')
        .upload(videoPath, file, { contentType: metadata.mime, upsert: false }),
    );
    const result = check(
      await admin.rpc('tg_video_finalize', {
        uid,
        cid,
        vid,
        poster_path: posterPath,
        video_path: videoPath,
        metadata,
      }),
    );
    return reply(200, result);
  } catch {
    await Promise.all([
      admin.storage.from('covers').remove([posterPath]),
      admin.storage.from('videos').remove([videoPath]),
    ]);
    return reply(503, { error: 'Video upload could not finish. Please try again.' });
  }
});
