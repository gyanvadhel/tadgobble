'use client';
import { useEffect, useState } from 'react';
import Launch from '../components/launch';
import Platform, { Field } from '../components/platform';
import { api } from '../lib/client-api.mjs';

export function CloudLanding() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (
      ['from', 'saved', 'submit', 'signin', 'privacy', 'sponsor'].some((key) => params.has(key))
    ) {
      location.replace('/discover' + location.search);
      return;
    }
    api('bootstrap')
      .then((data) => setProducts(data.products))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <>
      {error && (
        <p className="form-error" role="alert">
          Discoveries could not load. <a href="/discover">Try again</a>.
        </p>
      )}
      <Launch products={products} />
    </>
  );
}

export function CloudProduct() {
  const [slug, setSlug] = useState(null);
  useEffect(
    () => setSlug(decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '')),
    [],
  );
  if (slug === null) return <div className="loading">Opening this discovery…</div>;
  if (!slug) return <Platform />;
  return <Platform initialSlug={slug} />;
}

export function CloudOutbound() {
  const [error, setError] = useState('');
  useEffect(() => {
    const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean)[1] || '');
    api('products/' + slug)
      .then(async ({ product }) => {
        if (!product.url) {
          location.replace(`/product/${product.slug}`);
          return;
        }
        const target = new URL(product.url);
        if (!['https:', 'http:'].includes(target.protocol))
          throw new Error('This product link is unavailable.');
        await Promise.race([
          api('events', {
            kind: 'outbound',
            productId: product.id,
            source: new URLSearchParams(location.search).get('source') || 'direct',
          }).catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, 700)),
        ]);
        location.replace(target.href);
      })
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="empty-state">
      <p>{error || 'Taking you to the good stuff…'}</p>
      <a href="/discover">Back to discoveries</a>
    </div>
  );
}

export function CloudAuthCallback() {
  const [error, setError] = useState(''),
    [resetNext, setResetNext] = useState(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fragment = new URLSearchParams(location.hash.slice(1));
    const confirmed = params.has('confirmed'),
      reset = params.has('reset');
    if (params.has('error') || fragment.has('error')) {
      setError(
        reset
          ? 'That reset link has expired or was already used. Request a new one from sign in.'
          : confirmed
            ? 'That confirmation link has expired or was already used. Sign in, or sign up again for a fresh link.'
            : 'Sign-in was cancelled or could not finish. You can try again.',
      );
      history.replaceState(null, '', '/auth/callback');
      return;
    }
    api('auth/complete')
      .then(({ next }) => (reset ? setResetNext(next) : location.replace(next)))
      .catch((e) =>
        // A link opened in a different browser confirms the email but can't sign in there.
        setError(
          reset
            ? 'Open the reset link in the same browser you asked for it from, or request a new one.'
            : confirmed
              ? 'Your email is confirmed. Sign in with your email and password.'
              : e.message,
        ),
      );
  }, []);
  if (resetNext)
    return (
      <main className="empty-state">
        <form
          className="reset-password"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            try {
              await api('auth/password', {
                password: new FormData(e.currentTarget).get('password'),
              });
              location.replace(resetNext);
            } catch (failure) {
              setError(failure.message);
              setBusy(false);
            }
          }}
        >
          <h1>Pick a new password.</h1>
          <Field label="New password" hint="At least 12 characters.">
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
              autoFocus
            />
          </Field>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button button-dark button-full" disabled={busy}>
            {busy ? 'Saving…' : 'Save and continue'}
          </button>
        </form>
      </main>
    );
  return (
    <main className="empty-state" aria-live="polite">
      <h1>{error ? 'One more try?' : 'Making room in the stash…'}</h1>
      <p>{error || 'Finishing your sign-in.'}</p>
      {error && (
        <a className="button button-dark" href="/discover?signin=1">
          Back to sign in
        </a>
      )}
    </main>
  );
}
