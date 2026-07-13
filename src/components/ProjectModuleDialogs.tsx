'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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
  onCreateProject: () => void;
  onCreateModule: () => void;
}

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
  const inputClass = 'border-border/60 bg-secondary/50 text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/30 rounded-xl';
  const labelClass = 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground';

  return (
    <>
      <Dialog open={showCreateProject} onOpenChange={setShowCreateProject}>
        <DialogContent className="border-border/60 bg-card text-foreground elevation-3 rounded-2xl sm:max-w-md overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-indigo-500 to-cyan-500" />
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary via-indigo-400 to-cyan-400 bg-clip-text text-transparent">Buat Project Baru</DialogTitle>
            <DialogDescription className="text-muted-foreground text-[11px] font-medium leading-relaxed">Project digunakan untuk mengelompokkan test case berdasarkan aplikasi yang diuji.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">Nama Project *</Label>
              <Input
                className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm font-medium text-foreground focus-visible:ring-primary/20 transition"
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="contoh: Servios CMS"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">Deskripsi</Label>
              <Textarea
                className="min-h-[100px] rounded-xl border-border/60 bg-secondary/30 text-sm font-medium text-foreground focus-visible:ring-primary/20 transition p-3"
                value={newProjectDesc}
                onChange={(event) => setNewProjectDesc(event.target.value)}
                placeholder="Deskripsi project (opsional)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 pt-4 mt-2">
            <Button variant="outline" onClick={() => setShowCreateProject(false)} className="h-10 rounded-xl border-border/60 bg-secondary/30 text-muted-foreground hover:text-foreground font-bold text-xs px-6 transition">Batal</Button>
            <Button
              onClick={onCreateProject}
              disabled={!newProjectName.trim()}
              className="h-10 rounded-xl bg-gradient-to-r from-primary via-indigo-600 to-cyan-600 hover:from-primary/90 hover:via-indigo-600/90 hover:to-cyan-600/90 text-white font-bold text-xs px-6 shadow-lg hover:shadow-primary/20 transition"
            >
              Buat Projec
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateModule} onOpenChange={setShowCreateModule}>
        <DialogContent className="border-border/60 bg-card text-foreground elevation-3 rounded-2xl sm:max-w-md overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-indigo-500 to-cyan-500" />
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary via-indigo-400 to-cyan-400 bg-clip-text text-transparent">Buat Module Baru</DialogTitle>
            <DialogDescription className="text-muted-foreground text-[11px] font-medium leading-relaxed">Module digunakan untuk mengorganisir test case berdasarkan fitur atau bagian dari aplikasi.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">Nama Module *</Label>
              <Input
                className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm font-medium text-foreground focus-visible:ring-primary/20 transition"
                value={newModuleName}
                onChange={(event) => setNewModuleName(event.target.value)}
                placeholder="contoh: CMS Login, Order Management"
              />
            </div>
          </div>
          <DialogFooter className="border-t border-border/40 pt-4 mt-2">
            <Button variant="outline" onClick={() => setShowCreateModule(false)} className="h-10 rounded-xl border-border/60 bg-secondary/30 text-muted-foreground hover:text-foreground font-bold text-xs px-6 transition">Batal</Button>
            <Button
              onClick={onCreateModule}
              disabled={!newModuleName.trim()}
              className="h-10 rounded-xl bg-gradient-to-r from-primary via-indigo-600 to-cyan-600 hover:from-primary/90 hover:via-indigo-600/90 hover:to-cyan-600/90 text-white font-bold text-xs px-6 shadow-lg hover:shadow-primary/20 transition"
            >
              Buat Module
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
