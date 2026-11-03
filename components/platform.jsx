'use client';
import { setupDestination } from '../lib/blob-options.mjs';
import { Avatar } from './blob-avatar';
import { useState, useEffect, useCallback, useId, useRef, cloneElement } from 'react';
import {
  Search,
  ArrowUpRight,
  ArrowRight,
  Bookmark,
  Plus,
  X,
  SlidersHorizontal,
  ChevronDown,
  Check,
  LoaderCircle,
  MessageCircle,
  ExternalLink,
  LogOut,
  ArrowLeft,
  Send,
  Asterisk,
  Compass,
  Sparkles,
  Reply,
  Clock,
  Shapes,
} from 'lucide-react';
import { Dropdown } from './dropdown';
import { Brand } from './art';
import { ProductDemo, productSceneColor } from './product-showcase';
import { paletteStyle } from '../lib/design-tokens.mjs';
import { categories, audiences, isArtwork, workImageAlt } from '../lib/product-options.mjs';
import { ShowcaseGrid, FeaturedWork, MakersStrip } from './showcase';
import {
  CountBump,
  LivingGobble,
  Poster,
  SpinOnScroll,
  Squiggle,
  saveBurst,
  squish,
  useLanding,
  useMagnetic,
  useScramblePlaceholder,
} from './motion';
import SubmitWizard from './submit-wizard';
import { CreatorCredit, ShareButton } from './creator-credit';
import '../app/creators.css';
import '../app/launch.css';
import '../app/catalog.css';
import Studio from './studio';
import { brand } from '../lib/brand.mjs';
import { api, cloudMode } from '../lib/client-api.mjs';
export { api } from '../lib/client-api.mjs';

function Field({ label, children, hint }) {
  const fieldId = useId();
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      {cloneElement(children, {
        id: fieldId,
        'aria-describedby': hint ? `${fieldId}-hint` : undefined,
      })}
      {hint && <small id={`${fieldId}-hint`}>{hint}</small>}
    </div>
  );
}
export { Field };

const searchExamples = [
  'Find your next thing…',
  'Find a font…',
  'Find a tiny app…',
  'Find a painting…',
  'Find a zine…',
  'Find a clever tool…',
];

