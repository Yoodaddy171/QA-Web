'use client';

import { useEffect, type RefObject } from 'react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { Flip } from 'gsap/Flip';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { MorphSVGPlugin } from 'gsap/MorphSVGPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import { Physics2DPlugin } from 'gsap/Physics2DPlugin';
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin';
import { SplitText } from 'gsap/SplitText';
import { CustomEase } from 'gsap/CustomEase';
import { CustomBounce } from 'gsap/CustomBounce';
import { CustomWiggle } from 'gsap/CustomWiggle';

let pluginsRegistered = false;

export function ensureGsapPlugins() {
  if (typeof window === 'undefined' || pluginsRegistered) return;
  gsap.registerPlugin(
    useGSAP,
    Flip,
    DrawSVGPlugin,
    MorphSVGPlugin,
    MotionPathPlugin,
    Physics2DPlugin,
    ScrambleTextPlugin,
    SplitText,
    CustomEase,
    CustomBounce,
    CustomWiggle
  );

  CustomWiggle.create('qaAlertWiggle', { wiggles: 6, type: 'easeOut' });
  CustomWiggle.create('qaFailShake', { wiggles: 5, type: 'anticipate' });
  CustomBounce.create('qaStampBounce', {
    strength: 0.5,
    squash: 2,
    squashID: 'qaStampBounce-squash',
  });

  pluginsRegistered = true;
}

if (typeof window !== 'undefined') {
  ensureGsapPlugins();
}

export {
  gsap,
  useGSAP,
  Flip,
  DrawSVGPlugin,
  MorphSVGPlugin,
  MotionPathPlugin,
  Physics2DPlugin,
  ScrambleTextPlugin,
  SplitText,
  CustomEase,
  CustomBounce,
  CustomWiggle,
};

/**
 * Returns true only in a real browser environment when prefers-reduced-motion is not enabled.
 * Safely skips imperative GSAP mutations in JSDOM unit tests and reduced-motion OS settings.
 */
export function isMotionAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent || '')) {
    return false;
  }
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return false;
  }
  return true;
}

/**
 * Celebratory 2D physics particle burst using GSAP Physics2DPlugin.
 * Launches confetti/sparks with authentic velocity, launch angle, and gravity.
 */
export function fireParticleCelebration(
  container: HTMLElement,
  options?: {
    particleCount?: number;
    colors?: string[];
    originX?: number;
    originY?: number;
    gravity?: number;
  }
) {
  if (!isMotionAllowed()) return;
  ensureGsapPlugins();

  const count = options?.particleCount ?? 36;
  const colors = options?.colors ?? ['#10B981', '#06B6D4', '#6366F1', '#F59E0B', '#3B82F6'];
  const rect = container.getBoundingClientRect();
  const originX = options?.originX ?? rect.width / 2;
  const originY = options?.originY ?? rect.height / 2;
  const gravity = options?.gravity ?? 440;

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    const size = Math.random() * 6 + 4;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const shapeRoll = Math.random();

    el.style.position = 'absolute';
    el.style.left = `${originX}px`;
    el.style.top = `${originY}px`;
    el.style.width = `${size}px`;
    el.style.height = `${shapeRoll > 0.45 ? size : size * 2.2}px`;
    el.style.borderRadius = shapeRoll > 0.45 ? '50%' : '2px';
    el.style.backgroundColor = color;
    el.style.pointerEvents = 'none';
    el.style.zIndex = '999';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.boxShadow = `0 0 6px ${color}66`;

    container.appendChild(el);

    const launchAngle = -145 + Math.random() * 110;
    const velocity = 140 + Math.random() * 190;

    gsap.fromTo(
      el,
      { scale: 0, opacity: 1 },
      {
        physics2D: {
          velocity,
          angle: launchAngle,
          gravity,
          friction: 0.015,
        },
        scale: Math.random() * 0.85 + 0.55,
        rotation: (Math.random() - 0.5) * 540,
        opacity: 0,
        duration: 0.85 + Math.random() * 0.45,
        ease: 'none',
        onComplete: () => {
          el.remove();
        },
      }
    );
  }
}

/**
 * Tactile verdict stamp animation using GSAP CustomBounce & CustomWiggle.
 * - PASSED / DONE: Squash-and-stretch impact stamp.
 * - FAILED / BLOCKED: Anticipate warning shake.
 * - RETEST / DEFAULT: Snappy elastic pop.
 */
