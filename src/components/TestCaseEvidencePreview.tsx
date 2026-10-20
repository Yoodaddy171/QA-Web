'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { evidenceArrowDirection } from '@/lib/client/evidence-preview-navigation';

type Evidence = { fileName: string; mimeType: string };

function PdfPreview({ url, fileName }: { url: string; fileName: string }) {
  const [source, setSource] = useState('');
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let objectUrl = '';
    void fetch(url, { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('PDF tidak dapat dimuat.');
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      // The API intentionally serves PDFs as attachments. Preview a typed blob
      // instead of navigating to that attachment URL or weakening its headers.
      objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      setSource(objectUrl);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  if (error) return <p role="alert" className="p-6 text-sm text-destructive">PDF gagal dimuat. Anda dapat mengunduh file di bawah.</p>;
  if (!source) return <Skeleton className="h-full w-full" aria-label="Memuat PDF" />;
  return <iframe src={source} title={`Preview PDF ${fileName}`} className="h-full w-full border-0" />;
}

function EvidenceMedia({ evidence, url }: { evidence: Evidence; url: string }) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const isImage = evidence.mimeType.startsWith('image/');
  const isVideo = evidence.mimeType.startsWith('video/');
  const isPdf = evidence.mimeType === 'application/pdf';
  return error ? <p role="alert" className="p-4 text-sm text-destructive">Evidence gagal dimuat. Coba tutup dan buka kembali preview.</p> : isImage || isVideo ? <>
    {!loaded && <Skeleton className="absolute inset-3" aria-label="Memuat evidence" />}
    {isImage ? <img src={url} alt={evidence.fileName} className="h-full w-full object-contain" onLoad={() => setLoaded(true)} onError={() => { setLoaded(true); setError(true); }} /> : <video src={url} controls preload="metadata" className="h-full w-full object-contain" onLoadedMetadata={() => setLoaded(true)} onError={() => { setLoaded(true); setError(true); }} />}
  </> : isPdf ? <PdfPreview url={url} fileName={evidence.fileName} /> : <p className="max-w-md p-4 text-center text-sm leading-6 text-muted-foreground">Preview belum tersedia untuk jenis file ini. Gunakan tombol Unduh file untuk melihatnya di perangkat Anda.</p>;
}

export function TestCaseEvidencePreview({ evidence, url, open, onOpenChange, onReturnFocus, photoIndex = -1, photoCount = 0, onPhotoChange }: {
  evidence: Evidence; url: string; open: boolean; onOpenChange: (open: boolean) => void; onReturnFocus: () => void;
  photoIndex?: number; photoCount?: number; onPhotoChange?: (direction: -1 | 1) => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const isPhoto = evidence.mimeType.startsWith('image/') && photoIndex >= 0;
  const hasPrevious = isPhoto && photoIndex > 0;
  const hasNext = isPhoto && photoIndex < photoCount - 1;
  const navigate = (direction: -1 | 1) => {
    if (direction === -1 ? !hasPrevious : !hasNext) return;
    onPhotoChange?.(direction);
    // Keep focus inside the stable dialog even when the clicked edge button
    // becomes disabled. The original gallery trigger is restored only on close.
    dialogRef.current?.focus({ preventScroll: true });
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent ref={dialogRef} onKeyDown={event => {
      if (!open || !isPhoto || photoCount < 2) return;
      const interactive = event.target instanceof Element && Boolean(event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], video, audio, iframe, [role="slider"]'));
      const direction = evidenceArrowDirection({ ...event, isComposing: event.nativeEvent.isComposing }, interactive);
      if (!direction) return;
      event.preventDefault(); event.stopPropagation(); navigate(direction);
    }} onCloseAutoFocus={event => { event.preventDefault(); onReturnFocus(); }} showCloseButton={false} className="flex h-[88dvh] flex-col gap-0 overflow-hidden bg-background p-0 text-foreground sm:max-w-[min(1100px,calc(100vw-2rem))]">
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border bg-background p-4">
        <DialogHeader className="min-w-0 text-left"><DialogTitle>Preview evidence</DialogTitle><DialogDescription className="break-words">{evidence.fileName}</DialogDescription></DialogHeader>
        <DialogClose asChild><Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label="Tutup preview evidence"><X /></Button></DialogClose>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-secondary/10 p-3">
        <EvidenceMedia key={`${open}:${url}`} evidence={evidence} url={url} />
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border p-3">
        {isPhoto ? <div className="flex items-center gap-2" role="group" aria-label="Navigasi foto evidence">
          {photoCount > 1 && <Button type="button" variant="outline" size="icon" className="size-11" disabled={!hasPrevious} onClick={() => navigate(-1)} aria-label="Foto sebelumnya" title="Foto sebelumnya (←)"><ChevronLeft /></Button>}
          <span role="status" aria-live="polite" aria-atomic="true" className="text-xs tabular-nums text-muted-foreground">Foto {photoIndex + 1} dari {photoCount}</span>
          {photoCount > 1 && <Button type="button" variant="outline" size="icon" className="size-11" disabled={!hasNext} onClick={() => navigate(1)} aria-label="Foto berikutnya" title="Foto berikutnya (→)"><ChevronRight /></Button>}
        </div> : <span />}
        <Button asChild variant="outline" size="sm"><a href={url} download={evidence.fileName}><Download data-icon="inline-start" />Unduh file</a></Button>
      </div>
    </DialogContent>
  </Dialog>;
}
