import { createClient } from 'npm:@supabase/supabase-js@2';
import { scrypt } from 'npm:@noble/hashes@1.8.0/scrypt';

const origins = new Set(['https://tadgobble.web.app', 'https://tadgobble.firebaseapp.com', 'http://127.0.0.1:3000', 'http://127.0.0.1:4173']);
Deno.serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': origins.has(origin) ? origin : 'https://tadgobble.web.app', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' };
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !origins.has(origin)) return reply(403, { error: 'Not allowed.' });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return reply(405, { error: 'Method not allowed.' });
  try {
    // Enforce the actual byte count, including requests without Content-Length.
    const reader = req.body?.getReader();
    const chunks: Uint8Array[] = []; let size = 0;
    if (!reader) return reply(400, { error: 'Invalid request.' });
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 8192) { await reader.cancel(); return reply(413, { error: 'Request too large.' }); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const { email, password } = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || password.length < 12 || password.length > 128)
      return reply(401, { error: 'Email or password was not recognised.' });
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const { data: legacy, error } = await admin.rpc('tg_legacy_password', { email_value: email.trim().toLowerCase(), client_address: (req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim() });
    if (error || !legacy) return reply(401, { error: 'Email or password was not recognised.' });
    const [salt, expected] = legacy.hash.split(':');
    const actual = scrypt(password, salt, { N: 16384, r: 8, p: 1, dkLen: 64 });
    let difference = 0;
    for (let i = 0; i < 64; i++) difference |= actual[i] ^ parseInt(expected.slice(i * 2, i * 2 + 2), 16);
    if (difference !== 0) return reply(401, { error: 'Email or password was not recognised.' });
    const { error: updateError } = await admin.auth.admin.updateUserById(legacy.id, { password });
    if (updateError) return reply(503, { error: 'Sign-in could not finish. Please try again.' });
    await admin.rpc('tg_finish_legacy_password', { user_id: legacy.id });
    return reply(200, { ok: true });
  } catch { return reply(401, { error: 'Email or password was not recognised.' }); }
});
