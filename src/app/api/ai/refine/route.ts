import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import {
  buildProjectSummary,
  readRelevantKnowledge,
  getSiblingTestCases,
  limitText,
} from '@/lib/ai-context';
import { generateCopilotJson } from '@/lib/ai-provider';

export const maxDuration = 60;

const AI_MODELS = {
  groq: process.env.AI_REFINE_MODEL || process.env.GROQ_REFINE_MODEL || process.env.GROQ_GENERATE_MODEL || process.env.GROQ_MODEL,
  gemini: process.env.AI_REFINE_MODEL || process.env.GEMINI_REFINE_MODEL || process.env.GEMINI_MODEL,
  ollama: process.env.AI_REFINE_MODEL || process.env.OLLAMA_REFINE_MODEL || process.env.OLLAMA_MODEL,
};
const MAX_OUTPUT_TOKENS = 1400;

const REFINE_MODES = {
  format: 'Rewrite generic or rough content into a clearer QA format. Replace vague phrases such as "Functional Test", "Open Page", "Interact with feature", and "Feature works as expected" with feature-specific Indonesian wording.',
  complete: 'Fill weak or missing details with reasonable QA assumptions. Make steps and expected result more concrete even when fields are not empty but are generic.',
  standardize: 'Standardize wording into professional Indonesian QA style. Use consistent verbs, numbered steps, measurable expected result, and concise remarks.',
  negative: 'Convert this into a negative test case. Change testType to Negative and make action, steps, expectedResult, and remarks focus on invalid/error/edge behavior while keeping the same feature context.',
} as const;

type RefineMode = keyof typeof REFINE_MODES;

function sanitizeText(value: unknown, maxLength = 1800) {
  return String(value || '').slice(0, maxLength);
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim().toLowerCase();
}

function isGenericText(value: string) {
  const normalized = normalizeText(value);
  return !normalized
    || normalized === 'functional test'
    || normalized === 'perform feature action'
    || normalized === 'feature works as expected'
    || normalized.includes('open page')
    || normalized.includes('interact with feature');
}

function getFeatureName(testCase: Record<string, string>) {
  const action = testCase.testAction || '';
  const nestedMatch = action.match(/^\[\[[^\]]+\]\s*([^\]]+)\]/);
  if (nestedMatch?.[1]) return nestedMatch[1].trim();

  const bracketWithTail = action.match(/^\[[^\]]+\]\s*(.+?)(?:\s+Functional Test)?$/i);
  if (bracketWithTail?.[1]) return bracketWithTail[1].replace(/\]+$/g, '').trim();

  const bracketMatches = [...action.matchAll(/\[([^\]]+)\]/g)].map(match => match[1]).filter(Boolean);
  if (bracketMatches.length > 0) return bracketMatches[bracketMatches.length - 1].replace(/^\[+|\]+$/g, '').trim();
  return testCase.subMenu || testCase.page || 'fitur terkait';
}

