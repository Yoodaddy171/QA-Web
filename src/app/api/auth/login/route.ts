import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { clearLoginAttempts, consumeLoginAttempt } from '@/lib/auth-rate-limit';
import { createSession, isAllowedRequestOrigin, normalizeEmail, SESSION_COOKIE, sessionCookieOptions, verifyPassword } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  if (!isAllowedRequestOrigin(req.nextUrl, req.headers.get('origin'))) return NextResponse.json({ error: 'Origin request tidak diizinkan.' }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const password = typeof body.password === 'string' ? body.password : '';
  const key = `${email}\0${req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'}`;
  const rate = consumeLoginAttempt(key);
  if (!rate.allowed) return NextResponse.json({ error: 'Terlalu banyak percobaan login. Coba lagi nanti.' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((rate.resetAt - Date.now()) / 1000)) } });

  const user = email ? await db.user.findUnique({ where: { email } }) : null;
  const valid = user && !user.disabledAt ? await verifyPassword(password, user.passwordHash).catch(() => false) : false;
  if (!user || !valid) return NextResponse.json({ error: 'Email atau password tidak valid.' }, { status: 401 });

  clearLoginAttempts(key);
  const session = await createSession(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, session.token, sessionCookieOptions(session.expiresAt));
  return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
}
