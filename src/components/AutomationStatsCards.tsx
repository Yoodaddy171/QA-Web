'use client';

import React, { useRef } from 'react';
import { CalendarClock, FileClock, MonitorDot } from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Card, CardContent } from '@/components/ui/card';
import { gsap, useGSAP, isMotionAllowed, useCardTilt3D } from '@/lib/client/gsap-motion';
import { cn } from '@/lib/utils';

interface AutomationStatsCardsProps {
  total: number;
  manual: number;
  lastRunAt?: string | null;
}

function TiltAutomationCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  useCardTilt3D(cardRef, { maxDeg: 4 });
  return (
    <div ref={cardRef} data-automation-stat className={className}>
      {children}
    </div>
  );
}

export function AutomationStatsCards({ total, manual, lastRunAt }: AutomationStatsCardsProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      if (!containerRef.current || !isMotionAllowed()) return;
      const cards = containerRef.current.querySelectorAll('[data-automation-stat]');
      if (!cards.length) return;
      gsap.fromTo(
        cards,
        { y: 16, opacity: 0, scale: 0.97 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.42,
          stagger: 0.07,
          ease: 'back.out(1.4)',
          clearProps: 'y,opacity,scale',
        }
      );
    },
    { scope: containerRef }
  );

  return (
    <div ref={containerRef} className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <TiltAutomationCard className="rounded-2xl transition-all duration-200">
        <Card padding="none" className="border-border/80 bg-card shadow-xs hover:border-primary/40 hover:shadow-sm">
          <CardContent className="flex min-w-0 items-center gap-3 p-4">
            <div className="rounded-xl bg-status-retest/10 p-2.5 text-status-retest">
              <MonitorDot className="size-5" />
            </div>
            <div className="min-w-0">
              <AnimatedNumber value={total} className="block font-mono text-2xl font-bold tabular-nums text-foreground" />
              <p className="qa-module-meta mt-1">Skenario Terekam</p>
            </div>
          </CardContent>
        </Card>
      </TiltAutomationCard>

      <TiltAutomationCard className="rounded-2xl transition-all duration-200">
        <Card padding="none" className="border-border/80 bg-card shadow-xs hover:border-emerald-500/40 hover:shadow-sm">
          <CardContent className="flex min-w-0 items-center gap-3 p-4">
            <div className="rounded-xl bg-status-passed/10 p-2.5 text-status-passed">
              <FileClock className="size-5" />
            </div>
            <div className="min-w-0">
              <AnimatedNumber value={manual} className="block font-mono text-2xl font-bold tabular-nums text-foreground" />
              <p className="qa-module-meta mt-1">Artefak Manual</p>
            </div>
          </CardContent>
        </Card>
      </TiltAutomationCard>

      <TiltAutomationCard className="rounded-2xl transition-all duration-200">
        <Card padding="none" className="border-border/80 bg-card shadow-xs hover:border-amber-500/40 hover:shadow-sm">
          <CardContent className="flex min-w-0 items-center gap-3 p-4">
            <div className="rounded-xl bg-status-blocked/10 p-2.5 text-status-blocked">
              <CalendarClock className="size-5" />
            </div>
            <div className="min-w-0">
              <p className={cn("break-words text-sm font-semibold text-foreground", lastRunAt && "font-mono tabular-nums")}>
                {lastRunAt ? new Date(lastRunAt).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Belum ada'}
              </p>
              <p className="qa-module-meta mt-1">Run Terakhir</p>
            </div>
          </CardContent>
        </Card>
      </TiltAutomationCard>
    </div>
  );
}
