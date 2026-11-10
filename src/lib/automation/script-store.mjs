import fs from 'node:fs/promises';
import path from 'node:path';
import storagePaths from '../storage/data-storage-path.cjs';
import crypto from 'node:crypto';

export const ACTIVE_SCRIPT_STATES = ['QUEUED', 'RUNNING'];
export function runnerRoot(env = process.env) {
  const root = env.QA_SCRIPT_RUNNER_DIR || path.join(storagePaths.dataRoot(env), 'automation');
  if (!path.isAbsolute(root) || root.split(/[\\/]/).some(part => part.toLowerCase() === '.next')) throw new Error('QA_SCRIPT_RUNNER_DIR harus absolut dan di luar .next.');
  return path.resolve(root);
}
export function caseDirectory(root, projectId, testCaseId) {
  if (!projectId || !testCaseId) throw new Error('Project dan testcase wajib diisi.');
  return path.join(root, 'cases', crypto.createHash('sha256').update(JSON.stringify([projectId, testCaseId])).digest('hex'));
}
export function runDirectory(root, projectId, testCaseId, runId) {
  if (!/^[a-f0-9-]{36}$/.test(runId)) throw new Error('Run ID tidak valid.');
  return path.join(caseDirectory(root, projectId, testCaseId), 'runs', runId);
}
export async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}
export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  try { await fs.writeFile(temp, JSON.stringify(value), { mode: 0o600 }); await fs.rename(temp, file); }
  finally { await fs.unlink(temp).catch(() => {}); }
}
export function validateScript(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Script wajib berupa objek konfigurasi yang valid.');
  if (typeof input.script !== 'string' || !input.script.trim() || Buffer.byteLength(input.script) > 100_000) throw new Error('Script wajib diisi, maksimal 100 KB.');
  const timeoutSeconds = Number(input.timeoutSeconds ?? 60);
  if (!Number.isInteger(timeoutSeconds) || timeoutSeconds < 10 || timeoutSeconds > 180) throw new Error('Batas waktu harus 10–180 detik.');
  const baseURL = String(input.baseURL || '').trim();
  if (baseURL) {
    let parsed;
    try { parsed = new URL(baseURL); } catch { throw new Error('Base URL tidak valid.'); }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Base URL harus HTTP/HTTPS tanpa kredensial.');
  }
  return { script: input.script, timeoutSeconds, baseURL };
}
export async function runnerHealth(root) {
  const heartbeat = await readJson(path.join(root, 'heartbeat.json'));
  return { online: Boolean(heartbeat && Date.now() - heartbeat.updatedAt < 8000), busy: Boolean(heartbeat?.busy), version: 1 };
}
export async function saveScript(root, projectId, testCaseId, input) {
  const value = { ...validateScript(input), updatedAt: new Date().toISOString() };
  await writeJson(path.join(caseDirectory(root, projectId, testCaseId), 'script.json'), value);
  return value;
}
export async function listRuns(root, projectId, testCaseId, limit = 20) {
  const directory = caseDirectory(root, projectId, testCaseId);
  const names = await fs.readdir(path.join(directory, 'history')).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  const runs = [];
  const seen = new Set();
  for (const name of names.filter(name => /^\d+-[a-f0-9-]{36}\.json$/.test(name)).sort().reverse()) {
    const item = await readJson(path.join(directory, 'history', name));
    if (!item || typeof item.runId !== 'string' || !/^[a-f0-9-]{36}$/.test(item.runId) || seen.has(item.runId)) continue;
    const run = await readJson(path.join(runDirectory(root, projectId, testCaseId, item.runId), 'run.json'));
    if (run && run.runId === item.runId && run.projectId === projectId && run.testCaseId === testCaseId) {
      seen.add(item.runId);
      runs.push(run);
    }
    if (runs.length >= Math.max(1, Math.min(20, limit))) break;
  }
  return runs;
}

