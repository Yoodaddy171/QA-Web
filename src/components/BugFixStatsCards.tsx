'use client';

import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Card, CardContent } from '@/components/ui/card';

interface BugFixStats {
  bugFixReported: number;
  bugFixFixing: number;
  bugFixReadyRetest: number;
  bugFixFixed: number;
}

export function BugFixStatsCards({ stats }: { stats: BugFixStats }) {
  const cards = [
    { value: stats.bugFixReported, label: 'Reported', card: 'border-l-orange-500 hover:bg-orange-500/[0.03]', iconBox: 'bg-orange-500/10 dark:bg-orange-500/15', iconColor: 'text-orange-600 dark:text-orange-400', icon: AlertTriangle },
    { value: stats.bugFixFixing, label: 'Fixing', card: 'border-l-amber-500 hover:bg-amber-500/[0.03]', iconBox: 'bg-amber-500/10 dark:bg-amber-500/15', iconColor: 'text-amber-600 dark:text-amber-400', icon: Clock },
    { value: stats.bugFixReadyRetest, label: 'Ready', card: 'border-l-cyan-500 hover:bg-cyan-500/[0.03]', iconBox: 'bg-cyan-500/10 dark:bg-cyan-500/15', iconColor: 'text-cyan-600 dark:text-cyan-400', icon: RefreshCw },
    { value: stats.bugFixFixed, label: 'Fixed', card: 'border-l-emerald-500 hover:bg-emerald-500/[0.03]', iconBox: 'bg-emerald-500/10 dark:bg-emerald-500/15', iconColor: 'text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ value, label, card, iconBox, iconColor, icon: Icon }) => (
        <Card key={label} variant="glass" padding="none" className={`group border-l-4 transition duration-300 ${card}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-xl p-2.5 transition-transform duration-300 group-hover:scale-105 ${iconBox}`}><Icon className={`h-5 w-5 ${iconColor}`} /></div>
              <div><AnimatedNumber value={value} className="block font-mono text-2xl font-bold tabular-nums text-foreground" /><p className={`text-[10px] font-semibold uppercase tracking-wider ${iconColor}`}>{label}</p></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
