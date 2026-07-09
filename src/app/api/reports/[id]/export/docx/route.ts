import { NextResponse } from 'next/server';
import { getReportById } from '@/lib/services/report-generator';
import { generateReportDocx } from '@/lib/services/report-docx';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReportById(id);
  if (!report) return NextResponse.json({ error: 'Report not found' }, { status: 404 });

  const buffer = await generateReportDocx(report);
  const safeName = `${report.reportType}-${report.version}`.replace(/[^a-z0-9._-]+/gi, '-');
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${safeName}.docx"`,
    },
  });
}
