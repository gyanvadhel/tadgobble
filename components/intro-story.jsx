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
            </span>
          </span>
          <span className="art-bubble" data-part="bubble">
            <MessageCircle size={16} /> okay, this is lovely.
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
    const frame = requestAnimationFrame(refresh);
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
