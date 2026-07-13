import { db } from '@/lib/db';
import Groq from 'groq-sdk';
import { MAX_DRAFT_TEST_CASES, extractActionableTasksFromHistory, isActionableQaTask, parseTestCaseId } from './chat-logic';
import type { ChatMessage } from './chat-logic';

const AI_MODEL = process.env.GROQ_CHAT_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

export type TestCaseDraft = {
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
};

export type IdSequence = {
  prefix: string;
  width: number;
  lastNumber: number;
  nextIds: string[];
};

type ModuleOption = { id: string; name: string };
export type AgentDraft = Partial<TestCaseDraft>;

async function getNextIdSequence(projectId: string, moduleId: string | null, count: number): Promise<IdSequence> {
  const testCases = await db.testCase.findMany({
    where: {
      projectId,
      ...(moduleId ? { moduleId } : {}),
    },
    select: { testCaseId: true },
  });

  let prefix = 'A-';
  let width = 3;
  let lastNumber = 0;

  for (const testCase of testCases) {
    const parsed = parseTestCaseId(testCase.testCaseId);
    if (!parsed) continue;
    if (parsed.number > lastNumber) {
      prefix = parsed.prefix;
      width = parsed.width;
      lastNumber = parsed.number;
    }
  }

  const nextIds = Array.from({ length: count }, (_, index) => {
    const nextNumber = lastNumber + index + 1;
    return `${prefix}${String(nextNumber).padStart(width, '0')}`;
  });

  return { prefix, width, lastNumber, nextIds };
}

export function modulePrefix(moduleName: string): string {
  const lower = moduleName.toLowerCase();
  if (/pos|session|order|payment|discount|tax|home|statistic|table|scan/.test(lower)) return 'A-';
  if (/kds|kitchen|chef|dapur/.test(lower)) return 'B-';
  if (/kiosk/.test(lower)) return 'C-';
  if (/queue|antrian|display/.test(lower)) return 'D-';
  if (/customer|menu|order.*mobile|mobile.*order|dining/.test(lower)) return 'E-';
  return 'A-';
}

export function nextIdsForModule(prefix: string, startFrom: number, count: number): IdSequence {
  const nextIds = Array.from({ length: count }, (_, index) => {
    const nextNumber = startFrom + index + 1;
    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  });
  return { prefix, width: 3, lastNumber: startFrom, nextIds };
}

export async function nextIdSequenceForDraft(projectId: string, draft: Partial<TestCaseDraft>, modules: ModuleOption[]): Promise<IdSequence> {
  const moduleName = draft.moduleId
    ? modules.find(m => m.id === draft.moduleId)?.name || ''
    : modules.find(m => /pos|session|order|payment/.test(m.name.toLowerCase()))?.name || '';

  const prefix = moduleName ? modulePrefix(moduleName) : 'A-';

  const testCases = await db.testCase.findMany({
    where: {
      projectId,
      testCaseId: { startsWith: prefix.replace('-', '') },
    },
    select: { testCaseId: true },
    orderBy: { testCaseId: 'desc' },
    take: 1,
  });

  const lastNumber = testCases.length > 0
    ? (parseTestCaseId(testCases[0].testCaseId)?.number || 0)
    : 0;

  return nextIdsForModule(prefix, lastNumber, MAX_DRAFT_TEST_CASES);
}

export function requestedDraftCount(question: string) {
  const numberMatch = question.match(/\b(\d{1,2})\s*(testcase|test case|skenario|case)\b/i);
  if (numberMatch) return Math.min(Math.max(Number(numberMatch[1]), 1), MAX_DRAFT_TEST_CASES);

  const developerTaskLines = question
    .split(/\n|(?=\b(?:fix|feat|add|pass|remove|align|extract)\b)/i)
    .map(line => line.trim())
    .filter(line => /^(fix|feat|add|pass|remove|align|extract)\b/i.test(line));

  if (developerTaskLines.length >= 2) {
    const actionableCount = developerTaskLines.filter(isActionableQaTask).length;
    return Math.min(Math.max(actionableCount || developerTaskLines.length, 1), MAX_DRAFT_TEST_CASES);
  }

  return 1;
}

