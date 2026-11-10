'use client';

import React, { useRef } from 'react';
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
import { gsap, useGSAP, isMotionAllowed, useCardTilt3D } from '@/lib/client/gsap-motion';
import { cn } from '@/lib/utils';
import type { DashboardStats } from '@/components/DashboardPanel';

interface DashboardStatsCardsProps {
  stats: DashboardStats;
}

function TiltStatCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  useCardTilt3D(cardRef, { maxDeg: 4 });
  return (
    <div ref={cardRef} data-stat-card className={className}>
      {children}
    </div>
  );
}

export function DashboardStatsCards({ stats }: DashboardStatsCardsProps) {
  const total = Math.max(1, stats.totalTestCases || 1);

  const statItems = [
    {
      key: 'done',
      label: 'Skenario Selesai',
      value: stats.doneCount,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400',
      trend: `↑ ${Math.round((stats.doneCount / total) * 100)}%`,
      trendTone: 'text-emerald-700 bg-emerald-500/10 dark:text-emerald-300 dark:bg-emerald-500/15',
      trendIcon: ArrowUpRight,
      subtext: `dari ${stats.totalTestCases} kasus`,
    },
    {
      key: 'failed',
      label: 'Skenario Gagal',
      value: stats.failedCount,
      icon: XCircle,
      iconBg: 'bg-rose-500/10 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400',
      trend: stats.failedCount > 0 ? `↓ ${stats.failedCount} isu` : '✓ 0 issue',
      trendTone:
        stats.failedCount > 0
          ? 'text-rose-700 bg-rose-500/10 dark:text-rose-300 dark:bg-rose-500/15'
          : 'text-emerald-700 bg-emerald-500/10 dark:text-emerald-300 dark:bg-emerald-500/15',
      trendIcon: stats.failedCount > 0 ? ArrowDownRight : CheckCircle2,
      subtext: stats.failedCount > 0 ? 'Menahan rilis' : 'Semua lolos',
    },
    {
      key: 'active',
      label: 'Sedang Berjalan',
      value: stats.inProgressCount,
      icon: Clock,
      iconBg: 'bg-sky-500/10 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
      trend: `${Math.round((stats.inProgressCount / total) * 100)}%`,
      trendTone: 'text-sky-700 bg-sky-500/10 dark:text-sky-300 dark:bg-sky-500/15',
      trendIcon: ArrowUpRight,
      subtext: 'Aktif dikerjakan',
    },
    {
      key: 'blocked-retest',
      label: 'Blocked & Retest',
      value: stats.blockedCount + stats.readyToRetestCount,
      icon: AlertTriangle,
      iconBg: 'bg-amber-500/10 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400',
      trend: `${stats.readyToRetestCount} retest`,
      trendTone: 'text-amber-800 bg-amber-500/10 dark:text-amber-300 dark:bg-amber-500/15',
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

  const gridRef = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!gridRef.current || !isMotionAllowed()) return;
      const cards = gridRef.current.querySelectorAll('[data-stat-card]');
      if (!cards.length) return;
      gsap.fromTo(
        cards,
        { y: 18, opacity: 0, scale: 0.96 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.44,
          stagger: 0.055,
          ease: 'back.out(1.5)',
          clearProps: 'y,opacity,scale',
        }
      );
    },
    { scope: gridRef }
  );

  return (
    <div ref={gridRef} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {statItems.map((item) => {
        const Icon = item.icon;
        const TrendIcon = item.trendIcon;

        return (
          <TiltStatCard
            key={item.key}
            className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-5 shadow-xs transition-colors duration-200 hover:border-primary/40 hover:shadow-sm"
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
          </TiltStatCard>
        );
      })}
    </div>
  );
}
