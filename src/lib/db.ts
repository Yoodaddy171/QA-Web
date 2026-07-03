import { PrismaClient as SqliteClient } from '@prisma/client'
import { PrismaClient as PostgresClient } from '@prisma/postgresql-client'

const globalForPrisma = globalThis as unknown as {
  prisma: SqliteClient | undefined
}

const databaseUrl = process.env.DATABASE_URL || ''
const usesPostgres = /^postgres(?:ql)?:\/\//i.test(databaseUrl)
function createDb(): SqliteClient {
  if (usesPostgres) {
    return new PostgresClient({
      datasourceUrl: databaseUrl,
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    }) as unknown as SqliteClient
  }
  return new SqliteClient({
    datasourceUrl: databaseUrl,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export const db =
  globalForPrisma.prisma ??
  createDb()

if (!globalForPrisma.prisma && !usesPostgres) {
  // WAL persists in the db file; busy_timeout avoids "database is locked" during concurrent writes.
  // $queryRawUnsafe because these PRAGMAs return a result row in SQLite.
  void db.$queryRawUnsafe('PRAGMA journal_mode=WAL;').catch(() => {})
  void db.$queryRawUnsafe('PRAGMA busy_timeout=5000;').catch(() => {})
}

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