export function toQaFriendlyText(value: unknown) {
  let text = String(value || '').trim();
  if (!text) return '';

  text = text
    .replace(/\bAPI\s+endpoint\b/gi, 'halaman')
    .replace(/\bendpoint\s+API\b/gi, 'halaman')
    .replace(/\bendpoint\b/gi, 'halaman')
    .replace(/\bcontroller\b/gi, 'fitur')
    .replace(/\bservice\b/gi, 'fitur')
    .replace(/\bmethod\b/gi, 'proses')
    .replace(/\bfunction\b/gi, 'proses')
    .replace(/\bDTO\b/gi, 'data')
    .replace(/\bOpenAPI\b/gi, 'dokumentasi')
    .replace(/\bN\+1\b/gi, 'performa')
    .replace(/\bcache access token\b/gi, 'proses autentikasi')
    .replace(/\btoken cache\b/gi, 'sesi login')
    .replace(/\bcache token\b/gi, 'sesi login')
    .replace(/\baccess token\b/gi, 'sesi login')
    .replace(/\bFirebaseClient\b/gi, 'proses notifikasi')
    .replace(/\bPosHomeStatisticController\b/gi, 'statistik POS')
    .replace(/\bURL avatar\b/gi, 'avatar')
    .replace(/\bavatar URL\b/gi, 'avatar')
    .replace(/\bURL menu makanan\b/gi, 'halaman menu makanan')
    .replace(/\bmobile menu URL\b/gi, 'halaman menu mobile')
    .replace(/\bcalculateFinancials\(\)/gi, 'perhitungan pembayaran')
    .replace(/\bprocessTransactionPayment\(\)/gi, 'proses pembayaran')
    .replace(/\bfinalSubtotalAfterDiscount\b/gi, 'subtotal setelah diskon')
    .replace(/\btotalSubtotal\b/gi, 'subtotal')
    .replace(/mengakses\s+halaman\s+/gi, 'membuka halaman ')
    .replace(/halaman\s+statistik\s+POS\s+statistik\s+POS/gi, 'halaman statistik POS')
    .replace(/\s+/g, ' ')
    .trim();

  text = text
    .replace(/proses autentikasi aktif/gi, 'proses autentikasi berjalan stabil')
    .replace(/fitur statistik POS dengan GET .*/gi, 'statistik POS')
    .replace(/mengisi avatar/gi, 'memastikan avatar pengguna tersedia')
    .replace(/mengupdate/gi, 'memperbarui')
    .replace(/\bmengoreksi\b/gi, 'memverifikasi')
    .replace(/\bmenambahkan halaman statistik\b/gi, 'membuka halaman statistik')
    .replace(/\bhalaman statistik telah ditambahkan\b/gi, 'halaman statistik ditampilkan')
    .trim();

  return text;
}

export function inferModuleId(draft: Partial<TestCaseDraft>, modules: ModuleOption[]) {
  if (draft.moduleId && modules.some(module => module.id === draft.moduleId)) return draft.moduleId;

  const text = [
    draft.page,
    draft.subMenu,
    draft.testAction,
    draft.steps,
    draft.expectedResult,
  ].map(value => String(value || '').toLowerCase()).join(' ');

  const findModule = (namePattern: RegExp) => modules.find(module => namePattern.test(module.name.toLowerCase()))?.id || null;

  if (/\b(scan|mobile menu|menu mobile|qr|customer order|dining table|nama meja|meja makan)\b/.test(text)) {
    return findModule(/scan-to-order/);
  }
  if (/\b(pos|statistik|session|sesi|riwayat|table session|payment|pembayaran|discount|diskon|tax|pajak|grand total|order)\b/.test(text)) {
    return findModule(/\bpos\b/);
  }
  if (/\b(kiosk|kios)\b/.test(text)) {
    return findModule(/kiosk/);
  }
  if (/\b(kitchen|kds|dapur)\b/.test(text)) {
    return findModule(/kitchen|kds/);
  }
  if (/\b(queue|antrian)\b/.test(text)) {
    return findModule(/queue/);
  }

  return null;
}

function moduleIdByName(modules: ModuleOption[], pattern: RegExp) {
  return modules.find(module => pattern.test(module.name.toLowerCase()))?.id || null;
}

