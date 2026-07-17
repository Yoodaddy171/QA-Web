import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const maxDuration = 60;

const AI_MODEL = process.env.GROQ_CHAT_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const MAX_OUTPUT_TOKENS = 1600;
const MAX_HISTORY_MESSAGES = 8;
const MAX_HISTORY_CHARS = 3000;
const MAX_CONTEXT_CHARS = 4000;
function getGroq() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

type KnowledgeRow = {
  id: string;
  type: string;
  title: string;
  content: string;
  updatedAt: string;
};

import { MAX_DRAFT_TEST_CASES, buildAgenticSafetyContext, buildDeterministicCoverageAnswer, buildDraftQuestion, extractActionableTasksFromHistory, isActionableQaTask, isCoverageQuestion, isCreateFollowUpRequest, isCreateTestCaseRequest, isShortCreateIntent, keywordCandidates, limitText, normalizeCoverageAnswer, parseTestCaseId, removeHallucinatedTestCaseIds } from './chat-logic';
import type { ChatMessage } from './chat-logic';
import {
  createRuleBasedFollowUpDrafts, createTestCaseDrafts, draftFromTask, inferModuleId,
  modulePrefix, nextIdSequenceForDraft, nextIdsForModule, requestedDraftCount, toQaFriendlyText,
  type AgentDraft, type IdSequence, type TestCaseDraft,
} from './chat-drafts';


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
- POS/Session/Order/Payment/Table/Scan modules â†’ A- prefix (e.g. A-001)
- KDS/Kitchen/Chef/Dapur modules â†’ B- prefix (e.g. B-001)
- Kiosk module â†’ C- prefix (e.g. C-001)
- Queue/Antrian/Display modules â†’ D- prefix (e.g. D-001)
- Customer/Mobile/Menu/Dining modules â†’ E- prefix (e.g. E-001)
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