export function playVerdictStamp(
  element: HTMLElement,
  options?: {
    verdict?: string;
    scaleStart?: number;
    rotationStart?: number;
  }
) {
  if (!isMotionAllowed()) return;
  ensureGsapPlugins();

  const normalized = (options?.verdict || '').toUpperCase();
  const tl = gsap.timeline();

  if (normalized === 'FAILED' || normalized === 'BLOCKED') {
    tl.fromTo(
      element,
      { x: 0, scale: 1.03 },
      {
        x: 7,
        scale: 1,
        duration: 0.36,
        ease: 'qaFailShake',
        clearProps: 'x,scale',
      }
    );
    return tl;
  }

  if (normalized === 'PASSED' || normalized === 'DONE') {
    tl.fromTo(
      element,
      {
        scaleX: 1.28,
        scaleY: 0.76,
        rotation: options?.rotationStart ?? -5,
        opacity: 0.55,
      },
      {
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        opacity: 1,
        duration: 0.34,
        ease: 'back.out(2.4)',
        clearProps: 'scaleX,scaleY,rotation,opacity',
      }
    );
    return tl;
  }

  tl.fromTo(
    element,
    {
      scale: options?.scaleStart ?? 1.38,
      rotation: options?.rotationStart ?? -6,
      opacity: 0.45,
    },
    {
      scale: 1,
      rotation: 0,
      opacity: 1,
      duration: 0.28,
      ease: 'back.out(2.1)',
      clearProps: 'scale,rotation,opacity',
    }
  );
  return tl;
}

/**
 * Ring the notification bell icon with CustomWiggle physics.
 */
export function playBellWiggle(element: HTMLElement | SVGSVGElement | null) {
  if (!element || !isMotionAllowed()) return;
  ensureGsapPlugins();
  gsap.fromTo(
    element,
    { rotation: 0, transformOrigin: '50% 12%' },
    {
      rotation: 18,
      duration: 0.55,
      ease: 'qaAlertWiggle',
      clearProps: 'rotation',
    }
  );
}

/**
 * Decode technical IDs or status verdicts using GSAP ScrambleTextPlugin.
 */
export function scrambleDecodeText(
  element: HTMLElement | null,
  finalText: string,
  options?: {
    duration?: number;
    chars?: string;
  }
) {
  if (!element) return;
  if (!isMotionAllowed()) {
    element.textContent = finalText;
    return;
  }
  ensureGsapPlugins();
  gsap.to(element, {
    duration: options?.duration ?? 0.42,
    scrambleText: {
      text: finalText,
      chars: options?.chars ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-/',
      speed: 0.7,
      revealDelay: 0.04,
    },
    ease: 'none',
  });
}

/**
 * Hook: Magnetic pull effect on buttons and interactive icons using gsap.quickTo.
 */
export function useMagneticHover<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options?: { strength?: number; maxShift?: number; enabled?: boolean }
) {
  const strength = options?.strength ?? 0.26;
  const maxShift = options?.maxShift ?? 5;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || !isMotionAllowed()) return;

    const xTo = gsap.quickTo(el, 'x', { duration: 0.3, ease: 'power3.out' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.3, ease: 'power3.out' });

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const relX = e.clientX - (rect.left + rect.width / 2);
      const relY = e.clientY - (rect.top + rect.height / 2);
      const shiftX = Math.max(-maxShift, Math.min(maxShift, relX * strength));
      const shiftY = Math.max(-maxShift, Math.min(maxShift, relY * strength));
      xTo(shiftX);
      yTo(shiftY);
    };

    const onLeave = () => {
      gsap.to(el, {
        x: 0,
        y: 0,
        duration: 0.45,
        ease: 'elastic.out(1, 0.35)',
        overwrite: 'auto',
      });
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      gsap.set(el, { clearProps: 'x,y' });
    };
  }, [ref, strength, maxShift, enabled]);
}

/**
 * Hook: Interactive 3D perspective tilt on KPI / Metric cards using gsap.quickTo.
 */
export function useCardTilt3D<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options?: { maxDeg?: number; enabled?: boolean }
) {
  const maxDeg = options?.maxDeg ?? 4.2;
  const enabled = options?.enabled ?? true;

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || !isMotionAllowed()) return;

    gsap.set(el, { transformPerspective: 800, transformStyle: 'preserve-3d' });
    const rotXTo = gsap.quickTo(el, 'rotationX', { duration: 0.35, ease: 'power2.out' });
    const rotYTo = gsap.quickTo(el, 'rotationY', { duration: 0.35, ease: 'power2.out' });

    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const normX = (e.clientX - rect.left) / rect.width - 0.5;
      const normY = (e.clientY - rect.top) / rect.height - 0.5;
      rotYTo(normX * maxDeg * 2);
      rotXTo(-normY * maxDeg * 2);
    };

    const onLeave = () => {
      rotXTo(0);
      rotYTo(0);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      gsap.set(el, { clearProps: 'rotationX,rotationY,transformPerspective,transformStyle' });
    };
  }, [ref, maxDeg, enabled]);
}
