import { useId } from 'react';

interface BrandMarkProps {
  compact?: boolean;
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  const clipId = useId();
  return (
    <span role="img" aria-label="Traceva" className="inline-flex shrink-0 items-center gap-1.5">
      <svg aria-hidden="true" viewBox="45 365 430 355" className="size-9 shrink-0" focusable="false">
        <defs><clipPath id={clipId}><polygon points="0,0 1448,0 1448,458 435,458 435,1086 0,1086" /></clipPath></defs>
        <image href="/traceva-logo.png" width="1448" height="1086" clipPath={`url(#${clipId})`} />
      </svg>
      {!compact && (
        <svg aria-hidden="true" viewBox="438 465 970 220" className="h-7 w-[7.75rem] dark:brightness-0 dark:invert" focusable="false">
          <image href="/traceva-logo.png" width="1448" height="1086" />
        </svg>
      )}
    </span>
  );
}
