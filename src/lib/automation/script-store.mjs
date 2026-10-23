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
export async function listRuns(root, projectId, testCaseId) {
  const directory = caseDirectory(root, projectId, testCaseId);
  const names = await fs.readdir(path.join(directory, 'history')).catch(error => { if (error.code === 'ENOENT') return []; throw error; });
  const entries = await Promise.all(names.filter(name => /^\d+-[a-f0-9-]{36}\.json$/.test(name)).sort().reverse().slice(0, 20).map(name => readJson(path.join(directory, 'history', name))));
  return (await Promise.all(entries.filter(Boolean).map(item => readJson(path.join(runDirectory(root, projectId, testCaseId, item.runId), 'run.json'))))).filter(Boolean);
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
