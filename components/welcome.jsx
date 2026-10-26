'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, LoaderCircle } from 'lucide-react';
import { Brand } from './art';
import { AuthModal } from './platform';
import { Avatar } from './blob-avatar';
import BlobPicker from './blob-picker';
import StarterPreferences from './starter-preferences';
import { useProductCover } from './cover-editor';
import { api } from '../lib/client-api.mjs';
import { blobShapes, defaultBlob, safeReturn } from '../lib/blob-options.mjs';
import '../app/creators.css';

function Setup({ user }) {
  const [step, setStep] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [data, setData] = useState(() => ({
    ...user.profile,
    username: /^gobbler[0-9a-f]{32}$/.test(user.profile.username)
      ? user.name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .replace(/^[0-9]+/, '')
          .slice(0, 24) || 'gobbler'
      : user.profile.username,
  }));
  const [blob, setBlob] = useState(user.profile.blob || defaultBlob);
  const [mode, setMode] = useState(user.profile.avatar ? 'photo' : 'blob');
  const [preferences, setPreferences] = useState({
    intent: user.onboarding?.intent || 'explore',
    interests: user.onboarding?.interests || [],
  });
  const photo = useProductCover(user.profile.avatar);
  const heading = useRef(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const next = () => safeReturn(new URLSearchParams(location.search).get('next'));
  async function skip() {
    setBusy(true);
    setError('');
    try {
      await api('onboarding/skip', {});
      location.assign(next());
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    setError('');
    if (step === 1) {
      setStep(2);
      return;
    }
    setBusy(true);
    try {
      await api('onboarding/complete', {
        ...data,
        blob,
        preferences,
        avatarId: mode === 'photo' ? photo.cover?.id || null : null,
      });
      location.assign(next());
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  const selected = blobShapes.find((s) => s.id === blob.shape) || blobShapes[0];
  return (
    <div className="welcome-app">
      <header className="welcome-header">
        <Brand />
        <button className="text-button" disabled={busy || photo.busy} onClick={skip}>
          Skip for now
        </button>
      </header>
      <main className="welcome-main">
        <aside className="welcome-stage" aria-label="Your profile picture preview">
          <div className="welcome-orbit">
            <span>
              tiny face.
              <br />
              main character energy.
            </span>
            <Avatar
              key={mode === 'photo' ? photo.cover?.id : JSON.stringify(blob)}
              profile={{ ...data, blob, avatar: mode === 'photo' ? photo.cover : null }}
              size={300}
            />
            <span className="gobble-sticker">100% you-ish</span>
          </div>
          <p className="welcome-character">
            {mode === 'photo' && photo.cover ? data.name : selected.label}
          </p>
          <p className="welcome-character-note">
            {mode === 'photo' && photo.cover ? 'The face behind the good stuff.' : selected.note}
          </p>
        </aside>
        <section className="welcome-controls">
          <ol className="welcome-progress" aria-label="Account setup progress">
            <li aria-current={step === 1 ? 'step' : undefined}>1. Your blob</li>
            <li aria-current={step === 2 ? 'step' : undefined}>2. A little you</li>
          </ol>
          <h1 ref={heading} tabIndex={-1}>
            {step === 1 ? 'Meet your little weirdo.' : 'Make yourself at home.'}
          </h1>
          <p className="welcome-lead">
            {step === 1
              ? 'No profile pic? Adopt a Gobble. Extremely low maintenance.'
              : 'A name, a corner, a few things you’re into. That’s it.'}
          </p>
          <form onSubmit={submit}>
            {step === 1 ? (
              <BlobPicker
                value={blob}
                onChange={setBlob}
                photo={photo}
                mode={mode}
                onModeChange={setMode}
                disabled={busy || photo.busy}
                preview={false}
              />
            ) : (
              <>
                <div className="welcome-name-fields">
                  <label>
                    What should we call you?
                    <input
                      name="name"
                      autoComplete="nickname"
                      maxLength={60}
                      required
                      value={data.name}
                      disabled={busy}
                      onChange={(e) => setData({ ...data, name: e.target.value })}
                    />
                  </label>
                  <label>
                    Claim your username
                    <input
                      name="username"
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      pattern="[a-zA-Z][a-zA-Z0-9_]{2,39}"
                      minLength={3}
                      maxLength={40}
                      required
                      value={data.username}
                      disabled={busy}
                      onChange={(e) => setData({ ...data, username: e.target.value.toLowerCase() })}
                    />
                    <small>tadgobble.web.app/profile/{data.username || 'you'}</small>
                  </label>
                </div>
                <StarterPreferences value={preferences} onChange={setPreferences} disabled={busy} />
              </>
            )}
            {error && (
              <p role="alert" className="form-error">
                {error}
              </p>
            )}
            <div className="welcome-actions">
              {step === 2 && (
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => setStep(1)}
                >
                  <ArrowLeft size={16} /> Back
                </button>
              )}
              <button className="button button-dark" disabled={busy || photo.busy}>
                {busy ? (
                  <>
                    <LoaderCircle className="spin" size={17} /> Saving your corner…
                  </>
                ) : step === 1 ? (
                  <>
                    {mode === 'photo' && photo.cover ? 'Looks like me' : 'That’s my blob'}{' '}
                    <ArrowRight size={17} />
                  </>
                ) : (
                  <>
                    Let’s gobble <ArrowRight size={17} />
                  </>
                )}
              </button>
            </div>
            <p className="welcome-edit-note">Nothing set in stone. Change it all in Settings.</p>
          </form>
        </section>
      </main>
      <footer className="welcome-footer">
        <span>A little weird looks good on you.</span>
        <a href="/privacy">Privacy</a>
      </footer>
    </div>
  );
}
export default function Welcome() {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [auth, setAuth] = useState(false);
  async function load() {
    setLoading(true);
    setError('');
    try {
      setUser((await api('bootstrap')).user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);
  if (user) return <Setup key={user.id} user={user} />;
  return (
    <div className="welcome-app">
      <header className="welcome-header">
        <Brand />
      </header>
      <main className="welcome-guest">
        <Avatar profile={{ name: 'Your' }} size={150} />
        <h1>{loading ? 'Finding your little corner…' : 'Your Gobble is waiting.'}</h1>
        {error ? (
          <>
            <p role="alert">{error}</p>
            <button className="button" onClick={load}>
              Try again
            </button>
          </>
        ) : (
          !loading && (
            <>
              <p>Sign in first. Then make yourself at home.</p>
              <button className="button button-dark" onClick={() => setAuth(true)}>
                Sign in to get started
              </button>
            </>
          )
        )}
        <a href="/discover">Explore Tadgobble</a>
      </main>
      {auth && (
        <AuthModal
          onClose={() => setAuth(false)}
          onDone={() => {
            setAuth(false);
            load();
          }}
        />
      )}
    </div>
  );
}