function projectIndexDirectory(root, projectId) {
  return path.join(root, 'history-index-v1', crypto.createHash('sha256').update(projectId).digest('hex'));
}
export async function registerStudioCase(root, projectId, testCaseId) {
  const key = path.basename(caseDirectory(root, projectId, testCaseId));
  await writeJson(path.join(projectIndexDirectory(root, projectId), `${key}.json`), { projectId, testCaseId });
}
export async function indexedStudioCaseIds(root, projectId, authorizedIds) {
  const directory = projectIndexDirectory(root, projectId);
  const ready = await readJson(path.join(directory, 'ready.json'));
  if (!ready || ready.projectId !== projectId || ready.version !== 1) {
    // One compatibility scan, not one scan per request. Admission writes independent
    // case markers, so concurrent enqueue cannot be lost by a manifest overwrite.
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(8, authorizedIds.length) }, async () => {
      while (next < authorizedIds.length) {
        const id = authorizedIds[next++];
        if ((await listRuns(root, projectId, id, 1)).length) await registerStudioCase(root, projectId, id);
      }
    }));
    await writeJson(path.join(directory, 'ready.json'), { projectId, version: 1 });
  }
  const allowed = new Set(authorizedIds);
  const names = await fs.readdir(directory);
  const ids = new Set();
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(8, names.length) }, async () => {
    while (next < names.length) {
      const name = names[next++];
      if (!/^[a-f0-9]{64}\.json$/.test(name)) continue;
      const marker = await readJson(path.join(directory, name));
      if (marker?.projectId === projectId && allowed.has(marker.testCaseId)) ids.add(marker.testCaseId);
    }
  }));
  return [...ids];
}
export async function enqueueScript(root, projectId, testCaseId, actor, input) {
  const script = validateScript(input);
  if (!(await runnerHealth(root)).online) throw new Error('Runner offline. Jalankan npm run automation:runner di mesin Traceva.');
  const directory = caseDirectory(root, projectId, testCaseId);
  await fs.mkdir(directory, { recursive: true });
  // Global admission lock keeps the queue limit correct across different cases.
  const lock = path.join(root, '.enqueue-lock');
  try { await fs.mkdir(lock); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const owner = await readJson(path.join(lock, 'owner.json'));
    let stale = false;
    if (owner?.pid) { try { process.kill(owner.pid, 0); } catch (cause) { stale = cause.code === 'ESRCH'; } }
    else stale = Date.now() - (await fs.stat(lock)).mtimeMs > 30000;
    if (!stale) throw new Error('Permintaan run lain sedang diproses. Coba kembali.');
    await fs.unlink(path.join(lock, 'owner.json')).catch(cause => { if (cause.code !== 'ENOENT') throw cause; });
    await fs.rmdir(lock);
    try { await fs.mkdir(lock); } catch { throw new Error('Permintaan run lain sedang diproses. Coba kembali.'); }
  }
  try {
    await writeJson(path.join(lock, 'owner.json'), { pid: process.pid });
    const queue = await fs.readdir(path.join(root, 'queue')).catch(() => []);
    if (queue.length >= 10) throw new Error('Antrean penuh (maksimal 10 run). Tunggu run sebelumnya selesai.');
    const pending = await Promise.all(queue.filter(name => /^\d+-[a-f0-9-]{36}\.json$/.test(name)).map(name => readJson(path.join(root, 'queue', name))));
    for (const pointer of pending) {
      if (pointer?.projectId === projectId && pointer?.testCaseId === testCaseId) {
        const existing = await readJson(path.join(runDirectory(root, projectId, testCaseId, pointer.runId), 'run.json'));
        if (existing && ACTIVE_SCRIPT_STATES.includes(existing.status)) throw new Error('Testcase ini masih memiliki run aktif. Hentikan atau tunggu hingga selesai.');
      }
    }
    if ((await listRuns(root, projectId, testCaseId)).some(run => ACTIVE_SCRIPT_STATES.includes(run.status))) throw new Error('Testcase ini masih memiliki run aktif. Hentikan atau tunggu hingga selesai.');
    const runId = crypto.randomUUID();
    const now = Date.now();
    const run = { runId, projectId, testCaseId, status: 'QUEUED', createdAt: new Date(now).toISOString(), startedAt: null, endedAt: null, actor, timeoutSeconds: script.timeoutSeconds, baseURL: script.baseURL, artifacts: [], error: null };
    const runDir = runDirectory(root, projectId, testCaseId, runId);
    await writeJson(path.join(runDir, 'input.json'), script);
    await writeJson(path.join(runDir, 'run.json'), run);
    const pointer = { projectId, testCaseId, runId };
    await writeJson(path.join(root, 'queue', `${now}-${runId}.json`), pointer);
    await writeJson(path.join(directory, 'history', `${now}-${runId}.json`), pointer);
    await registerStudioCase(root, projectId, testCaseId);
    return run;
  } finally { await fs.unlink(path.join(lock, 'owner.json')).catch(() => {}); await fs.rmdir(lock).catch(() => {}); }
}
export async function cancelScript(root, projectId, testCaseId, runId) {
  const directory = runDirectory(root, projectId, testCaseId, runId);
  const run = await readJson(path.join(directory, 'run.json'));
  if (!run) throw new Error('Run tidak ditemukan.');
  if (ACTIVE_SCRIPT_STATES.includes(run.status)) await writeJson(path.join(directory, 'cancel.json'), { requestedAt: new Date().toISOString() });
  return run;
}

export class ScriptHistoryError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const TERMINAL_SCRIPT_STATES = new Set(['PASSED', 'FAILED', 'CANCELLED', 'INTERRUPTED', 'TIMED_OUT', 'RESOURCE_LIMIT', 'SKIPPED']);

