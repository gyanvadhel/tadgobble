import { createClient } from 'npm:@supabase/supabase-js@2';
import { unsubscribePage, verifyUnsubscribe } from '../_shared/notify.mjs';

// The link at the bottom of every maker email. POST turns the maker's email switch off: it is the
// one-click button some mail apps show, and the button on the page. GET only asks, so mail scanners
// that prefetch links cannot unsubscribe anyone.
Deno.serve(async (req) => {
  const plain = (status: number, body: string) =>
    new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  if (req.method !== 'GET' && req.method !== 'POST') return plain(405, 'Method not allowed.');
  const secret = Deno.env.get('UNSUBSCRIBE_SECRET');
  if (!secret) return plain(503, 'Unsubscribe is not set up yet.');
  const userId = await verifyUnsubscribe(new URL(req.url).searchParams.get('t') || '', secret);
  if (!userId) return plain(400, 'This unsubscribe link is not valid.');
  const html = (body: string) =>
    new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
    });
  if (req.method === 'GET') return html(unsubscribePage('ask'));
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { error } = await admin.rpc('tg_unsubscribe', { user_id: userId });
  if (error) return plain(503, 'Could not update your emails. Please try again.');
  const wantsPage = (req.headers.get('accept') || '').includes('text/html');
  return wantsPage ? html(unsubscribePage('done')) : plain(200, 'Unsubscribed.');
});