export default function Platform({ initialView = 'discover', initialSlug = null }) {
  const shareMagnet = useMagnetic(),
    bannerMagnet = useMagnetic(),
    searchBox = useScramblePlaceholder(searchExamples);
  const [products, setProducts] = useState([]),
    [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [view, setView] = useState(initialView);
  const [category, setCategory] = useState('All discoveries'),
    [workKind, setWorkKind] = useState('all'),
    [audience, setAudience] = useState('Everyone'),
    [search, setSearch] = useState(''),
    [sort, setSort] = useState('newest'),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(''),
    [error, setError] = useState('');
  const [detail, setDetail] = useState(null),
    [comments, setComments] = useState([]),
    [source, setSource] = useState('direct');
  const [afterAuth, setAfterAuth] = useState(null);
  const notify = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(''), 4500);
  }, []);
  const refresh = useCallback(async () => {
    const data = await api('bootstrap');
    setProducts(data.products);
    setUser(data.user);
    return data;
  }, []);
  const refreshDetail = useCallback(async () => {
    if (initialSlug) {
      const data = await api('products/' + initialSlug);
      setDetail(data.product);
      setComments(data.comments);
    }
  }, [initialSlug]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    Promise.all([refresh(), refreshDetail()])
      .then(([data]) => {
        if (params.get('submit') === '1') {
          if (data.user) setModal('submit');
          else {
            setAfterAuth('submit');
            setModal('auth');
          }
        } else if (!data.user && (params.get('signin') === '1' || params.get('saved') === '1'))
          setModal('auth');
        else if (params.get('privacy') === '1') location.replace('/privacy');
        else if (params.get('sponsor') === '1') setModal('sponsor');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    let src = params.get('utm_source') || 'direct';
    try {
      src = params.get('utm_source') || sessionStorage.getItem('ap_source') || 'direct';
      sessionStorage.setItem('ap_source', src);
    } catch {}
    setSource(src);
    if (audiences.includes(params.get('audience'))) setAudience(params.get('audience'));
    if (params.get('saved') === '1') setView('saved');
    api('events', { kind: 'visit', source: src, campaign: params.get('utm_campaign') || '' }).catch(
      () => {},
    );
  }, [refresh, refreshDetail]);
  useEffect(() => {
    if (detail) api('events', { kind: 'detail', productId: detail.id, source }).catch(() => {});
  }, [detail?.id, source]);
  async function save(p) {
    if (!user) {
      setModal('auth');
      return;
    }
    try {
      await api('save', { productId: p.id });
      await refresh();
      await refreshDetail();
      return true;
    } catch (e) {
      notify(e.message);
    }
  }
  function actionModal(type) {
    if (type === 'submit' && !user) {
      setAfterAuth('submit');
      setModal('auth');
    } else setModal(type);
  }
  async function signout() {
    await api('auth/logout', {});
    await refresh();
    setView('discover');
    notify('Signed out.');
  }
  const filtered = products.filter(
    (p) =>
      (view !== 'saved' || p.saved) &&
      (category === 'All discoveries' || p.category === category) &&
      (workKind === 'all' || isArtwork(p) === (workKind === 'art')) &&
      (audience === 'Everyone' || p.audience === 'Everyone' || p.audience === audience) &&
      `${p.name} ${p.tagline} ${p.category} ${p.owner_name || ''}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const sorters = {
    newest: (a, b) => (a.created_at < b.created_at ? 1 : -1),
    saved: (a, b) => b.save_count - a.save_count || sorters.newest(a, b),
    talked: (a, b) => b.comment_count - a.comment_count || sorters.newest(a, b),
  };
  // The front of the showcase: a piece the team featured, else the newest artwork.
  const browsing =
    view === 'discover' &&
    category === 'All discoveries' &&
    workKind === 'all' &&
    audience === 'Everyone' &&
    !search;
  const spotlight = browsing
    ? products.find((p) => p.featured && p.cover) ||
      products.filter((p) => p.cover && isArtwork(p)).sort(sorters.newest)[0]
    : null;
  const gridProducts = filtered.filter((p) => p !== spotlight).sort(sorters[sort]);
  if (view === 'studio')
    return (
      <>
        <Studio
          user={user}
          loading={loading}
          onLogin={() => setModal('auth')}
          notify={notify}
          onLogout={signout}
        />
        {modal === 'auth' && (
          <AuthModal
            onClose={() => setModal(null)}
            onDone={async () => {
              await refresh();
              setModal(null);
            }}
          />
        )}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}
      </>
    );
  return (
    <div className="catalog-app" style={paletteStyle}>
      <header className="site-header">
        <div className="header-inner">
          <Brand />
          <nav aria-label="Main navigation">
            <button
              className={view === 'discover' && !initialSlug ? 'active' : ''}
              onClick={() => {
                if (initialSlug) location.href = '/discover';
                else setView('discover');
              }}
            >
              Discover
            </button>
            <button
              className={view === 'saved' ? 'active' : ''}
              onClick={() => {
                if (!user) setModal('auth');
                else {
                  setView('saved');
                  if (initialSlug) location.href = '/discover?saved=1';
                }
              }}
            >
              Saved
              {user && (
                <CountBump className="nav-count" value={products.filter((p) => p.saved).length} />
              )}
            </button>
            <button className="mobile-share-work" onClick={() => actionModal('submit')}>
              <Plus size={15} /> Share your work
            </button>
          </nav>
          <div className="header-actions">
            <button
              ref={shareMagnet}
              className="button button-dark submit-nav"
              onClick={() => actionModal('submit')}
            >
              <Plus size={16} /> Share your work
            </button>
            {user ? (
              <button
                className="avatar"
                aria-label="Open account"
                title={user.name}
                onClick={() => setModal('account')}
              >
                <Avatar profile={user.profile || { name: user.name }} size={40} />
              </button>
            ) : (
              <button className="button button-plain" onClick={() => setModal('auth')}>
                Sign in <ArrowUpRight size={15} />
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="page-shell">
        {initialSlug ? (
          <>
            <a href="/discover" className="back-link">
              <ArrowLeft size={16} /> Back to discoveries
            </a>
            {error ? (
              <div className="empty-state">{error}</div>
            ) : !detail ? (
              <div className="loading">
                <LoaderCircle className="spin" /> Opening this discovery…
              </div>
            ) : (
              <ProductDetail
                product={detail}
                comments={comments}
                user={user}
                onSave={() => save(detail)}
                onLogin={() => setModal('auth')}
                onRefresh={refreshDetail}
                notify={notify}
                source={source}
              />
            )}
          </>
        ) : (
          <>
            {view === 'discover' ? (
              <Poster />
            ) : (
              <section className="collection-hero">
                <div className="eyebrow">
                  {view === 'saved' ? 'YOUR LITTLE CORNER' : 'FROM THE FEED TO YOUR FAVOURITES'}
                </div>
                <h1>
                  {view === 'saved' ? (
                    <>
                      Your very
                      <br />
                      <em>good stash.</em>
                    </>
                  ) : (
                    <>
                      Saw it. Loved it.
                      <br />
                      <em>Find it here.</em>
                    </>
                  )}
                </h1>
                <p>
                  {view === 'saved'
                    ? 'All the discoveries you wanted to come back to.'
                    : 'The collection behind our product discoveries. Explore the tools and meet their makers.'}
                </p>
              </section>
            )}
            {spotlight && !loading && <FeaturedWork product={spotlight} onSave={save} />}
            <section id="discoveries" className="discovery-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">A FEW TABS WORTH OPENING</span>
                  <h2>
                    {view === 'saved' ? 'Your saved discoveries' : 'Fresh out of the internet.'}
                  </h2>
                  <Squiggle />
                </div>
                <span className="collection-note">
                  <span className="small-dot" /> A growing collection
                </span>
              </div>
              {products.length > 0 && (
                <div className="discovery-controls">
                  <div className="category-tabs" role="group" aria-label="What to discover">
                    {[
                      ['all', 'Everything'],
                      ['art', 'Art & design'],
                      ['app', 'Apps & tools'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        className={workKind === value ? 'selected' : ''}
                        aria-pressed={workKind === value}
                        onClick={() => {
                          setWorkKind(value);
                          setCategory('All discoveries');
                        }}
                      >
                        {label}
                      </button>
                    ))}
                    <Dropdown
                      className="catalog-more-categories"
                      label="Filter by category"
                      icon={Shapes}
                      value={category}
                      options={['All discoveries', ...categories]}
                      onChange={setCategory}
                    />
                  </div>
                  <div className="search-controls">
                    <label className="search-input">
                      <Search size={17} />
                      <input
                        ref={searchBox}
                        aria-label="Search discoveries"
                        placeholder="Find your next thing…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      {search && (
                        <button aria-label="Clear search" onClick={() => setSearch('')}>
                          <X size={14} />
                        </button>
                      )}
                    </label>
                    <Dropdown
                      className="sort-select"
                      label="Sort discoveries"
                      value={sort}
                      options={[
                        ['newest', 'Newest', Clock],
                        ['saved', 'Most saved', Bookmark],
                        ['talked', 'Most talked about', MessageCircle],
                      ]}
                      onChange={setSort}
                    />
                    <Dropdown
                      className="audience-select"
                      label="Filter by audience"
                      icon={SlidersHorizontal}
                      value={audience}
                      options={audiences}
                      onChange={setAudience}
                    />
                  </div>
                </div>
              )}
              {loading ? (
                <div className="loading">
                  <LoaderCircle className="spin" /> Finding the good stuff…
                </div>
              ) : error ? (
                <div className="empty-state">
                  {error}
                  <button className="button" onClick={() => location.reload()}>
                    Try again
                  </button>
                </div>
              ) : products.length === 0 && view !== 'saved' ? (
                <div className="catalog-first-find">
                  <LivingGobble />
                  <h3>The first bite is still cooking.</h3>
                  <p>
                    No discoveries yet. Share something you made and we’ll give it a proper look.
                  </p>
                  <button className="button button-dark" onClick={() => actionModal('submit')}>
                    Be the first find <Plus size={16} />
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="empty-state">
                  <Bookmark size={30} />
                  <h3>
                    {view === 'saved' ? 'Make room for your favourites.' : 'Nothing here just yet.'}
                  </h3>
                  <p>
                    {view === 'saved'
                      ? 'Tap the bookmark on any discovery to save it here.'
                      : 'Try another category or a different search.'}
                  </p>
                  <button
                    className="button button-dark"
                    onClick={() => {
                      setView('discover');
                      setCategory('All discoveries');
                      setWorkKind('all');
                      setAudience('Everyone');
                      setSearch('');
                    }}
                  >
                    Explore the collection <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                <ShowcaseGrid products={gridProducts} onSave={save} />
              )}
            </section>
            {view === 'discover' && !loading && <MakersStrip products={products} />}
            <section className="maker-banner">
              <SpinOnScroll className="maker-banner-icon">
                <Asterisk size={54} />
              </SpinOnScroll>
              <div>
                <span className="eyebrow">YOU MADE IT. LET PEOPLE FIND IT.</span>
                <h2>There’s a place for your thing here.</h2>
                <p>A photo and a title are enough. Give something you made a place to be seen.</p>
              </div>
              <button
                ref={bannerMagnet}
                className="button button-dark"
                onClick={() => actionModal('submit')}
              >
                Share your work <ArrowUpRight size={17} />
              </button>
            </section>
            <div className="editorial-note">
              <Sparkles size={16} />
              <p>
                Work belongs to its creators. We review submissions before publishing. Paid features
                are clearly labelled.
              </p>
            </div>
          </>
        )}
      </main>
      <footer className="footer">
        <Brand />
        <p>{brand.tagline}</p>
        <div>
          <button onClick={() => setModal('sponsor')}>Partner with us</button>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/studio">
            Studio <ArrowUpRight size={12} />
          </a>
        </div>
        <span>
          © {new Date().getFullYear()} {brand.name}
        </span>
      </footer>
      {modal && (
        <Modal
          onClose={() => setModal(null)}
          wide={modal === 'submit'}
          className={modal === 'submit' ? 'submission-modal' : ''}
        >
          {modal === 'auth' ? (
            <AuthForm
              afterAuth={afterAuth}
              onDone={async () => {
                await refresh();
                setModal(afterAuth);
                setAfterAuth(null);
                notify('You’re in. Excellent taste, by the way.');
              }}
            />
          ) : modal === 'submit' ? (
            <SubmitWizard
              creator={user?.profile}
              onDone={() => {
                setModal(null);
                notify('Your work is in the review queue. Thanks for sharing it.');
              }}
            />
          ) : modal === 'sponsor' ? (
            <SponsorForm
              onDone={() => {
                setModal(null);
                notify('Your partnership inquiry was saved for the studio owner.');
              }}
            />
          ) : modal === 'account' ? (
            <div className="account-panel">
              <span className="eyebrow">YOUR CORNER</span>
              <h2>Hello, {user?.name}.</h2>
              <Avatar profile={user?.profile || { name: user?.name }} size={84} />
              <p>{user?.email}</p>
              <div className="account-shortcuts">
                <a className="button button-dark" href="/my-work">
                  My work
                </a>
                {user?.profile?.visible && (
                  <a className="button" href={`/profile/${user.profile.username}`}>
                    View my profile
                  </a>
                )}
                <a className="button" href="/settings">
                  Profile & account settings
                </a>
              </div>
              {user?.role === 'admin' && (
                <a className="button button-dark" href="/studio">
                  Open content studio <ArrowUpRight size={16} />
                </a>
              )}
              <button
                className="button"
                onClick={async () => {
                  await signout();
                  setModal(null);
                }}
              >
                Sign out <LogOut size={16} />
              </button>
            </div>
          ) : null}
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
function ArrowDownIcon() {
  return <span className="arrow-circle">↓</span>;
}
export function Modal({ children, onClose, wide = false, className = '' }) {
  const dialog = useRef(null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const old = document.body.style.overflow;
    const previouslyFocused = document.activeElement;
    document.body.style.overflow = 'hidden';
    dialog.current?.querySelector('input,textarea,select,button')?.focus();
    const key = (e) => {
      if (e.key === 'Escape') close.current();
      if (e.key === 'Tab') {
        const items = [
          ...dialog.current.querySelectorAll(
            'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),summary',
          ),
        ].filter((el) => el.offsetParent !== null);
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener('keydown', key);
      previouslyFocused?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        className={`modal ${wide ? 'modal-wide' : ''} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${brand.name} dialog`}
      >
        <button className="modal-close" aria-label="Close dialog" onClick={onClose}>
          <X size={20} />
        </button>
        {children}
      </section>
    </div>
  );
}
export function AuthModal({ onClose, onDone }) {
  return (
    <Modal onClose={onClose}>
      <AuthForm onDone={onDone} />
    </Modal>
  );
}
function AuthForm({ onDone, afterAuth }) {
  const [register, setRegister] = useState(false),
    [resetting, setResetting] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [embedded, setEmbedded] = useState(false),
    [returnLink, setReturnLink] = useState('');
  useEffect(() => {
    setEmbedded(/Instagram|FBAN|FBAV|\bwv\b/i.test(navigator.userAgent));
    setReturnLink(
      location.origin +
        (afterAuth === 'submit' ? '/discover?submit=1' : location.pathname + location.search),
    );
  }, [afterAuth]);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          if (resetting) {
            await api('auth/reset', Object.fromEntries(new FormData(e.currentTarget)));
            setMessage(
              'If that email has an account, a reset link is on its way. Open it on this device.',
            );
            setResetting(false);
            return;
          }
          const result = await api(
            register ? 'auth/register' : 'auth/login',
            Object.fromEntries(new FormData(e.currentTarget)),
          );
          if (result.confirmationRequired) {
            setMessage(
              'Check your email for a link to confirm your account. Open it on this device to land straight back here.',
            );
            setRegister(false);
            return;
          }
          if (result.user?.onboarding?.complete === false) {
            location.assign(
              setupDestination(
                afterAuth === 'submit' ? '/discover?submit=1' : location.pathname + location.search,
              ),
            );
            return;
          }
          await onDone();
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="eyebrow">YOUR STASH IS WAITING</span>
      <h2>
        {cloudMode
          ? 'Make yourself at home.'
          : register
            ? 'Come for a little snack.'
            : 'Back for seconds?'}
      </h2>
      <p className="form-intro">
        Save discoveries, join conversations, and share what you’re making.
      </p>
      {cloudMode && (
        <>
          {embedded && (
            <div className="embedded-browser-help">
              <strong>Open this in your browser to sign in.</strong>
              <p>
                In Instagram, use the menu and choose “Open in browser” (Safari or Chrome). Then
                continue with Google here.
              </p>
              <button
                type="button"
                className="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(returnLink);
                    setMessage('Link copied. Paste it in Safari or Chrome.');
                  } catch {
                    setMessage('Select and copy the link below, then open it in your browser.');
                  }
                }}
              >
                Copy this page’s link
              </button>
              <input
                aria-label="Link to open in your browser"
                readOnly
                value={returnLink}
                onFocus={(e) => e.target.select()}
              />
            </div>
          )}
          <button
            className="button button-full auth-google"
            type="button"
            disabled={busy || embedded}
            onClick={async () => {
              setBusy(true);
              setError('');
              try {
                await api('auth/google', { afterAuth });
              } catch (e) {
                setError(e.message);
                setBusy(false);
              }
            }}
          >
            <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.87 46.98 24.55Z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59a14.41 14.41 0 0 1 0-9.18l-7.98-6.19A23.86 23.86 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
              />
            </svg>
            {busy ? 'One sec…' : 'Continue with Google'}
          </button>
          <p className="auth-note">Or use your email below.</p>
        </>
      )}
      <details className="auth-email-options" open={cloudMode ? undefined : true}>
        <summary>Email & password</summary>
        {register && (
          <Field label="Your name">
            <input name="name" required minLength={2} maxLength={60} autoComplete="name" />
          </Field>
        )}
        <Field label="Email">
          <input name="email" type="email" required autoComplete="email" />
        </Field>
        {!resetting && (
          <Field label="Password" hint="At least 12 characters.">
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete={register ? 'new-password' : 'current-password'}
            />
          </Field>
        )}
        {cloudMode && !register && !resetting && (
          <button
            className="form-switch"
            type="button"
            onClick={() => {
              setResetting(true);
              setError('');
              setMessage('');
            }}
          >
            Forgot your password?
          </button>
        )}
        {!cloudMode && error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {!cloudMode && message && <p role="status">{message}</p>}
        <button className="button button-dark button-full" disabled={busy}>
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <>
              {resetting ? 'Send reset link' : register ? 'Create your account' : 'Sign in'}{' '}
              <ArrowRight size={16} />
            </>
          )}
        </button>
        <button
          className="form-switch"
          type="button"
          onClick={() => {
            if (resetting) setResetting(false);
            else setRegister(!register);
            setError('');
          }}
        >
          {resetting
            ? 'Remembered it? Sign in'
            : register
              ? 'Already here? Sign in'
              : 'New here? Create an account'}
        </button>
      </details>
      {cloudMode && error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {cloudMode && message && <p role="status">{message}</p>}
      <p className="auth-policy">
        By continuing, you agree to our{' '}
        <a href="/terms" target="_blank" rel="noreferrer">
          Terms
        </a>{' '}
        and acknowledge our{' '}
        <a href="/privacy" target="_blank" rel="noreferrer">
          Privacy policy
        </a>
        .
      </p>
    </form>
  );
}
function SponsorForm({ onDone }) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await api('sponsor', Object.fromEntries(new FormData(e.currentTarget)));
          onDone();
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="eyebrow">LET’S MAKE A GOOD INTRODUCTION</span>
      <h2>Cook something up with {brand.name}.</h2>
      <p className="form-intro">
        Tell us about your product and the people you want to reach. Paid features are clearly
        labelled. Submitting an inquiry doesn’t reserve a placement.
      </p>
      <Field label="Your name">
        <input name="name" required maxLength={80} />
      </Field>
      <Field label="Work email">
        <input name="email" type="email" required />
      </Field>
      <Field label="Product URL">
        <input name="url" type="url" required />
      </Field>
      <Field label="What do you have in mind?">
        <textarea name="message" minLength={10} maxLength={2000} required rows={4} />
      </Field>
      {error && <p className="form-error">{error}</p>}
      <button className="button button-dark button-full" disabled={busy}>
        {busy ? 'Saving…' : 'Send partnership inquiry'} <ArrowRight size={15} />
      </button>
    </form>
  );
}
function ProductDetail({ product: p, comments, user, onSave, onLogin, onRefresh, notify, source }) {
  const [busy, setBusy] = useState(false),
    [replyTo, setReplyTo] = useState(null);
  const landing = useLanding(p.slug);
  const talking = comments.filter((c) => !c.removed).length;
  const threads = comments.filter((c) => !c.parent_id);
  const repliesTo = (id) =>
    comments
      .filter((c) => c.parent_id === id)
      .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  async function postComment(e, parentId) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    try {
      await api('comment', { productId: p.id, body: new FormData(form).get('body'), parentId });
      form.reset();
      setReplyTo(null);
      await onRefresh();
    } catch (e) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  }
  const renderComment = (c, thread) =>
    c.removed ? (
      <article className="comment comment-removed" key={c.id}>
        <p>This comment was removed.</p>
      </article>
    ) : (
      <article className="comment" key={c.id}>
        <Avatar profile={c.profile || { name: c.name }} size={32} />
        <div>
          <strong>{c.name}</strong>
          <time>{new Date(c.created_at).toLocaleDateString()}</time>
          <p>{c.body}</p>
          <div className="comment-actions">
            <button
              className="text-button"
              onClick={() =>
                user
                  ? setReplyTo({ thread, id: c.id, mention: c.parent_id ? c.name : '' })
                  : onLogin()
              }
            >
              <Reply size={13} /> Reply
            </button>
            {(user?.id === c.user_id || user?.role === 'admin') && (
              <button
                className="text-button"
                onClick={async () => {
                  try {
                    await api('comment/delete', { id: c.id });
                    await onRefresh();
                  } catch (e) {
                    notify(e.message);
                  }
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>
      </article>
    );
  const art = isArtwork(p);
  return (
    <div className="product-detail">
      <div className="detail-main">
        <div
          ref={landing}
          className="catalog-detail-demo"
          style={{ background: productSceneColor(p) }}
        >
          <ProductDemo product={p} />
        </div>
        <div className="detail-title">
          <span className={`product-monogram mono-${p.color}`}>{p.name[0]}</span>
          <div>
            <h1>{p.name}</h1>
            <p>{p.tagline}</p>
          </div>
        </div>
        <div className="detail-tags">
          <span className="soft-tag">{p.category}</span>
          <span className="soft-tag">For {p.audience.toLowerCase()}</span>
          {p.submission?.platforms?.map((platform) => (
            <span className="soft-tag" key={platform}>
              {platform}
            </span>
          ))}
          {p.sponsored && <span className="soft-tag">Paid feature</span>}
        </div>
        {(!art || p.description !== p.category) && (
          <>
            <h2>{art ? 'Behind the work' : 'A little about this discovery'}</h2>
            <p className="detail-description">{p.description}</p>
          </>
        )}
        <ul className="facts-list">
          {p.facts.map((f) => (
            <li key={f}>
              <Check size={16} />
              {f}
            </li>
          ))}
        </ul>
        {p.source && (
          <a className="source-link" href={p.source} target="_blank" rel="noreferrer">
            Read the maker’s information <ExternalLink size={13} />
          </a>
        )}
        {p.submission?.demoUrl && (
          <p>
            <a className="source-link" href={p.submission.demoUrl} target="_blank" rel="noreferrer">
              Watch the maker’s demo <ExternalLink size={13} />
            </a>
          </p>
        )}
        <section className="conversation">
          <h2>
            {talking ? 'The conversation' : 'Start a conversation'} <span>{talking}</span>
          </h2>
          <p>
            Ask a question, share what you tried, or leave something useful for the next person.
          </p>
          {user ? (
            <form onSubmit={(e) => postComment(e)}>
              <textarea
                name="body"
                aria-label="Your comment"
                required
                minLength={2}
                maxLength={1500}
                placeholder="What caught your curiosity?"
                rows={3}
              />
              <button className="button button-dark" disabled={busy}>
                Join the conversation <Send size={14} />
              </button>
            </form>
          ) : (
            <button className="button" onClick={onLogin}>
              Sign in to join the conversation <ArrowRight size={15} />
            </button>
          )}
          {comments.length === 0 ? (
            <div className="quiet-empty">A good conversation can start with you.</div>
          ) : (
            threads.map((t) => (
              <div className="comment-thread" key={t.id}>
                {renderComment(t, t.id)}
                {(repliesTo(t.id).length > 0 || replyTo?.thread === t.id) && (
                  <div className="comment-replies">
                    {repliesTo(t.id).map((r) => renderComment(r, t.id))}
                    {replyTo?.thread === t.id && (
                      <form
                        className="reply-form"
                        key={replyTo.id}
                        onSubmit={(e) => postComment(e, t.id)}
                      >
                        <textarea
                          name="body"
                          aria-label="Your reply"
                          required
                          minLength={2}
                          maxLength={1500}
                          rows={2}
                          autoFocus
                          placeholder="Write a reply…"
                          defaultValue={replyTo.mention ? `@${replyTo.mention} ` : ''}
                        />
                        <div>
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => setReplyTo(null)}
                          >
                            Cancel
                          </button>
                          <button className="button button-dark" disabled={busy}>
                            Reply <Send size={14} />
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </div>
      <aside className="detail-sidebar">
        <span className="eyebrow">{art ? 'MADE BY A GOBBLER' : 'YOUR NEXT TAB'}</span>
        <h3>{art ? 'A little appreciation goes a long way.' : 'Take a closer look.'}</h3>
        {!art && <p>{p.pricing}</p>}
        {p.url && (
          <a
            className="button button-dark button-full"
            href={`/go/${p.slug}?source=${encodeURIComponent(source)}`}
            target="_blank"
            rel="noreferrer"
          >
            {art ? 'Visit the creator’s link' : `Try ${p.name}`} <ArrowUpRight size={17} />
          </a>
        )}
        <button
          className="button button-full"
          onClick={async (e) => {
            const icon = e.currentTarget.querySelector('svg'),
              rect = icon.getBoundingClientRect(),
              wasSaved = p.saved;
            squish(icon);
            if ((await onSave()) && !wasSaved) saveBurst(rect);
          }}
        >
          <Bookmark size={16} fill={p.saved ? 'currentColor' : 'none'} />
          {p.saved ? 'Saved to your collection' : 'Save for later'}
        </button>
        <ShareButton
          path={`/product/${p.slug}`}
          title={p.name}
          label="Share this work"
          product={p}
        />
        <div className="sidebar-divider" />
        <span className="eyebrow">BEHIND THE DISCOVERY</span>
        <p>
          {p.owner_name ? (
            <CreatorCredit product={p} prefix="Made by " />
          ) : (
            'Selected for our editorial starter collection.'
          )}
        </p>
        {!art && (
          <small>
            {p.editorial ? 'This maker has not claimed this listing. ' : ''}Pricing and availability
            are set by the product’s maker.
          </small>
        )}
      </aside>
    </div>
  );
}
