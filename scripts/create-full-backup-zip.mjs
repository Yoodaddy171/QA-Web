import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { PrismaClient } from '@prisma/client';
import { resolveEvidenceStorageRoot } from '../src/lib/storage/evidence-storage-path.mjs';
import storagePaths from '../src/lib/storage/data-storage-path.cjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  const envRaw = await fs.readFile(path.join(projectRoot, '.env'), 'utf8');
  const localEnv = parseEnv(envRaw.replace(/^\uFEFF/, ''));
  for (const [key, value] of Object.entries(localEnv)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
} catch {
  // Proceed with existing process.env if .env is not present
}

function runPowerShell(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command],
      { stdio: ['ignore', 'inherit', 'inherit'], windowsHide: true }
    );
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`PowerShell exited with code ${code}`))
    );
  });
}

async function checksum(file) {
  const hash = crypto.createHash('sha256');
  hash.update(await fs.readFile(file));
  return hash.digest('hex');
}

async function copyDirIfExists(src, dest) {
  try {
    const stat = await fs.stat(src);
    if (!stat.isDirectory()) return false;
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.cp(src, dest, { recursive: true });
    return true;
  } catch {
    return false;
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupRoot = path.resolve(process.env.QA_BACKUP_DIR || path.join(projectRoot, 'backups'));
const retentionDays = Math.max(1, Number(process.env.QA_BACKUP_RETENTION_DAYS || 30));
const stagingDir = path.join(backupRoot, `.staging-${stamp}`);
const fileName = `traceva-full-backup-${stamp}.zip`;
const zipPath = path.join(backupRoot, fileName);

await fs.mkdir(stagingDir, { recursive: true });

try {
  const databaseUrl = process.env.DATABASE_URL || 'file:./db/custom.db';
  const included = {
    database: false,
    evidence: false,
    automation: false,
    recordings: false,
    envFile: false,
  };

  if (databaseUrl.startsWith('file:')) {
    const relativeDb = databaseUrl.slice(5);
    const sourceDbPath = path.resolve(projectRoot, 'prisma', relativeDb);
    await fs.access(sourceDbPath);
    const dbStageDir = path.join(stagingDir, 'database');
    await fs.mkdir(dbStageDir, { recursive: true });
    const snapshotPath = path.join(dbStageDir, 'custom.sqlite');
    const escapedSnapshot = snapshotPath.replaceAll("'", "''");
    const db = new PrismaClient({
      datasourceUrl: `file:${sourceDbPath.replaceAll('\\', '/')}`,
    });
    try {
      await db.$executeRawUnsafe(`VACUUM INTO '${escapedSnapshot}'`);
    } finally {
      await db.$disconnect();
    }
    const dbStat = await fs.stat(snapshotPath);
    const dbManifest = {
      version: 1,
      provider: 'sqlite',
      createdAt: new Date().toISOString(),
      file: 'custom.sqlite',
      sizeBytes: dbStat.size,
      sha256: await checksum(snapshotPath),
    };
    await fs.writeFile(
      path.join(dbStageDir, 'manifest.json'),
      `${JSON.stringify(dbManifest, null, 2)}\n`
    );
    included.database = true;
  }

  const evidenceRoot = resolveEvidenceStorageRoot();
  included.evidence = await copyDirIfExists(evidenceRoot, path.join(stagingDir, 'evidence'));

  const automationRoot =
    process.env.QA_SCRIPT_RUNNER_DIR ||
    path.join(storagePaths.dataRoot(process.env), 'automation');
  included.automation = await copyDirIfExists(
    automationRoot,
    path.join(stagingDir, 'automation')
  );

  const { recordings } = storagePaths.runtimePaths(process.env);
  included.recordings = await copyDirIfExists(
    recordings,
    path.join(stagingDir, 'recordings')
  );

  try {
    const envSource = path.join(projectRoot, '.env');
    await fs.access(envSource);
    const configStageDir = path.join(stagingDir, 'config');
    await fs.mkdir(configStageDir, { recursive: true });
    await fs.copyFile(envSource, path.join(configStageDir, 'dotenv.backup'));
    included.envFile = true;
  } catch {
    included.envFile = false;
  }

  const escapedStaging = stagingDir.replaceAll("'", "''");
  const escapedZip = zipPath.replaceAll("'", "''");
  await runPowerShell(
    `Compress-Archive -Path '${escapedStaging}\\*' -DestinationPath '${escapedZip}' -CompressionLevel Optimal -Force`
  );

  const zipStat = await fs.stat(zipPath);
  const zipSha256 = await checksum(zipPath);
  const createdAt = new Date().toISOString();
  const manifest = {
    version: 1,
    fileName,
    zipPath,
    sizeBytes: zipStat.size,
    sha256: zipSha256,
    createdAt,
    included,
  };
  await fs.writeFile(`${zipPath}.json`, `${JSON.stringify(manifest, null, 2)}\n`);

  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const entries = await fs.readdir(backupRoot, { withFileTypes: true });
  const pruned = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/^traceva-full-backup-.*\.zip(?:\.json)?$/.test(entry.name)) {
      continue;
    }
    const target = path.resolve(backupRoot, entry.name);
    if (path.dirname(target) !== backupRoot) continue;
    const stat = await fs.stat(target);
    if (stat.mtimeMs < cutoff) {
      await fs.rm(target, { force: true });
      pruned.push(entry.name);
    }
  }

  console.log(JSON.stringify({ ok: true, ...manifest, pruned }, null, 2));
} finally {
  await fs.rm(stagingDir, { recursive: true, force: true }).catch(() => {});
}
