'use client';

import React, { useState } from 'react';
import { FolderPlus, Layers, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ProjectModuleDialogsProps {
  showCreateProject: boolean;
  showCreateModule: boolean;
  newProjectName: string;
  newProjectDesc: string;
  newModuleName: string;
  setShowCreateProject: (value: boolean) => void;
  setShowCreateModule: (value: boolean) => void;
  setNewProjectName: (value: string) => void;
  setNewProjectDesc: (value: string) => void;
  setNewModuleName: (value: string) => void;
  onCreateProject: () => void | Promise<void | boolean>;
  onCreateModule: () => void | Promise<void | boolean>;
}

const PROJECT_TYPE_PRESETS = [
  { label: 'Web App', hint: 'Pengujian aplikasi web antarmuka pengguna' },
  { label: 'Mobile App', hint: 'Pengujian aplikasi mobile iOS / Android' },
  { label: 'API / Backend', hint: 'Pengujian integrasi endpoint dan arsitektur microservices' },
  { label: 'Internal Tool', hint: 'Pengujian portal operasional dan dashboard admin' },
];

const MODULE_NAME_SUGGESTIONS = [
  'Autentikasi & Akun',
  'Dashboard & Analitik',
  'Transaksi & Pembayaran',
  'Manajemen Pengguna',
  'Laporan & Ekspor Data',
  'Pengaturan Sistem',
];

export function ProjectModuleDialogs({
  showCreateProject,
  showCreateModule,
  newProjectName,
  newProjectDesc,
  newModuleName,
  setShowCreateProject,
  setShowCreateModule,
  setNewProjectName,
  setNewProjectDesc,
  setNewModuleName,
  onCreateProject,
  onCreateModule,
}: ProjectModuleDialogsProps) {
  const [isSubmittingProject, setIsSubmittingProject] = useState(false);
  const [isSubmittingModule, setIsSubmittingModule] = useState(false);

  const handleProjectSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newProjectName.trim() || isSubmittingProject) return;
    setIsSubmittingProject(true);
    try {
      await onCreateProject();
    } finally {
      setIsSubmittingProject(false);
    }
  };

  const handleModuleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newModuleName.trim() || isSubmittingModule) return;
    setIsSubmittingModule(true);
    try {
      await onCreateModule();
    } finally {
      setIsSubmittingModule(false);
    }
  };

  const handlePresetSelect = (preset: typeof PROJECT_TYPE_PRESETS[number]) => {
    if (!newProjectDesc.trim()) {
      setNewProjectDesc(preset.hint);
    }
  };

  return (
    <>
      {/* Create New Project Dialog */}
      <Dialog open={showCreateProject} onOpenChange={setShowCreateProject}>
        <DialogContent className="border border-border/80 bg-card text-foreground shadow-2xl rounded-2xl sm:max-w-md p-6 overflow-hidden">
          <form onSubmit={handleProjectSubmit} className="space-y-5">
            <DialogHeader className="gap-1.5 text-left">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <FolderPlus className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                    Buat Project Baru
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground leading-normal">
                    Ruang kerja terstruktur untuk mengorganisasi modul, test case, dan traceability pengujian.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Quick Project Type Presets */}
            <div className="space-y-1.5">
              <span className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="size-3 text-indigo-500" />
                Preset Tipe Aplikasi (Opsional)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {PROJECT_TYPE_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className="rounded-lg border border-border/70 bg-secondary/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition hover:border-indigo-500/40 hover:bg-secondary hover:text-foreground active:scale-95"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Inputs */}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="create-project-name" className="text-xs font-semibold text-foreground">
                    Nama Project <span className="text-rose-500">*</span>
                  </Label>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {newProjectName.length}/60
                  </span>
                </div>
                <Input
                  id="create-project-name"
                  autoFocus
                  maxLength={60}
                  disabled={isSubmittingProject}
                  className="h-10 rounded-xl border-border/80 bg-background text-sm font-medium transition focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
                  value={newProjectName}
                  onChange={(event) => setNewProjectName(event.target.value)}
                  placeholder="contoh: Sarinah E-Commerce atau Welma API"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="create-project-desc" className="text-xs font-semibold text-foreground">
                    Deskripsi Project
                  </Label>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {newProjectDesc.length}/300
                  </span>
                </div>
                <Textarea
                  id="create-project-desc"
                  maxLength={300}
                  disabled={isSubmittingProject}
                  className="min-h-[88px] resize-none rounded-xl border-border/80 bg-background p-3 text-sm font-medium transition focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
                  value={newProjectDesc}
                  onChange={(event) => setNewProjectDesc(event.target.value)}
                  placeholder="Jelaskan tujuan pengujian, ruang lingkup sistem, atau target rilis (opsional)..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="mt-6 flex flex-row items-center justify-end gap-2 border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingProject}
                onClick={() => setShowCreateProject(false)}
                className="h-9 rounded-xl border-border/80 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={!newProjectName.trim() || isSubmittingProject}
                className="h-9 gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmittingProject ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Buat Project</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create New Module Dialog */}
      <Dialog open={showCreateModule} onOpenChange={setShowCreateModule}>
        <DialogContent className="border border-border/80 bg-card text-foreground shadow-2xl rounded-2xl sm:max-w-md p-6 overflow-hidden">
          <form onSubmit={handleModuleSubmit} className="space-y-5">
            <DialogHeader className="gap-1.5 text-left">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Layers className="size-5" />
                </div>
                <div>
                  <DialogTitle className="text-base font-bold tracking-tight text-foreground sm:text-lg">
                    Buat Module Baru
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground leading-normal">
                    Kelompokkan test case berdasarkan fitur atau sub-sistem aplikasi.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Quick Module Suggestions */}
            <div className="space-y-1.5">
              <span className="flex items-center gap-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="size-3 text-indigo-500" />
                Saran Modul Cepat
              </span>
              <div className="flex flex-wrap gap-1.5">
                {MODULE_NAME_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setNewModuleName(suggestion)}
                    className={cn(
                      'rounded-lg border px-2.5 py-1 text-[11px] font-medium transition active:scale-95',
                      newModuleName === suggestion
                        ? 'border-indigo-500 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-semibold'
                        : 'border-border/70 bg-secondary/40 text-muted-foreground hover:border-indigo-500/40 hover:bg-secondary hover:text-foreground'
                    )}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>

            {/* Module Name Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="create-module-name" className="text-xs font-semibold text-foreground">
                  Nama Module <span className="text-rose-500">*</span>
                </Label>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {newModuleName.length}/50
                </span>
              </div>
              <Input
                id="create-module-name"
                autoFocus
                maxLength={50}
                disabled={isSubmittingModule}
                className="h-10 rounded-xl border-border/80 bg-background text-sm font-medium transition focus-visible:border-indigo-500 focus-visible:ring-indigo-500/20"
                value={newModuleName}
                onChange={(event) => setNewModuleName(event.target.value)}
                placeholder="contoh: Autentikasi Pengguna atau Keranjang Belanja"
              />
            </div>

            <DialogFooter className="mt-6 flex flex-row items-center justify-end gap-2 border-t border-border/60 pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={isSubmittingModule}
                onClick={() => setShowCreateModule(false)}
                className="h-9 rounded-xl border-border/80 px-4 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={!newModuleName.trim() || isSubmittingModule}
                className="h-9 gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {isSubmittingModule ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Buat Module</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
