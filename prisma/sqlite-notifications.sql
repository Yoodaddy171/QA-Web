-- Optional manual SQLite migration for installations that do not use `prisma db push`.
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "recipientKey" TEXT NOT NULL DEFAULT 'local-user',
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'info',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "metadata" JSONB,
  "dedupeKey" TEXT,
  "readAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_projectId_recipientKey_dedupeKey_key" ON "Notification"("projectId", "recipientKey", "dedupeKey");
CREATE INDEX IF NOT EXISTS "Notification_projectId_recipientKey_readAt_createdAt_idx" ON "Notification"("projectId", "recipientKey", "readAt", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_entityType_entityId_idx" ON "Notification"("entityType", "entityId");