function buildFallbackRefinement(mode: RefineMode, testCase: Record<string, string>) {
  const feature = getFeatureName(testCase);
  const location = [testCase.page, testCase.subMenu].filter(Boolean).join(' > ') || testCase.page || 'halaman terkait';

  if (mode === 'negative') {
    return {
      testAction: `[${feature}] Validasi perilaku sistem ketika kondisi tidak valid atau data tidak sesuai`,
      steps: [
        `1. Buka ${location}`,
        `2. Akses atau jalankan fitur ${feature}`,
        '3. Masukkan data tidak valid, kosong, atau kondisi edge case yang relevan',
        '4. Jalankan aksi utama pada fitur tersebut',
        '5. Periksa validasi, pesan error, dan kestabilan tampilan',
      ].join('\n'),
      expectedResult: [
        `Sistem menolak proses ${feature} yang tidak valid.`,
        'Pesan validasi atau error tampil jelas dan sesuai konteks.',
        'Data tidak tersimpan atau tidak berubah secara tidak semestinya.',
        'Tidak terjadi crash, freeze, blank page, atau tampilan overlap.',
      ].join('\n'),
      remarks: 'Negative case hasil refinement AI. Sesuaikan data invalid dan expected error message dengan implementasi aktual.',
      priority: testCase.priority || 'Medium',
      testType: 'Negative',
    };
  }

  return {
    testAction: `[${feature}] Verifikasi fungsi dan tampilan berjalan sesuai kebutuhan`,
    steps: [
      `1. Buka ${location}`,
      `2. Pastikan elemen utama untuk ${feature} tampil pada halaman`,
      `3. Jalankan aksi utama yang berkaitan dengan ${feature}`,
      '4. Periksa respons sistem setelah aksi dilakukan',
      '5. Pastikan data, wording, layout, dan navigasi tetap konsisten',
    ].join('\n'),
    expectedResult: [
      `${feature} tampil dan dapat digunakan sesuai kebutuhan.`,
      'Sistem memberikan respons yang benar setelah aksi dilakukan.',
      'Data yang ditampilkan akurat dan tidak berubah di luar ekspektasi.',
      'Tidak terjadi error, tampilan rusak, overlap, atau proses yang terhenti.',
    ].join('\n'),
    remarks: mode === 'complete'
      ? 'Field telah dilengkapi dengan asumsi QA awal. Silakan sesuaikan dengan behavior aktual aplikasi.'
      : 'Format testcase telah distandarisasi agar lebih mudah dieksekusi dan direview.',
    priority: testCase.priority || 'Medium',
    testType: testCase.testType === 'Negative' ? 'Negative' : 'Positive',
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mode = (body.mode || 'format') as RefineMode;
    const testCase = body.testCase;

    if (!testCase?.id) {
      return NextResponse.json({ error: 'Test case is required' }, { status: 400 });
    }
    const refineInstruction = REFINE_MODES[mode] || REFINE_MODES.format;
    const compactCase = {
      testCaseId: sanitizeText(testCase.testCaseId, 80),
      page: sanitizeText(testCase.page, 120),
      subMenu: sanitizeText(testCase.subMenu, 120),
      testType: sanitizeText(testCase.testType, 40),
      testAction: sanitizeText(testCase.testAction),
      steps: sanitizeText(testCase.steps, 2400),
      expectedResult: sanitizeText(testCase.expectedResult, 2000),
      remarks: sanitizeText(testCase.remarks, 1000),
      priority: sanitizeText(testCase.priority, 40),
    };

    // ===== NEW: Fetch project context + sibling test cases + knowledge =====
    // Look up the test case in DB to get projectId
    const dbTestCase = await db.testCase.findFirst({
      where: { OR: [{ id: testCase.id }, { testCaseId: testCase.testCaseId }] },
      select: { id: true, projectId: true, page: true, subMenu: true, moduleId: true, module: { select: { name: true } } },
    });

    let projectContext = '';
    let siblingContext = '';
    let knowledgeContext = '';

    if (dbTestCase) {
      // Get project summary (lightweight)
      const summary = await buildProjectSummary(dbTestCase.projectId);
      if (summary) {
        projectContext = `APP: ${summary.name}${summary.description ? ` - ${limitText(summary.description, 200)}` : ''}`;
        if (dbTestCase.module) {
          projectContext += `\nModule: ${dbTestCase.module.name}`;
        }
      }

      // Get sibling test cases (same page/subMenu) for consistency
      const siblings = await getSiblingTestCases(
        dbTestCase.projectId,
        dbTestCase.page,
        dbTestCase.subMenu,
        dbTestCase.id,
        5
      );
      if (siblings.length > 0) {
        siblingContext = siblings.map(s =>
          `[${s.testCaseId}] ${s.testType} | ${s.priority} | ${limitText(s.testAction, 60)}`
        ).join('\n');
      }

      // Get relevant knowledge (QA rules, domain dictionary)
      const contextHint = `${compactCase.page} ${compactCase.subMenu} ${compactCase.testAction}`;
      knowledgeContext = await readRelevantKnowledge(dbTestCase.projectId, contextHint, {
        maxItems: 4,
        maxCharsPerItem: 600,
        maxTotalChars: 2000,
      });
    }

    const systemPrompt = `You are a senior QA engineer. Refine an existing test case.
Return ONLY valid JSON object with key "refined".
Do not invent unrelated features. Preserve the original intent and ID.
Write testAction, steps, expectedResult, and remarks in Indonesian.
Use clear numbered steps or bullet lines with newline separators.
IMPORTANT:
- The refined content MUST be meaningfully different from the original when the original is generic.
- Do NOT copy the original text unchanged.
- Replace generic phrases with concrete wording based on page, submenu, and feature.
- For negative mode, testType MUST be "Negative" and the scenario MUST cover invalid/error/edge behavior.
- Be consistent with sibling test cases in style and terminology.
${knowledgeContext ? '- Follow any QA rules or domain conventions from the project knowledge below.' : ''}

The refined object must contain:
- testAction: string
- steps: string
- expectedResult: string
- remarks: string
- priority: "Critical" | "High" | "Medium" | "Low"
- testType: "Positive" | "Negative"`;

    const userMessage = `${projectContext ? `=== APP CONTEXT ===\n${projectContext}\n\n` : ''}${siblingContext ? `=== SIBLING TEST CASES (same page, maintain consistency) ===\n${siblingContext}\n\n` : ''}${knowledgeContext ? `=== PROJECT KNOWLEDGE (QA rules, domain info) ===\n${knowledgeContext}\n\n` : ''}=== REFINEMENT REQUEST ===
Mode: ${mode}
Instruction: ${refineInstruction}

Existing test case JSON:
${JSON.stringify(compactCase, null, 2)}

Return JSON now. Make every field useful for manual QA execution.`;

    let parsed: Record<string, unknown>;
    try {
      const result = await generateCopilotJson({
        system: systemPrompt,
        user: userMessage,
        models: AI_MODELS,
        temperature: 0.25,
        maxTokens: MAX_OUTPUT_TOKENS,
        repairSchemaHint: '{"refined":{"testAction":"string","steps":"string","expectedResult":"string","remarks":"string","priority":"Critical or High or Medium or Low","testType":"Positive or Negative"}}',
      });
      parsed = result.parsed;
    } catch (aiError) {
      console.error('AI refine provider call failed:', aiError);
      return NextResponse.json({ error: 'AI provider error. Silakan coba lagi.' }, { status: 502 });
    }
    const refined = parsed.refined && typeof parsed.refined === 'object' ? parsed.refined as Record<string, any> : {};

    let cleaned = {
      testAction: sanitizeText(refined.testAction || compactCase.testAction, 3000),
      steps: sanitizeText(refined.steps || compactCase.steps, 5000),
      expectedResult: sanitizeText(refined.expectedResult || compactCase.expectedResult, 4000),
      remarks: sanitizeText(refined.remarks || compactCase.remarks, 2000),
      priority: ['Critical', 'High', 'Medium', 'Low'].includes(refined.priority) ? refined.priority : compactCase.priority || 'Medium',
      testType: refined.testType === 'Negative' ? 'Negative' : 'Positive',
    };

    const unchanged =
      normalizeText(cleaned.testAction) === normalizeText(compactCase.testAction)
      && normalizeText(cleaned.steps) === normalizeText(compactCase.steps)
      && normalizeText(cleaned.expectedResult) === normalizeText(compactCase.expectedResult)
      && normalizeText(cleaned.remarks) === normalizeText(compactCase.remarks)
      && cleaned.testType === compactCase.testType;

    const genericResult = isGenericText(cleaned.testAction)
      || isGenericText(cleaned.steps)
      || isGenericText(cleaned.expectedResult);

    if (unchanged || genericResult || (mode === 'negative' && cleaned.testType !== 'Negative')) {
      cleaned = buildFallbackRefinement(mode, compactCase);
    }

    return NextResponse.json({ refined: cleaned });
  } catch (error) {
    console.error('POST /api/ai/refine error:', error);
    return NextResponse.json({ error: 'Gagal refine test case' }, { status: 500 });
  }
}
