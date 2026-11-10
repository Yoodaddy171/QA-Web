'use client';

import React from 'react';
import { RotateCcw, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface MissedShotCardProps {
  fileName?: string;
  badgeText?: string;
  reason: string;
  onRetry: () => void;
  onDirectUpload: () => void;
  onCancel: () => void;
}

export function MissedShotCard({
  fileName = 'file',
  badgeText = 'DOC',
  reason,
  onRetry,
  onDirectUpload,
  onCancel,
}: MissedShotCardProps) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="relative z-30 mx-auto w-full max-w-sm rounded-xl border border-rose-500/30 bg-card/95 p-4 text-center shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200"
    >
      {/* Pill Badge */}
      <div className="mb-2 flex items-center justify-center gap-1.5">
        <span className="rounded bg-rose-500/15 px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase text-rose-600 dark:text-rose-400">
          TEMBAKAN MELESET
        </span>
        <span className="font-mono text-xs text-muted-foreground">• 0 PT</span>
      </div>

      {/* Miss Reason */}
      <p className="font-semibold text-xs text-foreground sm:text-sm">{reason}</p>
      <p className="mt-1 text-[11px] text-muted-foreground truncate" title={fileName}>
        File: <span className="font-medium text-foreground">{fileName}</span>
      </p>

      {/* Action Buttons */}
      <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onRetry}
          className="h-8 gap-1.5 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700 shadow-sm"
        >
          <RotateCcw className="size-3.5" />
          <span>Tembak Lagi</span>
        </Button>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onDirectUpload}
          className="h-8 gap-1.5 rounded-lg border-border bg-secondary/60 px-3 text-xs font-semibold text-foreground hover:bg-secondary"
        >
          <Upload className="size-3.5 text-emerald-600 dark:text-emerald-400" />
          <span>Langsung Unggah</span>
        </Button>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onCancel}
          className="size-8 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Batalkan file"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
