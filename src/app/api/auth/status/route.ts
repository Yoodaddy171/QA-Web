import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getSessionByToken, SESSION_COOKIE } from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const [userCount, session] = await Promise.all([
    db.user.count(),
    getSessionByToken(cookieStore.get(SESSION_COOKIE)?.value),
  ]);
  return NextResponse.json({
    setupRequired: userCount === 0,
    authenticated: Boolean(session),
    user: session ? {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      memberships: session.user.memberships.map(item => ({ role: item.role, workspace: item.workspace })),
    } : null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
