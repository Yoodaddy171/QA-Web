'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { MutationAction, useWorkspaceAccess } from '@/components/WorkspaceAccess';
import { Badge } from '@/components/ui/badge';
import { Check, Copy, Download, FileText, FilePlus2, Pencil, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { runReportAction, type ReportAction } from '@/lib/client/api/reports-client';
import type { ReportData } from '@/lib/services/report-types';
import { generateHTMLReport } from '@/lib/services/report-export';
import { copyText } from '@/lib/client/copy-text';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { gsap, useGSAP, isMotionAllowed, scrambleDecodeText } from '@/lib/client/gsap-motion';

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
  const { canExportReports } = useWorkspaceAccess();
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

  const [copiedSummary, setCopiedSummary] = useState(false);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const recSpanRef = useRef<HTMLSpanElement>(null);
  useEffect(() => () => { if (copyResetTimer.current) clearTimeout(copyResetTimer.current); }, []);

  useGSAP(
    () => {
      if (!docRef.current || !isMotionAllowed()) return;
      const blocks = docRef.current.querySelectorAll(':scope > div');
      if (blocks.length) {
        gsap.fromTo(
          blocks,
          { y: 12, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.34, stagger: 0.04, ease: 'power3.out', clearProps: 'y,opacity' }
        );
      }
      if (recSpanRef.current) {
        scrambleDecodeText(recSpanRef.current, recommendation, { duration: 0.42 });
      }
    },
    { dependencies: [report.id, report.version, recommendation], scope: docRef }
  );

  const copyExecutiveSummary = async () => {
    const planned = runSummary.totalPlanned || metrics.totalPlanned;
    const executed = runSummary.totalPlanned ? runSummary.totalCompleted : metrics.totalExecuted;
    const passedCount = runSummary.totalPlanned ? runSummary.totalPassed : metrics.totalPassed;
    const execRate = runSummary.totalPlanned ? Math.round((runSummary.totalCompleted / runSummary.totalPlanned) * 100) : metrics.executionRate;

    const summaryText = [
      `[QA Report] Rekomendasi Rilis: ${recommendation}`,
      `Project: ${report.projectName} (v${report.version})`,
      `Status Dokumen: ${report.status}`,
      `Eksekusi: ${executed}/${planned} (${execRate}%) | Pass: ${passedCount} | Fail: ${failed} | Block: ${blocked}`,
      riskiestModule ? `Modul Risiko Tertinggi: ${riskiestModule.moduleName} (${riskiestModule.totalFailed} failed)` : null,
      `Keputusan: ${decisionReason}`,
    ].filter(Boolean).join('\n');

    try {
      await copyText(summaryText);
      setCopiedSummary(true);
      if (copyResetTimer.current) clearTimeout(copyResetTimer.current);
      copyResetTimer.current = setTimeout(() => setCopiedSummary(false), 2000);
      toast({ variant: 'success', title: 'Tersalin', description: 'Ringkasan eksekutif laporan berhasil disalin ke clipboard.' });
    } catch {
      toast({ variant: 'destructive', title: 'Gagal menyalin', description: 'Silakan salin ringkasan secara manual.' });
    }
  };

  const section = (title: string, body?: string) => body ? (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="mb-3 text-base font-semibold text-foreground">{title}</h2>
      <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  ) : null;

  return (
    <div ref={docRef} className="qa-report-document flex min-w-0 flex-col gap-5">
      <p className="text-xs text-muted-foreground">Hasil cycle berasal dari execution; status inventory dan verifikasi Bug ditampilkan terpisah. Finalisasi memerlukan QA_LEAD atau lebih tinggi.</p>
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{isPlanning ? 'Test Planning Document' : 'Test Status Report'}</h1>
                <Badge variant={report.status === 'FINAL' ? 'success' : 'secondary'}>{report.status}</Badge>
              </div>
              <p className="mt-2 break-words text-xs leading-5 text-muted-foreground">Version {report.version}{report.documentId ? ` · ${report.documentId}` : ''}</p>
            </div>
          </div>
          <div className="qa-module-toolbar flex flex-wrap gap-2">
            {report.status !== 'FINAL' && <MutationAction><Button variant="outline" onClick={() => onEdit(report)}><Pencil className="mr-2 h-4 w-4" />Edit Draft</Button></MutationAction>}
            {report.status !== 'FINAL' && <MutationAction><Button variant="outline" onClick={() => postAction('refresh')}><RefreshCcw className="mr-2 h-4 w-4" />Refresh Snapshot</Button></MutationAction>}
            {report.status !== 'FINAL' && <MutationAction minimum="QA_LEAD"><Button onClick={() => postAction('finalize')}><ShieldCheck className="mr-2 h-4 w-4" />Finalize</Button></MutationAction>}
            {report.status === 'FINAL' && <MutationAction><Button variant="outline" onClick={() => postAction('versions')}><FilePlus2 className="mr-2 h-4 w-4" />New Version</Button></MutationAction>}
            {canExportReports && <><Button variant="outline" onClick={handleExportHTML}><Download className="mr-2 h-4 w-4" />HTML</Button>
            <Button variant="outline" asChild><a href={`/api/reports/${report.id}/export/docx`}><Download className="mr-2 h-4 w-4" />DOCX</a></Button></>}
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
          ['Not run', pending, 'text-muted-foreground'],
        ].map(([label, value, color]) => (
          <div key={String(label)} className="rounded-lg border border-border/60 bg-card p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-border">
            <div className={`text-2xl font-bold font-mono tabular-nums ${color}`}>
              {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
            </div>
            <div className="text-sm text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-primary/30 bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Release decision summary</p>
            <p className="mt-1 text-xl font-bold">Release recommendation: <span ref={recSpanRef}>{recommendation}</span></p>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{decisionReason}</p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span><strong className="text-foreground">{metrics.bugSummary.overdue}</strong> overdue bugs</span>
              <span><strong className="text-foreground">{runSummary.unfinishedRuns}</strong> unfinished runs</span>
              {riskiestModule && <span>Highest risk: <strong className="text-foreground">{riskiestModule.moduleName}</strong> · {riskiestModule.totalFailed} failed</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={copyExecutiveSummary}
              className="gap-1.5 text-xs font-semibold"
            >
              {copiedSummary ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedSummary ? 'Tersalin' : 'Salin Ringkasan'}
            </Button>
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
                  <SimpleTooltip content={m.moduleName} contentClassName="z-[120] max-w-[min(28rem,calc(100vw-2rem))] whitespace-pre-wrap break-words text-left"><td className="px-4 py-2 font-medium text-foreground">{m.moduleName}</td></SimpleTooltip>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{m.totalPlanned}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{m.totalExecuted}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-emerald-500">{m.totalPassed}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums text-red-500">{m.totalFailed}</td>
                  <td className="px-4 py-2 text-right font-mono tabular-nums">{m.passRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold text-foreground">Defect Summary</h2>
          <span className="text-xs text-muted-foreground">{metrics.bugSummary.total} defect tercatat</span>
        </div>
        
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-border/50 bg-background/50 p-3">
            <div className="font-mono text-2xl font-bold text-foreground">{metrics.bugSummary.total}</div>
            <div className="text-xs text-muted-foreground">Total Defects</div>
          </div>
          <div className="rounded-lg border border-border/50 bg-background/50 p-3">
            <div className={`font-mono text-2xl font-bold ${metrics.bugSummary.critical > 0 ? 'text-destructive font-black' : 'text-emerald-500'}`}>
              {metrics.bugSummary.critical}
            </div>
            <div className="text-xs text-muted-foreground">Critical / Blocker</div>
          </div>
          <div className="rounded-lg border border-border/50 bg-background/50 p-3">
            <div className="font-mono text-2xl font-bold text-amber-500">{metrics.bugSummary.open}</div>
            <div className="text-xs text-muted-foreground">Open / Reported</div>
          </div>
          <div className="rounded-lg border border-border/50 bg-background/50 p-3">
            <div className="font-mono text-2xl font-bold text-emerald-500">{metrics.bugSummary.fixed}</div>
            <div className="text-xs text-muted-foreground">Fixed / Resolved</div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-border/40 pt-3">
          <Badge variant="warning">Reported: {metrics.bugSummary.reported}</Badge>
          <Badge variant="info">In Fix: {metrics.bugSummary.fixing}</Badge>
          <Badge variant="readyretest">Ready to Retest: {metrics.bugSummary.readyToRetest}</Badge>
          <Badge variant="failed">Overdue: {metrics.bugSummary.overdue}</Badge>
        </div>

        {metrics.bugSummary.byModule && metrics.bugSummary.byModule.length > 0 && (
          <div className="mt-5 border-t border-border/40 pt-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground">Distribusi Defect per Modul</h3>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {metrics.bugSummary.byModule.map((mod) => (
                <div key={mod.moduleName} className="flex items-center justify-between rounded-md border border-border/40 bg-muted/20 px-3 py-2 text-xs">
                  <span className="truncate font-medium text-foreground">{mod.moduleName}</span>
                  <span className="font-mono font-bold text-amber-500">{mod.total} bug</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border/60 bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-xl font-bold text-foreground">Persetujuan & Tanda Tangan (Sign-off)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border/40 bg-background/40 p-4">
            <p className="text-xs font-medium text-muted-foreground">Disiapkan oleh (QA Engineer):</p>
            <p className="mt-2 text-sm font-bold text-foreground">{report.author || 'Tim QA'}</p>
            <p className="mt-1 text-xs text-muted-foreground">Status: Selesai diuji</p>
          </div>
          <div className="rounded-lg border border-border/40 bg-background/40 p-4">
            <p className="text-xs font-medium text-muted-foreground">Disetujui oleh (Lead / PM):</p>
            <p className="mt-2 text-sm font-bold text-foreground">{report.approvedBy || 'Project Manager'}</p>
            <p className="mt-1 text-xs text-muted-foreground">Status: {report.documentStatus || 'Menunggu peninjauan'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
