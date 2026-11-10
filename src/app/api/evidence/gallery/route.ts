import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import type { Prisma } from '@prisma/client';
import { guestSafeResponse } from '@/lib/services/guest-response';

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim();
  if (!projectId) {
    return NextResponse.json({ error: 'projectId wajib diisi.' }, { status: 400 });
  }

  const statusFilter = req.nextUrl.searchParams.get('status')?.trim() || 'all';
  const mediaFilter = req.nextUrl.searchParams.get('mediaType')?.trim() || 'all';
  const runIdFilter = req.nextUrl.searchParams.get('runId')?.trim() || 'all';
  const search = req.nextUrl.searchParams.get('search')?.trim() || '';
  const limit = Math.min(120, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 60));

  const baseWhere: Prisma.TestExecutionEvidenceWhereInput = {
    execution: {
      testRun: { projectId },
    },
  };

  const filteredWhere: Prisma.TestExecutionEvidenceWhereInput = {
    execution: {
      testRun: {
        projectId,
        ...(runIdFilter !== 'all' ? { id: runIdFilter } : {}),
      },
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      ...(search
        ? {
            OR: [
              { testCase: { testCaseId: { contains: search } } },
              { testCase: { page: { contains: search } } },
              { testCase: { testAction: { contains: search } } },
              { tester: { contains: search } },
            ],
          }
        : {}),
    },
    ...(mediaFilter === 'image'
      ? { mimeType: { startsWith: 'image/' } }
      : mediaFilter === 'video'
        ? { mimeType: { startsWith: 'video/' } }
        : mediaFilter === 'other'
          ? {
              AND: [
                { NOT: { mimeType: { startsWith: 'image/' } } },
                { NOT: { mimeType: { startsWith: 'video/' } } },
              ],
            }
          : {}),
    ...(search
      ? {
          OR: [
            { fileName: { contains: search } },
            {
              execution: {
                OR: [
                  { testCase: { testCaseId: { contains: search } } },
                  { testCase: { page: { contains: search } } },
                  { testCase: { testAction: { contains: search } } },
                  { tester: { contains: search } },
                ],
              },
            },
          ],
        }
      : {}),
  };

  try {
    const [rows, allMeta, runs] = await Promise.all([
      db.testExecutionEvidence.findMany({
        where: filteredWhere,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          createdAt: true,
          updatedAt: true,
          execution: {
            select: {
              id: true,
              status: true,
              tester: true,
              actualResult: true,
              notes: true,
              createdAt: true,
              testCase: {
                select: {
                  id: true,
                  testCaseId: true,
                  page: true,
                  testAction: true,
                  priority: true,
                },
              },
              testRun: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
      db.testExecutionEvidence.findMany({
        where: baseWhere,
        select: {
          mimeType: true,
          sizeBytes: true,
          execution: { select: { status: true } },
        },
      }),
      db.testRun.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, status: true },
        take: 50,
      }),
    ]);

    let totalBytes = 0;
    let imageCount = 0;
    let videoCount = 0;
    let failedEvidenceCount = 0;
    for (const item of allMeta) {
      totalBytes += item.sizeBytes || 0;
      if (item.mimeType.startsWith('image/')) imageCount++;
      else if (item.mimeType.startsWith('video/')) videoCount++;
      if (item.execution.status === 'FAILED') failedEvidenceCount++;
    }

    const items = rows.map((row) => ({
      id: row.id,
      fileName: row.fileName,
      mimeType: row.mimeType,
      sizeBytes: row.sizeBytes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      execution: {
        id: row.execution.id,
        status: row.execution.status,
        tester: row.execution.tester,
        actualResult: row.execution.actualResult,
        notes: row.execution.notes,
        createdAt: row.execution.createdAt,
      },
      testCase: row.execution.testCase,
      run: row.execution.testRun,
    }));

    return NextResponse.json(
      await guestSafeResponse({
        items,
        summary: {
          totalFiles: allMeta.length,
          totalBytes,
          imageCount,
          videoCount,
          failedEvidenceCount,
          runs,
        },
      }),
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    console.error('GET /api/evidence/gallery error:', error);
    return NextResponse.json({ error: 'Gagal memuat galeri evidence.' }, { status: 500 });
  }
}
