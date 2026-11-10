'use client';

import { useEffect, useRef, useState } from 'react';
import { MutationAction } from '@/components/WorkspaceAccess';
import { ArrowLeft, FileCheck, FileCode2, FileText, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { fetchReportPage, fetchReportDetail } from '@/lib/client/api/reports-client';
import { ReportForm } from './ReportForm';
import { ReportHistory } from './ReportHistory';
import { ReportViewer } from './ReportViewer';
import type { ReportData, ReportSummary } from '@/lib/services/report-types';
import { DEFAULT_REPORT_FILTERS, normalizeReportFilters, type ReportFilters } from '@/lib/domain/report-filters';

interface ReportsPanelProps {
  projectId: string;
  onNavigate?: (tab: 'testRuns' | 'traceability' | 'bugfix' | 'testcases') => void;
}

export function ReportsPanel({ projectId, onNavigate }: ReportsPanelProps) {
  return <ProjectReportsPanel key={projectId} projectId={projectId} onNavigate={onNavigate} />;
}

function ProjectReportsPanel({ projectId, onNavigate }: ReportsPanelProps) {
  const { toast } = useToast();
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  const projectRef = useRef(projectId);
  const morePending = useRef(false);
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
  const [editingReport, setEditingReport] = useState<ReportData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [filters, setFilters] = useState<ReportFilters>({ ...DEFAULT_REPORT_FILTERS });
  const [revision, setRevision] = useState(0);
  const [total, setTotal] = useState(0);
  const [matchedTotal, setMatchedTotal] = useState(0);
  const normalized = normalizeReportFilters(filters);
  const queryKey = JSON.stringify([projectId, normalized.search, normalized.status, normalized.type, revision]);
  const [loadedQueryKey, setLoadedQueryKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isLoading = loadedQueryKey !== queryKey;

  useEffect(() => {
    let active = true;
    projectRef.current = projectId;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    morePending.current = false;
    const timer = window.setTimeout(() => {
      setLoadingMore(false);
      void fetchReportPage(projectId, undefined, controller.signal, normalized)
      .then((data) => {
        if (active) {
          setReports(data.reports); setNextCursor(data.hasMore ? data.nextCursor : null);
          setTotal(data.total); setMatchedTotal(data.matchedTotal);
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (active) {
          const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
          setLoadError(message);
          toast({ title: 'Gagal memuat report', description: message, variant: 'destructive' });
        }
      })
      .finally(() => { if (active) setLoadedQueryKey(queryKey); });
    }, normalized.search ? 250 : 0);
    return () => { active = false; window.clearTimeout(timer); request.current?.abort(); };
  }, [projectId, queryKey, toast]);

  useEffect(() => () => detailRequest.current?.abort(), []);

  const loadMore = async () => {
    if (isLoading || !nextCursor || morePending.current) return;
    morePending.current = true; setLoadingMore(true);
    const controller = new AbortController(); request.current = controller;
    try {
      const data = await fetchReportPage(projectId, nextCursor, controller.signal, normalized);
      if (controller.signal.aborted || projectRef.current !== projectId) return;
      setReports(previous => { const ids = new Set(previous.map(item => item.id)); return [...previous, ...data.reports.filter(item => !ids.has(item.id))]; });
      setNextCursor(data.hasMore ? data.nextCursor : null);
      setTotal(data.total); setMatchedTotal(data.matchedTotal);
    } catch (error) { if (!controller.signal.aborted) toast({ title: 'Report berikutnya gagal dimuat', description: error instanceof Error ? error.message : 'Coba lagi.', variant: 'destructive' }); }
    finally { if (!controller.signal.aborted) { morePending.current = false; setLoadingMore(false); } }
  };
  const openReport = async (item: ReportSummary) => {
    detailRequest.current?.abort();
    const controller = new AbortController(); detailRequest.current = controller;
    setOpeningId(item.id);
    try {
      const data = await fetchReportDetail(projectId, item.id, controller.signal);
      if (!controller.signal.aborted && projectRef.current === projectId) setSelectedReport(data);
    } catch (error) { if (!controller.signal.aborted) toast({ title: 'Detail report gagal dimuat', description: error instanceof Error ? error.message : 'Coba lagi.', variant: 'destructive' }); }
    finally { if (!controller.signal.aborted) setOpeningId(null); }
  };

  const closeForm = () => {
    setIsCreating(false);
    setEditingReport(null);
  };

  const upsertReport = (report: ReportData) => {
    setRevision(current => current + 1);
    setSelectedReport(report);
    closeForm();
  };

  if (isCreating || editingReport) {
    return (
      <div className="qa-module-page">
        <Button variant="ghost" onClick={closeForm} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Reports
        </Button>
        <ReportForm projectId={projectId} report={editingReport || undefined} onReportSaved={upsertReport} onCancel={closeForm} />
      </div>
    );
  }

  if (selectedReport) {
    return (
      <div className="qa-module-page">
        <Button variant="ghost" onClick={() => setSelectedReport(null)} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Reports
        </Button>
        <ReportViewer
          report={selectedReport}
          onEdit={(report) => setEditingReport(report)}
          onReportChange={(report) => {
            setSelectedReport(report);
            setRevision(current => current + 1);
          }}
          onNavigate={onNavigate}
        />
      </div>
    );
  }

  return (
    <div className="qa-module-page flex flex-col gap-5">
      <div className="qa-module-toolbar flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Laporan Pengujian (QA Reports)</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Buat dan tinjau dokumen formal Test Status Report maupun perencanaan Test Planning.</p>
        </div>
        <MutationAction><Button size="sm" disabled={loadingMore || Boolean(openingId)} onClick={() => setIsCreating(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Buat Report
        </Button></MutationAction>
      </div>

      {/* 3 Report Template Selector Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="group flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-primary/40 hover:bg-secondary/20">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileText className="size-4" />
              </div>
              <Badge variant="outline" className="border-primary/30 text-[11px] text-primary">Status & Readiness</Badge>
            </div>
            <h3 className="text-sm font-semibold text-foreground">Test Status Report (TSR)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ringkasan komprehensif metrik pengujian, rasio lulus/gagal, defect blocker, dan rekomendasi rilis produksi.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
            <span className="text-[11px] font-mono text-muted-foreground">DOCX / Web</span>
            <Button size="sm" variant="outline" className="h-7 text-xs font-medium" onClick={() => setIsCreating(true)}>
              Pilih Template
            </Button>
          </div>
        </div>

        <div className="group flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-primary/40 hover:bg-secondary/20">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                <FileCode2 className="size-4" />
              </div>
              <Badge variant="outline" className="border-amber-500/30 text-[11px] text-amber-500">Sprint & Planning</Badge>
            </div>
            <h3 className="text-sm font-semibold text-foreground">Test Planning Document (TPD)</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Dokumen perencanaan cakupan uji, alokasi modul fitur, jadwal eksekusi QA, dan mitigasi risiko teknis.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
            <span className="text-[11px] font-mono text-muted-foreground">DOCX / Web</span>
            <Button size="sm" variant="outline" className="h-7 text-xs font-medium" onClick={() => setIsCreating(true)}>
              Pilih Template
            </Button>
          </div>
        </div>

        <div className="group flex flex-col justify-between rounded-xl border border-border/80 bg-card p-4 shadow-xs transition-all hover:border-primary/40 hover:bg-secondary/20">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                <FileCheck className="size-4" />
              </div>
              <Badge variant="outline" className="border-emerald-500/30 text-[11px] text-emerald-500">Audit & Gaps</Badge>
            </div>
            <h3 className="text-sm font-semibold text-foreground">Traceability Matrix Audit</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Pemetaan ketertelusuran kebutuhan bisnis ke skenario uji dan identifikasi celah coverage yang belum teruji.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
            <span className="text-[11px] font-mono text-muted-foreground">Traceability Link</span>
            <Button size="sm" variant="outline" className="h-7 text-xs font-medium" onClick={() => onNavigate?.('traceability')}>
              Buka Matriks
            </Button>
          </div>
        </div>
      </div>

      <ReportHistory reports={isLoading ? [] : reports} onViewReport={item => void openReport(item)}
        openingId={openingId || (loadingMore ? 'paging' : null)} filters={filters} onFiltersChange={setFilters}
        total={total} matchedTotal={matchedTotal} loading={isLoading} error={isLoading ? null : loadError}
        onRetry={() => setRevision(current => current + 1)} />
      {!isLoading && !loadError && nextCursor && <Button variant="outline" disabled={loadingMore || Boolean(openingId)} onClick={() => void loadMore()}>{loadingMore ? 'Memuat…' : 'Muat report berikutnya'}</Button>}
    </div>
  );
}
