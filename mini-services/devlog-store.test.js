const { createDevlogStore, createRunKey } = require('./devlog-store');

describe('devlog PostgreSQL store', () => {
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

  it('returns the newest event window in chronological order', async () => {
    const rows = [
      { sequence: 12n, runId: 'run-db-1', payload: { eventId: 'event-12' } },
      { sequence: 11n, runId: 'run-db-1', payload: { eventId: 'event-11' } },
    ];
    const db = {
      automationEvent: { findMany: vi.fn().mockResolvedValue(rows) },
    };
    const result = await createDevlogStore(db).getEvents('tc-1', 0n, 500);

    expect(db.automationEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: { sequence: 'desc' },
      take: 500,
    }));
    expect(result.events.map(event => event.cursor)).toEqual(['11', '12']);
    expect(result.cursor).toBe('12');
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
});
