import { NextRequest, NextResponse } from 'next/server';
import { consumeLoginAttempt } from '@/lib/auth-rate-limit';
import { isAllowedRequestOrigin, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth';
import { redeemGuestAccess } from '@/lib/services/guest-access-service';
import { mutationFailure } from '@/lib/services/mutation-error';

export async function POST(req: NextRequest) {
  if (!isAllowedRequestOrigin(req.nextUrl, req.headers.get('origin'), req.headers.get('host'))) return NextResponse.json({ error: 'Origin request tidak diizinkan.' }, { status: 403 });
  const rate = consumeLoginAttempt(`guest:${req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local'}`, Date.now(), 10);
  const globalRate = consumeLoginAttempt('guest:global', Date.now(), 200);
  if (!rate.allowed || !globalRate.allowed) return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba lagi nanti.' }, { status: 429, headers: { 'Retry-After': String(Math.ceil((Math.max(rate.resetAt, globalRate.resetAt) - Date.now()) / 1000)) } });
  try {
    if (Number(req.headers.get('content-length') || 0) > 2048) return NextResponse.json({ error: 'Request terlalu besar.' }, { status: 413 });
    const reader = req.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'Token wajib diisi.' }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > 2048) { await reader.cancel(); return NextResponse.json({ error: 'Request terlalu besar.' }, { status: 413 }); }
        chunks.push(chunk.value);
      }
    } finally { reader.releaseLock(); }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { return NextResponse.json({ error: 'Format request tidak valid.' }, { status: 400 }); }
    const result = await redeemGuestAccess(body && typeof body === 'object' && 'token' in body ? body.token : null);
    const response = NextResponse.json({ projectId: result.projectId, expiresAt: result.expiresAt }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(SESSION_COOKIE, result.token, sessionCookieOptions(result.expiresAt));
    return response;
  } catch (error) { const failure = mutationFailure(error, 'Redeem guest access', 'Gagal menukar token.'); return NextResponse.json({ error: failure.error }, { status: failure.status, headers: { 'Cache-Control': 'no-store' } }); }
}
