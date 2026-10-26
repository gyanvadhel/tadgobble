'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Plus, Settings, Check, LoaderCircle, Trash2 } from 'lucide-react';
import { Brand } from './art';
import { Gobble } from './gobble';
import { Avatar } from './blob-avatar';
import BlobPicker from './blob-picker';
import StarterPreferences from './starter-preferences';
import { defaultBlob } from '../lib/blob-options.mjs';
import { Modal, AuthModal } from './platform';
import SubmitWizard from './submit-wizard';
import { useProductCover } from './cover-editor';
import { ShareButton } from './creator-credit';
import { VideoBadge } from './work-media';
import { api, cloudMode } from '../lib/client-api.mjs';
import { workImageAlt } from '../lib/product-options.mjs';
import {
  calm,
  gsap,
  jelly,
  LivingGobble,
  rememberFlight,
  ScrollTrigger,
  Squiggle,
  useGSAP,
} from './motion';
import '../app/creators.css';

const statusNames = {
  pending: 'In review',
  needs_changes: 'Needs changes',
  published: 'Published',
  rejected: 'Not selected',
  archived: 'Archived',
};
function GalleryWork({ product, index }) {
  const [failed, setFailed] = useState(false);
  const hasImage = product.cover?.url && !failed;
  return (
    <a
      className={`creator-work${hasImage ? '' : ' creator-work-placeholder'}`}
      href={`/product/${product.slug}`}
      onClick={(e) => rememberFlight(e, product.slug)}
      aria-label={`Open ${product.name} — ${product.cover?.video ? 'video, ' : ''}${product.category}`}
    >
      <div className="creator-work-image">
        <VideoBadge video={product.cover?.video} />
        {hasImage ? (
          <img
            src={product.cover.url}
            alt={workImageAlt(product)}
            loading={index < 12 ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setFailed(true)}
          />
        ) : (
          <Gobble />
        )}
      </div>
      <div className="creator-work-caption" aria-hidden="true">
        <div>
          <h3>{product.name}</h3>
          <p>{product.category}</p>
        </div>
        <ArrowUpRight size={19} />
      </div>
    </a>
  );
}

// The profile gallery: works rise in as they scroll into view. Pictures load
// lazily and change the column heights, so the scroll positions are re-measured.
function CreatorGallery({ products }) {
  const ref = useRef(null);
  useEffect(() => {
    const refresh = gsap.delayedCall(0.2, () => ScrollTrigger.refresh()).pause();
    const observer = new ResizeObserver(() => refresh.restart(true));
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      refresh.kill();
    };
  }, []);
  useGSAP(
    () => {
      if (calm()) return;
      const works = [...ref.current.children];
      gsap.set(works, { opacity: 0, y: 40 });
      ScrollTrigger.batch(works, {
        start: 'top 96%',
        once: true,
        onEnter: (batch) =>
          gsap.to(batch, {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: 'power3.out',
            stagger: 0.07,
            clearProps: 'opacity,transform',
          }),
      });
    },
    { scope: ref, dependencies: [products.map((p) => p.id).join()] },
  );
  return (
    <section
      ref={ref}
      className={`creator-gallery${products.length < 3 ? ` creator-gallery-${products.length}` : ''}`}
      aria-label="Published work gallery"
    >
      {products.map((p, index) => (
        <GalleryWork product={p} index={index} key={`${p.id}-${p.cover?.url || ''}`} />
      ))}
    </section>
  );
}

