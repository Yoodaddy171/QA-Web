import { Command } from 'lucide-react';

interface BrandMarkProps {
  compact?: boolean;
}

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <div className={`group/brand flex cursor-default items-center ${compact ? 'gap-0' : 'gap-2.5'}`}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-transform duration-500 group-hover/brand:rotate-[360deg] motion-reduce:group-hover/brand:rotate-0">
        <Command className="h-4.5 w-4.5" strokeWidth={2.25} />
      </div>

      <div className={compact
        ? 'flex max-w-0 translate-x-1 flex-col overflow-hidden opacity-0 transition-[opacity,transform] duration-[var(--motion-duration)] ease-[var(--motion-ease)] motion-reduce:transition-none'
        : 'flex max-w-24 translate-x-0 flex-col opacity-100 transition-[opacity,transform] duration-[var(--motion-duration)] ease-[var(--motion-ease)] motion-reduce:transition-none'
      }>
        <span className="text-sm font-bold tracking-tight text-sidebar-foreground leading-none">
          QADesk
        </span>
        <span className="text-[10px] font-medium tracking-wider text-sidebar-foreground/55 uppercase mt-0.5 leading-none">
          Console
        </span>
      </div>
    </div>
  );
}
