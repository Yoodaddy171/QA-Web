'use client';

import React from 'react';

export type ShotTimingQuality =
  | 'excellent' // 82% to 92% (Green Sweetspot)
  | 'slightly_early' // 70% to 81% (Yellow)
  | 'slightly_late' // 93% to 98% (Yellow)
  | 'very_early' // < 70% (Red)
  | 'very_late'; // > 98% (Red)

export function getShotTimingQuality(percent: number): ShotTimingQuality {
  if (percent >= 82 && percent <= 92) return 'excellent';
  if (percent >= 70 && percent < 82) return 'slightly_early';
  if (percent > 92 && percent <= 98) return 'slightly_late';
  if (percent < 70) return 'very_early';
  return 'very_late';
}

interface ShotMeterGaugeProps {
  progress: number; // 0 to 100
  visible: boolean;
  className?: string;
}

export function ShotMeterGauge({ progress, visible, className = '' }: ShotMeterGaugeProps) {
  if (!visible) return null;

  const quality = getShotTimingQuality(progress);
  const isGreen = quality === 'excellent';
  const isYellow = quality === 'slightly_early' || quality === 'slightly_late';

  const needleColor = isGreen ? '#10B981' : isYellow ? '#F59E0B' : '#EF4444';
  const glowColor = isGreen
    ? 'rgba(16, 185, 129, 0.85)'
    : isYellow
    ? 'rgba(245, 158, 11, 0.45)'
    : 'rgba(239, 68, 68, 0.4)';

  const clampedProgress = Math.max(0, Math.min(100, progress));
  const fillHeight = (clampedProgress / 100) * 64; // max 64px fill height

  return (
    <div
      aria-hidden="true"
      data-testid="shot-meter-gauge"
      className={`pointer-events-none select-none transition-opacity duration-150 ${className}`}
    >
      {/* 2K Player-Attached Vertical Shot Meter Bar (Pure visual gauge, no text) */}
      <div
        className={`relative flex h-[76px] w-[20px] items-end justify-center overflow-hidden rounded-full border-2 bg-black/85 p-0.5 shadow-2xl backdrop-blur-md transition-all duration-100 ${
          isGreen
            ? 'border-emerald-400 ring-2 ring-emerald-400/80 shadow-[0_0_16px_rgba(16,185,129,0.9)]'
            : isYellow
            ? 'border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
            : 'border-white/80 shadow-md dark:border-zinc-300'
        }`}
      >
        {/* Track Background Segments */}
        <div className="absolute inset-0 flex flex-col justify-between opacity-35">
          {/* Overfill Red zone (98% to 100%) */}
          <div className="h-[4%] w-full bg-rose-600" />
          {/* Slightly late Yellow (92% to 98%) */}
          <div className="h-[6%] w-full bg-amber-400" />
          {/* Green Sweetspot Zone (82% to 92%) */}
          <div className="h-[12%] w-full bg-emerald-400" />
          {/* Slightly early Yellow (70% to 82%) */}
          <div className="h-[14%] w-full bg-amber-400" />
          {/* Very early Red (<70%) */}
          <div className="h-[64%] w-full bg-rose-600" />
        </div>

        {/* Permanent Green Target Window Marker with glowing borders */}
        <div
          className="absolute left-0 w-full border-y-2 border-emerald-300 bg-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.9)]"
          style={{
            bottom: `${82 * 0.64}px`,
            height: `${10 * 0.64}px`,
          }}
        />

        {/* Dynamic Vertical Fill Bar from Bottom Up */}
        <div
          className="relative w-full rounded-full transition-all duration-75 ease-out"
          style={{
            height: `${fillHeight}px`,
            backgroundColor: needleColor,
            boxShadow: `0 0 10px ${glowColor}`,
          }}
        />

        {/* Dynamic White Needle Indicator Line */}
        <div
          className="absolute left-0 h-[2.5px] w-full bg-white shadow-[0_0_8px_#ffffff] transition-all duration-75"
          style={{
            bottom: `${fillHeight}px`,
          }}
        />
      </div>
    </div>
  );
}
