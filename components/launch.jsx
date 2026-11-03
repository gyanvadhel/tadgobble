'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, ArrowUp, X, Menu, Pause, Play, Plus, Asterisk } from 'lucide-react';
import gsap from 'gsap';
import { Brand } from './art';
import { Gobble } from './gobble';
import { isArtwork } from '../lib/product-options.mjs';
import { isNew, freshProducts } from '../lib/fresh.mjs';
import SnackMachine from './snack-machine';
import { ProductDemo, productSceneColor } from './product-showcase';
import '../app/launch.css';
import { api } from '../lib/client-api.mjs';

export default function Launch({ products }) {
  const root = useRef(null),
    dialog = useRef(null),
    lastFocus = useRef(null);
  const gobbleShape = useRef(null),
    boopTween = useRef(null);
  const [preview, setPreview] = useState(null),
    [motion, setMotion] = useState(false),
    [reduceMotion, setReduceMotion] = useState(true);
  const [menu, setMenu] = useState(false),
    [boops, setBoops] = useState(0);
  const fresh = freshProducts(products).slice(0, 12);

  const openPreview = useCallback((product, trigger = null) => {
    if (!product) return;
    lastFocus.current = trigger || document.activeElement;
    setPreview(product);
  }, []);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      setReduceMotion(media.matches);
      setMotion(!media.matches);
    };
    update();
    media.addEventListener('change', update);
    const params = new URLSearchParams(location.search);
    let source = params.get('utm_source') || 'direct';
    try {
      source = params.get('utm_source') || sessionStorage.getItem('ap_source') || 'direct';
      sessionStorage.setItem('ap_source', source);
    } catch {}
    api('events', { kind: 'visit', source, campaign: params.get('utm_campaign') || '' }).catch(
      () => {},
    );
    return () => {
      media.removeEventListener('change', update);
      boopTween.current?.kill();
    };
  }, []);

  useEffect(() => {
    if (preview && dialog.current && !dialog.current.open) dialog.current.showModal();
    if (!preview && dialog.current?.open) dialog.current.close();
    if (!preview) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.current?.close();
      document.body.style.overflow = old;
      lastFocus.current?.focus?.();
    };
  }, [preview]);

  useEffect(() => {
    if (!motion) {
      boopTween.current?.progress(1);
      return;
    }
    const context = gsap.context(() => {
      gsap.from('.fresh-hero-copy', {
        y: 24,
        opacity: 0,
        duration: 0.5,
        ease: 'power2.out',
        clearProps: 'all',
      });
    }, root);
    return () => context.revert();
  }, [motion]);

  function boop() {
    setBoops((b) => b + 1);
    if (!motion) return;
    boopTween.current?.kill();
    boopTween.current = gsap
      .timeline()
      .to(gobbleShape.current, {
        scaleX: 1.12,
        scaleY: 0.86,
        rotation: -16,
        duration: 0.13,
        ease: 'power2.out',
      })
      .to(gobbleShape.current, {
        scaleX: 1,
        scaleY: 1,
        rotation: -10,
        duration: 0.35,
        ease: 'elastic.out(1, .35)',
        clearProps: 'transform',
      });
  }

  return (
    <div className={`launch ${motion ? 'motion-on' : 'motion-off'}`} ref={root}>
      <a className="launch-skip" href="#fresh-picks">
        Skip to the fresh work
      </a>
      <header className="launch-header">
        <Brand />
        <nav className={`launch-nav ${menu ? 'is-open' : ''}`} aria-label="Main navigation">
          <a href="/discover">Discover</a>
          <a href="/discover?saved=1">Your stash</a>
          <a href="#for-makers" onClick={() => setMenu(false)}>
            For makers
          </a>
        </nav>
        <div className="launch-header-actions">
          <a className="header-submit" href="/discover?submit=1" aria-label="Post your thing">
            Post your thing <Plus size={18} />
          </a>
          <button
            className="launch-menu-toggle"
            aria-label={menu ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menu}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main>
        <section className="fresh-hero">
          <div className="fresh-hero-copy">
            <h1>
              Fresh from <mark>first-timers.</mark>
            </h1>
            <p>India's newest makers, posting their first things. Go say something nice.</p>
          </div>
          <div className="hero-playground">
            <button
              className="gobble-character"
              onClick={boop}
              aria-label="Boop the hungry blob"
              aria-describedby="gobble-caption"
            >
              <Gobble ref={gobbleShape} className="gobble-shape" />
            </button>
            <span className="boop-caption" id="gobble-caption" role="status">
              {boops
                ? ['excellent boop.', 'okay, we’re besties.', 'zero thoughts. just snacks.'][
                    (boops - 1) % 3
                  ]
                : 'tiny guy. concerning appetite.'}
            </span>
          </div>
          <button
            className="motion-control"
            aria-pressed={!motion}
            onClick={() => setMotion((v) => !v)}
            disabled={reduceMotion}
            aria-label={
              reduceMotion
                ? 'Reduced motion enabled by your device'
                : motion
                  ? 'Pause animations'
                  : 'Play animations'
            }
          >
            {motion ? <Pause size={13} /> : <Play size={13} />}
            {reduceMotion ? 'Reduced motion' : motion ? 'Pause motion' : 'Play motion'}
          </button>
        </section>
        <section className="fresh-grid" id="fresh-picks" aria-labelledby="fresh-today">
          <div className="fresh-grid-head">
            <h2 id="fresh-today" className="fresh-pill">
              Fresh today
            </h2>
            <a className="fresh-all" href="/discover">
              See everything <ArrowUpRight size={16} />
            </a>
          </div>
          {fresh.length ? (
            <div className="fresh-cards">
              {fresh.map((product) => (
                <article key={product.id} data-created={product.created_at}>
                  <a
                    className="fresh-card"
                    href={`/product/${product.slug}`}
                    onClick={(event) => {
                      event.preventDefault();
                      openPreview(product, event.currentTarget);
                    }}
                  >
                    <span
                      className="fresh-cover"
                      style={{ background: productSceneColor(product) }}
                      aria-hidden="true"
                    >
                      {product.name.slice(0, 1)}
                    </span>
                    <span className="fresh-card-text">
                      <h3>{product.name}</h3>
                      {product.owner_name && <span>{product.owner_name}</span>}
                    </span>
                    {isNew(product.created_at) && <span className="new-badge">new</span>}
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <div className="fresh-empty">
              <p>Nothing fresh yet. Be the first.</p>
              <a className="launch-button yellow-button" href="/discover?submit=1">
                Post your thing <Plus size={18} />
              </a>
            </div>
          )}
        </section>
        <section className="snack-section" aria-label="Snack machine">
          <SnackMachine
            products={products}
            motion={motion}
            onPick={(p, el) => openPreview(p, el)}
          />
        </section>
        <section className="maker-poster" id="for-makers">
          <div className="maker-poster-top">
            <span>For the people making things</span>
            <span>Your side project called.</span>
          </div>
          <h2>
            MADE A THING?
            <br />
            LET IT LOOSE.
          </h2>
          <div className="maker-poster-bottom">
            <Asterisk className="maker-asterisk" aria-hidden="true" />
            <div>
              <p>
                It deserves more than “looks cool bro”
                <br />
                and a bookmark nobody opens.
              </p>
              <p className="maker-detail">
                Share a painting, a design, or an app. No portfolio needed. We review every
                submission so curious people can discover your work and talk about it.
              </p>
              <a className="launch-button yellow-button" href="/discover?submit=1">
                Post your thing <ArrowUpRight size={20} />
              </a>
            </div>
            <div className="maker-stamp">
              <Gobble />
              <span>
                made it?
                <br />
                feed it to us.
              </span>
            </div>
          </div>
        </section>
      </main>
      <footer className="launch-footer">
        <div className="footer-intro">
          <p>
            Good finds.
            <br />
            Questionable screen time.
          </p>
          <div>
            <a href="/discover">Explore</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
            <a href="/discover?sponsor=1">Work with us</a>
            <a href="/studio">
              The kitchen <ArrowUpRight size={14} />
            </a>
          </div>
          <a
            className="back-top"
            href="#top"
            aria-label="Back to top"
            onClick={(e) => {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: motion ? 'smooth' : 'instant' });
            }}
          >
            <ArrowUp size={28} />
          </a>
        </div>
        <a className="footer-wordmark" href="/" aria-label="tadgobble home">
          tadgobble<span>.</span>
        </a>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} tadgobble</span>
          <span>Stay curious. Stay a little weird.</span>
        </div>
      </footer>
      <dialog
        ref={dialog}
        className="snack-dialog"
        onCancel={(e) => {
          e.preventDefault();
          setPreview(null);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setPreview(null);
        }}
        aria-labelledby="snack-dialog-title"
      >
        {preview && (
          <div className="snack-dialog-content">
            <button
              className="snack-dialog-close"
              aria-label="Close discovery preview"
              onClick={() => setPreview(null)}
              autoFocus
            >
              <X size={22} />
            </button>
            <div className="snack-dialog-art" style={{ background: productSceneColor(preview) }}>
              <ProductDemo key={preview.id} product={preview} />
            </div>
            <div className="snack-dialog-copy">
              <span>A little taste before you click.</span>
              <h2 id="snack-dialog-title">{preview.name}</h2>
              <p>{preview.description}</p>
              <div className="preview-meta">
                <span>{preview.category}</span>
                {!isArtwork(preview) && <span>{preview.pricing}</span>}
                {preview.sponsored && <span>Paid feature</span>}
              </div>
              <a className="launch-button plum-button" href={`/product/${preview.slug}`}>
                Take a proper look <ArrowUpRight size={18} />
              </a>
              <p className="preview-note">
                See the details, save it to your stash, or hear what people think.
              </p>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
