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
        <DialogContent className="border-border bg-card text-foreground elevation-3 rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Buat Project Baru</DialogTitle>
            <DialogDescription className="text-muted-foreground">Project digunakan untuk mengelompokkan test case berdasarkan aplikasi yang diuji.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className={labelClass}>Nama Project *</Label>
              <Input className={inputClass} value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="contoh: Servios CMS" />
            </div>
            <div className="space-y-2">
              <Label className={labelClass}>Deskripsi</Label>
              <Textarea className={inputClass} value={newProjectDesc} onChange={(event) => setNewProjectDesc(event.target.value)} placeholder="Deskripsi project (opsional)" rows={3} />
            </div>
          </div>
          <DialogFooter className="border-t border-border/50 pt-4">
            <Button variant="outline" onClick={() => setShowCreateProject(false)} className="rounded-xl">Batal</Button>
            <Button onClick={onCreateProject} disabled={!newProjectName.trim()} variant="majestic" className="rounded-xl">Buat Project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreateModule} onOpenChange={setShowCreateModule}>
        <DialogContent className="border-border bg-card text-foreground elevation-3 rounded-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground">Buat Module Baru</DialogTitle>
            <DialogDescription className="text-muted-foreground">Module digunakan untuk mengorganisir test case berdasarkan fitur atau bagian dari aplikasi.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className={labelClass}>Nama Module *</Label>
              <Input className={inputClass} value={newModuleName} onChange={(event) => setNewModuleName(event.target.value)} placeholder="contoh: CMS Login, Order Management" />
            </div>
          </div>
          <DialogFooter className="border-t border-border/50 pt-4">
            <Button variant="outline" onClick={() => setShowCreateModule(false)} className="rounded-xl">Batal</Button>
            <Button onClick={onCreateModule} disabled={!newModuleName.trim()} variant="majestic" className="rounded-xl">Buat Module</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