// Refuse linked ancestors: a hashed case directory must not redirect deletion elsewhere.
async function unlinkedPath(root, destination) {
  const relative = path.relative(path.resolve(root), path.resolve(destination));
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new ScriptHistoryError(400, 'Lokasi riwayat tidak valid.');
  let current = path.resolve(root);
  for (const segment of ['', ...relative.split(path.sep)]) {
    if (segment) current = path.join(current, segment);
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new ScriptHistoryError(409, 'Folder riwayat berupa link. Penghapusan ditolak.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
}

export async function deleteScriptRuns(root, projectId, testCaseId, runIds) {
  if (!Array.isArray(runIds) || runIds.length < 1 || runIds.length > 20 || new Set(runIds).size !== runIds.length
    || runIds.some(id => typeof id !== 'string' || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(id))) {
    throw new ScriptHistoryError(400, 'Pilih 1–20 run unik dengan ID yang valid.');
  }
  const directory = caseDirectory(root, projectId, testCaseId);
  await unlinkedPath(root, directory);
  const lock = path.join(directory, '.history-delete-lock');
  await unlinkedPath(root, lock);
  try { await fs.mkdir(lock); }
  catch (error) {
    if (error.code === 'EEXIST') {
      const owner = await readJson(path.join(lock, 'owner.json'));
      let stale = false;
      if (owner?.pid) { try { process.kill(owner.pid, 0); } catch (cause) { stale = cause.code === 'ESRCH'; } }
      else stale = Date.now() - (await fs.stat(lock)).mtimeMs > 30000;
      if (!stale) throw new ScriptHistoryError(409, 'Penghapusan lain sedang diproses. Muat ulang riwayat sebelum mencoba lagi.');
      await fs.unlink(path.join(lock, 'owner.json')).catch(cause => { if (cause.code !== 'ENOENT') throw cause; });
      await fs.rmdir(lock);
      try { await fs.mkdir(lock); } catch { throw new ScriptHistoryError(409, 'Penghapusan lain sedang diproses. Muat ulang riwayat.'); }
    }
    else if (error.code === 'ENOENT') throw new ScriptHistoryError(404, 'Riwayat tidak ditemukan.');
    else throw error;
  }
  try {
    await writeJson(path.join(lock, 'owner.json'), { pid: process.pid });
    const queueNames = await fs.readdir(path.join(root, 'queue')).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    const queued = await Promise.all(queueNames.filter(name => /^\d+-[a-f0-9-]{36}\.json$/.test(name)).map(name => readJson(path.join(root, 'queue', name))));
    const history = await fs.readdir(path.join(directory, 'history')).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
    // Validate the whole batch before removing anything. Unknown states fail closed.
    for (const id of runIds) {
      const runDir = runDirectory(root, projectId, testCaseId, id);
      await unlinkedPath(root, runDir);
      await unlinkedPath(root, path.join(runDir, 'run.json'));
      const run = await readJson(path.join(runDir, 'run.json'));
      if (!run || run.runId !== id || run.projectId !== projectId || run.testCaseId !== testCaseId) throw new ScriptHistoryError(404, 'Salah satu run tidak ditemukan dalam testcase ini. Muat ulang riwayat.');
      if (!TERMINAL_SCRIPT_STATES.has(run.status) || queued.some(item => item?.runId === id && item.projectId === projectId && item.testCaseId === testCaseId)) {
        throw new ScriptHistoryError(409, 'Run masih aktif atau sedang difinalisasi. Stop lalu tunggu sampai selesai sebelum menghapus.');
      }
    }
    const deletedRunIds = [];
    const failedRunIds = [];
    for (const id of runIds) {
      try {
        // runDir is derived from validated UUIDs and checked above, never from artifact metadata.
        await fs.rm(runDirectory(root, projectId, testCaseId, id), { recursive: true, force: false, maxRetries: 2, retryDelay: 100 });
        deletedRunIds.push(id);
        for (const name of history.filter(name => new RegExp(`^\\d+-${id}\\.json$`).test(name))) {
          const pointer = path.join(directory, 'history', name);
          await unlinkedPath(root, pointer);
          await fs.unlink(pointer).catch(error => { if (error.code !== 'ENOENT') throw error; });
        }
      } catch { if (!deletedRunIds.includes(id)) failedRunIds.push(id); }
    }
    // Retain a small case marker, not a copied run. Readers re-read run metadata;
    // an empty/deleted history produces no row, and concurrent enqueue stays visible.
    if (deletedRunIds.length) await registerStudioCase(root, projectId, testCaseId);
    return { deletedRunIds, failedRunIds };
  } finally { await fs.unlink(path.join(lock, 'owner.json')).catch(error => { if (error.code !== 'ENOENT') throw error; }); await fs.rmdir(lock); }
}
