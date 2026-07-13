'use client';

import { AlertTriangle, CheckCircle2, Clock, HelpCircle, RefreshCw, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DashboardStats } from '@/components/DashboardPanel';

export function DashboardStatsCards({ stats }: { stats: DashboardStats }) {
  return (
<motion.div
  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
  initial="hidden"
  animate="show"
  variants={{ show: { transition: { staggerChildren: 0.05 } } }}
>
  {([
    { key: 'done', label: 'Done', value: stats.doneCount, icon: CheckCircle2, border: 'border-l-emerald-500', iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/15', iconColor: 'text-emerald-600 dark:text-emerald-400' },
    { key: 'active', label: 'Active', value: stats.inProgressCount, icon: Clock, border: 'border-l-amber-500', iconBg: 'bg-amber-500/10 dark:bg-amber-500/15', iconColor: 'text-amber-600 dark:text-amber-400' },
    { key: 'blocked', label: 'Blocked', value: stats.blockedCount, icon: AlertTriangle, border: 'border-l-rose-500', iconBg: 'bg-rose-500/10 dark:bg-rose-500/15', iconColor: 'text-rose-600 dark:text-rose-400' },
    { key: 'backlog', label: 'Backlog', value: stats.notDoneCount, icon: XCircle, border: 'border-l-slate-400 dark:border-l-slate-500', iconBg: 'bg-secondary', iconColor: 'text-muted-foreground' },
    { key: 'failed', label: 'Failed', value: stats.failedCount, icon: XCircle, border: 'border-l-red-500', iconBg: 'bg-red-500/10 dark:bg-red-500/15', iconColor: 'text-red-600 dark:text-red-400' },
    { key: 'retest', label: 'Retest', value: stats.readyToRetestCount, icon: RefreshCw, border: 'border-l-cyan-500', iconBg: 'bg-cyan-500/10 dark:bg-cyan-500/15', iconColor: 'text-cyan-600 dark:text-cyan-400' },
    { key: 'tba', label: 'TBA', value: stats.tbaCount || 0, icon: HelpCircle, border: 'border-l-purple-500', iconBg: 'bg-purple-500/10 dark:bg-purple-500/15', iconColor: 'text-purple-600 dark:text-purple-400' },
  ] as const).map(({ key, label, value, icon: StatIcon, border, iconBg, iconColor }) => (
    <motion.div
      key={key}
      variants={{
        hidden: { opacity: 0, y: 14, scale: 0.96 },
        show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 320, damping: 24 } },
      }}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.97, rotate: -1 }}
    >
      <Card variant="glass" padding="none" className={cn('group h-full border-l-4 transition-colors duration-300', border)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn('rounded-xl p-2.5 group-hover:scale-110 group-hover:-rotate-6 transition-transform duration-200 motion-reduce:group-hover:transform-none', iconBg)}>
              <StatIcon className={cn('w-5 h-5', iconColor)} />
            </div>
            <div>
              <AnimatedNumber value={value} className="block text-2xl font-bold text-foreground font-mono tabular-nums" />
              <p className={cn('text-[10px] font-semibold uppercase tracking-wider', key === 'backlog' ? 'text-muted-foreground' : iconColor)}>{label}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  ))}
</motion.div>
  );
}
