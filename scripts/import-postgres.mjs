import fs from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ datasourceUrl: process.env.POSTGRES_DATABASE_URL || process.env.DATABASE_URL });
const inputPath = path.resolve(process.argv[2] || 'data-migration/sqlite-export.json');
const dateFields = {
  workspaces: ['createdAt', 'updatedAt'], users: ['disabledAt', 'createdAt', 'updatedAt'], workspaceMemberships: ['createdAt', 'updatedAt'],
  aiRequestAudits: ['createdAt'], aiUsageMonths: ['updatedAt'],
  projects: ['deletedAt', 'createdAt', 'updatedAt'], projectKnowledge: ['createdAt', 'updatedAt'], modules: ['createdAt', 'updatedAt'], testCases: ['createdAt', 'updatedAt'],
  requirements: ['createdAt', 'updatedAt'], testPlans: ['createdAt', 'updatedAt'], testPlanRequirements: ['createdAt'], requirementTestCases: ['createdAt'],
  testRuns: ['startDate', 'endDate', 'createdAt', 'updatedAt'], testRunCases: ['latestExecutionAt', 'createdAt', 'updatedAt'],
  testExecutions: ['startedAt', 'completedAt', 'createdAt', 'updatedAt'], testExecutionEvidence: ['createdAt', 'updatedAt'],
  bugFixes: ['reportedAt', 'fixingAt', 'readyAt', 'fixedAt', 'createdAt', 'updatedAt'], activityHistory: ['createdAt'], notifications: ['readAt', 'createdAt'],
  reports: ['dateOfIssue', 'reportingPeriodStart', 'reportingPeriodEnd', 'finalizedAt', 'createdAt', 'updatedAt'],
  automationRuns: ['startedAt', 'endedAt', 'createdAt', 'updatedAt'], automationEvents: ['timestamp', 'createdAt'], recordings: ['startedAt', 'stoppedAt', 'createdAt', 'updatedAt'],
};
const jsonFields = {
  aiRequestAudits: ['contextIds', 'dataCategories'], activityHistory: ['beforeValue', 'afterValue'], notifications: ['metadata'], reports: ['metadataJson', 'sectionsJson', 'metricsSnapshot'],
  automationEvents: ['payload'], recordings: ['metadata'],
};

function transform(rows = [], key) {
  return rows.map(original => {
    const row = { ...original };
    for (const field of dateFields[key] || []) if (row[field] !== null && row[field] !== undefined) row[field] = new Date(row[field]);
    for (const field of jsonFields[key] || []) if (typeof row[field] === 'string') { try { row[field] = JSON.parse(row[field]); } catch { row[field] = null; } }
    if (key === 'automationEvents' && row.sequence !== undefined) row.sequence = BigInt(row.sequence);
    return row;
  });
}

async function createMany(tx, model, rows) {
  if (rows.length) await tx[model].createMany({ data: rows, skipDuplicates: true });
}

try {
  const source = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  const data = Object.fromEntries(Object.keys(dateFields).map(key => [key, transform(source[key], key)]));
  await db.$transaction(async tx => {
    await createMany(tx, 'workspace', data.workspaces);
    const localWorkspace = await tx.workspace.upsert({ where: { slug: 'local-workspace' }, update: {}, create: { id: 'local-workspace', name: 'Local Workspace', slug: 'local-workspace' } });
    await createMany(tx, 'user', data.users);
    await createMany(tx, 'workspaceMembership', data.workspaceMemberships);
    await createMany(tx, 'project', data.projects.map(row => ({ ...row, workspaceId: row.workspaceId || localWorkspace.id })));
    await createMany(tx, 'aiRequestAudit', data.aiRequestAudits);
    await createMany(tx, 'aiUsageMonth', data.aiUsageMonths);
    await createMany(tx, 'projectKnowledge', data.projectKnowledge);
    await createMany(tx, 'module', data.modules);
    await createMany(tx, 'testCase', data.testCases);
    await createMany(tx, 'requirement', data.requirements);
    await createMany(tx, 'testPlan', data.testPlans);
    await createMany(tx, 'testPlanRequirement', data.testPlanRequirements);
    await createMany(tx, 'requirementTestCase', data.requirementTestCases);
    await createMany(tx, 'testRun', data.testRuns);
    await createMany(tx, 'testRunCase', data.testRunCases);
    await createMany(tx, 'testExecution', data.testExecutions.map(row => ({ ...row, bugFixId: null })));
    await createMany(tx, 'testExecutionEvidence', data.testExecutionEvidence);
    await createMany(tx, 'bugFix', data.bugFixes.map(row => ({ ...row, sourceExecutionId: null })));
    for (const row of data.bugFixes.filter(row => row.sourceExecutionId)) await tx.bugFix.updateMany({ where: { id: row.id }, data: { sourceExecutionId: row.sourceExecutionId } });
    for (const row of data.testExecutions.filter(row => row.bugFixId)) await tx.testExecution.updateMany({ where: { id: row.id }, data: { bugFixId: row.bugFixId } });
    await createMany(tx, 'activityHistory', data.activityHistory);
    await createMany(tx, 'notification', data.notifications);
    await createMany(tx, 'report', data.reports);
    await createMany(tx, 'automationRun', data.automationRuns);
    await createMany(tx, 'automationEvent', data.automationEvents);
    await createMany(tx, 'recording', data.recordings);
  }, { timeout: 120_000 });

  const modelMap = {
    workspaces: 'workspace', users: 'user', workspaceMemberships: 'workspaceMembership', aiRequestAudits: 'aiRequestAudit', aiUsageMonths: 'aiUsageMonth', projects: 'project', projectKnowledge: 'projectKnowledge', modules: 'module', testCases: 'testCase', requirements: 'requirement', testPlans: 'testPlan', testPlanRequirements: 'testPlanRequirement', requirementTestCases: 'requirementTestCase', testRuns: 'testRun', testRunCases: 'testRunCase', testExecutions: 'testExecution', testExecutionEvidence: 'testExecutionEvidence', bugFixes: 'bugFix', activityHistory: 'activityHistory', notifications: 'notification', reports: 'report', automationRuns: 'automationRun', automationEvents: 'automationEvent', recordings: 'recording',
  };
  const counts = Object.fromEntries(await Promise.all(Object.entries(modelMap).map(async ([key, model]) => [key, await db[model].count()])));
  const mismatches = Object.entries(source.counts || {}).filter(([key, expected]) => counts[key] < expected).map(([key, expected]) => `${key}: expected at least ${expected}, found ${counts[key]}`);
  if (mismatches.length) throw new Error(`Import verification failed: ${mismatches.join('; ')}`);
  console.log(`PostgreSQL import verified from ${inputPath}`);
  console.log(JSON.stringify(counts));
} finally {
  await db.$disconnect();
}
