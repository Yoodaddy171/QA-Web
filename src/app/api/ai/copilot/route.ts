import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateCopilotJson } from '@/lib/ai-provider';
import {
  CopilotActionDraft,
  CopilotCitation,
  CopilotRequiredTool,
  TestCaseDraft,
  createDeterministicDraft,
  formatToolResultsForPrompt,
  runCopilotTools,
} from '@/lib/ai-copilot-tools';
import { limitText } from '@/lib/ai-context';

export const maxDuration = 60;

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type CopilotIntent =
  | 'PROJECT_SUMMARY'
  | 'MODULE_RISK'
  | 'COVERAGE_GAP'
  | 'FIGMA_COVERAGE'
  | 'WEAK_STEPS'
  | 'GENERIC_EXPECTED'
  | 'BUGFIX_ANALYSIS'
  | 'TESTCASE_SEARCH'
  | 'CREATE_DRAFT'
  | 'REFINE_DRAFT'
  | 'UNKNOWN';

type CopilotActionMode = 'ASK' | 'ANALYZE' | 'DRAFT' | 'MUTATE';

type CopilotScope = {
  moduleId?: string;
  moduleName?: string;
  selectedTestCaseId?: string;
  followUpTarget?: string;
};

type IntentDecision = {
  intent: CopilotIntent;
  confidence: number;
  scope: CopilotScope;
  actionMode: CopilotActionMode;
  requiredTools: CopilotRequiredTool[];
  needsConfirmation: boolean;
};

const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CHARS = 1000;
const MAX_PROMPT_CHARS = 16000;
const DRAFT_INTENT_PATTERN = /\b(buat|buatkan|dibuatkan|generate|draft|tambahkan|create)\b/i;

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function sanitizePriority(value: unknown) {
  const text = cleanText(value);
  return ['Critical', 'High', 'Medium', 'Low'].includes(text) ? text : 'Medium';
}

function sanitizeTestType(value: unknown) {
  return cleanText(value) === 'Negative' ? 'Negative' : 'Positive';
}

function buildToolQuestion(question: string, history: ChatMessage[]) {
  const lower = question.toLowerCase();
  const previousUser = [...history].reverse().find(message => message.role === 'user')?.content || '';
  const previousLower = previousUser.toLowerCase();

  if (/^(bagaimana|gimana|kalau|kalo)\s+(dengan\s+)?(di\s+)?[a-z0-9\s()-]+[?]?\s*$/i.test(question)
    && /belum\s+(?:di)?buat|missing|gap|negative case|coverage|cover/i.test(previousLower)) {
    return `${previousUser}\n\nFollow-up target: ${question}`;
  }

  if (/\bbelum\s+(?:di)?buat\b/.test(lower) && !/coverage|gap|missing/.test(lower)) {
    return `${question}\n\nIntent: cari gap coverage/testcase yang belum dibuat, jangan membuat draft kecuali diminta eksplisit.`;
  }

  return question;
}

