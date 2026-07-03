'use client';

import React, { useState } from 'react';
import { Bot, Loader2, RefreshCw, Save, Sparkles, Wand2 } from 'lucide-react';
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
import { cn } from '@/lib/utils';

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
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col border-border/60 bg-card text-foreground elevation-3 rounded-2xl p-0">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-indigo-500 to-cyan-500" />

        <DialogHeader className="px-6 py-5 border-b border-border/40 bg-gradient-to-r from-primary/5 via-indigo-500/5 to-cyan-500/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/15 text-primary shadow-sm">
              <Wand2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary via-indigo-400 to-cyan-400 bg-clip-text text-transparent">AI Testcase Refiner</DialogTitle>
              <DialogDescription className="text-muted-foreground text-[11px] font-medium leading-relaxed">Sempurnakan test case Anda dengan bantuan AI untuk detail yang lebih baik.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
          <div className="rounded-2xl border border-border/60 bg-secondary/20 p-5 shadow-inner relative group overflow-hidden">
            <div className="absolute top-0 right-0 h-32 w-32 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="flex flex-wrap items-center gap-3 relative z-10">
              <span className="font-mono text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">{testCase.testCaseId}</span>
              <Badge variant="outline" className={cn("rounded-lg border-border/40 text-[9px] font-semibold uppercase tracking-tight py-0.5 shadow-sm", getTestTypeColor(testCase.testType))}>{testCase.testType}</Badge>
              <Badge className={cn("rounded-lg text-[9px] font-semibold uppercase tracking-tight py-0.5 shadow-sm", getPriorityColor(testCase.priority))}>{testCase.priority}</Badge>
              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">{testCase.page}{testCase.subMenu ? ` › ${testCase.subMenu}` : ''}</span>
            </div>
            <p className="mt-4 text-sm font-semibold text-foreground/90 italic tracking-tight leading-relaxed">&quot;{testCase.testAction}&quot;</p>
          </div>

          {!hasPreview && !refining && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-2.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">Mode Refinement</Label>
                <Select value={mode} onValueChange={setMode}>
                  <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/30 text-sm font-bold text-foreground focus:ring-primary/20 transition-all duration-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl bg-card border-border/60 elevation-3">
                    <SelectItem value="format" className="rounded-lg font-medium">Rapikan format</SelectItem>
                    <SelectItem value="complete" className="rounded-lg font-medium">Lengkapi field kosong/kurang jelas</SelectItem>
                    <SelectItem value="standardize" className="rounded-lg font-medium">Standarisasi bahasa QA</SelectItem>
                    <SelectItem value="negative" className="rounded-lg font-medium">Buat versi negative-oriented</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex gap-4 items-start shadow-inner">
                <div className="mt-1 p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                  <strong className="text-primary font-semibold uppercase tracking-tight mr-1.5">Note:</strong> AI akan mempelajari pola kalimat Anda dan menyempurnakannya tanpa merubah inti dari skenario pengujian.
                </p>
              </div>
            </div>
          )}

          {refining && (
            <div className="flex flex-col items-center justify-center py-24 space-y-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-primary/10 border-t-primary animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Bot className="h-10 w-10 text-primary animate-pulse" />
                </div>
                <div className="absolute -top-1 -right-1">
                  <Sparkles className="h-6 w-6 text-cyan-400 animate-bounce" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="font-semibold text-foreground uppercase tracking-[0.2em] text-[10px]">Optimizing Test Case</p>
                <p className="text-[11px] text-muted-foreground font-medium animate-pulse">Consulting AI model for better clarity...</p>
              </div>
            </div>
          )}

          {refinedCase && !refining && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border/60 bg-secondary/20 p-5 shadow-inner">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground opacity-50 mb-3">Tipe Test Baru</p>
                  <Badge variant="outline" className={cn("rounded-lg border-border/40 text-[10px] font-semibold uppercase tracking-tight py-1 px-3 shadow-sm", getTestTypeColor(refinedCase.testType))}>{refinedCase.testType}</Badge>
                </div>
                <div className="rounded-2xl border border-border/60 bg-secondary/20 p-5 shadow-inner">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground opacity-50 mb-3">Prioritas Baru</p>
                  <Badge className={cn("rounded-lg text-[10px] font-semibold uppercase tracking-tight py-1 px-3 shadow-sm", getPriorityColor(refinedCase.priority))}>{refinedCase.priority}</Badge>
                </div>
              </div>

              <div className="space-y-6">
                {FIELDS.map((field) => (
                  <div key={field.key} className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground opacity-60">Before: {field.label}</Label>
                      </div>
                      <div className="min-h-[100px] rounded-2xl border border-border/40 bg-secondary/10 p-4 text-[11px] text-muted-foreground font-medium leading-relaxed whitespace-pre-line shadow-inner opacity-60 italic">
                        {String(testCase[field.key as keyof TestCase] || '—')}
                      </div>
                    </div>
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                        <Label className="text-[10px] font-semibold uppercase tracking-wider text-primary">AI Preview: {field.label}</Label>
                      </div>
                      <div className={cn(
                        "min-h-[100px] rounded-2xl border p-4 text-[11px] font-bold leading-relaxed whitespace-pre-line shadow-lg transition-all",
                        field.key === 'testAction' ? "text-[13px] font-semibold text-foreground" : "text-foreground/90",
                        "border-primary/30 bg-card shadow-primary/5"
                      )}>
                        {String(refinedCase[field.key] || '—')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-5 border-t border-border/40 bg-secondary/10 shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-6 rounded-lg border-primary/20 bg-primary/10 text-[9px] font-semibold text-primary uppercase tracking-tight px-2">
                Copilot Refiner 2.0
              </Badge>
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                onClick={closeDialog}
                className="h-10 rounded-xl border-border/60 bg-card text-muted-foreground font-bold text-xs px-6 transition-all hover:bg-secondary"
              >
                Batal
              </Button>

              {hasPreview && !refining ? (
                <>
                  <Button
                    variant="outline"
                    onClick={onReset}
                    className="h-10 gap-2 rounded-xl border-border/60 bg-card text-primary font-bold text-xs px-5 hover:bg-primary/5 transition-all"
                  >
                    <RefreshCw className="w-4 h-4" /> Rese
                  </Button>
                  <Button
                    onClick={onApply}
                    disabled={saving}
                    className="h-10 gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs px-8 shadow-lg hover:shadow-emerald-500/20 transition-all duration-300 uppercase tracking-wider"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Apply Refinemen
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => onRefine(mode)}
                  disabled={refining}
                  className="h-11 gap-2.5 rounded-xl bg-gradient-to-r from-primary via-indigo-600 to-cyan-600 hover:from-primary/90 hover:via-indigo-600/90 hover:to-cyan-600/90 text-white font-semibold text-xs px-8 shadow-lg hover:shadow-primary/30 transition-all duration-300 uppercase tracking-wider"
                >
                  {refining ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Refine Testcase
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
