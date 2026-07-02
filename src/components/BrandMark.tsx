import { Command } from 'lucide-react';

interface BrandMarkProps {
  compact?: boolean;
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className="flex items-center gap-2.5 group cursor-default transition-all duration-200">
      <div className="relative flex h-9.5 w-9.5 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-cyan-500 to-indigo-600 text-white shadow-md shadow-primary/20 transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3">
        <Command className="h-5 w-5" strokeWidth={2.5} />
        <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>

      {!compact && (
        <div className="flex flex-col">
          <span className="text-sm font-extrabold tracking-tight bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent leading-none">
            QADesk
          </span>
          <span className="text-[10px] font-semibold tracking-wider text-muted-foreground/85 uppercase mt-0.5 leading-none">
            Console
          </span>
        </div>
      )}
    </div>
  );
}
