import { db } from '@/lib/db';
import { extractKeywords, limitText } from '@/lib/ai-context';

export type CopilotCitationType = 'project' | 'module' | 'testcase' | 'bugfix' | 'knowledge' | 'automation' | 'devlog';

export interface CopilotCitation {
  id: string;
  type: CopilotCitationType;
  label: string;
  description?: string;
  testCaseId?: string;
}

export interface CopilotToolResult {
  name: string;
  summary: string;
  data: unknown;
  citations: CopilotCitation[];
}

export interface TestCaseDraft {
  testCaseId: string;
  page: string;
  subMenu: string;
  weight: string;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  priority: string;
  moduleId: string | null;
}

export interface CopilotActionDraft {
  id: string;
  type: 'CREATE_TESTCASE_DRAFT' | 'REFINE_TESTCASE_DRAFT' | 'BULK_STATUS_DRAFT' | 'BUGFIX_RETEST_SUGGESTION';
  title: string;
  description: string;
  testCaseDraft?: TestCaseDraft;
  payload?: Record<string, unknown>;
}

export type CopilotRequiredTool =
  | 'getProjectOverview'
  | 'searchProjectKnowledge'
  | 'searchTestCases'
  | 'getTestCaseDetail'
  | 'getBugFixes'
  | 'getStatusPriorityCases'
  | 'getGenericExpectedResultCases'
  | 'getWeakStepCases'
  | 'getModuleRisk'
  | 'getCoverageGap'
  | 'getDevLogSummary'
  | 'getAutomationHistory'
  | 'getLatestDevLogErrors'
  | 'getFigmaScreenCoverage';

const MAX_ROWS = 12;
import { buildContainsFilters, cleanText, compact, isErrorLogLine, matchTokens, modulePrefix, normalizeForMatch, parseDevLogError, parseRequestedPriorities, parseRequestedStatuses, parseTestCaseId, parseVisualIds, questionNeedsSelectedContext, uniqueCitations } from '@/lib/ai-copilot-utils';
import { buildDraftStepsFromContext, extractFollowUpTarget, flowPathToTarget, getNextTestCaseId, getNextTestCaseIds, getProjectModules, inferFigmaScreenText, inferFlowLine, inferModule, inferNamedTarget, negativeScenarioForFeature, readFeatureMapContext } from './ai-copilot-context';
import { getAutomationHistory, getDevLogSummary, getLatestDevLogErrors } from './ai-copilot-log-tools';
import { getCoverageGap, getGenericExpectedResultCases, getModuleRisk, getStatusPriorityCases, getWeakStepCases } from './ai-copilot-analysis-tools';

const TESTCASE_ID_PATTERN = /\b[A-Z]{1,4}-\d{2,4}\b/g;
const ACTION_WORD_PATTERN = /\b(buat|buatkan|dibuatkan|generate|draft|tambahkan|create)\b/i;


export async function getProjectOverview(projectId: string): Promise<CopilotToolResult> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      description: true,
      automationContext: true,
      _count: { select: { testCases: true, modules: true, bugFixItems: true } },
    },
  });
  if (!project) throw new Error('Project not found');

  const [modules, statusGroups, bugGroups, priorityGroups] = await Promise.all([
    db.module.findMany({
      where: { projectId },
      select: { id: true, name: true, _count: { select: { testCases: true, bugFixItems: true } } },
      orderBy: { name: 'asc' },
      take: 24,
    }),
    db.testCase.groupBy({ by: ['status'], where: { projectId }, _count: { id: true } }),
    db.bugFix.groupBy({ by: ['status'], where: { projectId }, _count: { id: true } }),
    db.testCase.groupBy({ by: ['priority'], where: { projectId }, _count: { id: true } }),
  ]);

  return {
    name: 'getProjectOverview',
    summary: `${project.name}: ${project._count.testCases} testcase, ${project._count.modules} module, ${project._count.bugFixItems} bugfix.`,
    data: {
      project: {
        id: project.id,
        name: project.name,
        description: compact(project.description, 220),
        automationContext: compact(project.automationContext, 220),
        counts: project._count,
      },
      modules,
      statusGroups,
      bugGroups,
      priorityGroups,
    },
    citations: [{
      id: project.id,
      type: 'project',
      label: project.name,
      description: `${project._count.testCases} testcase, ${project._count.bugFixItems} bugfix`,
    }],
  };
}

