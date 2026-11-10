'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Archive,
  CheckCircle2,
  DatabaseBackup,
  FileCheck2,
  HardDrive,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface IntegritySummary {
  totalRecords: number;
  presentCount: number;
  missingCount: number;
  hashVerifiedCount: number;
  hashMismatchCount: number;
  noRecordedHashCount: number;
  totalBytes: number;
  deepVerified: boolean;
  checkedAt: string;
}

interface BackupItem {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
  sha256: string | null;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let idx = 0;
  let val = bytes;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function StorageMaintenanceCard({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [integrity, setIntegrity] = useState<IntegritySummary | null>(null);
  const [evidenceRoot, setEvidenceRoot] = useState('');
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyingDeep, setVerifyingDeep] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);

  const loadMaintenance = useCallback(
    async (deep = false) => {
      if (deep) setVerifyingDeep(true);
      else setLoading(true);

      try {
        const params = new URLSearchParams();
        if (projectId) params.set('projectId', projectId);
        if (deep) params.set('verifyHashes', '1');

        const res = await fetch(`/api/settings/maintenance?${params.toString()}`, {
          cache: 'no-store',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memuat status integritas storage.');
        setIntegrity(data.integrity || null);
        setEvidenceRoot(data.evidenceRoot || '');
        setBackups(Array.isArray(data.backups) ? data.backups : []);
        if (deep) {
          toast({
            variant: 'success',
            title: 'Verifikasi SHA-256 selesai',
            description: `${data.integrity?.hashVerifiedCount || 0} file terverifikasi utuh di disk.`,
          });
        }
      } catch (error) {
        toast({
          title: 'Pemeriksaan storage gagal',
          description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
        setVerifyingDeep(false);
      }
    },
    [projectId, toast]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void loadMaintenance(false), 0);
    return () => window.clearTimeout(timer);
  }, [loadMaintenance]);

  const handleCreateBackup = async () => {
    setCreatingBackup(true);
    try {
      const res = await fetch('/api/settings/maintenance', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal membuat backup database.');
      if (Array.isArray(data.backups)) setBackups(data.backups);
      toast({
        variant: 'success',
        title: 'Snapshot database berhasil dibuat',
        description: `File ${data.backup?.fileName || 'backup'} tersimpan beserta sidecar SHA-256.`,
      });
    } catch (error) {
      toast({
        title: 'Gagal membuat backup',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
        variant: 'destructive',
      });
    } finally {
      setCreatingBackup(false);
    }
  };

  return (
    <Card variant="majestic" className="overflow-hidden">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <DatabaseBackup className="size-5 text-primary" />
              Storage Integrity &amp; Database Backup
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Audit keutuhan file bukti pengujian (SHA-256 checksum) di disk lokal dan buat snapshot cadangan database SQLite.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading || verifyingDeep}
              onClick={() => void loadMaintenance(true)}
              className="gap-1.5"
            >
              {verifyingDeep ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="size-3.5 text-emerald-500" />
              )}
              Verifikasi Checksum SHA-256
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={creatingBackup}
              onClick={() => void handleCreateBackup()}
              className="gap-1.5"
            >
              {creatingBackup ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Archive className="size-3.5" />
              )}
              Buat Snapshot Backup
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        {integrity && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Total File Terdaftar
              </p>
              <p className="mt-1.5 font-mono text-xl font-bold text-foreground tabular-nums">
                {integrity.totalRecords}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Ukuran tercatat: {formatBytes(integrity.totalBytes)}
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Tersedia di Disk
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <p className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {integrity.presentCount}
                </p>
                <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-600 dark:text-emerald-400">
                  Durable
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {integrity.missingCount === 0
                  ? '0 file hilang'
                  : `${integrity.missingCount} file tidak ditemukan`}
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Integritas Checksum
              </p>
              <p className="mt-1.5 font-mono text-xl font-bold text-primary tabular-nums">
                {integrity.hashVerifiedCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {integrity.deepVerified
                  ? `${integrity.hashMismatchCount} mismatch terdeteksi`
                  : `${integrity.noRecordedHashCount} tanpa hash historis`}
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-secondary/20 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Lokasi Evidence Root
              </p>
              <p className="mt-1.5 truncate font-mono text-xs font-semibold text-foreground" title={evidenceRoot}>
                {evidenceRoot || 'Local AppData Storage'}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Diperiksa {new Date(integrity.checkedAt).toLocaleTimeString('id-ID')}
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Snapshot Backup SQLite Terbaru ({backups.length})
            </p>
          </div>

          {backups.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/60 bg-secondary/10 px-4 py-6 text-center text-xs text-muted-foreground">
              Belum ada file snapshot backup. Klik tombol <strong>Buat Snapshot Backup</strong> di atas untuk mencadangkan database.
            </div>
          ) : (
            <div className="divide-y divide-border/50 rounded-xl border border-border/60 bg-card">
              {backups.map((b) => (
                <div
                  key={b.fileName}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileCheck2 className="size-4 shrink-0 text-emerald-500" />
                    <span className="truncate font-mono font-semibold text-foreground">
                      {b.fileName}
                    </span>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      {formatBytes(b.sizeBytes)}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                    {b.sha256 && (
                      <span className="font-mono text-[10px]" title={`SHA-256: ${b.sha256}`}>
                        SHA-256: {b.sha256.slice(0, 12)}...
                      </span>
                    )}
                    <span>{new Date(b.createdAt).toLocaleString('id-ID')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
