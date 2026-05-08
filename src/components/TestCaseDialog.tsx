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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingTestCase ? 'Edit Test Case' : 'Tambah Test Case Baru'}</DialogTitle>
          <DialogDescription>
            {editingTestCase ? 'Ubah detail test case.' : 'Isi informasi test case yang akan dibuat.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Test Case ID *</Label>
              <Input
                value={formData.testCaseId}
                onChange={(e) => setFormData({ ...formData, testCaseId: e.target.value })}
                placeholder="contoh: A-001"
              />
            </div>
            <div className="space-y-2">
              <Label>Page / Menu *</Label>
              <Input
                value={formData.page}
                onChange={(e) => setFormData({ ...formData, page: e.target.value })}
                placeholder="contoh: CMS Login"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sub Menu</Label>
              <Input
                value={formData.subMenu}
                onChange={(e) => setFormData({ ...formData, subMenu: e.target.value })}
                placeholder="contoh: Order List"
              />
            </div>
            <div className="space-y-2">
              <Label>Bobot (Otomatis)</Label>
              <div className="flex items-center h-9 px-3 rounded-md border bg-muted/50 text-sm text-muted-foreground">
                {editingTestCase?.calculatedWeight != null
                  ? `${editingTestCase.calculatedWeight.toFixed(2)}%`
                  : 'Akan dihitung otomatis'}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Bobot dihitung otomatis: 100% ÷ total test case dalam menu yang sama
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipe Test *</Label>
              <Select value={formData.testType} onValueChange={(v) => setFormData({ ...formData, testType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Positive">Positive</SelectItem>
                  <SelectItem value="Negative">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioritas</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Critical">Critical</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="Low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {modules.length > 0 && (
              <div className="space-y-2">
                <Label>Module</Label>
                <Select value={formData.moduleId || 'none'} onValueChange={(v) => setFormData({ ...formData, moduleId: v === 'none' ? '' : v })}>
                  <SelectTrigger><SelectValue placeholder="Pilih Module" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tanpa Module</SelectItem>
                    {modules.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Test Action *</Label>
            <Textarea
              value={formData.testAction}
              onChange={(e) => setFormData({ ...formData, testAction: e.target.value })}
              placeholder="Deskripsi aksi test yang dilakukan"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>Test Steps *</Label>
            <Textarea
              value={formData.steps}
              onChange={(e) => setFormData({ ...formData, steps: e.target.value })}
              placeholder="- Langkah 1&#10;- Langkah 2&#10;- Langkah 3"
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Expected Result *</Label>
              <Textarea
                value={formData.expectedResult}
                onChange={(e) => setFormData({ ...formData, expectedResult: e.target.value })}
                placeholder="Hasil yang diharapkan"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Actual Result</Label>
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
                <SelectTrigger><SelectValue placeholder="Pilih hasil..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">-</SelectItem>
                  <SelectItem value="As Expected">As Expected</SelectItem>
                  <SelectItem value="Not As Expected">Not As Expected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => {
                const progress = v === 'DONE' ? 100 : (v === 'IN PROGRESS' || v === 'READY TO RETEST') ? 50 : 0;
                const actualResult = v === 'DONE'
                  ? 'As Expected'
                  : v === 'FAILED'
                    ? 'Not As Expected'
                    : formData.actualResult;
                setFormData({ ...formData, status: v, progress, actualResult });
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NOT DONE">Not Done</SelectItem>
                  <SelectItem value="IN PROGRESS">In Progress</SelectItem>
                  <SelectItem value="DONE">Done</SelectItem>
                  <SelectItem value="BLOCKED">Blocked</SelectItem>
                  <SelectItem value="FAILED">Failed</SelectItem>
                  <SelectItem value="READY TO RETEST">Ready to Retest</SelectItem>
                  <SelectItem value="TBA">TBA (To Be Announced)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Progress (Otomatis)</Label>
              <div className="flex items-center gap-2 h-9 px-3 rounded-md border bg-muted/50">
                <Progress value={formData.progress} className="h-2 flex-1" />
                <span className="text-sm font-semibold min-w-[40px] text-right">{formData.progress}%</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                DONE=100%, IN PROGRESS/READY TO RETEST=50%, NOT DONE/BLOCKED/FAILED/TBA=0%
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Remarks / Catatan</Label>
            <Textarea
              value={formData.remarks}
              onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="Catatan tambahan"
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSaveTestCase} className="gap-1.5">
            <Save className="w-4 h-4" /> {editingTestCase ? 'Simpan Perubahan' : 'Buat Test Case'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
