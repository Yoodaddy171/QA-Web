import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { RefinedTestCasePreview } from '@/components/AIRefineDialog';
import { useToast } from '@/hooks/use-toast';
import { generateAiTestCases, refineAiTestCase, type GeneratedTestCasePreview } from '@/lib/client/api/ai-client';
import { createTestCase, updateTestCase } from '@/lib/client/api/testcases-client';
import type { Module, TestCase } from '@/lib/client/api/types';
import { TESTCASE_STATUS } from '@/lib/domain/testcase';

export function useAiTestcaseFlows(input: {
  selectedProject: string;
  modules: Module[];
  loadAll: (projectId: string) => void;
  setViewTestCase: Dispatch<SetStateAction<TestCase | null>>;
}) {
  const { selectedProject, modules, loadAll, setViewTestCase } = input;
  const { toast } = useToast();
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiGeneratedCases, setAiGeneratedCases] = useState<GeneratedTestCasePreview[]>([]);
  const [aiSelectedCases, setAiSelectedCases] = useState<Set<number>>(new Set());
  const [aiSaving, setAiSaving] = useState(false);
  const [showAIRefineDialog, setShowAIRefineDialog] = useState(false);
  const [refiningTestCase, setRefiningTestCase] = useState<TestCase | null>(null);
  const [aiRefinedCase, setAiRefinedCase] = useState<RefinedTestCasePreview | null>(null);
  const [aiRefining, setAiRefining] = useState(false);
  const [aiRefineSaving, setAiRefineSaving] = useState(false);

  const openAIDialog = () => {
    setShowAIDialog(true);
    setAiGeneratedCases([]);
  };

  const handleAIGenerate = async ({ prompt, moduleFilter, count }: { prompt: string; moduleFilter: string; count: number }) => {
    if (!selectedProject || !prompt.trim()) return;
    setAiGenerating(true);
    setAiGeneratedCases([]);
    setAiSelectedCases(new Set());

    try {
      const data = await generateAiTestCases({
        projectId: selectedProject,
        userPrompt: prompt,
        moduleFilter,
        count,
      });

      if (!data.ok) {
        toast({ title: 'AI Error', description: data.data.error || 'Gagal generate test case', variant: 'destructive' });
        setAiGenerating(false);
        return;
      }

      const generated = data.data.generated || [];
      if (generated.length === 0) {
        toast({ title: 'Info', description: 'AI tidak menghasilkan test case. Coba prompt yang lebih spesifik.' });
      } else {
        setAiGeneratedCases(generated);
        setAiSelectedCases(new Set(generated.map((_: unknown, i: number) => i)));
        toast({ title: 'Berhasil', description: `AI menghasilkan ${generated.length} test case` });
      }
    } catch (err: unknown) {
      console.error('AI generate error:', err);
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast({ title: 'Timeout', description: 'AI membutuhkan waktu terlalu lama. Silakan coba lagi dengan prompt yang lebih singkat.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: 'Gagal menghubungi AI. Silakan coba lagi.', variant: 'destructive' });
      }
    }
    setAiGenerating(false);
  };

  const handleAISaveSelected = async () => {
    if (aiSelectedCases.size === 0 || !selectedProject) return;
    setAiSaving(true);

    try {
      const casesToSave = Array.from(aiSelectedCases).map(i => aiGeneratedCases[i]);
      let savedCount = 0;
      let errorCount = 0;

      for (const tc of casesToSave) {
        try {
          await createTestCase({
            ...tc,
            actualResult: null,
            status: TESTCASE_STATUS.NOT_DONE,
            progress: 0,
            remarks: '',
            projectId: selectedProject,
            moduleId: tc.moduleId && modules.some(m => m.id === tc.moduleId) ? tc.moduleId : null,
            subMenu: tc.subMenu || null,
          });
          savedCount++;
        } catch (err) {
          errorCount++;
          console.error('Error saving AI test case:', tc.testCaseId, err);
        }
      }

      if (savedCount > 0) {
        toast({
          title: 'Berhasil',
          description: `${savedCount} test case berhasil disimpan${errorCount > 0 ? ` (${errorCount} gagal)` : ''}`,
          variant: errorCount > 0 ? 'default' : undefined,
        });
        setShowAIDialog(false);
        setAiGeneratedCases([]);
        setAiSelectedCases(new Set());
        loadAll(selectedProject);
      } else {
        toast({ title: 'Error', description: 'Gagal menyimpan semua test case. Silakan coba lagi.', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Gagal menyimpan test case', variant: 'destructive' });
    }
    setAiSaving(false);
  };

  const openAIRefineDialog = (testCase: TestCase) => {
    setRefiningTestCase(testCase);
    setAiRefinedCase(null);
    setShowAIRefineDialog(true);
  };

  const handleAIRefine = async (mode: string) => {
    if (!refiningTestCase) return;

    setAiRefining(true);
    setAiRefinedCase(null);
    try {
      const data = await refineAiTestCase({ mode, testCase: refiningTestCase });
      if (!data.ok) {
        toast({ title: 'AI Error', description: data.data.error || 'Gagal refine testcase', variant: 'destructive' });
        return;
      }

      setAiRefinedCase(data.data.refined);
      toast({ title: 'Preview Siap', description: 'AI refinement sudah dibuat. Review dulu sebelum apply.' });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast({ title: 'Timeout', description: 'AI membutuhkan waktu terlalu lama. Coba mode refinement lain.', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: 'Gagal menghubungi AI refinement.', variant: 'destructive' });
      }
    } finally {
      setAiRefining(false);
    }
  };

  const handleApplyAIRefinement = async () => {
    if (!refiningTestCase || !aiRefinedCase) return;

    setAiRefineSaving(true);
    try {
      const data = await updateTestCase({
        id: refiningTestCase.id,
        testAction: aiRefinedCase.testAction,
        steps: aiRefinedCase.steps,
        expectedResult: aiRefinedCase.expectedResult,
        remarks: aiRefinedCase.remarks,
        priority: aiRefinedCase.priority,
        testType: aiRefinedCase.testType,
      });

      setViewTestCase(prev => prev?.id === data.id ? { ...prev, ...data } : prev);
      setShowAIRefineDialog(false);
      setAiRefinedCase(null);
      setRefiningTestCase(null);
      loadAll(selectedProject);
      toast({ title: 'Berhasil', description: 'AI refinement berhasil diterapkan ke testcase.' });
    } catch (error: any) {
      toast({ title: 'Gagal Apply', description: error.message || 'Refinement tidak tersimpan', variant: 'destructive' });
    } finally {
      setAiRefineSaving(false);
    }
  };

  const toggleAISelectAll = () => {
    if (aiSelectedCases.size === aiGeneratedCases.length) {
      setAiSelectedCases(new Set());
    } else {
      setAiSelectedCases(new Set(aiGeneratedCases.map((_, i) => i)));
    }
  };

  const toggleAISelect = (idx: number) => {
    const next = new Set(aiSelectedCases);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setAiSelectedCases(next);
  };

  return {
    showAIDialog,
    setShowAIDialog,
    aiGenerating,
    aiGeneratedCases,
    setAiGeneratedCases,
    aiSelectedCases,
    setAiSelectedCases,
    aiSaving,
    showAIRefineDialog,
    setShowAIRefineDialog,
    refiningTestCase,
    setRefiningTestCase,
    aiRefinedCase,
    setAiRefinedCase,
    aiRefining,
    aiRefineSaving,
    openAIDialog,
    openAIRefineDialog,
    handleAIGenerate,
    handleAISaveSelected,
    handleAIRefine,
    handleApplyAIRefinement,
    toggleAISelectAll,
    toggleAISelect,
  };
}
