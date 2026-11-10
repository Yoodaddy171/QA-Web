'use client';

import { ChevronLeft, ChevronRight, Copy } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { TestCase } from '@/components/TestCaseTable';
import { cn } from '@/lib/utils';
import { detailTestCaseId } from '@/lib/client/testcase-detail-identity';

interface TestCaseDetailDialogHeaderProps {
  viewTestCase: TestCase | null;
  testCaseList?: TestCase[];
  navigationIndex: number;
  onNavigate?: (testCase: TestCase) => void;
  onCopyId: (id: string) => void;
  getStatusIcon: (status: string) => ReactNode;
  getStatusBadgeVariant: (status: string) => 'success' | 'failed' | 'warning' | 'info' | 'notdone' | 'inprogress' | 'blocked' | 'readyretest' | 'verifiedfixed' | 'tba' | 'outline';
}

export function TestCaseDetailDialogHeader({
  viewTestCase,
  testCaseList,
  navigationIndex,
  onNavigate,
  onCopyId,
  getStatusBadgeVariant,
  getStatusIcon,
}: TestCaseDetailDialogHeaderProps) {
  const testCaseId = detailTestCaseId(viewTestCase);
  return (
    <DialogHeader className="shrink-0 border-b border-border bg-card p-4 pb-3 pr-12 text-left sm:px-6 sm:py-3 sm:pr-12">
      <DialogTitle className="sr-only">Detail Test Case</DialogTitle>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {viewTestCase && (
            <span className="font-mono text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
              {viewTestCase.testCaseId}
            </span>
          )}
          {viewTestCase && (
            <Badge variant={getStatusBadgeVariant(viewTestCase.status)} className="gap-1">
              {getStatusIcon(viewTestCase.status)} {viewTestCase.status}
            </Badge>
          )}
          <span className="text-xs font-medium text-muted-foreground hidden sm:inline" aria-hidden="true">Detail Test Case</span>
        </div>
        {testCaseList && testCaseList.length > 1 && navigationIndex >= 0 && onNavigate && viewTestCase && (
          <div className="inline-flex items-center gap-0.5 rounded-md border border-border bg-secondary/40 p-0.5">
            <SimpleTooltip content="Testcase sebelumnya ([)">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 rounded text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                disabled={navigationIndex <= 0}
                onClick={() => navigationIndex > 0 && onNavigate(testCaseList[navigationIndex - 1])}
                aria-label="Previous test case"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <Kbd size="sm" className="hidden sm:inline-flex text-[10px] px-1 py-0 h-4 font-mono font-medium">[</Kbd>
              </Button>
            </SimpleTooltip>
            <span className="min-w-[36px] text-center font-mono text-[11px] font-medium text-muted-foreground tabular-nums">
              {navigationIndex + 1}/{testCaseList.length}
            </span>
            <SimpleTooltip content="Testcase berikutnya (])">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 rounded text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                disabled={navigationIndex >= testCaseList.length - 1}
                onClick={() => navigationIndex < testCaseList.length - 1 && onNavigate(testCaseList[navigationIndex + 1])}
                aria-label="Next test case"
              >
                <Kbd size="sm" className="hidden sm:inline-flex text-[10px] px-1 py-0 h-4 font-mono font-medium">]</Kbd>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </SimpleTooltip>
          </div>
        )}
      </div>
      {viewTestCase && (
        <div className="mt-1 flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <div className="truncate text-xs font-medium text-foreground/80">
            <span>{viewTestCase.module?.name || 'No Module'}</span>
            <span className="mx-1 text-muted-foreground/40">/</span>
            <span>{viewTestCase.page}</span>
            {viewTestCase.subMenu && (
              <>
                <span className="mx-1 text-muted-foreground/40">/</span>
                <span className="text-muted-foreground">{viewTestCase.subMenu}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className="uppercase tracking-wider font-semibold">UUID</span>
            <code className="max-w-[min(180px,36vw)] truncate font-mono text-muted-foreground" title={testCaseId}>{testCaseId}</code>
            <Button type="button" variant="ghost" size="icon" onClick={() => onCopyId(testCaseId)} className="size-6 text-muted-foreground hover:text-foreground" aria-label="Copy testcase UUID">
              <Copy className="size-3" />
            </Button>
          </div>
        </div>
      )}
      <DialogDescription className="sr-only">
        Detail test case dan DevLog untuk hasil eksekusi automation maupun manual capture.
      </DialogDescription>
    </DialogHeader>
  );
}
