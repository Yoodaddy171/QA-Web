import { NextRequest, NextResponse } from 'next/server';
import { getReportById, updateReport } from '@/lib/services/report-generator';

export const dynamic = 'force-dynamic';

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReportById(id);
  return report ? NextResponse.json({ report }) : NextResponse.json({ error: 'Report not found' }, { status: 404 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const report = await updateReport(id, {
      ...body,
      dateOfIssue: body.dateOfIssue ? new Date(body.dateOfIssue) : undefined,
      reportingPeriodStart: body.reportingPeriodStart ? new Date(body.reportingPeriodStart) : undefined,
      reportingPeriodEnd: body.reportingPeriodEnd ? new Date(body.reportingPeriodEnd) : undefined,
    });
    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update report' }, { status: 400 });
  }
}
