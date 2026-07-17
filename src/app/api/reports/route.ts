import { NextRequest, NextResponse } from 'next/server';
import { getRequestActor } from '@/lib/request-actor';
import { db } from '@/lib/db';
import { generateReport, getProjectReports } from '@/lib/services/report-generator';
import type { CreateReportInput } from '@/lib/services/report-types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports
 * Fetch all reports for a project
 * Query params: projectId (required)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project wajib dipilih.' },
        { status: 400 }
      );
    }

    const page = await getProjectReports(projectId, {
      cursor: searchParams.get('cursor') || undefined,
      limit: Number(searchParams.get('limit') || 50),
    });

    return NextResponse.json({ reports: page.items, hasMore: page.hasMore, nextCursor: page.nextCursor });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Gagal memuat report' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports
 * Generate and save a new report
 * Body: CreateReportInput
 */
export async function POST(request: NextRequest) {
  try {
    const actor = await getRequestActor();
    if (!actor) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const body = await request.json();

    // Validate required fields
    if (!body.projectId) {
      return NextResponse.json(
        { error: 'Project wajib dipilih.' },
        { status: 400 }
      );
    }

    if (!['TEST_STATUS_REPORT', 'TEST_PLANNING_DOCUMENT'].includes(body.reportType)) {
      return NextResponse.json(
        { error: 'Tipe report tidak valid.' },
        { status: 400 }
      );
    }

    if (!body.version) {
      return NextResponse.json(
        { error: 'Version wajib diisi.' },
        { status: 400 }
      );
    }

    if (body.reportType === 'TEST_STATUS_REPORT' && !body.testRunId) {
      return NextResponse.json({ error: 'Source Test Cycle wajib dipilih untuk Test Status Report.' }, { status: 400 });
    }

    if (!body.reportingPeriodStart || !body.reportingPeriodEnd) {
      return NextResponse.json(
        { error: 'Periode pelaporan (mulai dan selesai) wajib diisi.' },
        { status: 400 }
      );
    }

    // Convert date strings to Date objects
    const input: CreateReportInput = {
      projectId: body.projectId,
      reportType: body.reportType,
      documentId: body.documentId,
      testRunId: body.testRunId,
      version: body.version,
      author: actor.name,
      approvedBy: body.approvedBy,
      dateOfIssue: body.dateOfIssue ? new Date(body.dateOfIssue) : undefined,
      documentStatus: body.documentStatus,
      reportingPeriodStart: new Date(body.reportingPeriodStart),
      reportingPeriodEnd: new Date(body.reportingPeriodEnd),
      metadata: body.metadata,
      sections: {
        ...body.sections,
        progressNarrative: body.progressNarrative || body.sections?.progressNarrative,
        blockingFactors: body.blockingFactors || body.sections?.blockingFactors,
        newRisks: body.newRisks || body.sections?.newRisks,
        plannedTesting: body.plannedTesting || body.sections?.plannedTesting,
      },
    };

    if (Number.isNaN(input.reportingPeriodStart.getTime()) || Number.isNaN(input.reportingPeriodEnd.getTime())) {
      return NextResponse.json(
        { error: 'Tanggal periode pelaporan tidak valid.' },
        { status: 400 }
      );
    }

    // Validate date range
    if (input.reportingPeriodStart > input.reportingPeriodEnd) {
      return NextResponse.json(
        { error: 'Tanggal mulai harus sebelum tanggal selesai.' },
        { status: 400 }
      );
    }

    const project = await db.project.findUnique({ where: { id: input.projectId }, select: { id: true } });
    if (!project) {
      return NextResponse.json({ error: 'Project tidak ditemukan.' }, { status: 404 });
    }
    if (input.testRunId) {
      const run = await db.testRun.findFirst({ where: { id: input.testRunId, projectId: input.projectId }, select: { id: true } });
      if (!run) return NextResponse.json({ error: 'Source Test Cycle tidak ditemukan pada project ini.' }, { status: 404 });
    }

    // Generate report
    const report = await generateReport(input);

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: 'Gagal membuat report' },
      { status: 500 }
    );
  }
}
