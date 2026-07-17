import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import crypto from 'node:crypto';
import { assertReportMetricsConsistent, executionOutcome } from './report-integrity';
import type {
  CreateReportInput,
  ReportData,
  ReportMetadata,
  ReportMetrics,
  ReportSections,
  TestRunSummary,
  ReportType,
  UpdateReportInput,
} from './report-types';

const TEST_STATUS_LEGACY: Record<string, ReportType> = {
  TEST_STATUS: 'TEST_STATUS_REPORT',
  TEST_PLANNING: 'TEST_PLANNING_DOCUMENT',
};

const defaultGlossary = [
  { term: 'Test Plan', definition: 'Dokumen formal yang memuat rencana dan strategi pengujian.' },
  { term: 'Test Case', definition: 'Langkah pengujian untuk memverifikasi fungsi tertentu.' },
  { term: 'Bug/Defect', definition: 'Masalah pada aplikasi yang menyebabkan hasil tidak sesuai harapan.' },
  { term: 'Environment', definition: 'Konfigurasi perangkat keras dan lunak untuk menjalankan pengujian.' },
];

const asMetrics = (value: unknown): ReportMetrics => {
  const metrics = value as Partial<ReportMetrics> || {};
  return {
    totalPlanned: metrics.totalPlanned || 0,
    totalExecuted: metrics.totalExecuted || 0,
    totalPassed: metrics.totalPassed || 0,
    totalFailed: metrics.totalFailed || 0,
    totalPending: metrics.totalPending || 0,
    passRate: metrics.passRate || 0,
    failRate: metrics.failRate || 0,
    executionRate: metrics.executionRate || 0,
    byModule: metrics.byModule || [],
    byPriority: metrics.byPriority || [],
    byStatus: metrics.byStatus || [],
    bugSummary: { total: 0, critical: 0, open: 0, overdue: 0, reported: 0, fixing: 0, readyToRetest: 0, fixed: 0, byModule: [], ...(metrics.bugSummary || {}) },
    testRunSummary: { totalPlanned: 0, totalCompleted: 0, totalPassed: 0, totalFailed: 0, totalBlocked: 0, totalNotRun: 0, unfinishedRuns: 0, activeRuns: [], ...(metrics.testRunSummary || {}) },
    appendix: metrics.appendix || [],
  };
};
const asMetadata = (value: unknown): ReportMetadata => (value && typeof value === 'object' ? value as ReportMetadata : {});
const asSections = (value: unknown): ReportSections => (value && typeof value === 'object' ? value as ReportSections : {});
const normalizeType = (type: string): ReportType => TEST_STATUS_LEGACY[type] || type as ReportType;

function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 10000) / 100 : 0;
}

