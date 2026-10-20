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
  Asterisk,
} from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Brand } from './art';
import { Gobble } from './gobble';
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
    api('events', { kind: 'visit', source, campaign: params.get('utm_campaign') || '' }).catch(() => {});
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
      gsap.from('.poster-title span', {
        yPercent: 110,
        rotate: 3,
        duration: 0.9,
        stagger: 0.09,
        ease: 'power3.out',
        clearProps: 'all',
      });
      gsap.to('.poster-title', {
        xPercent: -3,
        ease: 'none',
        scrollTrigger: { trigger: hero.current, start: 'top top', end: 'bottom top', scrub: 0.7 },
      });
      gsap.fromTo(
        '.ribbon-type',
        { xPercent: -8 },
        {
          xPercent: 4,
          ease: 'none',
          scrollTrigger: {
            trigger: '.discovery-ribbon',
            start: 'top bottom',
            end: 'bottom top',
            scrub: 1,
          },
        },
      );
      gsap.to('.maker-asterisk', {
        rotation: 120,
        ease: 'none',
        scrollTrigger: {
          trigger: '.maker-poster',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.8,
        },
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
          <a href="#fresh-picks" onClick={() => setMenu(false)}>
            The good stuff
          </a>
          <a href="/discover?saved=1">Your stash</a>
          <a href="#for-makers" onClick={() => setMenu(false)}>
            For makers
          </a>
        </nav>
        <div className="launch-header-actions">
          <a className="header-submit" href="/discover?submit=1" aria-label="Share your product">
            Made something? <Plus size={18} />
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
          <div className="poster-topline">
            <span>A very good corner of the internet.</span>
            <span>Curiosity looks good on you.</span>
          </div>
          <h1 className="poster-title">
            <span>GOOD</span> <span>FINDS.</span>
          </h1>
          <div className="poster-bottom">
            <div className="poster-intro">
              <h2>
                Your next <br />
                “wait, this exists?”
              </h2>
              <p>
                Useful apps. Oddly brilliant tools. <br />A new obsession, probably.
              </p>
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
              <a className="poster-explore" href="#fresh-picks">
                Or browse the menu <ArrowDown size={17} />
              </a>
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
                  aria-label={
                    featured ? `Preview ${featured.name}` : 'Share your product with Gobble'
                  }
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
                  ? ['excellent boop.', 'okay, we’re besties.', 'zero thoughts. just snacks.'][
                      (boops - 1) % 3
                    ]
                  : 'tiny guy. concerning appetite.'}
                <span aria-hidden="true">↖</span>
              </span>
            </div>
            <div className="poster-note">
              <Asterisk size={65} strokeWidth={1.5} />
              <p>
                Less doom.
                <br />
                More{' '}
                <span>
                  “yo, look
                  <br />
                  at this.”
                </span>
              </p>
              <span className="note-small">
                For people with
                <br />
                too many tabs open.
              </span>
            </div>
          </div>
          <div className="poster-foot">
            <a href="#fresh-picks">
              Good things below <ArrowDown size={16} />
            </a>
            <span>Independent finds. Shared appetites.</span>
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
        <div className="discovery-ribbon" aria-label="Open another tab. Find something good.">
          <div className="ribbon-type" aria-hidden="true">
            OPEN ANOTHER TAB. <Asterisk /> FIND SOMETHING GOOD. <Asterisk /> OPEN ANOTHER TAB.
          </div>
        </div>
        <ProductShowcase products={products} onPeek={openPreview} motion={motion} />
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
                Share your working product. We review every submission for the menu, so curious
                people can discover it, try it, and talk about it.
              </p>
              <a className="launch-button plum-button" href="/discover?submit=1">
                Put your thing on the menu <ArrowUpRight size={20} />
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
            <a href="/discover?privacy=1">Privacy</a>
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
              aria-label="Close product preview"
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
                <span>{preview.pricing}</span>
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
