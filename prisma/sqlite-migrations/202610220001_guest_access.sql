CREATE TABLE IF NOT EXISTS "GuestAccessGrant" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workspaceId" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "guestUserId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "preset" TEXT NOT NULL,
  "permissions" JSONB NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "maxUses" INTEGER NOT NULL,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "revokedAt" DATETIME,
  "lastUsedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestAccessGrant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GuestAccessGrant_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GuestAccessGrant_guestUserId_fkey" FOREIGN KEY ("guestUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE IF NOT EXISTS "GuestAccessProject" (
  "grantId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  PRIMARY KEY ("grantId", "projectId"),
  CONSTRAINT "GuestAccessProject_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "GuestAccessGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GuestAccessProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "GuestAccessGrant_guestUserId_key" ON "GuestAccessGrant"("guestUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "GuestAccessGrant_tokenHash_key" ON "GuestAccessGrant"("tokenHash");
CREATE INDEX IF NOT EXISTS "GuestAccessGrant_workspaceId_createdAt_idx" ON "GuestAccessGrant"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "GuestAccessGrant_expiresAt_revokedAt_idx" ON "GuestAccessGrant"("expiresAt", "revokedAt");
CREATE INDEX IF NOT EXISTS "GuestAccessProject_projectId_idx" ON "GuestAccessProject"("projectId");
