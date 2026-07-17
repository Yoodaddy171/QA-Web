'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { fetchReports } from '@/lib/client/api/reports-client';
import { ReportForm } from './ReportForm';
import { ReportHistory } from './ReportHistory';
import { ReportViewer } from './ReportViewer';
import type { ReportData } from '@/lib/services/report-types';

interface ReportsPanelProps {
  projectId: string;
  onNavigate?: (tab: 'testRuns' | 'traceability' | 'bugfix' | 'testcases') => void;
}

export function ReportsPanel({ projectId, onNavigate }: ReportsPanelProps) {
  const { toast } = useToast();
  const [reports, setReports] = useState<ReportData[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
  const [editingReport, setEditingReport] = useState<ReportData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isLoading = loadedProjectId !== projectId;

  useEffect(() => {
    let active = true;
    fetchReports(projectId)
      .then((data) => {
        if (active) {
          setReports(data);
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
      .finally(() => { if (active) setLoadedProjectId(projectId); });
    return () => { active = false; };
  }, [projectId, toast]);

  const closeForm = () => {
    setIsCreating(false);
    setEditingReport(null);
  };

  const upsertReport = (report: ReportData) => {
    setReports((current) => [report, ...current.filter(item => item.id !== report.id)]);
    setSelectedReport(report);
    closeForm();
  };

  if (isCreating || editingReport) {
    return (
      <div>
        <Button variant="ghost" onClick={closeForm} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Reports
        </Button>
        <ReportForm projectId={projectId} report={editingReport || undefined} onReportSaved={upsertReport} onCancel={closeForm} />
      </div>
    );
  }

  if (selectedReport) {
    return (
      <div>
        <Button variant="ghost" onClick={() => setSelectedReport(null)} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Kembali ke Reports
        </Button>
        <ReportViewer
          report={selectedReport}
          onEdit={(report) => setEditingReport(report)}
          onReportChange={(report) => {
            setSelectedReport(report);
            setReports((current) => [report, ...current.filter(item => item.id !== report.id)]);
          }}
          onNavigate={onNavigate}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="signal-surface mb-4 flex flex-col gap-3 rounded-xl border border-border/70 bg-card/95 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">Buat dan tinjau Test Status Report maupun dokumen Test Planning.</p>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Buat Report
        </Button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-label="Memuat report"><Skeleton className="h-36 w-full rounded-xl" /><Skeleton className="h-36 w-full rounded-xl" /></div>
      ) : loadError ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"><p className="font-semibold text-destructive">Report gagal dimuat</p><p className="mt-1 text-sm text-muted-foreground">{loadError}</p></div>
      ) : (
        <ReportHistory reports={reports} onViewReport={setSelectedReport} />
      )}
    </div>
  );
}
