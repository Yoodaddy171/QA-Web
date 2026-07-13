'use client';

import { Edit3, FileDown, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TestCase } from '@/components/TestCaseTable';

interface TestCaseDetailDialogFooterProps {
  viewTestCase: TestCase | null;
  isBugFixDetail: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (testCase: TestCase) => void;
  onRefine?: (testCase: TestCase) => void;
  openEvidenceReport: () => void;
}

export function TestCaseDetailDialogFooter({
  viewTestCase,
  isBugFixDetail,
  onOpenChange,
  onEdit,
  onRefine,
  openEvidenceReport,
}: TestCaseDetailDialogFooterProps) {
  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t p-6 pt-4">
      <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10 border-border/60 px-6 font-bold">
        Tutup
      </Button>
      {viewTestCase && !isBugFixDetail && onRefine && (
        <Button
          variant="outline"
          onClick={() => onRefine(viewTestCase)}
          className="h-10 gap-2 border-violet-200 px-6 font-bold text-violet-700 hover:bg-violet-50 dark:border-violet-500/30 dark:text-violet-300 dark:hover:bg-violet-500/10"
        >
          <Sparkles className="h-4 w-4" /> Refine AI
        </Button>
      )}
      {viewTestCase && (
        <Button
          variant="outline"
          onClick={openEvidenceReport}
          className="h-10 gap-2 border-sky-200 px-6 font-bold text-sky-700 hover:bg-sky-50 dark:border-sky-500/30 dark:text-sky-300 dark:hover:bg-sky-500/10"
        >
          <FileDown className="h-4 w-4" /> Evidence Report
        </Button>
      )}
      {viewTestCase && (
        <Button
          onClick={() => { onOpenChange(false); onEdit(viewTestCase); }}
          className="h-10 gap-2 bg-indigo-600 px-6 font-bold text-white shadow-indigo-500/20 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          <Edit3 className="h-4 w-4" /> Edit Test Case
        </Button>
      )}
    </div>
  );
}
