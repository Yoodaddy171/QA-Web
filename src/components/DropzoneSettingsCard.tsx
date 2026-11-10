'use client';

import React from 'react';
import { CheckCircle2, SlidersHorizontal, Sparkles, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useBasketballDropzoneSetting } from '@/hooks/use-basketball-dropzone-setting';

export function DropzoneSettingsCard() {
  const { isBasketballEnabled, setIsBasketballEnabled } = useBasketballDropzoneSetting();

  return (
    <Card variant="majestic" className="overflow-hidden">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-bold tracking-tight">
              <Sparkles className="size-5 text-indigo-500 dark:text-indigo-400" />
              Fitur Basketball Dropzone
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Pengaturan tema interaktif untuk seluruh area drag-and-drop file upload di QA Desk.
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              isBasketballEnabled
                ? 'border-indigo-500/30 bg-indigo-500/10 font-medium text-indigo-600 dark:text-indigo-300'
                : 'border-border bg-secondary/50 font-medium text-muted-foreground'
            }
          >
            {isBasketballEnabled ? 'Basket Aktif' : 'Standar Aktif'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-5">
        {/* Toggle Switch */}
        <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-4 transition-colors sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label htmlFor="toggle-basketball-dropzone" className="text-sm font-semibold cursor-pointer">
              Animasi Lapangan Basket &amp; Tembakan File
            </Label>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Saat diaktifkan, area upload menampilkan denah lapangan basket half-court, zona tembakan 2PT/3PT,
              garis prediksi bidikan kursor, dan efek selebrasi splash ke ring.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <span className="text-xs font-mono font-medium text-muted-foreground">
              {isBasketballEnabled ? 'ON' : 'OFF'}
            </span>
            <Switch
              id="toggle-basketball-dropzone"
              checked={isBasketballEnabled}
              onCheckedChange={setIsBasketballEnabled}
              aria-label="Aktifkan atau nonaktifkan fitur basketball dropzone"
            />
          </div>
        </div>

        {/* Feature Coverage List */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span>Project Knowledge</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Upload file dokumen panduan QA, PRD, dan context ke knowledge base.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-secondary/20 p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span>Import Excel</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Dialog import spreadsheet test case ke dalam modul yang dipilih.
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-secondary/20 p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              <CheckCircle2 className="size-4 text-emerald-500" />
              <span>Execution Evidence</span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
              Upload bukti screenshot atau log pengujian di panel test runs.
            </p>
          </div>
        </div>

        {/* Informative Note */}
        <div className="flex items-start gap-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3.5 text-xs text-muted-foreground">
          <Upload className="mt-0.5 size-4 shrink-0 text-indigo-500" />
          <p className="leading-relaxed">
            Pengaturan ini tersimpan di browser Anda dan langsung diterapkan ke semua area dropzone tanpa perlu
            memuat ulang halaman. Jika dinonaktifkan, tampilan dropzone akan beralih ke mode standar yang ringkas dan minimalis.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
