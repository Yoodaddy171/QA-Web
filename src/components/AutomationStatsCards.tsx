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
      <Card variant="glass" padding="none" className="border-l-4 border-l-cyan-500 transition duration-300 hover:bg-cyan-500/[0.03]"><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-cyan-500/10 p-2.5 text-cyan-600 transition-transform duration-300 group-hover:scale-105 dark:text-cyan-400"><MonitorDot className="h-5 w-5" /></div><div><AnimatedNumber value={total} className="block font-mono text-2xl font-bold tabular-nums text-foreground" /><p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">Skenario Terekam</p></div></CardContent></Card>
      <Card variant="glass" padding="none" className="border-l-4 border-l-emerald-500 transition duration-300 hover:bg-emerald-500/[0.03]"><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-600 transition-transform duration-300 group-hover:scale-105 dark:text-emerald-400"><FileClock className="h-5 w-5" /></div><div><AnimatedNumber value={manual} className="block font-mono text-2xl font-bold tabular-nums text-foreground" /><p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Artefak Manual</p></div></CardContent></Card>
      <Card variant="glass" padding="none" className="border-l-4 border-l-amber-500 transition duration-300 hover:bg-amber-500/[0.03]"><CardContent className="flex items-center gap-3 p-4"><div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-600 transition-transform duration-300 group-hover:scale-105 dark:text-amber-400"><CalendarClock className="h-5 w-5" /></div><div><p className="max-w-[190px] truncate font-mono text-sm font-bold uppercase text-foreground">{lastRunAt ? new Date(lastRunAt).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Belum Ada'}</p><p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Run Terakhir</p></div></CardContent></Card>
    </div>
  );
}
