import { NextRequest, NextResponse } from 'next/server';
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
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    const reports = await getProjectReports(projectId);

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Error fetching reports:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reports' },
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
    const body = await request.json();

    // Validate required fields
    if (!body.projectId) {
      return NextResponse.json(
        { error: 'projectId is required' },
        { status: 400 }
      );
    }

    if (!['TEST_STATUS_REPORT', 'TEST_PLANNING_DOCUMENT'].includes(body.reportType)) {
      return NextResponse.json(
        { error: 'reportType is invalid' },
        { status: 400 }
      );
    }

    if (!body.version) {
      return NextResponse.json(
        { error: 'version is required' },
        { status: 400 }
      );
    }

    if (!body.reportingPeriodStart || !body.reportingPeriodEnd) {
      return NextResponse.json(
        { error: 'reportingPeriodStart and reportingPeriodEnd are required' },
        { status: 400 }
      );
    }

    // Convert date strings to Date objects
    const input: CreateReportInput = {
      projectId: body.projectId,
      reportType: body.reportType,
      documentId: body.documentId,
      version: body.version,
      author: body.author,
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
        { error: 'reporting period dates are invalid' },
        { status: 400 }
      );
    }

    // Validate date range
    if (input.reportingPeriodStart > input.reportingPeriodEnd) {
      return NextResponse.json(
        { error: 'reportingPeriodStart must be before reportingPeriodEnd' },
        { status: 400 }
      );
    }

    // Generate report
    const report = await generateReport(input);

    return NextResponse.json({ report }, { status: 201 });
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
