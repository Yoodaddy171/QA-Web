import { NextResponse } from 'next/server';
import { finalizeReport } from '@/lib/services/report-generator';
import { getRequestActor } from '@/lib/request-actor';

export const dynamic = 'force-dynamic';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await getRequestActor();
    if (!actor) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const { id } = await params;
    return NextResponse.json({ report: await finalizeReport(id, actor.name) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to finalize report' }, { status: 400 });
  }
}
