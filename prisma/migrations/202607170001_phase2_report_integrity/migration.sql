ALTER TABLE "Report"
ADD COLUMN "testRunId" TEXT,
ADD COLUMN "finalizedAt" TIMESTAMP(3),
ADD COLUMN "finalizedBy" TEXT,
ADD COLUMN "snapshotChecksum" TEXT;

CREATE INDEX "Report_testRunId_idx" ON "Report"("testRunId");
CREATE UNIQUE INDEX "Report_projectId_documentId_version_key" ON "Report"("projectId", "documentId", "version");

ALTER TABLE "Report"
ADD CONSTRAINT "Report_testRunId_fkey"
FOREIGN KEY ("testRunId") REFERENCES "TestRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Project"
ADD COLUMN "deletionState" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "deletedAt" TIMESTAMP(3);

ALTER TABLE "TestExecutionEvidence"
ADD COLUMN "sha256" TEXT;

ALTER TABLE "TestRunCase"
ADD COLUMN "latestStatus" TEXT NOT NULL DEFAULT 'NOT RUN',
ADD COLUMN "latestExecutionAt" TIMESTAMP(3);

UPDATE "TestRunCase" AS trc
SET "latestStatus" = latest.status,
    "latestExecutionAt" = latest."createdAt"
FROM (
  SELECT DISTINCT ON ("testRunCaseId") "testRunCaseId", status, "createdAt"
  FROM "TestExecution"
  WHERE "testRunCaseId" IS NOT NULL
  ORDER BY "testRunCaseId", "createdAt" DESC, id DESC
) AS latest
WHERE trc.id = latest."testRunCaseId";
