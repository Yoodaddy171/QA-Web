'use client';
import { useMemo, useState } from 'react';
import { executionTimeline, executionTime } from './execution-timeline';

import {
  CheckSquare2,
  Clock,
  CornerDownRight,
  ListFilter,
  MousePointerClick,
  Navigation,
  Radio,
  Send,
  TextCursorInput,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  getExecutionInteraction,
  getExecutionLogText,
  type LogEntry,
} from '@/components/TestCaseDetailDialog.helpers';
import { cn } from '@/lib/utils';

type ExecutionLogViewProps = {
  stepLogs?: string | null;
  logs?: LogEntry[];
  logEndRef?: React.RefObject<HTMLDivElement | null>;
  formatRelativeTime?: (relativeMs?: number) => string;
  formatLogTime?: (log: LogEntry) => string;
  onSelectLog?: (log: LogEntry) => void;
  compact?: boolean;
  evidenceLogs?: LogEntry[];
};

const interactionIcons: Record<string, LucideIcon> = {
  click: MousePointerClick,
  link: CornerDownRight,
  navigation: Navigation,
  input: TextCursorInput,
  select: ListFilter,
  checkbox: CheckSquare2,
  radio: Radio,
  submit: Send,
};

export function ExecutionLogView({
  stepLogs,
  logs = [],
  logEndRef,
  formatLogTime,
  onSelectLog,
  compact = false,
  evidenceLogs = [],
}: ExecutionLogViewProps) {
  const [raw, setRaw] = useState(false);
  const timeline = useMemo(() => executionTimeline(logs, evidenceLogs, raw), [logs, evidenceLogs, raw]);
  const fallbackLines = logs.length === 0
    ? String(stepLogs || '').split('\n').map(line => line.trim()).filter(Boolean)
    : [];

  return (
    <div className={cn('space-y-2', compact ? 'p-3' : 'p-5')}>
      {logs.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 text-xs text-muted-foreground">
        <p>{timeline.rows.length} aktivitas · {timeline.merged} ketikan digabung · {timeline.hidden} navigasi blank disembunyikan</p>
        <button type="button" aria-pressed={raw} onClick={() => setRaw(!raw)} className="min-h-9 rounded px-2 text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring">{raw ? 'Tampilkan ringkasan' : 'Tampilkan semua event'}</button>
      </div>}
      {logs.length > 0 ? (
        timeline.rows.map(({ log, count, derivedTime, late, network }, index) => {
          const interaction = getExecutionInteraction(log);
          const interactionType = String(interaction?.type || log.eventType || 'step').toLowerCase();
          const Icon = interactionIcons[interactionType] || Clock;
          const message = getExecutionLogText(log);
          const isLifecycle = log.eventType === 'run.started' || log.eventType === 'run.finished';

          return (
            <div key={log.eventId || log.id || `${index}-${message}`} className="border-b border-border pb-2">
            <button
              key={log.eventId || log.id || `${index}-${message}`}
              type="button"
              className={cn(
                'group grid w-full grid-cols-[32px_minmax(0,1fr)] items-start gap-3 rounded-lg bg-background px-3 py-2.5 text-left transition-colors hover:bg-secondary/50 focus-visible:outline-2 focus-visible:outline-ring dark:hover:bg-white/5',
                isLifecycle && 'border-teal-200 bg-teal-50/60 dark:border-teal-500/20 dark:bg-teal-950/20',
                !onSelectLog && 'cursor-default'
              )}
              disabled={!onSelectLog || log.relativeMs === undefined}
              title={log.relativeMs === undefined ? 'Tidak ada waktu untuk sinkronisasi video' : 'Pilih aktivitas dan arahkan rekaman ke waktu ini (jika tersedia)'}
              onClick={() => onSelectLog?.(log)}
            >
              <span className={cn(
                'flex h-8 w-8 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200',
                isLifecycle && 'border-teal-200 bg-teal-100 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/15 dark:text-teal-200'
              )}>
                <Icon className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block break-words text-sm font-medium leading-relaxed text-foreground">
                  {message}
                </span>
                <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{interactionType.replace(/[._-]+/g, ' ')}</span>
                  <span className="font-mono tabular-nums">{executionTime(log.relativeMs)}{derivedTime ? ' · dari timestamp' : ''}</span>
                  {onSelectLog && log.relativeMs !== undefined && <span className="underline underline-offset-4">Ke waktu rekaman{formatLogTime ? ` · ${formatLogTime(log)}` : ''}</span>}
                  {count > 1 && <span>{count} perubahan input</span>}
                  {late && <span>Setelah capture berhenti</span>}
                </span>
              </span>
            </button>
            {network.length > 0 && <details className="px-3 pb-2 text-xs">
              <summary className="cursor-pointer py-2 text-foreground focus-visible:outline-2 focus-visible:outline-ring">{network.length} event network di sekitar aktivitas</summary>
              <p className="pb-2 text-muted-foreground">Dalam 3 detik setelah aktivitas; kedekatan waktu bukan bukti sebab-akibat.</p>
              <ul className="space-y-2">{network.map((entry, i) => <li key={entry.eventId || i} className="break-all">
                <span className="font-mono">{executionTime(entry.relativeMs)} · {entry.network?.method} · {entry.network?.event} {entry.network?.status ?? ''}</span>
                <p>{entry.network?.url}</p>
                <details><summary className="cursor-pointer py-2">Detail request / response</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-3">{JSON.stringify(entry.network?.data ?? {}, null, 2)}</pre></details>
              </li>)}</ul>
            </details>}
            </div>
          );
        })
      ) : fallbackLines.length > 0 ? (
        fallbackLines.map((line, index) => {
          const normalized = line.toLowerCase();
          const isError = normalized.includes('error') || normalized.includes('fail');
          const isWarning = normalized.includes('warn');
          return (
            <div key={`${index}-${line}`} className="flex gap-4 rounded px-2 py-1 transition-colors hover:bg-secondary/60 dark:hover:bg-white/5">
              <span className="min-w-[24px] select-none text-right font-bold text-muted-foreground opacity-60">{index + 1}</span>
              <span className={cn(isError ? 'font-bold text-rose-700 dark:text-rose-400' : isWarning ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400/90')}>
                {line}
              </span>
            </div>
          );
        })
      ) : (
        <div className="h-full flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Clock className="w-8 h-8 mb-3 opacity-20" />
          <p className="font-bold tracking-wider text-[10px] uppercase">Menunggu interaksi pengguna...</p>
        </div>
      )}
      <div ref={logEndRef} className="h-8" />
    </div>
  );
}
