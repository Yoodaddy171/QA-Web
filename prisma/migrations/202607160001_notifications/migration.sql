-- Persistent per-recipient notifications. Existing project data remains unchanged.
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
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
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Notification_projectId_recipientKey_dedupeKey_key"
ON "Notification"("projectId", "recipientKey", "dedupeKey");
CREATE INDEX "Notification_projectId_recipientKey_readAt_createdAt_idx"
ON "Notification"("projectId", "recipientKey", "readAt", "createdAt");
CREATE INDEX "Notification_entityType_entityId_idx"
ON "Notification"("entityType", "entityId");

ALTER TABLE "Notification"
ADD CONSTRAINT "Notification_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
