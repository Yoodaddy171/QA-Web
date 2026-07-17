import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { getRequestActor } from '@/lib/request-actor';

export interface AIGovernanceContext {
  projectId: string;
  operation: string;
  promptVersion: string;
  contextIds?: string[];
  dataCategories?: string[];
}

const requestBuckets = new Map<string, { count: number; resetAt: number }>();

export function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function scrubSensitiveText(input: string) {
  let redactions = 0;
  const replace = (pattern: RegExp, replacement: string) => {
    input = input.replace(pattern, () => { redactions += 1; return replacement; });
  };
  replace(/\b(?:sk|pk|key|token|secret)[-_][a-z0-9_-]{16,}\b/gi, '[REDACTED_SECRET]');
  replace(/\bBearer\s+[a-z0-9._~+\/-]+=*\b/gi, 'Bearer [REDACTED_TOKEN]');
  replace(/\b(?:password|passwd|pwd|api[_-]?key|secret)\s*[:=]\s*[^\s,;]+/gi, '[REDACTED_CREDENTIAL]');
  replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]');
  replace(/\b(?:\d[ -]*?){13,19}\b/g, '[REDACTED_PAYMENT_NUMBER]');
  return { text: input, redactions };
}

function consumeRate(key: string, now = Date.now()) {
  const limit = Math.max(1, Number(process.env.AI_REQUESTS_PER_MINUTE || 20));
  const bucket = requestBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    requestBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export async function beginGovernedAIRequest(context: AIGovernanceContext, system: string, user: string, requestedOutputTokens: number) {
  const actor = await getRequestActor();
  const project = await db.project.findUnique({ where: { id: context.projectId }, select: { id: true, allowExternalAi: true, aiMonthlyTokenBudget: true } });
  if (!project) throw new Error('Project AI governance tidak ditemukan.');
  const rateKey = `${context.projectId}:${actor?.userId || 'system'}`;
  if (!consumeRate(rateKey)) throw new Error('Batas request AI per menit tercapai.');

  const safeSystem = scrubSensitiveText(system);
  const safeUser = scrubSensitiveText(user);
  const maxOutputTokens = Math.min(Math.max(1, requestedOutputTokens), Math.max(256, Number(process.env.AI_MAX_OUTPUT_TOKENS || 4000)));
  const inputTokens = estimateTokens(`${safeSystem.text}\n${safeUser.text}`);
  const reservation = inputTokens + maxOutputTokens;
  const month = currentMonth();
  const usage = await db.aiUsageMonth.upsert({
    where: { projectId_month: { projectId: project.id, month } },
    update: {},
    create: { projectId: project.id, month },
  });
  const reserved = await db.aiUsageMonth.updateMany({
    where: { id: usage.id, usedTokens: { lte: Math.max(0, project.aiMonthlyTokenBudget - reservation) } },
    data: { usedTokens: { increment: reservation } },
  });
  if (!reserved.count) throw new Error('Budget token AI bulanan project sudah tercapai.');

  const audit = await db.aiRequestAudit.create({
    data: {
      projectId: project.id,
      actorUserId: actor?.userId || null,
      operation: context.operation,
      promptVersion: context.promptVersion,
      provider: 'pending',
      model: 'pending',
      contextIds: context.contextIds?.slice(0, 100) as Prisma.InputJsonValue | undefined,
      dataCategories: context.dataCategories?.slice(0, 20) as Prisma.InputJsonValue | undefined,
      inputChars: safeSystem.text.length + safeUser.text.length,
      outputChars: 0,
      inputTokens,
      outputTokens: 0,
      status: 'PENDING',
    },
  });

  return {
    auditId: audit.id,
    usageId: usage.id,
    reservation,
    inputTokens,
    maxOutputTokens,
    allowExternalAi: project.allowExternalAi,
    system: safeSystem.text,
    user: safeUser.text,
    redactions: safeSystem.redactions + safeUser.redactions,
  };
}

export async function completeGovernedAIRequest(state: Awaited<ReturnType<typeof beginGovernedAIRequest>>, result: { provider: string; model: string; raw: string }) {
  const outputTokens = estimateTokens(result.raw);
  const actualTokens = state.inputTokens + outputTokens;
  await db.$transaction([
    db.aiUsageMonth.update({ where: { id: state.usageId }, data: { usedTokens: { increment: actualTokens - state.reservation }, requestCount: { increment: 1 } } }),
    db.aiRequestAudit.update({ where: { id: state.auditId }, data: {
      provider: result.provider,
      model: result.model,
      outputChars: result.raw.length,
      outputTokens,
      outputHash: crypto.createHash('sha256').update(result.raw).digest('hex'),
      status: 'SUCCESS',
    } }),
  ]);
}

export async function failGovernedAIRequest(state: Awaited<ReturnType<typeof beginGovernedAIRequest>>, error: unknown) {
  const errorCode = error instanceof Error ? error.name.slice(0, 80) : 'UnknownError';
  await db.$transaction([
    db.aiUsageMonth.update({ where: { id: state.usageId }, data: { usedTokens: { decrement: state.reservation } } }),
    db.aiRequestAudit.update({ where: { id: state.auditId }, data: { status: 'FAILED', errorCode } }),
  ]).catch(() => undefined);
}

export function buildDataPreview(system: string, user: string) {
  const safeSystem = scrubSensitiveText(system);
  const safeUser = scrubSensitiveText(user);
  return {
    system: safeSystem.text.slice(0, 1200),
    user: safeUser.text.slice(0, 2400),
    truncated: safeSystem.text.length > 1200 || safeUser.text.length > 2400,
    redactions: safeSystem.redactions + safeUser.redactions,
    estimatedInputTokens: estimateTokens(`${safeSystem.text}\n${safeUser.text}`),
  };
}
