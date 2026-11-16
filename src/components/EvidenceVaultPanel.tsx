'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Eye,
  FileCode2,
  FileText,
  Film,
  HardDrive,
  Image as ImageIcon,
  Layers,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  UserRound,
  XCircle,
} from 'lucide-react';
import { ExecutionMarkdown } from '@/components/ExecutionMarkdown';
import { AnimatedNumber } from '@/components/ui/animated-number';
import {
  gsap,
  isMotionAllowed,
  useCardTilt3D,
  useGSAP,
  useMagneticHover,
} from '@/lib/client/gsap-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface EvidenceGalleryItem {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  execution: {
    id: string;
    status: string;
    tester?: string | null;
    actualResult?: string | null;
    notes?: string | null;
    createdAt: string;
  };
  testCase: {
    id: string;
    testCaseId: string;
    page: string;
    testAction: string;
    priority: string;
  };
  run: {
    id: string;
    name: string;
    status: string;
  };
}

interface EvidenceGallerySummary {
  totalFiles: number;
  totalBytes: number;
  imageCount: number;
  videoCount: number;
  failedEvidenceCount: number;
  runs: Array<{ id: string; name: string; status: string }>;
}

interface EvidenceVaultPanelProps {
  projectId: string;
  onNavigate?: (tab: string) => void;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function statusBadgeStyle(status: string) {
  const upper = status.toUpperCase();
  if (upper === 'PASSED' || upper === 'DONE') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  }
  if (upper === 'FAILED') {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400';
  }
  if (upper === 'BLOCKED') {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400';
  }
  return 'border-border bg-secondary text-muted-foreground';
}

interface EvidenceInteractiveImageViewerProps {
  src: string;
  alt: string;
}

