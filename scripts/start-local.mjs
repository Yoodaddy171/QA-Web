import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.HOSTNAME = process.env.QA_WEB_HOST || '127.0.0.1';
process.env.PORT = process.env.PORT || '3000';
process.env.QA_LEGACY_LOGS_DIR ||= path.join(projectRoot, 'mini-services', 'logs');
process.env.QA_LEGACY_RECORDINGS_DIR ||= path.join(projectRoot, 'mini-services', 'recordings');

await import('../.next/standalone/server.js');
