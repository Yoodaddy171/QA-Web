// Offline, copy-only migration. Configuration is activated separately after verification.
import fs from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import net from 'node:net';
import { PrismaClient } from '@prisma/client';
import storage from '../src/lib/storage/data-storage-path.cjs';
import { resolveEvidenceStorageRoot } from '../src/lib/storage/evidence-storage-path.mjs';
import { fileIntegrity } from './lib/evidence-maintenance.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = { ...process.env, ...parseEnv((await fs.readFile(path.join(root, '.env'), 'utf8')).replace(/^\uFEFF/, '')) };
const apply = process.argv.includes('--apply');
const destination = storage.dataRoot({ ...env, QA_DATA_DIR: process.env.TRACEVA_MIGRATION_TARGET || '' });
const old = storage.runtimePaths(env, path.join(root, 'mini-services', 'logs'));
const sources = {
  evidence: resolveEvidenceStorageRoot(env),
  recordings: old.recordings,
  logs: old.logs,
  automation: env.QA_SCRIPT_RUNNER_DIR || path.join(storage.dataRoot(env), 'automation'),
};
async function rejectLinkedAncestors(directory) {
  let current = path.resolve(directory);
  for (;;) {
    try { if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('Linked storage directory tidak didukung.'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}
await rejectLinkedAncestors(destination);
for (const source of Object.values(sources)) await rejectLinkedAncestors(source);
if (!env.DATABASE_URL?.startsWith('file:') || env.POSTGRES_DATABASE_URL) throw new Error('Migration ini hanya untuk SQLite lokal.');
const database = path.resolve(root, 'prisma', env.DATABASE_URL.slice(5));
for (const port of [Number(env.PORT || 3000), Number(env.QA_RELAY_PORT || 3001)]) {
  const listening = await new Promise(resolve => {
    const socket = net.connect({ host: '127.0.0.1', port });
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false));
  });
  if (listening) throw new Error(`Hentikan layanan port ${port} sebelum migrasi.`);
}
async function files(dir) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  const result = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw new Error('Symlink tidak didukung dalam migrasi.');
    const item = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(item));
    else if (entry.isFile()) result.push(item);
  }
  return result;
}
const manifest = { createdAt: new Date().toISOString(), destination, sources, files: [], databaseChanges: [] };
for (const [kind, source] of Object.entries(sources)) {
  const target = path.join(destination, kind);
  const same = path.resolve(source) === path.resolve(target);
  if (!same && (!path.relative(source, target).startsWith('..') || !path.relative(target, source).startsWith('..'))) {
    throw new Error('Source dan destination tidak boleh saling berada di dalamnya.');
  }
  for (const file of await files(source)) {
    const relative = path.relative(source, file);
    if (kind === 'automation' && /(?:^|[\\/])(?:worker\.lock|heartbeat\.json)$/.test(relative)) continue;
    const to = path.join(target, relative);
    const before = await fileIntegrity(file);
    const existing = await fileIntegrity(to);
    if (existing && existing.sha256 !== before.sha256) throw new Error(`Konflik file ${kind}/${relative}`);
    manifest.files.push({ kind, relative, source: file, target: to, ...before });
  }
}
const db = new PrismaClient({ datasources: { db: { url: `file:${database.replaceAll('\\', '/')}` } } });
try {
  const counts = async () => Object.fromEntries(await Promise.all(['Project', 'TestCase', 'TestExecution', 'TestExecutionEvidence', 'Recording'].map(async table => [table, Number((await db.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM "${table}"`))[0].n)])));
  manifest.countsBefore = await counts();
  const evidence = await db.$queryRawUnsafe('SELECT id, storagePath FROM TestExecutionEvidence');
  for (const row of evidence) {
    if (!path.isAbsolute(row.storagePath)) continue;
    let relative = path.relative(sources.evidence, row.storagePath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      relative = path.relative(path.join(root, 'data', 'evidence'), row.storagePath);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Absolute evidence path di luar sumber yang dikenal.');
      await rejectLinkedAncestors(row.storagePath);
      const integrity = await fileIntegrity(row.storagePath);
      if (!integrity) throw new Error('Legacy absolute evidence tidak ditemukan.');
      const target = path.join(destination, 'evidence', relative);
      const existing = await fileIntegrity(target);
      if (existing && existing.sha256 !== integrity.sha256) throw new Error('Legacy absolute evidence conflict.');
      manifest.files.push({ kind: 'evidence', relative, source: row.storagePath, target, ...integrity });
    }
    manifest.databaseChanges.push({ table: 'TestExecutionEvidence', id: row.id, before: row.storagePath, after: relative.replaceAll('\\', '/') });
  }
  const recordings = await db.$queryRawUnsafe('SELECT id, mediaRoot FROM Recording');
  for (const row of recordings) {
    const relative = path.relative(sources.recordings, row.mediaRoot);
    if (relative.startsWith('..') || path.isAbsolute(relative)) continue;
    const after = path.join(destination, 'recordings', relative);
    if (after === row.mediaRoot) continue;
    manifest.databaseChanges.push({ table: 'Recording', id: row.id, before: row.mediaRoot, after });
  }
  console.log(JSON.stringify({ apply, destination, count: manifest.files.length, bytes: manifest.files.reduce((n, f) => n + f.sizeBytes, 0), counts: manifest.countsBefore, referenceChanges: manifest.databaseChanges.length }));
  if (apply) {
    const report = path.join(destination, 'maintenance', `${Date.now()}-storage-migration`);
    await fs.mkdir(report, { recursive: true });
    await fs.copyFile(path.join(root, '.env'), path.join(report, 'env.backup'), constants.COPYFILE_EXCL);
    await db.$executeRawUnsafe(`VACUUM INTO '${path.join(report, 'database.sqlite').replaceAll('\\', '/').replaceAll("'", "''")}'`);
    for (const kind of Object.keys(sources)) await fs.mkdir(path.join(destination, kind), { recursive: true });
    for (const item of manifest.files) {
      await fs.mkdir(path.dirname(item.target), { recursive: true });
      if (!(await fileIntegrity(item.target))) await fs.copyFile(item.source, item.target, constants.COPYFILE_EXCL);
      const [source, target] = await Promise.all([fileIntegrity(item.source), fileIntegrity(item.target)]);
      if (source?.sha256 !== item.sha256 || target?.sha256 !== item.sha256) throw new Error('Verifikasi hash gagal; konfigurasi belum diaktifkan.');
    }
    await fs.writeFile(path.join(report, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
    await db.$transaction(async tx => {
      for (const change of manifest.databaseChanges) {
        const field = change.table === 'Recording' ? 'mediaRoot' : 'storagePath';
        await tx.$executeRawUnsafe(`UPDATE "${change.table}" SET "${field}" = ? WHERE id = ? AND "${field}" = ?`, change.after, change.id, change.before);
      }
    });
    manifest.countsAfter = await counts();
    if (JSON.stringify(manifest.countsBefore) !== JSON.stringify(manifest.countsAfter)) throw new Error('Row count berubah.');
    manifest.integrity = await db.$queryRawUnsafe('PRAGMA integrity_check');
    if (manifest.integrity.some(row => row.integrity_check !== 'ok')) throw new Error('SQLite integrity check gagal.');
    await fs.writeFile(path.join(report, 'verified.json'), JSON.stringify({ counts: manifest.countsAfter, integrity: manifest.integrity, verifiedFiles: manifest.files.length }, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ verified: true, report, files: manifest.files.length, counts: manifest.countsAfter }));
  }
} finally { await db.$disconnect(); }
