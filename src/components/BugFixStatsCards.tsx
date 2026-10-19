'use client';

import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface BugFixStats {
  bugFixReported: number;
  bugFixFixing: number;
  bugFixReadyRetest: number;
  bugFixFixed: number;
}

export function BugFixStatsCards({ stats }: { stats: BugFixStats }) {
  const cards = [
    { value: stats.bugFixReported, label: 'Reported', color: 'text-bug-open', icon: AlertTriangle },
    { value: stats.bugFixFixing, label: 'Fixing', color: 'text-bug-fixing', icon: Clock },
    { value: stats.bugFixReadyRetest, label: 'Ready', color: 'text-bug-ready', icon: RefreshCw },
    { value: stats.bugFixFixed, label: 'Fixed', color: 'text-bug-fixed', icon: CheckCircle2 },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map(({ value, label, color, icon: Icon }) => (
        <Card key={label} variant="outlined" padding="none" className="bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Icon className={cn('size-5 shrink-0', color)} />
              <div><AnimatedNumber value={value} className="block text-2xl font-semibold tabular-nums text-foreground" /><p className={cn('text-xs font-medium', color)}>{label}</p></div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