function normalizeForIntent(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFollowUpTarget(question: string) {
  const match = cleanText(question).match(/(?:follow-up target|scope override)\s*:\s*([^\r\n]+)/i);
  return cleanText(match?.[1]);
}

function isQuestionLike(question: string) {
  const lower = question.toLowerCase();
  return /\b(apakah|apa|mana|berapa|bagaimana|gimana|kenapa|mengapa|cek|cari|tampilkan|list|daftar)\b/.test(lower)
    || lower.trim().endsWith('?');
}

function inferIntentFromQuestion(question: string, history: ChatMessage[]) {
  const lower = question.toLowerCase();
  const previousUser = [...history].reverse().find(message => message.role === 'user')?.content || '';
  const previousLower = previousUser.toLowerCase();
  const draftRequested = DRAFT_INTENT_PATTERN.test(question);
  const questionLike = isQuestionLike(question);
  const saveRequested = /\b(simpan|save|apply|terapkan|commit|masukkan ke database)\b/.test(lower);

  if (saveRequested) return { intent: 'UNKNOWN' as CopilotIntent, actionMode: 'MUTATE' as CopilotActionMode, confidence: 0.85 };
  if (/\b(refine|perbaiki|rapihkan|revisi|ubah)\b/.test(lower) && /testcase|draft|steps?|expected|case/.test(lower)) {
    return { intent: 'REFINE_DRAFT' as CopilotIntent, actionMode: 'DRAFT' as CopilotActionMode, confidence: 0.8 };
  }
  if (draftRequested && !(questionLike && /\bbelum\s+(?:di)?buat\b/.test(lower))) {
    return { intent: 'CREATE_DRAFT' as CopilotIntent, actionMode: 'DRAFT' as CopilotActionMode, confidence: 0.9 };
  }
  if (/figma|screen|design|desain/.test(lower) && /coverage|cover|mencakup|cukup|testcase|case|belum/.test(lower)) {
    return { intent: 'FIGMA_COVERAGE' as CopilotIntent, actionMode: 'ANALYZE' as CopilotActionMode, confidence: 0.86 };
  }
  if (/expected result|expected|hasil.*generic|terlalu generic|masih generic|kurang spesifik/.test(lower)) {
    return { intent: 'GENERIC_EXPECTED' as CopilotIntent, actionMode: 'ANALYZE' as CopilotActionMode, confidence: 0.86 };
  }
  if (/steps?|langkah|kurang jelas|tidak jelas|manual qa|manual tester|eksekusi manual/.test(lower)) {
    return { intent: 'WEAK_STEPS' as CopilotIntent, actionMode: 'ANALYZE' as CopilotActionMode, confidence: 0.86 };
  }
  if (/coverage|cover|gap|cukup|negative case|positive case|skenario|missing|belum\s+(?:di)?buat|testcase.*belum/.test(lower)
    || (/^(bagaimana|gimana|kalau|kalo)\b/.test(lower) && /gap|coverage|belum\s+(?:di)?buat|negative case/.test(previousLower))) {
    return { intent: 'COVERAGE_GAP' as CopilotIntent, actionMode: 'ANALYZE' as CopilotActionMode, confidence: 0.88 };
  }
  if (/risk|risiko|prioritas|health|module paling|modul paling/.test(lower)) {
    return { intent: 'MODULE_RISK' as CopilotIntent, actionMode: 'ANALYZE' as CopilotActionMode, confidence: 0.85 };
  }
  if (/bug|retest|fix|failed|gagal|ready|verified|defect/.test(lower)) {
    return { intent: 'BUGFIX_ANALYSIS' as CopilotIntent, actionMode: 'ANALYZE' as CopilotActionMode, confidence: 0.78 };
  }
  if (/summary|ringkas|overview|project|status.*project|total testcase|berapa testcase/.test(lower)) {
    return { intent: 'PROJECT_SUMMARY' as CopilotIntent, actionMode: 'ASK' as CopilotActionMode, confidence: 0.78 };
  }
  if (/testcase|case|tc|status|priority|prioritas|not done|done|blocked|in progress/.test(lower)) {
    return { intent: 'TESTCASE_SEARCH' as CopilotIntent, actionMode: 'ASK' as CopilotActionMode, confidence: 0.72 };
  }
  return { intent: 'UNKNOWN' as CopilotIntent, actionMode: 'ASK' as CopilotActionMode, confidence: 0.55 };
}

function requiredToolsForIntent(intent: CopilotIntent): CopilotRequiredTool[] {
  switch (intent) {
    case 'PROJECT_SUMMARY':
      return ['getModuleRisk'];
    case 'MODULE_RISK':
      return ['getModuleRisk'];
    case 'COVERAGE_GAP':
    case 'CREATE_DRAFT':
      return ['getCoverageGap'];
    case 'FIGMA_COVERAGE':
      return ['getFigmaScreenCoverage'];
    case 'WEAK_STEPS':
      return ['getWeakStepCases'];
    case 'GENERIC_EXPECTED':
      return ['getGenericExpectedResultCases'];
    case 'BUGFIX_ANALYSIS':
      return ['getBugFixes', 'searchTestCases'];
    case 'REFINE_DRAFT':
      return ['searchTestCases', 'getCoverageGap'];
    case 'TESTCASE_SEARCH':
    case 'UNKNOWN':
    default:
      return ['searchTestCases'];
  }
}

async function resolveScope(projectId: string, toolQuestion: string, selectedTestCaseId?: string): Promise<CopilotScope> {
  const followUpTarget = extractFollowUpTarget(toolQuestion);
  const normalizedQuestion = normalizeForIntent(followUpTarget || toolQuestion);
  const modules = await db.module.findMany({
    where: { projectId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
  const moduleRecord = modules.find((module) => {
    const normalizedName = normalizeForIntent(module.name);
    return normalizedQuestion.includes(normalizedName) || normalizedName.includes(normalizedQuestion);
  });

  return {
    moduleId: moduleRecord?.id,
    moduleName: moduleRecord?.name,
    selectedTestCaseId,
    followUpTarget,
  };
}

async function resolveIntent(input: {
  projectId: string;
  question: string;
  toolQuestion: string;
  history: ChatMessage[];
  selectedTestCaseId?: string;
}): Promise<IntentDecision> {
  const base = inferIntentFromQuestion(input.question, input.history);
  const scope = await resolveScope(input.projectId, input.toolQuestion, input.selectedTestCaseId);
  const requiredTools = requiredToolsForIntent(base.intent);
  return {
    intent: base.intent,
    confidence: base.confidence,
    scope,
    actionMode: base.actionMode,
    requiredTools,
    needsConfirmation: base.actionMode === 'MUTATE',
  };
}

function isGenericDraft(draft: TestCaseDraft) {
  const combined = [
    draft.testAction,
    draft.steps,
    draft.expectedResult,
  ].join(' ').toLowerCase();

  return combined.includes('berdasarkan instruksi ai copilot')
    || combined.includes('siapkan data uji sesuai skenario yang diminta')
    || combined.includes('jalankan aksi utama pada fitur tersebut')
    || combined.includes('sistem menolak input atau kondisi yang tidak valid');
}

async function sanitizeDrafts(projectId: string, value: unknown): Promise<TestCaseDraft[]> {
  if (!Array.isArray(value)) return [];
  const modules = await db.module.findMany({
    where: { projectId },
    select: { id: true },
  });
  const moduleIds = new Set(modules.map(module => module.id));

  return value.slice(0, 6)
    .map((draft: any): TestCaseDraft => ({
      testCaseId: cleanText(draft.testCaseId),
      page: cleanText(draft.page),
      subMenu: cleanText(draft.subMenu),
      weight: cleanText(draft.weight),
      testType: sanitizeTestType(draft.testType),
      testAction: cleanText(draft.testAction),
      steps: cleanText(draft.steps),
      expectedResult: cleanText(draft.expectedResult),
      priority: sanitizePriority(draft.priority),
      moduleId: draft.moduleId && moduleIds.has(String(draft.moduleId)) ? String(draft.moduleId) : null,
    }))
    .filter(draft => draft.testCaseId && draft.page && draft.testAction && draft.steps && draft.expectedResult && !isGenericDraft(draft));
}

function sanitizeActionDrafts(value: unknown) {
  if (!Array.isArray(value)) return [];
  const parsed = value.slice(0, 8)
    .map((item: any, index): CopilotActionDraft | null => {
      const type = cleanText(item.type) as CopilotActionDraft['type'];
      if (!['CREATE_TESTCASE_DRAFT', 'REFINE_TESTCASE_DRAFT', 'BULK_STATUS_DRAFT', 'BUGFIX_RETEST_SUGGESTION'].includes(type)) return null;
      return {
        id: cleanText(item.id) || `ai-action-${Date.now()}-${index}`,
        type,
        title: cleanText(item.title) || type,
        description: cleanText(item.description) || 'Draft aksi dari QA Copilot. Review sebelum apply.',
        payload: item.payload && typeof item.payload === 'object' ? item.payload : undefined,
      };
    })
    .filter((item): item is CopilotActionDraft => Boolean(item));

  return parsed.slice(0, 8);
}

function dedupeActionDrafts(actions: CopilotActionDraft[]) {
  const seen = new Set<string>();
  return actions.filter((action) => {
    const key = action.testCaseDraft?.testCaseId
      ? `${action.type}:${action.testCaseDraft.testCaseId}`
      : `${action.type}:${action.title}:${action.description}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function fallbackAnswer(input: {
  question: string;
  citations: CopilotCitation[];
  usedTools: string[];
  providerError?: string;
}) {
  const hasMatches = input.citations.some(citation => citation.type === 'testcase' || citation.type === 'bugfix');
  const lines = [
    input.providerError
      ? `AI provider belum bisa menjawab penuh: ${input.providerError}`
      : 'Saya sudah membaca database lokal project ini.',
    '',
    hasMatches
      ? 'Sumber database yang relevan sudah ditemukan. Lihat citation chips di bawah untuk membuka detailnya.'
      : 'Saya belum menemukan testcase atau bugfix yang langsung cocok dari database lokal.',
    '',
    `Tools yang dipakai: ${input.usedTools.join(', ') || '-'}`,
  ];

  return lines.join('\n');
}

function buildDeterministicAnswer(tools: Array<{ name: string; data: unknown; summary: string }>, decision?: IntentDecision) {
  if (decision?.needsConfirmation) {
    return 'Saya tidak akan menyimpan atau mengubah data langsung dari chat ini. Untuk action seperti save/apply, review draft atau perubahan yang dimaksud dulu, lalu gunakan tombol aksi yang tersedia agar perubahan tetap terkontrol.';
  }

  const projectOverview = tools.find(tool => tool.name === 'getProjectOverview');
  if (decision?.intent === 'PROJECT_SUMMARY' && projectOverview?.data) {
    const data = projectOverview.data as any;
    const project = data.project;
    const statusGroups = Array.isArray(data.statusGroups) ? data.statusGroups : [];
    const bugGroups = Array.isArray(data.bugGroups) ? data.bugGroups : [];
    const modules = Array.isArray(data.modules) ? data.modules : [];
    const statusText = statusGroups.length
      ? statusGroups.map((row: any) => `${row.status}: ${row._count?.id || 0}`).join(', ')
      : 'belum ada breakdown status';
    const bugText = bugGroups.length
      ? bugGroups.map((row: any) => `${row.status}: ${row._count?.id || 0}`).join(', ')
      : 'belum ada breakdown bug';
    const biggestModules = modules
      .slice()
      .sort((a: any, b: any) => (b._count?.testCases || 0) - (a._count?.testCases || 0))
      .slice(0, 4)
      .map((module: any) => `${module.name} (${module._count?.testCases || 0} TC)`)
      .join(', ');

    return [
      `Project **${project?.name || '-'}** saat ini punya **${project?.counts?.testCases || 0} testcase**, **${project?.counts?.modules || 0} module**, dan **${project?.counts?.bugFixItems || 0} bugfix**.`,
      '',
      `Status testcase: ${statusText}.`,
      `Status bugfix: ${bugText}.`,
      biggestModules ? `Module dengan coverage terbesar: ${biggestModules}.` : '',
      '',
      'Untuk langkah berikutnya, paling berguna mengecek gap negative case, testcase dengan steps lemah, atau module paling berisiko.',
    ].filter(Boolean).join('\n');
  }

  const figmaCoverage = tools.find(tool => tool.name === 'getFigmaScreenCoverage');
  if (figmaCoverage) {
    const data = figmaCoverage.data as any;
    if (!data?.totals) {
      return figmaCoverage.summary;
    }

    const screens = Array.isArray(data.screens) ? data.screens : [];
    const topMissing = screens.filter((screen: any) => !screen.covered).slice(0, 12);
    const topCovered = screens.filter((screen: any) => screen.covered).slice(0, 10);
    const coveragePercent = data.totals.figmaScreens > 0
      ? Math.round((data.totals.covered / data.totals.figmaScreens) * 100)
      : 0;

    const lines = [
      `Saya bandingkan screen di Figma knowledge **${data.pageName || '-'}** dengan testcase di database.`,
      '',
      `Coverage kandidat: **${data.totals.covered}/${data.totals.figmaScreens} screen (${coveragePercent}%)**.`,
      '',
    ];

    if (topCovered.length > 0) {
      lines.push('| Screen Figma | Kandidat Testcase | Alasan |');
      lines.push('| --- | --- | --- |');
      lines.push(...topCovered.map((screen: any) => {
        const matches = (screen.matches || [])
          .slice(0, 3)
          .map((match: any) => `${match.testCaseId} (${match.status}, score ${match.score})`)
          .join(', ');
        const reason = screen.figmaText?.length
          ? `Teks Figma: ${screen.figmaText.slice(0, 2).join(' / ')}`
          : 'Nama screen mirip dengan page/submenu/test action.';
        return `| ${screen.screen} | ${matches || '-'} | ${reason} |`;
      }));
      lines.push('');
    }

    if (topMissing.length > 0) {
      lines.push('Screen yang belum punya kandidat testcase kuat:');
      lines.push(...topMissing.map((screen: any) => `- ${screen.screen}${screen.figmaText?.length ? ` (${screen.figmaText.slice(0, 2).join(' / ')})` : ''}`));
      lines.push('');
      lines.push('Catatan: ini matching berbasis nama screen dan teks Figma terhadap isi testcase. Kalau testcase memakai istilah berbeda, bisa saja sebenarnya sudah ter-cover tapi tidak terbaca kuat.');
    } else {
      lines.push('Semua screen yang terbaca dari Figma punya kandidat testcase di database.');
    }

    return lines.join('\n');
  }

  const coverageGap = tools.find(tool => tool.name === 'getCoverageGap');
  if (coverageGap) {
    const data = coverageGap.data as any;
    const topGaps = Array.isArray(data?.topGaps) ? data.topGaps : [];
    const missingNegative = topGaps
      .filter((gap: any) => Number(gap.total || 0) > 0 && Number(gap.negative || 0) === 0)
      .slice(0, 8);

    if (missingNegative.length > 0) {
      const lines = [
        'Area yang **belum punya negative case kuat** berdasarkan testcase database:',
        '',
        '| Area | Existing Positive/Other Cases | Rekomendasi Negative Case |',
        '| --- | --- | --- |',
        ...missingNegative.map((gap: any) => {
          const location = [gap.moduleName, gap.page, gap.subMenu].filter(Boolean).join(' > ');
          const samples = Array.isArray(gap.samples) && gap.samples.length
            ? gap.samples.map((sample: any) => sample.testCaseId).join(', ')
            : '-';
          const recommendation = `Tambahkan negative case untuk ${gap.subMenu || gap.page || gap.moduleName}, misalnya data kosong, input invalid, stok tidak cukup, atau aksi saat state belum valid.`;
          return `| ${location || '-'} | ${samples} | ${recommendation} |`;
        }),
        '',
        'Catatan: ID di kolom existing adalah testcase yang sudah ada sebagai referensi coverage, bukan ID testcase baru.',
      ];
      return lines.join('\n');
    }

    if (topGaps.length > 0) {
      return [
        'Saya belum menemukan area yang benar-benar kosong dari negative case pada scope ini.',
        '',
        'Namun beberapa area masih bisa diperkuat jika coverage negative-nya kurang dibanding positive case:',
        ...topGaps.slice(0, 6).map((gap: any) => {
          const location = [gap.moduleName, gap.page, gap.subMenu].filter(Boolean).join(' > ');
          return `- ${location || '-'}: ${gap.negative || 0} negative dari ${gap.total || 0} testcase.`;
        }),
      ].join('\n');
    }

    return 'Tidak ditemukan data testcase yang cukup untuk menganalisis missing negative case pada scope ini.';
  }

  const moduleRisk = tools.find(tool => tool.name === 'getModuleRisk');
  if (moduleRisk) {
    const rows = Array.isArray(moduleRisk.data) ? moduleRisk.data as Array<Record<string, any>> : [];
    if (rows.length > 0) {
      const top = rows[0];
      const lines = [
        `Module paling berisiko saat ini adalah **${top.moduleName}** dengan risk score **${top.riskScore}**.`,
        '',
        'Score ini dihitung dari kombinasi testcase failed, blocked, ready to retest, in progress, dan high/critical priority. Jadi bukan sekadar jumlah testcase, tapi bobot masalah yang masih aktif.',
        '',
        '| Module | Risk | Total TC | Failed | Blocked | Ready Retest | In Progress | High/Critical |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
        ...rows.slice(0, 6).map(row => (
          `| ${row.moduleName || '-'} | ${row.riskScore ?? 0} | ${row.total ?? 0} | ${row.failed ?? 0} | ${row.blocked ?? 0} | ${row.readyToRetest ?? 0} | ${row.inProgress ?? 0} | ${row.highPriority ?? 0} |`
        )),
        '',
        top.failed || top.blocked || top.readyToRetest
          ? `Prioritas pertama: buka module **${top.moduleName}**, selesaikan failed/blocked lebih dulu, lalu lanjutkan item ready to retest.`
          : `Prioritas pertama: pantau progress di **${top.moduleName}**, karena score utamanya datang dari item in progress atau prioritas tinggi.`,
      ];
      return lines.join('\n');
    }
  }

  const genericExpected = tools.find(tool => tool.name === 'getGenericExpectedResultCases');
  if (genericExpected) {
    const rows = Array.isArray(genericExpected.data) ? genericExpected.data as Array<Record<string, any>> : [];
    if (rows.length === 0) return 'Saya tidak menemukan expected result yang terindikasi terlalu generic di scope ini.';

    const lines = [
      `Saya menemukan **${rows.length} testcase** yang expected result-nya terlihat terlalu generic atau kurang measurable.`,
      '',
      'Yang perlu diperbaiki biasanya expected result yang hanya bilang “berjalan dengan baik”, “data sesuai”, atau terlalu pendek tanpa menyebut output yang harus diverifikasi.',
      '',
      '| TC | Area | Expected Saat Ini | Kenapa Lemah |',
      '| --- | --- | --- | --- |',
      ...rows.slice(0, 8).map(row => {
        const area = [row.module?.name, row.page, row.subMenu].filter(Boolean).join(' > ') || '-';
        const reason = Number(row.score || 0) >= 5
          ? 'Terlalu umum atau sangat pendek.'
          : 'Belum cukup menyebut output/state yang harus diverifikasi.';
        return `| ${row.testCaseId} | ${area} | ${String(row.expectedResult || '-').replace(/\|/g, '/')} | ${reason} |`;
      }),
      '',
      'Saran: refine expected result dengan menyebut kondisi layar, data yang berubah/tidak berubah, pesan validasi, status transaksi/order, dan output yang bisa dicek QA.',
    ];
    return lines.join('\n');
  }

  const weakSteps = tools.find(tool => tool.name === 'getWeakStepCases');
  if (weakSteps) {
    const rows = Array.isArray(weakSteps.data) ? weakSteps.data as Array<Record<string, any>> : [];
    if (rows.length === 0) return 'Saya tidak menemukan testcase dengan steps yang terlihat lemah di scope ini.';

    const lines = [
      `Saya menemukan **${rows.length} testcase** yang steps-nya kurang jelas untuk manual QA.`,
      '',
      'Indikasinya antara lain steps terlalu pendek, tidak numbered, atau memakai kalimat generic seperti “jalankan aksi utama” tanpa data uji dan tombol yang spesifik.',
      '',
      '| TC | Area | Masalah Steps | Potongan Steps Saat Ini |',
      '| --- | --- | --- | --- |',
      ...rows.slice(0, 8).map(row => {
        const area = [row.module?.name, row.page, row.subMenu].filter(Boolean).join(' > ') || '-';
        const issues = [
          Number(row.lineCount || 0) < 3 ? 'terlalu sedikit langkah' : '',
          Number(row.numberedSteps || 0) === 0 ? 'tidak numbered' : '',
          Number(row.score || 0) >= 8 ? 'terlalu generic' : '',
        ].filter(Boolean).join(', ') || 'perlu dibuat lebih spesifik';
        return `| ${row.testCaseId} | ${area} | ${issues} | ${String(row.steps || '-').replace(/\|/g, '/')} |`;
      }),
      '',
      'Saran: setiap step sebaiknya menyebut screen yang dibuka, data uji yang dipakai, action yang diklik, dan output yang harus dicek.',
    ];
    return lines.join('\n');
  }

  const latestErrors = tools.find(tool => tool.name === 'getLatestDevLogErrors');
  if (latestErrors) {
    const rows = Array.isArray(latestErrors.data) ? latestErrors.data as Array<Record<string, any>> : [];
    if (!rows.length) return 'Tidak ditemukan testcase dengan devlog terbaru yang memiliki indikasi error.';
    const lines = rows.slice(0, 8).map(row => {
      const location = [row.module, row.page, row.subMenu].filter(Boolean).join(' > ');
      const networkErrors = Number(row.uniqueNetworkErrorCount || 0);
      const consoleErrors = Number(row.uniqueConsoleErrorCount || 0);
      const detail = networkErrors > 0
        ? `${networkErrors} unique network error${consoleErrors ? `, ${consoleErrors} console/error log` : ''}`
        : `${consoleErrors || row.errorCount || 0} console/error log`;
      return `- **${row.testCaseId}** (${location || '-'}) - ${detail}, ${row.kind || 'log'}, update ${row.updatedAt || '-'}`;
    });
    return ['Testcase dengan devlog/error terbaru:', ...lines].join('\n');
  }

  return '';
}

function isLowQualityAnswer(answer: string) {
  const text = cleanText(answer);
  if (!text) return true;
  const lower = text.toLowerCase();
  if (text.length < 90) return true;
  if (/^ditemukan\s+\d+\s+testcase/i.test(text) && !text.includes('|')) return true;
  return [
    'tidak ada data',
    'berdasarkan data yang ada',
    'saya dapat membantu',
    'review dulu sebelum disimpan',
  ].some(phrase => lower === phrase || (lower.includes(phrase) && text.length < 160));
}

function buildSystemPrompt(decision: IntentDecision) {
  return `You are QA Copilot for a local QA management app.
Answer in Indonesian, conversational but precise.
Use ONLY the TOOL RESULTS as factual database context. Never invent testcase IDs, bugfix IDs, modules, or counts.
If a fact is not in TOOL RESULTS, say it is not found.
When getTestCaseDetail is present, treat it as the primary context and cite its concrete action, steps, expected result, and actual result when relevant.
Clearly distinguish database facts from your inference or recommendation.
If the requested testcase detail is missing or insufficient, ask one focused clarification instead of guessing.
You may suggest draft actions, but must never claim data has been saved.
Return ONLY valid JSON object.

Resolved intent from app code:
- intent: ${decision.intent}
- actionMode: ${decision.actionMode}
- needsConfirmation: ${decision.needsConfirmation}
- scope module: ${decision.scope.moduleName || '-'}

Schema:
{
  "answer": "markdown string in Indonesian",
  "drafts": [
    {
      "testCaseId": "string",
      "page": "string",
      "subMenu": "string",
      "weight": "string",
      "testType": "Positive or Negative",
      "testAction": "string",
      "steps": "string",
      "expectedResult": "string",
      "priority": "Critical or High or Medium or Low",
      "moduleId": "string or null"
    }
  ],
  "actionDrafts": [
    {
      "id": "string",
      "type": "CREATE_TESTCASE_DRAFT or REFINE_TESTCASE_DRAFT or BULK_STATUS_DRAFT or BUGFIX_RETEST_SUGGESTION",
      "title": "string",
      "description": "string",
      "payload": {}
    }
  ]
}

Use drafts only when the user explicitly asks to create/generate/draft/add/refine. Otherwise drafts must be [].
For coverage, risk, summary, analysis, or "apakah" questions, drafts and actionDrafts must be [].
If actionMode is ASK or ANALYZE, drafts and actionDrafts must be [].
When creating missing negative cases, each draft must be specific to a concrete page/submenu/flow from TOOL RESULTS.
Do not output generic draft phrases like "berdasarkan instruksi AI Copilot", "siapkan data uji sesuai skenario", or "jalankan aksi utama".
For draft steps, name the concrete invalid condition being tested.
Keep answer concise, and include the strongest reasoning from database evidence.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const projectId = cleanText(body.projectId);
    const question = cleanText(body.question);
    const selectedTestCaseId = body.selectedTestCaseId ? cleanText(body.selectedTestCaseId) : undefined;
    const history: ChatMessage[] = Array.isArray(body.messages)
      ? (body.messages as ChatMessage[])
        .filter(message => ['user', 'assistant'].includes(message.role) && cleanText(message.content))
        .slice(-MAX_HISTORY_MESSAGES)
        .map(message => ({ role: message.role, content: limitText(cleanText(message.content), MAX_HISTORY_CHARS) }))
      : [];

    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    if (!question) return NextResponse.json({ error: 'Question is required' }, { status: 400 });

    const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const toolQuestion = buildToolQuestion(question, history);
    const intentDecision = await resolveIntent({ projectId, question, toolQuestion, history, selectedTestCaseId });
    const shouldReturnDrafts = intentDecision.actionMode === 'DRAFT';
    const toolRun = await runCopilotTools({
      projectId,
      question: toolQuestion,
      selectedTestCaseId,
      requiredTools: intentDecision.requiredTools,
      allowDrafts: shouldReturnDrafts,
    });
    const usedTools = toolRun.tools.map(tool => tool.name);
    const toolContext = formatToolResultsForPrompt(toolRun.tools);
    const historyText = history.map(message => `${message.role.toUpperCase()}: ${message.content}`).join('\n');
    const contextualDraftQuestion = [
      historyText ? `RECENT CONVERSATION:\n${historyText}` : '',
      `USER QUESTION:\n${toolQuestion}`,
    ].filter(Boolean).join('\n\n');

    const userPrompt = limitText([
      historyText ? `RECENT CONVERSATION:\n${historyText}` : '',
      `USER QUESTION:\n${question}`,
      '',
      `RESOLVED INTENT:\n${JSON.stringify(intentDecision, null, 2)}`,
      '',
      `TOOL RESULTS:\n${toolContext}`,
      '',
      `LOCAL DRAFT ACTIONS ALREADY PREPARED:\n${JSON.stringify(toolRun.actionDrafts, null, 2)}`,
    ].filter(Boolean).join('\n\n'), MAX_PROMPT_CHARS);

    let providerMeta: { provider?: string; model?: string; error?: string } = {};
    const deterministicAnswer = buildDeterministicAnswer(toolRun.tools, intentDecision);
    let answer = '';
    let drafts: TestCaseDraft[] = [];
    let actionDrafts: CopilotActionDraft[] = [];
    let localTestCaseDrafts = shouldReturnDrafts ? toolRun.actionDrafts.filter(action => action.testCaseDraft) : [];
    if (shouldReturnDrafts) {
      const contextualDrafts = (await createDeterministicDraft(projectId, contextualDraftQuestion))
        .filter(action => action.testCaseDraft);
      if (contextualDrafts.length > localTestCaseDrafts.length) {
        localTestCaseDrafts = contextualDrafts;
      }
    }

    if (shouldReturnDrafts && localTestCaseDrafts.length > 0) {
      drafts = [];
      actionDrafts = localTestCaseDrafts;
      answer = `Saya siapkan ${localTestCaseDrafts.length} draft testcase berdasarkan rekomendasi sebelumnya. Review dulu sebelum disimpan ke database.`;
    } else {
      try {
        const result = await generateCopilotJson({
          system: buildSystemPrompt(intentDecision),
          user: userPrompt,
          temperature: 0.25,
          maxTokens: 1200,
        });
        providerMeta = { provider: result.provider, model: result.model };
        const providerAnswer = cleanText(result.parsed.answer);
        answer = providerAnswer || deterministicAnswer;
        if (!shouldReturnDrafts) {
          drafts = [];
          actionDrafts = [];
        } else {
          drafts = await sanitizeDrafts(projectId, result.parsed.drafts);
          actionDrafts = sanitizeActionDrafts(result.parsed.actionDrafts);
        }
      } catch (error) {
        providerMeta = { error: error instanceof Error ? error.message : 'AI provider error' };
        answer = deterministicAnswer;
        if (isLowQualityAnswer(answer)) {
          answer = fallbackAnswer({
            question,
            citations: toolRun.citations,
            usedTools,
            providerError: providerMeta.error,
          });
        }
      }
    }

    if (!answer) {
      answer = fallbackAnswer({ question, citations: toolRun.citations, usedTools });
    }
    if (shouldReturnDrafts && drafts.length > 0) {
      actionDrafts = [
        ...drafts.map((draft, index): CopilotActionDraft => ({
          id: `create-testcase-${draft.testCaseId}-${index}`,
          type: 'CREATE_TESTCASE_DRAFT',
          title: `Draft ${draft.testCaseId}`,
          description: draft.testAction,
          testCaseDraft: draft,
        })),
        ...actionDrafts,
      ];
    }
    if (shouldReturnDrafts && drafts.length === 0 && actionDrafts.length === 0) {
      actionDrafts = toolRun.actionDrafts;
    }
    if (!shouldReturnDrafts) {
      drafts = [];
      actionDrafts = [];
    }
    actionDrafts = dedupeActionDrafts(actionDrafts).slice(0, 8);

    return NextResponse.json({
      answer,
      drafts,
      actionDrafts,
      citations: toolRun.citations,
      usedTools,
      provider: {
        ...providerMeta,
        intent: intentDecision.intent,
        actionMode: intentDecision.actionMode,
        confidence: intentDecision.confidence,
      },
    });
  } catch (error) {
    console.error('POST /api/ai/copilot error:', error);
    return NextResponse.json({ error: 'Gagal memproses QA Copilot.' }, { status: 500 });
  }
}
