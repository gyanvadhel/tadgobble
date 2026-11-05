import { createClient } from 'npm:@supabase/supabase-js@2';
import { drainOutbox, renderEmail, signUnsubscribe } from '../_shared/notify.mjs';

// Called every five minutes by Supabase Cron with the x-cron-secret header.
// Queues the weekly roundup when it is due, then sends whatever is waiting.
const SITE = 'https://tadgobble.in';
const FROM = 'Gobble at tadgobble <notifications@tadgobble.in>';
const REPLY_TO = 'hello@tadgobble.in';

const same = (a: string, b: string) => {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
};

Deno.serve(async (req) => {
  const reply = (status: number, body: object) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  const cron = Deno.env.get('CRON_SECRET') || '';
  const given = req.headers.get('x-cron-secret') || '';
  if (req.method !== 'POST' || !cron || !same(given, cron)) return reply(401, { error: 'Not allowed.' });

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const unsubscribeSecret = Deno.env.get('UNSUBSCRIBE_SECRET');
  if (!resendKey || !unsubscribeSecret) return reply(503, { error: 'Email is not set up yet.' });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const check = <T>({ data, error }: { data: T; error: { message: string } | null }) => {
    if (error) throw new Error(error.message);
    return data;
  };

  try {
    const queued = Number(check(await admin.rpc('tg_roundup_queue'))) || 0;
    const { sent, failed } = await drainOutbox({
      claim: async () => (check(await admin.rpc('tg_outbox_claim', { max_rows: 20 })) as unknown[]) || [],
      done: async (row_id: string, error: string | null) => {
        check(await admin.rpc('tg_outbox_done', { row_id, error }));
      },
      send: async ({ to, subject, html, text, headers }: Record<string, unknown>) => {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject, html, text, headers }),
        });
        if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
      },
      render: (row: unknown, options: Record<string, unknown>) => renderEmail(row, { site: SITE, ...options }),
      unsubscribeUrlFor: async (id: string) =>
        `${supabaseUrl}/functions/v1/unsubscribe?t=${await signUnsubscribe(id, unsubscribeSecret)}`,
      adminEmail: Deno.env.get('ADMIN_EMAIL') || REPLY_TO,
    });
    return reply(200, { queued, sent, failed });
  } catch (error) {
    return reply(500, { error: String((error as Error)?.message || error).slice(0, 300) });
  }
});
