import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import { db } from '@/lib/db';
import { normalizeLocalOllamaUrl } from '@/lib/ai-settings';
import { evidenceStorageRoot } from '@/lib/storage/evidence-storage';

export type ReadinessStatus = 'ready' | 'warning' | 'blocked' | 'skipped';

export interface ReadinessCheck {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
  durationMs: number;
}

const runtimeRoot = path.resolve(/*turbopackIgnore: true*/ process.env.QA_RUNTIME_DIR || path.join(/*turbopackIgnore: true*/ process.cwd(), 'data'));
const recordingStorageRoot = path.join(/*turbopackIgnore: true*/ runtimeRoot, 'recordings');

async function timedCheck(id: string, label: string, run: () => Promise<Omit<ReadinessCheck, 'id' | 'label' | 'durationMs'>>): Promise<ReadinessCheck> {
  const startedAt = performance.now();
  try {
    const result = await run();
    return { id, label, ...result, durationMs: Math.round(performance.now() - startedAt) };
  } catch (error) {
    return {
      id,
      label,
      status: 'blocked',
      detail: error instanceof Error ? error.message : 'Pemeriksaan gagal.',
      durationMs: Math.round(performance.now() - startedAt),
    };
  }
}

async function assertWritableDirectory(directory: string) {
  await fs.mkdir(directory, { recursive: true });
  const probe = path.join(/*turbopackIgnore: true*/ directory, `.readiness-${process.pid}-${randomUUID()}.tmp`);
  await fs.writeFile(probe, 'ready', { flag: 'wx' });
  await fs.rm(probe, { force: true });
}

export async function checkWritableStorage(id: string, label: string, directory: string) {
  return timedCheck(id, label, async () => {
    await assertWritableDirectory(directory);
    return { status: 'ready', detail: 'Direktori dapat dibaca dan ditulis.' };
  });
}

