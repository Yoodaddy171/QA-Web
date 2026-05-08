import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import {
  buildProjectSummary,
  formatProjectContext,
  readRelevantKnowledge,
  getRecentBugFixes,
  limitText,
} from '@/lib/ai-context';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface GeneratedTestCase {
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

// Set max duration for this API route (Vercel/Next.js)
export const maxDuration = 60;

const AI_MODEL = process.env.GROQ_GENERATE_MODEL || process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
const MAX_CONTEXT_CASES = 12;
const MAX_OUTPUT_TOKENS = 2200;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, userPrompt, moduleFilter } = body;
    const requestedCount = Math.min(Math.max(Number(body.count || 4), 1), 8);
    const prompt = String(userPrompt || '').trim();

    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    if (!prompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY belum dikonfigurasi.' }, { status: 503 });
    }

    // Build comprehensive project context
    const projectSummary = await buildProjectSummary(projectId);
    if (!projectSummary) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const selectedModuleId = moduleFilter && moduleFilter !== 'all' ? String(moduleFilter) : null;
    if (selectedModuleId && !projectSummary.modules.some(m => m.id === selectedModuleId)) {
      return NextResponse.json({ error: 'Module tidak ditemukan pada project ini.' }, { status: 404 });
    }

    // Fetch existing test cases for context (show all to LLM)
    const existingTestCases = await db.testCase.findMany({
      where: {
        projectId,
        ...(selectedModuleId ? { moduleId: selectedModuleId } : {}),
      },
      select: {
        testCaseId: true,
        page: true,
        subMenu: true,
        testType: true,
        testAction: true,
        priority: true,
        status: true,
      },
      orderBy: { testCaseId: 'asc' },
      take: MAX_CONTEXT_CASES,
    });

    // Fetch project knowledge (QA rules, domain dictionary, feature maps)
    const knowledge = await readRelevantKnowledge(projectId, prompt, {
      maxItems: 6,
      maxCharsPerItem: 800,
      maxTotalChars: 3500,
    });

    // Fetch active bug fixes for problem-area awareness
    const activeBugs = await getRecentBugFixes(projectId, 5);

    // Get next ID sequence
    const idSequence = await getNextIdSequence(projectId, selectedModuleId, requestedCount);

    // Build rich context
    const projectContext = formatProjectContext(projectSummary);
    const existingContext = buildExistingTestCaseContext(existingTestCases);
    const bugContext = buildBugContext(activeBugs);

    const systemPrompt = `You are a senior QA Tester. Generate high-quality test cases for a web/mobile application.
Respond with ONLY a valid JSON object containing a "test_cases" array.

Each test case object must have:
- testCaseId: string (use the provided next IDs exactly, in order)
- page: string (page being tested)
- subMenu: string (sub-section or "")
- weight: string (e.g. "5%", "10%", or "")
- testType: "Positive" or "Negative"
- testAction: string (concise description in Indonesian/Bahasa Indonesia)
- steps: string (detailed steps using \\n for line breaks, prefixed with "1. ", "2. ", etc., in Indonesian)
- expectedResult: string (measurable expected outcome in Indonesian)
- priority: "Critical" | "High" | "Medium" | "Low"
- moduleId: string or null (match ID from provided modules)

RULES:
- Generate exactly ${requestedCount} high-value, non-redundant test cases.
- Write testAction, steps, expectedResult in Indonesian.
- Do NOT duplicate scenarios already covered by existing test cases.
- Prioritize areas with known bugs or low coverage.
- Include both positive and negative scenarios when appropriate.
- Steps must be specific and actionable, not generic.
- Expected results must be measurable and verifiable.`;

    const userMessage = `=== PROJECT CONTEXT ===
${projectContext}

=== EXISTING TEST CASES (avoid duplicating these) ===
${existingContext || 'No existing test cases yet.'}

${knowledge ? `=== PROJECT KNOWLEDGE (domain rules, API docs, features) ===\n${knowledge}\n` : ''}${bugContext ? `=== ACTIVE BUGS (consider testing around these areas) ===\n${bugContext}\n` : ''}
=== GENERATION CONFIG ===
Next testCaseId values to use exactly in order: ${idSequence.nextIds.join(', ')}
Available Modules: ${projectSummary.modules.map(m => `${m.name}(id:${m.id})`).join(', ') || 'None'}
${selectedModuleId ? `Target Module: ${projectSummary.modules.find(m => m.id === selectedModuleId)?.name || selectedModuleId}` : ''}

=== USER REQUEST ===
${prompt}

Return JSON with "test_cases" key containing exactly ${requestedCount} test cases:`;

    let completion;
    try {
      completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        model: AI_MODEL,
        temperature: 0.4,
        max_tokens: MAX_OUTPUT_TOKENS,
        response_format: { type: "json_object" }
      });
    } catch (aiError: unknown) {
      console.error('Groq API call failed:', aiError);
      return NextResponse.json({
        error: `Groq service error. Silakan coba lagi.`,
      }, { status: 502 });
    }

    const aiResponse = completion.choices[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(aiResponse);
    } catch {
      return NextResponse.json({ error: 'AI mengembalikan format yang tidak valid. Silakan coba lagi.' }, { status: 502 });
    }
    const generatedCases: GeneratedTestCase[] = parsed.test_cases || [];

    if (!Array.isArray(generatedCases) || generatedCases.length === 0) {
      return NextResponse.json({
        error: 'AI tidak berhasil menghasilkan test case.',
      }, { status: 422 });
    }

    // Validate and clean
    const projectModules = projectSummary.modules;
    const cleanedCases = generatedCases.slice(0, requestedCount).map((tc, index) => ({
      testCaseId: idSequence.nextIds[index] || String(tc.testCaseId || ''),
      page: String(tc.page || ''),
      subMenu: String(tc.subMenu || ''),
      weight: String(tc.weight || ''),
      testType: tc.testType === 'Negative' ? 'Negative' : 'Positive',
      testAction: String(tc.testAction || ''),
      steps: String(tc.steps || ''),
      expectedResult: String(tc.expectedResult || ''),
      priority: ['Critical', 'High', 'Medium', 'Low'].includes(tc.priority) ? tc.priority : 'Medium',
      moduleId: selectedModuleId || (tc.moduleId && projectModules.some(m => m.id === tc.moduleId) ? tc.moduleId : null),
    })).filter(tc => tc.testCaseId && tc.page && tc.testAction);

    return NextResponse.json({ generated: cleanedCases });
  } catch (error) {
    console.error('POST /api/ai error:', error);
    return NextResponse.json({ error: 'Gagal generate test case' }, { status: 500 });
  }
}

