import { Command } from 'lucide-react';

interface BrandMarkProps {
  compact?: boolean;
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-2.5 cursor-default">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Command className="h-4.5 w-4.5" strokeWidth={2.25} />
      </div>

      {!compact && (
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight text-foreground leading-none">
            QADesk
          </span>
          <span className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase mt-0.5 leading-none">
            Console
          </span>
        </div>
      )}
    </div>
  );
}
