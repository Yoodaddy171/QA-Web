import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const fixture = await vi.hoisted(async () => {
  const fs = await import('node:fs'); const os = await import('node:os'); const path = await import('node:path');
  const parent = fs.realpathSync(os.tmpdir());
  const root = fs.mkdtempSync(path.join(parent, 'traceva-run-gallery-'));
  return { parent, root, url: `file:${path.join(root, 'synthetic.db').replaceAll('\\', '/')}` };
});
vi.mock('@/lib/db', async () => {
  const { PrismaClient } = await import('@prisma/client');
  return { db: new PrismaClient({ datasourceUrl: fixture.url }) };
});
vi.mock('@/lib/services/guest-response', () => ({ guestSafeResponse: async (value: unknown) => value }));
import { db } from '@/lib/db';
import { getTestRunCasesPage } from './test-run-service';
import { GET } from '@/app/api/testcases/[id]/evidence/route';

beforeAll(async () => {
  await fs.writeFile(path.join(fixture.root, 'synthetic.db'), '', { flag: 'wx' });
  execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'db', 'push', '--schema', path.resolve('prisma/sqlite.prisma'), '--skip-generate'], {
    env: { ...process.env, DATABASE_URL: fixture.url }, stdio: 'pipe', windowsHide: true,
  });
  const workspace = await db.workspace.create({ data: { name: 'Synthetic pagination', slug: 'synthetic-pagination' } });
  await db.project.createMany({ data: ['p', 'other'].map(id => ({ id, workspaceId: workspace.id, name: id })) });
  await db.testRun.create({ data: { id: 'r', projectId: 'p', name: 'Synthetic run' } });
  await db.testCase.createMany({ data: Array.from({ length: 230 }, (_, i) => ({ id: `case-${i}`, projectId: 'p', testCaseId: `TC-${i}`, page: 'Synthetic', testType: 'Positive', testAction: 'Check', steps: 'Open', expectedResult: 'Visible' })) });
  // Equal timestamps deliberately exercise the deterministic membership-ID tie-break.
  await db.testRunCase.createMany({ data: Array.from({ length: 230 }, (_, i) => ({ id: `member-${String(i).padStart(3, '0')}`, testRunId: 'r', testCaseId: `case-${i}`, createdAt: new Date('2026-01-01') })) });
  await db.testExecution.create({ data: { id: 'execution', testRunId: 'r', testRunCaseId: 'member-150', testCaseId: 'case-150', status: 'PASSED' } });
  await db.testExecutionEvidence.createMany({ data: Array.from({ length: 70 }, (_, i) => ({ id: `evidence-${String(i).padStart(3, '0')}`, executionId: 'execution', fileName: `${i}.png`, mimeType: 'image/png', sizeBytes: 100, storagePath: `synthetic/${i}`, createdAt: new Date('2026-01-01') })) });
}, 60_000);
afterAll(async () => {
  await db.$disconnect();
  if (path.dirname(fixture.root) !== fixture.parent || !path.basename(fixture.root).startsWith('traceva-run-gallery-')) throw Error('Unsafe test cleanup');
  await fs.rm(fixture.root, { recursive: true, force: true });
});

it('resumes by UUID beyond 100 and loads both preceding and subsequent pages', async () => {
  const resumed = await getTestRunCasesPage('p', 'r', { focusCaseId: 'case-150', limit: 100 });
  expect(resumed?.startOffset).toBe(100);
  expect(resumed?.items).toHaveLength(100);
  expect(resumed?.items[50].id).toBe('case-150');
  expect(resumed?.items[50].executions[0]?.id).toBe('execution');
  const before = await getTestRunCasesPage('p', 'r', { offset: 0, limit: 100 });
  expect(before?.items[0].id).toBe('case-0');
  const after = await getTestRunCasesPage('p', 'r', { cursor: resumed!.nextCursor!, limit: 100 });
  expect(after?.items.map(item => item.id)).toEqual(Array.from({ length: 30 }, (_, i) => `case-${i + 200}`));
  expect(await getTestRunCasesPage('other', 'r', { focusCaseId: 'case-150' })).toBeNull();
});

it('pages all 70 evidence metadata records without duplicates or storage paths', async () => {
  const ids = new Set<string>(); let cursor: string | null = null;
  do {
    const params = new URLSearchParams({ projectId: 'p', limit: '25' }); if (cursor) params.set('cursor', cursor);
    const response = await GET(new NextRequest(`http://localhost/api/testcases/case-150/evidence?${params}`), { params: Promise.resolve({ id: 'case-150' }) });
    expect(response.status).toBe(200);
    const page = await response.json(); expect(page.total).toBe(70); expect(page.items.length).toBeLessThanOrEqual(25);
    expect(JSON.stringify(page)).not.toContain('storagePath');
    for (const item of page.items) { expect(ids.has(item.evidence.id)).toBe(false); ids.add(item.evidence.id); }
    cursor = page.nextCursor;
  } while (cursor);
  expect(ids.size).toBe(70);
  const foreign = await GET(new NextRequest('http://localhost/api/testcases/case-150/evidence?projectId=other'), { params: Promise.resolve({ id: 'case-150' }) });
  expect(foreign.status).toBe(404);
});
