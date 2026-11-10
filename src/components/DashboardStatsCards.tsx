'use client';

import React from 'react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  HelpCircle,
  Layers,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { cn } from '@/lib/utils';
import type { DashboardStats } from '@/components/DashboardPanel';

interface DashboardStatsCardsProps {
  stats: DashboardStats;
}

export function DashboardStatsCards({ stats }: DashboardStatsCardsProps) {
  const total = Math.max(1, stats.totalTestCases || 1);

  const statItems = [
    {
      key: 'done',
      label: 'Skenario Selesai',
      value: stats.doneCount,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400',
      trend: `↑ ${Math.round((stats.doneCount / total) * 100)}%`,
      trendTone: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/15',
      trendIcon: ArrowUpRight,
      subtext: `dari ${stats.totalTestCases} kasus`,
    },
    {
      key: 'failed',
      label: 'Skenario Gagal',
      value: stats.failedCount,
      icon: XCircle,
      iconBg: 'bg-rose-500/10 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400',
      trend: stats.failedCount > 0 ? `↓ ${stats.failedCount} isu` : '✓ 0 issue',
      trendTone:
        stats.failedCount > 0
          ? 'text-rose-600 bg-rose-500/10 dark:text-rose-400 dark:bg-rose-500/15'
          : 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-500/15',
      trendIcon: stats.failedCount > 0 ? ArrowDownRight : CheckCircle2,
      subtext: stats.failedCount > 0 ? 'Menahan rilis' : 'Semua lolos',
    },
    {
      key: 'active',
      label: 'Sedang Berjalan',
      value: stats.inProgressCount,
      icon: Clock,
      iconBg: 'bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-400',
      trend: `${Math.round((stats.inProgressCount / total) * 100)}%`,
      trendTone: 'text-indigo-600 bg-indigo-500/10 dark:text-indigo-400 dark:bg-indigo-500/15',
      trendIcon: ArrowUpRight,
      subtext: 'Aktif dikerjakan',
    },
    {
      key: 'blocked-retest',
      label: 'Blocked & Retest',
      value: stats.blockedCount + stats.readyToRetestCount,
      icon: AlertTriangle,
      iconBg: 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/15 dark:text-amber-400',
      trend: `${stats.readyToRetestCount} retest`,
      trendTone: 'text-amber-600 bg-amber-500/10 dark:text-amber-400 dark:bg-amber-500/15',
      trendIcon: RefreshCw,
      subtext: `${stats.blockedCount} terhalang`,
    },
    {
      key: 'backlog',
      label: 'Backlog Belum Diuji',
      value: stats.notDoneCount + (stats.tbaCount || 0),
      icon: Layers,
      iconBg: 'bg-secondary text-muted-foreground',
      trend: `${Math.round(((stats.notDoneCount + (stats.tbaCount || 0)) / total) * 100)}%`,
      trendTone: 'text-muted-foreground bg-secondary',
      trendIcon: ArrowUpRight,
      subtext: `${stats.notDoneCount} kasus antre`,
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {statItems.map((item) => {
        const Icon = item.icon;
        const TrendIcon = item.trendIcon;

        return (
          <div
            key={item.key}
            className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-sm"
          >
            {/* Top row: Icon tile & Trend badge */}
            <div className="flex items-start justify-between gap-2">
              <div
                className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform duration-150 group-hover:scale-105',
                  item.iconBg
                )}
              >
                <Icon className="h-5 w-5" />
              </div>

              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tabular-nums',
                  item.trendTone
                )}
              >
                <TrendIcon className="h-3 w-3" />
                <span>{item.trend}</span>
              </span>
            </div>

            {/* Bottom row: Label, Big Number, Subtext */}
            <div className="mt-4">
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <AnimatedNumber
                  value={item.value}
                  className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums"
                />
                <span className="truncate text-[11px] text-muted-foreground">{item.subtext}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
