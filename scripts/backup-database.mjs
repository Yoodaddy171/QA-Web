import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const databaseUrl = process.env.DATABASE_URL || 'file:./db/custom.db';
const backupRoot = path.resolve(process.env.QA_BACKUP_DIR || path.join(process.cwd(), 'backups'));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
await fs.mkdir(backupRoot, { recursive: true });

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)));
  });
}

async function checksum(file) {
  const hash = crypto.createHash('sha256');
  hash.update(await fs.readFile(file));
  return hash.digest('hex');
}

let provider;
let output;
if (/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  provider = 'postgresql';
  output = path.join(backupRoot, `qa-web-${stamp}.dump`);
  const url = new URL(databaseUrl);
  const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password) };
  if (url.searchParams.get('sslmode')) env.PGSSLMODE = url.searchParams.get('sslmode');
  await run(process.env.PG_DUMP_PATH || 'pg_dump', ['--format=custom', '--no-owner', '--file', output, decodeURIComponent(url.pathname.slice(1))], env);
} else {
  provider = 'sqlite';
  output = path.join(backupRoot, `qa-web-${stamp}.sqlite`);
  const relative = databaseUrl.replace(/^file:/, '');
  const source = path.resolve(process.cwd(), 'prisma', relative);
  const db = new PrismaClient();
  try { await db.$queryRawUnsafe('PRAGMA wal_checkpoint(FULL);'); } finally { await db.$disconnect(); }
  await fs.copyFile(source, output);
}

const stat = await fs.stat(output);
const manifest = { version: 1, provider, createdAt: new Date().toISOString(), file: path.basename(output), sizeBytes: stat.size, sha256: await checksum(output) };
await fs.writeFile(`${output}.json`, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify(manifest));
