'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type ConsoleLogViewProps = Record<string, any>;

export function ConsoleLogView(props: ConsoleLogViewProps) {
  const {
    groupedConsoleLogs, logEndRef, expandedLogId, setExpandedLogId,
    seekRecordingFromLog, formatRelativeTime, getConsoleLogText, formatPrettyValue,
  } = props;

  return (
    <div className="divide-y divide-border">
      {groupedConsoleLogs.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Clock className="w-8 h-8 mb-3 opacity-20" />
          <p className="font-bold tracking-wider text-[10px] uppercase">Awaiting Console Output...</p>
        </div>
      ) : (
        groupedConsoleLogs.map((group: any) => {
          const { log, entries, count } = group;
          const logId = group.id;
          const isError = entries.some((entry: any) => entry.level === 'SEVERE' || entry.log?.toString().toLowerCase().includes('error'));
          const isWarning = entries.some((entry: any) => entry.level === 'WARNING' || entry.log?.toString().toLowerCase().includes('warn'));
          const canExpand = count > 1 || typeof log.log === 'object';

          return (
            <div key={logId} className={cn('group', isError ? 'bg-rose-50 dark:bg-rose-950/20' : isWarning ? 'bg-amber-50 dark:bg-amber-950/20' : 'hover:bg-secondary/60 dark:hover:bg-white/5')}>
              <div
                className="flex items-start gap-3 p-2 cursor-pointer transition-colors"
                onClick={() => {
                  seekRecordingFromLog(log);
                  setExpandedLogId(expandedLogId === logId ? null : logId);
                }}
              >
                <span className="text-muted-foreground text-[10px] min-w-[60px] pt-0.5">
                  {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('id-ID', { hour12: false }) : '-'}
                </span>
                {typeof log.relativeMs === 'number' && (
                  <span className="mt-0.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                    {formatRelativeTime(log.relativeMs)}
                  </span>
                )}
                <div className="flex-1 break-all">
                  <span className={cn(isError ? 'text-rose-700 dark:text-rose-400' : isWarning ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400/90')}>
                    {typeof log.log === 'object' ? `${JSON.stringify(log.log).substring(0, 200)}...` : String(log.log ?? '')}
                  </span>
                </div>
                {count > 1 && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-950/60 dark:text-indigo-200">x{count}</span>}
                {canExpand && <ChevronDown className={cn('w-3.5 h-3.5 text-muted-foreground transition-transform', expandedLogId === logId && 'rotate-180')} />}
              </div>
              <AnimatePresence>
                {expandedLogId === logId && canExpand && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                    <div className="space-y-3 px-10 pb-3">
                      {count > 1 && (
                        <div className="rounded-lg border border-border bg-background p-2 dark:bg-card/70">
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Repeated {count} times</p>
                          <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                            {entries.map((entry: any, entryIndex: number) => (
                              <button key={entry.id ?? `${logId}-repeat-${entryIndex}`} type="button" className="grid w-full grid-cols-[54px_70px_1fr] gap-2 rounded-md border border-border bg-muted/40 px-2 py-1 text-left text-[10px] hover:bg-secondary" onClick={() => seekRecordingFromLog(entry)}>
                                <span className="font-semibold text-muted-foreground">#{entryIndex + 1}</span>
                                <span className="font-mono text-indigo-700 dark:text-indigo-300">{formatRelativeTime(entry.relativeMs)}</span>
                                <span className="truncate text-foreground">{getConsoleLogText(entry)}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="bg-muted rounded-lg p-3 border border-border shadow-inner">
                        <pre className="text-emerald-700 whitespace-pre-wrap overflow-x-auto dark:text-emerald-500/80">{formatPrettyValue(log.log)}</pre>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })
      )}
      <div ref={logEndRef} className="h-4" />
    </div>
  );
}
