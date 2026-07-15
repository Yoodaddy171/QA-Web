-- Link a bug created from the execution workspace to the execution that caused it.
ALTER TABLE "BugFix" ADD COLUMN "sourceExecutionId" TEXT;

CREATE INDEX "BugFix_sourceExecutionId_idx" ON "BugFix"("sourceExecutionId");

ALTER TABLE "BugFix" ADD CONSTRAINT "BugFix_sourceExecutionId_fkey" FOREIGN KEY ("sourceExecutionId") REFERENCES "TestExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
