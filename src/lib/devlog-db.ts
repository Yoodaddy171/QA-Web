import { PrismaClient } from '@prisma/postgresql-client';

const url = process.env.POSTGRES_DATABASE_URL;
const globalForDevlog = globalThis as unknown as { devlogDb?: PrismaClient };

export const devlogDb = url
  ? globalForDevlog.devlogDb ?? new PrismaClient({ datasourceUrl: url })
  : null;

if (process.env.NODE_ENV !== 'production' && devlogDb) globalForDevlog.devlogDb = devlogDb;
