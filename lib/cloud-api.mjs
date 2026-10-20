import { createClient } from '@supabase/supabase-js';

let client;
export function supabase() {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error('The website connection has not been configured.');
    client = createClient(url, key, { auth: { flowType: 'pkce' } });
  }
  return client;
}

function unwrap({ data, error }) {
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function rpc(route, payload = {}, signal) {
  let request = supabase().rpc('tg_api', { route, payload });
  if (signal) request = request.abortSignal(signal);
  return unwrap(await request);
}

async function resolveCovers(data) {
  const products = [...(data.products || []), ...(data.product ? [data.product] : [])];
  const covers = [...products.map((p) => p.cover), data.cover].filter((c) => c?.path && c.status === 'ready');
  if (covers.length) {
    const paths = [...new Set(covers.map((c) => c.path))];
    const signed = unwrap(await supabase().storage.from('covers').createSignedUrls(paths, 300));
    const urls = new Map(signed.map((item) => [item.path, item.signedUrl]));
    for (const cover of covers) cover.url = urls.get(cover.path) || null;
  }
  return data;
}

async function uploadCover(form, signal) {
  const file = form.get('file');
  if (!file || file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPG, PNG, or WebP image under 5 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width < 160 || bitmap.height < 120 || bitmap.width * bitmap.height > 25_000_000)
      throw new Error('Use an image at least 160 × 120 pixels and below 25 megapixels.');
    const canvas = document.createElement('canvas');
    canvas.width = 1600;
    canvas.height = 1200;
    const context = canvas.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, 1600, 1200);
    const scale = Math.max(1600 / bitmap.width, 1200 / bitmap.height);
    context.drawImage(bitmap, (1600 - bitmap.width * scale) / 2, (1200 - bitmap.height * scale) / 2, bitmap.width * scale, bitmap.height * scale);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.84));
    if (!blob || signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
    const { cover } = await rpc('covers/prepare', {}, signal);
    unwrap(await supabase().storage.from('covers').upload(cover.path, blob, { contentType: 'image/webp', upsert: false }));
    return resolveCovers(await rpc('covers/complete', { id: cover.id }, signal));
  } finally {
    bitmap.close();
  }
}

export async function cloudApi(route, body = {}, { signal } = {}) {
  const sb = supabase();
  if (route === 'auth/google') {
    const settings = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }, signal,
    });
    if (!settings.ok || !(await settings.json()).external?.google)
      throw new Error('Google sign-in is still being connected. Please try again soon.');
    const next = body.afterAuth === 'submit' ? '/discover?submit=1' : location.pathname + location.search;
    sessionStorage.setItem('tg_auth_return', next);
    unwrap(await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/auth/callback` } }));
    return { redirecting: true };
  }
  if (route === 'auth/complete') {
    const { session } = unwrap(await sb.auth.getSession());
    if (!session) throw new Error('Sign-in was not completed. Give it another go.');
    let next = sessionStorage.getItem('tg_auth_return') || '/discover';
    sessionStorage.removeItem('tg_auth_return');
    // Only return to a known page on this origin, never a URL supplied by an external site.
    const target = new URL(next, location.origin);
    if (target.origin !== location.origin || !/^\/(discover|studio|product\/[^/]+)\/?$/.test(target.pathname)) next = '/discover';
    return { next };
  }
  if (route === 'auth/register') {
    throw new Error('Use Continue with Google to create your account.');
  }
  if (route === 'auth/login') {
    const credentials = { email: body.email.trim(), password: body.password };
    let result = await sb.auth.signInWithPassword(credentials);
    if (result.error?.code === 'invalid_credentials') {
      const migrated = await sb.functions.invoke('legacy-login', { body: credentials });
      if (!migrated.error && migrated.data?.ok) result = await sb.auth.signInWithPassword(credentials);
    }
    unwrap(result);
    return rpc('bootstrap');
  }
  if (route === 'auth/logout') {
    unwrap(await sb.auth.signOut());
    return { ok: true };
  }
  if (route === 'covers/upload') return uploadCover(body, signal);
  if (route === 'covers/capture') {
    let result = await rpc(route, body, signal);
    // A queued preview stays attached to the submission even if the desktop worker is offline.
    for (let i = 0; i < 4 && ['queued', 'capturing'].includes(result.cover?.status); i++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      result = await rpc('covers/status', { id: result.cover.id }, signal);
    }
    if (result.cover?.status === 'failed') throw new Error(result.cover.error || 'Upload an image instead.');
    return resolveCovers(result);
  }
  if (route === 'events') {
    let visitor;
    try {
      visitor = localStorage.getItem('tg_visitor') || crypto.randomUUID();
      localStorage.setItem('tg_visitor', visitor);
    } catch { visitor = crypto.randomUUID(); }
    return rpc(route, { ...body, visitor });
  }
  const data = await rpc(route, body, signal);
  if (route === 'account/delete') await sb.auth.signOut({ scope: 'local' });
  return resolveCovers(data);
}
