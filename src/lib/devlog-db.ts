import { PrismaClient } from '@prisma/devlog-client';
import { db } from './db';

const url = process.env.POSTGRES_DATABASE_URL;
// Both schemas share these three models. Keep provider-specific transaction
// types out of the read-only API surface consumed by history/evidence routes.
type DevlogReader = Pick<PrismaClient, 'automationRun' | 'automationEvent' | 'recording'>;
const globalForDevlog = globalThis as unknown as { devlogDb?: DevlogReader };

export const devlogDb: DevlogReader = url
  ? globalForDevlog.devlogDb ?? new PrismaClient({ datasourceUrl: url })
  : db as unknown as DevlogReader;

if (process.env.NODE_ENV !== 'production' && devlogDb) globalForDevlog.devlogDb = devlogDb;
