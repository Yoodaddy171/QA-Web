import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { isAllowedRequestOrigin, revokeSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!isAllowedRequestOrigin(req.nextUrl, req.headers.get('origin'))) return NextResponse.json({ error: 'Origin request tidak diizinkan.' }, { status: 403 });
  const cookieStore = await cookies();
  await revokeSession(cookieStore.get(SESSION_COOKIE)?.value);
  cookieStore.set(SESSION_COOKIE, '', sessionCookieOptions());
  return NextResponse.json({ loggedOut: true });
}
