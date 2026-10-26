import { createClient } from '@supabase/supabase-js';
import { setupDestination } from './blob-options.mjs';
import { prepareImage } from './prepare-image.mjs';

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
  const covers = [
    ...products.map((p) => p.cover),
    ...products.map((p) => p.creator_profile?.avatar),
    data.cover,
    data.profile?.avatar,
    data.user?.profile?.avatar,
    ...(data.comments || []).map((c) => c.profile?.avatar),
  ].filter((c) => c?.path && c.status === 'ready');
  if (covers.length) {
    const paths = [...new Set(covers.map((c) => c.path))];
    const signed = unwrap(await supabase().storage.from('covers').createSignedUrls(paths, 300));
    const urls = new Map(signed.map((item) => [item.path, item.signedUrl]));
    for (const cover of covers) cover.url = urls.get(cover.path) || null;
  }
  return data;
}

async function uploadCover(form, signal) {
  const blob = await prepareImage(form.get('file'), signal);
  const { cover } = await rpc('covers/prepare', {}, signal);
  unwrap(
    await supabase()
      .storage.from('covers')
      .upload(cover.path, blob, { contentType: 'image/webp', upsert: false }),
  );
  return resolveCovers(await rpc('covers/complete', { id: cover.id }, signal));
}

export async function cloudApi(route, body = {}, { signal } = {}) {
  const sb = supabase();
  if (route === 'videos/upload') {
    const result = await sb.functions.invoke('video-upload', { body, signal });
    if (result.error) {
      const detail = await result.error.context?.json?.().catch(() => null);
      throw new Error(
        detail?.error || result.error.message || 'Video upload could not finish. Please try again.',
      );
    }
    return resolveCovers(unwrap(result));
  }
  if (route === 'videos/play') {
    const video = unwrap(await sb.rpc('tg_video_play', { video_id: body.id }));
    video.url = unwrap(await sb.storage.from('videos').createSignedUrl(video.path, 300)).signedUrl;
    return { video };
  }
  if (route === 'auth/google') {
    const settings = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      signal,
    });
    if (!settings.ok || !(await settings.json()).external?.google)
      throw new Error('Google sign-in is still being connected. Please try again soon.');
    const next =
      body.afterAuth === 'submit' ? '/discover?submit=1' : location.pathname + location.search;
    sessionStorage.setItem('tg_auth_return', next);
    unwrap(
      await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${location.origin}/auth/callback` },
      }),
    );
    return { redirecting: true };
  }
  if (route === 'auth/reset') {
    sessionStorage.setItem('tg_auth_return', location.pathname + location.search);
    unwrap(
      await sb.auth.resetPasswordForEmail(String(body.email || '').trim(), {
        redirectTo: `${location.origin}/auth/callback?reset=1`,
      }),
    );
    return { ok: true };
  }
  if (route === 'auth/password') {
    if (String(body.password || '').length < 12)
      throw new Error('Use at least 12 characters for your password.');
    unwrap(await sb.auth.updateUser({ password: body.password }));
    return { ok: true };
  }
  if (route === 'auth/complete') {
    const { session } = unwrap(await sb.auth.getSession());
    if (!session) throw new Error('Sign-in was not completed. Give it another go.');
    let next = sessionStorage.getItem('tg_auth_return') || '/discover';
    sessionStorage.removeItem('tg_auth_return');
    // Only return to a known page on this origin, never a URL supplied by an external site.
    const target = new URL(next, location.origin);
    if (
      target.origin !== location.origin ||
      !/^\/(discover|studio|my-work|settings|profile\/[^/]+|product\/[^/]+)\/?$/.test(
        target.pathname,
      )
    )
      next = '/discover';
    const boot = await rpc('bootstrap');
    return { next: boot.user?.onboarding?.complete === false ? setupDestination(next) : next };
  }
  if (route === 'auth/register') {
    const name = String(body.name || '').trim();
    if (name.length < 2) throw new Error('Tell us your name (at least 2 characters).');
    sessionStorage.setItem('tg_auth_return', location.pathname + location.search);
    const { session } = unwrap(
      await sb.auth.signUp({
        email: String(body.email || '').trim(),
        password: body.password,
        options: {
          data: { name },
          emailRedirectTo: `${location.origin}/auth/callback?confirmed=1`,
        },
      }),
    );
    // With confirmations on, Supabase holds the account until the emailed link is opened.
    return session ? rpc('bootstrap') : { confirmationRequired: true };
  }
  if (route === 'auth/login') {
    const credentials = { email: body.email.trim(), password: body.password };
    let result = await sb.auth.signInWithPassword(credentials);
    if (result.error?.code === 'invalid_credentials') {
      const migrated = await sb.functions.invoke('legacy-login', { body: credentials });
      if (!migrated.error && migrated.data?.ok)
        result = await sb.auth.signInWithPassword(credentials);
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
    if (result.cover?.status === 'failed')
      throw new Error(result.cover.error || 'Upload an image instead.');
    return resolveCovers(result);
  }
  if (route === 'events') {
    let visitor;
    try {
      visitor = localStorage.getItem('tg_visitor') || crypto.randomUUID();
      localStorage.setItem('tg_visitor', visitor);
    } catch {
      visitor = crypto.randomUUID();
    }
    return rpc(route, { ...body, visitor });
  }
  const data = await rpc(route, body, signal);
  if (route === 'works/delete' && data.removed) {
    // Best effort: the post is already gone, so leftover files only cost storage.
    const { covers = [], videos = [] } = data.removed;
    await Promise.allSettled([
      covers.length && sb.storage.from('covers').remove(covers),
      videos.length && sb.storage.from('videos').remove(videos),
    ]);
  }
  if (route === 'account/delete') await sb.auth.signOut({ scope: 'local' });
  return resolveCovers(data);
}