function EvidenceInteractiveImageViewer({ src, alt }: EvidenceInteractiveImageViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [view, setView] = useState<{ x: number; y: number; zoom: number }>({ x: 0, y: 0, zoom: 1 });
  const [imgDimensions, setImgDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; y: number; startX: number; startY: number } | null>(null);

  const calculateFit = useCallback((imgW: number, imgH: number, contW: number, contH: number) => {
    if (!imgW || !imgH || !contW || !contH) return { x: 0, y: 0, zoom: 1 };
    const pad = 24;
    const availW = Math.max(80, contW - pad * 2);
    const availH = Math.max(80, contH - pad * 2);
    const fitScale = Math.min(availW / imgW, availH / imgH, 1.0);
    const zoom = Math.max(0.08, Number(fitScale.toFixed(3)));
    const x = (contW - imgW * zoom) / 2;
    const y = (contH - imgH * zoom) / 2;
    return { x, y, zoom };
  }, []);

  const handleFit = useCallback(() => {
    if (!containerRef.current || !imgDimensions) return;
    const rect = containerRef.current.getBoundingClientRect();
    const fitted = calculateFit(imgDimensions.width, imgDimensions.height, rect.width, rect.height);
    setView(fitted);
  }, [imgDimensions, calculateFit]);

  useEffect(() => {
    setIsLoaded(false);
    setImgDimensions(null);
    setView({ x: 0, y: 0, zoom: 1 });
  }, [src]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!imgDimensions) return;
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        setView((current) => {
          const defaultFit = calculateFit(imgDimensions.width, imgDimensions.height, width, height);
          if (Math.abs(current.zoom - defaultFit.zoom) < 0.1 || current.x === 0) {
            return defaultFit;
          }
          return current;
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [imgDimensions, calculateFit]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const nw = e.currentTarget.naturalWidth || 1200;
    const nh = e.currentTarget.naturalHeight || 800;
    setImgDimensions({ width: nw, height: nh });
    setIsLoaded(true);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const fitted = calculateFit(nw, nh, rect.width, rect.height);
      setView(fitted);
    }
  };

  const zoomBy = useCallback((factor: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    setView((v) => {
      const nextZoom = Math.max(0.1, Math.min(6, v.zoom * factor));
      const scaleRatio = nextZoom / v.zoom;
      const nextX = centerX - (centerX - v.x) * scaleRatio;
      const nextY = centerY - (centerY - v.y) * scaleRatio;
      return { x: nextX, y: nextY, zoom: nextZoom };
    });
  }, []);

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || !imgDimensions) return;
    const rect = containerRef.current.getBoundingClientRect();
    const defaultFit = calculateFit(imgDimensions.width, imgDimensions.height, rect.width, rect.height);

    if (view.zoom > defaultFit.zoom * 1.25) {
      handleFit();
    } else {
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      const targetZoom = Math.max(defaultFit.zoom * 2.2, 1.5);
      const scaleRatio = targetZoom / view.zoom;
      const nextX = cursorX - (cursorX - view.x) * scaleRatio;
      const nextY = cursorY - (cursorY - view.y) * scaleRatio;
      setView({ x: nextX, y: nextY, zoom: targetZoom });
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        const zoomFactor = Math.exp(-e.deltaY * 0.01);
        setView((v) => {
          const nextZoom = Math.max(0.1, Math.min(6, v.zoom * zoomFactor));
          const scaleRatio = nextZoom / v.zoom;
          const nextX = cursorX - (cursorX - v.x) * scaleRatio;
          const nextY = cursorY - (cursorY - v.y) * scaleRatio;
          return { x: nextX, y: nextY, zoom: nextZoom };
        });
      } else {
        setView((v) => ({
          ...v,
          x: v.x - e.deltaX,
          y: v.y - e.deltaY,
        }));
      }
    };

    let touchDist = 0;
    let touchZoom = 1;
    let touchCenter = { x: 0, y: 0 };
    let touchView = { x: 0, y: 0 };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        touchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const rect = el.getBoundingClientRect();
        touchCenter = {
          x: (t1.clientX + t2.clientX) / 2 - rect.left,
          y: (t1.clientY + t2.clientY) / 2 - rect.top,
        };
        setView((current) => {
          touchZoom = current.zoom;
          touchView = { x: current.x, y: current.y };
          return current;
        });
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
        const scale = currentDist / (touchDist || currentDist);
        const rect = el.getBoundingClientRect();
        const currentCenter = {
          x: (t1.clientX + t2.clientX) / 2 - rect.left,
          y: (t1.clientY + t2.clientY) / 2 - rect.top,
        };

        const nextZoom = Math.max(0.1, Math.min(6, touchZoom * scale));
        const scaleRatio = nextZoom / touchZoom;
        const dx = currentCenter.x - touchCenter.x;
        const dy = currentCenter.y - touchCenter.y;
        const nextX = touchCenter.x - (touchCenter.x - touchView.x) * scaleRatio + dx;
        const nextY = touchCenter.y - (touchCenter.y - touchView.y) * scaleRatio + dy;

        setView({ x: nextX, y: nextY, zoom: nextZoom });
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    el.addEventListener('touchstart', handleTouchStart, { passive: false });
    el.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      el.removeEventListener('wheel', handleWheel);
      el.removeEventListener('touchstart', handleTouchStart);
      el.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    drag.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      startX: view.x,
      startY: view.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d && d.pointerId === e.pointerId) {
      setView((v) => ({
        ...v,
        x: d.startX + e.clientX - d.x,
        y: d.startY + e.clientY - d.y,
      }));
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.pointerId === e.pointerId) {
      drag.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const onPointerCancel = () => {
    drag.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [40, 0],
      ArrowRight: [-40, 0],
      ArrowUp: [0, 40],
      ArrowDown: [0, -40],
    };
    if (delta[e.key]) {
      e.preventDefault();
      const [x, y] = delta[e.key];
      setView((v) => ({ ...v, x: v.x + x, y: v.y + y }));
    } else if (e.key === 'Home') {
      e.preventDefault();
      handleFit();
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomBy(1.25);
    } else if (e.key === '-') {
      e.preventDefault();
      zoomBy(1 / 1.25);
    }
  };

  return (
    <div
      ref={containerRef}
      data-lenis-prevent
      role="region"
      aria-label="Penampil gambar interaktif bukti pengujian"
      tabIndex={0}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      className="relative h-full w-full min-h-[300px] overflow-hidden bg-slate-950 cursor-grab active:cursor-grabbing select-none focus-visible:outline-2 focus-visible:outline-ring"
      style={{ touchAction: 'none' }}
    >
      <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-md border border-white/10 bg-black/60 px-2.5 py-1 text-[11px] text-white/70 backdrop-blur-md">
        Touchpad: 2 jari geser · Pinch zoom · Drag untuk pan · Dobel klik zoom
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full border border-white/15 bg-slate-900/90 px-3 py-1.5 shadow-2xl backdrop-blur-md text-white">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-full text-white/80 hover:bg-white/15 hover:text-white"
          onClick={() => zoomBy(1 / 1.25)}
          aria-label="Perkecil zoom"
        >
          <Minus className="size-3.5" />
        </Button>
        <span className="min-w-[46px] text-center font-mono text-xs font-semibold tabular-nums text-white">
          {Math.round(view.zoom * 100)}%
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-full text-white/80 hover:bg-white/15 hover:text-white"
          onClick={() => zoomBy(1.25)}
          aria-label="Perbesar zoom"
        >
          <Plus className="size-3.5" />
        </Button>
        <div className="mx-1 h-3.5 w-px bg-white/20" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 rounded-full px-2.5 text-xs text-white/80 hover:bg-white/15 hover:text-white"
          onClick={handleFit}
          aria-label="Paskan tampilan"
        >
          <RotateCcw className="size-3" />
          Paskan
        </Button>
      </div>

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center text-white/60">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="size-6 animate-spin text-primary" />
            <span className="text-xs">Memuat gambar...</span>
          </div>
        </div>
      )}

      <div
        className="absolute left-0 top-0 transition-transform duration-75 ease-out select-none will-change-transform"
        style={{
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <img
          src={src}
          alt={alt}
          onLoad={handleImageLoad}
          draggable={false}
          className={cn(
            'pointer-events-none select-none rounded shadow-2xl transition-opacity duration-200',
            isLoaded ? 'opacity-100' : 'opacity-0'
          )}
          style={
            imgDimensions
              ? {
                  width: imgDimensions.width,
                  height: imgDimensions.height,
                  maxWidth: 'none',
                  maxHeight: 'none',
                }
              : { maxWidth: 'none', maxHeight: 'none' }
          }
        />
      </div>
    </div>
  );
}

