'use client';

import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(useGSAP);
}

export { gsap, useGSAP };

/**
 * Trigger a celebratory particle explosion inside a container element.
 * Perfect for 100% test run pass, bug verified, or achievement celebrations.
 */
export function fireParticleCelebration(
  container: HTMLElement,
  options?: {
    particleCount?: number;
    colors?: string[];
  }
) {
  if (typeof window === 'undefined') return;
  const count = options?.particleCount ?? 32;
  const colors = options?.colors ?? ['#10B981', '#06B6D4', '#6366F1', '#F59E0B', '#3B82F6'];

  const rect = container.getBoundingClientRect();
  const originX = rect.width / 2;
  const originY = rect.height / 2;

  const particles: HTMLElement[] = [];

  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    const size = Math.random() * 6 + 4;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const isRound = Math.random() > 0.4;

    el.style.position = 'absolute';
    el.style.left = `${originX}px`;
    el.style.top = `${originY}px`;
    el.style.width = `${size}px`;
    el.style.height = `${isRound ? size : size * 2}px`;
    el.style.borderRadius = isRound ? '50%' : '2px';
    el.style.backgroundColor = color;
    el.style.pointerEvents = 'none';
    el.style.zIndex = '999';
    el.style.transform = 'translate(-50%, -50%)';

    container.appendChild(el);
    particles.push(el);

    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const distance = Math.random() * 120 + 60;
    const destX = originX + Math.cos(angle) * distance;
    const destY = originY + Math.sin(angle) * distance + (Math.random() * 40 - 20);

    gsap.fromTo(
      el,
      { scale: 0, opacity: 1 },
      {
        x: destX - originX,
        y: destY - originY,
        scale: Math.random() * 0.8 + 0.6,
        rotation: Math.random() * 360,
        opacity: 0,
        duration: Math.random() * 0.5 + 0.65,
        ease: 'power2.out',
        onComplete: () => {
          el.remove();
        },
      }
    );
  }
}

/**
 * Trigger an impactful verdict stamp animation on an element.
 */
export function playVerdictStamp(
  element: HTMLElement,
  options?: {
    scaleStart?: number;
    rotationStart?: number;
  }
) {
  if (typeof window === 'undefined') return;
  const tl = gsap.timeline();
  tl.fromTo(
    element,
    {
      scale: options?.scaleStart ?? 1.45,
      rotation: options?.rotationStart ?? -6,
      opacity: 0.4,
    },
    {
      scale: 1,
      rotation: 0,
      opacity: 1,
      duration: 0.28,
      ease: 'back.out(2)',
    }
  );
  return tl;
}
