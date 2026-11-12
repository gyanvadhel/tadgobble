'use client';
import { useState } from 'react';
import { api } from '../lib/client-api.mjs';

// Follow a maker from their profile. Flips straight away, then settles on what the server says;
// if the server says no, it flips back and says why. Signed out, it asks you to sign in.
export default function FollowButton({ username, following, followers, signedIn, onSignIn }) {
  const [state, setState] = useState({ following: !!following, followers: followers || 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function toggle() {
    if (!signedIn) return onSignIn?.();
    if (busy) return;
    const before = state;
    const next = !before.following;
    setBusy(true);
    setError('');
    setState({ following: next, followers: Math.max(0, before.followers + (next ? 1 : -1)) });
    try {
      const result = await api('follow', { username, follow: next });
      setState({ following: !!result.following, followers: result.followers || 0 });
    } catch (e) {
      setState(before);
      setError(e.message || 'That didn’t work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="follow">
      <button
        type="button"
        className={`button follow-button${state.following ? ' is-following' : ''}`}
        aria-pressed={signedIn ? state.following : undefined}
        aria-busy={busy || undefined}
        onClick={toggle}
      >
        {state.following ? 'Following' : 'Follow'}
      </button>
      <span className="follow-count">
        {state.followers} {state.followers === 1 ? 'follower' : 'followers'}
      </span>
      {error && (
        <p className="follow-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
