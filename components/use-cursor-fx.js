'use client';
import { useEffect } from 'react';
import gsap from 'gsap';

const PULL = 0.28; // how far a magnetic button leans toward the cursor
const MAX_PULL = 9; // px

// A soft blob that eases behind the cursor, swells over links and buttons, and a small
// pull on elements marked data-magnetic. Mouse and trackpad only: touch never mounts it.
export function useCursorFx({ enabled }) {
  useEffect(() => {
    if (!enabled) return;
    if (!matchMedia('(pointer: fine) and (hover: hover)').matches) return;

    const blob = document.createElement('div');
    blob.className = 'cursor-blob';
    blob.setAttribute('aria-hidden', 'true');
    document.body.appendChild(blob);

    gsap.set(blob, { xPercent: -50, yPercent: -50, opacity: 0, scale: 1 });
    const moveX = gsap.quickTo(blob, 'x', { duration: 0.45, ease: 'power3.out' });
    const moveY = gsap.quickTo(blob, 'y', { duration: 0.45, ease: 'power3.out' });
    let pulled = null;
    let shown = false;

    const settle = (el) => {
      if (el) gsap.to(el, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)', overwrite: 'auto' });
    };
    const onMove = (e) => {
      if (!shown) {
        shown = true;
        gsap.set(blob, { x: e.clientX, y: e.clientY });
        gsap.to(blob, { opacity: 1, duration: 0.3 });
      }
      moveX(e.clientX);
      moveY(e.clientY);
      const over = e.target instanceof Element ? e.target : null;
      gsap.to(blob, { scale: over?.closest('a, button') ? 2.2 : 1, duration: 0.3, overwrite: 'auto' });
      const magnet = over?.closest('[data-magnetic]') || null;
      if (pulled && pulled !== magnet) settle(pulled);
      pulled = magnet;
      if (magnet) {
        const r = magnet.getBoundingClientRect();
        const pull = (d) => gsap.utils.clamp(-MAX_PULL, MAX_PULL, d * PULL);
        gsap.to(magnet, {
          x: pull(e.clientX - (r.left + r.width / 2)),
          y: pull(e.clientY - (r.top + r.height / 2)),
          duration: 0.3,
          ease: 'power2.out',
          overwrite: 'auto',
        });
      }
    };
    const onLeave = () => {
      shown = false;
      gsap.to(blob, { opacity: 0, duration: 0.2 });
      settle(pulled);
      pulled = null;
    };

    addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      gsap.killTweensOf(blob);
      if (pulled) gsap.set(pulled, { clearProps: 'transform' });
      blob.remove();
    };
  }, [enabled]);
}
