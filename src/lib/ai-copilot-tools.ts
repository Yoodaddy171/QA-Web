import fs from 'fs/promises';
import path from 'path';
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
const TESTCASE_ID_PATTERN = /\b[A-Z]{1,4}-\d{2,4}\b/g;
const ACTION_WORD_PATTERN = /\b(buat|buatkan|dibuatkan|generate|draft|tambahkan|create)\b/i;
const COVERAGE_STOPWORDS = new Set([
  'ada', 'atau', 'bagian', 'berdasarkan', 'case', 'cases', 'cek', 'cover', 'coverage', 'dari', 'dan', 'dengan',
  'di', 'figma', 'ini', 'knowledge', 'mencakup', 'page', 'screen', 'screens', 'sudah', 'test', 'testcase',
  'yang', 'untuk',
]);

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function compact(value: unknown, max = 300) {
  return limitText(cleanText(value), max);
}

function normalizeForMatch(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchTokens(value: unknown) {
  return Array.from(new Set(
    normalizeForMatch(value)
      .split(/\s+/)
      .filter(token => token.length >= 3)
      .filter(token => !COVERAGE_STOPWORDS.has(token))
  ));
}

function uniqueCitations(citations: CopilotCitation[]) {
  const map = new Map<string, CopilotCitation>();
  for (const citation of citations) {
    map.set(`${citation.type}:${citation.id}`, citation);
  }
  return Array.from(map.values());
}

function buildContainsFilters(query: string) {
  const keywords = extractKeywords(query).slice(0, 8);
  if (keywords.length === 0) return [];

  return keywords.flatMap(keyword => [
    { testCaseId: { contains: keyword } },
    { page: { contains: keyword } },
    { subMenu: { contains: keyword } },
    { testAction: { contains: keyword } },
    { steps: { contains: keyword } },
    { expectedResult: { contains: keyword } },
    { actualResult: { contains: keyword } },
    { status: { contains: keyword } },
    { priority: { contains: keyword } },
  ]);
}

function parseVisualIds(text: string) {
  return Array.from(new Set(cleanText(text).match(TESTCASE_ID_PATTERN) || []));
}

function questionNeedsSelectedContext(question: string) {
  return /\b(ini|detail|recording ini|screenshot ini|screen ini|evidence ini|summary ini|ringkas ini|testcase ini|case ini|devlog ini|log ini)\b/i.test(question);
}

function parseRequestedStatuses(question: string) {
  const lower = question.toLowerCase();
  const statuses: string[] = [];
  if (/\bnot done\b|belum selesai|belum done/.test(lower)) statuses.push('NOT DONE');
  if (/\bdone\b|sudah selesai/.test(lower) && !/\bnot done\b/.test(lower)) statuses.push('DONE');
  if (/in progress|sedang/.test(lower)) statuses.push('IN PROGRESS');
  if (/failed|gagal/.test(lower)) statuses.push('FAILED');
  if (/blocked|terblokir/.test(lower)) statuses.push('BLOCKED');
  if (/ready to retest|siap retest/.test(lower)) statuses.push('READY TO RETEST');
  return Array.from(new Set(statuses));
}

function parseRequestedPriorities(question: string) {
  const lower = question.toLowerCase();
  const priorities: string[] = [];
  if (/critical|kritis/.test(lower)) priorities.push('Critical');
  if (/\bhigh\b|tinggi/.test(lower)) priorities.push('High');
  if (/medium|sedang/.test(lower)) priorities.push('Medium');
  if (/\blow\b|rendah/.test(lower)) priorities.push('Low');
  return Array.from(new Set(priorities));
}

function isErrorLogLine(line: string) {
  const lower = line.toLowerCase();
  if (/error|failed|failure|exception|timeout|severe|uncaught|not as expected/.test(lower)) return true;
  try {
    const parsed = JSON.parse(line);
    const status = Number(parsed?.network?.status ?? parsed?.status);
    if (Number.isFinite(status) && status >= 400) return true;
    if (parsed?.network?.success === false || parsed?.success === false) return true;
    if (String(parsed?.level || '').toUpperCase() === 'SEVERE') return true;
  } catch {}
  return false;
}

function parseDevLogError(line: string) {
  try {
    const parsed = JSON.parse(line);
    const network = parsed?.network || null;
    const status = Number(network?.status ?? parsed?.status);
    const method = cleanText(network?.method || parsed?.method);
    const url = cleanText(network?.url || parsed?.url);
    const success = network?.success ?? parsed?.success;
    const level = cleanText(parsed?.level).toUpperCase();
    const message = compact(parsed?.log || parsed?.message || line, 140);
    const isNetworkError = Boolean(url) && ((Number.isFinite(status) && status >= 400) || success === false);
    const isConsoleError = level === 'SEVERE' || /error|failed|failure|exception|timeout|uncaught/i.test(message);
    const key = isNetworkError
      ? `network:${method || '-'}:${status || '-'}:${url}`
      : `console:${level || '-'}:${message}`;

    return {
      key,
      type: isNetworkError ? 'network' : 'console',
      method,
      status: Number.isFinite(status) ? status : null,
      url,
      message,
      isError: isNetworkError || isConsoleError,
    };
  } catch {
    return {
      key: `raw:${compact(line, 140)}`,
      type: 'console',
      method: '',
      status: null,
      url: '',
      message: compact(line, 140),
      isError: isErrorLogLine(line),
    };
  }
}

function modulePrefix(moduleName: string) {
  const name = moduleName.toLowerCase();
  if (/kds|kitchen|chef|dapur/.test(name)) return 'B-';
  if (/kiosk/.test(name)) return 'C-';
  if (/queue|antrian|display/.test(name)) return 'D-';
  if (/customer|mobile|menu|dining/.test(name)) return 'E-';
  return 'A-';
}

function parseTestCaseId(value: string) {
  const match = value.match(/^(.+?-)(\d+)$/);
  if (!match) return null;
  return { prefix: match[1], number: Number(match[2]), width: match[2].length };
}

async function getNextTestCaseIds(projectId: string, moduleId: string | null, count = 1, scope?: { page?: string; subMenu?: string }) {
  let prefix = 'A-';
  const moduleRecord = moduleId
    ? await db.module.findFirst({ where: { id: moduleId, projectId }, select: { name: true } })
    : null;
  if (moduleRecord?.name) prefix = modulePrefix(moduleRecord.name);

  const rows = await db.testCase.findMany({
    where: {
      projectId,
      ...(moduleId ? { moduleId } : {}),
      ...(scope?.page ? { page: scope.page } : {}),
      ...(scope?.subMenu ? { subMenu: scope.subMenu } : {}),
    },
    select: { testCaseId: true },
  });

  const allParsed = rows
    .map(row => parseTestCaseId(row.testCaseId))
    .filter((value): value is NonNullable<ReturnType<typeof parseTestCaseId>> => Boolean(value));
  if (allParsed.length > 0) {
    const prefixCounts = allParsed.reduce<Record<string, number>>((acc, item) => {
      acc[item.prefix] = (acc[item.prefix] || 0) + 1;
      return acc;
    }, {});
    prefix = Object.entries(prefixCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || prefix;
  }

  const parsed = allParsed
    .filter(value => value.prefix === prefix)
    .sort((a, b) => b.number - a.number);
  const latest = parsed[0];
  const width = latest?.width || 3;
  return Array.from({ length: count }, (_, index) => `${prefix}${String((latest?.number || 0) + index + 1).padStart(width, '0')}`);
}

async function getNextTestCaseId(projectId: string, moduleId: string | null) {
  return (await getNextTestCaseIds(projectId, moduleId, 1))[0];
}

function extractFollowUpTarget(question: string) {
  const match = cleanText(question).match(/(?:follow-up target|scope override)\s*:\s*([^\r\n]+)/i);
  return cleanText(match?.[1]);
}

async function getProjectModules(projectId: string) {
  return db.module.findMany({
    where: { projectId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}

function findModuleByHint<T extends { name: string }>(modules: T[], hint: string) {
  const normalizedHint = normalizeForMatch(hint);
  if (!normalizedHint) return null;

  return modules.find((module) => {
    const normalizedName = normalizeForMatch(module.name);
    return normalizedHint.includes(normalizedName) || normalizedName.includes(normalizedHint);
  }) || null;
}

async function inferModule(projectId: string, question: string) {
  const modules = await getProjectModules(projectId);
  const followUpTarget = extractFollowUpTarget(question);
  const namedTarget = inferNamedTarget(followUpTarget || question);

  const explicitTarget = findModuleByHint(modules, followUpTarget)
    || findModuleByHint(modules, namedTarget);
  if (explicitTarget) return explicitTarget;

  const normalized = normalizeForMatch(question);
  return modules.find(module => normalized.includes(normalizeForMatch(module.name))) || null;
}

function inferNamedTarget(question: string) {
  const text = cleanText(question);
  const match = text.match(/\b(?:module|modul|menu|page|halaman)\s+([a-z0-9][a-z0-9\s_-]{1,30})/i);
  if (!match?.[1]) return '';
  return match[1]
    .replace(/\b(tapi|jangan|tolong|buatkan|buat|generate|draft|missing|negative|cases?|testcase|simpan|dulu)\b.*$/i, '')
    .trim();
}

async function readFeatureMapContext(projectId: string) {
  const rows = await db.projectKnowledge.findMany({
    where: { projectId, type: 'FEATURE_MAP' },
    select: { title: true, content: true },
    orderBy: { updatedAt: 'desc' },
    take: 6,
  });
  return rows;
}

function inferFlowLine(featureMaps: Array<{ title: string; content: string }>, moduleName: string) {
  const normalizedModule = normalizeForMatch(moduleName);
  for (const item of featureMaps) {
    const lines = item.content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index].trim();
      if (!line.toLowerCase().endsWith('flow:')) continue;
      const label = normalizeForMatch(line.replace(/flow:\s*$/i, ''));
      if (!normalizedModule.includes(label) && !label.includes(normalizedModule)) continue;

      const nextLines: string[] = [];
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const candidate = lines[cursor].trim();
        if (!candidate) {
          if (nextLines.length > 0) break;
          continue;
        }
        if (/^[A-Za-z].*flow:\s*$/i.test(candidate)) break;
        nextLines.push(candidate);
        if (candidate.includes('->')) break;
      }
      const flow = nextLines.join(' ').trim();
      if (flow) return flow;
    }
  }
  return '';
}

function inferFigmaScreenText(featureMaps: Array<{ title: string; content: string }>, moduleName: string, screenName: string) {
  const figma = featureMaps.find(item => /figma/i.test(`${item.title}\n${item.content}`));
  if (!figma) return [];
  const pages = extractFigmaPages(figma.content);
  const pageName = chooseFigmaPage(moduleName, Object.keys(pages));
  const screens = pageName ? parseFigmaScreens(pageName, pages[pageName] || []) : [];
  const screenTokens = matchTokens(screenName);
  const match = screens
    .map(screen => ({
      screen,
      score: screenTokens.reduce((total, token) => total + (normalizeForMatch(screen.name).includes(token) ? 2 : 0), 0)
        + (normalizeForMatch(screen.name) === normalizeForMatch(screenName) ? 8 : 0),
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  return match?.screen.text.slice(0, 5) || [];
}

function flowPathToTarget(flowLine: string, target: string) {
  const parts = flowLine
    .split(/\s*->\s*/)
    .map(part => part.trim())
    .filter(Boolean);
  if (!parts.length) return [];
  const targetTokens = matchTokens(target);
  const targetIndex = parts.findIndex(part => {
    const normalized = normalizeForMatch(part);
    return targetTokens.some(token => normalized.includes(token));
  });
  const endIndex = targetIndex >= 0 ? targetIndex : Math.min(parts.length - 1, 3);
  return parts.slice(0, endIndex + 1);
}

function buildDraftStepsFromContext(input: {
  location: string;
  feature: string;
  scenario: { invalidData: string; action?: string };
  flowLine: string;
  figmaText: string[];
}) {
  const pathParts = flowPathToTarget(input.flowLine, input.feature || input.location);
  const steps: string[] = [];

  if (pathParts.length > 0) {
    steps.push(`1. Buka aplikasi dan ikuti flow: ${pathParts.join(' -> ')}`);
  } else {
    steps.push(`1. Buka ${input.location}`);
  }

  const visibleText = input.figmaText.filter(Boolean).slice(0, 3);
  if (visibleText.length > 0) {
    steps.push(`2. Pastikan screen menampilkan elemen sesuai Figma: ${visibleText.join(', ')}`);
  } else {
    steps.push(`2. Pastikan area ${input.feature} tampil dan siap digunakan`);
  }

  steps.push(`3. Buat kondisi negatif dengan cara ${input.scenario.invalidData}`);
  steps.push(`4. ${input.scenario.action || 'Klik tombol aksi utama atau lanjutkan proses'}`);
  steps.push(`5. Pastikan hasilnya sesuai: ${input.scenario.expected}`);

  return steps.join('\n');
}

function negativeScenarioForFeature(feature: string, index: number) {
  const normalized = normalizeForMatch(feature);

  if (/passcode|pin/.test(normalized)) {
    return {
      name: 'passcode salah atau kosong',
      invalidData: 'kosongkan passcode atau masukkan passcode kurang dari 4 digit/salah',
      action: 'Tekan tombol submit/login setelah passcode invalid dimasukkan',
      expected: 'Sistem menolak login, menampilkan pesan passcode tidak valid, dan user tetap berada di halaman passcode tanpa masuk ke POS.',
    };
  }

  if (/select user|change user|logged in|login/.test(normalized)) {
    return {
      name: 'user belum dipilih atau pergantian user dibatalkan',
      invalidData: 'lanjutkan proses tanpa memilih user, atau buka konfirmasi change user lalu batalkan',
      action: 'Coba lanjutkan login/change user dari state tersebut',
      expected: 'Sistem tidak mengganti sesi user, tidak membuka akses POS untuk user yang tidak valid, dan menampilkan state/konfirmasi sesuai desain.',
    };
  }

  if (/lock screen|system control|turn off|restart/.test(normalized)) {
    return {
      name: 'aksi sistem tanpa konfirmasi valid',
      invalidData: 'pilih aksi lock/change user/restart/turn off lalu batalkan pada modal konfirmasi',
      action: 'Klik Cancel/No pada modal konfirmasi dan ulangi aksi saat device masih dalam state terkunci',
      expected: 'Sistem membatalkan aksi, device tetap pada state sebelumnya, dan tidak terjadi logout/restart/change user tanpa konfirmasi.',
    };
  }

  if (/table|open table|guest|reserve/.test(normalized)) {
    return {
      name: 'open table tanpa data meja valid',
      invalidData: 'pilih meja tanpa mengisi jumlah guest, atau gunakan meja yang sudah active/reserved',
      action: 'Klik Start Order/Open Table/Order QR pada kondisi meja yang belum valid',
      expected: 'Sistem menolak membuka sesi meja, menampilkan validasi yang jelas, dan status meja tidak berubah menjadi active/reserved.',
    };
  }

  if (/menu|item|customize|cart|order/.test(normalized)) {
    return {
      name: 'order item dengan kondisi tidak valid',
      invalidData: 'pilih item sold out/low stock melebihi stok, atau hapus semua item lalu lanjutkan ke cart/payment',
      action: 'Klik Add to Cart/Payment/Send to Kitchen pada kondisi cart atau item yang tidak valid',
      expected: 'Sistem menolak proses order, menampilkan pesan stok/cart kosong yang spesifik, dan tidak mengirim pesanan ke kitchen.',
    };
  }

  if (/promo/.test(normalized)) {
    return {
      name: 'promo invalid atau expired',
      invalidData: 'masukkan kode promo salah, expired, atau tidak memenuhi syarat transaksi',
      action: 'Klik Apply Promo setelah kode invalid dimasukkan',
      expected: 'Sistem menampilkan pesan promo tidak valid/expired, tidak mengubah total pembayaran, dan promo tidak tersimpan pada order.',
    };
  }

  if (/payment|pay|cash|card|qris|va|bayar/.test(normalized)) {
    return {
      name: 'payment gagal atau data pembayaran tidak valid',
      invalidData: 'lanjutkan payment tanpa metode valid, nominal cash kurang dari total, atau simulasikan QRIS/VA gagal',
      action: 'Klik Pay/Confirm Payment lalu jalankan simulator payment gagal jika diperlukan',
      expected: 'Sistem menampilkan status payment gagal/pending sesuai kondisi, order tidak ditandai paid, dan user masih bisa mengganti metode pembayaran.',
    };
  }

  const genericScenarios = [
    {
      name: 'data wajib kosong',
      invalidData: 'kosongkan field wajib atau data utama pada form/flow tersebut',
      action: 'Klik tombol aksi utama setelah data wajib dikosongkan',
      expected: 'Sistem menolak proses, menampilkan pesan validasi pada field yang bermasalah, dan tidak membuat atau mengubah data transaksi.',
    },
    {
      name: 'format atau nilai tidak valid',
      invalidData: 'isi field dengan format/nilai yang tidak valid, di luar batas, atau tidak sesuai aturan bisnis',
      action: 'Klik tombol aksi utama setelah input invalid dimasukkan',
      expected: 'Sistem menampilkan error yang spesifik, mempertahankan input yang perlu dikoreksi, dan tidak melanjutkan proses ke tahap berikutnya.',
    },
    {
      name: 'aksi berulang atau kondisi tidak valid',
      invalidData: 'jalankan aksi utama dua kali atau saat kondisi data belum memenuhi syarat',
      action: 'Klik aksi utama dua kali saat loading atau sebelum data memenuhi syarat',
      expected: 'Sistem mencegah proses ganda atau proses tidak valid, tidak membuat duplikasi data, dan state UI tetap konsisten.',
    },
  ];

  return genericScenarios[index % genericScenarios.length];
}

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
      testAction: compact(row.testAction, 260),
      steps: compact(row.steps, 600),
      expectedResult: compact(row.expectedResult, 420),
      actualResult: compact(row.actualResult, 260),
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

async function readLogFileLines(filePath: string, maxLines = 80) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content.trim().split('\n').filter(Boolean).slice(-maxLines);
  } catch {
    return [];
  }
}

export async function getDevLogSummary(testCaseId: string): Promise<CopilotToolResult> {
  const id = cleanText(testCaseId);
  if (!id) return { name: 'getDevLogSummary', summary: 'Tidak ada testcase dipilih.', data: null, citations: [] };

  const logsDir = path.join(process.cwd(), 'mini-services', 'logs');
  const candidates = [
    path.join(logsDir, `${id}.current.jsonl`),
    path.join(logsDir, `${id}.previous.jsonl`),
    path.join(logsDir, `${id}.jsonl`),
  ];
  const lines = (await Promise.all(candidates.map(file => readLogFileLines(file, 100)))).flat();
  const parsed = lines.map((line) => {
    try {
      const item = JSON.parse(line);
      return {
        timestamp: item.timestamp,
        level: item.level,
        source: item.source,
        relativeMs: item.relativeMs,
      log: compact(typeof item.log === 'string' ? item.log : JSON.stringify(item.log), 180),
        network: item.network ? {
          method: item.network.method,
          status: item.network.status,
          url: item.network.url,
          success: item.network.success,
        } : null,
      };
    } catch {
      return { raw: compact(line, 300) };
    }
  }).slice(-24);

  const errorCount = parsed.filter((item: any) => item.level === 'SEVERE' || item.network?.success === false || Number(item.network?.status) >= 400).length;
  return {
    name: 'getDevLogSummary',
    summary: parsed.length ? `${parsed.length} log terbaru dibaca, ${errorCount} indikasi error.` : `Log untuk ${id} tidak ditemukan.`,
    data: { testCaseId: id, recentLogs: parsed, errorCount },
    citations: parsed.length ? [{ id, type: 'devlog', label: `DevLog ${id}`, testCaseId: id, description: `${parsed.length} recent rows` }] : [],
  };
}

export async function getAutomationHistory(projectId: string, testCaseId?: string): Promise<CopilotToolResult> {
  const logsDir = path.join(process.cwd(), 'mini-services', 'logs');
  let files: string[] = [];
  try {
    files = await fs.readdir(logsDir);
  } catch {
    return { name: 'getAutomationHistory', summary: 'Folder automation log tidak ditemukan.', data: [], citations: [] };
  }

  const testCases = await db.testCase.findMany({
    where: {
      projectId,
      ...(testCaseId ? { OR: [{ id: testCaseId }, { testCaseId }] } : {}),
    },
    select: { id: true, testCaseId: true, page: true, subMenu: true, status: true, module: { select: { name: true } } },
    take: testCaseId ? 5 : 80,
  });
  const idMap = new Map(testCases.flatMap(row => [[row.id, row], [row.testCaseId, row]]));
  const items: Array<Record<string, unknown>> = [];

  for (const file of files) {
    const match = file.match(/^(.+?)(?:\.(current|previous))?\.jsonl$/);
    if (!match) continue;
    const owner = idMap.get(match[1]);
    if (!owner) continue;
    const stat = await fs.stat(path.join(logsDir, file));
    items.push({
      file,
      kind: match[2] || 'legacy',
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
      testCaseId: owner.testCaseId,
      page: owner.page,
      module: owner.module?.name || '-',
      status: owner.status,
    });
  }

  items.sort((a, b) => new Date(String(b.updatedAt)).getTime() - new Date(String(a.updatedAt)).getTime());
  const latestByTestCase = new Map<string, Record<string, unknown>>();
  for (const item of items) {
    if (!latestByTestCase.has(String(item.testCaseId))) {
      latestByTestCase.set(String(item.testCaseId), item);
    }
  }
  const limited = Array.from(latestByTestCase.values()).slice(0, MAX_ROWS);
  return {
    name: 'getAutomationHistory',
    summary: limited.length ? `${limited.length} automation history terbaru ditemukan.` : 'Tidak ada automation history ditemukan.',
    data: limited,
    citations: limited.map(item => ({
      id: String(item.file),
      type: 'automation',
      label: String(item.testCaseId),
      testCaseId: String(item.testCaseId),
      description: `${item.kind} | ${item.updatedAt}`,
    })),
  };
}

export async function getLatestDevLogErrors(projectId: string): Promise<CopilotToolResult> {
  const logsDir = path.join(process.cwd(), 'mini-services', 'logs');
  let files: string[] = [];
  try {
    files = await fs.readdir(logsDir);
  } catch {
    return { name: 'getLatestDevLogErrors', summary: 'Folder devlog tidak ditemukan.', data: [], citations: [] };
  }

  const testCases = await db.testCase.findMany({
    where: { projectId },
    select: {
      id: true,
      testCaseId: true,
      page: true,
      subMenu: true,
      status: true,
      module: { select: { name: true } },
    },
  });
  const idMap = new Map(testCases.flatMap(row => [[row.id, row], [row.testCaseId, row]]));
  const items: Array<Record<string, unknown>> = [];

  for (const file of files) {
    const match = file.match(/^(.+?)(?:\.(current|previous))?\.jsonl$/);
    if (!match) continue;
    const owner = idMap.get(match[1]);
    if (!owner) continue;

    const filePath = path.join(logsDir, file);
    const [stat, lines] = await Promise.all([
      fs.stat(filePath),
      readLogFileLines(filePath, 120),
    ]);
    const parsedErrors = lines.map(parseDevLogError).filter(item => item.isError);
    if (!parsedErrors.length) continue;
    const uniqueNetworkErrors = new Map<string, typeof parsedErrors[number]>();
    const uniqueConsoleErrors = new Map<string, typeof parsedErrors[number]>();
    for (const item of parsedErrors) {
      if (item.type === 'network') uniqueNetworkErrors.set(item.key, item);
      else uniqueConsoleErrors.set(item.key, item);
    }
    const lastError = parsedErrors[parsedErrors.length - 1];

    items.push({
      file,
      kind: match[2] || 'legacy',
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
      testCaseId: owner.testCaseId,
      databaseId: owner.id,
      module: owner.module?.name || '-',
      page: owner.page,
      subMenu: owner.subMenu || '',
      status: owner.status,
      errorCount: parsedErrors.length,
      uniqueNetworkErrorCount: uniqueNetworkErrors.size,
      uniqueConsoleErrorCount: uniqueConsoleErrors.size,
      lastError: lastError.type === 'network'
        ? `${lastError.method || '-'} ${lastError.status || '-'} ${lastError.url}`
        : lastError.message,
    });
  }

  items.sort((a, b) => new Date(String(b.updatedAt)).getTime() - new Date(String(a.updatedAt)).getTime());
  const latestErrorByTestCase = new Map<string, Record<string, unknown>>();
  for (const item of items) {
    if (!latestErrorByTestCase.has(String(item.testCaseId))) {
      latestErrorByTestCase.set(String(item.testCaseId), item);
    }
  }
  const limited = Array.from(latestErrorByTestCase.values()).slice(0, MAX_ROWS);
  return {
    name: 'getLatestDevLogErrors',
    summary: limited.length
      ? `${limited.length} testcase memiliki devlog terbaru dengan indikasi error.`
      : 'Tidak ditemukan devlog terbaru dengan indikasi error.',
    data: limited,
    citations: limited.map(item => ({
      id: String(item.databaseId),
      type: 'testcase',
      label: String(item.testCaseId),
      testCaseId: String(item.testCaseId),
      description: `${item.module} | ${item.uniqueNetworkErrorCount || 0} network error | ${item.updatedAt}`,
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

function extractFigmaPages(content: string) {
  const lines = content.split(/\r?\n/);
  const pages: Record<string, string[]> = {};
  let currentPage = '';

  for (const line of lines) {
    const pageMatch = line.match(/^## Page:\s*(.+)$/);
    if (pageMatch) {
      currentPage = pageMatch[1].trim();
      pages[currentPage] = [];
      continue;
    }
    if (currentPage) pages[currentPage].push(line);
  }

  return pages;
}

function chooseFigmaPage(query: string, pageNames: string[]) {
  const normalizedQuery = normalizeForMatch(query);
  const direct = pageNames.find(page => normalizedQuery.includes(normalizeForMatch(page)));
  if (direct) return direct;

  const keywordMatch = pageNames.find(page => matchTokens(page).some(token => normalizedQuery.includes(token)));
  return keywordMatch || pageNames[0] || '';
}

function parseFigmaScreens(pageName: string, lines: string[]) {
  const screens: Array<{ name: string; text: string[] }> = [];
  let current: { name: string; text: string[] } | null = null;
  let inVisibleText = false;

  const pushCurrent = () => {
    if (!current) return;
    const combined = normalizeForMatch([current.name, ...current.text].join(' '));
    const isNoise = /^(fixed|frame \d+|components?|section \d+)$/i.test(current.name)
      || combined.length < 3
      || current.name === pageName;
    if (!isNoise) screens.push(current);
  };

  for (const line of lines) {
    const screenMatch = line.match(/^###\s*(.+)$/);
    if (screenMatch) {
      pushCurrent();
      current = { name: screenMatch[1].trim(), text: [] };
      inVisibleText = false;
      continue;
    }

    if (!current) continue;
    if (/^- Visible\/copy text:/.test(line)) {
      inVisibleText = true;
      continue;
    }
    if (/^- (Node|Type|Child nodes):/.test(line)) {
      inVisibleText = false;
      continue;
    }
    if (inVisibleText) {
      const textMatch = line.match(/^\s*-\s+(.+)$/);
      if (textMatch) current.text.push(textMatch[1].trim());
    }
  }
  pushCurrent();

  const seen = new Set<string>();
  return screens.filter((screen) => {
    const key = normalizeForMatch(screen.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 80);
}

function scoreScreenCoverage(screen: { name: string; text: string[] }, testCase: {
  page: string;
  subMenu: string | null;
  testAction: string;
  steps: string;
  expectedResult: string;
}) {
  const screenText = [screen.name, ...screen.text].join(' ');
  const screenTokens = matchTokens(screenText);
  const rowText = normalizeForMatch([
    testCase.page,
    testCase.subMenu,
    testCase.testAction,
    testCase.steps,
    testCase.expectedResult,
  ].join(' '));
  const rowTokens = new Set(matchTokens(rowText));
  const screenName = normalizeForMatch(screen.name);
  let score = 0;

  if (screenName && rowText.includes(screenName)) score += 8;
  for (const token of screenTokens) {
    if (rowTokens.has(token)) score += token.length >= 5 ? 2 : 1;
  }

  return score;
}

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

  if (selectedTestCaseId && questionNeedsSelectedContext(question)) {
    await pushTool('getTestCaseDetail');
    await pushTool('getDevLogSummary');
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

export function formatToolResultsForPrompt(tools: CopilotToolResult[]) {
  return tools.map(tool => [
    `## TOOL: ${tool.name}`,
    `Summary: ${tool.summary}`,
    `Data: ${compactToolData(tool)}`,
  ].join('\n')).join('\n\n');
}

function compactValue(value: unknown, max = 90) {
  return cleanText(value).replace(/\s+/g, ' ').replace(/\|/g, '/').slice(0, max);
}

function formatRows<T>(rows: T[], formatter: (row: T, index: number) => string, maxRows = 12) {
  if (!rows.length) return '-';
  const visible = rows.slice(0, maxRows).map(formatter);
  const remaining = rows.length - visible.length;
  return remaining > 0 ? [...visible, `...+${remaining} more`].join('\n') : visible.join('\n');
}

function compactProjectOverview(data: any) {
  const project = data?.project;
  const modules = Array.isArray(data?.modules) ? data.modules : [];
  const statusGroups = Array.isArray(data?.statusGroups) ? data.statusGroups : [];
  const bugGroups = Array.isArray(data?.bugGroups) ? data.bugGroups : [];
  const priorityGroups = Array.isArray(data?.priorityGroups) ? data.priorityGroups : [];

  return [
    `project|${compactValue(project?.name)}|tc:${project?.counts?.testCases ?? '-'}|modules:${project?.counts?.modules ?? '-'}|bugs:${project?.counts?.bugFixItems ?? '-'}`,
    modules.length ? `modules:\n${formatRows(modules, (row: any) => `${compactValue(row.name, 40)}|tc:${row._count?.testCases ?? 0}|bugs:${row._count?.bugFixItems ?? 0}`, 16)}` : '',
    statusGroups.length ? `testcase_status:${statusGroups.map((row: any) => `${compactValue(row.status, 28)}=${row._count?.id ?? 0}`).join(',')}` : '',
    priorityGroups.length ? `priority:${priorityGroups.map((row: any) => `${compactValue(row.priority, 16)}=${row._count?.id ?? 0}`).join(',')}` : '',
    bugGroups.length ? `bug_status:${bugGroups.map((row: any) => `${compactValue(row.status, 28)}=${row._count?.id ?? 0}`).join(',')}` : '',
  ].filter(Boolean).join('\n');
}

function compactToolData(tool: CopilotToolResult) {
  const data: any = tool.data;

  if (tool.name === 'getProjectOverview') return compactProjectOverview(data);

  if (tool.name === 'searchTestCases' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${row.testCaseId}|${compactValue(row.module?.name || row.page, 28)}|${compactValue(row.subMenu, 24)}|${row.testType}|${row.status}|${row.priority}|${compactValue(row.testAction, 120)}`
    ));
  }

  if (tool.name === 'getTestCaseDetail' && data) {
    return [
      `id|${data.testCaseId}|${compactValue(data.module?.name || data.page, 32)}|${compactValue(data.subMenu, 32)}|${data.testType}|${data.status}|${data.priority}|progress:${data.progress ?? '-'}`,
      `action|${compactValue(data.testAction, 180)}`,
      `steps|${compactValue(data.steps, 220)}`,
      `expected|${compactValue(data.expectedResult, 180)}`,
      data.actualResult ? `actual|${compactValue(data.actualResult, 140)}` : '',
      data.stepLogs ? `stepLogs|${compactValue(data.stepLogs, 220)}` : '',
    ].filter(Boolean).join('\n');
  }

  if (tool.name === 'getBugFixes' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${row.testCaseId}|src:${row.sourceTestCaseId || '-'}|${compactValue(row.module?.name || row.page, 28)}|${row.status}|${row.priority}|${compactValue(row.testAction, 120)}`
    ));
  }

  if (tool.name === 'getStatusPriorityCases' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${row.testCaseId}|${compactValue(row.module?.name || row.page, 28)}|${compactValue(row.subMenu, 24)}|${row.testType}|${row.status}|${row.priority}|${compactValue(row.testAction, 120)}`
    ));
  }

  if (tool.name === 'getGenericExpectedResultCases' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${row.testCaseId}|${compactValue(row.module?.name || row.page, 28)}|${compactValue(row.subMenu, 24)}|${row.status}|${row.priority}|score:${row.score}|expected:${compactValue(row.expectedResult, 140)}`
    ));
  }

  if (tool.name === 'getWeakStepCases' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${row.testCaseId}|${compactValue(row.module?.name || row.page, 28)}|${compactValue(row.subMenu, 24)}|${row.status}|${row.priority}|score:${row.score}|lines:${row.lineCount}|steps:${compactValue(row.steps, 150)}`
    ));
  }

  if (tool.name === 'getModuleRisk' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${compactValue(row.moduleName, 32)}|risk:${row.riskScore}|tc:${row.total}|failed:${row.failed}|blocked:${row.blocked}|retest:${row.readyToRetest}|progress:${row.inProgress}|high:${row.highPriority}`
    ));
  }

  if (tool.name === 'getCoverageGap' && data) {
    const gaps = Array.isArray(data.topGaps) ? data.topGaps : [];
    return [
      `target|${data.target?.name || data.target?.type || '-'}|total:${data.totals?.total ?? 0}|positive:${data.totals?.positive ?? 0}|negative:${data.totals?.negative ?? 0}|negativeRatio:${data.totals?.negativeRatio ?? 0}`,
      gaps.length ? `topGaps:\n${formatRows(gaps, (row: any) => (
        `${compactValue(row.moduleName, 24)}|${compactValue(row.page, 28)}>${compactValue(row.subMenu, 24)}|tc:${row.total}|neg:${row.negative}|pos:${row.positive}|score:${row.gapScore}|samples:${(row.samples || []).map((sample: any) => sample.testCaseId).join(',')}`
      ), 10)}` : '',
    ].filter(Boolean).join('\n');
  }

  if (tool.name === 'getFigmaScreenCoverage' && data) {
    const screens = Array.isArray(data.screens) ? data.screens : [];
    return [
      `figma|${compactValue(data.figmaKnowledge?.title, 50)}|page:${compactValue(data.pageName, 32)}|module:${compactValue(data.targetModule?.name || '-', 24)}|screens:${data.totals?.figmaScreens ?? 0}|covered:${data.totals?.covered ?? 0}|missing:${data.totals?.missing ?? 0}`,
      formatRows(screens, (row: any) => (
        `${compactValue(row.screen, 36)}|${row.covered ? 'covered' : 'missing'}|matches:${(row.matches || []).map((match: any) => `${match.testCaseId}(score:${match.score})`).join(',') || '-'}|figmaText:${compactValue((row.figmaText || []).join(' / '), 90)}`
      ), 18),
    ].join('\n');
  }

  if (tool.name === 'getDevLogSummary' && data) {
    const recentLogs = Array.isArray(data.recentLogs) ? data.recentLogs : [];
    return [
      `devlog|${data.testCaseId}|errors:${data.errorCount ?? 0}|rows:${recentLogs.length}`,
      formatRows(recentLogs, (row: any) => (
        row.network
          ? `${row.relativeMs ?? '-'}|net|${row.network.method || '-'}|${row.network.status || '-'}|${compactValue(row.network.url, 90)}`
          : `${row.relativeMs ?? '-'}|${row.level || row.source || 'log'}|${compactValue(row.log || row.raw, 120)}`
      ), 16),
    ].join('\n');
  }

  if (tool.name === 'getAutomationHistory' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${row.testCaseId}|${row.kind}|${row.updatedAt}|${compactValue(row.module, 24)}|${row.status}|${compactValue(row.file, 80)}`
    ));
  }

  if (tool.name === 'getLatestDevLogErrors' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${row.testCaseId}|${compactValue(row.module, 24)}|${compactValue(row.subMenu || row.page, 28)}|${row.status}|networkErrors:${row.uniqueNetworkErrorCount || 0}|consoleErrors:${row.uniqueConsoleErrorCount || 0}|rawErrorLines:${row.errorCount}|${row.kind}|${row.updatedAt}|last:${compactValue(row.lastError, 120)}`
    ));
  }

  if (tool.name === 'searchProjectKnowledge' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${row.type}|${compactValue(row.title, 60)}|${compactValue(row.content, 180)}`
    ), 8);
  }

  return limitText(JSON.stringify(data), 900);
}
