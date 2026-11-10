'use client';

import { CircleX, Globe, Info, ListChecks, Terminal, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { DevLogTab } from '@/components/TestCaseDetailDialog.helpers';
import type { DevtoolsConsoleLevel } from '@/lib/client/automation/devtools-console';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'execution', label: 'Execution', icon: ListChecks, active: 'border-violet-300 bg-violet-100 text-violet-900 hover:bg-violet-100 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-200 dark:hover:bg-violet-950' },
  { id: 'console', label: 'Console', icon: Terminal, active: 'border-sky-300 bg-sky-100 text-sky-900 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950 dark:text-sky-200 dark:hover:bg-sky-950' },
  { id: 'network', label: 'Network', icon: Globe, active: 'border-teal-300 bg-teal-100 text-teal-900 hover:bg-teal-100 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-200 dark:hover:bg-teal-950' },
] as const;

export function DevlogTabs({ active, onChange, counts, className }: {
  active: DevLogTab;
  onChange: (tab: DevLogTab) => void;
  counts?: Partial<Record<DevLogTab, number>>;
  className?: string;
}) {
  return <div role="group" aria-label="Devlog views" className={cn('grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/45 p-1', className)}>
    {tabs.map(({ id, label, icon: Icon, active: activeClass }) => (
      <Button key={id} type="button" size="sm" variant="ghost" aria-pressed={active === id} aria-label={label}
        onClick={() => onChange(id)}
        className={cn('relative h-9 min-w-0 justify-center gap-1.5 rounded-md border border-transparent px-2 text-xs font-semibold sm:px-3',
          'after:pointer-events-none after:absolute after:inset-x-2.5 after:bottom-0 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:bg-current after:opacity-0 aria-pressed:after:scale-x-100 aria-pressed:after:opacity-100 motion-safe:after:transition-[scale,opacity] motion-safe:after:duration-[var(--motion-fast)] motion-safe:after:ease-[var(--motion-ease)] motion-reduce:after:scale-x-100',
          active === id ? activeClass : 'text-muted-foreground hover:bg-background hover:text-foreground')}>
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{label}</span>
        {counts?.[id] !== undefined && <span className="hidden rounded bg-background/70 px-1.5 text-[11px] tabular-nums sm:inline">{counts[id]}</span>}
      </Button>
    ))}
  </div>;
}

export function DevlogEmptyState({ kind, title, hint }: { kind: DevLogTab; title: string; hint?: string }) {
  const Icon = tabs.find(tab => tab.id === kind)?.icon ?? ListChecks;
  return <div className="flex min-h-32 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
    <span className={cn('grid size-9 place-items-center rounded-lg',
      kind === 'network' ? 'bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200'
        : kind === 'console' ? 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200'
          : 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200')}>
      <Icon className="size-4" aria-hidden="true" />
    </span>
    <p className="text-sm font-medium text-foreground">{title}</p>
    {hint && <p className="max-w-64 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
  </div>;
}

const consoleIcons = {
  error: { icon: CircleX, tone: 'text-rose-800 dark:text-rose-200', label: 'Error' },
  warning: { icon: TriangleAlert, tone: 'text-amber-800 dark:text-amber-200', label: 'Warning' },
  info: { icon: Info, tone: 'text-sky-800 dark:text-sky-200', label: 'Info' },
  verbose: { icon: Terminal, tone: 'text-muted-foreground', label: 'Verbose' },
};

export function DevlogConsoleLevelIcon({ level }: { level: DevtoolsConsoleLevel }) {
  const { icon: Icon, tone, label } = consoleIcons[level];
  return <span className={cn('grid size-4 shrink-0 place-items-center', tone)} title={label}>
    <Icon className="size-3.5" aria-hidden="true" /><span className="sr-only">{label}</span>
  </span>;
}
