import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyUnsubscribe } from '../_shared/notify.mjs';

// The link at the bottom of every maker email. POST is the one-click button some mail apps show;
// GET is the person clicking the link. Both turn the maker's email switch off.
const page = (message: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>tadgobble</title></head>` +
  `<body style="margin:0;background:#fdf6e9;color:#2a2118;font-family:Georgia,'Times New Roman',serif">` +
  `<main style="max-width:480px;margin:0 auto;padding:64px 20px"><p style="color:#6b3fa0;letter-spacing:.04em">tadgobble</p>` +
  `<p style="font-size:20px;line-height:1.5">${message}</p>` +
  `<p><a href="https://tadgobble.in/settings" style="color:#6b3fa0">Open Settings</a></p></main></body></html>`;

Deno.serve(async (req) => {
  const plain = (status: number, body: string) =>
    new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  if (req.method !== 'GET' && req.method !== 'POST') return plain(405, 'Method not allowed.');
  const secret = Deno.env.get('UNSUBSCRIBE_SECRET');
  if (!secret) return plain(503, 'Unsubscribe is not set up yet.');
  const userId = await verifyUnsubscribe(new URL(req.url).searchParams.get('t') || '', secret);
  if (!userId) return plain(400, 'This unsubscribe link is not valid.');
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { error } = await admin.rpc('tg_unsubscribe', { user_id: userId });
  if (error) return plain(503, 'Could not update your emails. Please try again.');
  if (req.method === 'POST') return plain(200, 'Unsubscribed.');
  return new Response(page('Done. Gobble will stop emailing you. You can turn emails back on in Settings.'), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
});
