'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUpRight, Bookmark, MessageCircle, Sparkles } from 'lucide-react';
import { Avatar } from './blob-avatar';
import { CreatorCredit } from './creator-credit';
import { VideoBadge } from './work-media';
import { productSceneColor } from './product-showcase';
import { api } from '../lib/client-api.mjs';
import { isArtwork, workImageAlt } from '../lib/product-options.mjs';
import {
  Flip,
  ScrollTrigger,
  calm,
  gsap,
  rememberFlight,
  saveBurst,
  squish,
  Squiggle,
  useFlingScroll,
  useGSAP,
  useMagnetic,
} from './motion';
import '../app/showcase.css';

function Byline({ product: p }) {
  return (
    <div className="showcase-byline">
      {p.sponsored ? (
        <span>Paid feature</span>
      ) : p.owner_name ? (
        <>
          {p.creator_profile && <Avatar profile={p.creator_profile} size={22} />}
          <CreatorCredit product={p} prefix="" />
        </>
      ) : (
        <span>Editorial find</span>
      )}
      {p.comment_count > 0 && (
        <span className="showcase-talk" title="Comments">
          <MessageCircle size={13} aria-hidden="true" />
          {p.comment_count}
          <span className="sr-only"> {p.comment_count === 1 ? 'comment' : 'comments'}</span>
        </span>
      )}
    </div>
  );
}

function SaveButton({ product: p, onSave, size = 18 }) {
  return (
    <button
      className={`save-button showcase-save ${p.saved ? 'is-saved' : ''}`}
      onClick={async (e) => {
        const rect = e.currentTarget.getBoundingClientRect(),
          wasSaved = p.saved;
        squish(e.currentTarget.firstElementChild);
        if ((await onSave(p)) && !wasSaved) saveBurst(rect);
      }}
      aria-label={`${p.saved ? 'Unsave' : 'Save'} ${p.name}`}
    >
      <Bookmark size={size} fill={p.saved ? 'currentColor' : 'none'} />
    </button>
  );
}

// A silent loop of a video post while the pointer rests on it. Touch screens and
// reduced-motion visitors keep the still cover.
function useHoverPreview(video) {
  const [src, setSrc] = useState('');
  const link = useRef(null),
    timer = useRef(0),
    hovering = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!video) return { src: '', handlers: {} };
  return {
    src,
    handlers: {
      onPointerEnter() {
        if (!matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches)
          return;
        hovering.current = true;
        timer.current = setTimeout(async () => {
          try {
            // Signed links last five minutes, so refresh one that is getting old.
            if (!link.current || Date.now() - link.current.at > 240_000)
              link.current = {
                url: (await api('videos/play', { id: video.id })).video.url,
                at: Date.now(),
              };
            if (hovering.current) setSrc(link.current.url);
          } catch {}
        }, 250);
      },
      onPointerLeave() {
        hovering.current = false;
        clearTimeout(timer.current);
        setSrc('');
      },
    },
  };
}

export function ShowcaseCard({ product: p, onSave }) {
  const { src, handlers } = useHoverPreview(p.cover?.video);
  const href = '/product/' + p.slug;
  return (
    <article
      data-flip-id={p.id}
      className={`showcase-card ${isArtwork(p) ? 'is-artwork' : 'is-app'}`}
      style={{ '--product-color': productSceneColor(p) }}
    >
      <div className="showcase-frame">
        <a
          className="showcase-media"
          href={href}
          aria-label={`Explore ${p.name}`}
          onClick={(e) => rememberFlight(e, p.slug)}
          {...handlers}
        >
          {p.cover ? (
            <>
              <img
                src={p.cover.url}
                alt={workImageAlt(p)}
                width="1600"
                height="1200"
                loading="lazy"
              />
              {src && <video src={src} muted loop playsInline autoPlay aria-hidden="true" />}
              <VideoBadge video={p.cover.video} />
            </>
          ) : (
            <span className="showcase-placeholder">
              <strong>{p.name}</strong>
              {p.tagline && <span>{p.tagline}</span>}
            </span>
          )}
        </a>
        <SaveButton product={p} onSave={onSave} />
      </div>
      <div className="showcase-info">
        <a className="showcase-title" href={href}>
          {p.name}
        </a>
        {!isArtwork(p) && p.cover && p.tagline && <p>{p.tagline}</p>}
        <Byline product={p} />
      </div>
    </article>
  );
}