// Metrics reflect the whole project's current state (a status snapshot), not
// just rows edited within the reporting period. The reporting period is kept
// as document metadata / narrative context, not a filter on the headline
// counts — otherwise a report shows all-zeros whenever nothing was touched in
// that exact window.
export async function calculateProjectMetrics(projectId: string, testRunId?: string): Promise<ReportMetrics> {
  const [testCases, bugFixItems, testRuns, sourceRun] = await Promise.all([
    testRunId ? Promise.resolve([]) : db.testCase.findMany({
      where: { projectId },
      include: { module: true },
    }),
    db.bugFix.findMany({
      where: { projectId },
      include: { module: true },
    }),
    db.testRun.findMany({
      where: { projectId, status: { not: 'ARCHIVED' } },
      include: { testCases: { select: { latestStatus: true } } },
      orderBy: { updatedAt: 'desc' },
    }),
    testRunId ? db.testRun.findFirst({
      where: { id: testRunId, projectId, status: { not: 'ARCHIVED' } },
      include: { testCases: { include: { testCase: { include: { module: true } } } } },
    }) : Promise.resolve(null),
  ]);

  if (testRunId && !sourceRun) throw new Error('Source Test Cycle tidak ditemukan atau sudah diarsipkan.');

  const metricCases = sourceRun
    ? sourceRun.testCases.map(item => {
        const outcome = executionOutcome(item.latestStatus);
        return {
          moduleName: item.testCase.module?.name || 'No Module',
          priority: item.testCase.priority || 'Medium',
          ...outcome,
        };
      })
    : testCases.map(testCase => ({
        moduleName: testCase.module?.name || 'No Module',
        priority: testCase.priority || 'Medium',
        status: 'NOT RUN',
        executed: false,
        passed: false,
        failed: false,
      }));

  const totalPlanned = metricCases.length;
  const totalExecuted = metricCases.filter(tc => tc.executed).length;
  const totalPassed = metricCases.filter(tc => tc.passed).length;
  const totalFailed = metricCases.filter(tc => tc.failed).length;
  const totalPending = totalPlanned - totalExecuted;

  const grouped = new Map<string, typeof metricCases>();
  for (const tc of metricCases) {
    const key = tc.moduleName;
    grouped.set(key, [...(grouped.get(key) || []), tc]);
  }

  const byModule = Array.from(grouped.entries()).map(([moduleName, cases]) => {
    const executed = cases.filter(tc => tc.executed).length;
    const passed = cases.filter(tc => tc.passed).length;
    const failed = cases.filter(tc => tc.failed).length;
    return {
      moduleName,
      totalPlanned: cases.length,
      totalExecuted: executed,
      totalPassed: passed,
      totalFailed: failed,
      totalPending: cases.length - executed,
      passRate: pct(passed, executed),
    };
  });

  const priorities = new Map<string, typeof metricCases>();
  for (const tc of metricCases) {
    const key = tc.priority;
    priorities.set(key, [...(priorities.get(key) || []), tc]);
  }

  const byPriority = Array.from(priorities.entries()).map(([priority, cases]) => {
    const executed = cases.filter(tc => tc.executed).length;
    const passed = cases.filter(tc => tc.passed).length;
    const failed = cases.filter(tc => tc.failed).length;
    return { priority, totalPlanned: cases.length, totalExecuted: executed, totalPassed: passed, totalFailed: failed, passRate: pct(passed, executed) };
  });

  const statuses = new Map<string, number>();
  for (const tc of metricCases) statuses.set(tc.status, (statuses.get(tc.status) || 0) + 1);

  const bugModules = new Map<string, number>();
  for (const bug of bugFixItems) {
    const key = bug.module?.name || bug.page || 'No Module';
    bugModules.set(key, (bugModules.get(key) || 0) + 1);
  }

  const activeRuns = testRuns.map(run => {
    const statuses = run.testCases.map(item => item.latestStatus);
    const completed = statuses.filter(status => !['NOT RUN', 'IN PROGRESS'].includes(status)).length;
    const passed = statuses.filter(status => status === 'PASSED' || status === 'VERIFIED').length;
    const failed = statuses.filter(status => status === 'FAILED').length;
    const blocked = statuses.filter(status => status === 'BLOCKED').length;
    const notRun = statuses.filter(status => status === 'NOT RUN' || status === 'IN PROGRESS').length;
    return { id: run.id, name: run.name, status: run.status, progress: statuses.length ? Math.round((completed / statuses.length) * 100) : 0, failed, blocked, notRun };
  });
  const latestRun = sourceRun ? activeRuns.find(run => run.id === sourceRun.id) : activeRuns[0];
  const latestRunCases = sourceRun?.testCases || testRuns[0]?.testCases || [];
  const testRunSummary: TestRunSummary = {
    latestRunId: latestRun?.id,
    latestRunName: latestRun?.name,
    totalPlanned: latestRunCases.length,
    totalCompleted: latestRunCases.length ? latestRunCases.length - (latestRun?.notRun || 0) : 0,
    totalPassed: latestRunCases.filter(item => ['PASSED', 'VERIFIED'].includes(item.latestStatus)).length,
    totalFailed: latestRun?.failed || 0,
    totalBlocked: latestRun?.blocked || 0,
    totalNotRun: latestRun?.notRun || 0,
    unfinishedRuns: activeRuns.filter(run => run.status !== 'COMPLETED' && run.status !== 'ARCHIVED').length,
    activeRuns,
  };

  return {
    totalPlanned,
    totalExecuted,
    totalPassed,
    totalFailed,
    totalPending,
    passRate: pct(totalPassed, totalExecuted),
    failRate: pct(totalFailed, totalExecuted),
    executionRate: pct(totalExecuted, totalPlanned),
    byModule,
    byPriority,
    byStatus: Array.from(statuses.entries()).map(([status, count]) => ({ status, count, percentage: pct(count, totalPlanned) })),
    bugSummary: {
      total: bugFixItems.length,
      critical: bugFixItems.filter(b => b.priority === 'Critical').length,
      open: bugFixItems.filter(b => b.status !== 'VERIFIED & FIXED').length,
      overdue: bugFixItems.filter(b => b.status !== 'VERIFIED & FIXED' && b.reportedAt && (Date.now() - b.reportedAt.getTime()) > 7 * 24 * 60 * 60 * 1000).length,
      reported: bugFixItems.filter(b => b.status === 'SUDAH DILAPORKAN').length,
      fixing: bugFixItems.filter(b => b.status === 'SEDANG DI FIX').length,
      readyToRetest: bugFixItems.filter(b => b.status === 'READY TO RETEST').length,
      fixed: bugFixItems.filter(b => b.status === 'VERIFIED & FIXED').length,
      byModule: Array.from(bugModules.entries()).map(([moduleName, total]) => ({ moduleName, total })),
    },
    testRunSummary,
    appendix: [
      { documentName: 'Test Case Inventory', description: 'Daftar test case dan hasil eksekusi dari QA-Web.', location: 'QA-Web Cases' },
      { documentName: 'Bug Report', description: 'Daftar defect yang tercatat selama periode pelaporan.', location: 'QA-Web Bugs' },
      { documentName: 'Evidence Report', description: 'Bukti pengujian, log, screenshot, atau recording jika tersedia.', location: 'QA-Web Evidence' },
    ],
  };
}

