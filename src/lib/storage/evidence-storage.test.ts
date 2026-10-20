import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalEvidenceStorage } from './evidence-storage';
import { assertDurableEvidenceRoot, resolveEvidenceStorageRoot } from './evidence-storage-path.mjs';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true }))));

async function storage() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'qa-evidence-'));
  roots.push(root);
  return { root, adapter: new LocalEvidenceStorage(root) };
}

describe('local evidence storage', () => {
  it('uses durable user storage instead of cwd/build output, with explicit runtime support', () => {
    const local = path.join(os.tmpdir(), 'user-data');
    expect(resolveEvidenceStorageRoot({ LOCALAPPDATA: local })).toBe(path.join(local, 'QADesk', 'evidence'));
    expect(resolveEvidenceStorageRoot({ QA_EVIDENCE_STORAGE_DIR: local })).toBe(local);
    expect(resolveEvidenceStorageRoot({ QA_RUNTIME_DIR: local })).toBe(path.join(local, 'execution-evidence'));
    expect(resolveEvidenceStorageRoot({}, local)).toBe(path.join(local, '.local', 'share', 'QADesk', 'evidence'));
  });

  it('rejects unsafe/relative storage roots, including explicit build-output overrides', () => {
    for (const root of ['data/evidence', path.join(os.tmpdir(), '.next', 'standalone', 'data'), path.join(os.tmpdir(), '.NEXT', 'data')]) {
      expect(() => assertDurableEvidenceRoot(root)).toThrow();
      expect(() => resolveEvidenceStorageRoot({ QA_EVIDENCE_STORAGE_DIR: root })).toThrow();
    }
    expect(() => resolveEvidenceStorageRoot({ QA_RUNTIME_DIR: path.join(os.tmpdir(), '.next') })).toThrow();
  });

  it('does not delete or overwrite an existing evidence file on key collision', async () => {
    const { root, adapter } = await storage();
    await adapter.put(new Blob(['original']).stream(), 'project/file.bin', 100);
    await expect(adapter.put(new Blob(['replacement']).stream(), 'project/file.bin', 100)).rejects.toThrow();
    expect(await fs.readFile(path.join(root, 'project/file.bin'), 'utf8')).toBe('original');
  });
  it('streams data to a relative key and returns an integrity hash', async () => {
    const { adapter } = await storage();
    const bytes = new TextEncoder().encode('evidence');
    const saved = await adapter.put(new Blob([bytes]).stream(), 'project/execution/file.bin', 1024);
    expect(saved).toEqual({
      key: 'project/execution/file.bin',
      size: bytes.byteLength,
      hash: crypto.createHash('sha256').update(bytes).digest('hex'),
    });
  });

  it('removes partial files when the streamed size exceeds the limit', async () => {
    const { root, adapter } = await storage();
    await expect(adapter.put(new Blob(['too large']).stream(), 'project/file.bin', 2)).rejects.toThrow('melebihi batas');
    await expect(fs.access(path.join(root, 'project', 'file.bin'))).rejects.toThrow();
  });

  it('rejects traversal and absolute paths outside the storage root', async () => {
    const { adapter } = await storage();
    await expect(adapter.put(new Blob(['x']).stream(), '../escape.bin', 10)).rejects.toThrow('tidak valid');
    await expect(adapter.read(path.resolve(os.tmpdir(), 'outside.bin'))).rejects.toThrow('di luar storage root');
  });
});
