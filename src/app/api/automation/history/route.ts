import { db } from '@/lib/db';
import { devlogDb } from '@/lib/devlog-db';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

const testCaseSelect = {
  id: true,
  testCaseId: true,
  page: true,
  subMenu: true,
  weight: true,
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

type LegacyFileMeta = {
  id: string;
  kind: string;
  count: number;
  lastRunAt: string | null;
  hasManualCapture: boolean;
  hasAutomationRun: boolean;
} | null;

// Cache parsed JSONL metadata per file so repeat requests skip the full-file scan.
const legacyMetaCache = new Map<string, { mtimeMs: number; size: number; meta: LegacyFileMeta }>();

async function legacyHistory(projectId: string) {
  const logsDir = path.join(process.cwd(), 'mini-services', 'logs');
  let names: string[] = [];
  try {
    names = await fs.readdir(logsDir);
  } catch {
    return [];
  }
  const files = names.filter(name => name.endsWith('.jsonl'));
  const metadata = await Promise.all(files.map(async name => {
    const match = name.match(/^(.+?)(?:\.(current|previous))?\.jsonl$/);
    if (!match) return null;
    const filePath = path.join(logsDir, name);
    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      return null;
    }
    const cached = legacyMetaCache.get(name);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) return cached.meta;

    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const parsed = lines.flatMap(line => {
      try { return [JSON.parse(line)]; } catch { return []; }
    });
    const last = parsed.at(-1);
    const meta: LegacyFileMeta = parsed.length === 0 ? null : {
      id: match[1],
      kind: match[2] || 'legacy',
      count: parsed.length,
      lastRunAt: last?.timestamp || null,
      hasManualCapture: parsed.some(log => String(log.source || '').startsWith('manual-')),
      hasAutomationRun: parsed.some(log => !String(log.source || '').startsWith('manual-')),
    };
    legacyMetaCache.set(name, { mtimeMs: stat.mtimeMs, size: stat.size, meta });
    return meta;
  }));
  const byId = new Map<string, NonNullable<(typeof metadata)[number]>>();
  for (const item of metadata) {
    if (!item) continue;
    const current = byId.get(item.id);
    if (!current || new Date(item.lastRunAt || 0) > new Date(current.lastRunAt || 0)) byId.set(item.id, item);
  }
  const ids = [...byId.keys()];
  if (!ids.length) return [];
  const [testCases, bugFixItems] = await Promise.all([
    db.testCase.findMany({ where: { id: { in: ids }, projectId }, select: testCaseSelect }),
    db.bugFix.findMany({ where: { id: { in: ids }, projectId }, include: { module: { select: { id: true, name: true } } } }),
  ]);
  const automationFor = (id: string) => {
    const meta = byId.get(id)!;
    return {
      id,
      hasCurrent: meta.kind === 'current',
      hasPrevious: files.some(name => name === `${encodeURIComponent(id)}.previous.jsonl`),
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
    ...testCases.map(testCase => ({
      ...testCase,
      calculatedWeight: testCase.weight ? Number.parseFloat(testCase.weight) : null,
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
  ];
}

export async function GET(req: NextRequest) {
  try {
    const projectId = new URL(req.url).searchParams.get('projectId');
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }
    if (!await db.project.findUnique({ where: { id: projectId }, select: { id: true } })) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    if (!devlogDb) {
      const items = await legacyHistory(projectId);
      return NextResponse.json({ items, total: items.length, source: 'legacy-filesystem' });
    }

    const [latestRuns, runCounts] = await Promise.all([
      devlogDb.automationRun.findMany({
        where: { projectId },
        distinct: ['testCaseId'],
        orderBy: [{ testCaseId: 'asc' }, { startedAt: 'desc' }],
        include: { recording: true, _count: { select: { events: true } } },
      }),
      devlogDb.automationRun.groupBy({
        by: ['testCaseId'],
        where: { projectId },
        _count: { _all: true },
      }),
    ]);
    const ids = latestRuns.map(run => run.testCaseId);
    if (!ids.length) return NextResponse.json({ items: [], total: 0 });

    const [testCases, bugFixItems] = await Promise.all([
      db.testCase.findMany({ where: { id: { in: ids }, projectId }, select: testCaseSelect }),
      db.bugFix.findMany({
        where: { id: { in: ids }, projectId },
        include: { module: { select: { id: true, name: true } } },
      }),
    ]);
    const countById = new Map(runCounts.map(row => [row.testCaseId, row._count._all]));
    const runById = new Map(latestRuns.map(run => [run.testCaseId, run]));

    const automationFor = (id: string) => {
      const run = runById.get(id)!;
      const metadata = run.recording?.metadata as Record<string, any> | undefined;
      return {
        id,
        hasCurrent: true,
        hasPrevious: (countById.get(id) || 0) > 1,
        hasLegacy: false,
        hasAutomationRun: run.mode !== 'manual',
        hasManualCapture: run.mode === 'manual' || Boolean(run.recording),
        totalBytes: Number(metadata?.video?.sizeBytes || 0),
        lastRunAt: (run.endedAt || run.startedAt).toISOString(),
        files: [],
        eventCount: run._count.events,
        runId: run.id,
        recordingStatus: run.recording?.status || null,
      };
    };

    const items = [
      ...testCases.map(testCase => ({
        ...testCase,
        calculatedWeight: testCase.weight ? Number.parseFloat(testCase.weight) : null,
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

    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    console.error('GET /api/automation/history error:', error);
    return NextResponse.json({ error: 'Failed to fetch automation history' }, { status: 500 });
  }
}
