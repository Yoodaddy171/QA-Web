import { Command } from 'lucide-react';

interface BrandMarkProps {
  compact?: boolean;
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-2.5 hover:opacity-80 transition-opacity cursor-default">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground elevation-1">
        <Command className="h-4.5 w-4.5" strokeWidth={2.5} />
      </div>

      {!compact && (
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-foreground leading-none">
            QADesk
          </span>
          <span className="text-[10px] font-medium text-muted-foreground mt-0.5 leading-none">
            Workspace
          </span>
        </div>
      )}
    </div>
  );
}
