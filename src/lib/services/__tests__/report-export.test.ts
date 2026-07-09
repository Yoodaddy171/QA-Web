import { describe, expect, it } from 'vitest';
import { generateHTMLReport } from '../report-export';
import { generateReportDocx } from '../report-docx';
import type { ReportData } from '../report-types';

const report: ReportData = {
  id: 'report-1',
  projectId: 'project-1',
  projectName: '<script>alert(1)</script>',
  reportType: 'TEST_STATUS_REPORT',
  status: 'DRAFT',
  documentId: '02',
  version: '1.0',
  author: 'QA',
  approvedBy: 'PM',
  documentStatus: 'Draft',
  reportingPeriodStart: new Date('2026-07-01'),
  reportingPeriodEnd: new Date('2026-07-09'),
  metadata: { documentInformation: 'Info', approval: [], revisionLog: [], references: [], glossary: [] },
  sections: { scope: '<b>scope</b>', progressNarrative: 'Progress' },
  metrics: {
    totalPlanned: 2,
    totalExecuted: 1,
    totalPassed: 1,
    totalFailed: 0,
    totalPending: 1,
    passRate: 100,
    failRate: 0,
    executionRate: 50,
    byModule: [],
    byPriority: [],
    byStatus: [],
    bugSummary: { total: 0, reported: 0, fixing: 0, readyToRetest: 0, fixed: 0, byModule: [] },
    appendix: [],
  },
  generatedAt: new Date('2026-07-09'),
  createdAt: new Date('2026-07-09'),
  updatedAt: new Date('2026-07-09'),
};

describe('report exports', () => {
  it('escapes HTML fields', () => {
    const html = generateHTMLReport(report);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;scope&lt;/b&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('creates a docx buffer', async () => {
    const docx = await generateReportDocx(report);
    expect(docx.length).toBeGreaterThan(1000);
    expect(docx.subarray(0, 2).toString()).toBe('PK');
  });
});
