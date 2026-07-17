import fs from 'node:fs/promises';
import path from 'node:path';

const standaloneRoot = path.resolve('.next/standalone');
const insideStandalone = relative => path.join(standaloneRoot, relative);

await fs.mkdir(insideStandalone('.next'), { recursive: true });
await fs.cp(path.resolve('.next/static'), insideStandalone('.next/static'), { recursive: true, force: true });
await fs.cp(path.resolve('public'), insideStandalone('public'), { recursive: true, force: true });

for (const relative of [
  '.env', '.env.local', '.env.production', '.env.production.local',
  'mini-services/logs', 'mini-services/recordings',
  'data', 'backups', 'coverage', 'test-results', 'playwright-report',
]) {
  await fs.rm(insideStandalone(relative), { recursive: true, force: true });
}

console.log('Standalone finalized without build-host secrets or runtime artifacts.');
