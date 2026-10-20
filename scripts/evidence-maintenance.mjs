// Local SQLite maintenance only. No record updates, source deletes or overwrites.
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { assertDurableEvidenceRoot, resolveEvidenceStorageRoot } from '../src/lib/storage/evidence-storage-path.mjs';
import { auditEvidence, evidenceSummary, evidenceTarget, fileIntegrity, writeSqliteBackupSidecar } from './lib/evidence-maintenance.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localEnv = parseEnv((await fs.readFile(path.join(projectRoot, '.env'), 'utf8')).replace(/^\uFEFF/, ''));
for (const [key, value] of Object.entries(localEnv)) if (process.env[key] === undefined) process.env[key] = value;
const mode = process.argv[2] || 'audit';
if (!['audit', 'migrate', 'backup'].includes(mode)) throw new Error('Gunakan audit, migrate, atau backup.');
const url = process.env.DATABASE_URL || '';
if (!url.startsWith('file:')) throw new Error('Utility ini hanya untuk SQLite lokal. DATABASE_URL harus file:.');
const databasePath = path.resolve(projectRoot, 'prisma', url.slice(5));
await fs.access(databasePath); // Never create an accidental empty database.
const targetRoot = resolveEvidenceStorageRoot();
if (mode !== 'audit') {
  const listening = await new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port: Number(process.env.PORT || 3000) });
    socket.setTimeout(2000); socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('error', () => resolve(false)); socket.once('timeout', () => { socket.destroy(); resolve(true); });
  });
  if (listening) throw new Error('Hentikan server aplikasi sebelum migrate/backup agar tidak ada upload yang tertinggal.');
  await fs.mkdir(targetRoot, { recursive: true });
  assertDurableEvidenceRoot(await fs.realpath(targetRoot));
}
const sources = [...new Set([
  path.join(projectRoot, '.next', 'standalone', 'data', 'evidence', 'execution-evidence'),
  path.join(projectRoot, '.next', 'standalone', 'data', 'evidence'),
  path.join(projectRoot, 'data', 'evidence', 'execution-evidence'),
  path.join(projectRoot, 'data', 'evidence'),
  ...(process.env.QA_RUNTIME_DIR ? [path.join(process.env.QA_RUNTIME_DIR, 'execution-evidence')] : []),
].map(root => path.resolve(root)))];
const db = new PrismaClient({ datasourceUrl: `file:${databasePath.replaceAll('\\', '/')}` });
const records = async () => (await db.testExecutionEvidence.findMany({ orderBy: { id: 'asc' }, select: {
  id: true, storagePath: true, sha256: true, sizeBytes: true, fileName: true, createdAt: true,
  execution: { select: { testCase: { select: { testCaseId: true } }, testRun: { select: { name: true, project: { select: { id: true, name: true } } } } } },
} })).map(({ execution, ...record }) => ({ ...record, testCaseId: execution.testCase.testCaseId, run: execution.testRun.name, project: `${execution.testRun.project.name} [${execution.testRun.project.id}]` }));
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const stateRoot = path.join(path.dirname(targetRoot), 'maintenance');
assertDurableEvidenceRoot(stateRoot);
await fs.mkdir(stateRoot, { recursive: true });
try {
  const before = await records();
  const results = await auditEvidence(before, targetRoot, sources, mode === 'migrate');
  const report = { version: 1, mode, createdAt: new Date().toISOString(), databasePath, targetRoot, sourceRoots: sources, summary: evidenceSummary(results), results };
  const output = path.join(stateRoot, `${stamp}-${mode}.json`);
  await fs.writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx' });
  if (mode === 'backup') {
    const available = results.filter(item => ['verified', 'present-no-recorded-hash'].includes(item.status));
    const unresolved = results.filter(item => !available.includes(item));
    const backup = path.join(stateRoot, `${stamp}-backup`);
    await fs.mkdir(backup);
    const snapshot = path.join(backup, 'database.sqlite');
    // SQLite's snapshot API avoids unsafe raw copying of a live WAL database.
    await db.$executeRawUnsafe(`VACUUM INTO '${snapshot.replaceAll("'", "''")}'`);
    const files = [];
    for (const item of available) {
      const destination = evidenceTarget(path.join(backup, 'evidence'), item.storagePath);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.copyFile(item.target, destination, fs.constants.COPYFILE_EXCL);
      const copied = await fileIntegrity(destination);
      if (copied.sha256 !== item.actual.sha256) throw new Error(`Checksum backup evidence tidak cocok: ${item.id}`);
      files.push({ id: item.id, key: item.storagePath, ...copied });
    }
    if (JSON.stringify(before) !== JSON.stringify(await records())) throw new Error('Metadata evidence berubah selama backup. Backup tidak dinyatakan lengkap.');
    const snapshotDb = new PrismaClient({ datasourceUrl: `file:${snapshot.replaceAll('\\', '/')}` });
    let integrity;
    try { integrity = await snapshotDb.$queryRawUnsafe('PRAGMA integrity_check'); } finally { await snapshotDb.$disconnect(); }
    if (integrity.some(row => Object.values(row).some(value => value !== 'ok'))) throw new Error('Integritas snapshot SQLite gagal.');
    await writeSqliteBackupSidecar(snapshot);
    await fs.writeFile(path.join(backup, 'manifest.json'), JSON.stringify({ version: 1, complete: unresolved.length === 0, createdAt: new Date().toISOString(), database: await fileIntegrity(snapshot), evidenceRoot: targetRoot, files, unresolved, sqliteIntegrity: integrity }, null, 2), { flag: 'wx' });
    report.backup = backup;
  }
  if (JSON.stringify(before) !== JSON.stringify(await records())) throw new Error('Metadata evidence berubah saat maintenance. Jalankan audit ulang sebelum build.');
  console.log(JSON.stringify({ mode, targetRoot, summary: report.summary, report: output, backup: report.backup || null }, null, 2));
  if (results.some(item => ['target-conflict', 'source-mismatch', 'unsupported-key', 'missing', 'recoverable'].includes(item.status))) process.exitCode = 2;
} finally { await db.$disconnect(); }
