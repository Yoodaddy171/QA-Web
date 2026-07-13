'use client';

import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type ExecutionLogViewProps = {
  stepLogs?: string | null;
  logEndRef: React.RefObject<HTMLDivElement | null>;
};

export function ExecutionLogView({ stepLogs, logEndRef }: ExecutionLogViewProps) {
  return (
    <div className="p-5 space-y-0.5">
      {stepLogs ? (
        stepLogs.split('\n').map((line, index) => {
          if (!line.trim()) return null;
          const isError = line.toLowerCase().includes('error') || line.toLowerCase().includes('fail');
          const isWarning = line.toLowerCase().includes('warn');
          const isInfo = line.toLowerCase().includes('info') || line.toLowerCase().includes('step');

          return (
            <div key={`${index}-${line}`} className="flex gap-4 rounded px-2 py-0.5 transition-colors hover:bg-secondary/60 dark:hover:bg-white/5 group">
              <span className="min-w-[24px] select-none text-right font-bold text-muted-foreground opacity-60 group-hover:opacity-100">{index + 1}</span>
              <span className={cn(isError ? 'text-rose-700 font-bold dark:text-rose-400' : isWarning ? 'text-amber-700 dark:text-amber-400' : isInfo ? 'text-cyan-700 dark:text-cyan-400' : 'text-emerald-700 dark:text-emerald-400/90')}>
                {line}
              </span>
            </div>
          );
        })
      ) : (
        <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Clock className="w-8 h-8 mb-3 opacity-20" />
          <p className="font-bold tracking-wider text-[10px] uppercase">Awaiting Execution Trace...</p>
        </div>
      )}
      <div ref={logEndRef} className="h-8" />
    </div>
  );
}
