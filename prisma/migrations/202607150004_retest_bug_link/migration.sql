-- Preserve the bug being retested on each execution.
ALTER TABLE "TestExecution" ADD COLUMN "bugFixId" TEXT;

CREATE INDEX "TestExecution_bugFixId_createdAt_idx" ON "TestExecution"("bugFixId", "createdAt");

ALTER TABLE "TestExecution" ADD CONSTRAINT "TestExecution_bugFixId_fkey" FOREIGN KEY ("bugFixId") REFERENCES "BugFix"("id") ON DELETE SET NULL ON UPDATE CASCADE;
