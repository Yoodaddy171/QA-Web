'use client';

import React, { useCallback, useId, useRef, useState } from 'react';
import { Check, RefreshCw, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { BasketballUploadDropzoneProps } from '@/components/BasketballUploadDropzone';

export function formatFileSize(bytes?: number) {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

export function getFileExtensionBadge(fileName?: string, fallback = 'DOC') {
  if (!fileName) return fallback;
  const parts = fileName.trim().split('.');
  if (parts.length < 2) return fallback;
  const ext = parts[parts.length - 1].toUpperCase().slice(0, 4);
  return ext || fallback;
}

export function StandardUploadDropzone({
  title = 'Upload files',
  subtitle = 'Drag and drop, or take the shot.',
  dropLabel = 'Drop files here',
  accept,
  disabled = false,
  busy = false,
  uploadedCount,
  defaultBadge = 'DOC',
  helperText,
  helperBadges,
  selectedFile,
  actionButtonLabel,
  onActionButtonClick,
  onClearFile,
  onFileSelect,
  inputRef: externalInputRef,
  inputAriaLabel,
  compact = false,
  className,
}: BasketballUploadDropzoneProps) {
  const internalInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = externalInputRef ?? internalInputRef;
  const inputId = useId();

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [localUploadedCount, setLocalUploadedCount] = useState(0);
  const [activeFile, setActiveFile] = useState<{ name: string; size: number } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStage, setUploadStage] = useState<'idle' | 'uploading' | 'done'>('idle');

  const displayFile = selectedFile
    ? { name: selectedFile.name, size: selectedFile.size ?? activeFile?.size ?? 0 }
    : activeFile;

  const badgeText = getFileExtensionBadge(displayFile?.name, defaultBadge);
  const effectiveUploadedCount = typeof uploadedCount === 'number' ? uploadedCount : localUploadedCount;

  const runProgressSimulation = useCallback((file: File) => {
    setActiveFile({ name: file.name, size: file.size });
    setUploadStage('uploading');
    setUploadProgress(28);

    const t1 = window.setTimeout(() => setUploadProgress(56), 140);
    const t2 = window.setTimeout(() => setUploadProgress(88), 300);
    const t3 = window.setTimeout(() => {
      setUploadProgress(100);
      setUploadStage('done');
      setLocalUploadedCount((c) => c + 1);
    }, 460);

    void Promise.resolve(onFileSelect(file)).catch(() => {
      setUploadStage('idle');
    });

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [onFileSelect]);

  const handleSelectedFile = useCallback((file?: File | null) => {
    if (!file || disabled || busy) return;
    runProgressSimulation(file);
  }, [busy, disabled, runProgressSimulation]);

  const isUploadingNow = busy || uploadStage === 'uploading';
  const showFileCard = Boolean(displayFile) && (isUploadingNow || uploadStage === 'done' || Boolean(selectedFile));

  return (
    <div
      data-basketball-dropzone="true"
      data-basketball-active="false"
      onDragEnter={(event) => {
        event.preventDefault();
        if (disabled || busy) return;
        setIsDraggingOver(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (disabled || busy) return;
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy';
        }
        if (!isDraggingOver) setIsDraggingOver(true);
      }}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (nextTarget && event.currentTarget.contains(nextTarget)) return;
        setIsDraggingOver(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDraggingOver(false);
        const file = event.dataTransfer?.files?.[0];
        if (file) handleSelectedFile(file);
      }}
      className={cn(
        'relative select-none overflow-hidden rounded-2xl border border-border/70 bg-card/85 p-4 sm:p-5 text-foreground shadow-sm transition-colors',
        compact && 'p-3.5',
        disabled && 'opacity-60 pointer-events-none',
        className
      )}
    >
      <input
        id={inputId}
        ref={fileInputRef}
        type="file"
        accept={accept}
        aria-label={inputAriaLabel || title}
        disabled={disabled || busy}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleSelectedFile(file);
          event.currentTarget.value = '';
        }}
      />

      {/* Top Header */}
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-[140px] flex-1">
          <p className="text-xs font-bold tracking-tight text-foreground sm:text-sm">{title}</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{subtitle}</p>
        </div>
        <div className="flex flex-wrap shrink-0 items-center gap-1.5">
          <span className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums text-indigo-600 dark:text-indigo-300">
            Uploaded {effectiveUploadedCount}
          </span>
        </div>
      </div>

      {/* Standard Clean Dropzone Mode */}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={`${dropLabel} - ${subtitle}`}
        onClick={() => {
          if (!showFileCard && !disabled && !busy) {
            fileInputRef.current?.click();
          }
        }}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && !disabled && !busy) {
            event.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={cn(
          'relative flex w-full flex-col items-center justify-center rounded-xl border-2 border-dashed px-5 py-8 text-center transition-all duration-200 focus-visible:outline-2 focus-visible:outline-ring',
          compact ? 'min-h-[148px] py-6' : 'min-h-[180px]',
          isDraggingOver
            ? 'border-indigo-500 bg-indigo-500/8 shadow-inner'
            : 'border-border/80 bg-background/60 hover:border-indigo-500/50 hover:bg-background/90'
        )}
      >
        {!showFileCard ? (
          <div className="pointer-events-none flex flex-col items-center gap-1.5">
            <div className="mb-0.5 flex size-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
              <Upload className="size-5" />
            </div>
            <p className="text-xs font-semibold text-foreground sm:text-sm">{dropLabel}</p>
            <p className="text-[11px] text-muted-foreground">
              {helperText || 'Drag and drop file ke sini atau klik untuk memilih file'}
            </p>
            {helperBadges && helperBadges.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center justify-center gap-1">
                {helperBadges.map((ext) => (
                  <span
                    key={ext}
                    className="rounded border border-border/70 bg-secondary/80 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-muted-foreground"
                  >
                    {ext.startsWith('.') ? ext : `.${ext}`}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-md rounded-xl border border-border/80 bg-card p-3 text-left shadow-sm animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 rounded bg-indigo-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-indigo-600 dark:text-indigo-300">
                  {badgeText}
                </span>
                <span className="truncate text-xs font-semibold text-foreground" title={displayFile?.name}>
                  {displayFile?.name}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="font-mono text-[11px] font-semibold text-muted-foreground">
                  {isUploadingNow ? `${Math.min(95, Math.max(25, uploadProgress))}%` : 'Done'}
                </span>
                {onClearFile && !isUploadingNow && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFile(null);
                      setUploadStage('idle');
                      onClearFile();
                    }}
                    aria-label="Hapus file terpilih"
                    className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-300',
                  isUploadingNow ? 'bg-indigo-500' : 'bg-emerald-500'
                )}
                style={{ width: `${isUploadingNow ? Math.max(35, uploadProgress) : 100}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
              {isUploadingNow ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <RefreshCw className="size-3 animate-spin text-indigo-500" />
                  Uploading file...
                </span>
              ) : (
                <span className="flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="size-3.5" />
                  File uploaded successfully
                </span>
              )}
              <span className="font-mono text-[10px] text-muted-foreground">
                {formatFileSize(displayFile?.size)}
              </span>
            </div>

            {actionButtonLabel && onActionButtonClick && (
              <div className="mt-2.5 flex justify-end gap-2 border-t border-border/60 pt-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={isUploadingNow}
                  onClick={onActionButtonClick}
                  className="h-7 gap-1.5 px-3 text-xs font-semibold"
                >
                  {isUploadingNow ? <RefreshCw className="size-3 animate-spin" /> : <Upload className="size-3" />}
                  {actionButtonLabel}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
