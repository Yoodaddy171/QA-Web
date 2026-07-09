'use client';

import { Button } from '@/components/ui/button';
import { FileText, Eye } from 'lucide-react';
import type { ReportData } from '@/lib/services/report-types';
import { Badge } from '@/components/ui/badge';

interface ReportHistoryProps {
  reports: ReportData[];
  onViewReport: (report: ReportData) => void;
}

export function ReportHistory({ reports, onViewReport }: ReportHistoryProps) {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  };

  if (reports.length === 0) {
    return (
      <div className="rounded-lg border border-border/60 bg-card py-12 text-center shadow-sm">
        <FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-semibold text-foreground">No Reports Yet</h3>
        <p className="text-muted-foreground">Generate your first test report to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="mb-4 text-lg font-semibold text-foreground">Report History</h2>
      
      {reports.map((report) => (
        <div
          key={report.id}
          className="rounded-lg border border-border/60 bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">
                  {report.reportType === 'TEST_STATUS_REPORT' ? 'Test Status Report FDS' : 'Test Planning FDS'}
                </h3>
                <span className="text-sm text-muted-foreground">v{report.version}</span>
                <Badge variant={report.status === 'FINAL' ? 'success' : 'secondary'}>{report.status}</Badge>
              </div>
              
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  <span className="font-medium">Project:</span> {report.projectName}
                </p>
                <p>
                  <span className="font-medium">Period:</span>{' '}
                  {formatDate(report.reportingPeriodStart)} - {formatDate(report.reportingPeriodEnd)}
                </p>
                <p>
                  <span className="font-medium">Generated:</span> {formatDate(report.generatedAt)}
                </p>
                <div className="mt-2 flex gap-4">
                  <span className="rounded bg-emerald-500/10 px-2 py-1 text-xs text-emerald-500">
                    {report.metrics.totalPassed} Passed
                  </span>
                  <span className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-500">
                    {report.metrics.totalFailed} Failed
                  </span>
                  <span className="rounded bg-secondary px-2 py-1 text-xs text-muted-foreground">
                    {report.metrics.passRate.toFixed(1)}% Pass Rate
                  </span>
                </div>
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewReport(report)}
            >
              <Eye className="w-4 h-4 mr-2" />
              View
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
