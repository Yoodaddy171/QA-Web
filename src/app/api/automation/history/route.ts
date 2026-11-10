import { db } from '@/lib/db';
import { devlogDb } from '@/lib/devlog-db';
import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import storagePaths from '@/lib/storage/data-storage-path.cjs';
import { calculatedWeightFor, getCalculatedWeightMap } from '@/lib/services/weight-service';
import { getSessionByToken, hasMinimumRole, SESSION_COOKIE } from '@/lib/auth';
import { runnerRoot } from '@/lib/automation/script-store.mjs';
import { mergeAutomationHistory, studioHistorySummaries } from '@/lib/automation/studio-history';
import { automationHistoryPage } from '@/lib/automation/history-page';
import { legacyHistoryMetadata } from '@/lib/automation/legacy-history-index';

const testCaseSelect = {
  id: true,
  testCaseId: true,
  page: true,
  subMenu: true,
  testType: true,
  testAction: true,
  steps: true,
  expectedResult: true,
  actualResult: true,
  status: true,
  progress: true,
  remarks: true,
  priority: true,
  projectId: true,
  moduleId: true,
  createdAt: true,
  updatedAt: true,
  module: { select: { id: true, name: true } },
} as const;

const historyHeaderSelect = {
  id: true, projectId: true, testCaseId: true, page: true, subMenu: true, testAction: true,
  status: true, moduleId: true, module: { select: { id: true, name: true } },
} as const;
type Header = { id: string; projectId: string; testCaseId: string; page: string; subMenu: string | null; testAction: string; status: string; moduleId: string | null; module: { id: string; name: string } | null };

async function legacyHistory(testCases: Header[], bugFixItems: Header[]) {
  const logsDir = storagePaths.runtimePaths(process.env, process.env.QA_LEGACY_LOGS_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'mini-services', 'logs')).logs;
  const { files, items: metadata } = await legacyHistoryMetadata(logsDir, new Set([...testCases, ...bugFixItems].map(item => item.id)));
  const byId = new Map<string, (typeof metadata)[number]>();
  for (const item of metadata) {
    const current = byId.get(item.id);
    if (!current || new Date(item.lastRunAt || 0) > new Date(current.lastRunAt || 0)) byId.set(item.id, item);
  }
  const automationFor = (id: string) => {
    const meta = byId.get(id)!;
    return {
      id,
      hasCurrent: meta.kind === 'current',
      hasPrevious: files.has(`${encodeURIComponent(id)}.previous.jsonl`),
      hasLegacy: meta.kind === 'legacy',
      hasAutomationRun: meta.hasAutomationRun,
      hasManualCapture: meta.hasManualCapture,
      totalBytes: 0,
      lastRunAt: meta.lastRunAt,
      files: [],
      eventCount: meta.count,
    };
  };
  return [
    ...testCases.filter(item => byId.has(item.id)).map(testCase => ({
      ...testCase,
      weight: null,
      calculatedWeight: null,
      automationSource: 'testcase',
      automation: automationFor(testCase.id),
    })),
    ...bugFixItems.filter(item => byId.has(item.id)).map(bugFix => ({
      ...bugFix,
      weight: null,
      calculatedWeight: null,
      progress: bugFix.status === 'VERIFIED & FIXED' ? 100 : bugFix.status === 'READY TO RETEST' ? 50 : 0,
      remarks: null,
      automationSource: 'bugfix',
      automation: automationFor(bugFix.id),
    })),
  ];
}

async function historyResponse<T extends Parameters<typeof automationHistoryPage>[0][number]>(items: T[], params: URLSearchParams, projectId: string, source?: string, studioSummaries?: ReadonlyMap<string, { lastRunAt: string | null }>) {
  const page = automationHistoryPage(items, params);
  if (!page.items.length) return NextResponse.json({ ...page, ...(source ? { source } : {}) });
  const caseIds = page.items.filter(item => item.automationSource === 'testcase').map(item => item.id);
  const bugIds = page.items.filter(item => item.automationSource === 'bugfix').map(item => item.id);
  const relayIds = page.items.flatMap(item => {
    const id = (item.automation as { runId?: string }).runId;
    return typeof id === 'string' ? [id] : [];
  });
  const [cases, bugs, weights, relayRows] = await Promise.all([
    caseIds.length ? db.testCase.findMany({ where: { projectId, id: { in: caseIds } }, select: testCaseSelect }) : [],
    bugIds.length ? db.bugFix.findMany({ where: { projectId, id: { in: bugIds } }, include: { module: { select: { id: true, name: true } } } }) : [],
    caseIds.length ? getCalculatedWeightMap(projectId) : new Map<string, number | null>(),
    devlogDb && relayIds.length ? devlogDb.automationRun.findMany({
      where: { projectId, id: { in: relayIds } },
      select: { id: true, startedAt: true, endedAt: true, recording: { select: { metadata: true } }, _count: { select: { events: true } } },
    }) : [],
  ]);
  const details = new Map<string, (typeof cases)[number] | (typeof bugs)[number]>([...cases.map(item => [`testcase:${item.id}`, item] as const), ...bugs.map(item => [`bugfix:${item.id}`, item] as const)]);
  const relayById = new Map(relayRows.map(item => [item.id, item] as const));
  return NextResponse.json({ ...page, items: page.items.flatMap(row => {
    const detail = details.get(`${row.automationSource}:${row.id}`);
    if (!detail) return [];
    const relay = relayById.get((row.automation as { runId?: string }).runId || '');
    const metadata = relay?.recording?.metadata as { video?: { sizeBytes?: number } } | null | undefined;
    const studio = row.automationSource === 'testcase' ? studioSummaries?.get(row.id) : null;
    const studioWins = studio && (new Date(studio.lastRunAt || 0).getTime() || 0) >= (relay ? (relay.endedAt || relay.startedAt).getTime() : 0);
    const automation = relay ? { ...row.automation, eventCount: relay._count.events,
      ...(!studioWins ? { totalBytes: Number(metadata?.video?.sizeBytes || 0) } : {}),
    } : row.automation;
    return [{ ...detail, ...row, automation, weight: null, calculatedWeight: row.automationSource === 'testcase' ? calculatedWeightFor(weights, detail) : null,
      ...(row.automationSource === 'bugfix' ? { progress: row.status === 'VERIFIED & FIXED' ? 100 : row.status === 'READY TO RETEST' ? 50 : 0, remarks: null } : {}),
    }];
  }), ...(source ? { source } : {}) });
}

