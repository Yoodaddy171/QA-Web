-- Additive PostgreSQL migration. SQLite uses its matching sqlite.prisma schema.
ALTER TABLE "User" ADD COLUMN "isGuest" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "GuestAccessGrant" (
  "id" TEXT NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "creatorId" TEXT NOT NULL,
  "guestUserId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "preset" TEXT NOT NULL,
  "permissions" JSONB NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "maxUses" INTEGER NOT NULL,
  "usedCount" INTEGER NOT NULL DEFAULT 0,
  "revokedAt" TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GuestAccessGrant_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "GuestAccessProject" (
  "grantId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  CONSTRAINT "GuestAccessProject_pkey" PRIMARY KEY ("grantId", "projectId")
);
CREATE UNIQUE INDEX "GuestAccessGrant_guestUserId_key" ON "GuestAccessGrant"("guestUserId");
CREATE UNIQUE INDEX "GuestAccessGrant_tokenHash_key" ON "GuestAccessGrant"("tokenHash");
CREATE INDEX "GuestAccessGrant_workspaceId_createdAt_idx" ON "GuestAccessGrant"("workspaceId", "createdAt");
CREATE INDEX "GuestAccessGrant_expiresAt_revokedAt_idx" ON "GuestAccessGrant"("expiresAt", "revokedAt");
CREATE INDEX "GuestAccessProject_projectId_idx" ON "GuestAccessProject"("projectId");
ALTER TABLE "GuestAccessGrant" ADD CONSTRAINT "GuestAccessGrant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestAccessGrant" ADD CONSTRAINT "GuestAccessGrant_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GuestAccessGrant" ADD CONSTRAINT "GuestAccessGrant_guestUserId_fkey" FOREIGN KEY ("guestUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestAccessProject" ADD CONSTRAINT "GuestAccessProject_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "GuestAccessGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuestAccessProject" ADD CONSTRAINT "GuestAccessProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
