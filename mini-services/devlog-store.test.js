const { createDevlogStore, createRunKey, safeDate, safeRelativeMs } = require('./devlog-store');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');

describe('devlog PostgreSQL store', () => {
  it('rejects browser clock timestamps outside the PostgreSQL range', () => {
    const fallback = new Date('2026-07-02T00:00:00.000Z');
    expect(safeDate('+058524-05-30T06:36:08.426Z', fallback)).toEqual(fallback);
    expect(safeDate('2026-07-02T00:00:00.000Z', fallback)).toEqual(fallback);
  });

  it('drops relative timestamps that cannot represent a run offset', () => {
    expect(safeRelativeMs(25_000)).toBe(25_000);
    expect(safeRelativeMs(1_782_901_915_261_923)).toBeNull();
  });

  it('persists an event once and returns its sequence cursor', async () => {
    const db = {
      testCase: { findUnique: vi.fn().mockResolvedValue({ projectId: 'project-1' }) },
      bugFix: { findUnique: vi.fn() },
      automationRun: { upsert: vi.fn().mockResolvedValue({ id: 'run-db-1' }) },
      automationEvent: {
        create: vi.fn().mockResolvedValue({ sequence: 42n }),
        findUnique: vi.fn(),
      },
    };
    const store = createDevlogStore(db);
    const result = await store.persistEvent({
      eventId: 'event-1',
      runId: 'run-1',
      mode: 'manual',
      testCaseId: 'tc-1',
      eventType: 'console',
      timestamp: '2026-07-02T00:00:00.000Z',
      message: 'ready',
    });

    expect(createRunKey('tc-1', 'run-1')).toBe('tc-1:run-1');
    expect(result).toEqual({ cursor: '42', runId: 'run-db-1' });
    expect(db.automationEvent.create).toHaveBeenCalledOnce();
  });

  it('evicts a stale project cache after the test case is deleted', async () => {
    const db = {
      testCase: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ projectId: 'deleted-project' })
          .mockResolvedValueOnce(null),
      },
      bugFix: { findUnique: vi.fn().mockResolvedValue(null) },
      automationRun: {
        upsert: vi.fn().mockRejectedValue(Object.assign(new Error('foreign key'), { code: 'P2003' })),
      },
      automationEvent: { create: vi.fn() },
    };
    const store = createDevlogStore(db);

    expect(await store.persistEvent({
      eventId: 'event-after-delete',
      runId: 'run-1',
      testCaseId: 'tc-1',
      eventType: 'run.finished',
      timestamp: '2026-07-02T00:00:00.000Z',
    })).toBeNull();
    expect(db.automationRun.upsert).toHaveBeenCalledOnce();
    expect(db.automationEvent.create).not.toHaveBeenCalled();
  });

  it('returns the newest event window in chronological order', async () => {
    const rows = [
      { sequence: 12n, runId: 'run-db-1', payload: { eventId: 'event-12' } },
      { sequence: 11n, runId: 'run-db-1', payload: { eventId: 'event-11' } },
    ];
    const db = {
      automationEvent: { findMany: vi.fn().mockResolvedValue(rows) },
    };
    const result = await createDevlogStore(db).getEvents('tc-1', 0n, 500, 'run-db-1');

    expect(db.automationEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { testCaseId: 'tc-1', runId: 'run-db-1', sequence: { gt: 0n } },
      orderBy: { sequence: 'desc' },
      take: 501,
    }));
    expect(result.events.map(event => event.cursor)).toEqual(['11', '12']);
    expect(result.cursor).toBe('12');
  });

  it('paginates older events with a before cursor', async () => {
    const db = {
      automationEvent: {
        findMany: vi.fn().mockResolvedValue([
          { sequence: 9n, runId: 'run-db-1', payload: { eventId: 'event-9' } },
          { sequence: 8n, runId: 'run-db-1', payload: { eventId: 'event-8' } },
          { sequence: 7n, runId: 'run-db-1', payload: { eventId: 'event-7' } },
        ]),
      },
    };
    const result = await createDevlogStore(db).getEvents('tc-1', 0n, 2, 'run-db-1', 10n);

    expect(db.automationEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { testCaseId: 'tc-1', runId: 'run-db-1', sequence: { lt: 10n } },
      take: 3,
    }));
    expect(result.events.map(event => event.cursor)).toEqual(['8', '9']);
    expect(result.hasMore).toBe(true);
    expect(result.before).toBe('8');
  });

  it('marks the run finished when recording metadata is finalized', async () => {
    const db = {
      testCase: { findUnique: vi.fn().mockResolvedValue({ projectId: 'project-1' }) },
      bugFix: { findUnique: vi.fn() },
      automationRun: {
        upsert: vi.fn().mockResolvedValue({ id: 'run-db-1' }),
        update: vi.fn().mockResolvedValue({}),
      },
      recording: { upsert: vi.fn().mockResolvedValue({ id: 'recording-db-1' }) },
    };
    await createDevlogStore(db).persistRecording({
      recordingId: 'recording-1',
      runId: 'run-1',
      sessionId: 'session-1',
      testCaseId: 'tc-1',
      mode: 'video',
      status: 'stopped',
      startedAt: '2026-07-02T00:00:00.000Z',
      stoppedAt: '2026-07-02T00:01:00.000Z',
      frames: [],
      video: { status: 'ready' },
    }, 'C:\\recordings\\tc-1\\session-1');

    expect(db.automationRun.update).toHaveBeenCalledWith({
      where: { id: 'run-db-1' },
      data: {
        status: 'finished',
        endedAt: new Date('2026-07-02T00:01:00.000Z'),
      },
    });
    expect(db.recording.upsert).toHaveBeenCalledOnce();
  });

  it('deletes expired runs and their recording media inside the configured root', async () => {
    const mediaRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'devlog-retention-'));
    const recordingDir = path.join(mediaRoot, 'tc-1', 'session-1');
    await fs.mkdir(recordingDir, { recursive: true });
    await fs.writeFile(path.join(recordingDir, 'frame.jpg'), 'frame');
    const db = {
      automationRun: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'expired-run', recording: { mediaRoot: recordingDir } },
        ]),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    try {
      const result = await createDevlogStore(db, { mediaRoots: [mediaRoot] }).cleanup(90);
      expect(result).toEqual({ count: 1 });
      expect(db.automationRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ status: { not: 'running' } }),
      }));
      await expect(fs.stat(recordingDir)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await fs.rm(mediaRoot, { recursive: true, force: true });
    }
  });
});