export function draftFromTask(task: string, testCaseId: string, modules: ModuleOption[]): TestCaseDraft {
  const lower = task.toLowerCase();
  const posModule = moduleIdByName(modules, /\bpos\b/);
  const scanModule = moduleIdByName(modules, /scan-to-order/);

  if (/avatar/.test(lower)) {
    return {
      testCaseId,
      page: 'Profil Pengguna',
      subMenu: 'Informasi Akun',
      weight: '',
      testType: 'Positive',
      testAction: 'Verifikasi avatar pengguna tampil pada informasi akun',
      steps: '- Login ke aplikasi\n- Buka halaman profil atau informasi akun\n- Periksa area avatar pengguna',
      expectedResult: 'Avatar pengguna tampil dengan benar dan tidak kosong.',
      priority: 'Medium',
      moduleId: posModule,
    };
  }

  if (/dining table|table name|mobile menu|nama meja|meja makan/.test(lower)) {
    return {
      testCaseId,
      page: 'Scan-to-Order',
      subMenu: 'Mobile Menu',
      weight: '',
      testType: 'Positive',
      testAction: 'Verifikasi nama meja tampil pada halaman menu mobile',
      steps: '- Buka link mobile menu dari meja yang dipilih\n- Periksa informasi meja pada halaman menu\n- Lanjutkan proses pemesanan sampai ringkasan order',
      expectedResult: 'Nama atau nomor meja tampil konsisten pada halaman menu dan ringkasan order.',
      priority: 'Medium',
      moduleId: scanModule,
    };
  }

  if (/session history|riwayat sesi|datatables|session list|status filter|date range|pagination|start_date|end_date|per_page/.test(lower)) {
    return {
      testCaseId,
      page: 'POS',
      subMenu: 'Session History',
      weight: '',
      testType: 'Positive',
      testAction: 'Verifikasi riwayat sesi dapat difilter dan ditampilkan dengan benar',
      steps: '- Buka halaman Session History\n- Gunakan filter status sesi\n- Gunakan filter rentang tanggal\n- Pindah halaman data jika tersedia',
      expectedResult: 'Data riwayat sesi tampil sesuai filter status, rentang tanggal, dan pagination.',
      priority: 'High',
      moduleId: posModule,
    };
  }

  if (/home statistic|statistic|statistik|summary/.test(lower)) {
    return {
      testCaseId,
      page: 'POS',
      subMenu: 'Home Statistic',
      weight: '',
      testType: 'Positive',
      testAction: 'Verifikasi statistik home POS menampilkan ringkasan sesi dengan benar',
      steps: '- Buka halaman home POS\n- Periksa ringkasan sesi open dan closed\n- Bandingkan total jumlah dan nominal dengan data sesi yang tersedia',
      expectedResult: 'Statistik home POS menampilkan jumlah sesi dan nominal total dengan benar.',
      priority: 'High',
      moduleId: posModule,
    };
  }

  if (/discount|diskon|tax|pajak|grand_total|grand total|subtotal|total_amount|calculatefinancials|processtransactionpayment/.test(lower)) {
    return {
      testCaseId,
      page: 'POS',
      subMenu: 'Payment Summary',
      weight: '',
      testType: 'Positive',
      testAction: 'Verifikasi perhitungan subtotal, diskon, pajak, dan grand total',
      steps: '- Buat order dengan item yang memiliki diskon\n- Lanjutkan sampai halaman ringkasan pembayaran\n- Periksa subtotal, diskon, pajak, dan grand total',
      expectedResult: 'Subtotal, diskon, pajak, dan grand total dihitung satu kali dan sesuai dengan ringkasan pembayaran.',
      priority: 'High',
      moduleId: posModule,
    };
  }

  return {
    testCaseId,
    page: 'POS',
    subMenu: 'Regression',
    weight: '',
    testType: 'Positive',
    testAction: toQaFriendlyText(task),
    steps: '- Buka fitur terkait\n- Jalankan flow utama\n- Periksa hasil yang tampil di UI',
    expectedResult: 'Flow berjalan sesuai ekspektasi dan tidak menampilkan error.',
    priority: 'Medium',
    moduleId: posModule,
  };
}

