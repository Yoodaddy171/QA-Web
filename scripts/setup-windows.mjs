import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = fileURLToPath(new URL('..', import.meta.url));
const envFile = path.join(root, '.env');
const databaseUrl = 'file:./db/custom.db';
const origins = 'http://localhost:3000,http://127.0.0.1:3000';
const shell = process.env.ComSpec || 'cmd.exe';
const npm = 'npm.cmd';

async function exists(filename) {
  try {
    await lstat(filename);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function prepareEnv() {
  const template = await readFile(path.join(root, '.env.example'), 'utf8');
  const token = randomBytes(32).toString('hex');
  const settings = {
    QA_RELAY_TOKEN: token,
    NEXT_PUBLIC_QA_RELAY_TOKEN: token,
    QA_RELAY_ALLOW_BROWSER_LAUNCH: '1',
    QA_DATA_DIR: `"${path.join(root, 'data').replaceAll('\\', '/')}"`,
  };
  const contents = template.replace(/^([A-Z_]+)=.*$/gm, (line, key) => (
    Object.hasOwn(settings, key) ? `${key}=${settings[key]}` : line
  ));
  try {
    await writeFile(envFile, contents, { flag: 'wx', mode: 0o600 });
    console.log('.env dibuat dari .env.example dengan token relay baru.');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log('.env sudah ada. Konfigurasi dipertahankan.');
  }
  return parseEnv(await readFile(envFile, 'utf8'));
}

function validateLocalEnv(config) {
  const expected = {
    DATABASE_URL: databaseUrl,
    QA_WEB_HOST: '127.0.0.1',
    PORT: '3000',
    APP_URL: 'http://127.0.0.1:3000',
    QA_ALLOWED_ORIGINS: origins,
    QA_COOKIE_SECURE: '0',
    QA_RELAY_HOST: '127.0.0.1',
    QA_RELAY_PORT: '3001',
    QA_RELAY_ALLOWED_ORIGINS: origins,
  };
  for (const [key, value] of Object.entries(expected)) {
    if ((process.env[key] ?? config[key]) !== value || config[key] !== value) {
      throw new Error(`${key} berbeda dari konfigurasi lokal standar. Ikuti panduan manual untuk konfigurasi khusus.`);
    }
  }
  if (process.env.POSTGRES_DATABASE_URL || config.POSTGRES_DATABASE_URL) {
    throw new Error('Setup ini khusus SQLite lokal. Gunakan panduan deployment untuk PostgreSQL.');
  }
  if (!/^[a-f0-9]{64}$/i.test(config.QA_RELAY_TOKEN ?? '') ||
    config.QA_RELAY_TOKEN !== config.NEXT_PUBLIC_QA_RELAY_TOKEN ||
    ['QA_RELAY_TOKEN', 'NEXT_PUBLIC_QA_RELAY_TOKEN'].some(key => (
      process.env[key] !== undefined && process.env[key] !== config[key]
    ))) {
    throw new Error('Pasangan token relay di .env tidak cocok atau tidak valid. Lihat panduan manual.');
  }
}

function run(label, executable, args, env = process.env) {
  console.log(`\n== ${label} ==`);
  const result = executable === npm
    ? spawnSync(shell, ['/d', '/c', npm, ...args], { cwd: root, env, stdio: 'inherit' })
    : spawnSync(executable, args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${label} gagal (${result.status ?? result.signal}).`);
}

function portInUse(port) {
  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = used => {
      socket.destroy();
      resolve(used);
    };
    socket.setTimeout(1500, () => finish(true));
    socket.once('connect', () => finish(true));
    socket.once('error', error => finish(error.code !== 'ECONNREFUSED'));
  });
}

async function initDatabase(env) {
  const dbDir = path.join(root, 'prisma', 'db');
  const target = path.join(dbDir, 'custom.db');
  await mkdir(dbDir, { recursive: true });
  if (await exists(target)) {
    console.log('Database lokal sudah ada. Langkah pembuatan skema dilewati.');
    return;
  }
  const tempName = `.setup-${randomUUID()}.db`;
  const tempFile = path.join(dbDir, tempName);
  await writeFile(tempFile, '', { flag: 'wx' });
  try {
    run('Siapkan database SQLite baru', process.execPath, [
      'node_modules/prisma/build/index.js', 'db', 'push', '--schema', 'prisma/sqlite.prisma', '--skip-generate',
    ], { ...env, DATABASE_URL: `file:./db/${tempName}` });
    await copyFile(tempFile, target, constants.COPYFILE_EXCL);
  } finally {
    await rm(tempFile, { force: true });
  }
}

async function setupOwner(env) {
  const { PrismaClient } = await import('@prisma/client');
  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    if (await db.user.count()) {
      console.log('Akun sudah tersedia. Pembuatan Owner dilewati.');
      return;
    }
  } finally {
    await db.$disconnect();
  }
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Buka terminal interaktif untuk membuat Owner pertama.');
  }
  let hidden = false;
  const output = new Writable({
    write(chunk, encoding, done) {
      if (!hidden) process.stdout.write(chunk, encoding);
      done();
    },
  });
  const terminal = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  const cancel = new AbortController();
  terminal.on('SIGINT', () => cancel.abort());
  const ask = prompt => terminal.question(prompt, { signal: cancel.signal });
  async function secret(prompt) {
    process.stdout.write(prompt);
    hidden = true;
    try {
      return await ask('');
    } finally {
      hidden = false;
      process.stdout.write('\n');
    }
  }
  try {
    console.log('\nBuat akun Owner pertama');
    const email = (await ask('Email: ')).trim().toLowerCase();
    const name = (await ask('Nama: ')).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
      throw new Error('Isi nama dan email yang valid.');
    }
    const workspace = (await ask('Nama workspace [Local Workspace]: ')).trim() || 'Local Workspace';
    const password = await secret('Password (12-200 karakter): ');
    const confirmation = await secret('Ulangi password: ');
    if (password.length < 12 || password.length > 200 || password !== confirmation) {
      throw new Error('Gunakan password 12-200 karakter dan pastikan kedua input sama.');
    }
    run('Buat Owner', process.execPath, ['scripts/bootstrap-admin.mjs'], {
      ...env,
      QA_BOOTSTRAP_EMAIL: email,
      QA_BOOTSTRAP_NAME: name,
      QA_BOOTSTRAP_WORKSPACE: workspace,
      QA_BOOTSTRAP_PASSWORD: password,
    });
  } finally {
    terminal.close();
  }
}

async function main() {
  process.chdir(root);
  const [mode, ...extra] = process.argv.slice(2);
  if (extra.length || (mode && !['--env-only', '--database', '--owner'].includes(mode))) {
    throw new Error('Opsi yang tersedia: --env-only, --database, --owner.');
  }
  const config = await prepareEnv();
  if (mode === '--env-only') return;
  validateLocalEnv(config);
  const env = { ...config, ...process.env, DATABASE_URL: databaseUrl };
  if (mode === '--database') return initDatabase(env);
  if (mode === '--owner') return setupOwner(env);
  for (const filename of ['.env.local', '.env.production', '.env.production.local']) {
    if (await exists(path.join(root, filename))) {
      throw new Error(`${filename} dapat menimpa konfigurasi build. Ikuti panduan manual untuk instalasi khusus.`);
    }
  }
  const existingInstall = await exists(path.join(root, 'node_modules')) || await exists(path.join(root, '.next'));
  const occupiedPort = (await Promise.all([3000, 3001].map(portInUse))).some(Boolean);
  if (occupiedPort && existingInstall) {
    throw new Error('Port 3000 atau 3001 sedang dipakai. Tutup layanan Traceva terkait sebelum mengulang setup.');
  }
  if (occupiedPort) console.log('Port 3000 atau 3001 sedang dipakai. Bebaskan port sebelum menjalankan hasil setup.');
  run('Instal dependensi dari package-lock.json', npm, ['ci', '--include=dev'], env);
  await initDatabase(env);
  await setupOwner(env);
  run('Instal Chromium untuk Playwright Studio', npm, ['exec', '--', 'playwright', 'install', 'chromium'], {
    ...process.env, PLAYWRIGHT_SKIP_BROWSER_GC: '1',
  });
  run('Build aplikasi standalone', npm, ['run', 'build'], env);
  console.log('\nSetup selesai. Jalankan run-web-qa-production.bat, lalu buka http://127.0.0.1:3000.');
  console.log('Untuk Playwright Studio, jalankan npm run automation:runner di terminal terpisah.');
}

main().catch(error => {
  console.error(`\nSetup gagal: ${error.name === 'AbortError' ? 'dibatalkan.' : error.message}`);
  process.exitCode = 1;
});