async function defaultDocumentParts(input: CreateReportInput, projectName: string) {
  const modules = await db.module.findMany({ where: { projectId: input.projectId }, orderBy: { name: 'asc' } });
  const knowledge = await db.projectKnowledge.findMany({ where: { projectId: input.projectId }, take: 8, orderBy: { updatedAt: 'desc' } });
  const moduleList = modules.map(m => m.name).join(', ') || projectName;

  const metadata: ReportMetadata = {
    documentInformation: input.metadata?.documentInformation || `Dokumen ini dibuat untuk project ${projectName}.`,
    approval: input.metadata?.approval || [{ approvedBy: input.approvedBy || 'Project Manager', signature: '', date: '' }],
    revisionLog: input.metadata?.revisionLog || [{ date: new Date().toLocaleDateString('id-ID'), version: input.version, changes: 'Initial document', author: input.author || '' }],
    references: input.metadata?.references || [
      { type: 'External', title: 'ISO/IEC/IEEE 29119 - Software Testing' },
      { type: 'Internal', title: `QA-Web Project ${projectName}` },
      ...knowledge.map(k => ({ type: 'Internal' as const, title: k.title })),
    ],
    glossary: input.metadata?.glossary || defaultGlossary,
    appendix: input.metadata?.appendix,
  };

  const baseStatus: ReportSections = {
    scope: `Laporan ini mencakup aktivitas pengujian untuk ${projectName} pada modul: ${moduleList}.`,
    progressNarrative: 'Progress pengujian dihitung dari testcase yang dieksekusi pada periode pelaporan.',
    blockingFactors: '',
    newRisks: '',
    plannedTesting: 'Melanjutkan eksekusi testcase yang belum selesai dan melakukan retest pada defect yang telah diperbaiki.',
  };

  const basePlanning: ReportSections = {
    scope: `Dokumen ini menjelaskan rencana pengujian untuk ${projectName}.`,
    testItems: moduleList,
    softwareRiskIssues: 'Risiko utama akan diperbarui berdasarkan knowledge project dan defect yang ditemukan.',
    featuresToBeTested: moduleList,
    approachStrategy: 'Pengujian dilakukan dengan pendekatan black box testing, functional testing, manual testing, dan automation testing sesuai kebutuhan.',
    passFailCriteria: 'Test dinyatakan pass jika actual result sesuai expected result pada testcase.',
    suspensionCriteria: 'Pengujian dapat ditangguhkan jika environment tidak tersedia atau terdapat blocker kritikal.',
    testDeliverables: 'Test Plan, Test Case, Bug Report, Evidence Report, dan Test Status Report.',
    remainingTestTasks: 'Melengkapi testcase, menyiapkan data uji, menjalankan eksekusi, dan melakukan retest defect.',
    environmentalNeeds: 'Browser modern, environment aplikasi yang dapat diakses, data uji, dan tools pendukung QA-Web/Katalon/Postman jika diperlukan.',
    responsibilities: 'QA bertanggung jawab pada eksekusi dan dokumentasi hasil pengujian. Developer bertanggung jawab pada perbaikan defect.',
    schedule: 'Schedule mengikuti periode dokumen dan prioritas modul.',
    planningRisks: 'Keterbatasan dokumentasi, perubahan requirement, environment tidak stabil, dan defect kritikal.',
  };

  return {
    metadata,
    sections: { ...(input.reportType === 'TEST_PLANNING_DOCUMENT' ? basePlanning : baseStatus), ...(input.sections || {}) },
  };
}

