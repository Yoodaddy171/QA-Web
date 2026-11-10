import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { ReportHistory } from './ReportHistory';
import { DEFAULT_REPORT_FILTERS } from '@/lib/domain/report-filters';

vi.mock('@/components/WorkspaceAccess', () => ({ useWorkspaceAccess: () => ({ canEdit: true }) }));

describe('REPORT-FILTER-A11Y', () => {
  const props = { reports: [], onViewReport: vi.fn(), filters: { ...DEFAULT_REPORT_FILTERS, status: 'FINAL' as const }, onFiltersChange: vi.fn(), total: 31, matchedTotal: 0 };
  it('exposes named filter groups, selected state and a labeled search', () => {
    const html = renderToStaticMarkup(<ReportHistory {...props} />);
    expect(html).toContain('aria-label="Tipe laporan"');
    expect(html).toContain('aria-label="Status laporan"');
    expect(html).toMatch(/role="radio"[^>]*aria-checked="true"[^>]*>Final/);
    expect(html).toContain('Cari laporan</label>');
    expect(html).toContain('0 dari 31 report');
    expect(html).toContain('Reset Filter');
  });
  it('keeps filter controls available during loading and errors', () => {
    const loading = renderToStaticMarkup(<ReportHistory {...props} loading />);
    expect(loading).toContain('Mencari laporan');
    expect(loading).not.toContain('Tidak ada report yang cocok');
    const error = renderToStaticMarkup(<ReportHistory {...props} error="Offline" onRetry={vi.fn()} />);
    expect(error).toContain('Coba lagi');
    expect(error).toContain('Status laporan');
  });
});
