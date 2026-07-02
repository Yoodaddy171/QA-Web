-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "automationContext" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectKnowledge" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectKnowledge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Module" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TestCase" (
    "id" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "subMenu" TEXT,
    "weight" TEXT,
    "testType" TEXT NOT NULL,
    "testAction" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "stepLogs" TEXT,
    "expectedResult" TEXT NOT NULL,
    "actualResult" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT DONE',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "remarks" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "projectId" TEXT NOT NULL,
    "moduleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TestCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BugFix" (
    "id" TEXT NOT NULL,
    "sourceTestCaseId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "subMenu" TEXT,
    "testType" TEXT NOT NULL,
    "testAction" TEXT NOT NULL,
    "steps" TEXT NOT NULL,
    "stepLogs" TEXT,
    "expectedResult" TEXT NOT NULL,
    "actualResult" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "moduleId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUDAH DILAPORKAN',
    "reportedAt" TIMESTAMP(3),
    "fixingAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "fixedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BugFix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRun" (
    "id" TEXT NOT NULL,
    "runKey" TEXT NOT NULL,
    "externalRunId" TEXT,
    "sessionId" TEXT,
    "projectId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'testcase',
    "mode" TEXT NOT NULL DEFAULT 'unknown',
    "status" TEXT NOT NULL DEFAULT 'running',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationEvent" (
    "sequence" BIGSERIAL NOT NULL,
    "eventId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "relativeMs" INTEGER,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AutomationEvent_pkey" PRIMARY KEY ("sequence")
);

-- CreateTable
CREATE TABLE "Recording" (
    "id" TEXT NOT NULL,
    "recordingId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "testCaseId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "targetUrl" TEXT,
    "mediaRoot" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "stoppedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_updatedAt_idx" ON "Project"("updatedAt");

-- CreateIndex
CREATE INDEX "ProjectKnowledge_projectId_type_idx" ON "ProjectKnowledge"("projectId", "type");

-- CreateIndex
CREATE INDEX "Module_projectId_updatedAt_idx" ON "Module"("projectId", "updatedAt");

-- CreateIndex
CREATE INDEX "TestCase_projectId_moduleId_status_idx" ON "TestCase"("projectId", "moduleId", "status");

-- CreateIndex
CREATE INDEX "TestCase_projectId_updatedAt_idx" ON "TestCase"("projectId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TestCase_projectId_testCaseId_key" ON "TestCase"("projectId", "testCaseId");

-- CreateIndex
CREATE INDEX "BugFix_projectId_moduleId_status_idx" ON "BugFix"("projectId", "moduleId", "status");

-- CreateIndex
CREATE INDEX "BugFix_projectId_updatedAt_idx" ON "BugFix"("projectId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationRun_runKey_key" ON "AutomationRun"("runKey");

-- CreateIndex
CREATE INDEX "AutomationRun_projectId_startedAt_idx" ON "AutomationRun"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "AutomationRun_testCaseId_startedAt_idx" ON "AutomationRun"("testCaseId", "startedAt");

-- CreateIndex
CREATE INDEX "AutomationRun_status_updatedAt_idx" ON "AutomationRun"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AutomationEvent_eventId_key" ON "AutomationEvent"("eventId");

-- CreateIndex
CREATE INDEX "AutomationEvent_runId_sequence_idx" ON "AutomationEvent"("runId", "sequence");

-- CreateIndex
CREATE INDEX "AutomationEvent_testCaseId_sequence_idx" ON "AutomationEvent"("testCaseId", "sequence");

-- CreateIndex
CREATE INDEX "AutomationEvent_timestamp_idx" ON "AutomationEvent"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Recording_recordingId_key" ON "Recording"("recordingId");

-- CreateIndex
CREATE UNIQUE INDEX "Recording_runId_key" ON "Recording"("runId");

-- CreateIndex
CREATE INDEX "Recording_testCaseId_startedAt_idx" ON "Recording"("testCaseId", "startedAt");

-- CreateIndex
CREATE INDEX "Recording_status_updatedAt_idx" ON "Recording"("status", "updatedAt");

-- AddForeignKey
ALTER TABLE "ProjectKnowledge" ADD CONSTRAINT "ProjectKnowledge_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Module" ADD CONSTRAINT "Module_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TestCase" ADD CONSTRAINT "TestCase_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugFix" ADD CONSTRAINT "BugFix_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugFix" ADD CONSTRAINT "BugFix_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BugFix" ADD CONSTRAINT "BugFix_sourceTestCaseId_fkey" FOREIGN KEY ("sourceTestCaseId") REFERENCES "TestCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRun" ADD CONSTRAINT "AutomationRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationEvent" ADD CONSTRAINT "AutomationEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recording" ADD CONSTRAINT "Recording_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AutomationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
