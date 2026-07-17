import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { buildDataPreview } from '@/lib/ai-governance';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) return NextResponse.json({ error: 'projectId wajib diisi.' }, { status: 400 });
  const month = new Date().toISOString().slice(0, 7);
  const [project, usage, audits] = await Promise.all([
    db.project.findUnique({ where: { id: projectId }, select: { allowExternalAi: true, aiMonthlyTokenBudget: true } }),
    db.aiUsageMonth.findUnique({ where: { projectId_month: { projectId, month } } }),
    db.aiRequestAudit.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, operation: true, promptVersion: true, provider: true, model: true, dataCategories: true, inputTokens: true, outputTokens: true, status: true, createdAt: true } }),
  ]);
  if (!project) return NextResponse.json({ error: 'Project tidak ditemukan.' }, { status: 404 });
  return NextResponse.json({ ...project, month, usedTokens: usage?.usedTokens || 0, requestCount: usage?.requestCount || 0, audits });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const projectId = String(body.projectId || '').trim();
  const budget = Math.round(Number(body.aiMonthlyTokenBudget));
  if (!projectId || !Number.isFinite(budget) || budget < 1000 || budget > 10_000_000) return NextResponse.json({ error: 'Project dan budget 1.000–10.000.000 token wajib diisi.' }, { status: 400 });
  const project = await db.project.update({ where: { id: projectId }, data: { allowExternalAi: body.allowExternalAi === true, aiMonthlyTokenBudget: budget }, select: { allowExternalAi: true, aiMonthlyTokenBudget: true } });
  return NextResponse.json(project);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const projectId = String(body.projectId || '').trim();
  if (!projectId) return NextResponse.json({ error: 'projectId wajib diisi.' }, { status: 400 });
  const project = await db.project.findUnique({ where: { id: projectId }, select: { allowExternalAi: true } });
  if (!project) return NextResponse.json({ error: 'Project tidak ditemukan.' }, { status: 404 });
  return NextResponse.json({
    providerPolicy: project.allowExternalAi ? 'External provider diizinkan; fallback lokal tetap dapat digunakan.' : 'Hanya local Ollama diizinkan.',
    preview: buildDataPreview(String(body.system || ''), String(body.user || '')),
    dataCategories: Array.isArray(body.dataCategories) ? body.dataCategories.map(String).slice(0, 20) : [],
  });
}
