import { db } from '@/lib/db';
import { getProjectStats } from '@/lib/services/stats-service';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const projectId = url.searchParams.get('projectId');

    if (!projectId) return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    return NextResponse.json(await getProjectStats(projectId));
  } catch (error) {
    console.error('GET /api/stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
