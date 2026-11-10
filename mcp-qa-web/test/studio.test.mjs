import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { buildCatalog } from '../catalog.mjs';
import { briefContract, compactCatalog, guide, selectOperation } from '../compact.mjs';
import { DeletionGuard } from '../guard.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const catalog = buildCatalog(root);
const methods = ['GET', 'PUT', 'POST', 'DELETE'];

test('catalog recognizes exported function, variable alias and inline handlers only', async t => {
  // Under the repository so buildCatalog can resolve the existing TypeScript dependency.
  const directory = await fs.mkdtemp(path.join(root, 'mcp-qa-web/test/.catalog-fixture-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.mkdir(path.join(directory, 'src/app/api/fixture'), { recursive: true });
  await fs.writeFile(path.join(directory, 'package.json'), '{}');
  await fs.writeFile(path.join(directory, 'src/app/api/fixture/route.ts'), `
    async function handle() {}
    export async function GET() {}
    export const PUT = handle, POST = async () => {}, DELETE = handle;
    const HEAD = handle;
    export const runtime = 'nodejs', dynamic = 'force-dynamic';
    export const { PATCH } = arbitrary;
    export type OPTIONS = string;
    export default function() {}
  `);
  const found = buildCatalog(directory).filter(op => op.path === '/api/fixture');
  assert.deepEqual(found.map(op => op.method), methods);
  assert.equal(new Set(found.map(op => op.name)).size, 4);
});

test('Studio exposes five operations while preserving the four original handlers', () => {
  const found = compactCatalog(catalog, { search: 'automation_scripts' });
  assert.equal(found.total, 5);
  for (const method of methods) {
    const kind = method === 'GET' ? 'read' : method === 'DELETE' ? 'delete' : 'write';
    const op = selectOperation(catalog, `web_${method.toLowerCase()}_automation_scripts`, kind);
    assert.equal(op.path, '/api/automation/scripts');
    assert.equal(op.sourceFile, 'src/app/api/automation/scripts/route.ts');
    for (const key of ['projectId', 'testCaseId', 'runId', 'cursor', 'artifact']) assert.ok(op.query.includes(key), key);
  }
});

test('Studio contracts separate IDs, JSON script input, queued results, artifacts and guarded Stop', () => {
  const contracts = Object.fromEntries(methods.map(method => [method, briefContract(catalog.find(op => op.path === '/api/automation/scripts' && op.method === method))]));
  for (const contract of Object.values(contracts)) {
    assert.equal(contract.guideTopic, 'playwright');
    assert.match(contract.testCaseId, /Internal.*NOT the display ID/);
    assert.match(contract.access, /OWNER\/ADMIN/);
    assert.match(contract.safety, /NOT a security sandbox/);
    assert.match(contract.safety, /No automatic testcase badge/);
    assert.equal(contract.source, undefined);
  }
  for (const method of ['PUT', 'POST']) {
    assert.deepEqual(contracts[method].bodyHints, ['script', 'baseURL', 'timeoutSeconds']);
    assert.match(contracts[method].body.script, /100000.*JSON, NOT form\/files/);
    assert.match(contracts[method].body.timeoutSeconds, /10\.\.180/);
    assert.match(contracts[method].runner, /npm run automation:runner/);
  }
  assert.match(contracts.PUT.response, /Saving does not run/);
  assert.match(contracts.POST.response, /202.*NOT PASSED/);
  assert.match(contracts.GET.reads, /nextCursor.*hasMore/);
  assert.match(contracts.GET.artifacts, /opaque id.*outputPath/);
  assert.deepEqual(contracts.DELETE.queryRequired, ['projectId', 'testCaseId', 'runId']);
  assert.match(contracts.DELETE.body, /body:\{\}/);
  assert.match(contracts.DELETE.stop, /does not delete history\/artifacts/);
  assert.match(contracts.DELETE.confirmation, /user approval/);
});

test('Studio guide is reachable by topic and included in full manual', async () => {
  const overview = await guide(root);
  assert.ok(overview.topics.includes('playwright'));
  const { text } = await guide(root, 'playwright');
  for (const phrase of ['web_get_projects', 'internal database', 'web_get_automation_scripts', 'web_put_automation_scripts', 'web_post_automation_scripts', 'web_delete_automation_scripts', 'body:{}', 'nextCursor', 'hasMore', 'npm run automation:runner', 'not PASSED', 'not a live product-test verdict', 'wait for explicit user approval']) assert.ok(text.includes(phrase), phrase);
  assert.ok((await guide(root, 'all')).workflows.includes(text.trim()));
  assert.ok(!(await guide(root, 'browser')).text.includes('## Playwright Studio'));
});

test('Studio Stop still returns a guard challenge without executing or self-approving', () => {
  const op = catalog.find(op => op.name === 'web_delete_automation_scripts');
  const guard = new DeletionGuard();
  const args = { query: { projectId: 'fixture-project', testCaseId: 'fixture-case', runId: '00000000-0000-4000-8000-000000000001' }, body: {} };
  const challenge = guard.check(op, args);
  assert.equal(challenge.executed, false);
  assert.ok(challenge.confirmation);
  // Never confirm: missing human approval must remain blocked.
  assert.equal(guard.check(op, { ...args, confirmation: challenge.confirmation }).executed, false);
});

test('fresh MCP stdio exposes Studio topic, catalog and four contracts without application access', { timeout: 20000 }, async () => {
  const client = new Client({ name: 'studio-discovery-test', version: '1' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'mcp-qa-web/server.mjs')], stderr: 'pipe', env: { ...process.env, QA_MCP_MODE: 'compact' } });
  const call = async (name, args) => {
    const result = await client.callTool({ name, arguments: args });
    assert.ok(!result.isError, JSON.stringify(result));
    return JSON.parse(result.content[0].text);
  };
  try {
    await client.connect(transport);
    const tools = (await client.listTools()).tools;
    assert.equal(tools.length, 7);
    assert.ok(tools.find(tool => tool.name === 'qa_web_guide').inputSchema.properties.topic.enum.includes('playwright'));
    assert.ok((await call('qa_web_guide', { topic: 'playwright' })).text.includes('Playwright Studio'));
    const found = await call('qa_web_catalog', { search: 'automation_scripts' });
    assert.equal(found.total, 5);
    for (const { operation } of found.operations) {
      const contract = await call('qa_web_contract', { operation });
      assert.equal(contract.guideTopic, 'playwright');
      assert.equal(contract.source, undefined);
    }
  } finally { await client.close(); }
});

test('history deletion has distinct discovery, exact artifact scope and bound human confirmation', () => {
  const op = selectOperation(catalog, 'web_delete_automation_scripts_history', 'delete');
  const contract = briefContract(op);
  assert.equal(op.path, '/api/automation/scripts/history');
  assert.deepEqual(contract.queryRequired, ['projectId', 'testCaseId']);
  assert.deepEqual(contract.bodyHints, ['runIds', 'confirmed']);
  assert.match(contract.deletion, /Saved editor script/);
  const guard = new DeletionGuard();
  const args = { query: { projectId: 'fixture-project', testCaseId: 'fixture-case' }, body: { runIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'], confirmed: true } };
  const challenge = guard.check(op, args);
  assert.equal(challenge.executed, false);
  assert.match(challenge.warning, /salinan input dan devlog/);
  assert.ok(guard.check(op, { ...args, confirmation: challenge.confirmation }).confirmationRequired);
  assert.ok(guard.check(op, { ...args, body: { ...args.body, runIds: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'] }, confirmation: challenge.confirmation, userConfirmed: true }).confirmationRequired);
});