export async function GET(req: NextRequest) {
  try {
    const projectId = new URL(req.url).searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    const session = await getSessionByToken(req.cookies.get(SESSION_COOKIE)?.value);
    if (!session) return NextResponse.json({ error: 'Silakan masuk kembali.' }, { status: 401 });
    if (session.guest || session.user.isGuest) return NextResponse.json({ error: 'Akses tamu tidak dapat membaca automation log.' }, { status: 403 });
    const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true, workspaceId: true, deletionState: true } });
    if (!project || project.deletionState !== 'ACTIVE') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    const member = session.user.memberships.find(item => item.workspaceId === project.workspaceId);
    if (!member) return NextResponse.json({ error: 'Project di luar workspace Anda.' }, { status: 403 });
    const [caseHeaders, bugHeaders] = await Promise.all([
      db.testCase.findMany({ where: { projectId }, select: historyHeaderSelect }),
      db.bugFix.findMany({ where: { projectId }, select: historyHeaderSelect }),
    ]);
    // Studio currently requires ADMIN even for reads. Do not broaden that boundary through this endpoint.
    const scopedCases = hasMinimumRole(member.role, 'ADMIN') ? caseHeaders : [];
    const studioSummaries = scopedCases.length
      ? await studioHistorySummaries(runnerRoot(), projectId, scopedCases.map(item => item.id)) : new Map();
    const studioCases = caseHeaders.filter(item => studioSummaries.has(item.id));
    const studioItems = studioCases.filter(item => studioSummaries.has(item.id)).map(item => ({
      ...item, weight: null, calculatedWeight: null,
      automationSource: 'testcase', automation: studioSummaries.get(item.id)!,
    }));
    if (!devlogDb) {
      const items = mergeAutomationHistory(await legacyHistory(caseHeaders, bugHeaders), studioItems);
      return historyResponse(items, req.nextUrl.searchParams, projectId, 'legacy-filesystem+studio');
    }

    const [latestRuns, runCounts] = await Promise.all([
      devlogDb.automationRun.findMany({
        where: { projectId },
        distinct: ['testCaseId'],
        orderBy: [{ testCaseId: 'asc' }, { startedAt: 'desc' }],
        select: { id: true, testCaseId: true, mode: true, startedAt: true, endedAt: true, recording: { select: { status: true } } },
      }),
      devlogDb.automationRun.groupBy({
        by: ['testCaseId'],
        where: { projectId },
        _count: { _all: true },
      }),
    ]);
    const ids = latestRuns.map(run => run.testCaseId);
    if (!ids.length) {
      const items = mergeAutomationHistory([], studioItems);
      return historyResponse(items, req.nextUrl.searchParams, projectId);
    }

    const idSet = new Set(ids);
    const testCases = caseHeaders.filter(item => idSet.has(item.id));
    const bugFixItems = bugHeaders.filter(item => idSet.has(item.id));
    const countById = new Map(runCounts.map(row => [row.testCaseId, row._count._all]));
    const runById = new Map(latestRuns.map(run => [run.testCaseId, run]));

    const automationFor = (id: string) => {
      const run = runById.get(id)!;
      return {
        id,
        hasCurrent: true,
        hasPrevious: (countById.get(id) || 0) > 1,
        hasLegacy: false,
        hasAutomationRun: run.mode !== 'manual',
        hasManualCapture: run.mode === 'manual' || Boolean(run.recording),
        totalBytes: 0,
        lastRunAt: (run.endedAt || run.startedAt).toISOString(),
        files: [],
        eventCount: 0,
        runId: run.id,
        recordingStatus: run.recording?.status || null,
      };
    };

    const items = [
      ...testCases.map(testCase => ({
        ...testCase,
        weight: null,
        calculatedWeight: null,
        automationSource: 'testcase',
        automation: automationFor(testCase.id),
      })),
      ...bugFixItems.map(bugFix => ({
        ...bugFix,
        weight: null,
        calculatedWeight: null,
        progress: bugFix.status === 'VERIFIED & FIXED' ? 100 : bugFix.status === 'READY TO RETEST' ? 50 : 0,
        remarks: null,
        automationSource: 'bugfix',
        automation: automationFor(bugFix.id),
      })),
    ].sort((a, b) => (
      new Date(b.automation.lastRunAt).getTime() - new Date(a.automation.lastRunAt).getTime()
    ));

    const merged = mergeAutomationHistory(items, studioItems);
    return historyResponse(merged, req.nextUrl.searchParams, projectId, undefined, studioSummaries);
  } catch (error) {
    console.error('GET /api/automation/history error:', error);
    return NextResponse.json({ error: 'Failed to fetch automation history' }, { status: 500 });
  }
}
