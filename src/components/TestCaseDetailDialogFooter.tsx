'use client';

import { Edit3, FileDown, Sparkles } from 'lucide-react';
import { MutationAction } from '@/components/WorkspaceAccess';
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
    <div className="qa-inspector-footer flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-6 py-3">
      <div className="mr-auto flex items-center gap-2">
        {viewTestCase && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openEvidenceReport}
            className="h-8 gap-1.5 rounded-md border-border/70 text-xs font-medium"
          >
            <FileDown className="h-3.5 w-3.5" /> Evidence Report
          </Button>
        )}
        {viewTestCase && !isBugFixDetail && onRefine && (
          <MutationAction><Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onRefine(viewTestCase)}
            className="h-8 gap-1.5 rounded-md border-border/70 text-xs font-medium"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Refine AI
          </Button></MutationAction>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          className="h-8 rounded-md text-xs font-medium"
        >
          Tutup
        </Button>
        {viewTestCase && (
          <MutationAction><Button
            type="button"
            size="sm"
            onClick={() => { onOpenChange(false); onEdit(viewTestCase); }}
            className="h-8 gap-1.5 rounded-md text-xs font-semibold shadow-none"
          >
            <Edit3 className="h-3.5 w-3.5" /> Edit Test Case
          </Button></MutationAction>
        )}
      </div>
    </div>
  );
}
