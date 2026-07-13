'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * GPU-friendly collapse/expand.
 *
 * Instead of animating `height` (which reflows every frame), this animates the
 * CSS grid track between `0fr` and `1fr`. The browser composites this far more
 * cheaply, so open/close stays smooth at 60fps. The inner wrapper hides
 * overflow so content is clipped while collapsed.
 *
 * Children stay mounted (hidden via the collapsed grid track) so they can
 * animate in both directions with no layout thrash and no extra state.
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
      className={cn(
        'grid transition-[grid-template-rows] motion-reduce:transition-none',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        className,
      )}
    >
      <div className={cn('min-h-0 overflow-hidden', innerClassName)}>{children}</div>
    </div>
  );
}
