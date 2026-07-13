import type { CopilotRequiredTool } from '@/lib/ai-copilot-tools';

export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export type CopilotIntent = 'PROJECT_SUMMARY' | 'MODULE_RISK' | 'COVERAGE_GAP' | 'FIGMA_COVERAGE' | 'WEAK_STEPS' | 'GENERIC_EXPECTED' | 'BUGFIX_ANALYSIS' | 'TESTCASE_SEARCH' | 'CREATE_DRAFT' | 'REFINE_DRAFT' | 'UNKNOWN';
export type CopilotActionMode = 'ASK' | 'ANALYZE' | 'DRAFT' | 'MUTATE';
export type CopilotScope = { moduleId?: string; moduleName?: string; selectedTestCaseId?: string; followUpTarget?: string };

const DRAFT_INTENT_PATTERN = /\b(buat|buatkan|dibuatkan|generate|draft|tambahkan|create)\b/i;

export function cleanText(value: unknown) { return String(value ?? '').trim(); }
export function sanitizePriority(value: unknown) { const text = cleanText(value); return ['Critical', 'High', 'Medium', 'Low'].includes(text) ? text : 'Medium'; }
export function sanitizeTestType(value: unknown) { return cleanText(value) === 'Negative' ? 'Negative' : 'Positive'; }

export function buildToolQuestion(question: string, history: ChatMessage[]) {
  const lower = question.toLowerCase();
  const previousUser = [...history].reverse().find(message => message.role === 'user')?.content || '';
  const previousLower = previousUser.toLowerCase();
  if (/^(bagaimana|gimana|kalau|kalo)\s+(dengan\s+)?(di\s+)?[a-z0-9\s()-]+[?]?\s*$/i.test(question) && /belum\s+(?:di)?buat|missing|gap|negative case|coverage|cover/i.test(previousLower)) return `${previousUser}\n\nFollow-up target: ${question}`;
  if (/\bbelum\s+(?:di)?buat\b/.test(lower) && !/coverage|gap|missing/.test(lower)) return `${question}\n\nIntent: cari gap coverage/testcase yang belum dibuat, jangan membuat draft kecuali diminta eksplisit.`;
  return question;
}

export function normalizeForIntent(value: unknown) { return cleanText(value).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim(); }
export function extractFollowUpTarget(question: string) { return cleanText(cleanText(question).match(/(?:follow-up target|scope override)\s*:\s*([^\r\n]+)/i)?.[1]); }
export function isQuestionLike(question: string) { const lower = question.toLowerCase(); return /\b(apakah|apa|mana|berapa|bagaimana|gimana|kenapa|mengapa|cek|cari|tampilkan|list|daftar)\b/.test(lower) || lower.trim().endsWith('?'); }

export function inferIntentFromQuestion(question: string, history: ChatMessage[]) {
  const lower = question.toLowerCase();
  const previousUser = [...history].reverse().find(message => message.role === 'user')?.content || '';
  const previousLower = previousUser.toLowerCase();
  const draftRequested = DRAFT_INTENT_PATTERN.test(question);
  const questionLike = isQuestionLike(question);
  const saveRequested = /\b(simpan|save|apply|terapkan|commit|masukkan ke database)\b/.test(lower);
  if (saveRequested) return { intent: 'UNKNOWN' as CopilotIntent, actionMode: 'MUTATE' as CopilotActionMode, confidence: 0.85 };
  if (/\b(refine|perbaiki|rapihkan|revisi|ubah)\b/.test(lower) && /testcase|draft|steps?|expected|case/.test(lower)) return { intent: 'REFINE_DRAFT' as CopilotIntent, actionMode: 'DRAFT' as CopilotActionMode, confidence: 0.8 };
  if (draftRequested && !(questionLike && /\bbelum\s+(?:di)?buat\b/.test(lower))) return { intent: 'CREATE_DRAFT' as CopilotIntent, actionMode: 'DRAFT' as CopilotActionMode, confidence: 0.9 };
  if (/figma|screen|design|desain/.test(lower) && /coverage|cover|mencakup|cukup|testcase|case|belum/.test(lower)) return { intent: 'FIGMA_COVERAGE' as CopilotIntent, actionMode: 'ANALYZE' as CopilotActionMode, confidence: 0.86 };
  if (/expected result|expected|hasil.*generic|terlalu generic|masih generic|kurang spesifik/.test(lower)) return { intent: 'GENERIC_EXPECTED' as CopilotIntent, actionMode: 'ANALYZE' as CopilotActionMode, confidence: 0.86 };
  if (/steps?|langkah|kurang jelas|tidak jelas|manual qa|manual tester|eksekusi manual/.test(lower)) return { intent: 'WEAK_STEPS' as CopilotIntent, actionMode: 'ANALYZE' as CopilotActionMode, confidence: 0.86 };
  if (/coverage|cover|gap|cukup|negative case|positive case|skenario|missing|belum\s+(?:di)?buat|testcase.*belum/.test(lower) || (/^(bagaimana|gimana|kalau|kalo)\b/.test(lower) && /gap|coverage|belum\s+(?:di)?buat|negative case/.test(previousLower))) return { intent: 'COVERAGE_GAP' as CopilotIntent, actionMode: 'ANALYZE' as CopilotActionMode, confidence: 0.88 };
  if (/risk|risiko|prioritas|health|module paling|modul paling/.test(lower)) return { intent: 'MODULE_RISK' as CopilotIntent, actionMode: 'ANALYZE' as CopilotActionMode, confidence: 0.85 };
  if (/bug|retest|fix|failed|gagal|ready|verified|defect/.test(lower)) return { intent: 'BUGFIX_ANALYSIS' as CopilotIntent, actionMode: 'ANALYZE' as CopilotActionMode, confidence: 0.78 };
  if (/summary|ringkas|overview|project|status.*project|total testcase|berapa testcase/.test(lower)) return { intent: 'PROJECT_SUMMARY' as CopilotIntent, actionMode: 'ASK' as CopilotActionMode, confidence: 0.78 };
  if (/testcase|case|tc|status|priority|prioritas|not done|done|blocked|in progress/.test(lower)) return { intent: 'TESTCASE_SEARCH' as CopilotIntent, actionMode: 'ASK' as CopilotActionMode, confidence: 0.72 };
  return { intent: 'UNKNOWN' as CopilotIntent, actionMode: 'ASK' as CopilotActionMode, confidence: 0.55 };
}

export function requiredToolsForIntent(intent: CopilotIntent): CopilotRequiredTool[] {
  switch (intent) {
    case 'PROJECT_SUMMARY': case 'MODULE_RISK': return ['getModuleRisk'];
    case 'COVERAGE_GAP': case 'CREATE_DRAFT': return ['getCoverageGap'];
    case 'FIGMA_COVERAGE': return ['getFigmaScreenCoverage'];
    case 'WEAK_STEPS': return ['getWeakStepCases'];
    case 'GENERIC_EXPECTED': return ['getGenericExpectedResultCases'];
    case 'BUGFIX_ANALYSIS': return ['getBugFixes', 'searchTestCases'];
    case 'REFINE_DRAFT': return ['searchTestCases', 'getCoverageGap'];
    default: return ['searchTestCases'];
  }
}
