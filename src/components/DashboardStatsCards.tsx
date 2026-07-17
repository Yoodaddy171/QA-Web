'use client';

import { AlertTriangle, CheckCircle2, Clock, HelpCircle, RefreshCw, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { cn } from '@/lib/utils';
import type { DashboardStats } from '@/components/DashboardPanel';

export function DashboardStatsCards({ stats }: { stats: DashboardStats }) {
  return (
<motion.div
  className="grid grid-cols-2 overflow-hidden rounded-xl border border-border/70 bg-card/90 sm:grid-cols-3 lg:grid-cols-7"
  initial="hidden"
  animate="show"
  variants={{ show: { transition: { staggerChildren: 0.05 } } }}
>
  {([
    { key: 'done', label: 'Done', value: stats.doneCount, icon: CheckCircle2, border: 'border-l-emerald-500', iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/15', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    { key: 'active', label: 'Active', value: stats.inProgressCount, icon: Clock, border: 'border-l-indigo-500', iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/15', iconColor: 'text-indigo-600 dark:text-indigo-300' },
    { key: 'blocked', label: 'Blocked', value: stats.blockedCount, icon: AlertTriangle, border: 'border-l-amber-500', iconBg: 'bg-amber-500/10 dark:bg-amber-500/15', iconColor: 'text-amber-600 dark:text-amber-400' },
    { key: 'backlog', label: 'Backlog', value: stats.notDoneCount, icon: XCircle, border: 'border-l-slate-400 dark:border-l-slate-500', iconBg: 'bg-secondary', iconColor: 'text-muted-foreground' },
    { key: 'failed', label: 'Failed', value: stats.failedCount, icon: XCircle, border: 'border-l-red-500', iconBg: 'bg-red-500/10 dark:bg-red-500/15', iconColor: 'text-red-600 dark:text-red-400' },
    { key: 'retest', label: 'Retest', value: stats.readyToRetestCount, icon: RefreshCw, border: 'border-l-cyan-500', iconBg: 'bg-cyan-500/10 dark:bg-cyan-500/15', iconColor: 'text-cyan-600 dark:text-cyan-400' },
    { key: 'tba', label: 'TBA', value: stats.tbaCount || 0, icon: HelpCircle, border: 'border-l-purple-500', iconBg: 'bg-purple-500/10 dark:bg-purple-500/15', iconColor: 'text-purple-600 dark:text-purple-400' },
  ] as const).map(({ key, label, value, icon: StatIcon, iconBg, iconColor }) => (
    <motion.div
      key={key}
      variants={{
        hidden: { opacity: 0, y: 14, scale: 0.96 },
        show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 320, damping: 24 } },
      }}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.985 }}
      className="relative border-b border-r border-border/60 p-4 last:border-r-0 lg:border-b-0"
    >
      <div className="flex items-center gap-3">
        <div className={cn('rounded-lg p-2', iconBg)}>
          <StatIcon className={cn('h-4 w-4', iconColor)} />
        </div>
        <div>
          <AnimatedNumber value={value} className="block font-mono text-xl font-bold text-foreground tabular-nums" />
          <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
        </div>
      </div>
    </motion.div>
  ))}
</motion.div>
  );
}
