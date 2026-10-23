/* eslint-disable @typescript-eslint/no-require-imports -- Shared by the CommonJS reporter and fixture. */
const fs = require('node:fs');
let count = 0;
function emit(category, message, extra = {}) {
  if (!process.env.TRACEVA_RUN_EVENTS || ++count > 4000) return;
  const event = { id: `${process.pid}-${count}`, category, isExecution: category === 'execution', isConsole: category === 'console', isNetwork: category === 'network',
    timestamp: new Date().toISOString(), relativeMs: Math.max(0, Date.now() - Number(process.env.TRACEVA_RUN_STARTED)), log: String(message).slice(0, 8000), ...extra };
  const line = JSON.stringify(event);
  // Independent processes append complete bounded records; no app secrets are inherited.
  try { if (line.length <= 64000 && (!fs.existsSync(process.env.TRACEVA_RUN_EVENTS) || fs.statSync(process.env.TRACEVA_RUN_EVENTS).size < 8_000_000)) fs.appendFileSync(process.env.TRACEVA_RUN_EVENTS, `${line}\n`); } catch { /* Reporter must not change test outcome. */ }
}
module.exports = { emit };
