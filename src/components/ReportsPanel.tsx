'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { fetchReports } from '@/lib/client/api/reports-client';
import { ReportForm } from './ReportForm';
import { ReportHistory } from './ReportHistory';
import { ReportViewer } from './ReportViewer';
import type { ReportData } from '@/lib/services/report-types';

interface ReportsPanelProps {
  projectId: string;
}

export function ReportsPanel({ projectId }: ReportsPanelProps) {
  const { toast } = useToast();
  const [reports, setReports] = useState<ReportData[]>([]);
  const [selectedReport, setSelectedReport] = useState<ReportData | null>(null);
  const [editingReport, setEditingReport] = useState<ReportData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    // setState happens after the await (not synchronously in the effect body),
    // and is guarded so a project switch can't apply stale results.
    fetchReports(projectId)
      .then((data) => { if (active) setReports(data); })
      .catch((error) => {
        if (active) toast({ title: 'Gagal memuat report', description: error instanceof Error ? error.message : 'Terjadi kesalahan.', variant: 'destructive' });
      })
      .finally(() => { if (active) setIsLoading(false); });
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
      <div className="p-6">
        <Button variant="ghost" onClick={closeForm} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Reports
        </Button>
        <ReportForm projectId={projectId} report={editingReport || undefined} onReportSaved={upsertReport} onCancel={closeForm} />
      </div>
    );
  }

  if (selectedReport) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => setSelectedReport(null)} className="mb-4 gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Reports
        </Button>
        <ReportViewer
          report={selectedReport}
          onEdit={(report) => setEditingReport(report)}
          onReportChange={(report) => {
            setSelectedReport(report);
            setReports((current) => [report, ...current.filter(item => item.id !== report.id)]);
          }}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Reports</h1>
            <p className="text-sm text-muted-foreground">Create Test Status Report and Test Planning documents</p>
          </div>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Report
        </Button>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-muted-foreground">Loading reports...</div>
      ) : (
        <ReportHistory reports={reports} onViewReport={setSelectedReport} />
      )}
    </div>
  );
}
