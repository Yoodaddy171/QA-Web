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
import { z } from 'zod';
import { buildDeterministicAnswer, fallbackAnswer, isLowQualityAnswer } from './copilot-answer';
import {
  buildToolQuestion, cleanText, extractFollowUpTarget, inferIntentFromQuestion, normalizeForIntent,
  requiredToolsForIntent, sanitizePriority, sanitizeTestType,
  type ChatMessage, type CopilotActionMode, type CopilotIntent, type CopilotScope,
} from './copilot-intent';

export const maxDuration = 60;

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
const copilotSchema = z.object({
  answer: z.string().max(20000).default(''),
  drafts: z.array(z.record(z.string(), z.unknown())).max(12).default([]),
  actionDrafts: z.array(z.record(z.string(), z.unknown())).max(20).default([]),
}).passthrough();
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

function buildSystemPrompt(decision: IntentDecision) {
  return `You are QA Copilot for a local QA management app.
Answer in Indonesian, conversational but precise.
Use ONLY the TOOL RESULTS as factual database context. Never invent testcase IDs, bugfix IDs, modules, or counts.
Every number you state (counts, totals, percentages, breakdowns) must be copied or computed only from TOOL RESULTS — never estimated from memory.
Quote testcase IDs, module names, page names, and sub-menu names VERBATIM from TOOL RESULTS. Do not paraphrase or "correct" them.
If a fact is not in TOOL RESULTS, say it is not found.
If the user asks about a specific module/sub-menu/testcase that is absent from TOOL RESULTS, state that it was not found — do not silently answer about a similar item.
Never mention internal terms like "TOOL RESULTS", "PROJECT CONTEXT", or "intent" to the user; refer to them as "data project".
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
          // ponytail: single low temp for all copilot answers; split per-intent only if drafts get too rigid
          user: userPrompt,
          temperature: 0.1,
          maxTokens: 1200,
          schema: copilotSchema,
          governance: {
            projectId,
            operation: 'QA_COPILOT',
            promptVersion: 'qa-copilot-v2',
            contextIds: [selectedTestCaseId, intentDecision.scope.moduleId].filter((value): value is string => Boolean(value)),
            dataCategories: ['conversation-history', 'project-metrics', 'testcases', 'bugs', 'traceability'],
          },
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
