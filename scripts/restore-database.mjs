import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

if (process.env.QA_RESTORE_CONFIRM !== 'RESTORE') throw new Error('Restore ditolak. Set QA_RESTORE_CONFIRM=RESTORE setelah aplikasi dihentikan.');
const input = path.resolve(process.env.QA_RESTORE_FILE || process.argv[2] || '');
if (!input) throw new Error('QA_RESTORE_FILE wajib diisi.');
const databaseUrl = process.env.DATABASE_URL || 'file:./db/custom.db';

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { env, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`)));
  });
}

const manifest = JSON.parse(await fs.readFile(`${input}.json`, 'utf8'));
const hash = crypto.createHash('sha256').update(await fs.readFile(input)).digest('hex');
if (manifest.sha256 !== hash) throw new Error('Checksum backup tidak cocok; restore dibatalkan.');

if (/^postgres(?:ql)?:\/\//i.test(databaseUrl)) {
  if (manifest.provider !== 'postgresql') throw new Error('Provider backup tidak cocok dengan target PostgreSQL.');
  const url = new URL(databaseUrl);
  const env = { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password) };
  if (url.searchParams.get('sslmode')) env.PGSSLMODE = url.searchParams.get('sslmode');
  await run(process.env.PG_RESTORE_PATH || 'pg_restore', ['--clean', '--if-exists', '--no-owner', '--dbname', decodeURIComponent(url.pathname.slice(1)), input], env);
} else {
  if (manifest.provider !== 'sqlite') throw new Error('Provider backup tidak cocok dengan target SQLite.');
  const target = path.resolve(process.cwd(), 'prisma', databaseUrl.replace(/^file:/, ''));
  const safetyCopy = `${target}.before-restore-${Date.now()}`;
  await fs.copyFile(target, safetyCopy).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await fs.copyFile(input, target);
  await fs.rm(`${target}-wal`, { force: true });
  await fs.rm(`${target}-shm`, { force: true });
}
console.log(JSON.stringify({ restored: path.basename(input), provider: manifest.provider }));
