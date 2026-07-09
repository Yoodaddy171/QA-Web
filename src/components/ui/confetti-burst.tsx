'use client';

import { motion, useReducedMotion } from 'framer-motion';

const CONFETTI_COLORS = ['#818cf8', '#34d399', '#fbbf24', '#f472b6', '#38bdf8'];

interface ConfettiBurstProps {
  /** Particle travel radius in px. */
  radius?: number;
  /** Number of particles. */
  count?: number;
}

// One-shot radial confetti burst, absolutely positioned to fill its
// nearest relative parent. Renders nothing under prefers-reduced-motion.
export function ConfettiBurst({ radius = 70, count = 18 }: ConfettiBurstProps) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-visible" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-sm"
            style={{ backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length] }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
            animate={{
              x: Math.cos(angle) * (radius + (i % 3) * (radius / 3)),
              y: Math.sin(angle) * (radius + (i % 3) * (radius / 3)),
              scale: 0,
              opacity: 0,
              rotate: 180 + i * 24,
            }}
            transition={{ duration: 0.8 + (i % 4) * 0.12, ease: 'easeOut' }}
          />
        );
      })}
    </div>
  );
}
