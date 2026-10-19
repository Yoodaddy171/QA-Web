'use client';

import { CalendarClock, FileClock, MonitorDot } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Card, CardContent } from '@/components/ui/card';

interface AutomationStatsCardsProps {
  total: number;
  manual: number;
  lastRunAt?: string | null;
}

export function AutomationStatsCards({ total, manual, lastRunAt }: AutomationStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <Card padding="none" className="border-border bg-card shadow-none"><CardContent className="flex min-w-0 items-center gap-3 p-4"><div className="rounded-lg bg-secondary p-2.5 text-status-retest"><MonitorDot className="size-5" /></div><div className="min-w-0"><AnimatedNumber value={total} className="block text-2xl font-semibold tabular-nums text-foreground" /><p className="qa-module-meta mt-1">Skenario Terekam</p></div></CardContent></Card>
      <Card padding="none" className="border-border bg-card shadow-none"><CardContent className="flex min-w-0 items-center gap-3 p-4"><div className="rounded-lg bg-secondary p-2.5 text-status-passed"><FileClock className="size-5" /></div><div className="min-w-0"><AnimatedNumber value={manual} className="block text-2xl font-semibold tabular-nums text-foreground" /><p className="qa-module-meta mt-1">Artefak Manual</p></div></CardContent></Card>
      <Card padding="none" className="border-border bg-card shadow-none"><CardContent className="flex min-w-0 items-center gap-3 p-4"><div className="rounded-lg bg-secondary p-2.5 text-status-blocked"><CalendarClock className="size-5" /></div><div className="min-w-0"><p className="break-words text-sm font-semibold tabular-nums text-foreground">{lastRunAt ? new Date(lastRunAt).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Belum Ada'}</p><p className="qa-module-meta mt-1">Run Terakhir</p></div></CardContent></Card>
    </div>
  );
}
