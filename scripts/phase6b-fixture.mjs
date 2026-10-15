import crypto from 'node:crypto';

// Synthetic-only seed shared by the disposable integration and HTTP harnesses.
// Callers must supply an explicitly temporary database, never the application DB.
export async function seedAuthorizationFixture(client) {
  const a = await client.workspace.create({ data: { name: 'Synthetic A', slug: crypto.randomUUID() } });
  const b = await client.workspace.create({ data: { name: 'Synthetic B', slug: crypto.randomUUID() } });
  const projectA = await client.project.create({ data: { workspaceId: a.id, name: 'Project A' } });
  const projectA2 = await client.project.create({ data: { workspaceId: a.id, name: 'Project A2' } });
  const projectB = await client.project.create({ data: { workspaceId: b.id, name: 'Project B' } });
  const password = crypto.randomBytes(24).toString('base64url');
  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = `scrypt$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}`;
  /** @type {Record<string, {user: any, session: any, token: string}>} */
  const actors = {};
  for (const [alias, memberships] of Object.entries({
    viewer: [[a.id, 'VIEWER']], qa: [[a.id, 'QA']], lead: [[a.id, 'QA_LEAD']],
    admin: [[a.id, 'ADMIN']], owner: [[a.id, 'OWNER']], foreign: [[b.id, 'OWNER']],
    none: [], multi: [[a.id, 'ADMIN'], [b.id, 'VIEWER']],
  })) {
    const user = await client.user.create({ data: { email: `${crypto.randomUUID()}@example.test`, name: `Synthetic ${alias}`, passwordHash } });
    for (const [workspaceId, role] of memberships) await client.workspaceMembership.create({ data: { userId: user.id, workspaceId, role } });
    const token = crypto.randomBytes(32).toString('base64url');
    const session = await client.session.create({ data: { userId: user.id, tokenHash: crypto.createHash('sha256').update(token).digest('hex'), expiresAt: new Date(Date.now() + 3_600_000) } });
    actors[alias] = { user, session, token };
  }
  const resources = {};
  for (const [alias, project] of [['a', projectA], ['a2', projectA2], ['b', projectB]]) {
    const tc = await client.testCase.create({ data: { projectId: project.id, testCaseId: 'SHARED-001', page: `Page ${alias}`, testType: 'Positive', testAction: 'Submit', steps: 'Click', expectedResult: 'Saved', status: 'FAILED', actualResult: 'Not As Expected' } });
    const bug = await client.bugFix.create({ data: { sourceTestCaseId: tc.id, projectId: project.id, testCaseId: tc.testCaseId, page: tc.page, testType: tc.testType, testAction: tc.testAction, steps: tc.steps, expectedResult: tc.expectedResult, actualResult: 'Not As Expected', priority: 'High', status: 'SEDANG DI FIX', reportedAt: new Date('2020-01-01'), fixingAt: new Date('2020-01-02') } });
    const run = await client.testRun.create({ data: { projectId: project.id, name: `Run ${alias}` } });
    const execution = await client.testExecution.create({ data: { testRunId: run.id, testCaseId: tc.id, status: 'FAILED' } });
    const evidence = await client.testExecutionEvidence.create({ data: { executionId: execution.id, fileName: `synthetic-${alias}.png`, mimeType: 'image/png', sizeBytes: 0, storagePath: `synthetic/${crypto.randomUUID()}` } });
    const requirement = await client.requirement.create({ data: { projectId: project.id, key: 'R-001', title: `Requirement ${alias}` } });
    const report = await client.report.create({ data: { projectId: project.id, reportType: 'TEST_PLANNING_DOCUMENT', version: '1', author: 'Synthetic author', approvedBy: 'Synthetic waiver', documentId: crypto.randomUUID(), reportingPeriodStart: new Date('2020-01-01'), reportingPeriodEnd: new Date('2020-01-02'), metricsSnapshot: {}, progressNarrative: `SYNTHETIC-${alias}-REPORT` } });
    const automation = await client.automationRun.create({ data: { runKey: crypto.randomUUID(), projectId: project.id, testCaseId: alias === 'b' ? tc.testCaseId : tc.id, mode: 'manual', startedAt: new Date(alias === 'b' ? '2020-02-01' : '2020-01-01') } });
    await client.automationEvent.create({ data: { eventId: crypto.randomUUID(), runId: automation.id, testCaseId: automation.testCaseId, eventType: 'console', timestamp: new Date(), payload: { schemaVersion: 1, eventType: 'console', message: `SYNTHETIC-${alias}-PRIVATE-LOG`, timestamp: '2020-01-01T00:00:00Z' } } });
    await client.recording.create({ data: { recordingId: crypto.randomUUID(), runId: automation.id, testCaseId: automation.testCaseId, sessionId: crypto.randomUUID(), mode: 'frame', status: 'ready', mediaRoot: 'synthetic-unused', metadata: { frames: [], sessionId: 'synthetic' }, startedAt: automation.startedAt } });
    resources[alias] = { project, tc, bug, run, execution, evidence, requirement, report };
  }
  return { workspaces: { a, b }, actors, resources, password };
}