function mapReport(report: any): ReportData {
  const sections = asSections(report.sectionsJson);
  return {
    id: report.id,
    projectId: report.projectId,
    projectName: report.project.name,
    reportType: normalizeType(report.reportType),
    status: report.status || 'DRAFT',
    documentId: report.documentId || undefined,
    testRunId: report.testRunId || undefined,
    version: report.version,
    author: report.author || undefined,
    approvedBy: report.approvedBy || undefined,
    dateOfIssue: report.dateOfIssue || undefined,
    documentStatus: report.documentStatus || undefined,
    reportingPeriodStart: report.reportingPeriodStart,
    reportingPeriodEnd: report.reportingPeriodEnd,
    metadata: asMetadata(report.metadataJson),
    sections: {
      progressNarrative: report.progressNarrative || sections.progressNarrative,
      blockingFactors: report.blockingFactors || sections.blockingFactors,
      newRisks: report.newRisks || sections.newRisks,
      plannedTesting: report.plannedTesting || sections.plannedTesting,
      ...sections,
    },
    metrics: asMetrics(report.metricsSnapshot),
    generatedAt: report.createdAt,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    finalizedAt: report.finalizedAt || undefined,
    finalizedBy: report.finalizedBy || undefined,
    snapshotChecksum: report.snapshotChecksum || undefined,
  };
}

export async function generateReport(input: CreateReportInput): Promise<ReportData> {
  const project = await db.project.findUnique({ where: { id: input.projectId } });
  if (!project) throw new Error('Project tidak ditemukan.');

  const metrics = await calculateProjectMetrics(input.projectId, input.testRunId);
  const parts = await defaultDocumentParts(input, project.name);

  const report = await db.report.create({
    data: {
      projectId: input.projectId,
      reportType: input.reportType,
      status: 'DRAFT',
      documentId: input.documentId,
      testRunId: input.testRunId,
      version: input.version,
      author: input.author,
      approvedBy: input.approvedBy,
      dateOfIssue: input.dateOfIssue,
      documentStatus: input.documentStatus || 'Assigned for review',
      reportingPeriodStart: input.reportingPeriodStart,
      reportingPeriodEnd: input.reportingPeriodEnd,
      progressNarrative: parts.sections.progressNarrative,
      blockingFactors: parts.sections.blockingFactors,
      newRisks: parts.sections.newRisks,
      plannedTesting: parts.sections.plannedTesting,
      metadataJson: parts.metadata as unknown as Prisma.InputJsonValue,
      sectionsJson: parts.sections as unknown as Prisma.InputJsonValue,
      metricsSnapshot: metrics as unknown as Prisma.InputJsonValue,
    },
    include: { project: true },
  });

  return mapReport(report);
}

