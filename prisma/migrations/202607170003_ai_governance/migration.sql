ALTER TABLE "Project"
ADD COLUMN "allowExternalAi" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "aiMonthlyTokenBudget" INTEGER NOT NULL DEFAULT 100000;

CREATE TABLE "AIRequestAudit" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "operation" TEXT NOT NULL,
  "promptVersion" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "contextIds" JSONB,
  "dataCategories" JSONB,
  "inputChars" INTEGER NOT NULL,
  "outputChars" INTEGER NOT NULL,
  "inputTokens" INTEGER NOT NULL,
  "outputTokens" INTEGER NOT NULL,
  "outputHash" TEXT,
  "status" TEXT NOT NULL,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AIRequestAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AIRequestAudit_projectId_createdAt_idx" ON "AIRequestAudit"("projectId", "createdAt");
CREATE INDEX "AIRequestAudit_actorUserId_createdAt_idx" ON "AIRequestAudit"("actorUserId", "createdAt");
CREATE INDEX "AIRequestAudit_projectId_provider_status_idx" ON "AIRequestAudit"("projectId", "provider", "status");
ALTER TABLE "AIRequestAudit" ADD CONSTRAINT "AIRequestAudit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIRequestAudit" ADD CONSTRAINT "AIRequestAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "AIUsageMonth" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "usedTokens" INTEGER NOT NULL DEFAULT 0,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AIUsageMonth_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AIUsageMonth_projectId_month_key" ON "AIUsageMonth"("projectId", "month");
CREATE INDEX "AIUsageMonth_month_updatedAt_idx" ON "AIUsageMonth"("month", "updatedAt");
ALTER TABLE "AIUsageMonth" ADD CONSTRAINT "AIUsageMonth_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
