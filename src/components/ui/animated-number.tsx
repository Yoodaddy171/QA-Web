'use client';

import React, { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';
import { gsap, useGSAP } from '@/lib/client/gsap-motion';

interface AnimatedNumberProps {
  value: number;
  className?: string;
  suffix?: string;
}

export function AnimatedNumber({ value, className, suffix = '' }: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const countRef = useRef({ val: 0 });
  const reduceMotion = useReducedMotion();

  useGSAP(() => {
    if (reduceMotion) {
      if (ref.current) ref.current.textContent = `${value}${suffix}`;
      countRef.current.val = value;
      return;
    }

    gsap.to(countRef.current, {
      val: value,
      duration: 0.65,
      ease: 'power2.out',
      onUpdate: () => {
        if (ref.current) {
          ref.current.textContent = `${Math.round(countRef.current.val)}${suffix}`;
        }
      },
    });
  }, [value, suffix, reduceMotion]);

  useEffect(() => {
    if (ref.current && reduceMotion) {
      ref.current.textContent = `${value}${suffix}`;
    }
  }, [value, suffix, reduceMotion]);

  return (
    <span ref={ref} className={className}>
      {value}
      {suffix}
    </span>
  );
}
