import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const runtimeDir = path.resolve(/*turbopackIgnore: true*/ process.env.QA_RUNTIME_DIR || path.join(/*turbopackIgnore: true*/ process.env.LOCALAPPDATA || os.tmpdir(), 'web-qa-runtime'));
const recordingRoots = [
  path.join(/*turbopackIgnore: true*/ runtimeDir, 'recordings'),
  path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'mini-services', 'recordings'),
];
const logsRoot = path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'mini-services', 'logs');

function assertInside(roots: string[], candidate: string) {
  const target = path.resolve(/*turbopackIgnore: true*/ candidate);
  const allowed = roots.some(root => {
    const relative = path.relative(root, target);
    return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
  });
  if (!allowed) throw new Error('Runtime artifact berada di luar storage root yang diizinkan.');
  return target;
}

export async function deleteRecordingDirectory(candidate: string) {
  await fs.rm(assertInside(recordingRoots, candidate), { recursive: true, force: true });
}

export async function cleanupProjectRuntimeArtifacts(entityIds: string[]) {
  for (const id of new Set(entityIds)) {
    const encoded = encodeURIComponent(id);
    await Promise.all(recordingRoots.map(root => fs.rm(path.join(/*turbopackIgnore: true*/ root, encoded), { recursive: true, force: true })));
    await Promise.all(['current', 'previous'].map(kind => fs.rm(path.join(/*turbopackIgnore: true*/ logsRoot, `${encoded}.${kind}.jsonl`), { force: true })));
    await fs.rm(path.join(/*turbopackIgnore: true*/ logsRoot, `${encoded}.jsonl`), { force: true });
  }
}
