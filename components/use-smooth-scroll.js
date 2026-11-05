'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { pinMode } from '../lib/intro-story.mjs';

// Eased wheel/touch scrolling for the home page. Lenis is driven by gsap's ticker so the
// pinned story and the smoothed scroll share one clock, and it is stopped while a dialog is
// open so the page behind it cannot move. Keyboard, hash links and scrollTo stay native.
export function useSmoothScroll({ enabled, paused }) {
  const lenis = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    // Same device gate as the pinned story: low-power phones keep plain native scrolling.
    const device = pinMode({
      reduceMotion: false,
      motion: true,
      coarsePointer: matchMedia('(pointer: coarse)').matches,
      cores: navigator.hardwareConcurrency,
      memory: navigator.deviceMemory,
    });
    if (device !== 'pinned') return;
    gsap.registerPlugin(ScrollTrigger);
    const instance = new Lenis({ autoRaf: false, anchors: true, lerp: 0.1 });
    lenis.current = instance;
    instance.on('scroll', ScrollTrigger.update);
    const tick = (time) => instance.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      gsap.ticker.lagSmoothing(500, 33);
      instance.destroy();
      lenis.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    const instance = lenis.current;
    if (!instance) return;
    if (paused) instance.stop();
    else instance.start();
  }, [paused, enabled]);
}
