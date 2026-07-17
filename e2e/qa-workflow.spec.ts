import { expect, test, type APIRequestContext } from '@playwright/test';

async function jsonPost(request: APIRequestContext, url: string, data?: unknown) {
  const response = await request.post(url, data === undefined ? undefined : { data });
  const body = await response.json();
  expect(response.ok(), `POST ${url}: ${JSON.stringify(body)}`).toBeTruthy();
  return body;
}

async function jsonGet(request: APIRequestContext, url: string) {
  const response = await request.get(url);
  const body = await response.json();
  expect(response.ok(), `GET ${url}: ${JSON.stringify(body)}`).toBeTruthy();
  return body;
}

test('runs the core QA workflow through execution, evidence, bug, retest, and report', async ({ request }) => {
  const suffix = Date.now().toString();
  const project = await jsonPost(request, '/api/projects', { name: `E2E QA ${suffix}`, description: 'Temporary workflow project' });
  try {
    const moduleRecord = await jsonPost(request, '/api/modules', { projectId: project.id, name: 'Checkout' });
    const testCase = await jsonPost(request, '/api/testcases', {
      projectId: project.id,
      moduleId: moduleRecord.id,
      testCaseId: `E2E-${suffix}`,
      page: 'Checkout',
      subMenu: 'Payment',
      testType: 'Positive',
      testAction: 'Complete payment',
      steps: '1. Open checkout\n2. Submit payment',
      expectedResult: 'Payment succeeds',
      status: 'NOT DONE',
      priority: 'High',
    });
    const run = await jsonPost(request, '/api/test-runs', { projectId: project.id, name: `Release ${suffix}`, assignedTo: 'e2e-tester' });
    await jsonPost(request, `/api/test-runs/${run.id}/cases`, { projectId: project.id, testCaseIds: [testCase.id] });

    const failedExecution = await jsonPost(request, `/api/test-runs/${run.id}/executions`, { projectId: project.id, testCaseId: testCase.id, tester: 'e2e-tester', status: 'FAILED', notes: 'Payment rejected' });
    const evidenceResponse = await request.post(`/api/test-runs/${run.id}/executions/${failedExecution.id}/evidence?projectId=${project.id}`, {
      multipart: { file: { name: 'failure.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') } },
    });
    expect(evidenceResponse.ok()).toBeTruthy();
    const bug = await jsonPost(request, `/api/test-runs/${run.id}/executions/${failedExecution.id}/bug?projectId=${project.id}`);
    expect(bug.id).toBeTruthy();
    const filteredByRun = await jsonGet(request, `/api/testcases?projectId=${project.id}&testRunId=${run.id}&limit=10`);
    expect(filteredByRun.total).toBe(1);
    const filteredByBug = await jsonGet(request, `/api/testcases?projectId=${project.id}&hasBug=yes&limit=10`);
    expect(filteredByBug.total).toBe(1);

    const retestExecution = await jsonPost(request, `/api/test-runs/${run.id}/executions`, { projectId: project.id, testCaseId: testCase.id, tester: 'e2e-tester', status: 'RETEST', notes: 'Retest after fix' });
    expect(retestExecution.id).not.toBe(failedExecution.id);
    const bulkExecution = await jsonPost(request, `/api/test-runs/${run.id}/executions/bulk`, { projectId: project.id, testCaseIds: [testCase.id], status: 'PASSED', tester: 'e2e-tester' });
    expect(bulkExecution.executed).toBe(1);
    await jsonPost(request, `/api/test-runs/${run.id}/cases`, { projectId: project.id, testCaseIds: [testCase.id], assignedTo: 'assigned-tester' });
    const runDetail = await jsonGet(request, `/api/test-runs/${run.id}?projectId=${project.id}`);
    expect(runDetail.testCases[0].assignedTo).toBe('assigned-tester');
    await jsonPost(request, '/api/reports', {
      projectId: project.id,
      testRunId: run.id,
      reportType: 'TEST_STATUS_REPORT',
      version: '1.0',
      reportingPeriodStart: new Date(Date.now() - 86_400_000).toISOString(),
      reportingPeriodEnd: new Date().toISOString(),
    });

    const traceability = await jsonGet(request, `/api/traceability?projectId=${project.id}&testCaseId=${testCase.id}`);
    expect(traceability.testCase.testRuns).toHaveLength(1);
    expect(traceability.testCase.testRuns[0].executions.length).toBeGreaterThanOrEqual(2);
    expect(traceability.testCase.bugFixItems.some((item: { id: string }) => item.id === bug.id)).toBeTruthy();
    const history = await jsonGet(request, `/api/activity?projectId=${project.id}&entityType=TestExecution&entityId=${failedExecution.id}`);
    expect(history.activities.some((item: { action: string }) => item.action === 'CREATED')).toBeTruthy();
  } finally {
    const cleanup = await request.delete(`/api/projects?id=${project.id}`);
    expect(cleanup.ok()).toBeTruthy();
  }
});
