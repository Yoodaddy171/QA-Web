import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const maxDuration = 60;

const AI_MODEL = process.env.GROQ_CHAT_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const MAX_OUTPUT_TOKENS = 1600;
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CHARS = 3000;
const MAX_CONTEXT_CHARS = 4000;
const MAX_DRAFT_TEST_CASES = 5;
const TESTCASE_ID_PATTERN = /\b[A-Z]{1,4}-\d{2,4}\b/g;
const GENERIC_KEYWORDS = new Set([
  'add',
  'and',
  'api',
  'atau',
  'both',
  'cache',
  'case',
  'correct',
  'data',
  'date',
  'dengan',
  'developer',
  'dia',
  'fix',
  'for',
  'from',
  'get',
  'ini',
  'input',
  'include',
  'list',
  'management',
  'method',
  'original',
  'pass',
  'provided',
  'reduce',
  'remove',
  'response',
  'service',
  'status',
  'support',
  'table',
  'task',
  'test',
  'testcase',
  'total',
  'update',
  'user',
  'validation',
  'yang',
]);

function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type TestCaseDraft = {
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

type IdSequence = {
  prefix: string;
  width: number;
  lastNumber: number;
  nextIds: string[];
};

type ModuleOption = {
  id: string;
  name: string;
};

type KnowledgeRow = {
  id: string;
  type: string;
  title: string;
  content: string;
  updatedAt: string;
};

type CoverageTestCaseRow = {
  testCaseId: string;
  page: string;
  subMenu: string | null;
  testAction: string;
  steps: string;
  expectedResult: string;
  module: { name: string } | null;
};

type AgentDraft = Partial<TestCaseDraft>;

function limitText(value: unknown, max = 700) {
  const text = String(value ?? '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}... [trimmed]`;
}

function keywordCandidates(question: string) {
  const normalized = question
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_/().:]+/g, ' ');

  return Array.from(new Set(
    normalized
      .split(/[^a-zA-Z0-9-]+/)
      .map(word => word.trim().toLowerCase())
      .filter(word => word.length >= 4)
      .filter(word => !GENERIC_KEYWORDS.has(word))
      .slice(0, 18)
  ));
}

function isCoverageQuestion(question: string) {
  return /testcase.*(berhubungan|terkait|cover|coverage|sesuai)|task.*(developer|dikerjakan)|ada.*testcase|tidak ada/i.test(question);
}

