import { NextResponse } from 'next/server';
import { refreshReportSnapshot } from '@/lib/services/report-generator';

export const dynamic = 'force-dynamic';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json({ report: await refreshReportSnapshot(id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to refresh report' }, { status: 400 });
  }
}