export async function createRuleBasedFollowUpDrafts(projectId: string, history: ChatMessage[]) {
  const tasks = extractActionableTasksFromHistory(history);
  if (tasks.length === 0) return null;

  const modules = await db.module.findMany({
    where: { projectId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const allPrefixes = ['A-', 'B-', 'C-', 'D-', 'E-'];
  const nextIdByPrefix: Record<string, IdSequence> = {};
  for (const prefix of allPrefixes) {
    const tc = await db.testCase.findMany({
      where: { projectId, testCaseId: { startsWith: prefix.replace('-', '') } },
      select: { testCaseId: true },
      orderBy: { testCaseId: 'desc' },
      take: 1,
    });
    const last = tc.length > 0 ? (parseTestCaseId(tc[0].testCaseId)?.number || 0) : 0;
    nextIdByPrefix[prefix] = nextIdsForModule(prefix, last, tasks.length);
  }

  const usedPrefixes = new Set<string>();
  const drafts = tasks.map((task) => {
    const draft = draftFromTask(task, 'TMP-001', modules);
    const moduleId = draft.moduleId;
    const moduleName = moduleId ? modules.find(m => m.id === moduleId)?.name || '' : '';
    const prefix = modulePrefix(moduleName);
    const seq = nextIdByPrefix[prefix];
    if (!usedPrefixes.has(prefix)) usedPrefixes.add(prefix);
    const idx = Array.from(usedPrefixes).indexOf(prefix);
    return { ...draft, testCaseId: seq.nextIds[idx] || `${prefix}001` };
  });

  return {
    answer: `Saya buatkan ${drafts.length} draft testcase dari daftar yang memang perlu dibuat. Silakan review dan edit detailnya sebelum Add.`,
    drafts,
  };
}

export async function createTestCaseDrafts(projectId: string, question: string, context: string) {
  const modules = await db.module.findMany({
    where: { projectId },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const allPrefixes = ['A-', 'B-', 'C-', 'D-', 'E-'];
  const nextIdByPrefix: Record<string, IdSequence> = {};
  for (const prefix of allPrefixes) {
    const tc = await db.testCase.findMany({
      where: { projectId, testCaseId: { startsWith: prefix.replace('-', '') } },
      select: { testCaseId: true },
      orderBy: { testCaseId: 'desc' },
      take: 1,
    });
    const last = tc.length > 0 ? (parseTestCaseId(tc[0].testCaseId)?.number || 0) : 0;
    nextIdByPrefix[prefix] = nextIdsForModule(prefix, last, MAX_DRAFT_TEST_CASES);
  }

  const systemPrompt = `You are a QA testcase drafting assistant.
Return ONLY valid JSON with keys "answer" and "test_cases".
Each test case must be ready to review in a form, not saved automatically.
Use Indonesian for testAction, steps, and expectedResult.
Do not use data from another project.
When the source is developer task text, convert it into user-facing QA/UI-UX regression scenarios.
Do not repeat coverage analysis tables.
Do not mention API endpoint, controller, service, function, DTO, OpenAPI, cache token, N+1, or internal variable names in testAction/steps/expectedResult.
Write what the QA will see or do in the product.
For backend-only work that cannot be seen from UI, create a regression testcase only when there is a visible user outcome.
If the user request includes an "ACTIONABLE QA TASKS ONLY" section, create drafts only for those bullet items.
ID PREFIX RULES:
- POS/Session/Order/Payment/Table/Scan modules â†’ A- prefix
- KDS/Kitchen/Chef/Dapur modules â†’ B- prefix
- Kiosk module â†’ C- prefix
- Queue/Antrian/Display modules â†’ D- prefix
- Customer/Mobile/Menu/Dining modules â†’ E- prefix
Set moduleId correctly so each draft gets the right ID prefix!`;

  const idInfo = Object.entries(nextIdByPrefix)
    .map(([prefix, seq]) => `${prefix}: ${seq.nextIds.join(', ')}`)
    .join('\n');

  const userMessage = `PROJECT CONTEXT:
${context}

Available modules:
${modules.map(module => `- ${module.name}: ${module.id}`).join('\n') || '- No modules'}

Next testCaseId pool per prefix:
${idInfo}

User request:
${question}

JSON schema:
{
  "answer": "short Indonesian explanation",
  "test_cases": [
    {
      "testCaseId": "string (pick from the pool above â€” match prefix to module)",
      "page": "string",
      "subMenu": "string",
      "testType": "Positive or Negative",
      "testAction": "string",
      "steps": "- step 1\\n- step 2",
      "expectedResult": "string",
      "priority": "Critical or High or Medium or Low",
      "moduleId": "string (module UUID)"
    }
  ]
}`;

  const completion = await getGroq().chat.completions.create({
    model: AI_MODEL,
    temperature: 0.25,
    max_tokens: 1600,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  const parsed = JSON.parse(raw);
  const generated = Array.isArray(parsed.test_cases) ? parsed.test_cases : [];

  const usedPrefixes = new Set<string>();
  const drafts: TestCaseDraft[] = generated.slice(0, MAX_DRAFT_TEST_CASES).map((draft: Partial<TestCaseDraft>) => {
    const moduleId = inferModuleId(draft, modules);
    const moduleName = moduleId ? modules.find(m => m.id === moduleId)?.name || '' : '';
    const prefix = modulePrefix(moduleName);
    const seq = nextIdByPrefix[prefix];
    if (!usedPrefixes.has(prefix)) usedPrefixes.add(prefix);
    const idx = Array.from(usedPrefixes).indexOf(prefix);
    const testCaseId = seq.nextIds[idx] || `${prefix}001`;

    return {
      testCaseId,
      page: toQaFriendlyText(draft.page),
      subMenu: toQaFriendlyText(draft.subMenu),
      weight: '',
      testType: draft.testType === 'Negative' ? 'Negative' : 'Positive',
      testAction: toQaFriendlyText(draft.testAction),
      steps: String(draft.steps || '')
        .split('\n')
        .map(line => toQaFriendlyText(line))
        .join('\n'),
      expectedResult: toQaFriendlyText(draft.expectedResult),
      priority: ['Critical', 'High', 'Medium', 'Low'].includes(String(draft.priority)) ? String(draft.priority) : 'Medium',
      moduleId,
    };
  }).filter(draft => draft.testCaseId && draft.page && draft.testAction && draft.steps && draft.expectedResult);

  return {
    answer: String(parsed.answer || `Saya buatkan ${drafts.length} draft testcase. Review dulu sebelum disimpan.`),
    drafts,
  };
}
