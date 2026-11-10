import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { evidenceStorageRoot } from '@/lib/storage/evidence-storage';

function resolveEvidencePath(storagePath: string) {
  const normalized = storagePath.replaceAll('\\', '/').replace(/^\/+/, '');
  if (!normalized || normalized.split('/').some((part) => part === '..')) return null;
  const absolute = path.resolve(/*turbopackIgnore: true*/ evidenceStorageRoot, normalized);
  const relative = path.relative(evidenceStorageRoot, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return absolute;
}

async function listBackups(backupDir: string) {
  try {
    const entries = await fs.readdir(backupDir, { withFileTypes: true });
    const sqliteFiles = entries.filter(
      (e) => e.isFile() && (e.name.endsWith('.sqlite') || e.name.endsWith('.db'))
    );
    const backups = await Promise.all(
      sqliteFiles.map(async (entry) => {
        const fullPath = path.join(/*turbopackIgnore: true*/ backupDir, entry.name);
        const stat = await fs.stat(fullPath);
        let sha256: string | null = null;
        try {
          const sidecar = JSON.parse(await fs.readFile(`${fullPath}.json`, 'utf8'));
          if (typeof sidecar?.sha256 === 'string') sha256 = sidecar.sha256;
        } catch {
          // Sidecar optional
        }
        return {
          fileName: entry.name,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
          sha256,
        };
      })
    );
    return backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get('projectId')?.trim() || '';
  const verifyHashes = req.nextUrl.searchParams.get('verifyHashes') === '1';

  try {
    const where = projectId ? { execution: { testRun: { projectId } } } : {};
    const records = await db.testExecutionEvidence.findMany({
      where,
      select: {
        id: true,
        fileName: true,
        storagePath: true,
        sizeBytes: true,
        sha256: true,
      },
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });

    let presentCount = 0;
    let missingCount = 0;
    let hashVerifiedCount = 0;
    let hashMismatchCount = 0;
    let noRecordedHashCount = 0;
    let totalBytes = 0;

    for (const rec of records) {
      totalBytes += rec.sizeBytes || 0;
      const absPath = resolveEvidencePath(rec.storagePath);
      if (!absPath) {
        missingCount++;
        continue;
      }
      try {
        await fs.access(absPath);
        presentCount++;
        if (!rec.sha256) {
          noRecordedHashCount++;
        } else if (verifyHashes) {
          const buf = await fs.readFile(absPath);
          const digest = crypto.createHash('sha256').update(buf).digest('hex');
          if (digest === rec.sha256) hashVerifiedCount++;
          else hashMismatchCount++;
        } else {
          hashVerifiedCount++;
        }
      } catch {
        missingCount++;
      }
    }

    const backupDir = path.join(/*turbopackIgnore: true*/ path.dirname(evidenceStorageRoot), 'backups');
    const backups = await listBackups(backupDir);

    return NextResponse.json(
      {
        evidenceRoot: evidenceStorageRoot,
        integrity: {
          totalRecords: records.length,
          presentCount,
          missingCount,
          hashVerifiedCount,
          hashMismatchCount,
          noRecordedHashCount,
          totalBytes,
          deepVerified: verifyHashes,
          checkedAt: new Date().toISOString(),
        },
        backups,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('GET /api/settings/maintenance error:', error);
    return NextResponse.json(
      { error: 'Gagal memeriksa integritas storage dan daftar backup.' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const backupDir = path.join(/*turbopackIgnore: true*/ path.dirname(evidenceStorageRoot), 'backups');
    await fs.mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `traceva-backup-${stamp}.sqlite`;
    const targetPath = path.join(/*turbopackIgnore: true*/ backupDir, fileName);

    const escapedPath = targetPath.replaceAll("'", "''");
    await db.$executeRawUnsafe(`VACUUM INTO '${escapedPath}'`);

    const buffer = await fs.readFile(targetPath);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const sidecar = {
      version: 1,
      provider: 'sqlite',
      file: fileName,
      sizeBytes: buffer.byteLength,
      sha256,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(`${targetPath}.json`, `${JSON.stringify(sidecar, null, 2)}\n`, { flag: 'wx' });

    const backups = await listBackups(backupDir);
    return NextResponse.json(
      {
        ok: true,
        backup: {
          fileName,
          sizeBytes: buffer.byteLength,
          createdAt: sidecar.createdAt,
          sha256,
        },
        backups,
      },
      { status: 201, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('POST /api/settings/maintenance error:', error);
    return NextResponse.json(
      { error: 'Gagal membuat snapshot backup database SQLite.' },
      { status: 500 }
    );
  }
}
