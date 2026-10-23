import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runnerRoot, readJson, writeJson, runDirectory } from '../src/lib/automation/script-store.mjs';

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export function scriptEnvironment(env, events, startedAt) {
  const safe = {};
  for (const key of ['PATH', 'Path', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA', 'PLAYWRIGHT_BROWSERS_PATH']) if (env[key]) safe[key] = env[key];
  // Explicit test-only credentials; never forward application/session secrets.
  for (const [key, value] of Object.entries(env)) if (/^TRACEVA_TEST_[A-Z0-9_]+$/.test(key) && value !== undefined) safe[key] = value;
  return { ...safe, NODE_PATH: path.join(projectRoot, 'node_modules'), TRACEVA_RUN_EVENTS: events, TRACEVA_RUN_STARTED: String(startedAt), FORCE_COLOR: '0' };
}

export function instrumentScript(source, fixture) {
  const ts = require('typescript');
  const ast = ts.createSourceFile('test.spec.ts', source, ts.ScriptTarget.Latest, true);
  const ranges = [];
  const walk = node => {
    if (ts.isStringLiteral(node) && node.text === '@playwright/test') {
      const parent = node.parent;
      const moduleDeclaration = (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) && parent.moduleSpecifier === node;
      const moduleCall = ts.isCallExpression(parent) && parent.arguments[0] === node && ((ts.isIdentifier(parent.expression) && parent.expression.text === 'require') || parent.expression.kind === ts.SyntaxKind.ImportKeyword);
      if (moduleDeclaration || moduleCall) ranges.push([node.getStart(ast), node.end]);
    }
    ts.forEachChild(node, walk);
  };
  walk(ast);
  if (!ranges.length) throw new Error("Gunakan script Playwright Test dengan import { test, expect } from '@playwright/test'.");
  for (const [start, end] of ranges.reverse()) source = source.slice(0, start) + JSON.stringify(fixture.replaceAll('\\', '/')) + source.slice(end);
  return source;
}

export function scriptOutcome(code, report, reason = null) {
  if (reason) return reason;
  const timedOut = suite => suite.specs?.some(spec => spec.tests?.some(test => test.results?.some(result => result.status === 'timedOut'))) || suite.suites?.some(timedOut);
  if (report && (timedOut(report) || report.errors?.some(error => /global timeout|timed out waiting.*entire test/i.test(error.message || '')))) return 'TIMED_OUT';
  const stats = report?.stats;
  if (stats?.unexpected > 0 || stats?.flaky > 0) return 'FAILED';
  if (stats?.expected > 0 && code === 0) return 'PASSED';
  if (stats?.skipped > 0 && code === 0) return 'SKIPPED';
  return 'FAILED';
}

async function killTree(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    await new Promise(resolve => {
      const killer = spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      killer.once('error', resolve); killer.once('close', resolve);
    });
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
  }
}

async function collectArtifacts(directory, relative = '', depth = 0) {
  if (depth > 5) return [];
  const results = [];
  for (const item of await fs.readdir(path.join(directory, relative), { withFileTypes: true }).catch(() => [])) {
    const filename = path.join(relative, item.name);
    if (item.isSymbolicLink()) continue;
    if (item.isDirectory()) results.push(...await collectArtifacts(directory, filename, depth + 1));
    else if (/\.(webm|png|zip)$/.test(item.name)) {
      const size = (await fs.stat(path.join(directory, filename))).size;
      if (!size) continue;
      results.push({ id: `artifact-${results.length}-${Buffer.from(filename).toString('base64url')}`, name: item.name, file: filename, size, kind: item.name.endsWith('.webm') ? 'video' : item.name.endsWith('.png') ? 'screenshot' : 'trace' });
    }
    if (results.length >= 80) break;
  }
  return results.slice(0, 80);
}

/** One trusted script process at a time. This is process separation, not a sandbox. */
export async function executeRun(root, pointer, options = {}) {
  const directory = runDirectory(root, pointer.projectId, pointer.testCaseId, pointer.runId);
  const file = path.join(directory, 'run.json');
  let run = await readJson(file);
  if (run) await writeJson(path.join(directory, '..', '..', 'history', `${new Date(run.createdAt).getTime()}-${pointer.runId}.json`), pointer);
  if (!run || !['QUEUED', 'RUNNING'].includes(run.status)) return;
  if (run.status === 'RUNNING') { await writeJson(file, { ...run, status: 'INTERRUPTED', endedAt: new Date().toISOString(), error: 'Runner berhenti pada eksekusi sebelumnya. Jalankan ulang secara manual.' }); return; }
  if (await readJson(path.join(directory, 'cancel.json'))) { await writeJson(file, { ...run, status: 'CANCELLED', endedAt: new Date().toISOString() }); return; }
  const startedAt = Date.now();
  run = { ...run, status: 'RUNNING', startedAt: new Date(startedAt).toISOString() };
  await writeJson(file, run);
  let child;
  let monitor;
  let reason = null;
  try {
    const input = await readJson(path.join(directory, 'input.json'));
    const spec = instrumentScript(input.script, path.join(projectRoot, 'mini-services/script-fixture.cjs'));
    await fs.writeFile(path.join(directory, 'test.spec.ts'), spec, { mode: 0o600 });
    const config = { testDir: directory, testMatch: 'test.spec.ts', outputDir: path.join(directory, 'artifacts'), workers: 1, fullyParallel: false, retries: 0, forbidOnly: true,
      timeout: input.timeoutSeconds * 1000, globalTimeout: input.timeoutSeconds * 1000 + 10000,
      reporter: [[path.join(projectRoot, 'mini-services/script-reporter.cjs')], ['json', { outputFile: path.join(directory, 'results.json') }]],
      use: { browserName: 'chromium', headless: true, viewport: { width: 1280, height: 720 }, video: 'on', screenshot: 'only-on-failure', trace: 'on', ...(input.baseURL ? { baseURL: input.baseURL } : {}) },
    };
    await fs.writeFile(path.join(directory, 'playwright.config.cjs'), `module.exports = ${JSON.stringify(config)};`);
    child = spawn(process.execPath, [require.resolve('@playwright/test/cli'), 'test', '--config', path.join(directory, 'playwright.config.cjs')], {
      cwd: directory, env: scriptEnvironment(process.env, path.join(directory, 'events.jsonl'), startedAt), windowsHide: true, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], shell: false,
    });
    let output = '';
    child.stdout.on('data', chunk => { output = (output + chunk).slice(-12000); });
    child.stderr.on('data', chunk => { output = (output + chunk).slice(-12000); });
    let checking = false;
    monitor = setInterval(async () => {
      if (checking || reason) return;
      checking = true;
      try {
        if (options.stopping?.()) reason = 'INTERRUPTED';
        else if (await readJson(path.join(directory, 'cancel.json'))) reason = 'CANCELLED';
        else if (Date.now() - startedAt > (input.timeoutSeconds + 15) * 1000) reason = 'TIMED_OUT';
        else if ((await collectArtifacts(path.join(directory, 'artifacts'))).reduce((n, item) => n + item.size, 0) > 250_000_000) reason = 'RESOURCE_LIMIT';
        if (reason) await killTree(child);
      } finally { checking = false; }
    }, 500);
    const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
    const report = await readJson(path.join(directory, 'results.json'));
    const stats = report?.stats;
    const status = scriptOutcome(code, report, reason);
    const artifacts = await collectArtifacts(path.join(directory, 'artifacts'));
    const events = (await fs.readFile(path.join(directory, 'events.jsonl'), 'utf8').catch(() => '')).split('\n').flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    for (const artifact of artifacts.filter(item => item.kind === 'video')) {
      const saved = events.find(event => event.event === 'video.saved' && event.metadata?.file === artifact.file);
      const started = events.find(event => event.event === 'video.started' && event.metadata?.testId === saved?.metadata?.testId && event.metadata?.videoIndex === saved?.metadata?.videoIndex);
      if (started) artifact.startedAtRelativeMs = started.relativeMs;
    }
    const errors = { CANCELLED: 'Dihentikan oleh pengguna.', INTERRUPTED: 'Runner dihentikan.', TIMED_OUT: 'Batas waktu eksekusi terlampaui.', RESOURCE_LIMIT: 'Artefak melebihi batas 250 MB.' };
    await writeJson(file, { ...run, status, endedAt: new Date().toISOString(), durationMs: Date.now() - startedAt, artifacts, stats: stats || null,
      error: errors[status] || (status === 'FAILED' ? output.replace(/\u001b\[[0-9;]*m/g, '').slice(-4000) || 'Pengujian gagal. Buka Console untuk melihat assertion/error.' : null) });
  } catch (error) {
    await killTree(child);
    await writeJson(file, { ...run, status: 'FAILED', endedAt: new Date().toISOString(), error: error.message, artifacts: await collectArtifacts(path.join(directory, 'artifacts')) });
  } finally { clearInterval(monitor); }
}

export async function startWorker(root = runnerRoot()) {
  await fs.mkdir(root, { recursive: true });
  const lock = path.join(root, 'worker.lock');
  const existing = await readJson(lock);
  if (existing) {
    let alive = true;
    try { process.kill(existing.pid, 0); } catch (error) { alive = error.code !== 'ESRCH'; }
    if (alive) throw new Error('Runner lain masih berjalan. Hanya satu runner diperbolehkan.');
    await fs.unlink(lock);
  }
  const handle = await fs.open(lock, 'wx');
  await handle.writeFile(JSON.stringify({ pid: process.pid })); await handle.close();
  await fs.mkdir(path.join(root, 'queue'), { recursive: true });
  let stopping = false;
  let busy = false;
  const stop = () => { stopping = true; };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  const beat = () => writeJson(path.join(root, 'heartbeat.json'), { pid: process.pid, updatedAt: Date.now(), busy }).catch(() => {});
  await beat();
  const heartbeat = setInterval(beat, 2000);
  console.log('Traceva Playwright runner siap. Script tepercaya saja; bukan sandbox. Ctrl+C untuk berhenti.');
  try {
    while (!stopping) {
      const queue = (await fs.readdir(path.join(root, 'queue'))).filter(name => /^\d+-[a-f0-9-]{36}\.json$/.test(name)).sort();
      for (const name of queue) {
        if (stopping) break;
        const pointer = await readJson(path.join(root, 'queue', name));
        busy = true; await beat();
        try { if (pointer) await executeRun(root, pointer, { stopping: () => stopping }); }
        catch (error) { console.error('Run ditolak:', error.message); }
        finally { await fs.unlink(path.join(root, 'queue', name)).catch(() => {}); busy = false; await beat(); }
      }
      await sleep(500);
    }
  } finally {
    clearInterval(heartbeat); process.off('SIGINT', stop); process.off('SIGTERM', stop);
    await fs.unlink(path.join(root, 'heartbeat.json')).catch(() => {});
    await fs.unlink(lock).catch(() => {});
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) startWorker().catch(error => { console.error(error.message); process.exitCode = 1; });
