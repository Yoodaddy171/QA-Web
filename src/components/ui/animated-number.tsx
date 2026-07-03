'use client';

import { useEffect, useRef } from 'react';
import { useMotionValue, useReducedMotion, useSpring } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  className?: string;
  suffix?: string;
}

// Springy count-up for stat numbers. Renders the final value on the server
// so the number is correct without JS; the spring only runs client-side.
export function AnimatedNumber({ value, className, suffix = '' }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 110, damping: 22 });

  useEffect(() => {
    if (reduceMotion) {
      if (ref.current) ref.current.textContent = `${value}${suffix}`;
      return;
    }
    motionValue.set(value);
    const unsubscribe = spring.on('change', (latest) => {
      if (ref.current) ref.current.textContent = `${Math.round(latest)}${suffix}`;
    });
    return unsubscribe;
  }, [value, suffix, motionValue, spring, reduceMotion]);

  return (
    <span ref={ref} className={className}>
      {value}
      {suffix}
    </span>
  );
}
