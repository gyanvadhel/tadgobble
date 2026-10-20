'use client';
import { useEffect, useState } from 'react';
import Launch from '../components/launch';
import Platform from '../components/platform';
import { api } from '../lib/client-api.mjs';

export function CloudLanding() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (['from', 'saved', 'submit', 'signin', 'privacy', 'sponsor'].some((key) => params.has(key))) {
      location.replace('/discover' + location.search);
      return;
    }
    api('bootstrap').then((data) => setProducts(data.products)).catch((e) => setError(e.message));
  }, []);
  return <>{error && <p className="form-error" role="alert">Discoveries could not load. <a href="/discover">Try again</a>.</p>}<Launch products={products} /></>;
}

export function CloudProduct() {
  const [slug, setSlug] = useState(null);
  useEffect(() => setSlug(decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '')), []);
  if (slug === null) return <div className="loading">Opening this discovery…</div>;
  if (!slug) return <Platform />;
  return <Platform initialSlug={slug} />;
}

export function CloudOutbound() {
  const [error, setError] = useState('');
  useEffect(() => {
    const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
    api('products/' + slug).then(async ({ product }) => {
      const target = new URL(product.url);
      if (!['https:', 'http:'].includes(target.protocol)) throw new Error('This product link is unavailable.');
      await Promise.race([api('events', { kind: 'outbound', productId: product.id, source: new URLSearchParams(location.search).get('source') || 'direct' }).catch(() => {}), new Promise((resolve) => setTimeout(resolve, 700))]);
      location.replace(target.href);
    }).catch((e) => setError(e.message));
  }, []);
  return <div className="empty-state"><p>{error || 'Taking you to the good stuff…'}</p><a href="/discover">Back to discoveries</a></div>;
}

export function CloudAuthCallback() {
  const [error, setError] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fragment = new URLSearchParams(location.hash.slice(1));
    if (params.has('error') || fragment.has('error')) {
      setError('Google sign-in was cancelled or could not finish. You can try again.');
      history.replaceState(null, '', '/auth/callback');
      return;
    }
    api('auth/complete').then(({ next }) => location.replace(next)).catch((e) => setError(e.message));
  }, []);
  return <main className="empty-state" aria-live="polite"><h1>{error ? 'One more try?' : 'Making room in the stash…'}</h1><p>{error || 'Finishing your Google sign-in.'}</p>{error && <a className="button button-dark" href="/discover?signin=1">Back to sign in</a>}</main>;
}
