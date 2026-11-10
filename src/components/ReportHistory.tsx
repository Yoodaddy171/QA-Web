'use client';

import { useId } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useWorkspaceAccess } from '@/components/WorkspaceAccess';
import { FileText, Eye, RotateCcw, Search, X } from 'lucide-react';
import type { ReportSummary } from '@/lib/services/report-types';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { DEFAULT_REPORT_FILTERS, normalizeSearch, type ReportFilters } from '@/lib/domain/report-filters';

interface ReportHistoryProps {
  reports: ReportSummary[];
  onViewReport: (report: ReportSummary) => void;
  openingId?: string | null;
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
  total: number;
  matchedTotal: number;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export function ReportHistory({ reports, onViewReport, openingId, filters, onFiltersChange, total, matchedTotal, loading, error, onRetry }: ReportHistoryProps) {
  const { canEdit } = useWorkspaceAccess();
  const searchId = useId();
  const { search, status: statusFilter, type: typeFilter } = filters;
  const resetFilters = () => onFiltersChange({ ...DEFAULT_REPORT_FILTERS });

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(date));
  };

  const hasActiveFilters = normalizeSearch(search) !== '' || statusFilter !== 'ALL' || typeFilter !== 'ALL';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:max-w-sm">
          <label htmlFor={searchId} className="text-xs font-medium">Cari laporan</label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-2.5 top-3 size-4 text-muted-foreground" />
            <Input
              id={searchId}
              placeholder="Cari report, tipe, atau versi..."
              value={search}
              maxLength={200}
              onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
              className="h-10 pl-8 pr-10"
            />
            {search && (
              <button
                type="button"
                onClick={() => onFiltersChange({ ...filters, search: '' })}
                className="absolute right-0 top-0 flex size-10 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                aria-label="Hapus pencarian"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tipe</span>
            <div className="h-9 inline-flex items-center rounded-xl border border-border/60 bg-secondary/30 p-0.5">
              <ToggleGroup
                type="single"
                size="sm"
                aria-label="Tipe laporan"
                value={typeFilter}
                onValueChange={(value: ReportFilters['type']) => { if (value) onFiltersChange({ ...filters, type: value }); }}
                className="gap-1"
              >
                <ToggleGroupItem
                  value="ALL"
                  className="h-7 shrink-0 rounded-lg px-3 text-xs font-medium transition data-[state=on]:bg-card data-[state=on]:text-primary data-[state=on]:shadow-sm text-muted-foreground hover:text-foreground"
                >
                  Semua Tipe
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="TEST_STATUS_REPORT"
                  className="h-7 shrink-0 rounded-lg px-3 text-xs font-medium transition data-[state=on]:bg-card data-[state=on]:text-primary data-[state=on]:shadow-sm text-muted-foreground hover:text-foreground"
                >
                  Status Report
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="TEST_PLANNING_DOCUMENT"
                  className="h-7 shrink-0 rounded-lg px-3 text-xs font-medium transition data-[state=on]:bg-card data-[state=on]:text-primary data-[state=on]:shadow-sm text-muted-foreground hover:text-foreground"
                >
                  Test Planning
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <div className="h-5 w-px bg-border/60 hidden sm:block" />

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</span>
            <div className="h-9 inline-flex items-center rounded-xl border border-border/60 bg-secondary/30 p-0.5">
              <ToggleGroup
                type="single"
                size="sm"
                aria-label="Status laporan"
                value={statusFilter}
                onValueChange={(value: ReportFilters['status']) => { if (value) onFiltersChange({ ...filters, status: value }); }}
                className="gap-1"
              >
                <ToggleGroupItem
                  value="ALL"
                  className="h-7 shrink-0 rounded-lg px-3 text-xs font-medium transition data-[state=on]:bg-card data-[state=on]:text-primary data-[state=on]:shadow-sm text-muted-foreground hover:text-foreground"
                >
                  Semua Status
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="FINAL"
                  className="h-7 shrink-0 rounded-lg px-3 text-xs font-medium transition data-[state=on]:bg-card data-[state=on]:text-primary data-[state=on]:shadow-sm text-muted-foreground hover:text-foreground"
                >
                  Final
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="DRAFT"
                  className="h-7 shrink-0 rounded-lg px-3 text-xs font-medium transition data-[state=on]:bg-card data-[state=on]:text-primary data-[state=on]:shadow-sm text-muted-foreground hover:text-foreground"
                >
                  Draft
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            disabled={!hasActiveFilters}
            className={cn(
              "h-9 rounded-xl px-2.5 text-xs font-medium transition flex items-center gap-1",
              hasActiveFilters
                ? "text-muted-foreground hover:text-foreground hover:bg-secondary/60 cursor-pointer"
                : "text-muted-foreground/35 cursor-not-allowed opacity-50"
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between px-1">
        <h2 className="qa-module-heading">Riwayat Report</h2>
        <span role="status" className="text-xs text-muted-foreground font-mono tabular-nums">
          {loading ? 'Mencari laporan…' : error ? 'Laporan gagal dimuat' : `${matchedTotal} dari ${total} report`}
          {!loading && !error && reports.length < matchedTotal ? ` · ${reports.length} ditampilkan` : ''}
        </span>
      </div>

      {loading ? (
        <div aria-label="Memuat report" aria-busy="true"><Skeleton className="h-36 w-full rounded-xl" /></div>
      ) : error ? (
        <div role="alert" className="rounded-xl border border-border bg-card p-6">
          <p>Report gagal dimuat. {error}</p>
          <Button variant="outline" onClick={onRetry} className="mt-3">Coba lagi</Button>
        </div>
      ) : reports.length === 0 && !hasActiveFilters ? (
        <EmptyState icon={FileText} title="Belum ada report"
          description={canEdit ? 'Buat report pertama untuk memulai.' : 'Belum ada report yang tersedia. Pembuatan report memerlukan role QA atau lebih tinggi.'} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Tidak ada report yang cocok"
          description="Tidak ada dokumen laporan yang sesuai dengan kata kunci pencarian atau kombinasi filter aktif."
          action={{
            label: 'Reset Filter',
            onClick: resetFilters,
            variant: 'outline',
          }}
          className="rounded-xl border border-border bg-card py-12"
        />
      ) : (
        reports.map((report) => (
          <div
            key={report.id}
            className="rounded-xl border border-border/80 bg-card p-4 sm:p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold text-foreground">
                    {report.reportType === 'TEST_STATUS_REPORT' ? 'Test Status Report' : 'Test Planning Document'}
                  </h3>
                  <span className="text-sm text-muted-foreground">v{report.version}</span>
                  <Badge variant={report.status === 'FINAL' ? 'success' : 'secondary'}>{report.status}</Badge>
                </div>

                <div className="grid gap-x-6 gap-y-2 text-xs leading-5 text-muted-foreground sm:grid-cols-2">
                  <p>
                    <span className="font-medium text-foreground">Project:</span> {report.projectName}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Periode:</span>{' '}
                    {formatDate(report.reportingPeriodStart)} - {formatDate(report.reportingPeriodEnd)}
                  </p>
                  <p>
                    <span className="font-medium text-foreground">Dibuat:</span> {formatDate(report.generatedAt)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 sm:col-span-2">
                    <Badge variant="success" className="font-mono tabular-nums">
                      {report.metrics.totalPassed} Passed
                    </Badge>
                    <Badge variant="failed" className="font-mono tabular-nums">
                      {report.metrics.totalFailed} Failed
                    </Badge>
                    <Badge variant="outline" className="font-mono tabular-nums">
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
                disabled={Boolean(openingId)}
              >
                <Eye className="w-4 h-4 mr-2" />
                {openingId === report.id ? 'Membuka…' : 'Lihat'}
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
