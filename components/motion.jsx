'use client';
// The catalog's motion, built on GSAP. Visitors who ask for reduced motion get
// everything still and instant, movement stays around half a second, and pointer
// effects are for mice and trackpads only (taps still squish and burst).
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Flip } from 'gsap/Flip';
import { SplitText } from 'gsap/SplitText';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { Physics2DPlugin } from 'gsap/Physics2DPlugin';
import { CustomEase } from 'gsap/CustomEase';
import { CustomWiggle } from 'gsap/CustomWiggle';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Gobble } from './gobble';
import '../app/motion.css';

gsap.registerPlugin(
  useGSAP,
  Flip,
  SplitText,
  ScrambleTextPlugin,
  DrawSVGPlugin,
  Physics2DPlugin,
  CustomEase,
  CustomWiggle,
  Draggable,
  InertiaPlugin,
  ScrollTrigger,
);
export { gsap, useGSAP, Flip, ScrollTrigger };

export const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const mouse = () => matchMedia('(hover: hover) and (pointer: fine)').matches;
let jiggle;
const jiggleEase = () =>
  (jiggle ||= CustomWiggle.create('jiggle', { wiggles: 6, type: 'easeOut' }));

// Sets an element wobbling like a jelly. It settles back where it started.
export function jelly(el, base = 0, turn = 14) {
  return gsap.fromTo(
    el,
    { rotation: base, scale: 1 },
    { rotation: base + turn, scale: 1.06, duration: 0.6, ease: jiggleEase(), overwrite: true },
  );
}

// Gobble with a pulse: the pupils follow the cursor, the eyes blink now and
// then, and a hover or tap sets the whole blob wobbling.
export function LivingGobble(props) {
  const ref = useRef(null);
  useGSAP(
    (_, contextSafe) => {
      const svg = ref.current;
      if (calm()) return;
      const base = gsap.getProperty(svg, 'rotation');
      const wobble = contextSafe(() => jelly(svg, base));
      const blink = contextSafe(() => {
        gsap.to(svg.querySelectorAll('.gobble-eye'), {
          scaleY: 0.1,
          transformOrigin: '50% 50%',
          duration: 0.07,
          yoyo: true,
          repeat: 1,
        });
        gsap.delayedCall(gsap.utils.random(2, 5), blink);
      });
      gsap.delayedCall(1.2, blink);
      svg.addEventListener('pointerenter', wobble);
      svg.addEventListener('pointerdown', wobble);
      const pupils = [...svg.querySelectorAll('.gobble-pupil')].map((el) => ({
        x: gsap.quickTo(el, 'x', { duration: 0.3, ease: 'power3' }),
        y: gsap.quickTo(el, 'y', { duration: 0.3, ease: 'power3' }),
      }));
      const look = (e) => {
        const r = svg.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2),
          dy = e.clientY - (r.top + r.height * 0.45);
        const d = Math.hypot(dx, dy) || 1,
          reach = Math.min(1, d / 260);
        // The pupils rest a little right of centre, so "centred" is -3, -2.
        for (const p of pupils) {
          p.x(-3 + (dx / d) * 5 * reach);
          p.y(-2 + (dy / d) * 5 * reach);
        }
      };
      if (mouse()) window.addEventListener('pointermove', look);
      return () => {
        svg.removeEventListener('pointerenter', wobble);
        svg.removeEventListener('pointerdown', wobble);
        window.removeEventListener('pointermove', look);
      };
    },
    { scope: ref },
  );
  return <Gobble ref={ref} {...props} />;
}

// The Discover poster: the headline drops in letter by letter, then the line
// under it and Gobble follow.
export function Poster() {
  const ref = useRef(null);
  useGSAP(
    () => {
      const h1 = ref.current.querySelector('h1');
      gsap.set(h1, { visibility: 'visible' });
      if (calm()) return;
      SplitText.create(h1, {
        type: 'chars',
        aria: 'hidden',
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.chars, {
            yPercent: -120,
            opacity: 0,
            rotation: () => gsap.utils.random(-25, 25),
            duration: 0.5,
            ease: 'bounce.out',
            stagger: 0.025,
          }),
      });
      gsap.from(ref.current.querySelector('p'), { y: 16, opacity: 0, duration: 0.45, delay: 0.45 });
      gsap.from(ref.current.querySelector('svg'), {
        scale: 0,
        duration: 0.5,
        delay: 0.35,
        ease: 'back.out(2.5)',
      });
    },
    { scope: ref },
  );
  return (
    <section className="catalog-poster" ref={ref}>
      <h1 aria-label="The whole rabbit hole.">
        THE WHOLE
        <br />
        RABBIT HOLE.
      </h1>
      <div>
        <LivingGobble />
        <p>
          Art. Design. Useful little apps.
          <br />
          Made by people worth discovering.
        </p>
      </div>
    </section>
  );
}

// Buttons that lean toward the cursor when it comes close.
export function useMagnetic(pull = 0.3) {
  const ref = useRef(null);
  useGSAP(() => {
    const el = ref.current;
    if (!el || calm() || !mouse()) return;
    const x = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' }),
      y = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const left = r.left - gsap.getProperty(el, 'x'),
        top = r.top - gsap.getProperty(el, 'y');
      x((e.clientX - left - r.width / 2) * pull);
      y((e.clientY - top - r.height / 2) * pull);
    };
    const leave = () => {
      x(0);
      y(0);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerleave', leave);
    };
  });
  return ref;
}

