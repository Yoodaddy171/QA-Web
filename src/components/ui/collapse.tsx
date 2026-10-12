'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Instant collapse/expand for large sections.
 *
 * The CSS grid track switches between `0fr` and `1fr` without interpolation.
 * The wrapper hides
 * overflow so content is clipped while collapsed.
 *
 * Children stay mounted (hidden via the collapsed grid track) so they can
 * preserve their state. Inert prevents focus reaching collapsed controls.
 */
export interface CollapseProps extends React.HTMLAttributes<HTMLDivElement> {
  open: boolean;
  /** Inner wrapper className (the clipped region). */
  innerClassName?: string;
}

export function Collapse({ open, className, innerClassName, children, ...props }: CollapseProps) {
  return (
    <div
      {...props}
      inert={!open}
      aria-hidden={!open}
      className={cn(
        'grid',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        className,
      )}
    >
      <div className={cn('min-h-0 overflow-hidden', innerClassName)}>{children}</div>
    </div>
  );
}
