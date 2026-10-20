'use client';
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
} from 'lucide-react';
import { Brand } from './art';
import { Gobble } from './gobble';
import { ProductDemo, productSceneColor } from './product-showcase';
import { paletteStyle } from '../lib/design-tokens.mjs';
import { categories, audiences } from '../lib/product-options.mjs';
import SubmitWizard from './submit-wizard';
import '../app/launch.css';
import '../app/catalog.css';
import Studio from './studio';
import { brand } from '../lib/brand.mjs';

export async function api(path, body) {
  const res = await fetch(
    '/api/' + path,
    body === undefined
      ? { cache: 'no-store' }
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  return data;
}
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

export default function Platform({ initialView = 'discover', initialSlug = null }) {
  const [products, setProducts] = useState([]),
    [user, setUser] = useState(null),
    [loading, setLoading] = useState(true),
    [view, setView] = useState(initialView);
  const [category, setCategory] = useState('All discoveries'),
    [audience, setAudience] = useState('Everyone'),
    [search, setSearch] = useState(''),
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
        } else if (params.get('signin') === '1' || (params.get('saved') === '1' && !data.user))
          setModal('auth');
        else if (params.get('privacy') === '1') setModal('privacy');
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
      (audience === 'Everyone' || p.audience === 'Everyone' || p.audience === audience) &&
      `${p.name} ${p.tagline} ${p.category}`.toLowerCase().includes(search.toLowerCase()),
  );
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
              {user && <span className="nav-count">{products.filter((p) => p.saved).length}</span>}
            </button>
          </nav>
          <div className="header-actions">
            <button className="button button-dark submit-nav" onClick={() => actionModal('submit')}>
              <Plus size={16} /> Share your product
            </button>
            {user ? (
              <button
                className="avatar"
                aria-label="Open account"
                title={user.name}
                onClick={() => setModal('account')}
              >
                {user.name[0].toUpperCase()}
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
              <section className="catalog-poster">
                <h1>
                  THE WHOLE
                  <br />
                  RABBIT HOLE.
                </h1>
                <div>
                  <Gobble />
                  <p>
                    Useful apps. Weird little tools.
                    <br />
                    Go on. Open another tab.
                  </p>
                </div>
              </section>
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
            <section id="discoveries" className="discovery-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">A FEW TABS WORTH OPENING</span>
                  <h2>
                    {view === 'saved' ? 'Your saved discoveries' : 'Fresh out of the internet.'}
                  </h2>
                </div>
                <span className="collection-note">
                  <span className="small-dot" /> A growing collection
                </span>
              </div>
              {products.length > 0 && (
                <div className="discovery-controls">
                  <div className="category-tabs" role="group" aria-label="Filter by category">
                    {[
                      'All discoveries',
                      'Design',
                      'Productivity',
                      'Business',
                      'Automation',
                      'Developer tools',
                      'Play',
                    ].map((c) => (
                      <button
                        key={c}
                        className={category === c ? 'selected' : ''}
                        onClick={() => setCategory(c)}
                      >
                        {c === 'All discoveries' && <Compass size={15} />} {c}
                      </button>
                    ))}
                    <select
                      className="catalog-more-categories"
                      aria-label="More categories"
                      value={
                        categories
                          .filter(
                            (c) =>
                              ![
                                'Design',
                                'Productivity',
                                'Business',
                                'Automation',
                                'Developer tools',
                                'Play',
                              ].includes(c),
                          )
                          .includes(category)
                          ? category
                          : ''
                      }
                      onChange={(event) => setCategory(event.target.value || 'All discoveries')}
                    >
                      <option value="">More categories</option>
                      {categories
                        .filter(
                          (c) =>
                            ![
                              'Design',
                              'Productivity',
                              'Business',
                              'Automation',
                              'Developer tools',
                              'Play',
                            ].includes(c),
                        )
                        .map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="search-controls">
                    <label className="search-input">
                      <Search size={17} />
                      <input
                        aria-label="Search products"
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
                    <label className="audience-select">
                      <SlidersHorizontal size={15} />
                      <select
                        aria-label="Filter by audience"
                        value={audience}
                        onChange={(e) => setAudience(e.target.value)}
                      >
                        {audiences.map((a) => (
                          <option key={a}>{a}</option>
                        ))}
                      </select>
                    </label>
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
                  <Gobble />
                  <h3>The first bite is still cooking.</h3>
                  <p>
                    No discoveries yet. Share a working product and we’ll give it a proper look.
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
                      ? 'Tap the bookmark on any product to save it here.'
                      : 'Try another category or a different search.'}
                  </p>
                  <button
                    className="button button-dark"
                    onClick={() => {
                      setView('discover');
                      setCategory('All discoveries');
                      setAudience('Everyone');
                      setSearch('');
                    }}
                  >
                    Explore the collection <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                <div className="catalog-list">
                  {filtered.map((p, i) => (
                    <article
                      className={`product-card catalog-product ${p.cover ? 'has-cover' : ''}`}
                      style={{ '--product-color': productSceneColor(p) }}
                      key={p.id}
                    >
                      {p.cover && (
                        <a
                          className="catalog-cover"
                          href={'/product/' + p.slug}
                          aria-label={`View ${p.name} preview`}
                        >
                          <img
                            src={p.cover.url}
                            alt={`${p.name} website preview`}
                            width="1600"
                            height="1200"
                            loading="lazy"
                          />
                        </a>
                      )}
                      <a className="catalog-product-title" href={'/product/' + p.slug}>
                        <h3>{p.name}</h3>
                        <p>{p.tagline}</p>
                      </a>
                      <div className="catalog-product-meta">
                        <span>{p.category}</span>
                        <small>
                          {p.sponsored
                            ? 'Paid feature'
                            : p.owner_name
                              ? `by ${p.owner_name}`
                              : 'Editorial find'}
                        </small>
                      </div>
                      <div className="catalog-product-actions">
                        <button
                          className={`save-button ${p.saved ? 'is-saved' : ''}`}
                          onClick={() => save(p)}
                          aria-label={`${p.saved ? 'Unsave' : 'Save'} ${p.name}`}
                        >
                          <Bookmark size={20} fill={p.saved ? 'currentColor' : 'none'} />
                        </button>
                        <a href={'/product/' + p.slug} aria-label={`Explore ${p.name}`}>
                          <ArrowUpRight size={25} />
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
            <section className="maker-banner">
              <div className="maker-banner-icon">
                <Asterisk size={54} />
              </div>
              <div>
                <span className="eyebrow">YOU MADE IT. LET PEOPLE FIND IT.</span>
                <h2>There’s a place for your thing here.</h2>
                <p>Share what you’re building with people who love discovering something new.</p>
              </div>
              <button className="button button-dark" onClick={() => actionModal('submit')}>
                Share your product <ArrowUpRight size={17} />
              </button>
            </section>
            <div className="editorial-note">
              <Sparkles size={16} />
              <p>
                Products belong to their makers. We review submissions before publishing. Paid
                features are clearly labelled.
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
          <button onClick={() => setModal('privacy')}>Privacy</button>
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
              onDone={async () => {
                await refresh();
                setModal(afterAuth);
                setAfterAuth(null);
                notify('You’re in. Excellent taste, by the way.');
              }}
            />
          ) : modal === 'submit' ? (
            <SubmitWizard
              onDone={() => {
                setModal(null);
                notify('Your product is in the review queue. Thanks for sharing it.');
              }}
            />
          ) : modal === 'sponsor' ? (
            <SponsorForm
              onDone={() => {
                setModal(null);
                notify('Your partnership inquiry was saved for the studio owner.');
              }}
            />
          ) : modal === 'privacy' ? (
            <div className="prose">
              <span className="eyebrow">YOUR INFORMATION</span>
              <h2>A small, clear privacy note.</h2>
              <p>
                Accounts store your name, email, and a securely hashed password. Your public
                comments show your display name. Saved products belong to your account.
              </p>
              <p>
                A first-party anonymous visitor cookie helps us count visits and returning visitors.
                We record product-link clicks and campaign sources. These are visits, not proof of
                purchases. Raw visitor events are retained for up to 90 days while the worker runs.
              </p>
              <p>
                Session and visitor cookies last up to 30 days. We do not sell your account details.
                Opening a maker’s website takes you to their separate service and privacy terms.
              </p>
              <p>
                You can delete a member account from the account menu. This removes your login,
                saves, and comments; product listings can remain with the owner association removed.
              </p>
            </div>
          ) : modal === 'account' ? (
            <div className="account-panel">
              <span className="eyebrow">YOUR CORNER</span>
              <h2>Hello, {user?.name}.</h2>
              <p>{user?.email}</p>
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
              {user?.role !== 'admin' && (
                <button
                  className="button button-danger"
                  onClick={async () => {
                    if (confirm('Delete your account, saved products, and comments permanently?')) {
                      try {
                        await api('account/delete', {});
                        await refresh();
                        setModal(null);
                      } catch (e) {
                        notify(e.message);
                      }
                    }
                  }}
                >
                  Delete my account
                </button>
              )}
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
            'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled)',
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
function AuthForm({ onDone }) {
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError('');
        try {
          await api(
            register ? 'auth/register' : 'auth/login',
            Object.fromEntries(new FormData(e.currentTarget)),
          );
          await onDone();
        } catch (e) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="eyebrow">YOUR STASH IS WAITING</span>
      <h2>{register ? 'Come for a little snack.' : 'Back for seconds?'}</h2>
      <p className="form-intro">
        Save discoveries, join conversations, and share what you’re making.
      </p>
      {register && (
        <Field label="Your name">
          <input name="name" required minLength={2} maxLength={60} autoComplete="name" />
        </Field>
      )}
      <Field label="Email">
        <input name="email" type="email" required autoComplete="email" />
      </Field>
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
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-dark button-full" disabled={busy}>
        {busy ? (
          <LoaderCircle className="spin" size={17} />
        ) : (
          <>
            {register ? 'Create your account' : 'Sign in'} <ArrowRight size={16} />
          </>
        )}
      </button>
      <button
        className="form-switch"
        type="button"
        onClick={() => {
          setRegister(!register);
          setError('');
        }}
      >
        {register ? 'Already here? Sign in' : 'New here? Create an account'}
      </button>
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
  const [busy, setBusy] = useState(false);
  return (
    <div className="product-detail">
      <div className="detail-main">
        <div className="catalog-detail-demo" style={{ background: productSceneColor(p) }}>
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
        <h2>A little about this discovery</h2>
        <p className="detail-description">{p.description}</p>
        <ul className="facts-list">
          {p.facts.map((f) => (
            <li key={f}>
              <Check size={16} />
              {f}
            </li>
          ))}
        </ul>
        <a className="source-link" href={p.source} target="_blank" rel="noreferrer">
          Read the maker’s information <ExternalLink size={13} />
        </a>
        {p.submission?.demoUrl && (
          <p>
            <a className="source-link" href={p.submission.demoUrl} target="_blank" rel="noreferrer">
              Watch the maker’s demo <ExternalLink size={13} />
            </a>
          </p>
        )}
        <section className="conversation">
          <h2>
            Start a conversation <span>{comments.length}</span>
          </h2>
          <p>
            Ask a question, share what you tried, or leave something useful for the next person.
          </p>
          {user ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                setBusy(true);
                try {
                  await api('comment', { productId: p.id, body: new FormData(form).get('body') });
                  form.reset();
                  await onRefresh();
                } catch (e) {
                  notify(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <textarea
                name="body"
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
            comments.map((c) => (
              <article className="comment" key={c.id}>
                <div className="avatar small">{c.name[0]}</div>
                <div>
                  <strong>{c.name}</strong>
                  <time>{new Date(c.created_at).toLocaleDateString()}</time>
                  <p>{c.body}</p>
                  {(user?.id === c.user_id || user?.role === 'admin') && (
                    <button
                      className="text-button"
                      onClick={async () => {
                        await api('comment/delete', { id: c.id });
                        await onRefresh();
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </article>
            ))
          )}
        </section>
      </div>
      <aside className="detail-sidebar">
        <span className="eyebrow">YOUR NEXT TAB</span>
        <h3>Take a closer look.</h3>
        <p>{p.pricing}</p>
        <a
          className="button button-dark button-full"
          href={`/go/${p.slug}?source=${encodeURIComponent(source)}`}
          target="_blank"
          rel="noreferrer"
        >
          Try {p.name} <ArrowUpRight size={17} />
        </a>
        <button className="button button-full" onClick={onSave}>
          <Bookmark size={16} fill={p.saved ? 'currentColor' : 'none'} />
          {p.saved ? 'Saved to your collection' : 'Save for later'}
        </button>
        <div className="sidebar-divider" />
        <span className="eyebrow">BEHIND THE DISCOVERY</span>
        <p>
          {p.owner_name
            ? `Shared by ${p.owner_name}`
            : 'Selected for our editorial starter collection.'}
        </p>
        <small>
          {p.editorial ? 'This maker has not claimed this listing. ' : ''}Pricing and availability
          are set by the product’s maker.
        </small>
      </aside>
    </div>
  );
}
