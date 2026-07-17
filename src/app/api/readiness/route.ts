import { NextResponse } from 'next/server';
import { getSystemReadiness } from '@/lib/services/readiness-service';

export const dynamic = 'force-dynamic';

export async function GET() {
  const readiness = await getSystemReadiness();
  return NextResponse.json(readiness, { headers: { 'Cache-Control': 'no-store' } });
}