// Cycles a search box's placeholder through examples with a quick scramble.
// It holds still while the box has focus or text.
export function useScramblePlaceholder(phrases) {
  const ref = useRef(null);
  useGSAP((_, contextSafe) => {
    if (calm()) return;
    const proxy = document.createElement('span');
    let i = 0;
    // The box may appear later (after the catalog loads), so look it up each turn.
    const next = contextSafe(() => {
      const input = ref.current;
      if (input && document.activeElement !== input && !input.value) {
        i = (i + 1) % phrases.length;
        proxy.textContent = input.placeholder;
        gsap.to(proxy, {
          duration: 0.5,
          scrambleText: { text: phrases[i], chars: 'lowerCase', speed: 0.6 },
          onUpdate: () => (input.placeholder = proxy.textContent),
        });
      }
      gsap.delayedCall(2.8, next);
    });
    gsap.delayedCall(2.8, next);
  });
  return ref;
}

export function squish(el) {
  if (el && !calm())
    gsap.fromTo(
      el,
      { scale: 0.7 },
      { scale: 1, duration: 0.5, ease: 'elastic.out(1.2, 0.4)', overwrite: true },
    );
}

// A pop of confetti from where a save button was.
const confetti = ['#f9f4a7', '#c5b5f5', '#ff7949', '#85b5a3', '#39245a'];
export function saveBurst(rect) {
  if (!rect || calm()) return;
  for (let i = 0; i < 12; i++) {
    const dot = document.createElement('i');
    dot.className = 'save-confetti';
    dot.style.cssText = `left:${rect.left + rect.width / 2}px;top:${rect.top + rect.height / 2}px;background:${confetti[i % confetti.length]}`;
    document.body.append(dot);
    gsap.to(dot, {
      duration: 0.7,
      physics2D: {
        velocity: gsap.utils.random(140, 280),
        angle: gsap.utils.random(-160, -20),
        gravity: 600,
      },
      opacity: 0,
      scale: 0.4,
      ease: 'power2.in',
      onComplete: () => dot.remove(),
    });
  }
}

// A number that gives a little hop whenever it changes.
export function CountBump({ value, className }) {
  const ref = useRef(null),
    seen = useRef(value);
  useEffect(() => {
    if (seen.current === value) return;
    seen.current = value;
    if (!calm())
      gsap.fromTo(
        ref.current,
        { scale: 1.7 },
        { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.35)' },
      );
  }, [value]);
  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}

// A hand-drawn underline that draws itself when it scrolls into view.
export function Squiggle() {
  const ref = useRef(null);
  useGSAP(
    () => {
      if (calm()) return;
      gsap.from('path', {
        drawSVG: 0,
        duration: 0.6,
        ease: 'power2.inOut',
        scrollTrigger: { trigger: ref.current, start: 'top 92%', once: true },
      });
    },
    { scope: ref },
  );
  return (
    <svg ref={ref} className="squiggle" viewBox="0 0 180 14" aria-hidden="true">
      <path d="M3 8C17 1 27 14 41 8S65 1 79 8 103 14 117 8 141 1 155 8 170 13 177 7" />
    </svg>
  );
}

// Turns its contents as the section passes through the window.
export function SpinOnScroll({ className, children }) {
  const ref = useRef(null);
  useGSAP(() => {
    if (calm()) return;
    gsap.to(ref.current.firstElementChild, {
      rotation: 360,
      ease: 'none',
      scrollTrigger: {
        trigger: ref.current,
        start: 'top bottom',
        end: 'bottom top',
        scrub: 0.5,
      },
    });
  });
  return (
    <div className={className} ref={ref}>
      {children}
    </div>
  );
}

// Mouse users can grab a scrolling row and fling it. Touch keeps native scrolling.
// A stand-in element does the dragging so the row's own markup is left alone.
export function useFlingScroll() {
  const ref = useRef(null);
  useGSAP(() => {
    const row = ref.current;
    if (!row || !mouse()) return;
    row.classList.add('is-flingable');
    const [drag] = Draggable.create(document.createElement('div'), {
      trigger: row,
      type: 'x',
      inertia: !calm(),
      dragClickables: true,
      minimumMovement: 6,
      onPress() {
        gsap.killTweensOf(this.target);
        gsap.set(this.target, { x: -row.scrollLeft });
        this.applyBounds({ minX: row.clientWidth - row.scrollWidth, maxX: 0 });
        this.update();
      },
      onDrag: () => (row.scrollLeft = -drag.x),
      onThrowUpdate: () => (row.scrollLeft = -drag.x),
    });
    return () => drag.kill();
  });
  return ref;
}

// Remembers where a work's picture sat when it was clicked, so its page can
// open with the picture travelling from there.
export function rememberFlight(e, slug) {
  if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const r = (e.currentTarget.querySelector('img') || e.currentTarget).getBoundingClientRect();
  try {
    sessionStorage.setItem(
      'tg-flight',
      JSON.stringify({
        slug,
        at: Date.now(),
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      }),
    );
  } catch {}
}
export function useLanding(slug) {
  const ref = useRef(null);
  useGSAP(
    () => {
      let flight;
      try {
        flight = JSON.parse(sessionStorage.getItem('tg-flight'));
        sessionStorage.removeItem('tg-flight');
      } catch {}
      const el = ref.current;
      if (!el || !flight || flight.slug !== slug || Date.now() - flight.at > 8000 || calm()) return;
      const r = el.getBoundingClientRect(),
        scale = flight.width / r.width;
      gsap.from(el, {
        x: flight.left - r.left,
        y: flight.top + flight.height / 2 - (r.top + (r.height * scale) / 2),
        scale,
        transformOrigin: '0 0',
        opacity: 0.6,
        duration: 0.5,
        ease: 'power3.out',
        clearProps: 'transform,opacity',
      });
    },
    { dependencies: [slug] },
  );
  return ref;
}
