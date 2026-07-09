'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, FilePlus2, Pencil, RefreshCcw, ShieldCheck } from 'lucide-react';
import type { ReportData } from '@/lib/services/report-types';
import { generateHTMLReport } from '@/lib/services/report-export';

interface ReportViewerProps {
  report: ReportData;
  onEdit: (report: ReportData) => void;
  onReportChange: (report: ReportData) => void;
}

export function ReportViewer({ report, onEdit, onReportChange }: ReportViewerProps) {
  const formatDate = (date?: Date) => date ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(date)) : '-';
  const { metrics, sections, metadata } = report;
  const isPlanning = report.reportType === 'TEST_PLANNING_DOCUMENT';

  async function postAction(path: string) {
    const response = await fetch(`/api/reports/${report.id}/${path}`, { method: 'POST' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Action failed');
    onReportChange(data.report);
  }

  const handleExportHTML = () => {
    const blob = new Blob([generateHTMLReport(report)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${report.reportType}-${report.version}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const section = (title: string, body?: string) => body ? (
    <div className="rounded-lg border border-border/60 bg-card p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-bold text-foreground">{title}</h2>
      <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-foreground">{isPlanning ? 'Test Planning FDS' : 'Test Status Report FDS'}</h1>
                <Badge variant={report.status === 'FINAL' ? 'success' : 'secondary'}>{report.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">Version {report.version} - {report.documentId || report.id}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {report.status !== 'FINAL' && <Button variant="outline" onClick={() => onEdit(report)}><Pencil className="mr-2 h-4 w-4" />Edit Draft</Button>}
            {report.status !== 'FINAL' && <Button variant="outline" onClick={() => postAction('refresh')}><RefreshCcw className="mr-2 h-4 w-4" />Refresh Snapshot</Button>}
            {report.status !== 'FINAL' && <Button onClick={() => postAction('finalize')}><ShieldCheck className="mr-2 h-4 w-4" />Finalize</Button>}
            {report.status === 'FINAL' && <Button variant="outline" onClick={() => postAction('versions')}><FilePlus2 className="mr-2 h-4 w-4" />New Version</Button>}
            <Button variant="outline" onClick={handleExportHTML}><Download className="mr-2 h-4 w-4" />HTML</Button>
            <Button asChild><a href={`/api/reports/${report.id}/export/docx`}><Download className="mr-2 h-4 w-4" />DOCX</a></Button>
          </div>
        </div>

        <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <p><span className="font-semibold text-foreground">Project:</span> {report.projectName}</p>
          <p><span className="font-semibold text-foreground">Date of Issue:</span> {formatDate(report.dateOfIssue || report.createdAt)}</p>
          <p><span className="font-semibold text-foreground">Author:</span> {report.author || 'Tim Pengujian'}</p>
          <p><span className="font-semibold text-foreground">Approved by:</span> {report.approvedBy || 'Project Manager'}</p>
          <p><span className="font-semibold text-foreground">Period:</span> {formatDate(report.reportingPeriodStart)} - {formatDate(report.reportingPeriodEnd)}</p>
          <p><span className="font-semibold text-foreground">Document Status:</span> {report.documentStatus || '-'}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-foreground">Document Specific Information</h2>
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{metadata.documentInformation || `Dokumen untuk project ${report.projectName}.`}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ['Planned', metrics.totalPlanned, 'text-cyan-500'],
          ['Executed', `${metrics.totalExecuted} (${metrics.executionRate}%)`, 'text-violet-500'],
          ['Passed', `${metrics.totalPassed} (${metrics.passRate}%)`, 'text-emerald-500'],
          ['Failed', `${metrics.totalFailed} (${metrics.failRate}%)`, 'text-red-500'],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-lg border border-border/60 bg-card p-4 shadow-sm">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {section('INTRODUCTION / Scope', sections.scope)}
      {isPlanning ? (
        <>
          {section('TEST ITEMS (FUNCTIONS)', sections.testItems)}
          {section('SOFTWARE RISK ISSUES', sections.softwareRiskIssues)}
          {section('FEATURES TO BE TESTED', sections.featuresToBeTested)}
          {section('APPROACH (STRATEGY)', sections.approachStrategy)}
          {section('ITEM PASS/FAIL CRITERIA', sections.passFailCriteria)}
          {section('SUSPENSION CRITERIA AND RESUMPTION REQUIREMENTS', sections.suspensionCriteria)}
          {section('TEST DELIVERABLES', sections.testDeliverables)}
          {section('REMAINING TEST TASKS', sections.remainingTestTasks)}
          {section('ENVIRONMENTAL NEEDS', sections.environmentalNeeds)}
          {section('RESPONSIBILITIES', sections.responsibilities)}
          {section('SCHEDULE', sections.schedule)}
          {section('PLANNING RISKS AND CONTINGENCIES', sections.planningRisks)}
        </>
      ) : (
        <>
          {section('Progress Against Test Plan', sections.progressNarrative)}
          {section('Blocking Factors', sections.blockingFactors)}
          {section('New and Changed Risks', sections.newRisks)}
          {section('Planned Testing', sections.plannedTesting)}
        </>
      )}

      <div className="rounded-lg border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-foreground">Test Measures by Module</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border/60 text-muted-foreground"><th className="px-4 py-2 text-left">Module</th><th className="px-4 py-2 text-right">Planned</th><th className="px-4 py-2 text-right">Executed</th><th className="px-4 py-2 text-right">Passed</th><th className="px-4 py-2 text-right">Failed</th><th className="px-4 py-2 text-right">Pass Rate</th></tr></thead>
            <tbody>
              {metrics.byModule.map((m) => (
                <tr key={m.moduleName} className="border-b border-border/40 text-muted-foreground">
                  <td className="px-4 py-2 font-medium text-foreground">{m.moduleName}</td>
                  <td className="px-4 py-2 text-right">{m.totalPlanned}</td>
                  <td className="px-4 py-2 text-right">{m.totalExecuted}</td>
                  <td className="px-4 py-2 text-right text-emerald-500">{m.totalPassed}</td>
                  <td className="px-4 py-2 text-right text-red-500">{m.totalFailed}</td>
                  <td className="px-4 py-2 text-right">{m.passRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-foreground">Defect Summary</h2>
        <div className="grid gap-3 md:grid-cols-5">
          <Badge variant="outline">Total {metrics.bugSummary.total}</Badge>
          <Badge variant="warning">Reported {metrics.bugSummary.reported}</Badge>
          <Badge variant="info">Fixing {metrics.bugSummary.fixing}</Badge>
          <Badge variant="readyretest">Ready {metrics.bugSummary.readyToRetest}</Badge>
          <Badge variant="success">Fixed {metrics.bugSummary.fixed}</Badge>
        </div>
      </div>
    </div>
  );
}
