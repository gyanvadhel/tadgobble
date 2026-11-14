'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
  X,
  Menu,
  Shuffle,
  Pause,
  Play,
  Plus,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Brand } from './art';
import { Gobble } from './gobble';
import { isArtwork } from '../lib/product-options.mjs';
import NotificationBell from './notification-bell';
import IntroStory from './intro-story';
import { useSmoothScroll } from './use-smooth-scroll';
import { useCursorFx } from './use-cursor-fx';
import ProductShowcase, { ProductDemo, productSceneColor } from './product-showcase';
import { paletteStyle } from '../lib/design-tokens.mjs';
import '../app/launch.css';
import { api } from '../lib/client-api.mjs';

export default function Launch({ products }) {
  const root = useRef(null),
    hero = useRef(null),
    dialog = useRef(null),
    lastFocus = useRef(null);
  const gobbleShape = useRef(null),
    snack = useRef(null),
    feedTween = useRef(null),
    boopTween = useRef(null);
  const [preview, setPreview] = useState(null),
    [motion, setMotion] = useState(false),
    [reduceMotion, setReduceMotion] = useState(true);
  const [menu, setMenu] = useState(false),
    [feeding, setFeeding] = useState(false),
    [heroIndex, setHeroIndex] = useState(0),
    [boops, setBoops] = useState(0);
  useSmoothScroll({ enabled: motion, paused: Boolean(preview) });
  useCursorFx({ enabled: motion });
  const featured = products[heroIndex % Math.max(products.length, 1)];

  const openPreview = useCallback((product, fromFeed = false, trigger = null) => {
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
      feedTween.current?.kill();
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
      feedTween.current?.progress(1);
      boopTween.current?.progress(1);
      return;
    }
    gsap.registerPlugin(ScrollTrigger);
    const context = gsap.context(() => {
      gsap.from('.poster-title, .poster-intro > p, .intro-actions', {
        y: 18,
        opacity: 0,
        duration: 0.7,
        stagger: 0.08,
        ease: 'power3.out',
        clearProps: 'all',
      });
    }, root);
    return () => context.revert();
  }, [motion]);

  function boop() {
    if (feeding) return;
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
        duration: 0.65,
        ease: 'elastic.out(1, .35)',
        clearProps: 'transform',
      });
  }

  function feed(event) {
    if (!featured || feeding) return;
    const trigger = event.currentTarget;
    setFeeding(true);
    boopTween.current?.kill();
    gsap.set(gobbleShape.current, { clearProps: 'transform' });
    const done = () => {
      gsap.set([snack.current, gobbleShape.current], { clearProps: 'transform,opacity' });
      openPreview(featured, true, trigger);
      setHeroIndex((i) => i + 1);
      setFeeding(false);
    };
    if (motion) {
      const target = gobbleShape.current.getBoundingClientRect();
      const tile = snack.current.getBoundingClientRect();
      feedTween.current = gsap
        .timeline({ onComplete: done })
        .to(snack.current, {
          x: target.left + target.width * 0.52 - (tile.left + tile.width / 2),
          y: target.top + target.height * 0.71 - (tile.top + tile.height / 2),
          scale: 0.08,
          rotation: -18,
          opacity: 0,
          duration: 0.5,
          ease: 'power2.in',
        })
        .to(
          gobbleShape.current,
          {
            scaleX: 1.1,
            scaleY: 0.9,
            rotation: -6,
            duration: 0.12,
            repeat: 3,
            yoyo: true,
            ease: 'power1.inOut',
          },
          0.38,
        );
    } else done();
  }

  return (
    <div
      className={`launch ${motion ? 'motion-on' : 'motion-off'}`}
      ref={root}
      style={paletteStyle}
    >
      <a className="launch-skip" href="#fresh-picks">
        Skip to the good stuff
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
          <NotificationBell />
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
        <section className="poster-hero" ref={hero}>
          <div className="poster-bottom">
            <div className="poster-intro">
              <h1 className="poster-title">Discover work from first-time makers.</h1>
              <p>
                Art, design and useful little apps. Feed Gobble for a surprise, or browse
                everything.
              </p>
              <div className="intro-actions">
                {products.length ? (
                  <button
                    className="feed-button launch-button plum-button"
                    onClick={feed}
                    disabled={feeding || !products.length}
                  >
                    <Shuffle size={18} />
                    {feeding ? 'nom nom nom…' : 'Feed me a find'}
                  </button>
                ) : (
                  <a className="launch-button plum-button" href="/discover?submit=1">
                    <Plus size={18} />
                    Be the first find
                  </a>
                )}
                <a className="launch-button outline-button" href="/discover">
                  Browse all <ArrowUpRight size={18} />
                </a>
              </div>
            </div>
            <div className="hero-playground">
              <div className="gobble-stage">
                <div className="gobble-disc" aria-hidden="true" />
                <button
                  className="gobble-character"
                  onClick={boop}
                  aria-label="Boop the hungry blob"
                  aria-describedby="gobble-caption"
                  disabled={feeding}
                >
                  <Gobble ref={gobbleShape} className="gobble-shape" hungry={feeding} />
                </button>
                <a
                  ref={snack}
                  className="gobble-snack"
                  href={featured ? `/product/${featured.slug}` : '/discover?submit=1'}
                  aria-label={featured ? `Preview ${featured.name}` : 'Post your thing'}
                  onClick={(event) => {
                    if (!featured) return;
                    event.preventDefault();
                    if (!feeding) openPreview(featured, false, event.currentTarget);
                  }}
                >
                  {featured?.name || 'your thing?'}
                  <ArrowUpRight />
                </a>
              </div>
              <span className="boop-caption" id="gobble-caption" role="status">
                {boops
                  ? ['excellent boop.', 'okay, we’re besties.', 'bas. ek aur snack.'][
                      (boops - 1) % 3
                    ]
                  : 'tiny guy. concerning appetite.'}
                <span aria-hidden="true">↖</span>
              </span>
            </div>
          </div>
          <div className="poster-foot">
            <a href="#fresh-picks">
              Fresh stuff below <ArrowDown size={16} />
            </a>
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
          </div>
        </section>
        <IntroStory
          products={products}
          motion={motion}
          reduceMotion={reduceMotion}
          onMotion={setMotion}
        />
        <ProductShowcase products={products} onPeek={openPreview} motion={motion} />
        <section className="maker-poster" id="for-makers">
          <div>
            <h2>Made something?</h2>
            <p className="maker-detail">
              A painting, a design or an app. No portfolio needed, and it goes live the moment you
              post it.
            </p>
          </div>
          <a className="launch-button plum-button" href="/discover?submit=1">
            Post your thing <ArrowUpRight size={18} />
          </a>
        </section>
      </main>
      <footer className="launch-footer">
        <span>© {new Date().getFullYear()} tadgobble. Stay curious.</span>
        <nav aria-label="Footer">
          <a href="/discover">Explore</a>
          <a href="/discover?sponsor=1">Work with us</a>
          <a href="/studio">The kitchen</a>
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
        </nav>
        <a
          className="back-top"
          href="#top"
          aria-label="Back to top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: motion ? 'smooth' : 'instant' });
          }}
        >
          <ArrowUp size={18} />
        </a>
      </footer>
      <dialog
        ref={dialog}
        className="snack-dialog"
        data-lenis-prevent
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
      <span className="sr-only" role="status">
        {feeding ? 'Finding you something good.' : ''}
      </span>
    </div>
  );
}
