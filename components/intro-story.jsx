'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, Bookmark, Check, MessageCircle, Pause } from 'lucide-react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Gobble } from './gobble';
import { scenes, pinMode, sceneIndexAt } from '../lib/intro-story.mjs';
import '../app/intro-story.css';

// Decorative pictures for each scene. The scene's real meaning lives in its heading and text.
function Art({ id, mood, first }) {
  const name = first?.name || 'your thing?';
  switch (id) {
    case 'rabbit-hole':
      return (
        <>
          <span className="art-chip" style={{ '--r': '-8deg', '--x': '4%', '--y': '8%' }}>
            40 open tabs
          </span>
          <span className="art-chip" style={{ '--r': '6deg', '--x': '58%', '--y': '4%' }}>
            12 saved reels
          </span>
          <span className="art-chip" style={{ '--r': '-4deg', '--x': '8%', '--y': '74%' }}>
            where was that app?
          </span>
          <span className="art-gobble" data-part="gobble">
            <Gobble expression={mood} />
          </span>
        </>
      );
    case 'feed':
      return (
        <>
          <span className="art-ticket" data-part="ticket">
            {name}
          </span>
          <span className="art-gobble" data-part="gobble">
            <Gobble expression={mood} />
          </span>
          <span className="art-card" data-part="card">
            <b>{first ? first.category : 'a fresh find'}</b>
            <i>A little taste before you click.</i>
          </span>
        </>
      );
    case 'stash':
      return (
        <>
          <span className="art-card art-card-big" data-part="card">
            <b>{first?.name || 'Something you will love'}</b>
            <i>peek first, then decide</i>
            <span className="art-bookmark" data-part="bookmark">
              <Bookmark size={22} />
              {scenes.map((scene, n) =>
                [0, 1].map((m) => (
                  <i key={`${n}${m}`} className="art-confetti" style={{ background: scene.color }} />
                )),
              )}
            </span>
          </span>
          <span className="art-bubble" data-part="bubble">
            <MessageCircle size={16} /> <span className="bubble-text">okay, this is lovely.</span>
          </span>
          <span className="art-gobble art-gobble-small" data-part="gobble">
            <Gobble expression={mood} />
          </span>
        </>
      );
    case 'post':
      return (
        <>
          <span className="art-ticket art-form" data-part="ticket">
            <b>A photo or video</b>
            <b>A title</b>
            <b>Your website, for apps</b>
          </span>
          <span className="art-receipt" data-part="receipt">
            <Check size={16} /> In the review queue
          </span>
        </>
      );
    default:
      return (
        <>
          <span className="art-gobble" data-part="gobble">
            <Gobble expression={mood} />
          </span>
          <ArrowDown className="art-arrow" size={44} data-part="arrow" />
        </>
      );
  }
}

