'use client';

import { ReactLenis } from 'lenis/react';
import { type ReactNode, useEffect, useState } from 'react';
import { isMotionAllowed } from '@/lib/client/gsap-motion';
import 'lenis/dist/lenis.css';

export interface SmoothScrollProviderProps {
  children: ReactNode;
}

export function SmoothScrollProvider({ children }: SmoothScrollProviderProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Only activate in browser environment when reduced motion is not requested
    if (isMotionAllowed()) {
      setMounted(true);
    }
  }, []);

  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ReactLenis
      root
      options={{
        lerp: 0.075, // Memberikan bobot inersia yang mantap dan terasa berat-mewah
        wheelMultiplier: 0.85, // Tahanan roda mouse stabil agar tidak melompat
        touchMultiplier: 1.0,
        infinite: false,
        syncTouch: false, // Menjaga scroll sentuh mobile tetap natural bawaan OS
        prevent: (node) => {
          if (!node || typeof (node as HTMLElement).closest !== 'function') return false;
          // Jangan cegah scroll native di tabel, modal, dropdown, atau kontainer data
          return Boolean(
            (node as HTMLElement).hasAttribute?.('data-lenis-prevent') ||
            (node as HTMLElement).closest('[data-lenis-prevent]') ||
            (node as HTMLElement).closest('[data-slot="table-container"]') ||
            (node as HTMLElement).closest('[role="region"]') ||
            (node as HTMLElement).closest('table')
          );
        },
      }}
    >
      {children}
    </ReactLenis>
  );
}
