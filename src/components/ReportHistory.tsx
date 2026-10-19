'use client';

import { Button } from '@/components/ui/button';
import { useWorkspaceAccess } from '@/components/WorkspaceAccess';
import { FileText, Eye } from 'lucide-react';
import type { ReportData } from '@/lib/services/report-types';
import { Badge } from '@/components/ui/badge';

interface ReportHistoryProps {
  reports: ReportData[];
  onViewReport: (report: ReportData) => void;
}

export function ReportHistory({ reports, onViewReport }: ReportHistoryProps) {
  const { canEdit } = useWorkspaceAccess();
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  };

  if (reports.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card px-5 py-12 text-center">
        <FileText className="mx-auto mb-4 size-9 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold text-foreground">Belum ada report</h3>
        <p className="mx-auto max-w-lg text-sm leading-6 text-muted-foreground">{canEdit ? 'Buat report pertama untuk memulai.' : 'Belum ada report yang tersedia. Pembuatan report memerlukan role QA atau lebih tinggi.'}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="qa-module-heading mb-1">Riwayat Report</h2>
      
      {reports.map((report) => (
        <div
          key={report.id}
          className="rounded-xl border border-border bg-card p-4 sm:p-5"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">
                  {report.reportType === 'TEST_STATUS_REPORT' ? 'Test Status Report FDS' : 'Test Planning FDS'}
                </h3>
                <span className="text-sm text-muted-foreground">v{report.version}</span>
                <Badge variant={report.status === 'FINAL' ? 'success' : 'secondary'}>{report.status}</Badge>
              </div>
              
              <div className="grid gap-x-6 gap-y-2 text-xs leading-5 text-muted-foreground sm:grid-cols-2">
                <p>
                  <span className="font-medium">Project:</span> {report.projectName}
                </p>
                <p>
                  <span className="font-medium">Periode:</span>{' '}
                  {formatDate(report.reportingPeriodStart)} - {formatDate(report.reportingPeriodEnd)}
                </p>
                <p>
                  <span className="font-medium">Dibuat:</span> {formatDate(report.generatedAt)}
                </p>
                <div className="mt-2 flex flex-wrap gap-2 sm:col-span-2">
                  <Badge variant="success">
                    {report.metrics.totalPassed} Passed
                  </Badge>
                  <Badge variant="failed">
                    {report.metrics.totalFailed} Failed
                  </Badge>
                  <Badge variant="outline">
                    {report.metrics.passRate.toFixed(1)}% pass rate
                  </Badge>
                </div>
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              className="min-h-9 shrink-0 self-start"
              onClick={() => onViewReport(report)}
            >
              <Eye className="w-4 h-4 mr-2" />
              Lihat
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