export async function getProjectReports(projectId: string, options: { cursor?: string; limit?: number } = {}) {
  const limit = Math.min(100, Math.max(1, options.limit || 50));
  const rows = await db.report.findMany({
    where: { projectId },
    include: { project: true },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > limit;
  const reports = hasMore ? rows.slice(0, limit) : rows;
  return { items: reports.map(mapReport), hasMore, nextCursor: hasMore ? reports.at(-1)?.id || null : null };
}

export async function getReportById(reportId: string): Promise<ReportData | null> {
  const report = await db.report.findUnique({ where: { id: reportId }, include: { project: true } });
  return report ? mapReport(report) : null;
}

export async function updateReport(reportId: string, input: UpdateReportInput): Promise<ReportData> {
  const current = await db.report.findUnique({ where: { id: reportId }, include: { project: true } });
  if (!current) throw new Error('Report tidak ditemukan.');
  if (current.status === 'FINAL') throw new Error('Report final tidak dapat diubah.');
  if (input.testRunId !== undefined && (input.testRunId || null) !== current.testRunId) {
    throw new Error('Source Test Cycle tidak dapat diubah. Buat report baru untuk cycle yang berbeda.');
  }

  const sections = { ...asSections(current.sectionsJson), ...(input.sections || {}) };
  const metadata = { ...asMetadata(current.metadataJson), ...(input.metadata || {}) };
  const report = await db.report.update({
    where: { id: reportId },
    data: {
      documentId: input.documentId,
      version: input.version,
      author: input.author,
      approvedBy: input.approvedBy,
      dateOfIssue: input.dateOfIssue,
      documentStatus: input.documentStatus,
      reportingPeriodStart: input.reportingPeriodStart,
      reportingPeriodEnd: input.reportingPeriodEnd,
      progressNarrative: sections.progressNarrative,
      blockingFactors: sections.blockingFactors,
      newRisks: sections.newRisks,
      plannedTesting: sections.plannedTesting,
      metadataJson: metadata as unknown as Prisma.InputJsonValue,
      sectionsJson: sections as unknown as Prisma.InputJsonValue,
    },
    include: { project: true },
  });
  return mapReport(report);
}

export async function refreshReportSnapshot(reportId: string): Promise<ReportData> {
  const current = await db.report.findUnique({ where: { id: reportId } });
  if (!current) throw new Error('Report tidak ditemukan.');
  if (current.status === 'FINAL') throw new Error('Report final tidak dapat di-refresh.');
  if (normalizeType(current.reportType) === 'TEST_STATUS_REPORT' && !current.testRunId) {
    throw new Error('Source Test Cycle report sudah tidak tersedia. Buat report baru dari cycle yang valid.');
  }
  const metrics = await calculateProjectMetrics(current.projectId, current.testRunId || undefined);
  const report = await db.report.update({
    where: { id: reportId },
    data: { metricsSnapshot: metrics as unknown as Prisma.InputJsonValue },
    include: { project: true },
  });
  return mapReport(report);
}

export async function finalizeReport(reportId: string, actor = 'system'): Promise<ReportData> {
  const current = await db.report.findUnique({ where: { id: reportId }, include: { project: true } });
  if (!current) throw new Error('Report tidak ditemukan.');
  if (current.status === 'FINAL') throw new Error('Report sudah final.');
  if (!current.author?.trim()) throw new Error('Author wajib diisi sebelum finalisasi.');
  if (!current.approvedBy?.trim()) throw new Error('Approval atau waiver wajib diisi sebelum finalisasi.');
  if (!current.documentId?.trim()) throw new Error('Document ID wajib diisi sebelum finalisasi.');
  if (normalizeType(current.reportType) === 'TEST_STATUS_REPORT' && !current.testRunId) throw new Error('Source Test Cycle wajib tersedia sebelum finalisasi.');
  if (!current.reportingPeriodStart || !current.reportingPeriodEnd || current.reportingPeriodStart > current.reportingPeriodEnd) throw new Error('Reporting period tidak valid.');

  const metrics = asMetrics(current.metricsSnapshot);
  assertReportMetricsConsistent(metrics);

  const checksum = crypto.createHash('sha256').update(JSON.stringify({
    reportId: current.id,
    projectId: current.projectId,
    testRunId: current.testRunId,
    version: current.version,
    metrics: current.metricsSnapshot,
    metadata: current.metadataJson,
    sections: current.sectionsJson,
  })).digest('hex');
  const finalizedAt = new Date();
  const updated = await db.report.updateMany({
    where: { id: reportId, status: 'DRAFT' },
    data: { status: 'FINAL', finalizedAt, finalizedBy: actor, snapshotChecksum: checksum, documentStatus: 'Final' },
  });
  if (!updated.count) throw new Error('Report berubah saat finalisasi. Muat ulang dan coba lagi.');
  const report = await db.report.findUniqueOrThrow({ where: { id: reportId }, include: { project: true } });
  return mapReport(report);
}

export async function createReportVersion(reportId: string): Promise<ReportData> {
  const current = await db.report.findUnique({ where: { id: reportId }, include: { project: true } });
  if (!current) throw new Error('Report tidak ditemukan.');
  const report = await db.report.create({
    data: {
      projectId: current.projectId,
      reportType: current.reportType,
      status: 'DRAFT',
      documentId: current.documentId,
      testRunId: current.testRunId,
      version: `${current.version}.1`,
      author: current.author,
      approvedBy: current.approvedBy,
      dateOfIssue: new Date(),
      documentStatus: 'Draft',
      reportingPeriodStart: current.reportingPeriodStart,
      reportingPeriodEnd: current.reportingPeriodEnd,
      progressNarrative: current.progressNarrative,
      blockingFactors: current.blockingFactors,
      newRisks: current.newRisks,
      plannedTesting: current.plannedTesting,
      metadataJson: current.metadataJson as Prisma.InputJsonValue,
      sectionsJson: current.sectionsJson as Prisma.InputJsonValue,
      metricsSnapshot: current.metricsSnapshot as Prisma.InputJsonValue,
    },
    include: { project: true },
  });
  return mapReport(report);
}
