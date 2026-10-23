import fs from 'node:fs/promises';
import path from 'node:path';
import storagePaths from './data-storage-path.cjs';

const paths = storagePaths.runtimePaths(process.env, process.env.QA_LEGACY_LOGS_DIR || path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'mini-services', 'logs'));
const recordingRoots = [
  paths.recordings,
  path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'mini-services', 'recordings'),
];
const logsRoot = paths.logs;

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
