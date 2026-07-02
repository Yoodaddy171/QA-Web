const path = require('path');
const fs = require('fs/promises');
const os = require('os');

function loadDatabaseUrl() {
  if (process.env.POSTGRES_DATABASE_URL || typeof process.loadEnvFile !== 'function') return;
  try {
    process.loadEnvFile(path.join(__dirname, '..', '.env'));
  } catch (_) {}
}

function jsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function createRunKey(testCaseId, runId) {
  return `${testCaseId}:${runId}`;
}

function safeDate(value, fallback = new Date()) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  return Number.isNaN(date.getTime()) || year < 2000 || year > 2100 ? fallback : date;
}

function safeRelativeMs(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 7 * 24 * 60 * 60 * 1000
    ? Math.round(number)
    : null;
}

function createDevlogStore(db, options = {}) {
  const projectCache = new Map();
  const mediaRoots = (options.mediaRoots || []).map(root => path.resolve(root));
  const allowOrphans = options.allowOrphans === true;

  async function resolveEntity(testCaseId) {
    if (projectCache.has(testCaseId)) return projectCache.get(testCaseId);
    const testCase = await db.testCase.findUnique({
      where: { id: testCaseId },
      select: { projectId: true },
    });
    const entity = testCase
      ? { projectId: testCase.projectId, source: 'testcase' }
      : await db.bugFix.findUnique({
        where: { id: testCaseId },
        select: { projectId: true },
      }).then(item => item ? { projectId: item.projectId, source: 'bugfix' } : null);
    const resolved = entity || (allowOrphans ? { projectId: null, source: 'orphan' } : null);
    if (resolved) projectCache.set(testCaseId, resolved);
    return resolved;
  }

  async function ensureRun(event, retry = true) {
    const entity = await resolveEntity(event.testCaseId);
    if (!entity) return null;
    const runKey = createRunKey(event.testCaseId, event.runId);
    const timestamp = safeDate(event.timestamp);
    const finished = event.eventType === 'run.finished';
    try {
      return await db.automationRun.upsert({
        where: { runKey },
        create: {
          runKey,
          externalRunId: event.runId,
          sessionId: event.browserSessionId || null,
          projectId: entity.projectId,
          testCaseId: event.testCaseId,
          source: entity.source,
          mode: event.mode || 'unknown',
          status: finished ? 'finished' : 'running',
          startedAt: timestamp,
          endedAt: finished ? timestamp : null,
        },
        update: finished
          ? { status: 'finished', endedAt: timestamp }
          : {},
      });
    } catch (error) {
      if (error?.code === 'P2003' && retry) {
        projectCache.delete(event.testCaseId);
        return ensureRun(event, false);
      }
      if (error?.code !== 'P2002') throw error;
      return db.automationRun.findUnique({ where: { runKey } });
    }
  }

  async function persistEvent(event) {
    const run = await ensureRun(event);
    if (!run) return null;
    const payload = jsonValue(event);
    const relativeMs = safeRelativeMs(payload.metadata?.legacy?.relativeMs);
    if (payload.metadata?.legacy && relativeMs === null) delete payload.metadata.legacy.relativeMs;
    const data = {
      eventId: event.eventId,
      runId: run.id,
      testCaseId: event.testCaseId,
      eventType: event.eventType || 'log',
      timestamp: safeDate(event.timestamp),
      relativeMs,
      payload,
    };
    try {
      const saved = await db.automationEvent.create({ data, select: { sequence: true } });
      return { cursor: saved.sequence.toString(), runId: run.id };
    } catch (error) {
      if (error?.code !== 'P2002') throw error;
      const saved = await db.automationEvent.findUnique({
        where: { eventId: event.eventId },
        select: { sequence: true, runId: true },
      });
      return saved ? { cursor: saved.sequence.toString(), runId: saved.runId } : null;
    }
  }

  async function persistRecording(metadata, mediaRoot) {
    const event = {
      eventId: `recording:${metadata.recordingId}`,
      runId: metadata.runId || metadata.sessionId,
      mode: 'manual',
      testCaseId: metadata.testCaseId,
      projectId: metadata.projectId,
      browserSessionId: metadata.sessionId,
      eventType: 'run.started',
      timestamp: metadata.startedAt,
    };
    const run = await ensureRun(event);
    if (!run) return null;
    if (metadata.status !== 'recording') {
      await db.automationRun.update({
        where: { id: run.id },
        data: {
          status: 'finished',
          endedAt: safeDate(metadata.stoppedAt || metadata.recordingEndedAt || Date.now()),
        },
      });
    }
    return db.recording.upsert({
      where: { recordingId: metadata.recordingId },
      create: {
        recordingId: metadata.recordingId,
        runId: run.id,
        testCaseId: metadata.testCaseId,
        sessionId: metadata.sessionId,
        mode: metadata.mode || 'frame',
        status: metadata.video?.status || metadata.status,
        targetUrl: metadata.targetUrl || null,
        mediaRoot,
        metadata: jsonValue(metadata),
        startedAt: safeDate(metadata.startedAt),
        stoppedAt: metadata.stoppedAt ? safeDate(metadata.stoppedAt) : null,
      },
      update: {
        status: metadata.video?.status || metadata.status,
        metadata: jsonValue(metadata),
        stoppedAt: metadata.stoppedAt ? safeDate(metadata.stoppedAt) : null,
      },
    });
  }

  async function getEvents(testCaseId, after = 0n, limit = 500, runId, before) {
    const pageSize = Math.min(500, Math.max(1, limit));
    const newestFirst = after === 0n || before !== undefined;
    const sequence = before !== undefined ? { lt: before } : { gt: after };
    const rows = await db.automationEvent.findMany({
      where: { testCaseId, runId, sequence },
      orderBy: { sequence: newestFirst ? 'desc' : 'asc' },
      take: pageSize + 1,
      select: { sequence: true, runId: true, payload: true },
    });
    const hasMore = rows.length > pageSize;
    if (hasMore) rows.pop();
    if (newestFirst) rows.reverse();
    return {
      events: rows.map(row => ({
        type: 'automation.event',
        schemaVersion: 1,
        event: row.payload,
        cursor: row.sequence.toString(),
        persistedRunId: row.runId,
      })),
      cursor: rows.at(-1)?.sequence.toString() || after.toString(),
      before: rows[0]?.sequence.toString() || null,
      hasMore,
    };
  }

  async function getRuns(testCaseId, limit = 2) {
    return db.automationRun.findMany({
      where: { testCaseId },
      orderBy: { startedAt: 'desc' },
      take: Math.min(20, Math.max(1, limit)),
      select: {
        id: true,
        externalRunId: true,
        status: true,
        startedAt: true,
        endedAt: true,
      },
    });
  }

  async function getLatestRecording(testCaseId) {
    const recording = await db.recording.findFirst({
      where: { testCaseId },
      orderBy: { startedAt: 'desc' },
      select: { metadata: true },
    });
    return recording?.metadata || null;
  }

  async function getRecording(testCaseId, sessionId) {
    const recording = await db.recording.findFirst({
      where: { testCaseId, sessionId },
      orderBy: { startedAt: 'desc' },
      select: { metadata: true },
    });
    return recording?.metadata || null;
  }

  async function cleanup(retentionDays = 90) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const expired = await db.automationRun.findMany({
      where: {
        status: { not: 'running' },
        endedAt: { lt: cutoff },
      },
      select: { id: true, recording: { select: { mediaRoot: true } } },
    });
    if (!expired.length) return { count: 0 };
    const result = await db.automationRun.deleteMany({
      where: { id: { in: expired.map(run => run.id) } },
    });
    await Promise.all(expired.map(async run => {
      const target = run.recording?.mediaRoot && path.resolve(run.recording.mediaRoot);
      const insideRoot = target && mediaRoots.some(root => {
        const relative = path.relative(root, target);
        return relative && !relative.startsWith('..') && !path.isAbsolute(relative);
      });
      if (insideRoot) await fs.rm(target, { recursive: true, force: true });
    }));
    return result;
  }

  return {
    cleanup,
    getEvents,
    getLatestRecording,
    getRecording,
    getRuns,
    persistEvent,
    persistRecording,
  };
}

function connectDevlogStore() {
  loadDatabaseUrl();
  const url = process.env.POSTGRES_DATABASE_URL;
  if (!/^postgres(?:ql)?:\/\//i.test(url || '')) return null;
  try {
    const { PrismaClient } = require('@prisma/postgresql-client');
    const runtimeRoot = process.env.QA_RUNTIME_DIR
      || path.join(process.env.LOCALAPPDATA || os.tmpdir(), 'web-qa-runtime');
    return createDevlogStore(new PrismaClient({ datasourceUrl: url }), {
      mediaRoots: [
        path.join(runtimeRoot, 'recordings'),
        path.join(__dirname, 'recordings'),
      ],
    });
  } catch (error) {
    console.warn(`[DEVLOG DB] PostgreSQL disabled: ${error.message}`);
    return null;
  }
}

module.exports = {
  connectDevlogStore,
  createDevlogStore,
  createRunKey,
  safeDate,
  safeRelativeMs,
};
