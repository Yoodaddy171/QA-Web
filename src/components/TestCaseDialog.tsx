'use client';

import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

// Types (Mirrored from page.tsx or moved to a shared types file later)
interface Module {
  id: string;
  name: string;
}

interface TestCase {
  id: string;
  testCaseId: string;
  page: string;
  subMenu?: string | null;
  weight?: string | null;
  calculatedWeight?: number | null;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  actualResult?: string | null;
  status: string;
  progress: number;
  remarks?: string | null;
  priority: string;
  moduleId?: string | null;
}

export const EMPTY_TEST_CASE = {
  testCaseId: '',
  page: '',
  subMenu: '',
  weight: '',
  testType: 'Positive',
  testAction: '',
  steps: '',
  expectedResult: '',
  actualResult: '',
  status: 'NOT DONE',
  progress: 0,
  remarks: '',
  priority: 'Medium',
  moduleId: '',
};

interface TestCaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTestCase: TestCase | null;
  initialTestCase?: Partial<typeof EMPTY_TEST_CASE> | null;
  selectedProject: string;
  modules: Module[];
  onSaveSuccess: () => void;
}

export function TestCaseDialog({
  open,
  onOpenChange,
  editingTestCase,
  initialTestCase,
  selectedProject,
  modules,
  onSaveSuccess
}: TestCaseDialogProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState(EMPTY_TEST_CASE);

  // Initialize form when editingTestCase changes or dialog opens
  useEffect(() => {
    if (!open) return;

    const nextFormData = editingTestCase ? {
      testCaseId: editingTestCase.testCaseId || '',
      page: editingTestCase.page || '',
      subMenu: editingTestCase.subMenu || '',
      weight: editingTestCase.weight || '',
      testType: editingTestCase.testType || 'Positive',
      testAction: editingTestCase.testAction || '',
      steps: editingTestCase.steps || '',
      expectedResult: editingTestCase.expectedResult || '',
      actualResult: editingTestCase.actualResult || '',
      status: editingTestCase.status || 'NOT DONE',
      progress: editingTestCase.progress || 0,
      remarks: editingTestCase.remarks || '',
      priority: editingTestCase.priority || 'Medium',
      moduleId: editingTestCase.moduleId || '',
    } : {
      ...EMPTY_TEST_CASE,
      ...(initialTestCase || {}),
      moduleId: initialTestCase?.moduleId || '',
    };

    const timer = window.setTimeout(() => {
      setFormData(nextFormData);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    }
  }, [open, editingTestCase, initialTestCase]);

  const handleSaveTestCase = async () => {
    if (
      !formData.testCaseId.trim()
      || !formData.page.trim()
      || !formData.testAction.trim()
      || !formData.steps.trim()
      || !formData.expectedResult.trim()
    ) {
      toast({ title: 'Error', description: 'Mohon isi field yang wajib (*)', variant: 'destructive' });
      return;
    }

    const payload = {
      ...formData,
      testCaseId: formData.testCaseId.trim(),
      page: formData.page.trim(),
      testAction: formData.testAction.trim(),
      steps: formData.steps.trim(),
      expectedResult: formData.expectedResult.trim(),
      projectId: selectedProject,
      moduleId: formData.moduleId || null,
      actualResult: formData.actualResult || null,
      subMenu: formData.subMenu.trim() || null,
      remarks: formData.remarks.trim() || null,
    };

    try {
      if (editingTestCase) {
        const response = await fetch('/api/testcases', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingTestCase.id, ...payload }),
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Gagal update test case');
        }
        toast({ title: 'Berhasil', description: 'Test case berhasil diupdate' });
      } else {
        const response = await fetch('/api/testcases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.error || 'Gagal membuat test case');
        }
        toast({ title: 'Berhasil', description: 'Test case berhasil dibuat' });
      }
      onOpenChange(false);
      onSaveSuccess();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Gagal menyimpan test case', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto border-border/60 bg-card/95 backdrop-blur-md text-foreground elevation-3 rounded-2xl scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent p-6">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
            {editingTestCase ? 'Edit Test Case' : 'Tambah Test Case Baru'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {editingTestCase ? 'Ubah detail test case.' : 'Isi informasi test case yang akan dibuat.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Test Case ID <span className="text-red-500">*</span></Label>
              <Input
                value={formData.testCaseId}
                onChange={(e) => setFormData({ ...formData, testCaseId: e.target.value })}
                placeholder="contoh: A-001"
                className="rounded-xl border-border/60 bg-secondary/30 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Page / Menu <span className="text-red-500">*</span></Label>
              <Input
                value={formData.page}
                onChange={(e) => setFormData({ ...formData, page: e.target.value })}
                placeholder="contoh: CMS Login"
                className="rounded-xl border-border/60 bg-secondary/30 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sub Menu</Label>
              <Input
                value={formData.subMenu}
                onChange={(e) => setFormData({ ...formData, subMenu: e.target.value })}
                placeholder="contoh: Order List"
                className="rounded-xl border-border/60 bg-secondary/30 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bobot (Otomatis)</Label>
              <div className="flex items-center h-9 px-3 rounded-xl border border-border/60 bg-secondary/20 text-sm text-muted-foreground/80 font-medium">
                {editingTestCase?.calculatedWeight != null
                  ? `${editingTestCase.calculatedWeight.toFixed(2)}%`
                  : 'Akan dihitung otomatis'}
              </div>
              <p className="text-[10px] text-muted-foreground/60 leading-tight">
                Bobot dihitung otomatis: 100% ÷ total test case dalam menu yang sama
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tipe Test <span className="text-red-500">*</span></Label>
              <Select value={formData.testType} onValueChange={(v) => setFormData({ ...formData, testType: v })}>
                <SelectTrigger className="rounded-xl border-border/60 bg-secondary/30 text-foreground focus:ring-primary/20 focus:border-primary transition-all duration-200"><SelectValue /></SelectTrigger>
                <SelectContent className="border-border/60 bg-card rounded-xl elevation-3">
                  <SelectItem value="Positive" className="rounded-lg">Positive</SelectItem>
                  <SelectItem value="Negative" className="rounded-lg">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Prioritas</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger className="rounded-xl border-border/60 bg-secondary/30 text-foreground focus:ring-primary/20 focus:border-primary transition-all duration-200"><SelectValue /></SelectTrigger>
                <SelectContent className="border-border/60 bg-card rounded-xl elevation-3">
                  <SelectItem value="Critical" className="rounded-lg text-red-400 font-medium">Critical</SelectItem>
                  <SelectItem value="High" className="rounded-lg text-orange-400 font-medium">High</SelectItem>
                  <SelectItem value="Medium" className="rounded-lg text-yellow-400 font-medium">Medium</SelectItem>
                  <SelectItem value="Low" className="rounded-lg text-blue-400 font-medium">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {modules.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Module</Label>
                <Select value={formData.moduleId || 'none'} onValueChange={(v) => setFormData({ ...formData, moduleId: v === 'none' ? '' : v })}>
                  <SelectTrigger className="rounded-xl border-border/60 bg-secondary/30 text-foreground focus:ring-primary/20 focus:border-primary transition-all duration-200"><SelectValue placeholder="Pilih Module" /></SelectTrigger>
                  <SelectContent className="border-border/60 bg-card rounded-xl elevation-3">
                    <SelectItem value="none" className="rounded-lg">Tanpa Module</SelectItem>
                    {modules.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="rounded-lg">{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Test Action <span className="text-red-500">*</span></Label>
            <Textarea
              value={formData.testAction}
              onChange={(e) => setFormData({ ...formData, testAction: e.target.value })}
              placeholder="Deskripsi aksi test yang dilakukan"
              rows={2}
              className="rounded-xl border-border/60 bg-secondary/30 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Test Steps <span className="text-red-500">*</span></Label>
            <Textarea
              value={formData.steps}
              onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
              placeholder="- Langkah 1&#10;- Langkah 2&#10;- Langkah 3"
              rows={4}
              className="rounded-xl border-border/60 bg-secondary/30 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200 font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Expected Result <span className="text-red-500">*</span></Label>
              <Textarea
                value={formData.expectedResult}
                onChange={(e) => setFormData({ ...formData, expectedResult: e.target.value })}
                placeholder="Hasil yang diharapkan"
                rows={2}
                className="rounded-xl border-border/60 bg-secondary/30 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actual Result</Label>
              <Select
                value={
                  formData.actualResult === 'As Expected' ? 'As Expected' :
                  formData.actualResult === 'Not As Expected' ? 'Not As Expected' :
                  '__none__'
                }
                onValueChange={(val) => {
                  const newActualResult = val === '__none__' ? '' : val;
                  if (newActualResult === 'Not As Expected') {
                    setFormData({ ...formData, actualResult: newActualResult, status: 'FAILED', progress: 0 });
                  } else if (newActualResult === 'As Expected') {
                    setFormData({ ...formData, actualResult: newActualResult, status: 'DONE', progress: 100 });
                  } else {
                    setFormData({ ...formData, actualResult: newActualResult, status: 'NOT DONE', progress: 0 });
                  }
                }}
              >
                <SelectTrigger className="rounded-xl border-border/60 bg-secondary/30 text-foreground focus:ring-primary/20 focus:border-primary transition-all duration-200"><SelectValue placeholder="Pilih hasil..." /></SelectTrigger>
                <SelectContent className="border-border/60 bg-card rounded-xl elevation-3">
                  <SelectItem value="__none__" className="rounded-lg">-</SelectItem>
                  <SelectItem value="As Expected" className="rounded-lg text-emerald-400 font-medium">As Expected</SelectItem>
                  <SelectItem value="Not As Expected" className="rounded-lg text-rose-400 font-medium">Not As Expected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</Label>
              <Select value={formData.status} onValueChange={(v) => {
                const progress = v === 'DONE' ? 100 : (v === 'IN PROGRESS' || v === 'READY TO RETEST') ? 50 : 0;
                const actualResult = v === 'DONE'
                  ? 'As Expected'
                  : v === 'FAILED'
                    ? 'Not As Expected'
                    : formData.actualResult;
                setFormData({ ...formData, status: v, progress, actualResult });
              }}>
                <SelectTrigger className="rounded-xl border-border/60 bg-secondary/30 text-foreground focus:ring-primary/20 focus:border-primary transition-all duration-200"><SelectValue /></SelectTrigger>
                <SelectContent className="border-border/60 bg-card rounded-xl elevation-3">
                  <SelectItem value="NOT DONE" className="rounded-lg">Not Done</SelectItem>
                  <SelectItem value="IN PROGRESS" className="rounded-lg">In Progress</SelectItem>
                  <SelectItem value="DONE" className="rounded-lg">Done</SelectItem>
                  <SelectItem value="BLOCKED" className="rounded-lg">Blocked</SelectItem>
                  <SelectItem value="FAILED" className="rounded-lg">Failed</SelectItem>
                  <SelectItem value="READY TO RETEST" className="rounded-lg">Ready to Retest</SelectItem>
                  <SelectItem value="TBA" className="rounded-lg">TBA (To Be Announced)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Progress (Otomatis)</Label>
              <div className="flex items-center gap-3 h-9 px-3 rounded-xl border border-border/60 bg-secondary/20">
                <Progress value={formData.progress} className="h-2 flex-1 bg-muted-foreground/10" />
                <span className="text-xs font-bold min-w-[36px] text-right text-foreground">{formData.progress}%</span>
              </div>
              <p className="text-[10px] text-muted-foreground/60 leading-tight">
                DONE=100%, IN PROGRESS/READY TO RETEST=50%, LAINNYA=0%
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Remarks / Catatan</Label>
            <Textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Catatan tambahan"
              rows={2}
              className="rounded-xl border-border/60 bg-secondary/30 text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/20 focus-visible:border-primary transition-all duration-200"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border/40 pt-4 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Batal</Button>
          <Button onClick={handleSaveTestCase} variant="majestic" className="rounded-xl bg-gradient-to-r from-primary to-cyan-500 hover:from-primary/90 hover:to-cyan-500/90 text-white font-medium shadow-md hover:shadow-cyan-500/10 transition-all duration-200 gap-1.5">
            <Save className="w-4 h-4" /> {editingTestCase ? 'Simpan Perubahan' : 'Buat Test Case'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
