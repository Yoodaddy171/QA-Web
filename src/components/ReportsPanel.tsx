'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MutationAction } from '@/components/WorkspaceAccess';
import { ArrowLeft, FileCheck, FileCode2, FileText, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { fetchReportPage, fetchReportDetail } from '@/lib/client/api/reports-client';
import { ReportForm } from './ReportForm';
import { ReportHistory } from './ReportHistory';
import { ReportViewer } from './ReportViewer';
import type { ReportData, ReportSummary, ReportType } from '@/lib/services/report-types';
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
  const [createTemplate, setCreateTemplate] = useState<ReportType>('TEST_STATUS_REPORT');
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
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="qa-module-page"
      >
        <Button variant="ghost" onClick={closeForm} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Reports
        </Button>
        <ReportForm
          projectId={projectId}
          report={editingReport || undefined}
          initialType={createTemplate}
          onReportSaved={upsertReport}
          onCancel={closeForm}
        />
      </motion.div>
    );
  }

  if (selectedReport) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="qa-module-page"
      >
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
      </motion.div>
    );
  }

  const startCreateWithTemplate = (template: ReportType) => {
    setCreateTemplate(template);
    setIsCreating(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className="qa-module-page flex flex-col gap-5"
    >
      <div className="qa-module-toolbar flex flex-col gap-4 rounded-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Laporan Pengujian (QA Reports)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Buat dan tinjau dokumen formal Test Status Report (TSR) maupun Test Planning Document (TPD).</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onNavigate && (
              <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => onNavigate('traceability')}>
                <FileCheck className="h-3.5 w-3.5 text-status-passed" />
                Audit Matriks Traceability
              </Button>
            )}
            <MutationAction>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                disabled={loadingMore || Boolean(openingId)}
                onClick={() => startCreateWithTemplate('TEST_PLANNING_DOCUMENT')}
              >
                <FileCode2 className="h-3.5 w-3.5 text-amber-800 dark:text-amber-300" />
                Buat Test Planning (TPD)
              </Button>
            </MutationAction>
            <MutationAction>
              <Button
                size="sm"
                className="h-8 gap-1.5 text-xs"
                disabled={loadingMore || Boolean(openingId)}
                onClick={() => startCreateWithTemplate('TEST_STATUS_REPORT')}
              >
                <Plus className="h-3.5 w-3.5" />
                Buat Status Report (TSR)
              </Button>
            </MutationAction>
          </div>
        </div>
      </div>

      <ReportHistory reports={isLoading ? [] : reports} onViewReport={item => void openReport(item)}
        openingId={openingId || (loadingMore ? 'paging' : null)} filters={filters} onFiltersChange={setFilters}
        total={total} matchedTotal={matchedTotal} loading={isLoading} error={isLoading ? null : loadError}
        onRetry={() => setRevision(current => current + 1)} />
      {!isLoading && !loadError && nextCursor && <Button variant="outline" disabled={loadingMore || Boolean(openingId)} onClick={() => void loadMore()}>{loadingMore ? 'Memuat…' : 'Muat report berikutnya'}</Button>}
    </motion.div>
  );
}
