import { db } from '@/lib/db';

export const MAX_DRAFT_TEST_CASES = 5;
export const TESTCASE_ID_PATTERN = /\\b[A-Z]{1,4}-\\d{2,4}\\b/g;
export const GENERIC_KEYWORDS = new Set(['add','and','api','atau','both','cache','case','correct','data','date','dengan','developer','dia','fix','for','from','get','ini','input','include','list','management','method','original','pass','provided','reduce','remove','response','service','status','support','table','task','test','testcase','total','update','user','validation','yang']);

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type CoverageTestCaseRow = { testCaseId: string; page: string; subMenu: string | null; testAction: string; steps: string; expectedResult: string; module: { name: string } | null };

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

export { limitText, keywordCandidates, isCoverageQuestion, removeHallucinatedTestCaseIds, normalizeCoverageAnswer, isCreateTestCaseRequest, normalizeIntentText, isShortCreateIntent, isCreateFollowUpRequest, isBackendOnlyTask, hasVisibleQaOutcome, isActionableQaTask, coverageProfile, rowText, findCoverageMatch, buildDeterministicCoverageAnswer, extractDeveloperTasksFromText, extractTodoTestCaseTasks, taskGroupKey, representativeTaskForGroup, uniqueActionableTasks, normalizeCoverageTodoSection, extractActionableTasksFromHistory, buildDraftQuestion, buildAgenticSafetyContext, parseTestCaseId };

