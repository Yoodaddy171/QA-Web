import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rawUrl = process.env.DATABASE_URL || '';
if (!rawUrl.startsWith('file:')) throw new Error('Migrasi ini khusus SQLite. Gunakan db:migrate:postgres untuk PostgreSQL.');
const filename = path.resolve(root, 'prisma', rawUrl.slice(5));
await fs.access(filename); // Never silently create a different/empty database.
if (filename.split(path.sep).includes('.next')) throw new Error('Database harus berada di luar folder build .next.');
const url = `file:${filename.replaceAll('\\', '/')}`;
if (!process.argv.includes('--apply')) throw new Error('Hentikan web/relay/MCP, lalu jalankan dengan --apply. Backup otomatis dibuat sebelum perubahan.');
const backup = spawnSync(process.execPath, [path.join(root, 'scripts/backup-database.mjs')], { cwd: root, windowsHide: true, env: { ...process.env, DATABASE_URL: url }, stdio: 'inherit' });
if (backup.error || backup.status !== 0) throw new Error('Backup gagal. Migrasi dibatalkan.');
const db = new PrismaClient({ datasourceUrl: url, log: [] });
try {
  const sql = await fs.readFile(path.join(root, 'prisma/sqlite-migrations/202610220001_guest_access.sql'), 'utf8');
  await db.$transaction(async tx => {
    const columns = await tx.$queryRawUnsafe('PRAGMA table_info("User")');
    if (!columns.length) throw new Error('Tabel User tidak ditemukan. Jalankan migrasi dasar terlebih dahulu.');
    if (!columns.some(column => column.name === 'isGuest')) await tx.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "isGuest" BOOLEAN NOT NULL DEFAULT false');
    for (const statement of sql.split(';').map(value => value.trim()).filter(Boolean)) await tx.$executeRawUnsafe(statement);
  }, { timeout: 30000 });
  const integrity = await db.$queryRawUnsafe('PRAGMA integrity_check');
  if (integrity.some(row => Object.values(row)[0] !== 'ok')) throw new Error('Integrity check gagal. Simpan backup dan periksa database sebelum menjalankan web.');
  console.log('Guest access SQLite migration complete. Existing data retained; integrity_check=ok.');
} finally { await db.$disconnect(); }
