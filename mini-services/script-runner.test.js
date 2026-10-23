import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { runnerRoot, caseDirectory, runDirectory, validateScript, writeJson, readJson, saveScript, enqueueScript, listRuns, cancelScript, runnerHealth } from '../src/lib/automation/script-store.mjs';
import { instrumentScript, scriptEnvironment, scriptOutcome, executeRun } from '../scripts/automation-runner.mjs';

const cleanups = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'traceva-runner-test-'));
  cleanups.push(() => fs.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }));
  await writeJson(path.join(root, 'heartbeat.json'), { updatedAt: Date.now(), busy: false });
  return root;
}
const input = { script: "import { test, expect } from '@playwright/test'; test('test', async ({ page }) => { await page.setContent('<h1>Ready</h1>'); await expect(page.locator('h1')).toHaveText('Ready'); });", timeoutSeconds: 15, baseURL: '' };

describe('trusted Playwright runner storage and boundaries', () => {
  it('distinguishes skipped, failed, timeout and cancelled runs without false passes', () => {
    expect(scriptOutcome(0, null)).toBe('FAILED');
    expect(scriptOutcome(0, { stats: { skipped: 2 } })).toBe('SKIPPED');
    expect(scriptOutcome(1, { suites: [{ specs: [{ tests: [{ results: [{ status: 'timedOut' }] }] }] }] })).toBe('TIMED_OUT');
    expect(scriptOutcome(0, { stats: { expected: 1 } }, 'CANCELLED')).toBe('CANCELLED');
  });
  it('uses durable absolute paths and rejects build output', () => {
    expect(runnerRoot({})).not.toContain('.next');
    expect(() => runnerRoot({ QA_SCRIPT_RUNNER_DIR: './relative' })).toThrow();
    expect(() => runnerRoot({ QA_SCRIPT_RUNNER_DIR: path.resolve('.next/runner') })).toThrow();
    expect(caseDirectory('/safe', '../../a', '../b')).toMatch(/cases[\\/][a-f0-9]{64}$/);
    expect(() => runDirectory('/safe', 'p', 'c', '../escape')).toThrow();
    expect(caseDirectory('/safe', 'p1', 'c')).not.toBe(caseDirectory('/safe', 'p2', 'c'));
  });
  it('validates script limits, timeout and URL without allowing URL credentials', () => {
    for (const value of [null, [], { ...input, script: '' }, { ...input, script: 'x'.repeat(100001) }, { ...input, timeoutSeconds: 0 }, { ...input, timeoutSeconds: 181 }, { ...input, baseURL: 'file:///secret' }, { ...input, baseURL: 'https://user:pass@example.com' }]) expect(() => validateScript(value)).toThrow();
    expect(validateScript(input)).toEqual(input);
  });
  it('does not pass database, relay, bootstrap or cloud tokens into script processes', () => {
    const env = scriptEnvironment({ PATH: '/bin', DATABASE_URL: 'secret', QA_RELAY_TOKEN: 'secret', QA_BOOTSTRAP_TOKEN: 'secret', TUNNEL_TOKEN: 'secret', NODE_OPTIONS: '--require evil' }, '/events', 123);
    expect(env.PATH).toBe('/bin');
    expect(JSON.stringify(env)).not.toContain('secret');
    expect(env.NODE_OPTIONS).toBeUndefined();
  });
  it('instruments real imports, not matching comments; fails clearly on unsupported scripts', () => {
    expect(instrumentScript(input.script, '/fixture.cjs')).toContain('from "/fixture.cjs"');
    expect(instrumentScript(`${input.script}\nconst expected = '@playwright/test';`, '/fixture.cjs')).toContain("const expected = '@playwright/test'");
    expect(() => instrumentScript('// @playwright/test\nawait page.goto("/")', '/fixture')).toThrow('import');
  });
  it('persists drafts independently and prevents duplicate active runs and cross-case reads', async () => {
    const root = await fixture();
    await saveScript(root, 'p', 'c', input);
    const run = await enqueueScript(root, 'p', 'c', 'Synthetic owner', input);
    expect((await listRuns(root, 'p', 'c'))[0].runId).toBe(run.runId);
    expect(await listRuns(root, 'other-project', 'c')).toEqual([]);
    // Recover the tiny crash window after queue commit, before history indexing.
    await fs.rm(path.join(caseDirectory(root, 'p', 'c'), 'history'), { recursive: true });
    await expect(enqueueScript(root, 'p', 'c', 'Owner', input)).rejects.toThrow('aktif');
    await cancelScript(root, 'p', 'c', run.runId);
    await executeRun(root, run);
    expect((await listRuns(root, 'p', 'c'))[0].status).toBe('CANCELLED');
    expect(await readJson(path.join(caseDirectory(root, 'p', 'c'), 'script.json'))).toMatchObject(input);
  });
  it('rejects offline startup and does not silently replay interrupted runs', async () => {
    const root = await fixture();
    const run = await enqueueScript(root, 'p', 'c', 'Owner', input);
    const file = path.join(runDirectory(root, 'p', 'c', run.runId), 'run.json');
    await writeJson(file, { ...run, status: 'RUNNING' });
    await executeRun(root, run);
    expect((await readJson(file)).status).toBe('INTERRUPTED');
    await fs.unlink(path.join(root, 'heartbeat.json'));
    expect((await runnerHealth(root)).online).toBe(false);
    await expect(enqueueScript(root, 'p', 'c', 'Owner', input)).rejects.toThrow('offline');
  });
});

