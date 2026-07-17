import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'path';
import os from 'os';
import { generateCopilotJson } from '@/lib/ai-provider';
import { compactLogLine, formatClassifiedLogs, IMPORTANT_LOG_PATTERN, limitText, PASS_EVIDENCE_PATTERN } from './summary-log-utils';
import { z } from 'zod';
import { beginGovernedAIRequest, completeGovernedAIRequest, failGovernedAIRequest } from '@/lib/ai-governance';

export const maxDuration = 60;

const MAX_FIELD_CHARS = 2500;
const MAX_EXECUTION_LOG_CHARS = 4500;
const MAX_EXTRA_LOG_CHARS = 5500;
const MAX_VISUAL_EVIDENCE_CHARS = 1800;
const MAX_PROMPT_CHARS = 11000;
const RETRY_PROMPT_CHARS = 6500;
const MAX_COMPLETION_TOKENS = 700;
const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-2.5-flash';
const AI_SUMMARY_MODELS = {
  groq: process.env.AI_SUMMARY_MODEL || process.env.GROQ_SUMMARY_MODEL || 'llama-3.3-70b-versatile',
  gemini: process.env.AI_SUMMARY_MODEL || process.env.GEMINI_SUMMARY_MODEL || process.env.GEMINI_MODEL,
  ollama: process.env.AI_SUMMARY_MODEL || process.env.OLLAMA_SUMMARY_MODEL || process.env.OLLAMA_MODEL,
};
const summarySchema = z.object({ summary: z.string().min(1).max(12000) });
const RUNTIME_DIR = process.env.QA_RUNTIME_DIR
  || path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'web-qa-runtime');
const LOGS_DIR = path.join(RUNTIME_DIR, 'logs');
const RECORDINGS_DIR = path.join(RUNTIME_DIR, 'recordings');
const LEGACY_LOGS_DIR = process.env.QA_LEGACY_LOGS_DIR
  || path.join(/*turbopackIgnore: true*/ process.cwd(), 'mini-services', 'logs');
const LEGACY_RECORDINGS_DIR = process.env.QA_LEGACY_RECORDINGS_DIR
  || path.join(/*turbopackIgnore: true*/ process.cwd(), 'mini-services', 'recordings');

type SummaryRecord = {
  id: string;
  testCaseId: string;
  testType: string;
  testAction: string;
  steps: string;
  stepLogs: string | null;
  expectedResult: string;
  actualResult: string | null;
  status: string;
};

type RecordingFrame = {
  file: string;
  relativeMs: number;
  timestamp?: string;
  url?: string;
};

type RecordingMetadata = {
  sessionId: string;
  testCaseId: string;
  targetUrl?: string | null;
  startedAt?: string;
  frames: RecordingFrame[];
};

