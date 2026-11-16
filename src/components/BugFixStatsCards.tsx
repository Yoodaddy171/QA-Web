'use client';

import React, { useRef } from 'react';
import { AlertTriangle, CheckCircle2, Clock, RefreshCw } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Card, CardContent } from '@/components/ui/card';
import { gsap, useGSAP, isMotionAllowed, useCardTilt3D } from '@/lib/client/gsap-motion';
import { cn } from '@/lib/utils';

interface BugFixStats {
  bugFixReported: number;
  bugFixFixing: number;
  bugFixReadyRetest: number;
  bugFixFixed: number;
}

function TiltBugCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  useCardTilt3D(cardRef, { maxDeg: 4 });
  return (
    <div ref={cardRef} data-bug-stat className={className}>
      {children}
    </div>
  );
}

export function BugFixStatsCards({ stats }: { stats: BugFixStats }) {
  const containerRef = useRef<HTMLDivElement>(null);

  const cards = [
    {
      value: stats.bugFixReported,
      label: 'Reported',
      color: 'text-rose-500',
      bg: 'bg-rose-500/10 dark:bg-rose-500/15',
      border: 'hover:border-rose-500/40',
      icon: AlertTriangle,
      description: 'Defect baru dilaporkan',
    },
    {
      value: stats.bugFixFixing,
      label: 'Sedang Diperbaiki',
      color: 'text-amber-500',
      bg: 'bg-amber-500/10 dark:bg-amber-500/15',
      border: 'hover:border-amber-500/40',
      icon: Clock,
      description: 'Dalam proses developer',
    },
    {
      value: stats.bugFixReadyRetest,
      label: 'Siap Uji Ulang',
      color: 'text-cyan-500',
      bg: 'bg-cyan-500/10 dark:bg-cyan-500/15',
      border: 'hover:border-cyan-500/40',
      icon: RefreshCw,
      description: 'Menunggu retest QA',
    },
    {
      value: stats.bugFixFixed,
      label: 'Selesai Terverifikasi',
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
      border: 'hover:border-emerald-500/40',
      icon: CheckCircle2,
      description: 'Lolos uji & tertutup',
    },
  ] as const;

  useGSAP(
    () => {
      if (!containerRef.current || !isMotionAllowed()) return;
      const cardEls = containerRef.current.querySelectorAll('[data-bug-stat]');
      if (!cardEls.length) return;
      gsap.fromTo(
        cardEls,
        { y: 16, opacity: 0, scale: 0.97 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.42,
          stagger: 0.065,
          ease: 'back.out(1.4)',
          clearProps: 'y,opacity,scale',
        }
      );
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ value, label, color, bg, border, icon: Icon, description }) => (
        <TiltBugCard key={label} className="rounded-2xl transition-all duration-200">
          <Card padding="none" className={cn('group border-border/80 bg-card shadow-xs transition-all duration-200 hover:shadow-sm', border)}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105', bg, color)}>
                  <Icon className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <AnimatedNumber value={value} className="block font-mono text-2xl font-bold tabular-nums text-foreground" />
                  <p className={cn('text-xs font-semibold truncate', color)}>{label}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TiltBugCard>
      ))}
    </div>
  );
}
