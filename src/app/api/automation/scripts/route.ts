import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import path from 'node:path';
import { authorizeScriptRequest } from '@/lib/automation/script-auth';
import { MutationError } from '@/lib/services/mutation-error';
import { readEventPage } from '@/lib/automation/event-page.mjs';
import { runnerRoot, caseDirectory, runDirectory, readJson, runnerHealth, saveScript, enqueueScript, listRuns, cancelScript } from '@/lib/automation/script-store.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });


function publicRun(run: Record<string, unknown>) {
  return { ...run, artifacts: Array.isArray(run.artifacts) ? run.artifacts.map(({ file: _file, ...item }) => item) : [] };
}
async function handle(req: NextRequest) {
  try {
    const { root, projectId, testCaseId, actor } = await authorizeScriptRequest(req);
    const runId = req.nextUrl.searchParams.get('runId');
    if (req.method === 'GET') {
      if (!runId) return json({ health: await runnerHealth(root), script: await readJson(path.join(caseDirectory(root, projectId, testCaseId), 'script.json')), runs: (await listRuns(root, projectId, testCaseId)).map(publicRun) });
      if (!/^[a-f0-9-]{36}$/.test(runId)) throw new MutationError(400, 'Run ID tidak valid.');
      const directory = runDirectory(root, projectId, testCaseId, runId);
      const run = await readJson(path.join(directory, 'run.json'));
      if (!run || run.projectId !== projectId || run.testCaseId !== testCaseId) throw new MutationError(404, 'Run tidak ditemukan.');
      const artifactId = req.nextUrl.searchParams.get('artifact');
      if (artifactId) {
        const artifact = run.artifacts.find((item: { id: string }) => item.id === artifactId);
        if (!artifact) throw new MutationError(404, 'Artefak tidak ditemukan.');
        const base = await fs.realpath(directory);
        const target = await fs.realpath(path.resolve(directory, 'artifacts', artifact.file));
        if (!target.startsWith(`${base}${path.sep}`)) throw new MutationError(403, 'Path artefak tidak diizinkan.');
        const stat = await fs.stat(target);
        const range = req.headers.get('range');
        let start = 0, end = stat.size - 1;
        if (range) {
          const match = /^bytes=(\d+)-(\d*)$/.exec(range);
          if (!match) return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
          start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end;
          if (start > end || start >= stat.size) return new NextResponse(null, { status: 416, headers: { 'Content-Range': `bytes */${stat.size}` } });
        }
        const headers = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Accept-Ranges': 'bytes', 'Content-Type': artifact.kind === 'video' ? 'video/webm' : artifact.kind === 'screenshot' ? 'image/png' : 'application/zip', 'Content-Length': String(end - start + 1) });
        if (range) headers.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);
        if (artifact.kind === 'trace') headers.set('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(artifact.name)}`);
        return new NextResponse(Readable.toWeb(createReadStream(target, { start, end })) as ReadableStream, { status: range ? 206 : 200, headers });
      }
      const cursor = Math.max(0, Number(req.nextUrl.searchParams.get('cursor') || 0));
      if (!Number.isSafeInteger(cursor)) throw new MutationError(400, 'Cursor tidak valid.');
      return json({ run: publicRun(run), ...await readEventPage(path.join(directory, 'events.jsonl'), cursor) });
    }
    const input = await req.json().catch(() => { throw new MutationError(400, 'Body JSON tidak valid.'); });
    if (req.method === 'PUT') return json({ script: await saveScript(root, projectId, testCaseId, input) });
    if (req.method === 'POST') return json({ run: publicRun(await enqueueScript(root, projectId, testCaseId, actor, input)) }, 202);
    if (req.method === 'DELETE') {
      if (!runId || !/^[a-f0-9-]{36}$/.test(runId)) throw new MutationError(400, 'Run ID tidak valid.');
      return json({ run: publicRun(await cancelScript(root, projectId, testCaseId, runId)), message: 'Permintaan Stop diterima.' });
    }
    return json({ error: 'Metode tidak didukung.' }, 405);
  } catch (error) {
    if (error instanceof MutationError) return json({ error: error.message }, error.status);
    const message = error instanceof Error ? error.message : '';
    if (/^(Script wajib|Batas waktu|Base URL|Runner offline|Permintaan run|Antrean penuh|Testcase ini masih)/.test(message)) return json({ error: message }, /offline|Antrean|aktif|Permintaan/.test(message) ? 409 : 400);
    console.error('Automation script request failed', { name: error instanceof Error ? error.name : 'unknown' });
    return json({ error: 'Gagal memproses automation. Periksa runner dan penyimpanan artefak.' }, 500);
  }
}
export const GET = handle;
export const PUT = handle;
export const POST = handle;
export const DELETE = handle;
