import { createClient } from '@supabase/supabase-js';
export async function cloudSession() {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: process.env.CLOUD_ADMIN_EMAIL || process.env.ADMIN_EMAIL, password: process.env.CLOUD_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD });
  if (error) throw new Error('Cloud admin sign-in failed. Check the local admin credentials.');
  const rpc = async (route, payload = {}) => {
    const { data, error } = await client.rpc('tg_api', { route, payload });
    if (error) throw new Error(error.message);
    return data;
  };
  const data = await rpc('bootstrap');
  if (data.user?.role !== 'admin') throw new Error('The cloud worker requires the studio owner account.');
  return { client, rpc };
}
