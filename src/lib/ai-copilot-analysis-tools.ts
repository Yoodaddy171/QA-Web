import { db } from '@/lib/db';
import { extractKeywords, limitText } from '@/lib/ai-context';
import {
  buildContainsFilters, cleanText, compact, matchTokens, modulePrefix, normalizeForMatch,
  parseRequestedPriorities, parseRequestedStatuses, parseTestCaseId, parseVisualIds,
  questionNeedsSelectedContext, uniqueCitations,
} from '@/lib/ai-copilot-utils';
import {
  extractFollowUpTarget, getProjectModules, inferModule, inferNamedTarget, readFeatureMapContext,
} from './ai-copilot-context';
import type { CopilotToolResult } from './ai-copilot-tools';

const MAX_ROWS = 12;

export async function getStatusPriorityCases(projectId: string, query: string): Promise<CopilotToolResult> {
  const statuses = parseRequestedStatuses(query);
  const priorities = parseRequestedPriorities(query);
  const rows = await db.testCase.findMany({
    where: {
      projectId,
      ...(statuses.length ? { status: { in: statuses } } : {}),
      ...(priorities.length ? { priority: { in: priorities } } : {}),
    },
    select: {
      id: true,
      testCaseId: true,
      page: true,
      subMenu: true,
      testType: true,
      status: true,
      priority: true,
      testAction: true,
      module: { select: { id: true, name: true } },
    },
    orderBy: [{ priority: 'asc' }, { testCaseId: 'asc' }],
    take: MAX_ROWS,
  });

  return {
    name: 'getStatusPriorityCases',
    summary: rows.length
      ? `Ditemukan ${rows.length} testcase sesuai filter status=${statuses.join('/') || 'any'} priority=${priorities.join('/') || 'any'}.`
      : `Tidak ditemukan testcase sesuai filter status=${statuses.join('/') || 'any'} priority=${priorities.join('/') || 'any'}.`,
    data: rows.map(row => ({
      id: row.id,
      testCaseId: row.testCaseId,
      module: row.module,
      page: row.page,
      subMenu: row.subMenu,
      testType: row.testType,
      status: row.status,
      priority: row.priority,
      testAction: compact(row.testAction, 160),
    })),
    citations: rows.map(row => ({
      id: row.id,
      type: 'testcase',
      label: row.testCaseId,
      testCaseId: row.testCaseId,
      description: `${row.module?.name || row.page} | ${row.status} | ${row.priority} | ${compact(row.testAction, 90)}`,
    })),
  };
}

