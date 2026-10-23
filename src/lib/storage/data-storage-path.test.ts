import { describe, expect, it } from 'vitest';
import path from 'node:path';
import storage from './data-storage-path.cjs';
import { resolveEvidenceStorageRoot } from './evidence-storage-path.mjs';

describe('durable shared storage paths', () => {
  const root = path.resolve('test-data', 'Traceva');
  it('uses one opt-in root across services', () => {
    const env = { QA_DATA_DIR: root };
    expect(storage.runtimePaths(env)).toEqual({ runtime: root, recordings: path.join(root, 'recordings'), logs: path.join(root, 'logs') });
    expect(resolveEvidenceStorageRoot(env)).toBe(path.join(root, 'evidence'));
  });
  it('preserves explicit overrides', () => {
    const logs = path.resolve('custom-logs');
    const runtime = path.resolve('custom-runtime');
    expect(storage.runtimePaths({ QA_DATA_DIR: root, QA_RUNTIME_DIR: runtime, QA_RELAY_LOGS_DIR: logs }).logs).toBe(logs);
    expect(storage.runtimePaths({ QA_DATA_DIR: root, QA_RUNTIME_DIR: runtime }).recordings).toBe(path.join(runtime, 'recordings'));
  });
  it('preserves legacy logs until explicitly migrated', () => {
    const legacy = path.resolve('legacy-logs');
    expect(storage.runtimePaths({}, legacy).logs).toBe(legacy);
  });
  it('rejects disposable or relative roots', () => {
    expect(() => storage.dataRoot({ QA_DATA_DIR: 'relative' })).toThrow();
    expect(() => storage.runtimePaths({ QA_DATA_DIR: path.join(root, '.next', 'data') })).toThrow();
  });
});
