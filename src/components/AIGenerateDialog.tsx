'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, Bot, Loader2, RefreshCw, Save, Sparkles, Target, Wand2 } from 'lucide-react';
import { motion } from 'framer-motion';
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
import { cn } from '@/lib/utils';

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
  projectId: string;
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

interface GenerateInsights {
  summary: {
    total: number;
    positive: number;
    negative: number;
    negativeRatio: number;
    notDone: number;
    inProgress: number;
    highPriorityOpen: number;
    activeBugFixes: number;
    weakSteps: number;
    genericExpected: number;
  };
  recommendation: string;
  suggestions: string[];
  gapAreas: Array<{
    label: string;
    moduleName: string;
    total: number;
    negative: number;
    positive: number;
    negativeRatio: number;
    samples: string[];
  }>;
}

export function AIGenerateDialog({
  open,
  onOpenChange,
  projectId,
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
  const [insights, setInsights] = useState<GenerateInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const closeDialog = () => onOpenChange(false);

  useEffect(() => {
    if (!open || !projectId) return;
    const controller = new AbortController();

    queueMicrotask(() => {
      setInsightsLoading(true);
      fetch(`/api/ai/generate-insights?projectId=${encodeURIComponent(projectId)}&moduleFilter=${encodeURIComponent(moduleFilter)}`, {
        signal: controller.signal,
      })
        .then(async response => {
          if (!response.ok) throw new Error('Failed to load insights');
          return response.json();
        })
        .then(data => setInsights(data))
        .catch(error => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          setInsights(null);
        })
        .finally(() => setInsightsLoading(false));
    });

    return () => controller.abort();
  }, [open, projectId, moduleFilter]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col border-border/60 bg-card text-foreground elevation-3 rounded-2xl p-0">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary via-indigo-500 to-cyan-500" />

        <DialogHeader className="px-6 py-5 border-b border-border/40 bg-gradient-to-r from-primary/5 via-indigo-500/5 to-cyan-500/5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary via-indigo-400 to-cyan-400 bg-clip-text text-transparent">AI Test Case Generator</DialogTitle>
              <DialogDescription className="text-muted-foreground text-[11px] font-medium leading-relaxed">AI akan menganalisis project patterns dan menghasilkan test case baru yang akurat.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
          {!aiGeneratedCases.length && !aiGenerating && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="space-y-2.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">Apa yang ingin Anda test?</Label>
                <Textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  placeholder="Contoh: Buatkan test case untuk fitur register akun baru, termasuk validasi email, password strength, dan konfirmasi password. Sertakan positive dan negative test case."
                  rows={4}
                  className="resize-none rounded-2xl border-border/60 bg-secondary/30 text-sm font-medium text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-primary/20 transition duration-300 p-4"
                />
                <div className="flex flex-wrap gap-1.5">
                  {(insights?.suggestions?.length ? insights.suggestions : PROMPT_SUGGESTIONS).map((suggestion) => (
                    <Button
                      key={suggestion}
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-xl text-[10px] font-bold text-muted-foreground hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition"
                      onClick={() => setPrompt(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-secondary/20 p-5 shadow-inner overflow-hidden relative group">
                <div className="absolute top-0 right-0 h-32 w-32 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="mb-4 flex items-start justify-between gap-3 relative z-10">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
                      <Target className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Rekomendasi Dinamis</p>
                      <p className="text-[10px] text-muted-foreground font-medium">{moduleFilter === 'all' ? 'Semua module' : modules.find(module => module.id === moduleFilter)?.name || 'Module terpilih'}</p>
                    </div>
                  </div>
                  {insightsLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                </div>

                {insights ? (
                  <div className="space-y-4 relative z-10">
                    <p className="text-sm font-bold leading-relaxed text-foreground/90">{insights.recommendation}</p>
                    <div className="grid gap-3 sm:grid-cols-4">
                      <div className="rounded-xl border border-border/50 bg-card/60 p-2.5 shadow-sm">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground opacity-60">Coverage</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{insights.summary.total} TC</p>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-card/60 p-2.5 shadow-sm">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground opacity-60">Negative</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{insights.summary.negative} ({Math.round(insights.summary.negativeRatio * 100)}%)</p>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-card/60 p-2.5 shadow-sm">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground opacity-60">Open High</p>
                        <p className="text-sm font-semibold text-rose-500 mt-0.5">{insights.summary.highPriorityOpen}</p>
                      </div>
                      <div className="rounded-xl border border-border/50 bg-card/60 p-2.5 shadow-sm">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground opacity-60">Weak Steps</p>
                        <p className="text-sm font-semibold text-amber-500 mt-0.5">{insights.summary.weakSteps}</p>
                      </div>
                    </div>
                    {insights.gapAreas.length > 0 && (
                      <div className="space-y-2">
                        {insights.gapAreas.slice(0, 3).map((area) => (
                          <button
                            key={`${area.moduleName}-${area.label}`}
                            type="button"
                            onClick={() => setPrompt(`Buat missing negative cases untuk ${area.moduleName} - ${area.label}`)}
                            className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 text-left text-xs text-amber-600 transition hover:bg-amber-500/10 dark:text-amber-300"
                          >
                            <span className="flex min-w-0 items-center gap-2.5 font-bold">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              <span className="truncate">{area.moduleName} <span className="text-muted-foreground font-medium mx-1">/</span> {area.label}</span>
                            </span>
                            <span className="shrink-0 font-semibold uppercase tracking-tighter text-[10px]">{area.negative} / {area.total} Neg</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="py-6 flex flex-col items-center justify-center text-muted-foreground/40">
                    <Bot className="h-10 w-10 mb-2 opacity-20" />
                    <p className="text-[11px] font-medium">Analyzing project knowledge base...</p>
                  </div>
                )}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                {modules.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">Fokus pada Module</Label>
                    <Select value={moduleFilter} onValueChange={setModuleFilter}>
                      <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/30 text-sm font-bold text-foreground focus:ring-primary/20 transition duration-300">
                        <SelectValue placeholder="Semua Module" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl bg-card border-border/60 elevation-3">
                        <SelectItem value="all" className="rounded-lg font-medium">Semua Module</SelectItem>
                        {modules.map((module) => (
                          <SelectItem key={module.id} value={module.id} className="rounded-lg font-medium">{module.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground ml-1">Jumlah Output</Label>
                  <Select value={String(generateCount)} onValueChange={(value) => setGenerateCount(Number(value))}>
                    <SelectTrigger className="h-11 rounded-xl border-border/60 bg-secondary/30 text-sm font-bold text-foreground focus:ring-primary/20 transition duration-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl bg-card border-border/60 elevation-3">
                      <SelectItem value="3" className="rounded-lg font-medium">3 Test Case</SelectItem>
                      <SelectItem value="4" className="rounded-lg font-medium">4 Test Case</SelectItem>
                      <SelectItem value="6" className="rounded-lg font-medium">6 Test Case</SelectItem>
                      <SelectItem value="8" className="rounded-lg font-medium">8 Test Case</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex gap-4 items-start shadow-inner">
                <div className="mt-1 p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <p className="text-[11px] text-muted-foreground font-medium leading-relaxed">
                  <strong className="text-primary font-semibold uppercase tracking-tight mr-1.5">Pro Tip:</strong> AI mempelajari format dan terminologi yang Anda gunakan. Instruksi yang spesifik akan menghasilkan skenario yang lebih akurat dan siap pakai.
                </p>
              </div>
            </div>
          )}

          {aiGenerating && (
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
                <p className="font-semibold text-foreground uppercase tracking-[0.2em] text-[10px]">Generating Scenarios</p>
                <p className="text-[11px] text-muted-foreground font-medium animate-pulse">Consulting project knowledge & best practices...</p>
              </div>
            </div>
          )}

          {aiGeneratedCases.length > 0 && !aiGenerating && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Generated Result: {aiGeneratedCases.length} Scenarios</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleAISelectAll}
                  className="h-8 text-[10px] font-semibold uppercase tracking-wider text-primary hover:bg-primary/5 rounded-lg"
                >
                  {aiSelectedCases.size === aiGeneratedCases.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="space-y-3 pr-2 overflow-y-auto max-h-[480px] scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
                {aiGeneratedCases.map((testCase, index) => (
                  <motion.div
                    key={`${testCase.testCaseId}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "group cursor-pointer rounded-2xl border p-5 transition duration-300 relative overflow-hidden",
                      aiSelectedCases.has(index)
                        ? 'border-primary bg-primary/5 shadow-md shadow-primary/5'
                        : 'border-border/60 bg-secondary/20 hover:bg-secondary/30 hover:border-primary/40'
                    )}
                    onClick={() => toggleAISelect(index)}
                  >
                    <div className="absolute top-5 right-5 h-6 w-6 rounded-full border border-border/60 flex items-center justify-center bg-card transition-colors group-hover:border-primary/40">
                      {aiSelectedCases.has(index) && (
                        <div className="h-3.5 w-3.5 rounded-full bg-primary animate-in zoom-in-50 duration-200 shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 mb-4 pr-10">
                      <span className="font-mono text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">{testCase.testCaseId}</span>
                      <Badge variant="outline" className={cn("rounded-lg border-border/40 text-[9px] font-semibold uppercase tracking-tight py-0.5 shadow-sm", getTestTypeColor(testCase.testType))}>
                        {testCase.testType}
                      </Badge>
                      <Badge className={cn("rounded-lg text-[9px] font-semibold uppercase tracking-tight py-0.5 shadow-sm", getPriorityColor(testCase.priority))}>
                        {testCase.priority}
                      </Badge>
                      <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">{testCase.page} {testCase.subMenu && `› ${testCase.subMenu}`}</span>
                    </div>

                    <p className="text-[13px] font-semibold text-foreground group-hover:text-primary transition-colors leading-tight mb-3">{testCase.testAction}</p>

                    <div className="space-y-3">
                      <div className="rounded-xl bg-card/60 border border-border/40 p-3.5 shadow-inner">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground opacity-50 mb-2">Execution Steps</p>
                        <div className="text-[11px] text-foreground/80 font-medium whitespace-pre-line leading-relaxed">{testCase.steps}</div>
                      </div>
                      <div className="flex items-center gap-2 rounded-xl bg-emerald-500/5 border border-emerald-500/20 px-3.5 py-2">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 opacity-60 shrink-0">Expected Result</p>
                        <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 truncate">{testCase.expectedResult}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-5 border-t border-border/40 bg-secondary/10 shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              {aiGeneratedCases.length > 0 && !aiGenerating && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span className="text-primary font-semibold">{aiSelectedCases.size}</span> / {aiGeneratedCases.length} Selected
                </p>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                onClick={closeDialog}
                className="h-10 rounded-xl border-border/60 bg-card text-muted-foreground font-bold text-xs px-6 transition hover:bg-secondary"
              >
                Close
              </Button>

              {aiGeneratedCases.length > 0 && !aiGenerating ? (
                <>
                  <Button
                    variant="outline"
                    onClick={resetGeneratedCases}
                    className="h-10 gap-2 rounded-xl border-border/60 bg-card text-primary font-bold text-xs px-5 hover:bg-primary/5 transition"
                  >
                    <RefreshCw className="w-4 h-4" /> Rese
                  </Button>
                  <Button
                    onClick={handleAISaveSelected}
                    disabled={aiSelectedCases.size === 0 || aiSaving}
                    className="h-10 gap-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs px-7 shadow-lg hover:shadow-emerald-500/20 transition duration-300"
                  >
                    {aiSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Scenarios
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => handleAIGenerate({ prompt, moduleFilter, count: generateCount })}
                  disabled={!prompt.trim() || aiGenerating}
                  className="h-11 gap-2.5 rounded-xl bg-gradient-to-r from-primary via-indigo-600 to-cyan-600 hover:from-primary/90 hover:via-indigo-600/90 hover:to-cyan-600/90 text-white font-semibold text-xs px-8 shadow-lg hover:shadow-primary/30 transition duration-300 uppercase tracking-wider"
                >
                  {aiGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Generate Scenarios
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
