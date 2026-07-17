import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const scrypt = promisify(crypto.scrypt);
const databasePath = path.resolve('prisma/db/e2e.db');
const databaseUrl = 'file:./db/e2e.db';
const localSchemaSource = path.resolve('prisma/db/custom.db');

for (const suffix of ['', '-journal', '-wal', '-shm']) {
  await fs.rm(`${databasePath}${suffix}`, { force: true });
}
await fs.mkdir(path.dirname(databasePath), { recursive: true });

const prismaCli = path.resolve('node_modules/prisma/build/index.js');
let pushStatus = 1;
let copiedLocalSchema = false;
const nodeMajor = Number(process.versions.node.split('.')[0]);
if (process.platform === 'win32' && nodeMajor >= 26) {
  try {
    await fs.copyFile(localSchemaSource, databasePath);
    copiedLocalSchema = true;
    pushStatus = 0;
    console.log('Using a copied local schema because Prisma 6 schema-engine does not support Node 26.');
  } catch {}
}
if (!copiedLocalSchema) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const pushed = spawnSync(process.execPath, [prismaCli, 'db', 'push', '--skip-generate', '--schema', 'prisma/sqlite.prisma'], {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl, RUST_LOG: process.env.RUST_LOG || 'info' },
    });
    pushStatus = pushed.status ?? 1;
    if (pushStatus === 0) break;
    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 500));
  }
}
if (pushStatus !== 0) process.exit(pushStatus);

const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
try {
  if (copiedLocalSchema) {
    const tables = await db.$queryRawUnsafe('SELECT name FROM sqlite_master WHERE type = \'table\' AND name NOT LIKE \'sqlite_%\'');
    await db.$executeRawUnsafe('PRAGMA foreign_keys=OFF');
    for (const { name } of tables) {
      if (typeof name !== 'string' || !/^[A-Za-z0-9_]+$/.test(name)) throw new Error('Unsafe SQLite table name.');
      await db.$executeRawUnsafe(`DELETE FROM "${name}"`);
    }
    await db.$executeRawUnsafe('PRAGMA foreign_keys=ON');
  }
  const salt = 'qa-desk-e2e-static-salt';
  const derived = await scrypt('E2E-only-password-2026!', salt, 64);
  const passwordHash = `scrypt$${salt}$${derived.toString('hex')}`;
  await db.workspace.create({ data: { id: 'e2e-workspace', name: 'E2E Workspace', slug: 'e2e-workspace' } });
  await db.user.create({
    data: {
      id: 'e2e-owner',
      email: 'owner@qa-desk.test',
      name: 'E2E Owner',
      passwordHash,
      memberships: { create: { workspaceId: 'e2e-workspace', role: 'OWNER' } },
    },
  });
  await db.project.create({
    data: { id: 'e2e-project', workspaceId: 'e2e-workspace', name: 'E2E QA Project', description: 'Isolated Playwright fixture' },
  });
  console.log(`E2E database ready: ${databasePath}`);
} finally {
  await db.$disconnect();
}