async function getRecordingMetadataCandidates(testCaseIds: string[]) {
  const metadataItems: Array<{ metadataPath: string; mtimeMs: number }> = [];
  const roots = [RECORDINGS_DIR, LEGACY_RECORDINGS_DIR].filter(Boolean);

  for (const root of roots) {
    for (const testCaseId of testCaseIds) {
      const testCaseDir = path.join(root, encodeURIComponent(testCaseId));
      let entries;
      try { entries = await fs.readdir(testCaseDir, { withFileTypes: true }); } catch (error: any) { if (error.code === 'ENOENT') continue; throw error; }
      const sessionDirs = entries.filter(entry => entry.isDirectory()).map(entry => path.join(testCaseDir, entry.name));

      for (const sessionDir of sessionDirs) {
        const metadataPath = path.join(sessionDir, 'metadata.json');
        try { metadataItems.push({ metadataPath, mtimeMs: (await fs.stat(metadataPath)).mtimeMs }); } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
      }
    }
  }

  return metadataItems.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

async function readLatestRecording(testCaseIds: string[]) {
  for (const item of await getRecordingMetadataCandidates(testCaseIds)) {
    try {
      const metadata = JSON.parse(await fs.readFile(item.metadataPath, 'utf8')) as RecordingMetadata;
      if (!metadata.frames?.length) continue;
      return {
        metadata,
        metadataPath: item.metadataPath,
        framesDir: path.join(path.dirname(item.metadataPath), 'frames'),
      };
    } catch (_) {}
  }

  return null;
}

function extractImportantRelativeTimes(rawLogs: string) {
  return rawLogs
    .split('\n')
    .map(line => {
      try {
        const parsed = JSON.parse(line);
        const compacted = compactLogLine(line);
        if (!IMPORTANT_LOG_PATTERN.test(compacted) && !PASS_EVIDENCE_PATTERN.test(compacted)) return null;
        return typeof parsed.relativeMs === 'number' ? parsed.relativeMs : null;
      } catch {
        return null;
      }
    })
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
}

function pickVisualFrames(frames: RecordingFrame[], importantTimes: number[]) {
  if (!frames.length) return [];

  const sortedFrames = [...frames].sort((a, b) => a.relativeMs - b.relativeMs);
  const targetTimes = [
    sortedFrames[0].relativeMs,
    sortedFrames[Math.floor(sortedFrames.length * 0.35)]?.relativeMs,
    sortedFrames[Math.floor(sortedFrames.length * 0.7)]?.relativeMs,
    ...importantTimes.slice(-3),
    sortedFrames[sortedFrames.length - 1].relativeMs,
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  const selected = targetTimes.map(target => (
    sortedFrames.reduce((closest, frame) => (
      Math.abs(frame.relativeMs - target) < Math.abs(closest.relativeMs - target) ? frame : closest
    ), sortedFrames[0])
  ));

  return Array.from(new Map(selected.map(frame => [frame.file, frame])).values()).slice(0, 8);
}

function formatRelativeTime(relativeMs?: number) {
  if (typeof relativeMs !== 'number') return '-';
  const totalSeconds = Math.floor(Math.max(0, relativeMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

async function createVisualEvidence(projectId: string, testCaseIds: string[], rawLogs: string) {
  if (!process.env.GEMINI_API_KEY) return '';

  const latestRecording = await readLatestRecording(testCaseIds);
  if (!latestRecording) return '';

  const frames = pickVisualFrames(latestRecording.metadata.frames, extractImportantRelativeTimes(rawLogs));
  if (!frames.length) return '';

  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [{
    text: `Analisis frame screen recording QA berikut. Untuk setiap frame, jelaskan UI/state yang terlihat dan apakah ada bukti expected result tercapai atau error visual. Jawab singkat dalam bahasa Indonesia dengan format bullet "mm:ss - observasi". Target URL: ${latestRecording.metadata.targetUrl || '-'}`,
  }];

  for (const frame of frames) {
    const framePath = path.join(latestRecording.framesDir, frame.file);
    try {
      const frameData = await fs.readFile(framePath);
      parts.push({ text: `Frame ${formatRelativeTime(frame.relativeMs)}:` });
      parts.push({ inline_data: { mime_type: 'image/jpeg', data: frameData.toString('base64') } });
    } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
  }

  if (parts.length <= 1) return '';

  const governance = await beginGovernedAIRequest({
    projectId,
    operation: 'SUMMARIZE_VISUAL_EVIDENCE',
    promptVersion: 'visual-evidence-v1',
    contextIds: testCaseIds,
    dataCategories: ['recording-frames', 'target-url'],
  }, 'Analyze QA recording frames.', `${parts.length - 1} image parts will be sent to Gemini Vision.`, 450);
  if (!governance.allowExternalAi) {
    await failGovernedAIRequest(governance, new Error('ExternalAINotAllowed'));
    return '';
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': process.env.GEMINI_API_KEY,
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 450,
        },
      }),
      signal: AbortSignal.timeout(Math.max(1000, Number(process.env.AI_REQUEST_TIMEOUT_MS || 30_000))),
    });

    if (!response.ok) {
      const text = await response.text();
      console.warn(`[AI Summary] Gemini visual evidence skipped: ${response.status} ${limitText(text, 300)}`);
      throw new Error(`GeminiVisionHTTP${response.status}`);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text)
      .filter(Boolean)
      .join('\n');

    const output = text ? limitText(text, MAX_VISUAL_EVIDENCE_CHARS) : '';
    await completeGovernedAIRequest(governance, { provider: 'gemini', model: GEMINI_VISION_MODEL, raw: output });
    return output;
  } catch (error: any) {
    await failGovernedAIRequest(governance, error);
    console.warn(`[AI Summary] Gemini visual evidence failed: ${error.message}`);
    return '';
  }
}

function compactLogs(rawLogs: string, maxChars: number) {
  const lines = rawLogs
    .split('\n')
    .map(compactLogLine)
    .filter(Boolean);

  if (!lines.length) return '';

  const important = lines.filter(line => IMPORTANT_LOG_PATTERN.test(line));
  const tail = lines.slice(-40);
  const selected = Array.from(new Set([...important.slice(-50), ...tail]));

  return limitText(selected.join('\n'), maxChars);
}