// ============== HELPER FUNCTIONS ==============

interface IdSequence {
  prefix: string;
  width: number;
  lastNumber: number;
  nextIds: string[];
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

function parseTestCaseId(value: string) {
  const match = value.match(/^(.+?-)(\d+)$/);
  if (!match) return null;
  return {
    prefix: match[1],
    number: Number(match[2]),
    width: match[2].length,
  };
}

function buildExistingTestCaseContext(testCases: Array<{
  testCaseId: string;
  page: string;
  subMenu: string | null;
  testType: string;
  testAction: string;
  priority: string;
  status: string;
}>): string {
  if (testCases.length === 0) return '';

  const lines = testCases.map(tc =>
    `[${tc.testCaseId}] ${tc.page}${tc.subMenu ? ` > ${tc.subMenu}` : ''} | ${tc.testType} | ${tc.priority} | ${tc.status} | ${limitText(tc.testAction, 80)}`
  );

  return lines.join('\n');
}

function buildBugContext(bugs: Array<{
  testCaseId: string;
  page: string;
  subMenu: string | null;
  testAction: string;
  priority: string;
  status: string;
  module: { name: string } | null;
}>): string {
  if (bugs.length === 0) return '';

  const lines = bugs.map(bug =>
    `[${bug.testCaseId}] ${bug.module?.name || ''} > ${bug.page}${bug.subMenu ? ` > ${bug.subMenu}` : ''} | ${bug.priority} | ${bug.status} | ${limitText(bug.testAction, 60)}`
  );

  return lines.join('\n');
}
