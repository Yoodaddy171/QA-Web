import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const command = args[0];
const configuredUrl = process.env.POSTGRES_DATABASE_URL;
const postgresUrl = /^postgres(?:ql)?:\/\//i.test(configuredUrl || '')
  ? configuredUrl
  : command === 'validate'
    ? 'postgresql://validation:validation@127.0.0.1:5432/validation'
    : null;

if (!postgresUrl) {
  console.error('POSTGRES_DATABASE_URL wajib berisi URL postgresql:// sebelum migration dijalankan.');
  process.exit(1);
}

const prismaCli = path.resolve('node_modules', 'prisma', 'build', 'index.js');
const result = spawnSync(process.execPath, [prismaCli, ...args, '--schema', 'prisma/schema.prisma'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: postgresUrl },
});
process.exit(result.status ?? 1);
