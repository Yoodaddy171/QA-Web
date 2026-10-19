import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PerformanceObserver } from 'node:perf_hooks';

const root = path.resolve(process.env.QA_PHASE6C_ROOT || '__missing__');
const database = path.resolve((process.env.DATABASE_URL || '').replace(/^file:/, ''));
const port = Number(process.env.PORT);
if (!process.send || !database.startsWith(root + path.sep) || port < 3100 || port > 3199) throw new Error('Synthetic owned server required');
let gcCount = 0, gcMs = 0;
new PerformanceObserver(list => { for (const item of list.getEntries()) { gcCount++; gcMs += item.duration; } }).observe({ entryTypes: ['gc'] });
process.on('message', message => {
  if (message?.op === 'shutdown') {
    if (process.listenerCount('SIGTERM')) process.emit('SIGTERM', 'SIGTERM');
    else process.send({ id: message.id, shutdownUnsupported: true });
    return;
  }
  if (message?.op === 'pragmas' && globalThis.__phase6cPragmas) {
    globalThis.__phase6cPragmas().then(pragmas => process.send({ id: message.id, pragmas }), () => process.send({ id: message.id, error: 'pragma failed' }));
    return;
  }
  if (message?.op !== 'metrics') return;
  process.send({ id: message.id, cpu: process.cpuUsage(), memory: process.memoryUsage(), gcCount, gcMs,
    query: globalThis.__phase6cQueries ? { count: globalThis.__phase6cQueries.count, ms: globalThis.__phase6cQueries.ms } : null });
});
await import(pathToFileURL(path.join(path.resolve(process.argv[2]), 'server.js')).href);
