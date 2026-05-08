'use client';

import React, { useState } from 'react';
import { Loader2, RefreshCw, Save, Sparkles, Wand2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface Module {
  id: string;
  name: string;
  projectId: string;
  _count?: { testCases: number };
}

export interface GeneratedTestCasePreview {
  testCaseId: string;
  page: string;
  subMenu: string;
  weight: string;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  priority: string;
  moduleId: string | null;
}

interface AIGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modules: Module[];
  aiGenerating: boolean;
  aiGeneratedCases: GeneratedTestCasePreview[];
  aiSelectedCases: Set<number>;
  aiSaving: boolean;
  handleAIGenerate: (request: { prompt: string; moduleFilter: string; count: number }) => void;
  handleAISaveSelected: () => void;
  toggleAISelectAll: () => void;
  toggleAISelect: (index: number) => void;
  resetGeneratedCases: () => void;
  getTestTypeColor: (type: string) => string;
  getPriorityColor: (priority: string) => string;
}

const PROMPT_SUGGESTIONS = [
  'Buat test case untuk fitur login',
  'Test case negative untuk form registrasi',
  'Test case CRUD untuk halaman user management',
  'Test case untuk fitur search dan filter',
  'Test case untuk validasi input form',
];

export function AIGenerateDialog({
  open,
  onOpenChange,
  modules,
  aiGenerating,
  aiGeneratedCases,
  aiSelectedCases,
  aiSaving,
  handleAIGenerate,
  handleAISaveSelected,
  toggleAISelectAll,
  toggleAISelect,
  resetGeneratedCases,
  getTestTypeColor,
  getPriorityColor,
}: AIGenerateDialogProps) {
  const [prompt, setPrompt] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [generateCount, setGenerateCount] = useState(4);
  const closeDialog = () => onOpenChange(false);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border-border bg-card text-foreground elevation-3 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <div className="p-1.5 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500">
              <Wand2 className="w-4 h-4 text-white" />
            </div>
            AI Test Case Generator
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            AI akan menganalisis test case yang sudah ada di project ini dan menghasilkan test case baru berdasarkan konteks serta instruksi Anda.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
          {!aiGeneratedCases.length && !aiGenerating && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Apa yang ingin Anda test?</Label>
                <Textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Contoh: Buatkan test case untuk fitur register akun baru, termasuk validasi email, password strength, dan konfirmasi password. Sertakan positive dan negative test case."
                  rows={4}
                  className="resize-none rounded-xl border-border/60 bg-secondary/50 text-foreground placeholder:text-muted-foreground focus-visible:ring-violet-500/40"
                />
                <div className="flex flex-wrap gap-1.5">
                  {PROMPT_SUGGESTIONS.map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      className="h-7 rounded-lg text-xs text-muted-foreground hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 dark:hover:bg-violet-500/10 dark:hover:text-violet-300 dark:hover:border-violet-500/30"
                      onClick={() => setPrompt(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {modules.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs">Fokus pada Module (opsional)</Label>
                    <Select value={moduleFilter} onValueChange={setModuleFilter}>
                      <SelectTrigger className="w-full rounded-xl border-border/60 bg-secondary/50"><SelectValue placeholder="Semua Module" /></SelectTrigger>
                      <SelectContent className="rounded-xl bg-card border-border/60 elevation-3">
                        <SelectItem value="all" className="rounded-lg">Semua Module</SelectItem>
                        {modules.map((module) => (
                          <SelectItem key={module.id} value={module.id} className="rounded-lg">{module.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Jumlah test case</Label>
                  <Select value={String(generateCount)} onValueChange={(value) => setGenerateCount(Number(value))}>
                    <SelectTrigger className="w-full rounded-xl border-border/60 bg-secondary/50"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl bg-card border-border/60 elevation-3">
                      <SelectItem value="3" className="rounded-lg">3 test case</SelectItem>
                      <SelectItem value="4" className="rounded-lg">4 test case</SelectItem>
                      <SelectItem value="6" className="rounded-lg">6 test case</SelectItem>
                      <SelectItem value="8" className="rounded-lg">8 test case</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="bg-violet-50 border border-violet-200 dark:bg-violet-500/10 dark:border-violet-500/20 rounded-xl p-4">
                <p className="text-[11px] text-violet-700 dark:text-violet-300 font-medium leading-relaxed">
                  <strong className="text-violet-800 dark:text-violet-200 uppercase tracking-wide mr-1.5">Tips:</strong> Semakin spesifik instruksi Anda, semakin relevan test case yang dihasilkan AI. AI akan meniru format, gaya penulisan, dan konvensi penamaan dari data yang ada di project ini.
                </p>
              </div>
            </div>
          )}

          {aiGenerating && (
            <div className="flex flex-col items-center justify-center py-20 space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-4 border-border border-t-violet-500 animate-spin" />
                <Sparkles className="w-8 h-8 text-violet-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div className="text-center">
                <p className="font-bold text-foreground uppercase tracking-wider text-xs">Generating...</p>
                <p className="text-[10px] text-muted-foreground font-medium mt-2 animate-pulse">Analyzing project patterns...</p>
              </div>
            </div>
          )}

          {aiGeneratedCases.length > 0 && !aiGenerating && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={aiSelectedCases.size === aiGeneratedCases.length}
                    onCheckedChange={toggleAISelectAll}
                    className="border-border data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                  />
                  <span className="text-xs font-semibold text-foreground">Select All ({aiGeneratedCases.length} results)</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-medium">{aiSelectedCases.size} Selected</Badge>
              </div>
              <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-2">
                {aiGeneratedCases.map((testCase, index) => (
                  <div
                    key={`${testCase.testCaseId}-${index}`}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
                      aiSelectedCases.has(index) 
                        ? 'border-violet-300 bg-violet-50 dark:border-violet-500/50 dark:bg-violet-500/10' 
                        : 'border-border/60 bg-secondary/30 hover:bg-secondary/60 hover:border-border'
                    }`}
                    onClick={() => toggleAISelect(index)}
                  >
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={aiSelectedCases.has(index)}
                        onCheckedChange={() => toggleAISelect(index)}
                        className="mt-1 border-border data-[state=checked]:bg-violet-600 data-[state=checked]:border-violet-600"
                      />
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono text-xs font-bold text-violet-600 dark:text-violet-400">{testCase.testCaseId}</span>
                          <Badge variant="outline" className={`text-[9px] font-semibold uppercase ${getTestTypeColor(testCase.testType)}`}>
                            {testCase.testType}
                          </Badge>
                          <Badge className={`text-[9px] font-semibold uppercase ${getPriorityColor(testCase.priority)}`}>{testCase.priority}</Badge>
                          <span className="text-[10px] font-semibold text-muted-foreground">{testCase.page}</span>
                          {testCase.subMenu && <span className="text-[10px] text-muted-foreground">› {testCase.subMenu}</span>}
                        </div>
                        <p className="text-sm font-semibold text-foreground">{testCase.testAction}</p>
                        <div className="text-[11px] text-muted-foreground whitespace-pre-line line-clamp-3 leading-relaxed border-l-2 border-border pl-3">{testCase.steps}</div>
                        <div className="flex gap-4 text-[10px] font-medium pt-1">
                          <span className="text-emerald-600 dark:text-emerald-400">Expected: {testCase.expectedResult}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 border-t border-border/50 pt-3">
          {aiGeneratedCases.length > 0 && !aiGenerating ? (
            <div className="flex items-center gap-2 w-full">
              <Button variant="outline" onClick={resetGeneratedCases} className="gap-1.5 rounded-xl">
                <RefreshCw className="w-4 h-4" /> Coba Lagi
              </Button>
              <div className="flex-1" />
              <Button variant="outline" onClick={closeDialog} className="rounded-xl">Batal</Button>
              <Button
                onClick={handleAISaveSelected}
                disabled={aiSelectedCases.size === 0 || aiSaving}
                className="gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0"
              >
                {aiSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Simpan {aiSelectedCases.size} Test Case
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <Button variant="outline" onClick={closeDialog} className="rounded-xl">Batal</Button>
              <div className="flex-1" />
              <Button
                onClick={() => handleAIGenerate({ prompt, moduleFilter, count: generateCount })}
                disabled={!prompt.trim() || aiGenerating}
                className="gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white border-0"
              >
                {aiGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" /> Generate Test Case
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