async function removeHallucinatedTestCaseIds(projectId: string, answer: string) {
  const mentionedIds = Array.from(new Set(answer.match(TESTCASE_ID_PATTERN) || []));
  if (mentionedIds.length === 0) return answer;

  const existingRows = await db.testCase.findMany({
    where: {
      projectId,
      testCaseId: { in: mentionedIds },
    },
    select: { testCaseId: true },
  });
  const existingIds = new Set(existingRows.map((row) => row.testCaseId));
  const invalidIds = mentionedIds.filter((id) => !existingIds.has(id));
  if (invalidIds.length === 0) return answer;

  const invalidPattern = new RegExp(`\\b(${invalidIds.map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g');

  return answer
    .split('\n')
    .map((line) => {
      invalidPattern.lastIndex = 0;
      if (!invalidPattern.test(line)) return line;
      invalidPattern.lastIndex = 0;

      if (line.trim().startsWith('|')) {
        const cells = line.split('|').map((cell) => cell.trim());
        if (cells.length >= 5) {
          cells[2] = cells[2].replace(/\bAda\b/g, 'Tidak ada');
          cells[3] = cells[3].replace(invalidPattern, '-');
          cells[4] = 'Belum ada testcase yang terlihat langsung terkait di database project ini.';
          return cells.join(' | ');
        }
      }

      return line.replace(invalidPattern, '-');
    })
    .join('\n');
}

function normalizeCoverageAnswer(answer: string) {
  const normalized = answer
    .split('\n')
    .map((line) => {
      if (!line.trim().startsWith('|')) return line;

      const cells = line.split('|').map((cell) => cell.trim());
      if (cells.length < 5) return line;

      const coverage = cells[2]?.toLowerCase();
      const testCaseId = cells[3];
      const hasRealId = TESTCASE_ID_PATTERN.test(testCaseId || '');
      TESTCASE_ID_PATTERN.lastIndex = 0;

      if (coverage === 'ada' && !hasRealId) {
        cells[2] = 'Tidak ada';
        if (!cells[4] || /tidak ada testcase/i.test(cells[4])) {
          cells[4] = 'Belum ada testcase yang terlihat langsung terkait di database project ini.';
        }
        return cells.join(' | ');
      }

      return line;
    })
    .join('\n')
    .replace(/^\s*\*\s+Ada\s*$/gim, '* Tidak ada');

  return normalizeCoverageTodoSection(normalized);
}

function isCreateTestCaseRequest(question: string) {
  if (/\b(bahasa qa|bahasa tester|jangan terlalu technical|tidak terlalu technical|ubah bahasa|translate|terjemahkan|jelaskan|mapping|coverage|berhubungan|terkait)\b/i.test(question)) {
    return false;
  }

  return /\b(buat|buatkan|generate|create|tambahkan|draft)\s+(\d+\s+)?(testcase|test case|skenario test|negative case|positive case)\b/i.test(question)
    || /\b(testcase|test case)\s+(baru|untuk|negative|positive)\b/i.test(question);
}

function normalizeIntentText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isShortCreateIntent(question: string) {
  const normalizedQuestion = normalizeIntentText(question);
  return /^(baiklah\s+)?(oke|okay|ok|ya|iya|gas|lanjut)?\s*(buatkan|buat|generate|draft|tambahkan)\s*(saja|dong|ya)?$/.test(normalizedQuestion);
}

function isCreateFollowUpRequest(question: string, history: ChatMessage[]) {
  if (!isShortCreateIntent(question)) return false;

  return history.some(message =>
    /perlu dibuat testcase|buatkan testcase|draft testcase|testcase baru|skenario test|belum tercakup oleh test case|pekerjaan developer/i.test(message.content)
  );
}

function isBackendOnlyTask(task: string) {
  return /\b(openapi|swagger|documentation|dokumentasi|withcount|n\+1|cache access token|firebaseclient|cache token|token cache|private method|extract mapsession|redundant|finalsubtotalafterdiscount variable)\b/i.test(task);
}

function hasVisibleQaOutcome(task: string) {
  return /\b(avatar|dining table|table name|mobile menu|discount|tax|grand_total|grand total|total_amount|subtotal|financial|calculatefinancials|processtransactionpayment|status label|active|open|session history|datatables|home statistic|statistic|summary|session list|status filter|date range|pagination|start_date|end_date|per_page)\b/i.test(task);
}

function isActionableQaTask(task: string) {
  if (isBackendOnlyTask(task) && !hasVisibleQaOutcome(task)) return false;
  return hasVisibleQaOutcome(task);
}

function coverageProfile(task: string) {
  const lower = task.toLowerCase();

  if (/avatar/.test(lower)) {
    return { label: 'avatar/profile', required: ['avatar'], optional: ['profile', 'profil', 'user'] };
  }
  if (/dining table|table name|mobile menu|nomor meja|nama meja/.test(lower)) {
    return { label: 'mobile menu table name', required: ['meja'], optional: ['mobile', 'menu', 'url', 'scan'] };
  }
  if (/discount|diskon|tax|pajak|grand_total|grand total|subtotal|total_amount|calculatefinancials|processtransactionpayment/.test(lower)) {
    return { label: 'financial calculation', required: [], optional: ['discount', 'diskon', 'tax', 'pajak', 'grand', 'subtotal', 'total', 'amount'] };
  }
  if (/status label|active|open|table session/.test(lower)) {
    return { label: 'table session status', required: [], optional: ['table session', 'active', 'open', 'status'] };
  }
  if (/session history|riwayat sesi|datatables|session list|status filter|date range|pagination|start_date|end_date|per_page/.test(lower)) {
    return { label: 'session history', required: [], optional: ['session history', 'riwayat sesi', 'datatables', 'filter', 'date', 'tanggal', 'pagination'] };
  }
  if (/home statistic|statistic|statistik/.test(lower)) {
    return { label: 'home statistic', required: [], optional: ['home statistic', 'statistik home', 'statistic', 'statistik'] };
  }

  return null;
}

function rowText(row: CoverageTestCaseRow) {
  return [
    row.testCaseId,
    row.module?.name,
    row.page,
    row.subMenu,
    row.testAction,
    row.steps,
    row.expectedResult,
  ].join(' ').toLowerCase();
}

function findCoverageMatch(task: string, rows: CoverageTestCaseRow[]) {
  const profile = coverageProfile(task);
  if (!profile) return null;

  let best: { row: CoverageTestCaseRow; score: number } | null = null;

  for (const row of rows) {
    const text = rowText(row);
    if (profile.required.some(term => !text.includes(term))) continue;

    const score = profile.optional.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
    const requiredScore = profile.required.length * 2;
    const totalScore = score + requiredScore;
    const threshold = profile.required.length > 0 ? requiredScore + 1 : 2;

    if (totalScore < threshold) continue;
    if (!best || totalScore > best.score) best = { row, score: totalScore };
  }

  return best?.row || null;
}

async function buildDeterministicCoverageAnswer(projectId: string, question: string) {
  const taskSource = question
    .split(/\r?\n/)
    .map(line => line.trim().replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''))
    .filter(Boolean);
  const tasks = Array.from(new Set(taskSource.filter(line => (
    /^(fix|feat|add|pass|remove|align|extract|update|include|cache|correct|calculatefinancials|session|home|pagination|input|openapi)/i.test(line)
  ))));

  if (tasks.length === 0) return null;

  const rows = await db.testCase.findMany({
    where: { projectId },
    select: {
      testCaseId: true,
      page: true,
      subMenu: true,
      testAction: true,
      steps: true,
      expectedResult: true,
      module: { select: { name: true } },
    },
  });

  const tableRows = tasks.map((task) => {
    const technicalOnly = isBackendOnlyTask(task) && !hasVisibleQaOutcome(task);
    const match = technicalOnly ? null : findCoverageMatch(task, rows);

    return {
      task,
      coverage: match ? 'Ada' : 'Tidak ada',
      testCaseId: match?.testCaseId || '-',
      reason: match
        ? `Terkait langsung dengan ${coverageProfile(task)?.label || 'area yang sama'} pada ${match.module?.name || 'testcase'}.`
        : technicalOnly
          ? 'Backend/internal only; tidak perlu testcase UI khusus.'
          : 'Belum ada testcase yang terlihat langsung terkait di database project ini.',
      technicalOnly,
    };
  });

  const actionableMissing = uniqueActionableTasks(tableRows
    .filter(row => row.coverage === 'Tidak ada' && !row.technicalOnly && isActionableQaTask(row.task))
    .map(row => row.task));
  const technicalChecks = tableRows
    .filter(row => row.technicalOnly)
    .map(row => row.task);

  const lines = [
    'Berikut coverage berdasarkan testcase yang benar-benar ada di database project ini.',
    '',
    '| Task | Coverage | Testcase ID | Reason |',
    '| --- | --- | --- | --- |',
    ...tableRows.map(row => `| ${row.task} | ${row.coverage} | ${row.testCaseId} | ${row.reason} |`),
  ];

  if (actionableMissing.length > 0) {
    lines.push('', 'Perlu dibuat testcase:', ...actionableMissing.map(task => `- ${task}`));
  }

  if (technicalChecks.length > 0) {
    lines.push('', 'Cukup regression/technical check:', ...technicalChecks.map(task => `- ${task}`));
  }

  return lines.join('\n');
}

function extractDeveloperTasksFromText(text: string) {
  return text
    .split(/\r?\n/)
    .map(line => line.trim().replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, ''))
    .filter(line => /^(fix|feat|add|pass|remove|align|extract|update|include|cache|correct|calculatefinancials|session|home|pagination|input|openapi)\b/i.test(line))
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function extractTodoTestCaseTasks(text: string) {
  const lines = text.split(/\r?\n/);
  const tasks: string[] = [];
  let insideTodo = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^perlu dibuat testcase\s*:/i.test(trimmed)) {
      insideTodo = true;
      continue;
    }

    if (!insideTodo) continue;
    if (!trimmed) continue;
    if (/^(cukup regression|technical check|catatan|summary|ringkasan|coverage)\s*:/i.test(trimmed)) break;
    if (/^\|/.test(trimmed)) break;

    const candidate = trimmed
      .replace(/^[-*]\s+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (/^(fix|feat|add|pass|remove|align|extract|update|include|cache|correct|calculatefinancials|session|home|pagination|input|openapi)\b/i.test(candidate)) {
      tasks.push(candidate);
      continue;
    }

    break;
  }

  return tasks;
}

function taskGroupKey(task: string) {
  const lower = task.toLowerCase();

  if (/avatar/.test(lower)) return 'avatar';
  if (/home[-\s]?statistic|poshomestatistic|statistik/.test(lower)) return 'home-statistic';
  if (/session history|riwayat sesi|datatables|session list|status filter|date range|rentang tanggal|pagination|start_date|end_date|per_page|input validation|validasi input/.test(lower)) return 'session-history';
  if (/dining table|table name|mobile menu|nama meja|meja makan/.test(lower)) return 'mobile-table';
  if (/discount|diskon|tax|pajak|grand_total|grand total|subtotal|total_amount|calculatefinancials|processtransactionpayment/.test(lower)) return 'financial';

  return normalizeIntentText(task).slice(0, 100);
}

function representativeTaskForGroup(groupKey: string, tasks: string[]) {
  if (groupKey === 'home-statistic') {
    return 'home statistic POS menampilkan ringkasan sesi open dan closed';
  }
  if (groupKey === 'session-history') {
    const joined = tasks.join(' ').toLowerCase();
    const details = [
      /status filter|open, closed|status/.test(joined) ? 'filter status' : '',
      /date range|rentang tanggal|start_date|end_date/.test(joined) ? 'rentang tanggal' : '',
      /pagination|per_page/.test(joined) ? 'pagination' : '',
      /input validation|validasi input/.test(joined) ? 'validasi input' : '',
    ].filter(Boolean);

    return details.length > 0
      ? `Session History management dengan ${details.join(', ')}`
      : 'Session History management dengan daftar riwayat sesi';
  }

  return tasks[0];
}

function uniqueActionableTasks(tasks: string[]) {
  const grouped = new Map<string, string[]>();

  for (const task of tasks) {
    if (!isActionableQaTask(task)) continue;
    const key = taskGroupKey(task);
    grouped.set(key, [...(grouped.get(key) || []), task]);
  }

  return Array.from(grouped.entries())
    .map(([key, groupTasks]) => representativeTaskForGroup(key, groupTasks))
    .slice(0, MAX_DRAFT_TEST_CASES);
}

function normalizeCoverageTodoSection(answer: string) {
  const lines = answer.split('\n');
  const output: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!/perlu dibuat testcase\s*:/i.test(line)) {
      output.push(line);
      index += 1;
      continue;
    }

    const actionable: string[] = [];
    const technical: string[] = [];
    output.push(line);
    index += 1;

    while (index < lines.length) {
      const current = lines[index];
      const trimmed = current.trim();
      if (!trimmed) {
        index += 1;
        continue;
      }

      const bulletMatch = trimmed.match(/^[-*]\s+(.+)$/);
      if (!bulletMatch) break;

      const task = bulletMatch[1].trim();
      if (isActionableQaTask(task)) actionable.push(task);
      else technical.push(task);
      index += 1;
    }

    const uniqueActionable = uniqueActionableTasks(actionable);
    const uniqueTechnical = Array.from(new Set(technical));

    if (uniqueActionable.length > 0) {
      output.push(...uniqueActionable.map(task => `- ${task}`));
    } else {
      output.push('- Tidak ada task baru yang layak dibuat menjadi testcase UI khusus.');
    }

    if (uniqueTechnical.length > 0) {
      output.push('', 'Cukup regression/technical check:');
      output.push(...uniqueTechnical.map(task => `- ${task}`));
    }
  }

  return output.join('\n').replace(/\n{3,}/g, '\n\n');
}

function extractActionableTasksFromHistory(history: ChatMessage[]) {
  const todoTasks = history
    .slice(-8)
    .flatMap(message => extractTodoTestCaseTasks(message.content));
  if (todoTasks.length > 0) {
    return uniqueActionableTasks(todoTasks);
  }

  const tasks = history
    .slice(-8)
    .flatMap(message => extractDeveloperTasksFromText(message.content));

  return uniqueActionableTasks(tasks);
}

function buildDraftQuestion(question: string, history: ChatMessage[]) {
  if (!isCreateFollowUpRequest(question, history)) return question;

  const actionableTasks = extractActionableTasksFromHistory(history);
  const priorUserContext = history
    .slice(-6)
    .map(message => `${message.role.toUpperCase()}:\n${message.content}`)
    .join('\n\n');

  return [
    actionableTasks.length > 0
      ? `ACTIONABLE QA TASKS ONLY:\n${actionableTasks.map(task => `- ${task}`).join('\n')}`
      : '',
    '',
    priorUserContext,
    '',
    'User follow-up request:',
    question,
    '',
    'Instruction: buatkan draft testcase hanya untuk task yang punya dampak terlihat di UI/UX atau hasil bisnis. Abaikan task backend-only seperti cache token, OpenAPI, N+1, refactor private method, atau penghapusan variable internal jika tidak ada output yang terlihat oleh QA.',
  ].join('\n').trim();
}

function buildAgenticSafetyContext(question: string, history: ChatMessage[]) {
  const actionableTasks = uniqueActionableTasks([
    ...extractDeveloperTasksFromText(question),
    ...history.slice(-8).flatMap(message => extractDeveloperTasksFromText(message.content)),
  ]);

  const technicalOnlyTasks = Array.from(new Set([
    ...extractDeveloperTasksFromText(question),
    ...history.slice(-8).flatMap(message => extractDeveloperTasksFromText(message.content)),
  ])).filter(task => isBackendOnlyTask(task) && !hasVisibleQaOutcome(task)).slice(0, 12);

  return [
    'AGENTIC SAFETY CONTEXT:',
    `- Create intent: ${isShortCreateIntent(question) || isCreateTestCaseRequest(question) ? 'YES' : 'NO'}`,
    actionableTasks.length
      ? `- Actionable QA tasks eligible for testcase drafts:\n${actionableTasks.map(task => `  - ${task}`).join('\n')}`
      : '- Actionable QA tasks eligible for testcase drafts: none detected',
    technicalOnlyTasks.length
      ? `- Backend/internal tasks that should NOT become UI testcase drafts:\n${technicalOnlyTasks.map(task => `  - ${task}`).join('\n')}`
      : '- Backend/internal tasks that should NOT become UI testcase drafts: none detected',
  ].join('\n');
}

function parseTestCaseId(value: string) {
  const match = value.match(/^(.+?-)(\d+)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    number: Number(match[2]),
    width: match[2].length,
  };
}

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

function modulePrefix(moduleName: string): string {
  const lower = moduleName.toLowerCase();
  if (/pos|session|order|payment|discount|tax|home|statistic|table|scan/.test(lower)) return 'A-';
  if (/kds|kitchen|chef|dapur/.test(lower)) return 'B-';
  if (/kiosk/.test(lower)) return 'C-';
  if (/queue|antrian|display/.test(lower)) return 'D-';
  if (/customer|menu|order.*mobile|mobile.*order|dining/.test(lower)) return 'E-';
  return 'A-';
}

function nextIdsForModule(prefix: string, startFrom: number, count: number): IdSequence {
  const nextIds = Array.from({ length: count }, (_, index) => {
    const nextNumber = startFrom + index + 1;
    return `${prefix}${String(nextNumber).padStart(3, '0')}`;
  });
  return { prefix, width: 3, lastNumber: startFrom, nextIds };
}

async function nextIdSequenceForDraft(projectId: string, draft: Partial<TestCaseDraft>, modules: ModuleOption[]): Promise<IdSequence> {
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

function requestedDraftCount(question: string) {
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

function toQaFriendlyText(value: unknown) {
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

function inferModuleId(draft: Partial<TestCaseDraft>, modules: ModuleOption[]) {
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

function draftFromTask(task: string, testCaseId: string, modules: ModuleOption[]): TestCaseDraft {
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

async function createRuleBasedFollowUpDrafts(projectId: string, history: ChatMessage[]) {
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

async function createTestCaseDrafts(projectId: string, question: string, context: string) {
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
- POS/Session/Order/Payment/Table/Scan modules → A- prefix
- KDS/Kitchen/Chef/Dapur modules → B- prefix
- Kiosk module → C- prefix
- Queue/Antrian/Display modules → D- prefix
- Customer/Mobile/Menu/Dining modules → E- prefix
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
      "testCaseId": "string (pick from the pool above — match prefix to module)",
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

function buildContainsFilters(question: string) {
  const keywords = keywordCandidates(question);
  if (keywords.length === 0) return [];

  return keywords.flatMap(keyword => [
    { testCaseId: { contains: keyword } },
    { page: { contains: keyword } },
    { subMenu: { contains: keyword } },
    { testAction: { contains: keyword } },
    { expectedResult: { contains: keyword } },
    { status: { contains: keyword } },
    { priority: { contains: keyword } },
  ]);
}

function knowledgeScore(item: KnowledgeRow, keywords: string[]) {
  if (item.type === 'QA_RULES' || item.type === 'TEST_STRATEGY') return 8;
  const haystack = `${item.type} ${item.title} ${item.content}`.toLowerCase();
  return keywords.reduce((score, keyword) => score + (haystack.includes(keyword) ? 4 : 0), 0);
}

async function readRelevantKnowledge(projectId: string, question: string) {
  const keywords = keywordCandidates(question);
  const rows = await db.$queryRawUnsafe<KnowledgeRow[]>(
    `SELECT id, type, title, content, updatedAt
     FROM ProjectKnowledge
     WHERE projectId = ?
     ORDER BY updatedAt DESC
     LIMIT 40`,
    projectId
  );

  const relevant = rows
    .map(item => ({ item, score: knowledgeScore(item, keywords) }))
    .filter(entry => entry.score > 0 || keywords.length === 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ item }) => `### ${item.type}: ${item.title}\n${limitText(item.content, 500)}`);

  return relevant.length > 0
    ? limitText(relevant.join('\n\n'), 1500)
    : '';
}

async function buildProjectContext(projectId: string, question: string, selectedTestCaseId?: string) {
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

  if (!project) return null;

  const [modules, statusGroups, bugStatusGroups, priorityGroups] = await Promise.all([
    db.module.findMany({
      where: { projectId },
      select: { id: true, name: true, _count: { select: { testCases: true, bugFixItems: true } } },
      orderBy: { name: 'asc' },
      take: 30,
    }),
    db.testCase.groupBy({
      by: ['status'],
      where: { projectId },
      _count: { id: true },
    }),
    db.bugFix.groupBy({
      by: ['status'],
      where: { projectId },
      _count: { id: true },
    }),
    db.testCase.groupBy({
      by: ['priority'],
      where: { projectId },
      _count: { id: true },
    }),
  ]);

  const selectedRecord = selectedTestCaseId
    ? await db.testCase.findFirst({
      where: {
        projectId,
        OR: [{ id: selectedTestCaseId }, { testCaseId: selectedTestCaseId }],
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
        actualResult: true,
        status: true,
        progress: true,
        priority: true,
        remarks: true,
        module: { select: { name: true } },
      },
    })
    : null;

  const containsFilters = buildContainsFilters(question);
  const coverageQuestion = isCoverageQuestion(question);
  const keywords = keywordCandidates(question);
  const projectKnowledge = await readRelevantKnowledge(projectId, question);
  const [matchingTestCases, recentTestCases, matchingBugFixes] = await Promise.all([
    db.testCase.findMany({
      where: {
        projectId,
        ...(containsFilters.length > 0 ? { OR: containsFilters } : {}),
      },
      select: {
        id: true,
        testCaseId: true,
        page: true,
        subMenu: true,
        weight: true,
        testType: true,
        testAction: true,
        expectedResult: true,
        actualResult: true,
        status: true,
        progress: true,
        priority: true,
        remarks: true,
        module: { select: { name: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 6,
    }),
    db.testCase.findMany({
      where: { projectId },
      select: {
        testCaseId: true,
        page: true,
        subMenu: true,
        status: true,
        priority: true,
        testAction: true,
        module: { select: { name: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 4,
    }),
    db.bugFix.findMany({
      where: {
        projectId,
        ...(containsFilters.length > 0 ? { OR: containsFilters } : {}),
      },
      select: {
        id: true,
        testCaseId: true,
        page: true,
        subMenu: true,
        testAction: true,
        expectedResult: true,
        actualResult: true,
        status: true,
        priority: true,
        module: { select: { name: true } },
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 4,
    }),
  ]);

  const lines = [
    `PROJECT: ${project.name}`,
    `Totals: ${project._count.testCases} TC, ${project._count.modules} mods, ${project._count.bugFixItems} bugs`,
    `TC status: ${statusGroups.map(item => `${item.status}=${item._count.id}`).join(', ') || '-'}`,
    `Bug status: ${bugStatusGroups.map(item => `${item.status}=${item._count.id}`).join(', ') || '-'}`,
    '',
    'MODULES:',
    ...modules.map(module => `- ${module.name}: ${module._count.testCases} TC${module._count.bugFixItems > 0 ? `, ${module._count.bugFixItems} bugs` : ''}`),
  ];

  if (projectKnowledge) {
    lines.push('', 'PROJECT KNOWLEDGE:', projectKnowledge);
  }

  if (selectedRecord) {
    lines.push(
      '',
      `OPEN TC [${selectedRecord.testCaseId}]: ${selectedRecord.module?.name || '-'} > ${selectedRecord.page}${selectedRecord.subMenu ? ` > ${selectedRecord.subMenu}` : ''}`,
      `Status=${selectedRecord.status}, Priority=${selectedRecord.priority}`,
      `Action: ${limitText(selectedRecord.testAction, 200)}`,
      `Steps: ${limitText(selectedRecord.steps, 400)}`,
      `Expected: ${limitText(selectedRecord.expectedResult, 300)}`,
    );
  }

  if (matchingTestCases.length > 0) {
    lines.push(
      '',
      'MATCHING TEST CASES:',
      ...matchingTestCases.map(testCase => {
        return `- [${testCase.testCaseId}] ${testCase.module?.name || '-'} | ${testCase.status} | ${testCase.priority} | ${limitText(testCase.testAction, 150)}`;
      }),
    );
  } else if (coverageQuestion) {
    lines.push('', 'MATCHING TEST CASES: none found for coverage question');
  } else {
    lines.push(
      '',
      'RECENT TEST CASES:',
      ...recentTestCases.map(testCase => {
        return `- [${testCase.testCaseId}] ${testCase.module?.name || '-'} | ${testCase.status} | ${testCase.priority} | ${limitText(testCase.testAction, 150)}`;
      }),
    );
  }

  if (matchingBugFixes.length > 0) {
    lines.push(
      '',
      'MATCHING BUG FIXES:',
      ...matchingBugFixes.map(bug => `- [${bug.testCaseId}] ${bug.module?.name || '-'} | ${bug.status} | ${limitText(bug.actualResult, 120)}`),
    );
  }

  return limitText(lines.join('\n'), MAX_CONTEXT_CHARS);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const projectId = String(body.projectId || '').trim();
    const question = String(body.question || '').trim();
    const selectedTestCaseId = body.selectedTestCaseId ? String(body.selectedTestCaseId) : undefined;
    const history = Array.isArray(body.messages)
      ? (body.messages as ChatMessage[])
        .filter(message => ['user', 'assistant'].includes(message.role) && String(message.content || '').trim())
        .slice(-MAX_HISTORY_MESSAGES)
        .map(message => ({ role: message.role, content: limitText(message.content, MAX_HISTORY_CHARS) }))
      : [];

    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    if (!question) return NextResponse.json({ error: 'Question is required' }, { status: 400 });
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY belum dikonfigurasi.' }, { status: 503 });
    }

    const context = await buildProjectContext(projectId, question, selectedTestCaseId);
    if (!context) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    if (isCreateFollowUpRequest(question, history)) {
      const ruleBasedDrafts = await createRuleBasedFollowUpDrafts(projectId, history);
      if (ruleBasedDrafts) {
        return NextResponse.json({
          answer: ruleBasedDrafts.answer,
          drafts: ruleBasedDrafts.drafts,
        });
      }
    }

    const modules = await db.module.findMany({
      where: { projectId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const deterministicCoverage = isCoverageQuestion(question) && !isShortCreateIntent(question)
      ? await buildDeterministicCoverageAnswer(projectId, question)
      : null;
    if (deterministicCoverage) {
      return NextResponse.json({ answer: deterministicCoverage, drafts: [] });
    }

    // Prepare ID sequence in case the AI wants to draft
    const safetyContext = buildAgenticSafetyContext(question, history);

    const systemPrompt = `You are "QA Copilot", a Senior QA Automation & Strategy Partner with deep expertise in software testing.
You are a thinking partner — intelligent, opinionated, and helpful. You have common sense and can reason about software quality beyond just test cases.

PERSONALITY & BEHAVIOR:
- Be conversational, natural, and direct. Not robotic.
- Treat the conversation as a continuing thread: connect the current question to prior conclusions, corrections, and preferences instead of restarting from zero.
- Do not give a single-path answer when multiple plausible interpretations, causes, or strategies exist. Briefly compare the strongest alternatives and explain when each applies.
- For decisions or recommendations, present 2-3 viable options with a concrete upside and downside for each, then state your preferred option and why.
- Challenge weak assumptions politely. Surface trade-offs, dependencies, and second-order risks the user may not have considered.
- Adapt the shape of the answer to the question. Do not force every response into the same checklist, fixed headings, or repetitive closing.
- Ask at most one focused follow-up question, and only when the missing answer would materially change the recommendation. Otherwise make a reasonable assumption and continue.
- You can discuss anything related to QA, software development, testing strategy, bug analysis, release readiness, risk assessment, and general software engineering topics.
- When asked general questions (greetings, opinions, advice), respond naturally like a knowledgeable colleague would.
- When asked about the project, use the PROJECT CONTEXT data to give informed, specific answers.
- Proactively point out risks, suggest improvements, and share QA best practices when relevant.
- If something seems wrong or risky in the project data, mention it without being asked.
- You can explain technical concepts, help debug issues, discuss testing methodologies, and provide strategic QA advice.

CORE CAPABILITIES:
1. COMMON SENSE: Analyze project health from data. Spot patterns (e.g., too many blocked tests, aging bugs, low coverage areas). Give actionable advice.
2. AGENTIC DRAFTING: When the user asks to create/generate test cases, or when you suggest new tests, include them in "test_cases" array. You decide when drafts are appropriate.
3. UI-CENTRIC: Translate developer jargon (API, DTO, N+1, cache) into user-facing QA scenarios that a manual tester can execute.
4. LANGUAGE: Always answer in Indonesian (Bahasa Indonesia). Be natural, not overly formal.
5. FORMAT: Return ONLY a valid JSON object with the schema below.
6. SAFETY: Backend-only/internal tasks from AGENTIC SAFETY CONTEXT must not become UI testcase drafts.

JSON SCHEMA:
{
  "answer": "string (your conversational response in Indonesian, use markdown for formatting — tables, bullets, bold, code blocks as needed)",
  "test_cases": [
    {
      "testCaseId": "string (MUST be one of the provided IDs, e.g. A-001, B-003 — assign each draft the correct ID in sequence)",
      "page": "string",
      "subMenu": "string",
      "testType": "Positive or Negative",
      "testAction": "string",
      "steps": "string (numbered steps with newlines)",
      "expectedResult": "string",
      "priority": "Critical or High or Medium or Low",
      "moduleId": "string (UUID — use the moduleId that matches the test case area. Set moduleId correctly so each draft gets the right ID prefix. Check AVAILABLE MODULES table above.)"
    }
  ]
}

Note: "test_cases" array should be empty [] when you're just chatting/answering questions without creating test cases.

ID PREFIX RULES:
- POS/Session/Order/Payment/Table/Scan modules → A- prefix (e.g. A-001)
- KDS/Kitchen/Chef/Dapur modules → B- prefix (e.g. B-001)
- Kiosk module → C- prefix (e.g. C-001)
- Queue/Antrian/Display modules → D- prefix (e.g. D-001)
- Customer/Mobile/Menu/Dining modules → E- prefix (e.g. E-001)
- Assign IDs in the order drafts appear. If creating 3 drafts and IDs are [A-001, A-002, A-003], use them in order.
- CRITICAL: Set moduleId correctly — the testCaseId prefix is determined by which module you select!

AVAILABLE MODULES:
${modules.map(m => `- ${m.name}: ${m.id}`).join('\n')}

STRICT DATA RULES:
- Never hallucinate Testcase IDs. Use ONLY the provided IDs above when creating new drafts.
- Refer to existing IDs (e.g., A-001) only if they appear in the PROJECT CONTEXT.
- Every number you state (counts, totals, percentages, per-status/per-module breakdowns) must be copied or computed ONLY from PROJECT CONTEXT. Never estimate or round-trip numbers from memory.
- Quote testcase IDs, module names, page names, and sub-menu names VERBATIM from PROJECT CONTEXT. Do not paraphrase, translate, or "correct" them.
- If the user asks about a specific module/sub-menu/testcase that does not appear in PROJECT CONTEXT, say explicitly that it was not found in the data — do not answer about the closest similar item without labeling it as a different item.
- Do not invent project features, payment methods, screens, integrations, or bugs. If the context is insufficient, compare testing strategies and label any possible scenario explicitly as a hypothesis that needs confirmation.
- If asked to create after a coverage answer, create drafts only from "Actionable QA tasks eligible for testcase drafts".
- When you don't know something, say so honestly. Don't make up data.`;

    const completion = await getGroq().chat.completions.create({
      model: AI_MODEL,
      // Low temperature: answers must stay grounded in PROJECT CONTEXT facts.
      temperature: 0.2,
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `PROJECT CONTEXT:\n${context}` },
        { role: 'user', content: safetyContext },
        ...history,
        { role: 'user', content: question },
      ],
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    const rawDrafts: AgentDraft[] = Array.isArray(parsed.test_cases) ? parsed.test_cases.slice(0, MAX_DRAFT_TEST_CASES) : [];
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

    const usedPrefixes = new Set<string>();
    let drafts: TestCaseDraft[] = rawDrafts.map((draft) => {
      const moduleId = inferModuleId(draft, modules);
      const moduleName = moduleId
        ? modules.find(m => m.id === moduleId)?.name || ''
        : '';
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
        steps: String(draft.steps || '').split('\n').map(line => toQaFriendlyText(line)).join('\n'),
        expectedResult: toQaFriendlyText(draft.expectedResult),
        priority: ['Critical', 'High', 'Medium', 'Low'].includes(String(draft.priority)) ? String(draft.priority) : 'Medium',
        moduleId,
      };
    }).filter(d => d.testCaseId && d.page && d.testAction && d.steps && d.expectedResult);

    if (drafts.length === 0 && isCreateFollowUpRequest(question, history)) {
      const fallback = await createTestCaseDrafts(projectId, buildDraftQuestion(question, history), context);
      drafts = fallback.drafts;
      if (!parsed.answer) parsed.answer = fallback.answer;
    }

    let answer = String(parsed.answer || 'Maaf, AI tidak menghasilkan jawaban.');
    if (isCoverageQuestion(question)) {
      answer = normalizeCoverageAnswer(await removeHallucinatedTestCaseIds(projectId, answer));
    }

    return NextResponse.json({ answer, drafts });
  } catch (error) {
    console.error('POST /api/ai/chat error:', error);
    return NextResponse.json({ error: 'Gagal memproses chat AI.' }, { status: 500 });
  }
}
