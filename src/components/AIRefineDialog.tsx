'use client';

import React, { useState } from 'react';
import { Loader2, RefreshCw, Save, Sparkles, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { TestCase } from '@/components/TestCaseTable';

export interface RefinedTestCasePreview {
  testAction: string;
  steps: string;
  expectedResult: string;
  remarks: string;
  priority: string;
  testType: string;
}

interface AIRefineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testCase: TestCase | null;
  refinedCase: RefinedTestCasePreview | null;
  refining: boolean;
  saving: boolean;
  onRefine: (mode: string) => void;
  onApply: () => void;
  onReset: () => void;
  getPriorityColor: (priority: string) => string;
  getTestTypeColor: (type: string) => string;
}

const FIELDS: Array<{ key: keyof RefinedTestCasePreview; label: string; multiline?: boolean }> = [
  { key: 'testAction', label: 'Test Action' },
  { key: 'steps', label: 'Steps', multiline: true },
  { key: 'expectedResult', label: 'Expected Result', multiline: true },
  { key: 'remarks', label: 'Remarks', multiline: true },
];

export function AIRefineDialog({
  open,
  onOpenChange,
  testCase,
  refinedCase,
  refining,
  saving,
  onRefine,
  onApply,
  onReset,
  getPriorityColor,
  getTestTypeColor,
}: AIRefineDialogProps) {
  const [mode, setMode] = useState('format');

  if (!open || !testCase) return null;

  const hasPreview = Boolean(refinedCase);
  const closeDialog = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border-border bg-card text-foreground elevation-3 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <div className="rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 p-1.5">
              <Wand2 className="h-4 w-4 text-white" />
            </div>
            AI Testcase Refinement
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            AI akan memperbaiki testcase yang sedang dibuka dan menampilkan preview sebelum disimpan.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 space-y-6 overflow-y-auto p-1">
          <div className="rounded-2xl border border-border/60 bg-secondary/30 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs font-bold text-primary">{testCase.testCaseId}</span>
              <Badge variant="outline" className={`text-[9px] font-semibold uppercase ${getTestTypeColor(testCase.testType)}`}>{testCase.testType}</Badge>
              <Badge className={`text-[9px] font-semibold uppercase ${getPriorityColor(testCase.priority)}`}>{testCase.priority}</Badge>
              <span className="text-[10px] font-medium text-muted-foreground">{testCase.page}{testCase.subMenu ? ` › ${testCase.subMenu}` : ''}</span>
            </div>
            <p className="mt-3 text-sm font-semibold text-foreground italic">&quot;{testCase.testAction}&quot;</p>
          </div>

          {!hasPreview && !refining && (
            <div className="space-y-4">
              <div className="space-y-2.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">Mode Refinement</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger className="bg-secondary/50 border-border/60 text-foreground h-10 rounded-xl focus:ring-violet-500/40"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border/60 rounded-xl elevation-3">
                    <SelectItem value="format" className="rounded-lg">Rapikan format</SelectItem>
                    <SelectItem value="complete" className="rounded-lg">Lengkapi field kosong/kurang jelas</SelectItem>
                    <SelectItem value="standardize" className="rounded-lg">Standarisasi bahasa QA</SelectItem>
                    <SelectItem value="negative" className="rounded-lg">Buat versi negative-oriented</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-xl border border-violet-200 bg-violet-50 dark:border-violet-500/20 dark:bg-violet-500/10 p-4">
                <p className="text-[11px] text-violet-700 dark:text-violet-300 font-medium leading-relaxed">
                  <strong className="text-violet-800 dark:text-violet-200 uppercase tracking-wide mr-1.5">Privacy:</strong> Refinement hanya mengirim testcase ini ke AI, bukan seluruh database.
                </p>
              </div>
            </div>
          )}

          {refining && (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <div className="relative">
                <div className="h-20 w-20 animate-spin rounded-full border-4 border-border border-t-violet-500" />
                <Sparkles className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-violet-500 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-foreground">Processing...</p>
                <p className="mt-2 text-[10px] text-muted-foreground font-medium animate-pulse">Optimizing testcase...</p>
              </div>
            </div>
          )}

          {refinedCase && !refining && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tipe Test</p>
                  <Badge variant="outline" className={`font-semibold uppercase text-[10px] ${getTestTypeColor(refinedCase.testType)}`}>{refinedCase.testType}</Badge>
                </div>
                <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Prioritas</p>
                  <Badge className={`font-semibold uppercase text-[10px] ${getPriorityColor(refinedCase.priority)}`}>{refinedCase.priority}</Badge>
                </div>
              </div>

              {FIELDS.map((field) => (
                <div key={field.key} className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">Sebelum - {field.label}</Label>
                    <Textarea
                      readOnly
                      value={String(testCase[field.key as keyof TestCase] || '')}
                      rows={field.multiline ? 6 : 3}
                      className="resize-none bg-muted/50 border-border/60 text-muted-foreground rounded-xl text-[11px] leading-relaxed"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400 ml-1">AI Preview - {field.label}</Label>
                    <Textarea
                      readOnly
                      value={String(refinedCase[field.key] || '')}
                      rows={field.multiline ? 6 : 3}
                      className="resize-none border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-500/30 dark:bg-violet-500/5 dark:text-violet-100 rounded-xl font-medium text-[11px] leading-relaxed"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t border-border/50 pt-3">
          {hasPreview && !refining ? (
            <div className="flex w-full items-center gap-2">
              <Button variant="outline" onClick={onReset} className="gap-1.5 rounded-xl">
                <RefreshCw className="h-4 w-4" /> Coba Lagi
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={closeDialog} className="rounded-xl">Batal</Button>
              <Button onClick={onApply} disabled={saving} className="gap-1.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Apply Refinement
              </Button>
            </div>
          ) : (
            <div className="flex w-full items-center gap-2">
              <Button variant="outline" onClick={closeDialog} className="rounded-xl">Batal</Button>
              <div className="flex-1" />
              <Button onClick={() => onRefine(mode)} disabled={refining} className="gap-1.5 rounded-xl bg-violet-600 text-white hover:bg-violet-500">
                {refining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Refine Testcase
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