export default function CreatorPage({ mode = 'profile', username: providedUsername }) {
  const [user, setUser] = useState(null),
    [data, setData] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [auth, setAuth] = useState(false),
    [editing, setEditing] = useState(null),
    [removing, setRemoving] = useState(null),
    [workError, setWorkError] = useState(''),
    [filter, setFilter] = useState('all'),
    pendingDelete = useRef(null),
    intro = useRef(null);
  // Deleting hides the post at once and only goes through after a few seconds, so a
  // slip of the finger can be undone.
  function deleteWork(p) {
    finishDelete();
    setWorkError('');
    setRemoving(p);
    pendingDelete.current = { p, timer: setTimeout(finishDelete, 6000) };
  }
  function undoDelete() {
    clearTimeout(pendingDelete.current?.timer);
    pendingDelete.current = null;
    setRemoving(null);
  }
  async function finishDelete() {
    const pending = pendingDelete.current;
    if (!pending) return;
    pendingDelete.current = null;
    clearTimeout(pending.timer);
    setRemoving((current) => (current?.id === pending.p.id ? null : current));
    try {
      await api('works/delete', { id: pending.p.id });
      setData((old) => ({ ...old, products: old.products.filter((w) => w.id !== pending.p.id) }));
    } catch (e) {
      setWorkError(`“${pending.p.name}” wasn’t deleted: ${e.message}`);
    }
  }
  useEffect(() => {
    window.addEventListener('pagehide', finishDelete);
    return () => {
      window.removeEventListener('pagehide', finishDelete);
      finishDelete();
    };
  }, []);
  const refresh = useCallback(async () => {
    setError('');
    try {
      const boot = await api('bootstrap');
      setUser(boot.user);
      if (mode === 'profile') {
        const username =
          providedUsername || decodeURIComponent(location.pathname.split('/')[2] || '');
        if (!username) throw new Error('This profile is unavailable.');
        const result = await api('profiles/' + encodeURIComponent(username));
        setData(result);
        document.title = `${result.profile.name} (@${result.profile.username}) — tadgobble`;
      } else if (boot.user) {
        setData(mode === 'work' ? await api('my-work') : { profile: boot.user.profile });
        document.title = `${mode === 'work' ? 'My work' : 'Account settings'} — tadgobble`;
      } else setData(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [mode, providedUsername]);
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    if (mode !== 'work') return;
    const focus = () => refresh();
    window.addEventListener('focus', focus);
    return () => window.removeEventListener('focus', focus);
  }, [mode, refresh]);
  const profile = data?.profile;
  // The profile opens with the avatar popping up and the words following it in.
  // A hover or tap on the avatar sets it wobbling.
  useGSAP(
    (_, contextSafe) => {
      if (!intro.current || calm()) return;
      const avatar = intro.current.querySelector('.creator-avatar');
      gsap
        .timeline()
        .from(avatar, { scale: 0, rotation: -25, duration: 0.5, ease: 'back.out(1.8)' })
        .from(
          '.creator-bio > *, .creator-intro-actions',
          { opacity: 0, y: 20, duration: 0.4, ease: 'power3.out', stagger: 0.06 },
          '-=0.3',
        );
      const wobble = contextSafe(() => jelly(avatar, 0, 10));
      avatar.addEventListener('pointerenter', wobble);
      avatar.addEventListener('pointerdown', wobble);
      return () => {
        avatar.removeEventListener('pointerenter', wobble);
        avatar.removeEventListener('pointerdown', wobble);
      };
    },
    { scope: intro, dependencies: [profile?.username, mode] },
  );
  return (
    <div className="creator-app">
      <header className="creator-header">
        <Brand />
        <nav aria-label="Creator navigation">
          <a href="/discover">Discover</a>
          <a href="/my-work" aria-current={mode === 'work' ? 'page' : undefined}>
            My work
          </a>
          {user ? (
            <a href="/settings" aria-label="Account settings">
              <Settings size={20} />
            </a>
          ) : (
            <button className="button" onClick={() => setAuth(true)}>
              Sign in
            </button>
          )}
        </nav>
      </header>
      <main className="creator-main">
        {loading ? (
          <p className="loading">
            <LoaderCircle className="spin" /> Opening your corner…
          </p>
        ) : error ? (
          <div className="creator-empty">
            <Gobble />
            <h1>Couldn’t open this corner.</h1>
            <p role="alert">{error}</p>
            <button className="button" onClick={refresh}>
              Try again
            </button>
            <a href="/discover">Explore discoveries</a>
          </div>
        ) : !user && mode !== 'profile' ? (
          <div className="creator-empty">
            <Gobble />
            <h1>Your work. Your little corner.</h1>
            <p>Sign in to manage your profile and see how your submissions are doing.</p>
            <button className="button button-dark" onClick={() => setAuth(true)}>
              Sign in to continue
            </button>
          </div>
        ) : mode === 'settings' ? (
          <ProfileSettings key={user.id} user={user} onSaved={refresh} />
        ) : mode === 'profile' ? (
          <>
            <section ref={intro} className={`creator-intro theme-${profile.color}`}>
              <Avatar profile={profile} />
              <div className="creator-bio">
                <p className="creator-handle">@{profile.username}</p>
                <h1>{profile.name}</h1>
                {profile.specialty && <p className="creator-specialty">{profile.specialty}</p>}
                {profile.bio && <p className="creator-story">{profile.bio}</p>}
                <div className="creator-links">
                  {profile.instagram && (
                    <a
                      href={`https://www.instagram.com/${encodeURIComponent(profile.instagram)}/`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Instagram <ArrowUpRight size={15} />
                    </a>
                  )}
                  {profile.website && (
                    <a href={profile.website} target="_blank" rel="noreferrer">
                      Website <ArrowUpRight size={15} />
                    </a>
                  )}
                </div>
              </div>
              <div className="creator-intro-actions">
                <ShareButton
                  path={`/profile/${profile.username}`}
                  title={`${profile.name} on Tadgobble`}
                  label="Share profile"
                />
                {user?.profile?.username === profile.username && (
                  <a href="/settings">Edit profile</a>
                )}
              </div>
            </section>
            <div className="creator-section-title">
              <div>
                <h2>Things I’ve made.</h2>
                <Squiggle />
              </div>
              <span>
                {data.products.length} published {data.products.length === 1 ? 'work' : 'works'}
              </span>
            </div>
            {data.products.length ? (
              <CreatorGallery products={data.products} />
            ) : (
              <div className="creator-empty">
                <LivingGobble />
                <h2>Making room for something good.</h2>
                <p>Published work will appear here.</p>
                {user?.profile?.username === profile.username && (
                  <a className="button button-dark" href="/discover?submit=1">
                    Share your first work
                  </a>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <section className="creator-page-heading">
              <div>
                <p className="creator-handle">Your private workspace</p>
                <h1>My work.</h1>
                <p>From “should I post this?” to out in the world.</p>
              </div>
              <a className="button button-dark" href="/discover?submit=1">
                <Plus size={17} />
                Share something
              </a>
            </section>
            <div className="work-toolbar">
              <div className="work-filters" role="group" aria-label="Submission status">
                {['all', 'pending', 'needs_changes', 'published', 'rejected'].map((s) => (
                  <button key={s} aria-pressed={filter === s} onClick={() => setFilter(s)}>
                    {s === 'all' ? 'Everything' : statusNames[s]}
                  </button>
                ))}
              </div>
              <button className="text-button" onClick={refresh}>
                Refresh status
              </button>
            </div>
            {workError && (
              <p className="share-error" role="alert">
                {workError}
              </p>
            )}
            {removing && (
              <div className="undo-bar" role="status">
                Deleted “{removing.name}”.
                <button className="text-button" onClick={undoDelete}>
                  Undo
                </button>
              </div>
            )}
            {data?.products.filter(
              (p) => p.id !== removing?.id && (filter === 'all' || filter === p.status),
            ).length ? (
              <div className="my-work-list">
                {data.products
                  .filter((p) => p.id !== removing?.id && (filter === 'all' || filter === p.status))
                  .map((p) => (
                    <article className="my-work-item" key={p.id}>
                      <div className="my-work-image">
                        <VideoBadge video={p.cover?.video} />
                        {p.cover?.url ? (
                          <img src={p.cover.url} alt={workImageAlt(p)} />
                        ) : (
                          <Gobble />
                        )}
                      </div>
                      <div className="my-work-copy">
                        <span className={`work-status status-${p.status}`}>
                          {statusNames[p.status] || p.status}
                        </span>
                        <h2>{p.name}</h2>
                        <p>
                          {p.category} · Submitted {new Date(p.created_at).toLocaleDateString()}
                        </p>
                        {p.submission.onBehalf && <p>Credited to {p.owner_name}</p>}
                        {p.review_note && (
                          <div className="review-feedback">
                            <strong>A note from the review</strong>
                            <p>{p.review_note}</p>
                          </div>
                        )}
                        {p.pendingEdit ? (
                          <p>Your edits are in review. The current version stays live meanwhile.</p>
                        ) : (
                          p.status === 'pending' && (
                            <p>We’ll take a human look. Check back here for the result.</p>
                          )
                        )}
                        <div className="my-work-actions">
                          <button className="button" onClick={() => setEditing(p)}>
                            Edit{' '}
                            {p.status === 'needs_changes' || p.status === 'rejected'
                              ? '& resubmit'
                              : 'work'}
                          </button>
                          {p.status === 'published' && (
                            <>
                              <a className="button" href={`/product/${p.slug}`}>
                                View live
                              </a>
                              <ShareButton path={`/product/${p.slug}`} title={p.name} />
                            </>
                          )}
                          <button className="button button-danger" onClick={() => deleteWork(p)}>
                            <Trash2 size={15} /> Delete
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
              </div>
            ) : (
              <div className="creator-empty">
                <Gobble />
                <h2>
                  {data?.products.length ? 'Nothing in this pile.' : 'Your first work goes here.'}
                </h2>
                <p>
                  {data?.products.length
                    ? 'Try another status to find your work.'
                    : 'A photo and a title are enough to get started.'}
                </p>
                {!data?.products.length && (
                  <a href="/discover?submit=1" className="button button-dark">
                    Share your work
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </main>
      <footer className="creator-footer">
        <a href="/">tadgobble.</a>
        <span>Good things. Real people.</span>
        <a href="/privacy">Privacy</a>
      </footer>
      {auth && (
        <AuthModal
          onClose={() => setAuth(false)}
          onDone={async () => {
            setAuth(false);
            await refresh();
          }}
        />
      )}
      {editing && (
        <Modal
          wide
          className="submission-modal"
          onClose={() => {
            setEditing(null);
            refresh();
          }}
        >
          <SubmitWizard
            key={editing.id}
            product={editing}
            creator={user?.profile}
            onDone={() => {
              setEditing(null);
              refresh();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function ProfileSettings({ user, onSaved }) {
  const [data, setData] = useState(user.profile),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const avatar = useProductCover(user.profile?.avatar);
  const [avatarMode, setAvatarMode] = useState(user.profile?.avatar ? 'photo' : 'blob');
  const [preferences, setPreferences] = useState({
    intent: user.onboarding?.intent || 'explore',
    interests: user.onboarding?.interests || [],
  });
  const update = (key, value) => {
    setData((old) => ({ ...old, [key]: value }));
    setMessage('');
  };
  return (
    <>
      <section className="creator-page-heading">
        <div>
          <p className="creator-handle">Make yourself at home</p>
          <h1>Your corner.</h1>
          <p>Your profile, your credit, your kind of weird.</p>
        </div>
        {data.visible && (
          <a className="button" href={`/profile/${user.profile.username}`}>
            View my profile <ArrowUpRight size={16} />
          </a>
        )}
      </section>
      <form
        className="profile-settings"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          setMessage('');
          try {
            const result = await api('profile/save', {
              ...data,
              avatarId: avatarMode === 'photo' ? avatar.cover?.id || null : null,
              preferences,
            });
            setData(result.profile);
            await onSaved();
            setMessage('Profile saved. Looking good.');
          } catch (e) {
            setError(e.message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <aside className={`profile-photo-panel theme-${data.color}`}>
          <BlobPicker
            value={data.blob || defaultBlob}
            onChange={(blob) => update('blob', blob)}
            photo={avatar}
            mode={avatarMode}
            onModeChange={setAvatarMode}
            disabled={busy || avatar.busy}
          />
          <fieldset className="profile-colors">
            <legend>Your profile colour</legend>
            {['lavender', 'butter', 'pond', 'peach'].map((color) => (
              <label key={color} className={`theme-${color}`}>
                <input
                  type="radio"
                  name="profile-color"
                  value={color}
                  checked={data.color === color}
                  onChange={() => update('color', color)}
                />
                <span>{color}</span>
                {data.color === color && <Check size={16} />}
              </label>
            ))}
          </fieldset>
        </aside>
        <div className="profile-fields">
          <label>
            Display name
            <input
              name="displayName"
              value={data.name}
              required
              maxLength={60}
              onChange={(e) => update('name', e.target.value)}
            />
            <small>This is how you’re credited on your own work.</small>
          </label>
          <label>
            Username
            <input
              name="username"
              value={data.username}
              required
              minLength={3}
              maxLength={40}
              autoCapitalize="none"
              spellCheck={false}
              pattern="[a-zA-Z][a-zA-Z0-9_]{2,39}"
              onChange={(e) => update('username', e.target.value.toLowerCase())}
            />
            <small>
              tadgobble.web.app/profile/{data.username || 'you'}. Changing it changes your profile
              link.
            </small>
          </label>
          <label>
            What you make <span>optional</span>
            <input
              name="specialty"
              value={data.specialty}
              maxLength={80}
              placeholder="Illustrations, little apps, occasional chaos"
              onChange={(e) => update('specialty', e.target.value)}
            />
          </label>
          <label>
            A little about you <span>optional</span>
            <textarea
              name="bio"
              value={data.bio}
              maxLength={300}
              rows={4}
              placeholder="Tell people about the person behind the work."
              onChange={(e) => update('bio', e.target.value)}
            />
            <small>{data.bio.length}/300</small>
          </label>
          <div className="profile-link-fields">
            <label>
              Instagram <span>optional</span>
              <input
                name="instagram"
                value={data.instagram}
                maxLength={31}
                placeholder="@yourname"
                autoCapitalize="none"
                onChange={(e) => update('instagram', e.target.value)}
              />
            </label>
            <label>
              Website <span>optional</span>
              <input
                name="website"
                type="url"
                value={data.website}
                placeholder="https://"
                maxLength={2000}
                onChange={(e) => update('website', e.target.value)}
              />
            </label>
          </div>
          <label className="profile-visibility">
            <input
              type="checkbox"
              checked={data.visible}
              onChange={(e) => update('visible', e.target.checked)}
            />
            <span>
              Show my public profile
              <small>
                Visitors can explore your published work. Your email, saved items and review notes
                stay private. Hiding your profile keeps approved work in discoveries.
              </small>
            </span>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="profile-saved" role="status">
              <Check size={17} />
              {message}
            </p>
          )}
          <details className="profile-interests">
            <summary>Your interests & introduction</summary>
            <StarterPreferences value={preferences} onChange={setPreferences} disabled={busy} />
          </details>
          <button className="button button-dark" disabled={busy || avatar.busy}>
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>
      <section className="account-settings">
        <h2>Account</h2>
        <p>
          Signed in as <strong>{user.email}</strong>. Your email is private.
        </p>
        {cloudMode && (
          <p>
            New accounts use Google sign-in. Manage your Google password in your Google account.
          </p>
        )}
        <div className="my-work-actions">
          <a className="button" href="/welcome?next=%2Fsettings">
            Redo my introduction
          </a>
          <a className="button" href="/my-work">
            My work
          </a>
          {user.role === 'admin' && (
            <a className="button" href="/studio">
              Open studio
            </a>
          )}
          <button
            className="button"
            onClick={async () => {
              await api('auth/logout', {});
              location.assign('/');
            }}
          >
            Sign out
          </button>
        </div>
        {user.role !== 'admin' && (
          <details className="account-danger">
            <summary>Delete account</summary>
            <p>
              This removes your account, profile, saved items and comments. Published listings
              remain without an account link. To take work down, delete it from{' '}
              <a href="/my-work">My work</a> first.
            </p>
            <button
              className="button button-danger"
              onClick={async () => {
                if (!confirm('Permanently delete your account, profile, saved items and comments?'))
                  return;
                try {
                  await api('account/delete', {});
                  location.assign('/');
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              Delete my account
            </button>
          </details>
        )}
      </section>
    </>
  );
}
