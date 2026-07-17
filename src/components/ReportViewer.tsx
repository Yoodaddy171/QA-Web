'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, FilePlus2, Pencil, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { runReportAction, type ReportAction } from '@/lib/client/api/reports-client';
import type { ReportData } from '@/lib/services/report-types';
import { generateHTMLReport } from '@/lib/services/report-export';

interface ReportViewerProps {
  report: ReportData;
  onEdit: (report: ReportData) => void;
  onReportChange: (report: ReportData) => void;
  onNavigate?: (tab: 'testRuns' | 'traceability' | 'bugfix' | 'testcases') => void;
}

const ACTION_SUCCESS: Record<ReportAction, string> = {
  refresh: 'Snapshot metrics berhasil diperbarui.',
  finalize: 'Report berhasil difinalisasi.',
  versions: 'Versi report baru berhasil dibuat.',
};

export function ReportViewer({ report, onEdit, onReportChange, onNavigate }: ReportViewerProps) {
  const { toast } = useToast();
  const formatDate = (date?: Date) => date ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(date)) : '-';
  const { metrics, sections, metadata } = report;
  const isPlanning = report.reportType === 'TEST_PLANNING_DOCUMENT';
  const runSummary = metrics.testRunSummary;
  const blocked = runSummary.totalBlocked || metrics.byStatus.find(item => item.status === 'BLOCKED')?.count || 0;
  const failed = runSummary.totalPlanned ? runSummary.totalFailed : metrics.totalFailed;
  const pending = runSummary.totalPlanned ? runSummary.totalNotRun : metrics.totalPending;
  const recommendation = failed > 0 || blocked > 0 || metrics.bugSummary.critical > 0
    ? 'NOT READY'
    : pending > 0 || runSummary.unfinishedRuns > 0 || metrics.bugSummary.open > 0
      ? 'READY WITH RISK'
      : 'READY';
  const riskiestModule = metrics.byModule.reduce<(typeof metrics.byModule)[number] | null>((highest, module) => {
    if (!highest) return module;
    const moduleRisk = module.totalFailed * 3 + Math.max(0, module.totalPlanned - module.totalExecuted);
    const highestRisk = highest.totalFailed * 3 + Math.max(0, highest.totalPlanned - highest.totalExecuted);
    return moduleRisk > highestRisk ? module : highest;
  }, null);
  const decisionReason = recommendation === 'NOT READY'
    ? `${metrics.bugSummary.critical} critical bugs, ${failed} failed cases, dan ${blocked} blocked cases harus diselesaikan.`
    : recommendation === 'READY WITH RISK'
      ? `${pending} testcase belum dijalankan, ${runSummary.unfinishedRuns} Test Run belum selesai, dan ${metrics.bugSummary.open} bug masih terbuka.`
      : 'Seluruh execution selesai tanpa failed, blocked, atau critical bug terbuka.';

  async function postAction(action: ReportAction) {
    try {
      onReportChange(await runReportAction(report.id, action));
      toast({ variant: 'success', title: 'Berhasil', description: ACTION_SUCCESS[action] });
    } catch (error) {
      toast({ title: 'Aksi gagal', description: error instanceof Error ? error.message : 'Terjadi kesalahan.', variant: 'destructive' });
    }
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
    <div className="space-y-4">
      <div className="signal-surface rounded-xl border border-border/70 bg-card p-6 shadow-sm">
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

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {[
          ['Planned', runSummary.totalPlanned || metrics.totalPlanned, 'text-cyan-500'],
          ['Executed', runSummary.totalPlanned ? `${runSummary.totalCompleted} (${Math.round((runSummary.totalCompleted / runSummary.totalPlanned) * 100)}%)` : `${metrics.totalExecuted} (${metrics.executionRate}%)`, 'text-violet-500'],
          ['Passed', runSummary.totalPlanned ? runSummary.totalPassed : metrics.totalPassed, 'text-emerald-500'],
          ['Failed', failed, 'text-red-500'],
          ['Blocked', blocked, 'text-amber-500'],
          ['Not run', pending, 'text-slate-400'],
        ].map(([label, value, color]) => (
          <div key={label} className="rounded-lg border border-border/60 bg-card p-4 shadow-sm">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <div className="signal-surface rounded-xl border border-primary/25 bg-primary/5 p-5 shadow-[0_16px_50px_-38px_rgba(99,102,241,.8)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Release decision summary</p>
            <p className="mt-1 text-xl font-bold">Release recommendation: {recommendation}</p>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{decisionReason}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span><strong className="text-foreground">{metrics.bugSummary.overdue}</strong> overdue bugs</span>
              <span><strong className="text-foreground">{runSummary.unfinishedRuns}</strong> unfinished runs</span>
              {riskiestModule && <span>Highest risk: <strong className="text-foreground">{riskiestModule.moduleName}</strong> · {riskiestModule.totalFailed} failed</span>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {onNavigate && <Button size="sm" variant="outline" onClick={() => onNavigate('testRuns')}>Open Test Runs</Button>}
            {onNavigate && failed > 0 && <Button size="sm" variant="ghost" onClick={() => onNavigate('testcases')}>Open Failed Cases</Button>}
            {onNavigate && <Button size="sm" variant="ghost" onClick={() => onNavigate('traceability')}>Open Traceability</Button>}
            {onNavigate && metrics.bugSummary.open > 0 && <Button size="sm" variant="ghost" onClick={() => onNavigate('bugfix')}>Open Bugs</Button>}
          </div>
        </div>
      </div>

      {runSummary.activeRuns.length > 0 && <div className="rounded-lg border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-bold text-foreground">Test Run readiness</h2><span className="text-sm text-muted-foreground">{runSummary.unfinishedRuns} unfinished run</span></div>
        <div className="space-y-2">{runSummary.activeRuns.slice(0, 5).map(run => <button key={run.id} type="button" onClick={() => onNavigate?.('testRuns')} className="flex w-full flex-wrap items-center gap-3 rounded-md border border-border/50 p-3 text-left transition hover:border-primary/40 hover:bg-primary/5"><span className="min-w-48 flex-1 text-sm font-semibold">{run.name}</span><Badge variant="outline">{run.status}</Badge><span className="text-xs text-muted-foreground">{run.progress}% · {run.failed} failed · {run.blocked} blocked · {run.notRun} not run</span></button>)}</div>
      </div>}

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
          <Badge variant="failed">Critical {metrics.bugSummary.critical}</Badge>
          <Badge variant="warning">Open {metrics.bugSummary.open}</Badge>
          <Badge variant="failed">Overdue {metrics.bugSummary.overdue}</Badge>
          <Badge variant="warning">Reported {metrics.bugSummary.reported}</Badge>
          <Badge variant="info">Fixing {metrics.bugSummary.fixing}</Badge>
          <Badge variant="readyretest">Ready {metrics.bugSummary.readyToRetest}</Badge>
          <Badge variant="success">Fixed {metrics.bugSummary.fixed}</Badge>
        </div>
      </div>
    </div>
  );
}
