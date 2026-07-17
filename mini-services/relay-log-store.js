const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');

const PREVIOUS_LOG_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function createRelayLogStore({ directory, previousMaxAgeMs = PREVIOUS_LOG_MAX_AGE_MS, logger = console }) {
  const queues = new Map();

  function getPaths(testCaseId) {
    const safeId = encodeURIComponent(String(testCaseId));
    return {
      current: path.join(directory, `${safeId}.current.jsonl`),
      previous: path.join(directory, `${safeId}.previous.jsonl`),
      legacy: path.join(directory, `${safeId}.jsonl`),
    };
  }

  async function initialize() {
    await fsp.mkdir(directory, { recursive: true });
    const cutoff = Date.now() - previousMaxAgeMs;
    const entries = await fsp.readdir(directory, { withFileTypes: true });
    await Promise.all(entries
      .filter(entry => entry.isFile() && entry.name.endsWith('.previous.jsonl'))
      .map(async entry => {
        const filePath = path.join(directory, entry.name);
        const stat = await fsp.stat(filePath);
        if (stat.mtimeMs >= cutoff) return;
        await fsp.rm(filePath, { force: true });
        logger.log(`[LOG RETENTION] Removed stale previous run: ${entry.name}`);
      }));
  }

  function isRunStart(logData) {
    return /Starting\s+.*(Automation|Manual\s+Capture)/i.test(String(logData.log || ''));
  }

  function save(logData) {
    if (!logData.testCaseId) return Promise.resolve();
    const key = String(logData.testCaseId);
    const previousTask = queues.get(key) || Promise.resolve();
    const task = previousTask.then(async () => {
      await fsp.mkdir(directory, { recursive: true });
      const paths = getPaths(key);
      if (isRunStart(logData)) {
        try {
          await fsp.copyFile(paths.current, paths.previous);
          await fsp.truncate(paths.current, 0);
          logger.log(`[LOG ROTATE] Previous run saved for TC: ${key}`);
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
      const line = `${JSON.stringify({ ...logData, timestamp: logData.timestamp || new Date().toISOString() })}\n`;
      await fsp.appendFile(paths.current, line, 'utf8');
    }).catch(error => logger.error(`Failed to save log for ${key}:`, error));
    queues.set(key, task);
    task.finally(() => { if (queues.get(key) === task) queues.delete(key); });
    return task;
  }

  async function findSavedRun(testCaseId, requestedRun = 'auto') {
    await (queues.get(String(testCaseId)) || Promise.resolve());
    const { current, previous, legacy } = getPaths(testCaseId);
    const candidates = requestedRun === 'current' || requestedRun === 'latest'
      ? [{ kind: 'current', filePath: current }]
      : requestedRun === 'previous' || requestedRun === 'history'
        ? [{ kind: 'previous', filePath: previous }, { kind: 'legacy', filePath: legacy }]
        : [{ kind: 'previous', filePath: previous }, { kind: 'current', filePath: current }, { kind: 'legacy', filePath: legacy }];
    for (const candidate of candidates) {
      try {
        await fsp.access(candidate.filePath, fs.constants.R_OK);
        return candidate;
      } catch (_) {}
    }
    return null;
  }

  return { findSavedRun, getPaths, initialize, save };
}

module.exports = { createRelayLogStore, PREVIOUS_LOG_MAX_AGE_MS };