// Real Chromium smoke tests use only a temporary folder and synthetic localhost server.
describe('Playwright runner real artifacts', () => {
  it('stops an owned running process without changing unrelated run records', async () => {
    const root = await fixture();
    const run = await enqueueScript(root, 'p', 'cancel-running', 'Owner', { ...input, script: "import { test } from '@playwright/test'; test('Wait', async ({page}) => { await page.setContent('<h1>Waiting</h1>'); await page.waitForTimeout(60000); });" });
    const execution = executeRun(root, run);
    const file = path.join(runDirectory(root, 'p', 'cancel-running', run.runId), 'events.jsonl');
    const until = Date.now() + 15000;
    while (Date.now() < until) {
      const events = await fs.readFile(file, 'utf8').catch(() => '');
      if (events.includes('Rekaman video dimulai')) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await cancelScript(root, 'p', 'cancel-running', run.runId);
    await execution;
    expect((await listRuns(root, 'p', 'cancel-running'))[0].status).toBe('CANCELLED');
    expect(await listRuns(root, 'unrelated', 'cancel-running')).toEqual([]);
  }, 40000);
  it('records passing video, trace, execution, console and network into one run', async () => {
    const root = await fixture();
    const server = http.createServer((req, res) => {
      if (req.url === '/api') { res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}'); }
      else { res.setHeader('Content-Type', 'text/html'); res.end('<h1>Ready</h1><button onclick="console.log(\'clicked\');fetch(\'/api\')">Run</button>'); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    cleanups.push(() => new Promise(resolve => server.close(resolve)));
    const run = await enqueueScript(root, 'p', 'c', 'Synthetic owner', { ...input, baseURL: `http://127.0.0.1:${server.address().port}`, script: "import { test, expect } from '@playwright/test'; test('Capture', async ({page}) => { await page.goto('/'); await page.getByRole('button', {name:'Run'}).click(); await expect(page.locator('h1')).toHaveText('Ready'); await page.waitForTimeout(300); });" });
    await executeRun(root, run);
    const directory = runDirectory(root, 'p', 'c', run.runId);
    const result = await readJson(path.join(directory, 'run.json'));
    expect(result, result.error).toMatchObject({ status: 'PASSED', projectId: 'p', testCaseId: 'c' });
    expect(result.artifacts.some(a => a.kind === 'video' && a.size > 0)).toBe(true);
    expect(result.artifacts.find(a => a.kind === 'video').startedAtRelativeMs).toBeGreaterThan(0);
    expect(result.artifacts.some(a => a.kind === 'trace' && a.size > 0)).toBe(true);
    const events = (await fs.readFile(path.join(directory, 'events.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
    expect(new Set(events.map(event => event.category))).toEqual(new Set(['execution', 'console', 'network']));
    expect(events.some(event => event.log === 'clicked')).toBe(true);
    expect(events.some(event => event.network?.url.endsWith('/api') && event.network.data.responseBody.includes('true'))).toBe(true);
  }, 45000);
  it('retains failing assertions, screenshots and video rather than reporting a false pass', async () => {
    const root = await fixture();
    const run = await enqueueScript(root, 'p', 'failed', 'Owner', { ...input, script: "import { test, expect } from '@playwright/test'; test('Fail intentionally', async ({page}) => { await page.setContent('<h1>Actual</h1>'); await expect(page.locator('h1')).toHaveText('Expected', {timeout:500}); });" });
    await executeRun(root, run);
    const result = (await listRuns(root, 'p', 'failed'))[0];
    expect(result.status).toBe('FAILED');
    expect(result.artifacts.some(a => a.kind === 'screenshot' && a.size > 0)).toBe(true);
    expect(result.artifacts.some(a => a.kind === 'video')).toBe(true);
  }, 45000);
});
