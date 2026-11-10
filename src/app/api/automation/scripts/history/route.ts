import { NextRequest, NextResponse } from 'next/server';
import { authorizeScriptRequest } from '@/lib/automation/script-auth';
import { deleteScriptRuns, ScriptHistoryError } from '@/lib/automation/script-store.mjs';
import { MutationError } from '@/lib/services/mutation-error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function DELETE(req: NextRequest) {
  const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
  try {
    // Kept explicit for MCP query discovery; authorization validates both values.
    req.nextUrl.searchParams.get('projectId');
    req.nextUrl.searchParams.get('testCaseId');
    const { root, projectId, testCaseId } = await authorizeScriptRequest(req);
    const text = await req.text();
    if (Buffer.byteLength(text) > 8192) return json({ error: 'Permintaan hapus terlalu besar. Maksimal 20 run.' }, 413);
    let body;
    try { body = JSON.parse(text); } catch { throw new MutationError(400, 'Body JSON tidak valid.'); }
    if (body?.confirmed !== true) throw new MutationError(400, 'Konfirmasi penghapusan diperlukan.');
    const result = await deleteScriptRuns(root, projectId, testCaseId, body.runIds);
    return json(result);
  } catch (error) {
    if (error instanceof MutationError || error instanceof ScriptHistoryError) return json({ error: error.message }, error.status);
    console.error('Script history deletion failed', { name: error instanceof Error ? error.name : 'unknown' });
    return json({ error: 'Riwayat belum berhasil dihapus. Muat ulang untuk memeriksa hasil sebelum mencoba lagi.' }, 500);
  }
}
