import os from 'node:os';
import path from 'node:path';
import storagePaths from './data-storage-path.cjs';

/** Reject build output even for explicit configuration; it is disposable. */
export function assertDurableEvidenceRoot(root) {
  if (!path.isAbsolute(root)) throw new Error('Evidence storage harus menggunakan path absolut.');
  if (root.split(/[\\/]+/).some(part => part.toLowerCase() === '.next')) {
    throw new Error('Evidence storage tidak boleh berada di dalam .next. Atur QA_EVIDENCE_STORAGE_DIR ke direktori permanen di luar hasil build.');
  }
  return path.resolve(root);
}

/**
 * No process.cwd() fallback: standalone changes cwd into the build directory.
 * @param {Record<string, string | undefined>} env
 * @param {string} home
 */
export function resolveEvidenceStorageRoot(env = process.env, home = os.homedir()) {
  const configured = env.QA_EVIDENCE_STORAGE_DIR?.trim();
  if (configured) return assertDurableEvidenceRoot(configured);
  if (env.QA_DATA_DIR?.trim()) return assertDurableEvidenceRoot(path.join(storagePaths.dataRoot(env, home), 'evidence'));
  const runtime = env.QA_RUNTIME_DIR?.trim();
  if (runtime) return assertDurableEvidenceRoot(path.join(assertDurableEvidenceRoot(runtime), 'execution-evidence'));
  const dataHome = env.LOCALAPPDATA || env.XDG_DATA_HOME || path.join(home, '.local', 'share');
  return assertDurableEvidenceRoot(path.join(dataHome, 'QADesk', 'evidence'));
}