export async function searchTestCases(projectId: string, query: string, filters?: {
  status?: string;
  moduleId?: string;
  priority?: string;
}): Promise<CopilotToolResult> {
  const visualIds = parseVisualIds(query);
  const containsFilters = buildContainsFilters(query);
  const rows = await db.testCase.findMany({
    where: {
      projectId,
      ...(filters?.status && filters.status !== 'all' ? { status: filters.status } : {}),
      ...(filters?.moduleId && filters.moduleId !== 'all' ? { moduleId: filters.moduleId } : {}),
      ...(filters?.priority && filters.priority !== 'all' ? { priority: filters.priority } : {}),
      ...(visualIds.length > 0
        ? { testCaseId: { in: visualIds } }
        : containsFilters.length > 0
          ? { OR: containsFilters }
          : {}),
    },
    select: {
      id: true,
      testCaseId: true,
      page: true,
      subMenu: true,
      testType: true,
      testAction: true,
      steps: true,
      expectedResult: true,
      status: true,
      progress: true,
      priority: true,
      updatedAt: true,
      module: { select: { id: true, name: true } },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: MAX_ROWS,
  });

  return {
    name: 'searchTestCases',
    summary: rows.length ? `Ditemukan ${rows.length} testcase relevan.` : 'Tidak ditemukan testcase relevan.',
    data: rows.map(row => ({
      ...row,
      testAction: compact(row.testAction, 180),
      steps: compact(row.steps, 500),
      expectedResult: compact(row.expectedResult, 350),
    })),
    citations: rows.map(row => ({
      id: row.id,
      type: 'testcase',
      label: row.testCaseId,
      testCaseId: row.testCaseId,
      description: `${row.module?.name || '-'} | ${row.status} | ${compact(row.testAction, 100)}`,
    })),
  };
}

export async function getTestCaseDetail(projectId: string, idOrVisualId: string): Promise<CopilotToolResult> {
  const value = cleanText(idOrVisualId);
  const row = await db.testCase.findFirst({
    where: { projectId, OR: [{ id: value }, { testCaseId: value }] },
    include: { module: true },
  });

  if (!row) {
    return { name: 'getTestCaseDetail', summary: `Testcase ${value} tidak ditemukan.`, data: null, citations: [] };
  }

  return {
    name: 'getTestCaseDetail',
    summary: `Detail ${row.testCaseId}: ${row.status}, ${row.priority}.`,
    data: {
      id: row.id,
      testCaseId: row.testCaseId,
      page: row.page,
      subMenu: row.subMenu,
      testType: row.testType,
      status: row.status,
      priority: row.priority,
      progress: row.progress,
      testAction: compact(row.testAction, 320),
      steps: compact(row.steps, 1000),
      expectedResult: compact(row.expectedResult, 700),
      actualResult: compact(row.actualResult, 500),
      remarks: compact(row.remarks, 260),
      module: row.module ? { id: row.module.id, name: row.module.name } : null,
      stepLogs: compact(row.stepLogs, 700),
    },
    citations: [{
      id: row.id,
      type: 'testcase',
      label: row.testCaseId,
      testCaseId: row.testCaseId,
      description: `${row.module?.name || '-'} | ${row.status}`,
    }],
  };
}

export async function getBugFixes(projectId: string, filters?: {
  status?: string;
  moduleId?: string;
  query?: string;
}): Promise<CopilotToolResult> {
  const containsFilters = buildContainsFilters(filters?.query || '');
  const rows = await db.bugFix.findMany({
    where: {
      projectId,
      ...(filters?.status && filters.status !== 'all' ? { status: filters.status } : {}),
      ...(filters?.moduleId && filters.moduleId !== 'all' ? { moduleId: filters.moduleId } : {}),
      ...(containsFilters.length > 0 ? { OR: containsFilters } : {}),
    },
    select: {
      id: true,
      sourceTestCaseId: true,
      testCaseId: true,
      page: true,
      subMenu: true,
      testAction: true,
      status: true,
      priority: true,
      actualResult: true,
      reportedAt: true,
      readyAt: true,
      fixedAt: true,
      updatedAt: true,
      module: { select: { id: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: MAX_ROWS,
  });

  return {
    name: 'getBugFixes',
    summary: rows.length ? `Ditemukan ${rows.length} bugfix.` : 'Tidak ditemukan bugfix.',
    data: rows.map(row => ({ ...row, testAction: compact(row.testAction, 180) })),
    citations: rows.map(row => ({
      id: row.id,
      type: 'bugfix',
      label: row.testCaseId,
      testCaseId: row.testCaseId,
      description: `${row.module?.name || '-'} | ${row.status} | ${compact(row.actualResult, 80)}`,
    })),
  };
}

export async function searchProjectKnowledge(projectId: string, query: string): Promise<CopilotToolResult> {
  const keywords = extractKeywords(query);
  const rows = await db.projectKnowledge.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    take: 60,
  });

  const scored = rows
    .map(row => {
      const haystack = `${row.type} ${row.title} ${row.content}`.toLowerCase();
      const score = keywords.reduce((total, keyword) => total + (haystack.includes(keyword) ? 4 : 0), 0)
        + (['AI_PROFILE', 'QA_PREFERENCE', 'PROJECT_RULE', 'QA_RULES', 'TEST_STRATEGY'].includes(row.type) ? 8 : 0);
      return { row, score };
    })
    .filter(entry => entry.score > 0 || keywords.length === 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  return {
    name: 'searchProjectKnowledge',
    summary: scored.length ? `${scored.length} knowledge item relevan ditemukan.` : 'Tidak ada project knowledge relevan.',
    data: scored.map(({ row }) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      content: compact(row.content, 420),
      updatedAt: row.updatedAt,
    })),
    citations: scored.map(({ row }) => ({
      id: row.id,
      type: 'knowledge',
      label: row.title,
      description: row.type,
    })),
  };
}

import { chooseFigmaPage, extractFigmaPages, parseFigmaScreens, scoreScreenCoverage } from '@/lib/ai-copilot-figma';

export async function getFigmaScreenCoverage(projectId: string, query: string): Promise<CopilotToolResult> {
  const knowledgeRows = await db.projectKnowledge.findMany({
    where: {
      projectId,
      type: 'FEATURE_MAP',
    },
    orderBy: { updatedAt: 'desc' },
    take: 8,
  });
  const figmaRows = knowledgeRows.filter(row => /figma/i.test(`${row.title}\n${row.content}`));
  if (!figmaRows.length) {
    return { name: 'getFigmaScreenCoverage', summary: 'Figma feature map belum ditemukan di Project Knowledge.', data: null, citations: [] };
  }

  const figma = figmaRows[0];
  const pages = extractFigmaPages(figma.content);
  const pageName = chooseFigmaPage(query, Object.keys(pages));
  const screens = pageName ? parseFigmaScreens(pageName, pages[pageName] || []) : [];
  const modules = await db.module.findMany({
    where: { projectId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const normalizedPage = normalizeForMatch(pageName);
  const targetModule = modules.find(module => normalizedPage.includes(normalizeForMatch(module.name)) || normalizeForMatch(module.name).includes(normalizedPage));

  const testCases = await db.testCase.findMany({
    where: {
      projectId,
      ...(targetModule ? { moduleId: targetModule.id } : {}),
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
      expectedResult: true,
      module: { select: { id: true, name: true } },
    },
    take: 1000,
  });

  const screenCoverage = screens.slice(0, 60).map((screen) => {
    const matches = testCases
      .map(testCase => ({ testCase, score: scoreScreenCoverage(screen, testCase) }))
      .filter(item => item.score >= 4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(item => ({
        id: item.testCase.id,
        testCaseId: item.testCase.testCaseId,
        score: item.score,
        moduleName: item.testCase.module?.name || null,
        page: item.testCase.page,
        subMenu: item.testCase.subMenu,
        testType: item.testCase.testType,
        status: item.testCase.status,
        priority: item.testCase.priority,
        testAction: compact(item.testCase.testAction, 120),
      }));

    return {
      screen: screen.name,
      figmaText: screen.text.slice(0, 6),
      covered: matches.length > 0,
      matches,
    };
  });

  const coveredCount = screenCoverage.filter(item => item.covered).length;
  const citations: CopilotCitation[] = [
    { id: figma.id, type: 'knowledge', label: figma.title, description: `Figma page: ${pageName || '-'}` },
    ...screenCoverage
      .flatMap(item => item.matches)
      .slice(0, 10)
      .map(match => ({
        id: match.id,
        type: 'testcase' as const,
        label: match.testCaseId,
        testCaseId: match.testCaseId,
        description: `${match.moduleName || '-'} | ${match.page}${match.subMenu ? ` > ${match.subMenu}` : ''} | score ${match.score}`,
      })),
  ];

  return {
    name: 'getFigmaScreenCoverage',
    summary: pageName
      ? `${coveredCount}/${screenCoverage.length} screen Figma pada page ${pageName} punya kandidat testcase.`
      : 'Tidak ada page Figma yang bisa dianalisis.',
    data: {
      figmaKnowledge: { id: figma.id, title: figma.title },
      pageName,
      targetModule: targetModule ? { id: targetModule.id, name: targetModule.name } : null,
      totals: {
        figmaScreens: screenCoverage.length,
        covered: coveredCount,
        missing: Math.max(0, screenCoverage.length - coveredCount),
      },
      screens: screenCoverage,
    },
    citations,
  };
}

export async function createDeterministicDraft(projectId: string, question: string): Promise<CopilotActionDraft[]> {
  if (!ACTION_WORD_PATTERN.test(question)) return [];
  const lower = question.toLowerCase();
  const namedTarget = inferNamedTarget(question);
  const featureMaps = await readFeatureMapContext(projectId);
  if (/negative|invalid|error|gagal|tidak valid|missing|gap/.test(lower)) {
    const coverage = await getCoverageGap(projectId, question);
    const data: any = coverage.data;
    const gaps = Array.isArray(data?.topGaps) ? data.topGaps : [];
    const selectedGaps = gaps
      .filter((gap: any) => Number(gap.negative || 0) === 0 || Number(gap.negativeRatio || 0) < 0.25)
      .slice(0, 3);
    if (selectedGaps.length > 0) {
      const idsByScope = new Map<string, string[]>();
      const drafts: CopilotActionDraft[] = [];
      const scenarios = [
        {
          name: 'data wajib kosong',
          invalidData: 'kosongkan field wajib atau data utama pada form/flow tersebut',
          expected: 'Sistem menolak proses, menampilkan pesan validasi pada field yang bermasalah, dan tidak membuat atau mengubah data transaksi.',
        },
        {
          name: 'format atau nilai tidak valid',
          invalidData: 'isi field dengan format/nilai yang tidak valid, di luar batas, atau tidak sesuai aturan bisnis',
          expected: 'Sistem menampilkan error yang spesifik, mempertahankan input yang perlu dikoreksi, dan tidak melanjutkan proses ke tahap berikutnya.',
        },
        {
          name: 'aksi berulang atau kondisi tidak valid',
          invalidData: 'jalankan aksi utama dua kali atau saat kondisi data belum memenuhi syarat',
          expected: 'Sistem mencegah proses ganda atau proses tidak valid, tidak membuat duplikasi data, dan state UI tetap konsisten.',
        },
      ];

      for (let index = 0; index < selectedGaps.length; index += 1) {
        const gap: any = selectedGaps[index];
        const scopeKey = `${gap.moduleId || 'none'}|${gap.page || ''}|${gap.subMenu || ''}`;
        if (!idsByScope.has(scopeKey)) {
          idsByScope.set(scopeKey, await getNextTestCaseIds(projectId, gap.moduleId || null, selectedGaps.length, {
            page: gap.page || undefined,
            subMenu: gap.subMenu || undefined,
          }));
        }
        const nextId = idsByScope.get(scopeKey)?.shift() || await getNextTestCaseId(projectId, gap.moduleId || null);
        const location = [gap.page, gap.subMenu].filter(Boolean).join(' > ') || gap.moduleName || 'fitur terkait';
        const feature = gap.subMenu || gap.page || gap.moduleName || 'fitur terkait';
        const scenario = negativeScenarioForFeature(feature, index);
        const flowLine = inferFlowLine(featureMaps, gap.moduleName || gap.page || '');
        const figmaText = inferFigmaScreenText(featureMaps, gap.moduleName || gap.page || '', feature);
        const sampleIds = Array.isArray(gap.samples) && gap.samples.length
          ? gap.samples.map((sample: any) => sample.testCaseId).filter(Boolean).join(', ')
          : '-';

        drafts.push({
          id: `draft-${nextId}-${index}`,
          type: 'CREATE_TESTCASE_DRAFT',
          title: `Draft ${nextId} - ${feature}`,
          description: `Negative case untuk gap ${location}. Referensi coverage: ${sampleIds}`,
          testCaseDraft: {
            testCaseId: nextId,
            page: gap.page || gap.moduleName || 'Fitur terkait',
            subMenu: gap.subMenu || '',
            weight: '',
            testType: 'Negative',
            testAction: `[${feature}] Validasi penolakan saat ${scenario.name}`,
            steps: buildDraftStepsFromContext({ location, feature, scenario, flowLine, figmaText }),
            expectedResult: scenario.expected,
            priority: gap.highPriority > 0 || gap.total >= 5 ? 'High' : 'Medium',
            moduleId: gap.moduleId || null,
          },
        });
      }

      return drafts;
    }

    if (namedTarget) {
      const target = namedTarget.toUpperCase() === namedTarget ? namedTarget : namedTarget.replace(/\b\w/g, char => char.toUpperCase());
      const nextIds = await getNextTestCaseIds(projectId, null, 3);
      const flowLine = inferFlowLine(featureMaps, target);
      return [
        {
          feature: 'field wajib',
          invalidData: 'kosongkan field wajib pada proses utama',
          expected: 'Sistem menampilkan pesan validasi pada field wajib, proses tidak dilanjutkan, dan tidak ada data baru yang tersimpan.',
        },
        {
          feature: 'format atau nilai input',
          invalidData: 'isi data dengan format salah, nilai di luar batas, atau karakter yang tidak sesuai',
          expected: 'Sistem menolak input tidak valid dengan pesan error yang spesifik dan mempertahankan user pada halaman yang sama untuk koreksi.',
        },
        {
          feature: 'pencegahan submit ganda',
          invalidData: 'klik aksi utama lebih dari satu kali saat proses sedang berjalan',
          expected: 'Sistem hanya memproses satu request, tidak membuat duplikasi transaksi/data, dan menampilkan state loading atau disabled yang jelas.',
        },
      ].map((scenario, index): CopilotActionDraft => ({
        id: `draft-${nextIds[index]}-${index}`,
        type: 'CREATE_TESTCASE_DRAFT',
        title: `Draft ${nextIds[index]} - ${target}`,
        description: `Negative case spesifik untuk ${target}: ${scenario.feature}.`,
        testCaseDraft: {
          testCaseId: nextIds[index],
          page: target,
          subMenu: '',
          weight: '',
          testType: 'Negative',
          testAction: `[${target}] Validasi ${scenario.feature}`,
          steps: buildDraftStepsFromContext({
            location: `module ${target}`,
            feature: scenario.feature,
            scenario,
            flowLine,
            figmaText: inferFigmaScreenText(featureMaps, target, scenario.feature),
          }),
          expectedResult: scenario.expected,
          priority: 'High',
          moduleId: null,
        },
      }));
    }
  }

  const moduleRecord = await inferModule(projectId, question);
  const moduleId = moduleRecord?.id || null;
  const nextId = await getNextTestCaseId(projectId, moduleId);
  const testType = /negative|invalid|error|gagal|tidak valid/.test(lower) ? 'Negative' : 'Positive';
  const target = moduleRecord?.name || 'fitur terkait';

  return [{
    id: `draft-${Date.now()}`,
    type: 'CREATE_TESTCASE_DRAFT',
    title: `Draft testcase ${nextId}`,
    description: `Draft belum disimpan. Review sebelum ditambahkan ke database.`,
    testCaseDraft: {
      testCaseId: nextId,
      page: target,
      subMenu: '',
      weight: '',
      testType,
      testAction: `[${target}] Verifikasi skenario ${testType === 'Negative' ? 'negative' : 'utama'} berdasarkan instruksi AI Copilot`,
      steps: [
        `1. Buka area ${target}`,
        '2. Siapkan data uji sesuai skenario yang diminta',
        '3. Jalankan aksi utama pada fitur tersebut',
        '4. Amati respons sistem dan data yang tampil',
      ].join('\n'),
      expectedResult: testType === 'Negative'
        ? 'Sistem menolak input atau kondisi yang tidak valid, menampilkan pesan yang jelas, dan tidak mengubah data secara tidak semestinya.'
        : 'Fitur berjalan sesuai kebutuhan, data tampil akurat, dan tidak ada error visual maupun proses.',
      priority: /critical|kritis|high|penting/.test(lower) ? 'High' : 'Medium',
      moduleId,
    },
  }];
}

export async function runCopilotTools(input: {
  projectId: string;
  question: string;
  selectedTestCaseId?: string;
  requiredTools?: CopilotRequiredTool[];
  allowDrafts?: boolean;
}) {
  const { projectId, question, selectedTestCaseId, requiredTools, allowDrafts = true } = input;
  const lower = question.toLowerCase();
  const requestedIds = parseVisualIds(question);
  const tools: CopilotToolResult[] = [];
  const usedToolNames = new Set<string>();
  const hasStatusPriorityQuery = /status|prioritas|priority|critical|kritis|\bhigh\b|\blow\b|medium|not done|done|blocked|failed|gagal|in progress/.test(lower);
  const hasGenericExpectedQuery = /expected result|expected|hasil.*generic|terlalu generic|masih generic|kurang spesifik/.test(lower);
  const hasWeakStepsQuery = /steps?|langkah|kurang jelas|tidak jelas|manual qa|manual tester|eksekusi manual/.test(lower);
  const hasLatestDevLogErrorQuery = /devlog|log|error|terakhir|latest/.test(lower) && /error|terakhir|latest/.test(lower);

  const pushTool = async (name: CopilotRequiredTool) => {
    if (usedToolNames.has(name)) return;
    usedToolNames.add(name);
    switch (name) {
      case 'getProjectOverview':
        tools.push(await getProjectOverview(projectId));
        break;
      case 'searchProjectKnowledge':
        tools.push(await searchProjectKnowledge(projectId, question));
        break;
      case 'searchTestCases':
        tools.push(await searchTestCases(projectId, question));
        break;
      case 'getBugFixes':
        tools.push(await getBugFixes(projectId, { query: question }));
        break;
      case 'getStatusPriorityCases':
        tools.push(await getStatusPriorityCases(projectId, question));
        break;
      case 'getGenericExpectedResultCases':
        tools.push(await getGenericExpectedResultCases(projectId, question));
        break;
      case 'getWeakStepCases':
        tools.push(await getWeakStepCases(projectId, question));
        break;
      case 'getModuleRisk':
        tools.push(await getModuleRisk(projectId));
        break;
      case 'getCoverageGap':
        tools.push(await getCoverageGap(projectId, question));
        break;
      case 'getLatestDevLogErrors':
        tools.push(await getLatestDevLogErrors(projectId));
        break;
      case 'getFigmaScreenCoverage':
        tools.push(await getFigmaScreenCoverage(projectId, question));
        break;
      case 'getTestCaseDetail':
        if (selectedTestCaseId) tools.push(await getTestCaseDetail(projectId, selectedTestCaseId));
        break;
      case 'getDevLogSummary':
        if (selectedTestCaseId || requestedIds[0]) tools.push(await getDevLogSummary(selectedTestCaseId || requestedIds[0]));
        break;
      case 'getAutomationHistory':
        tools.push(await getAutomationHistory(projectId, selectedTestCaseId || requestedIds[0]));
        break;
    }
  };

  await pushTool('getProjectOverview');
  await pushTool('searchProjectKnowledge');

  if (selectedTestCaseId) {
    await pushTool('getTestCaseDetail');
    if (questionNeedsSelectedContext(question)) {
      await pushTool('getDevLogSummary');
    }
  }

  for (const visualId of requestedIds.slice(0, 3)) {
    tools.push(await getTestCaseDetail(projectId, visualId));
    tools.push(await getDevLogSummary(visualId));
  }

  if (requiredTools?.length) {
    for (const toolName of requiredTools) {
      await pushTool(toolName);
    }
  } else {
    if (/bug|retest|fix|failed|gagal|ready|verified|defect/.test(lower)) {
      await pushTool('getBugFixes');
    }

    if (hasStatusPriorityQuery) {
      await pushTool('getStatusPriorityCases');
    }

    if (hasGenericExpectedQuery) {
      await pushTool('getGenericExpectedResultCases');
    }

    if (hasWeakStepsQuery) {
      await pushTool('getWeakStepCases');
    }

    if (/coverage|cover|gap|cukup|negative case|positive case|skenario|missing|belum\s+(?:di)?buat|testcase.*belum/.test(lower)) {
      await pushTool('getCoverageGap');
    }

    if (/figma|screen|design|desain/.test(lower) && /coverage|cover|mencakup|cukup|testcase|case/.test(lower)) {
      await pushTool('getFigmaScreenCoverage');
    }

    if (/risk|risiko|prioritas|status|summary|ringkas|project|module|modul|health|progress/.test(lower)) {
      await pushTool('getModuleRisk');
    }

    if (hasLatestDevLogErrorQuery) {
      await pushTool('getLatestDevLogErrors');
    }

    if (!hasWeakStepsQuery && !hasLatestDevLogErrorQuery && /automation|devlog|log|manual|record|evidence|history|run/.test(lower)) {
      await pushTool('getAutomationHistory');
    }

    if (!hasStatusPriorityQuery && !hasGenericExpectedQuery && !hasWeakStepsQuery && !hasLatestDevLogErrorQuery) {
      await pushTool('searchTestCases');
    }
  }

  const actionDrafts = allowDrafts ? await createDeterministicDraft(projectId, question) : [];
  return {
    tools,
    actionDrafts,
    citations: uniqueCitations(tools.flatMap(tool => tool.citations)),
  };
}

export { formatToolResultsForPrompt } from '@/lib/ai-copilot-prompt-format';
