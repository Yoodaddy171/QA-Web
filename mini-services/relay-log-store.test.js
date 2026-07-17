const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { createRelayLogStore } = require('./relay-log-store');

const roots = [];
afterEach(async () => Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true }))));

describe('relay log store', () => {
  it('serializes writes and rotates current into previous', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'relay-logs-'));
    roots.push(root);
    const store = createRelayLogStore({ directory: root, logger: { log() {}, error() {} } });
    await store.initialize();
    await Promise.all([store.save({ testCaseId: 'TC/1', log: 'first' }), store.save({ testCaseId: 'TC/1', log: 'second' })]);
    await store.save({ testCaseId: 'TC/1', log: 'Starting Manual Capture' });
    const previous = await store.findSavedRun('TC/1', 'previous');
    const current = await store.findSavedRun('TC/1', 'current');
    expect((await fs.readFile(previous.filePath, 'utf8')).split('\n').filter(Boolean)).toHaveLength(2);
    expect(await fs.readFile(current.filePath, 'utf8')).toContain('Starting Manual Capture');
  });
});