function VaultKpiCard({
  label,
  value,
  displayText,
  sublabel,
  icon: Icon,
  toneClass,
}: {
  label: string;
  value?: number;
  displayText?: string;
  sublabel: string;
  icon: React.ElementType;
  toneClass: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  useCardTilt3D(cardRef, { maxDeg: 4.5 });

  return (
    <div
      ref={cardRef}
      data-vault-kpi
      className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-primary/35"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {displayText !== undefined ? displayText : <AnimatedNumber value={value || 0} />}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
        </div>
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-105',
            toneClass
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}

export function EvidenceVaultPanel({ projectId, onNavigate }: EvidenceVaultPanelProps) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const refreshBtnRef = useRef<HTMLButtonElement>(null);
  useMagneticHover(refreshBtnRef, { strength: 0.25 });

  const [items, setItems] = useState<EvidenceGalleryItem[]>([]);
  const [summary, setSummary] = useState<EvidenceGallerySummary>({
    totalFiles: 0,
    totalBytes: 0,
    imageCount: 0,
    videoCount: 0,
    failedEvidenceCount: 0,
    runs: [],
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [mediaFilter, setMediaFilter] = useState<string>('all');
  const [runFilter, setRunFilter] = useState<string>('all');
  const [selectedItem, setSelectedItem] = useState<EvidenceGalleryItem | null>(null);

  const loadGallery = useCallback(async () => {
    if (!projectId) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ projectId, limit: '90' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (mediaFilter !== 'all') params.set('mediaType', mediaFilter);
      if (runFilter !== 'all') params.set('runId', runFilter);
      if (search.trim()) params.set('search', search.trim());

      const res = await fetch(`/api/evidence/gallery?${params.toString()}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat galeri evidence.');
      setItems(Array.isArray(data.items) ? data.items : []);
      if (data.summary) setSummary(data.summary);
    } catch (error) {
      toast({
        title: 'Gagal memuat Evidence Vault',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, statusFilter, mediaFilter, runFilter, search, toast]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadGallery();
    }, 100);
    return () => window.clearTimeout(timer);
  }, [loadGallery]);

  useGSAP(
    () => {
      if (!containerRef.current || !isMotionAllowed()) return;
      const kpis = containerRef.current.querySelectorAll('[data-vault-kpi]');
      if (kpis.length) {
        gsap.fromTo(
          kpis,
          { y: 14, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.36,
            stagger: 0.06,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          }
        );
      }
    },
    { dependencies: [projectId], scope: containerRef }
  );

  const buildFileUrl = (item: EvidenceGalleryItem, thumbnail = false) => {
    const base = `/api/test-runs/${encodeURIComponent(item.run.id)}/executions/${encodeURIComponent(
      item.execution.id
    )}/evidence/${encodeURIComponent(item.id)}?projectId=${encodeURIComponent(projectId)}`;
    return thumbnail ? `${base}&thumbnail=1` : base;
  };

  const buildHtmlReportUrl = (testCaseId: string) =>
    `/api/evidence?projectId=${encodeURIComponent(projectId)}&testCaseId=${encodeURIComponent(testCaseId)}`;

  if (!projectId) {
    return (
      <div className="qa-module-page flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
        <Camera className="mb-3 size-10 text-muted-foreground/40" />
        <h2 className="text-base font-semibold">Pilih project terlebih dahulu</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pilih project aktif di sidebar untuk menelusuri brankas bukti pengujian (Evidence Vault).
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="qa-module-page flex flex-col gap-6" aria-label="Evidence Vault">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
              <Camera className="size-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Evidence Vault &amp; Media Gallery
                </h2>
                <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                  Verified QA Artifacts
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Galeri terpusat untuk memeriksa tangkapan layar, rekaman video eksekusi, dan artefak bukti pengujian lintas Test Cycle.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              ref={refreshBtnRef}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadGallery()}
              className="gap-1.5"
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
              Muat Ulang
            </Button>
            {onNavigate && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => onNavigate('testRuns')}
                className="gap-1.5"
              >
                <Layers className="size-3.5" />
                Buka Test Cycles
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <VaultKpiCard
          label="Total File Bukti"
          value={summary.totalFiles}
          sublabel="Artefak tersimpan di project"
          icon={Camera}
          toneClass="border-primary/25 bg-primary/10 text-primary"
        />
        <VaultKpiCard
          label="Bukti Skenario FAILED"
          value={summary.failedEvidenceCount}
          sublabel="Terkait eksekusi gagal"
          icon={ShieldAlert}
          toneClass={
            summary.failedEvidenceCount > 0
              ? 'border-rose-500/25 bg-rose-500/10 text-rose-500'
              : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500'
          }
        />
        <VaultKpiCard
          label="Gambar & Video"
          value={summary.imageCount + summary.videoCount}
          sublabel={`${summary.imageCount} gambar · ${summary.videoCount} video`}
          icon={Film}
          toneClass="border-violet-500/25 bg-violet-500/10 text-violet-500"
        />
        <VaultKpiCard
          label="Pemakaian Storage"
          displayText={formatBytes(summary.totalBytes)}
          sublabel="Kapasitas bukti eksekusi"
          icon={HardDrive}
          toneClass="border-amber-500/25 bg-amber-500/10 text-amber-500"
        />
      </div>

      {/* Filter Bar & Gallery Grid */}
      <Card variant="majestic">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle className="text-base font-bold">Koleksi Artefak Bukti Pengujian</CardTitle>
              <CardDescription className="text-xs">
                Klik kartu bukti untuk membuka pratinjau penuh (Lightbox), mengunduh file asli, atau membuka laporan HTML.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[210px] flex-1 sm:flex-initial">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari TC-ID, halaman, nama file..."
                  className="h-9 pl-8 text-xs"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[145px] text-xs">
                  <SelectValue placeholder="Status Eksekusi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="FAILED">FAILED</SelectItem>
                  <SelectItem value="PASSED">PASSED</SelectItem>
                  <SelectItem value="BLOCKED">BLOCKED</SelectItem>
                </SelectContent>
              </Select>
              <Select value={mediaFilter} onValueChange={setMediaFilter}>
                <SelectTrigger className="h-9 w-[140px] text-xs">
                  <SelectValue placeholder="Tipe Media" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Media</SelectItem>
                  <SelectItem value="image">Gambar (PNG/JPG/WebP)</SelectItem>
                  <SelectItem value="video">Video (WebM/MP4)</SelectItem>
                  <SelectItem value="other">Dokumen / Lainnya</SelectItem>
                </SelectContent>
              </Select>
              <Select value={runFilter} onValueChange={setRunFilter}>
                <SelectTrigger className="h-9 w-[170px] text-xs">
                  <SelectValue placeholder="Semua Test Cycle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Test Cycle</SelectItem>
                  {summary.runs.map((run) => (
                    <SelectItem key={run.id} value={run.id}>
                      {run.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, idx) => (
                <Skeleton key={idx} className="h-64 rounded-2xl" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Camera className="mb-3 size-10 text-muted-foreground/35" />
              <p className="text-sm font-semibold">Belum ada file bukti yang cocok</p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                Unggah tangkapan layar atau rekaman video saat menjalankan pengujian di menu Test Cycles agar muncul di galeri ini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {items.map((item) => {
                const isImage = item.mimeType.startsWith('image/');
                const isVideo = item.mimeType.startsWith('video/');
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedItem(item);
                      }
                    }}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {/* Thumbnail Preview Area */}
                    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden bg-secondary/50">
                      {isImage ? (
                        <img
                          src={buildFileUrl(item, true)}
                          alt={item.fileName}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => {
                            const target = e.currentTarget;
                            if (!target.dataset.fallback) {
                              target.dataset.fallback = '1';
                              target.src = buildFileUrl(item, false);
                            }
                          }}
                        />
                      ) : isVideo ? (
                        <div className="flex flex-col items-center gap-2 text-violet-500">
                          <Film className="size-10" />
                          <span className="rounded-md bg-violet-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold">
                            VIDEO ARTIFACT
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <FileCode2 className="size-10" />
                          <span className="font-mono text-[10px] uppercase">{item.mimeType}</span>
                        </div>
                      )}

                      <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={cn(
                            'backdrop-blur-md text-[10px] font-bold shadow-sm',
                            statusBadgeStyle(item.execution.status)
                          )}
                        >
                          {item.execution.status}
                        </Badge>
                      </div>

                      <div className="absolute bottom-2 right-2 rounded-md bg-background/85 px-2 py-0.5 font-mono text-[10px] font-medium text-foreground backdrop-blur">
                        {formatBytes(item.sizeBytes)}
                      </div>
                    </div>

                    {/* Metadata Footer */}
                    <div className="flex flex-1 flex-col justify-between p-3.5">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-bold text-primary">
                            {item.testCase.testCaseId}
                          </span>
                          <span className="truncate text-[10px] text-muted-foreground">
                            {item.run.name}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-1 text-xs font-semibold text-foreground">
                          {item.fileName}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                          {item.testCase.page} · {item.testCase.testAction}
                        </p>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[10px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 truncate">
                          <UserRound className="size-3" />
                          {item.execution.tester || 'QA Tester'}
                        </span>
                        <span>{formatDateTime(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox Preview Dialog */}
      <Dialog open={Boolean(selectedItem)} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="flex h-[92dvh] max-h-[92dvh] w-[min(96vw,1560px)] max-w-[1560px] sm:max-w-[1560px] flex-col gap-0 overflow-hidden p-0 rounded-2xl border-border/80 shadow-2xl">
          {selectedItem && (() => {
            const currentIndex = items.findIndex((candidate) => candidate.id === selectedItem.id);
            const prevItem = currentIndex > 0 ? items[currentIndex - 1] : null;
            const nextItem =
              currentIndex >= 0 && currentIndex < items.length - 1 ? items[currentIndex + 1] : null;

            return (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <DialogHeader className="shrink-0 border-b border-border/60 bg-card px-6 py-3.5 pr-14">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <DialogTitle className="flex flex-wrap items-center gap-2 text-base font-bold">
                        <span className="rounded-md bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
                          {selectedItem.testCase.testCaseId}
                        </span>
                        <span className="truncate text-sm sm:text-base">{selectedItem.fileName}</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[11px] font-bold',
                            statusBadgeStyle(selectedItem.execution.status)
                          )}
                        >
                          {selectedItem.execution.status}
                        </Badge>
                      </DialogTitle>
                      <DialogDescription className="mt-1 truncate text-xs">
                        Cycle: {selectedItem.run.name} · Halaman: {selectedItem.testCase.page} · Ukuran:{' '}
                        {formatBytes(selectedItem.sizeBytes)}
                      </DialogDescription>
                    </div>

                    {items.length > 1 && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="mr-1 font-mono text-xs text-muted-foreground tabular-nums">
                          {currentIndex + 1} / {items.length}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8 rounded-lg"
                          disabled={!prevItem}
                          onClick={() => prevItem && setSelectedItem(prevItem)}
                          aria-label="Bukti sebelumnya"
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-8 rounded-lg"
                          disabled={!nextItem}
                          onClick={() => nextItem && setSelectedItem(nextItem)}
                          aria-label="Bukti berikutnya"
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogHeader>

                <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_380px]">
                  {/* Left Stage: Image / Video Preview */}
                  <div className="relative flex h-[50dvh] min-h-[280px] lg:h-full items-center justify-center overflow-hidden bg-slate-950/95">
                    {selectedItem.mimeType.startsWith('image/') ? (
                      <EvidenceInteractiveImageViewer
                        src={buildFileUrl(selectedItem, false)}
                        alt={selectedItem.fileName}
                      />
                    ) : selectedItem.mimeType.startsWith('video/') ? (
                      <div className="flex h-full w-full items-center justify-center p-4 lg:p-6">
                        <video
                          src={buildFileUrl(selectedItem, false)}
                          controls
                          autoPlay
                          className="max-h-full max-w-full rounded-lg shadow-2xl object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-12 text-white">
                        <FileText className="size-12 text-white/60" />
                        <p className="text-sm font-medium">{selectedItem.fileName}</p>
                        <p className="text-xs text-white/60">
                          Gunakan tombol Unduh File untuk membuka artefak ini.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Right Sidebar: Scrollable Execution Details & Sticky Action Buttons */}
                  <div className="flex h-full min-h-0 flex-col border-t border-border/60 bg-card lg:border-l lg:border-t-0">
                    <div
                      data-lenis-prevent
                      className="flex-1 space-y-3.5 overflow-y-auto overscroll-contain p-5 text-xs"
                    >
                      <div className="rounded-xl border border-border/60 bg-secondary/25 p-3.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Skenario Pengujian
                        </p>
                        <p className="mt-1 font-semibold leading-relaxed text-foreground">
                          {selectedItem.testCase.testAction}
                        </p>
                      </div>

                      {selectedItem.execution.actualResult && (
                        <div className="rounded-xl border border-border/60 bg-secondary/20 p-3.5">
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Hasil Aktual
                          </p>
                          <div className="text-xs text-foreground/90 [&_p]:text-xs [&_li]:text-xs">
                            <ExecutionMarkdown>{selectedItem.execution.actualResult}</ExecutionMarkdown>
                          </div>
                        </div>
                      )}

                      {selectedItem.execution.notes && (
                        <div className="rounded-xl border border-border/60 bg-secondary/20 p-3.5">
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Catatan Eksekusi
                          </p>
                          <div className="text-xs text-muted-foreground [&_p]:text-xs [&_li]:text-xs">
                            <ExecutionMarkdown>{selectedItem.execution.notes}</ExecutionMarkdown>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/50 bg-background p-3 text-[11px]">
                        <div>
                          <span className="block text-[10px] text-muted-foreground">Tester</span>
                          <span className="font-medium text-foreground">
                            {selectedItem.execution.tester || 'QA Tester'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-muted-foreground">Waktu Unggah</span>
                          <span className="font-medium text-foreground">
                            {formatDateTime(selectedItem.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid shrink-0 grid-cols-2 gap-2.5 border-t border-border/60 bg-card/95 p-4">
                      <Button asChild variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                        <a
                          href={buildFileUrl(selectedItem, false)}
                          download={selectedItem.fileName}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download className="size-3.5" />
                          Unduh File
                        </a>
                      </Button>
                      <Button asChild size="sm" className="w-full gap-1.5 text-xs">
                        <a
                          href={buildHtmlReportUrl(selectedItem.testCase.id)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="size-3.5" />
                          Laporan HTML
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
