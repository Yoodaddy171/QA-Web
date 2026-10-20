import fs from 'node:fs/promises';
import { createReadStream, constants } from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

export async function fileIntegrity(file) {
  try {
    const stat = await fs.stat(file);
    if (!stat.isFile()) return null;
    const hash = crypto.createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    return { sizeBytes: stat.size, sha256: hash.digest('hex') };
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export function evidenceTarget(root, key) {
  if (!key || path.isAbsolute(key) || key.split(/[\\/]/).includes('..')) throw new Error('Storage key harus relatif dan tidak boleh mengandung traversal.');
  const file = path.resolve(root, key);
  const relative = path.relative(root, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Storage key di luar target.');
  return file;
}

export async function auditEvidence(records, targetRoot, sourceRoots, copy = false) {
  const results = [];
  const hashCache = new Map();
  const inspect = file => {
    if (!hashCache.has(file)) hashCache.set(file, fileIntegrity(file));
    return hashCache.get(file);
  };
  for (const record of records) {
    const item = { id: record.id, project: record.project, testCaseId: record.testCaseId, run: record.run, fileName: record.fileName, createdAt: record.createdAt, storagePath: record.storagePath, expectedSha256: record.sha256, expectedBytes: record.sizeBytes };
    let target;
    try { target = evidenceTarget(targetRoot, record.storagePath); }
    catch (error) { results.push({ ...item, status: 'unsupported-key', message: error.message }); continue; }
    const matches = file => file && file.sizeBytes === record.sizeBytes && (!record.sha256 || file.sha256 === record.sha256.toLowerCase());
    const existing = await inspect(target);
    if (existing) {
      results.push({ ...item, status: matches(existing) ? (record.sha256 ? 'verified' : 'present-no-recorded-hash') : 'target-conflict', target, actual: existing });
      continue;
    }
    let source;
    let integrity;
    const mismatches = [];
    for (const root of sourceRoots) {
      const candidate = evidenceTarget(root, record.storagePath);
      const current = await inspect(candidate);
      if (matches(current)) { source = candidate; integrity = current; break; }
      if (current) mismatches.push({ source: candidate, actual: current });
    }
    if (!source) { results.push({ ...item, status: mismatches.length ? 'source-mismatch' : 'missing', mismatches }); continue; }
    if (!copy) { results.push({ ...item, status: 'recoverable', source, target, actual: integrity }); continue; }
    await fs.mkdir(path.dirname(target), { recursive: true });
    try { await fs.copyFile(source, target, constants.COPYFILE_EXCL); }
    catch (error) { if (error.code !== 'EEXIST') throw error; }
    const copied = await fileIntegrity(target);
    if (!matches(copied) || copied.sha256 !== integrity.sha256) throw new Error(`Verifikasi salinan evidence gagal: ${record.id}`);
    hashCache.set(target, Promise.resolve(copied));
    results.push({ ...item, status: record.sha256 ? 'copied-verified' : 'copied-no-recorded-hash', source, target, actual: copied });
  }
  return results;
}

export function evidenceSummary(results) {
  const projects = Object.create(null);
  for (const item of results) {
    const project = projects[item.project] ||= { total: 0, durable: 0, recoverable: 0, missing: 0, conflicts: 0, noRecordedHash: 0 };
    project.total++;
    if (['verified', 'copied-verified', 'present-no-recorded-hash', 'copied-no-recorded-hash'].includes(item.status)) project.durable++;
    if (item.status.includes('no-recorded-hash')) project.noRecordedHash++;
    if (item.status === 'recoverable') project.recoverable++;
    if (item.status === 'missing') project.missing++;
    if (['target-conflict', 'source-mismatch', 'unsupported-key'].includes(item.status)) project.conflicts++;
  }
  return projects;
}

// Same sidecar contract consumed by scripts/restore-database.mjs.
export async function writeSqliteBackupSidecar(snapshot) {
  const integrity = await fileIntegrity(snapshot);
  if (!integrity) throw new Error('Snapshot SQLite tidak ditemukan.');
  const manifest = { version: 1, provider: 'sqlite', createdAt: new Date().toISOString(), file: path.basename(snapshot), ...integrity };
  await fs.writeFile(`${snapshot}.json`, JSON.stringify(manifest, null, 2), { flag: 'wx' });
  return manifest;
}
