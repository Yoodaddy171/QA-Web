import fs from 'node:fs/promises';
import path from 'node:path';
import { readEventPage } from './event-page.mjs';
import { readJson, runDirectory } from './script-store.mjs';
import { MutationError } from '@/lib/services/mutation-error';

type Artifact = { id: string; file: string; kind: string; startedAtRelativeMs?: number };
/** Never fall back to another run when an explicitly selected result has disappeared. */
export async function studioReportSource(root: string, projectId: string, testCaseId: string, runId: string, artifactId?: string | null) {
  if (!/^[a-f0-9-]{36}$/.test(runId)) throw new MutationError(400, 'Run ID tidak valid.');
  const directory = runDirectory(root, projectId, testCaseId, runId);
  const run = await readJson(path.join(directory, 'run.json'));
  if (!run || run.runId !== runId || run.projectId !== projectId || run.testCaseId !== testCaseId) throw new MutationError(404, 'Run Studio yang dipilih tidak ditemukan. Muat ulang riwayat.');
  const artifacts: Artifact[] = run.artifacts || [];
  const video = artifactId ? artifacts.find(item => item.id === artifactId && item.kind === 'video') : artifacts.find(item => item.kind === 'video');
  if (artifactId && !video) throw new MutationError(404, 'Video yang dipilih tidak ditemukan dalam run ini.');
  const frames = artifacts.filter(item => item.kind === 'screenshot').slice(0, 8);
  const base = await fs.realpath(directory);
  for (const item of [...frames, ...(video ? [video] : [])]) {
    const target = await fs.realpath(path.resolve(directory, 'artifacts', item.file)).catch(() => null);
    if (!target) throw new MutationError(404, 'Artefak run tidak tersedia. Muat ulang riwayat.');
    if (!target.startsWith(`${base}${path.sep}`)) throw new MutationError(403, 'Lokasi artefak tidak diizinkan.');
  }
  const { events } = await readEventPage(path.join(directory, 'events.jsonl'), 0, 500);
  return {
    raw: events.map((event: unknown) => JSON.stringify(event)).join('\n'),
    recording: {
      metadata: {
        mode: video ? 'video' as const : 'frame' as const, sessionId: runId, testCaseId, targetUrl: run.baseURL || 'Playwright Studio',
        startedAt: run.startedAt || run.createdAt, stoppedAt: run.endedAt,
        frames: frames.map(item => ({ file: item.file, relativeMs: item.startedAtRelativeMs || 0 })),
        ...(video ? { video: { file: video.file, mimeType: 'video/webm', durationMs: run.durationMs, startedAtRelativeMs: video.startedAtRelativeMs ?? events.find((event: { event?: string }) => event.event === 'video.started')?.relativeMs ?? 0 } } : {}),
      }, framesDir: path.join(directory, 'artifacts'), videoDir: path.join(directory, 'artifacts'),
    },
  };
}
