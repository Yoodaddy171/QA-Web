import fs from 'node:fs/promises';
import path from 'node:path';

const backupRoot = path.resolve(process.env.QA_BACKUP_DIR || path.join(process.cwd(), 'backups'));
const retentionDays = Math.max(1, Number(process.env.QA_BACKUP_RETENTION_DAYS || 30));
const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
await fs.mkdir(backupRoot, { recursive: true });
const entries = await fs.readdir(backupRoot, { withFileTypes: true });
const deleted = [];
for (const entry of entries) {
  if (!entry.isFile() || !/^qa-web-.*\.(?:dump|sqlite)(?:\.json)?$/.test(entry.name)) continue;
  const target = path.resolve(backupRoot, entry.name);
  if (path.dirname(target) !== backupRoot) throw new Error('Backup path containment check failed.');
  if ((await fs.stat(target)).mtimeMs < cutoff) { await fs.rm(target, { force: true }); deleted.push(entry.name); }
}
console.log(JSON.stringify({ retentionDays, deleted }));
