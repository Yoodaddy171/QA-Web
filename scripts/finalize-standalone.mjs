import fs from 'node:fs/promises';
import path from 'node:path';

const standaloneRoot = path.resolve('.next/standalone');
const insideStandalone = relative => path.join(standaloneRoot, relative);

await fs.mkdir(insideStandalone('.next'), { recursive: true });
await fs.cp(path.resolve('.next/static'), insideStandalone('.next/static'), { recursive: true, force: true });
await fs.cp(path.resolve('public'), insideStandalone('public'), { recursive: true, force: true });

// Ensure native libvips DLLs for @img/sharp-* are copied into standalone node_modules
const imgRoot = path.resolve('node_modules/@img');
try {
  const entries = await fs.readdir(imgRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      await fs.cp(
        path.join(imgRoot, entry.name),
        insideStandalone(path.join('node_modules/@img', entry.name)),
        { recursive: true, force: true }
      );
    }
  }
} catch {
  // Ignore if @img is not present
}

for (const relative of [
  '.env', '.env.local', '.env.production', '.env.production.local',
  'mini-services/logs', 'mini-services/recordings',
  'data', 'backups', 'coverage', 'test-results', 'playwright-report',
]) {
  await fs.rm(insideStandalone(relative), { recursive: true, force: true });
}

console.log('Standalone finalized without build-host secrets or runtime artifacts.');
