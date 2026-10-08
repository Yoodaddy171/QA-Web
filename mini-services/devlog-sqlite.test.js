const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');
const { createDevlogStore } = require('./devlog-store');

it('SQLite persists Devlog events, deduplicates, pages cursors, and reads recording metadata', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-devlog-sqlite-'));
  const url = `file:${path.join(directory, 'test.db').replaceAll('\\', '/')}`;
  // On Windows the schema engine expects the absolute SQLite file to exist.
  fs.closeSync(fs.openSync(path.join(directory, 'test.db'), 'wx'));
  const pushed = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--schema', 'prisma/sqlite.prisma', '--skip-generate'], {
    env: { ...process.env, DATABASE_URL: url }, encoding: 'utf8', windowsHide: true,
  });
  expect(pushed.status, pushed.stderr).toBe(0);
  const db = new PrismaClient({ datasourceUrl: url });
  const store = createDevlogStore(db, { allowOrphans: true, sqlite: true });
  try {
    const event = { eventId: 'event-1', runId: 'run-1', testCaseId: 'fixture', mode: 'manual', eventType: 'network.request', timestamp: new Date().toISOString() };
    const first = await store.persistEvent(event);
    expect(BigInt(first.cursor)).toBeGreaterThan(0n);
    expect(await store.persistEvent(event)).toEqual(first);
    await store.persistEvent({ ...event, eventId: 'event-2', eventType: 'network.response' });
    const page = await store.getEvents('fixture', BigInt(first.cursor));
    expect(page.events.map(row => row.event.eventType)).toEqual(['network.response']);
    expect(await store.getRuns('fixture')).toHaveLength(1);
    await store.persistRecording({ recordingId: 'recording-1', sessionId: 'run-1', testCaseId: 'fixture', startedAt: event.timestamp, status: 'finished' }, directory);
    expect(await store.getLatestRecording('fixture')).toMatchObject({ recordingId: 'recording-1' });
    expect((await store.getRuns('fixture'))[0].status).toBe('finished');
  } finally { await db.$disconnect(); }
}, 30000);
