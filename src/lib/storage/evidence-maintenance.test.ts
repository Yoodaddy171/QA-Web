import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { auditEvidence, evidenceSummary, evidenceTarget, fileIntegrity, writeSqliteBackupSidecar } from '../../../scripts/lib/evidence-maintenance.mjs';

const roots: string[] = [];
afterEach(async () => { for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true }); });
async function setup() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'evidence-maintenance-')); roots.push(root);
  const source = path.join(root, 'old'); const target = path.join(root, 'permanent');
  await fs.mkdir(source); await fs.mkdir(target);
  const key = 'project/run/photo.png';
  await fs.mkdir(path.dirname(evidenceTarget(source, key)), { recursive: true });
  await fs.writeFile(evidenceTarget(source, key), 'original');
  return { root, source, target, key, record: { id: 'e1', project: 'Project', storagePath: key, sizeBytes: 8, sha256: crypto.createHash('sha256').update('original').digest('hex') } };
}
describe('non-destructive evidence maintenance', () => {
  it('audits without copying, then copies with checksum verification and leaves source untouched', async () => {
    const f = await setup();
    expect((await auditEvidence([f.record], f.target, [f.source]))[0].status).toBe('recoverable');
    expect(await fileIntegrity(evidenceTarget(f.target, f.key))).toBeNull();
    const result = await auditEvidence([f.record], f.target, [f.source], true);
    expect(result[0].status).toBe('copied-verified');
    expect(await fs.readFile(evidenceTarget(f.source, f.key), 'utf8')).toBe('original');
    expect((await auditEvidence([f.record], f.target, [f.source], true))[0].status).toBe('verified');
    expect(evidenceSummary(result)).toMatchObject({ Project: { total: 1, durable: 1, missing: 0 } });
  });
  it('never overwrites a conflicting destination', async () => {
    const f = await setup(); await fs.mkdir(path.dirname(evidenceTarget(f.target, f.key)), { recursive: true });
    await fs.writeFile(evidenceTarget(f.target, f.key), 'different');
    expect((await auditEvidence([f.record], f.target, [f.source], true))[0].status).toBe('target-conflict');
    expect(await fs.readFile(evidenceTarget(f.target, f.key), 'utf8')).toBe('different');
  });
  it('skips a wrong source hash and finds a matching copy in another root', async () => {
    const f = await setup(); const wrong = path.join(f.root, 'wrong');
    await fs.mkdir(path.dirname(evidenceTarget(wrong, f.key)), { recursive: true }); await fs.writeFile(evidenceTarget(wrong, f.key), 'corrupt!');
    const result = await auditEvidence([f.record], f.target, [wrong, f.source], true);
    expect(result[0]).toMatchObject({ status: 'copied-verified', source: evidenceTarget(f.source, f.key) });
  });
  it('reports missing and unsupported references without deleting records or source files', async () => {
    const f = await setup(); const records = [f.record, { ...f.record, id: 'e2', storagePath: 'missing.png' }, { ...f.record, id: 'e3', storagePath: '../outside' }];
    const before = JSON.stringify(records);
    const results = await auditEvidence(records, f.target, [f.source]);
    expect(results.map(item => item.status)).toEqual(['recoverable', 'missing', 'unsupported-key']);
    expect(JSON.stringify(records)).toBe(before);
    expect(() => evidenceTarget(f.target, path.resolve(f.source, f.key))).toThrow();
  });
  it('distinguishes missing historical hashes from verified database hashes', async () => {
    const f = await setup();
    const results = await auditEvidence([{ ...f.record, sha256: null }], f.target, [f.source], true);
    expect(results[0].status).toBe('copied-no-recorded-hash');
    expect(evidenceSummary(results)).toMatchObject({ Project: { durable: 1, noRecordedHash: 1 } });
  });
  it('writes a database checksum sidecar compatible with the existing restore command', async () => {
    const f = await setup(); const file = path.join(f.root, 'database.sqlite'); await fs.writeFile(file, 'fixture');
    const sidecar = await writeSqliteBackupSidecar(file);
    expect(sidecar).toMatchObject({ version: 1, provider: 'sqlite', file: 'database.sqlite', sizeBytes: 7 });
    expect(sidecar.sha256).toBe(crypto.createHash('sha256').update('fixture').digest('hex'));
    expect(JSON.parse(await fs.readFile(`${file}.json`, 'utf8'))).toEqual(sidecar);
    await expect(writeSqliteBackupSidecar(file)).rejects.toThrow();
  });
});
