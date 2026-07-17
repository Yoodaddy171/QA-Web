import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
try {
  const [testCases, reports] = await Promise.all([
    db.testCase.findMany({ select: { projectId: true, testCaseId: true } }),
    db.report.findMany({ select: { projectId: true, documentId: true, version: true } }),
  ]);
  const duplicateKeys = rows => {
    const seen = new Set();
    const duplicates = new Set();
    for (const key of rows) {
      if (seen.has(key)) duplicates.add(key);
      seen.add(key);
    }
    return [...duplicates];
  };
  const duplicateTestCaseIds = duplicateKeys(testCases.map(row => `${row.projectId}\0${row.testCaseId}`));
  const duplicateReportVersions = duplicateKeys(reports
    .filter(row => row.documentId)
    .map(row => `${row.projectId}\0${row.documentId}\0${row.version}`));
  const result = { duplicateTestCaseIds, duplicateReportVersions };
  console.log(JSON.stringify(result, null, 2));
  if (duplicateTestCaseIds.length || duplicateReportVersions.length) process.exitCode = 1;
} finally {
  await db.$disconnect();
}