export function browserCandidates(env: Partial<NodeJS.ProcessEnv> = process.env, platform = process.platform) {
  const configured = [env.CHROME_PATH, env.EDGE_PATH].filter(Boolean) as string[];
  if (platform === 'win32') {
    return [
      ...configured,
      env.PROGRAMFILES && path.join(/*turbopackIgnore: true*/ env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      env['PROGRAMFILES(X86)'] && path.join(/*turbopackIgnore: true*/ env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe'),
      env.LOCALAPPDATA && path.join(/*turbopackIgnore: true*/ env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      env.PROGRAMFILES && path.join(/*turbopackIgnore: true*/ env.PROGRAMFILES, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
      env['PROGRAMFILES(X86)'] && path.join(/*turbopackIgnore: true*/ env['PROGRAMFILES(X86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ].filter(Boolean) as string[];
  }
  if (platform === 'darwin') return [...configured, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'];
  return [...configured, '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
}

async function checkBrowser() {
  return timedCheck('browser', 'Chrome / Edge', async () => {
    for (const candidate of browserCandidates()) {
      try {
        await fs.access(candidate);
        const browser = path.basename(candidate).toLowerCase().includes('edge') ? 'Microsoft Edge' : 'Google Chrome / Chromium';
        return { status: 'ready', detail: `${browser} tersedia untuk manual capture.` };
      } catch {}
    }
    return { status: 'blocked', detail: 'Chrome atau Edge tidak ditemukan. Atur CHROME_PATH atau EDGE_PATH.' };
  });
}

async function checkFfmpeg() {
  return timedCheck('ffmpeg', 'FFmpeg', async () => {
    const candidate = process.env.FFMPEG_PATH || ffmpegInstaller.path;
    await fs.access(candidate);
    return { status: 'ready', detail: 'Binary FFmpeg tersedia untuk finalisasi rekaman.' };
  });
}

async function checkDatabase() {
  return timedCheck('database', 'Database', async () => {
    await db.project.count();
    const provider = /^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL || '') ? 'PostgreSQL' : 'SQLite';
    return { status: 'ready', detail: `Koneksi ${provider} aktif.` };
  });
}

async function checkMigrationStatus() {
  return timedCheck('migrations', 'Database migrations', async () => {
    const postgres = /^postgres(?:ql)?:\/\//i.test(process.env.DATABASE_URL || '');
    if (!postgres) return { status: 'skipped', detail: 'SQLite aktif; migration PostgreSQL diperiksa saat deployment.' };

    const migrationsRoot = path.join(/*turbopackIgnore: true*/ process.cwd(), 'prisma', 'migrations');
    const expected = (await fs.readdir(migrationsRoot, { withFileTypes: true })).filter(entry => entry.isDirectory()).length;
    const applied = await db.$queryRawUnsafe<Array<{ migration_name: string }>>(
      'SELECT "migration_name" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL',
    );
    if (applied.length < expected) return { status: 'blocked', detail: `${expected - applied.length} migration PostgreSQL belum diterapkan.` };
    return { status: 'ready', detail: `${applied.length} migration PostgreSQL sudah diterapkan.` };
  });
}

async function checkRelay() {
  return timedCheck('relay', 'Automation relay', async () => {
    const token = process.env.QA_RELAY_TOKEN || process.env.NEXT_PUBLIC_QA_RELAY_TOKEN;
    if (!token) return { status: 'blocked', detail: 'QA_RELAY_TOKEN belum dikonfigurasi.' };
    const host = process.env.QA_RELAY_HOST || '127.0.0.1';
    const port = process.env.QA_RELAY_PORT || '3001';
    const response = await fetch(`http://${host}:${port}/health`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(2_500),
      cache: 'no-store',
    });
    if (!response.ok) return { status: 'blocked', detail: `Relay merespons HTTP ${response.status}.` };
    const health = await response.json() as { status?: string; browserLaunchEnabled?: boolean };
    return {
      status: health.status === 'ready' ? 'ready' : 'warning',
      detail: health.browserLaunchEnabled ? 'Relay aktif; browser launch diizinkan.' : 'Relay aktif; browser launch harus dimulai manual.',
    };
  });
}

async function checkDiskSpace() {
  return timedCheck('disk', 'Disk space', async () => {
    await fs.mkdir(runtimeRoot, { recursive: true });
    const stats = await fs.statfs(runtimeRoot);
    const freeBytes = Number(stats.bavail) * Number(stats.bsize);
    const freeGb = freeBytes / 1024 ** 3;
    if (freeBytes < 250 * 1024 ** 2) return { status: 'blocked', detail: `Ruang kosong hanya ${freeGb.toFixed(2)} GB.` };
    if (freeBytes < 1024 ** 3) return { status: 'warning', detail: `Ruang kosong ${freeGb.toFixed(2)} GB; rekaman dapat cepat memenuhi disk.` };
    return { status: 'ready', detail: `${freeGb.toFixed(1)} GB tersedia untuk evidence dan rekaman.` };
  });
}

async function checkAiProvider() {
  return timedCheck('ai', 'AI provider', async () => {
    const requested = String(process.env.AI_PROVIDER || 'auto').toLowerCase();
    if (requested === 'ollama' || (requested === 'auto' && !process.env.GROQ_API_KEY && !process.env.GEMINI_API_KEY && process.env.OLLAMA_BASE_URL)) {
      const baseUrl = normalizeLocalOllamaUrl(process.env.OLLAMA_BASE_URL);
      if (!baseUrl) return { status: 'blocked', detail: 'OLLAMA_BASE_URL belum dikonfigurasi.' };
      const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2_500), cache: 'no-store' });
      if (!response.ok) return { status: 'blocked', detail: `Ollama merespons HTTP ${response.status}.` };
      return { status: 'ready', detail: 'Ollama lokal dapat dijangkau.' };
    }
    if (requested === 'groq' && !process.env.GROQ_API_KEY) return { status: 'blocked', detail: 'GROQ_API_KEY belum dikonfigurasi.' };
    if (requested === 'gemini' && !process.env.GEMINI_API_KEY) return { status: 'blocked', detail: 'GEMINI_API_KEY belum dikonfigurasi.' };
    if (process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY) return { status: 'ready', detail: `Provider ${requested === 'auto' ? 'eksternal (auto)' : requested} sudah dikonfigurasi.` };
    return { status: 'warning', detail: 'Belum ada provider AI yang siap digunakan.' };
  });
}

export async function getSystemReadiness() {
  const checks = await Promise.all([
    checkDatabase(),
    checkMigrationStatus(),
    checkRelay(),
    checkBrowser(),
    checkFfmpeg(),
    checkWritableStorage('evidence-storage', 'Evidence storage', evidenceStorageRoot),
    checkWritableStorage('recording-storage', 'Recording storage', recordingStorageRoot),
    checkDiskSpace(),
    checkAiProvider(),
  ]);
  const relevant = checks.filter(check => check.status !== 'skipped');
  const ready = relevant.filter(check => check.status === 'ready').length;
  const blocked = relevant.filter(check => check.status === 'blocked').length;
  const warning = relevant.filter(check => check.status === 'warning').length;
  return {
    status: blocked ? 'blocked' : warning ? 'warning' : 'ready',
    score: relevant.length ? Math.round((ready / relevant.length) * 100) : 100,
    checkedAt: new Date().toISOString(),
    host: `${os.platform()} ${os.arch()}`,
    summary: { ready, warning, blocked, skipped: checks.length - relevant.length },
    checks,
  };
}
