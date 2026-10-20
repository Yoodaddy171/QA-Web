import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { assertDurableEvidenceRoot, resolveEvidenceStorageRoot } from '../src/lib/storage/evidence-storage-path.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const localEnv = parseEnv((await fs.readFile(path.join(projectRoot, '.env'), 'utf8')).replace(/^\uFEFF/, ''));
for (const [key, value] of Object.entries(localEnv)) if (process.env[key] === undefined) process.env[key] = value;
if (process.env.DATABASE_URL?.startsWith('file:')) {
  const filename = process.env.DATABASE_URL.slice(5);
  process.env.DATABASE_URL = `file:${path.resolve(projectRoot, 'prisma', filename).replaceAll('\\', '/')}`;
}
process.env.HOSTNAME = process.env.QA_WEB_HOST || '127.0.0.1';
process.env.PORT = process.env.PORT || '3000';
process.env.QA_LEGACY_LOGS_DIR ||= path.join(projectRoot, 'mini-services', 'logs');
process.env.QA_LEGACY_RECORDINGS_DIR ||= path.join(projectRoot, 'mini-services', 'recordings');
process.env.QA_EVIDENCE_STORAGE_DIR = resolveEvidenceStorageRoot();
await fs.mkdir(process.env.QA_EVIDENCE_STORAGE_DIR, { recursive: true });
assertDurableEvidenceRoot(await fs.realpath(process.env.QA_EVIDENCE_STORAGE_DIR));
console.log(`Evidence storage: ${process.env.QA_EVIDENCE_STORAGE_DIR}`);

await import('../.next/standalone/server.js');