async function createSummary(projectId: string, contextIds: string[], systemPrompt: string, userMessage: string) {
  try {
    const result = await generateCopilotJson({
      system: `${systemPrompt}

Return ONLY valid JSON object with this schema:
{"summary":"markdown string in Indonesian"}`,
      user: userMessage,
      models: AI_SUMMARY_MODELS,
      temperature: 0.3,
      maxTokens: MAX_COMPLETION_TOKENS,
      repairSchemaHint: '{"summary":"markdown string in Indonesian"}',
      schema: summarySchema,
      governance: { projectId, operation: 'SUMMARIZE_EXECUTION', promptVersion: 'execution-summary-v2', contextIds, dataCategories: ['testcase-content', 'execution-logs', 'network-logs', 'visual-evidence'] },
    });
    return String(result.parsed.summary || '').trim() || 'Gagal menghasilkan ringkasan.';
  } catch (error: any) {
    const status = error?.status;
    const message = error?.message || '';
    const isTooLarge = status === 413 || /request too large|tokens per minute|rate_limit_exceeded/i.test(message);

    if (!isTooLarge || userMessage.length <= RETRY_PROMPT_CHARS) throw error;

    const retryMessage = `${limitText(userMessage, RETRY_PROMPT_CHARS)}

NOTE: Context was reduced automatically because provider token limits were reached. Prioritize explicit errors, failed network calls, final status, expected vs actual result, and newest execution lines.`;

    console.warn(`[AI Summary] Provider rejected prompt size (${userMessage.length} chars). Retrying with ${retryMessage.length} chars.`);

    const result = await generateCopilotJson({
      system: `${systemPrompt}

Return ONLY valid JSON object with this schema:
{"summary":"markdown string in Indonesian"}`,
      user: retryMessage,
      models: AI_SUMMARY_MODELS,
      temperature: 0.3,
      maxTokens: MAX_COMPLETION_TOKENS,
      repairSchemaHint: '{"summary":"markdown string in Indonesian"}',
      schema: summarySchema,
      governance: { projectId, operation: 'SUMMARIZE_EXECUTION_RETRY', promptVersion: 'execution-summary-v2', contextIds, dataCategories: ['testcase-content', 'reduced-execution-logs', 'visual-evidence'] },
    });
    return String(result.parsed.summary || '').trim() || 'Gagal menghasilkan ringkasan.';
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { testCaseId } = body;
    const projectId = String(body.projectId || '').trim();

    if (!String(testCaseId || '').trim()) return NextResponse.json({ error: 'Test Case ID is required' }, { status: 400 });
    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    const requestedId = String(testCaseId).trim();

    console.log(`[AI Summary] Mencari Test Case/BugFix untuk ID: ${requestedId}`);

    // Coba cari berdasarkan Database UUID (id)
    let tc: SummaryRecord | null = await db.testCase.findFirst({
      where: { id: requestedId, projectId },
    });
    let recordType: 'TestCase' | 'BugFix' = 'TestCase';

    // Jika tidak ketemu, coba cari berdasarkan Visual ID (testCaseId)
    if (!tc) {
      console.log(`[AI Summary] TestCase tidak ditemukan dengan UUID, mencoba Visual ID: ${requestedId}`);
      tc = await db.testCase.findFirst({
        where: { testCaseId: requestedId, projectId },
      });
    }

    // BugFix punya tabel sendiri. Automation sering mengirim id BugFix, bukan id TestCase asli.
    if (!tc) {
      console.log(`[AI Summary] TestCase tidak ditemukan, mencoba BugFix: ${requestedId}`);
      const bugFix = await db.bugFix.findFirst({
        where: {
          projectId,
          OR: [
            { id: requestedId },
            { testCaseId: requestedId },
            { sourceTestCaseId: requestedId },
          ],
        },
      });

      if (bugFix) {
        tc = bugFix;
        recordType = 'BugFix';
      }
    }

    if (!tc) {
      const totalInDb = await db.testCase.count({ where: { projectId } });
      const totalBugFixInDb = await db.bugFix.count({ where: { projectId } });
      console.error(`[AI Summary] NOT FOUND: "${requestedId}". Total TestCase: ${totalInDb}. Total BugFix: ${totalBugFixInDb}.`);
      
      return NextResponse.json({ 
        error: `Test case atau bug fix "${requestedId}" tidak ditemukan.`,
        diagnostic: { requestedId }
      }, { status: 404 });
    }

    console.log(`[AI Summary] Berhasil menemukan ${recordType}: ${tc.testCaseId} (${tc.id})`);

    // 1. Ambil logs dari database (execution logs)
    const executionLogs = formatClassifiedLogs(tc.stepLogs || 'No execution logs found.', MAX_EXECUTION_LOG_CHARS);

    // 2. Ambil logs dari file system (console & network)
    let extraLogs = "";
    let rawExtraLogs = "";
    const logCandidates = Array.from(new Set([requestedId, tc.id, tc.testCaseId].filter(Boolean)));
    try {
      // Gunakan path absolute yang lebih aman
      console.log(`[AI Summary] Mencari log untuk kandidat ID: ${logCandidates.join(', ')}`);

      let foundLogPath = '';
      let fileContent = '';
      for (const logsDir of [LOGS_DIR, LEGACY_LOGS_DIR].filter(Boolean)) {
        for (const id of logCandidates) {
          const candidatePath = path.join(logsDir, `${encodeURIComponent(id)}.current.jsonl`);
          try { fileContent = await fs.readFile(candidatePath, 'utf8'); foundLogPath = candidatePath; break; } catch (error: any) { if (error.code !== 'ENOENT') throw error; }
        }
        if (foundLogPath) break;
      }

      if (foundLogPath) {
        const lines = fileContent.split('\n').filter(l => l.trim());
        rawExtraLogs = lines.join('\n');
        extraLogs = formatClassifiedLogs(lines.join('\n'), MAX_EXTRA_LOG_CHARS);
        console.log(`[AI Summary] Berhasil mengklasifikasi ${lines.length} baris log tambahan: ${foundLogPath}`);
      } else {
        console.warn(`[AI Summary] File current log tidak ditemukan untuk kandidat: ${logCandidates.join(', ')}`);
      }
    } catch (err: any) {
      console.error('[AI Summary] Error saat membaca file log:', err.message);
    }

    const visualEvidence = await createVisualEvidence(projectId, logCandidates, rawExtraLogs);

    const systemPrompt = `You are a Senior QA Automation Analyst. Summarize an automated/manual QA test result using Indonesian.

Decision rules:
1. The expected result and final state are the primary judge. If late/final evidence shows the expected result was reached, mark it as PASS or PASS WITH WARNING.
2. Do not fail a test only because setup/cleanup/precondition logs contain 400/404/409, especially clear-session, reset, delete, remove, logout, or cleanup. Treat those as non-blocking unless the main flow stops afterward.
3. Static assets, telemetry, preflight, Cloudflare RUM, data URLs, and browser noise are not business failures.
4. A 4xx/5xx is critical only when it belongs to the main business flow or contradicts the Expected Result.
5. If evidence is mixed, explain the uncertainty and cite the strongest final evidence.
6. If VISUAL EVIDENCE exists, use it as strong evidence for UI final state, but do not invent details not visible in the evidence.

Output format:
- Kesimpulan: PASS / FAIL / PASS WITH WARNING / INCONCLUSIVE plus one short reason.
- Evidence Utama: bullets with the most relevant final/main-flow proof.
- Error/Warning Diabaikan: setup/cleanup/noise that should not decide failure.
- Risiko atau Rekomendasi: concise next action if needed.`;

    const userMessage = `TEST CASE DETAILS:
Record Type: ${recordType}
ID: ${tc.testCaseId}
Database ID: ${tc.id}
Action: ${tc.testAction}
Type: ${tc.testType}
Status: ${tc.status}
Steps: ${limitText(tc.steps, MAX_FIELD_CHARS)}
Expected: ${limitText(tc.expectedResult, MAX_FIELD_CHARS)}
Actual: ${limitText(tc.actualResult || 'No actual result recorded.', MAX_FIELD_CHARS)}

CLASSIFIED AUTOMATION LOGS (EXECUTION):
${executionLogs}

CLASSIFIED AUTOMATION LOGS (CDP - CONSOLE & NETWORK):
${extraLogs || 'No CDP logs recorded.'}

VISUAL EVIDENCE (KEY FRAMES):
${visualEvidence || 'No visual evidence available.'}`;

    const compactUserMessage = limitText(userMessage, MAX_PROMPT_CHARS);
    console.log(`[AI Summary] Prompt size: system=${systemPrompt.length} chars, user=${compactUserMessage.length} chars`);

    const summary = await createSummary(projectId, logCandidates, systemPrompt, compactUserMessage);

    return NextResponse.json({ summary });
  } catch (error: any) {
    console.error('POST /api/ai/summary error:', error);
    return NextResponse.json({ error: 'Failed to generate summary: ' + error.message }, { status: 500 });
  }
}