export async function getGenericExpectedResultCases(projectId: string, query: string): Promise<CopilotToolResult> {
  const moduleRecord = await inferModule(projectId, query);
  const rows = await db.testCase.findMany({
    where: {
      projectId,
      ...(moduleRecord ? { moduleId: moduleRecord.id } : {}),
    },
    select: {
      id: true,
      testCaseId: true,
      page: true,
      subMenu: true,
      testType: true,
      status: true,
      priority: true,
      testAction: true,
      expectedResult: true,
      module: { select: { id: true, name: true } },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 300,
  });

  const genericPatterns = [
    /sesuai (kebutuhan|ekspektasi|expected|yang diharapkan)/i,
    /berjalan (dengan baik|normal|sesuai)/i,
    /tampil dengan benar/i,
    /data (valid|sesuai|benar)/i,
    /functional test/i,
  ];

  const scored = rows
    .map(row => {
      const expected = cleanText(row.expectedResult);
      const score = genericPatterns.reduce((total, pattern) => total + (pattern.test(expected) ? 3 : 0), 0)
        + (expected.length > 0 && expected.length < 45 ? 2 : 0)
        + (!expected ? 5 : 0);
      return { row, score };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ROWS);

  return {
    name: 'getGenericExpectedResultCases',
    summary: scored.length
      ? `Ditemukan ${scored.length} testcase dengan expected result yang terindikasi generic.`
      : 'Tidak ditemukan expected result yang terindikasi generic.',
    data: scored.map(({ row, score }) => ({
      id: row.id,
      testCaseId: row.testCaseId,
      module: row.module,
      page: row.page,
      subMenu: row.subMenu,
      status: row.status,
      priority: row.priority,
      score,
      testAction: compact(row.testAction, 130),
      expectedResult: compact(row.expectedResult, 180),
    })),
    citations: scored.map(({ row }) => ({
      id: row.id,
      type: 'testcase',
      label: row.testCaseId,
      testCaseId: row.testCaseId,
      description: `${row.module?.name || row.page} | ${compact(row.expectedResult, 90)}`,
    })),
  };
}

export async function getWeakStepCases(projectId: string, query: string): Promise<CopilotToolResult> {
  const moduleRecord = await inferModule(projectId, query);
  const rows = await db.testCase.findMany({
    where: {
      projectId,
      ...(moduleRecord ? { moduleId: moduleRecord.id } : {}),
    },
    select: {
      id: true,
      testCaseId: true,
      page: true,
      subMenu: true,
      testType: true,
      status: true,
      priority: true,
      testAction: true,
      steps: true,
      module: { select: { id: true, name: true } },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 300,
  });

  const weakPatterns = [
    /open page/i,
    /interact with feature/i,
    /perform feature action/i,
    /jalankan aksi utama/i,
    /siapkan data uji/i,
    /amati respons/i,
    /functional test/i,
  ];

  const scored = rows
    .map(row => {
      const steps = cleanText(row.steps);
      const numberedSteps = (steps.match(/(^|\n)\s*\d+[\).]/g) || []).length;
      const lineCount = steps.split('\n').map(line => line.trim()).filter(Boolean).length;
      const score = weakPatterns.reduce((total, pattern) => total + (pattern.test(steps) ? 4 : 0), 0)
        + (!steps ? 8 : 0)
        + (steps.length > 0 && steps.length < 80 ? 4 : 0)
        + (lineCount > 0 && lineCount < 3 ? 3 : 0)
        + (numberedSteps === 0 ? 2 : 0);
      return { row, score, lineCount, numberedSteps };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ROWS);

  return {
    name: 'getWeakStepCases',
    summary: scored.length
      ? `Ditemukan ${scored.length} testcase dengan steps yang terindikasi kurang jelas.`
      : 'Tidak ditemukan steps yang terindikasi kurang jelas.',
    data: scored.map(({ row, score, lineCount, numberedSteps }) => ({
      id: row.id,
      testCaseId: row.testCaseId,
      module: row.module,
      page: row.page,
      subMenu: row.subMenu,
      status: row.status,
      priority: row.priority,
      score,
      lineCount,
      numberedSteps,
      testAction: compact(row.testAction, 130),
      steps: compact(row.steps, 220),
    })),
    citations: scored.map(({ row }) => ({
      id: row.id,
      type: 'testcase',
      label: row.testCaseId,
      testCaseId: row.testCaseId,
      description: `${row.module?.name || row.page} | ${compact(row.steps, 90)}`,
    })),
  };
}

export async function getModuleRisk(projectId: string): Promise<CopilotToolResult> {
  const rows = await db.testCase.findMany({
    where: { projectId },
    select: {
      moduleId: true,
      module: { select: { id: true, name: true } },
      status: true,
      priority: true,
      updatedAt: true,
    },
  });

  const buckets = new Map<string, {
    moduleId: string | null;
    moduleName: string;
    total: number;
    failed: number;
    blocked: number;
    readyToRetest: number;
    inProgress: number;
    highPriority: number;
    riskScore: number;
  }>();

  for (const row of rows) {
    const key = row.moduleId || 'unassigned';
    const bucket = buckets.get(key) || {
      moduleId: row.moduleId,
      moduleName: row.module?.name || 'Tanpa Module',
      total: 0,
      failed: 0,
      blocked: 0,
      readyToRetest: 0,
      inProgress: 0,
      highPriority: 0,
      riskScore: 0,
    };
    bucket.total += 1;
    if (row.status === 'FAILED') bucket.failed += 1;
    if (row.status === 'BLOCKED') bucket.blocked += 1;
    if (row.status === 'READY TO RETEST') bucket.readyToRetest += 1;
    if (row.status === 'IN PROGRESS') bucket.inProgress += 1;
    if (['High', 'Critical'].includes(row.priority)) bucket.highPriority += 1;
    bucket.riskScore = bucket.failed * 5 + bucket.blocked * 4 + bucket.readyToRetest * 3 + bucket.inProgress * 2 + bucket.highPriority;
    buckets.set(key, bucket);
  }

  const risk = Array.from(buckets.values()).sort((a, b) => b.riskScore - a.riskScore).slice(0, MAX_ROWS);
  return {
    name: 'getModuleRisk',
    summary: risk.length ? `Module paling berisiko: ${risk[0].moduleName} (${risk[0].riskScore}).` : 'Belum ada data risiko module.',
    data: risk,
    citations: risk.map(row => ({
      id: row.moduleId || 'unassigned',
      type: 'module',
      label: row.moduleName,
      description: `Risk ${row.riskScore}, ${row.total} testcase`,
    })),
  };
}

export async function getCoverageGap(projectId: string, query: string): Promise<CopilotToolResult> {
  const targetModule = await inferModule(projectId, query);
  const followUpTarget = extractFollowUpTarget(query);
  const namedTarget = inferNamedTarget(followUpTarget || query);
  const pageHints = [
    followUpTarget,
    namedTarget,
    ...extractKeywords(query),
  ]
    .map(value => value.toLowerCase())
    .filter(keyword => keyword.length >= 3 && !['apakah', 'punya', 'cukup', 'case', 'cases', 'testcase', 'negative', 'missing', 'positif', 'positive', 'tunjukkan', 'gapnya', 'gap', 'module', 'modul', 'jangan', 'simpan', 'dulu', 'buatkan', 'buat'].includes(keyword))
    .filter((keyword, index, list) => list.indexOf(keyword) === index)
    .slice(0, 3);

  const rows = await db.testCase.findMany({
    where: {
      projectId,
      ...(targetModule ? { moduleId: targetModule.id } : {}),
      ...(!targetModule && pageHints.length > 0
        ? { OR: pageHints.flatMap(keyword => [{ page: { contains: keyword } }, { subMenu: { contains: keyword } }]) }
        : {}),
    },
    select: {
      id: true,
      testCaseId: true,
      page: true,
      subMenu: true,
      testType: true,
      priority: true,
      status: true,
      testAction: true,
      module: { select: { id: true, name: true } },
    },
    orderBy: [{ page: 'asc' }, { subMenu: 'asc' }, { testCaseId: 'asc' }],
    take: 500,
  });

  const buckets = new Map<string, {
    key: string;
    moduleId: string | null;
    moduleName: string;
    page: string;
    subMenu: string;
    total: number;
    positive: number;
    negative: number;
    highPriority: number;
    samples: Array<{ id: string; testCaseId: string; testType: string; status: string; testAction: string }>;
  }>();

  for (const row of rows) {
    const key = `${row.module?.id || 'none'}:${row.page}:${row.subMenu || ''}`;
    const bucket = buckets.get(key) || {
      key,
      moduleId: row.module?.id || null,
      moduleName: row.module?.name || 'Tanpa Module',
      page: row.page,
      subMenu: row.subMenu || '',
      total: 0,
      positive: 0,
      negative: 0,
      highPriority: 0,
      samples: [],
    };
    bucket.total += 1;
    if (row.testType === 'Negative') bucket.negative += 1;
    else bucket.positive += 1;
    if (['High', 'Critical'].includes(row.priority)) bucket.highPriority += 1;
    if (bucket.samples.length < 4) {
      bucket.samples.push({
        id: row.id,
        testCaseId: row.testCaseId,
        testType: row.testType,
        status: row.status,
        testAction: compact(row.testAction, 120),
      });
    }
    buckets.set(key, bucket);
  }
  const total = rows.length;
  const negative = rows.filter(row => row.testType === 'Negative').length;
  const gaps = Array.from(buckets.values())
    .map(bucket => ({
      ...bucket,
      negativeRatio: bucket.total ? Number((bucket.negative / bucket.total).toFixed(2)) : 0,
      gapScore: bucket.negative === 0 ? bucket.total + bucket.highPriority * 2 : Math.max(0, bucket.total - bucket.negative * 4),
    }))
    .sort((a, b) => b.gapScore - a.gapScore || b.total - a.total)
    .slice(0, 10);

  const sampleCitations = rows.slice(0, 10).map(row => ({
    id: row.id,
    type: 'testcase' as const,
    label: row.testCaseId,
    testCaseId: row.testCaseId,
    description: `${row.module?.name || '-'} | ${row.page}${row.subMenu ? ` > ${row.subMenu}` : ''} | ${row.testType}`,
  }));

  return {
    name: 'getCoverageGap',
    summary: total
      ? `${total} testcase dianalisis, ${negative} negative (${Math.round((negative / total) * 100)}%).`
      : 'Tidak ditemukan testcase untuk analisis coverage/gap.',
    data: {
      target: targetModule ? { type: 'module', id: targetModule.id, name: targetModule.name } : { type: 'query', hints: pageHints },
      totals: {
        total,
        positive: total - negative,
        negative,
        negativeRatio: total ? Number((negative / total).toFixed(2)) : 0,
      },
      topGaps: gaps,
    },
    citations: [
      ...(targetModule ? [{ id: targetModule.id, type: 'module' as const, label: targetModule.name, description: `${total} testcase dianalisis` }] : []),
      ...sampleCitations,
    ],
  };
}

