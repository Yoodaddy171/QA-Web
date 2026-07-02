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

function createDevlogStore(db, options = {}) {
  const projectCache = new Map();
  const mediaRoots = (options.mediaRoots || []).map(root => path.resolve(root));

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
    if (entity) projectCache.set(testCaseId, entity);
    return entity;
  }

  async function ensureRun(event) {
    const entity = await resolveEntity(event.testCaseId);
    if (!entity) return null;
    const runKey = createRunKey(event.testCaseId, event.runId);
    const timestamp = new Date(event.timestamp);
    const finished = event.eventType === 'run.finished';
    return db.automationRun.upsert({
      where: { runKey },
      create: {
        runKey,
        externalRunId: event.runId,
        sessionId: event.browserSessionId || null,
        projectId: event.projectId || entity.projectId,
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
  }

  async function persistEvent(event) {
    const run = await ensureRun(event);
    if (!run) return null;
    const data = {
      eventId: event.eventId,
      runId: run.id,
      testCaseId: event.testCaseId,
      eventType: event.eventType || 'log',
      timestamp: new Date(event.timestamp),
      relativeMs: Number.isFinite(Number(event.metadata?.legacy?.relativeMs))
        ? Math.round(Number(event.metadata.legacy.relativeMs))
        : null,
      payload: jsonValue(event),
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
          endedAt: new Date(metadata.stoppedAt || metadata.recordingEndedAt || Date.now()),
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
        startedAt: new Date(metadata.startedAt),
        stoppedAt: metadata.stoppedAt ? new Date(metadata.stoppedAt) : null,
      },
      update: {
        status: metadata.video?.status || metadata.status,
        metadata: jsonValue(metadata),
        stoppedAt: metadata.stoppedAt ? new Date(metadata.stoppedAt) : null,
      },
    });
  }

  async function getEvents(testCaseId, after = 0n, limit = 500) {
    const newestFirst = after === 0n;
    const rows = await db.automationEvent.findMany({
      where: { testCaseId, sequence: { gt: after } },
      orderBy: { sequence: newestFirst ? 'desc' : 'asc' },
      take: Math.min(500, Math.max(1, limit)),
      select: { sequence: true, runId: true, payload: true },
    });
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
    };
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

  return { cleanup, getEvents, persistEvent, persistRecording };
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

module.exports = { connectDevlogStore, createDevlogStore, createRunKey };
