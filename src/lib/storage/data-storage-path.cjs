/* eslint-disable @typescript-eslint/no-require-imports -- Shared by the CommonJS relay and ESM web/runner. */
const path = require('node:path');
const os = require('node:os');

function durableRoot(value) {
  if (!path.isAbsolute(value) || value.split(/[\\/]+/).some(part => part.toLowerCase() === '.next')) throw new Error('Storage harus berupa path absolut di luar .next.');
  return path.resolve(value);
}
/** @param {Record<string, string | undefined>} env */
function dataRoot(env = process.env, home = os.homedir()) {
  return durableRoot(env.QA_DATA_DIR?.trim() || path.join(env.LOCALAPPDATA || env.XDG_DATA_HOME || path.join(home, '.local', 'share'), 'Traceva'));
}
/**
 * @param {Record<string, string | undefined>} env
 * @param {string | undefined} [legacyLogsRoot]
 */
function runtimePaths(env = process.env, legacyLogsRoot = undefined, home = os.homedir()) {
  const main = env.QA_DATA_DIR?.trim() ? dataRoot(env, home) : null;
  // Opt-in root: existing installations keep their paths until verified migration.
  const runtime = durableRoot(env.QA_RUNTIME_DIR?.trim() || main || path.join(env.LOCALAPPDATA || os.tmpdir(), 'web-qa-runtime'));
  const logs = env.QA_RELAY_LOGS_DIR?.trim() || (main ? path.join(main, 'logs') : legacyLogsRoot || path.join(runtime, 'logs'));
  return { runtime, recordings: path.join(runtime, 'recordings'), logs: durableRoot(logs) };
}
module.exports = { dataRoot, durableRoot, runtimePaths };
