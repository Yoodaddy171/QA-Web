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
    <div className="qa-inspector-footer flex shrink-0 flex-wrap justify-end gap-2 border-t border-border bg-card p-4 sm:px-6">
      <Button variant="outline" onClick={() => onOpenChange(false)}>
        Tutup
      </Button>
      {viewTestCase && !isBugFixDetail && onRefine && (
        <MutationAction><Button
          variant="outline"
          onClick={() => onRefine(viewTestCase)}
        >
          <Sparkles className="h-4 w-4" /> Refine AI
        </Button></MutationAction>
      )}
      {viewTestCase && (
        <Button
          variant="outline"
          onClick={openEvidenceReport}
        >
          <FileDown className="h-4 w-4" /> Evidence Report
        </Button>
      )}
      {viewTestCase && (
        <MutationAction><Button
          onClick={() => { onOpenChange(false); onEdit(viewTestCase); }}
        >
          <Edit3 className="h-4 w-4" /> Edit Test Case
        </Button></MutationAction>
      )}
    </div>
  );
}
