import { randomBytes, scrypt as deriveKey } from 'node:crypto';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { PrismaClient } from '@prisma/client';

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Jalankan dari terminal interaktif.');
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith('file:') || !url.slice(5) || /[?#]/.test(url)) {
    throw new Error('Skrip ini hanya mendukung file database SQLite lokal Traceva.');
  }
  const filename = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../prisma', url.slice(5));
  if (!(await stat(filename)).isFile()) throw new Error('File database tidak ditemukan.');
  const db = new PrismaClient({ datasourceUrl: `file:${filename.replaceAll('\\', '/')}` });
  let hidden = false;
  const output = new Writable({ write(chunk, _encoding, callback) {
    if (!hidden) process.stdout.write(chunk);
    callback();
  } });
  const terminal = createInterface({ input: process.stdin, output, terminal: true, historySize: 0 });
  const cancel = new AbortController();
  terminal.on('SIGINT', () => cancel.abort());
  const ask = (prompt) => terminal.question(prompt, { signal: cancel.signal });
  async function secret(prompt) {
    process.stdout.write(prompt);
    hidden = true;
    try { return await ask(''); }
    finally { hidden = false; process.stdout.write('\n'); }
  }

  try {
    const email = (await ask('Email akun Traceva: ')).trim().toLowerCase();
    const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (!user) throw new Error('Akun tidak ditemukan di database ini.');
    const password = await secret('Password baru (minimal 12 karakter): ');
    const confirmation = await secret('Ulangi password baru: ');
    if (password !== confirmation) throw new Error('Kedua password tidak cocok.');
    if (password.length < 12 || password.length > 200) throw new Error('Password harus 12–200 karakter.');
    console.log(`Database: ${filename}\nAkun: ${user.email}\nSesi login akun ini akan dicabut.`);
    if ((await ask('Ketik RESET untuk melanjutkan: ')).trim() !== 'RESET') return;
    const salt = randomBytes(16).toString('hex');
    const key = await promisify(deriveKey)(password, salt, 64);
    if (cancel.signal.aborted) return;
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { passwordHash: `scrypt$${salt}$${key.toString('hex')}` } }),
      db.session.deleteMany({ where: { userId: user.id } }),
    ]);
    console.log('Password berhasil direset. Silakan login kembali.');
  } finally {
    terminal.close();
    await db.$disconnect();
  }
}

main().catch(error => {
  console.error(error.name === 'AbortError' ? 'Reset dibatalkan.' : error.code || error.name === 'PrismaClientInitializationError'
    ? 'Reset gagal. Periksa konfigurasi database SQLite dan Prisma Client.' : error.message);
  process.exitCode = 1;
});