// Cards are dealt across the columns left to right, so the grid reads in order
// and apps and artwork stay mixed instead of stacking down one column.
// When the filter, sort or width changes, cards glide to their new places
// (Flip), and cards below the fold rise in as they are scrolled to.
export function ShowcaseGrid({ products, onSave }) {
  const grid = useRef(null),
    [count, setCount] = useState(4),
    flip = useRef({ key: '', state: null }),
    revealed = useRef(new Set());
  useEffect(() => {
    const refresh = gsap.delayedCall(0.2, () => ScrollTrigger.refresh()).pause();
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      setCount(width < 560 ? 2 : Math.max(2, Math.min(4, Math.floor((width + 22) / 282))));
      // Pictures loading in change the page height, so re-measure the triggers.
      refresh.restart(true);
    });
    observer.observe(grid.current);
    return () => {
      observer.disconnect();
      refresh.kill();
    };
  }, []);
  // Note where every card is before React moves them.
  const key = count + ':' + products.map((p) => p.id).join();
  if (grid.current && flip.current.key !== key) {
    flip.current.state = flip.current.key
      ? Flip.getState(grid.current.querySelectorAll('.showcase-card'))
      : null;
    flip.current.key = key;
  }
  useLayoutEffect(() => {
    const state = flip.current.state;
    flip.current.state = null;
    if (!state || calm()) return;
    Flip.from(state, {
      targets: grid.current.querySelectorAll('.showcase-card'),
      duration: 0.45,
      ease: 'power3.inOut',
      onEnter: (els) =>
        gsap.fromTo(els, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.35 }),
    });
  }, [key]);
  useGSAP(
    () => {
      const fresh = [...grid.current.querySelectorAll('.showcase-card')].filter(
        (card) => !revealed.current.has(card.dataset.flipId),
      );
      fresh.forEach((card) => revealed.current.add(card.dataset.flipId));
      if (calm()) return;
      // On first load everything rises in; after that only cards still below the fold.
      const first = revealed.current.size === fresh.length;
      const later = fresh.filter((card) => first || card.getBoundingClientRect().top > innerHeight);
      const parts = (cards) => cards.flatMap((card) => [...card.children]);
      gsap.set(parts(later), { opacity: 0, y: 40 });
      ScrollTrigger.batch(later, {
        start: 'top 96%',
        once: true,
        onEnter: (cards) =>
          gsap.to(parts(cards), {
            opacity: 1,
            y: 0,
            duration: 0.5,
            ease: 'power3.out',
            stagger: 0.05,
          }),
      });
    },
    { scope: grid, dependencies: [key] },
  );
  const columns = Array.from({ length: count }, (_, i) =>
    products.filter((_, n) => n % count === i),
  );
  return (
    <div className="showcase-grid" ref={grid} style={{ '--columns': count }}>
      {columns.map((column, i) => (
        <div className="showcase-column" key={i}>
          {column.map((p) => (
            <ShowcaseCard key={p.id} product={p} onSave={onSave} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function FeaturedWork({ product: p, onSave }) {
  const href = '/product/' + p.slug;
  const media = useRef(null),
    magnet = useMagnetic();
  // The picture drifts a little slower than the page as it scrolls past.
  useGSAP(
    () => {
      if (calm()) return;
      gsap.fromTo(
        'img',
        { scale: 1.14, yPercent: -3 },
        {
          scale: 1.08,
          yPercent: 3,
          ease: 'none',
          scrollTrigger: {
            trigger: media.current,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        },
      );
    },
    { scope: media, dependencies: [p.id] },
  );
  return (
    <section
      className={`featured-work ${isArtwork(p) ? 'is-artwork' : ''}`}
      style={{ '--product-color': productSceneColor(p) }}
      aria-labelledby="featured-work-title"
    >
      <a
        ref={media}
        className="showcase-media featured-media"
        href={href}
        aria-label={`Explore ${p.name}`}
        onClick={(e) => rememberFlight(e, p.slug)}
      >
        <img src={p.cover.url} alt={workImageAlt(p)} width="1600" height="1200" />
        <VideoBadge video={p.cover.video} />
      </a>
      <div className="featured-copy">
        <span className="featured-label">
          <Sparkles size={14} /> {p.featured ? 'Featured' : 'Fresh pick'}
        </span>
        <h2 id="featured-work-title">
          <a href={href}>{p.name}</a>
        </h2>
        {p.tagline && <p>{p.tagline}</p>}
        <Byline product={p} />
        <div className="featured-actions">
          <a ref={magnet} className="button button-dark" href={href}>
            See the work <ArrowUpRight size={16} />
          </a>
          <SaveButton product={p} onSave={onSave} size={20} />
        </div>
      </div>
    </section>
  );
}

export function MakersStrip({ products }) {
  const row = useFlingScroll();
  // The faces pop up one after another when the row comes into view.
  useGSAP(
    () => {
      if (!row.current || calm()) return;
      gsap.from(row.current.children, {
        scale: 0.4,
        y: 24,
        opacity: 0,
        duration: 0.5,
        ease: 'back.out(2.2)',
        stagger: 0.05,
        scrollTrigger: { trigger: row.current, start: 'top 92%', once: true },
      });
    },
    { scope: row },
  );
  const makers = new Map();
  for (const p of products)
    if (p.creator_username) {
      const maker = makers.get(p.creator_username) || {
        username: p.creator_username,
        name: p.owner_name,
        profile: p.creator_profile,
        works: 0,
      };
      maker.works++;
      makers.set(p.creator_username, maker);
    }
  if (!makers.size) return null;
  return (
    <section className="makers-strip" aria-labelledby="makers-title">
      <div>
        <h2 id="makers-title">Meet the makers</h2>
        <Squiggle />
        <p>The people behind the work.</p>
      </div>
      <ul ref={row}>
        {[...makers.values()].slice(0, 16).map((m) => (
          <li key={m.username}>
            <a href={`/profile/${encodeURIComponent(m.username)}`}>
              <Avatar profile={{ name: m.name, ...m.profile }} size={64} />
              <strong>{m.name}</strong>
              <small>
                {m.works} {m.works === 1 ? 'piece' : 'pieces'}
              </small>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