// Each scene's picture moves on the story's scrubbed timeline. Start looks come from the CSS
// (so a rewind lands back on them); only things that must be hidden first use fromTo.
function animateArt(tl, n, el) {
  const art = el.querySelector('.story-art');
  const all = (sel) => el.querySelectorAll(sel);
  const part = (name) => all(`[data-part="${name}"]`);
  const gobble = all('.art-gobble svg');
  // Where a piece has to travel to land on the middle of the picture (Gobble's mouth).
  const toMouth = (lift = 0) => ({
    x: (i, t) => art.offsetWidth / 2 - (t.offsetLeft + t.offsetWidth / 2),
    y: (i, t) => art.offsetHeight / 2 + lift * art.offsetHeight - (t.offsetTop + t.offsetHeight / 2),
  });
  if (n === 0) {
    // The pile of tabs and reels gets swallowed.
    tl.to(all('.art-chip'), { ...toMouth(), scale: 0.15, opacity: 0, duration: 0.35, stagger: 0.07, ease: 'power2.in' }, 0.3);
    tl.fromTo(gobble, { scale: 1, transformOrigin: '50% 70%' }, { scale: 1.2, duration: 0.1, yoyo: true, repeat: 1, ease: 'power2.out' }, 0.7);
  } else if (n === 1) {
    // A ticket flies into Gobble's mouth and a product card pops out.
    tl.to(part('ticket'), { ...toMouth(0.06), rotation: 0, scale: 0.2, opacity: 0, duration: 0.35, ease: 'power2.in' }, n + 0.1);
    tl.fromTo(gobble, { scaleX: 1, scaleY: 1, transformOrigin: '50% 100%' }, { scaleX: 1.1, scaleY: 0.86, duration: 0.1, yoyo: true, repeat: 1 }, n + 0.42);
    tl.fromTo(part('card'), { scale: 0, opacity: 0, y: 30 }, { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: 'back.out(1.8)' }, n + 0.5);
  } else if (n === 2) {
    // A card opens, the bookmark fills with a burst of confetti, a comment types in.
    const mark = part('bookmark');
    tl.fromTo(all('.art-card-big'), { scale: 0.6, opacity: 0, rotation: -12 }, { scale: 1, opacity: 1, rotation: -3, duration: 0.3, ease: 'back.out(1.6)' }, n + 0.05);
    tl.fromTo(gobble, { scale: 0.7 }, { scale: 1, duration: 0.25, ease: 'back.out(2)' }, n + 0.1);
    tl.fromTo(mark[0].querySelector('svg'), { fill: 'rgba(255,255,246,0)' }, { fill: 'rgb(255,255,246)', duration: 0.15 }, n + 0.4);
    tl.fromTo(mark, { scale: 1 }, { scale: 1.35, duration: 0.1, yoyo: true, repeat: 1 }, n + 0.4);
    const bits = all('.art-confetti');
    tl.to(bits, { opacity: 1, duration: 0.01 }, n + 0.42);
    tl.to(bits, { x: (i) => Math.cos((i / bits.length) * Math.PI * 2) * 52, y: (i) => Math.sin((i / bits.length) * Math.PI * 2) * 52, rotation: 200, duration: 0.3, ease: 'power2.out' }, n + 0.42);
    tl.to(bits, { opacity: 0, duration: 0.15 }, n + 0.57);
    tl.fromTo(part('bubble'), { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.2 }, n + 0.6);
    tl.fromTo(all('.bubble-text'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', ease: 'steps(19)', duration: 0.3 }, n + 0.68);
  } else if (n === 3) {
    // The post ticket fills in, then an "In the review queue" receipt arrives.
    tl.to(all('.art-form b'), { backgroundColor: '#ddd3ff', borderColor: 'rgba(57,36,90,0.8)', duration: 0.15, stagger: 0.15 }, n + 0.1);
    tl.to(part('ticket'), { y: -12, duration: 0.3, ease: 'power2.inOut' }, n + 0.55);
    tl.fromTo(part('receipt'), { x: 140, opacity: 0, rotation: 12 }, { x: 0, opacity: 1, rotation: 4, duration: 0.3, ease: 'back.out(1.6)' }, n + 0.6);
  } else {
    // Gobble winks hello and an arrow points down at the fresh picks.
    tl.fromTo(gobble, { scale: 0.5, rotation: -30 }, { scale: 1, rotation: 0, duration: 0.3, ease: 'back.out(1.8)' }, n + 0.05);
    tl.fromTo(part('arrow'), { opacity: 0, y: -24 }, { opacity: 1, y: 0, duration: 0.2 }, n + 0.45);
    tl.to(part('arrow'), { y: 14, duration: 0.1, yoyo: true, repeat: 3 }, n + 0.65);
  }
}

// Where each colour blob melts in from, as a percentage of the stage.
const spots = [
  [50, 50],
  [18, 78],
  [84, 24],
  [24, 20],
  [78, 80],
];

export default function IntroStory({ products = [], motion = false, reduceMotion = true, onMotion }) {
  const first = products[0];
  const section = useRef(null);
  const stage = useRef(null);
  const landed = useRef(false);
  const [mode, setMode] = useState('static');

  // Decide on the client whether this device gets the pinned story or the plain list.
  useEffect(() => {
    setMode(
      pinMode({
        reduceMotion,
        motion,
        coarsePointer: matchMedia('(pointer: coarse)').matches,
        cores: navigator.hardwareConcurrency,
        memory: navigator.deviceMemory,
      }),
    );
  }, [motion, reduceMotion]);

  // The pinned, scrubbed timeline. Everything lives in one matchMedia context so a
  // switch to the plain list (or a resize across the phone breakpoint) reverts it all.
  useEffect(() => {
    if (mode !== 'pinned') return;
    gsap.registerPlugin(ScrollTrigger, SplitText);
    ScrollTrigger.config({ ignoreMobileResize: true });
    const root = section.current;
    const sceneEls = [...root.querySelectorAll('.story-scene')];
    const mm = gsap.matchMedia();
    mm.add({ phone: '(max-width: 800px)', desk: '(min-width: 801px)' }, (ctx) => {
      const { phone } = ctx.conditions;
      const blobs = gsap.utils.toArray('.goo-blob', root);
      const paint = (index) =>
        sceneEls.forEach((el, n) => {
          el.dataset.active = n === index ? 'true' : 'false';
        });
      paint(0);
      gsap.set(blobs[0], { scale: 7 });
      gsap.set(blobs.slice(1), { scale: 0 });
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: phone ? '+=350%' : '+=450%',
          pin: stage.current,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => paint(sceneIndexAt(self.progress)),
        },
      });
      tl.set({}, {}, scenes.length);
      sceneEls.forEach((el, n) => {
        animateArt(tl, n, el);
        if (n === 0) return;
        const words = SplitText.create(el.querySelector('h3'), { type: 'words', mask: 'words' }).words;
        tl.to(blobs[n], { scale: 7, duration: 0.5, ease: 'power2.inOut' }, n - 0.35);
        gsap.set(words, { yPercent: 115 });
        tl.to(words, { yPercent: 0, duration: 0.35, stagger: 0.05, ease: 'power3.out' }, n);
      });
    });
    return () => {
      mm.revert();
      sceneEls.forEach((el) => delete el.dataset.active);
    };
  }, [mode]);

  // Products can arrive late (the static export loads them after the page), which moves things.
  useEffect(() => {
    if (mode !== 'pinned') return;
    const refresh = () => ScrollTrigger.refresh();
    const frame = requestAnimationFrame(() => {
      refresh();
      // The pin adds thousands of pixels above everything after the story, so a deep link
      // the browser already jumped to (/#for-makers) has to be re-found once, on first pin.
      if (!landed.current) {
        landed.current = true;
        const target = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
        if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
    });
    addEventListener('orientationchange', refresh);
    return () => {
      cancelAnimationFrame(frame);
      removeEventListener('orientationchange', refresh);
    };
  }, [mode, products.length]);

  return (
    <section
      ref={section}
      className="intro-story"
      id="how-it-works"
      aria-labelledby="intro-story-title"
      data-mode={mode}
    >
      <h2 id="intro-story-title" className="sr-only">
        How tadgobble works
      </h2>
      <svg className="story-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="story-goo" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur" />
            <feColorMatrix
              in="blur"
              mode="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10"
            />
          </filter>
        </defs>
      </svg>
      <div className="story-stage" ref={stage}>
        <div className="story-goo" aria-hidden="true">
          {scenes.map((scene, i) => (
            <span
              key={scene.id}
              className="goo-blob"
              style={{ background: scene.color, left: spots[i][0] + '%', top: spots[i][1] + '%' }}
            />
          ))}
        </div>
        <ol className="story-scenes">
          {scenes.map((scene, i) => (
            <li key={scene.id}>
              <article className="story-scene" data-scene={scene.id} style={{ '--scene': scene.color }}>
                <div className="story-copy">
                  <span className="story-step">0{i + 1}</span>
                  <h3>{scene.title}</h3>
                  <p>{scene.body}</p>
                </div>
                <div className="story-art" aria-hidden="true">
                  <Art id={scene.id} mood={scene.mood} first={first} />
                </div>
              </article>
            </li>
          ))}
        </ol>
        <a className="story-skip" href="#fresh-picks">
          Skip the tour <ArrowDown size={16} />
        </a>
        {mode === 'pinned' && onMotion && (
          <button type="button" className="story-pause" onClick={() => onMotion(false)}>
            <Pause size={13} /> Pause the tour
          </button>
        )}
      </div>
    </section>
  );
}
