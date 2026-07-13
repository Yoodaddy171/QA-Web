'use client';

import { ClipboardList, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { TestCase } from '@/components/TestCaseTable';
import { cn } from '@/lib/utils';

interface TestCaseDetailDialogHeaderProps {
  viewTestCase: TestCase | null;
  testCaseList?: TestCase[];
  navigationIndex: number;
  onNavigate?: (testCase: TestCase) => void;
  getStatusIcon: (status: string) => ReactNode;
  getStatusBadgeVariant: (status: string) => 'success' | 'failed' | 'warning' | 'info' | 'notdone' | 'inprogress' | 'blocked' | 'readyretest' | 'verifiedfixed' | 'tba' | 'outline';
}

export function TestCaseDetailDialogHeader({
  viewTestCase,
  testCaseList,
  navigationIndex,
  onNavigate,
  getStatusBadgeVariant,
  getStatusIcon,
}: TestCaseDetailDialogHeaderProps) {
  return (
    <DialogHeader className="shrink-0 border-b border-border/30 p-4 pb-2 sm:p-6 sm:pb-2">
      <div className="flex items-center justify-between gap-2">
        <DialogTitle className="flex min-w-0 flex-wrap items-center gap-2 text-base font-bold tracking-tight sm:text-xl">
          <ClipboardList className="h-5 w-5 shrink-0 text-primary" />
          <span className="whitespace-nowrap text-foreground">Detail Test Case</span>
          {viewTestCase && (
            <Badge variant={getStatusBadgeVariant(viewTestCase.status)} className={cn('gap-1 sm:ml-2')}>
              {getStatusIcon(viewTestCase.status)} {viewTestCase.status}
            </Badge>
          )}
        </DialogTitle>
        {testCaseList && testCaseList.length > 1 && navigationIndex >= 0 && onNavigate && viewTestCase && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-xl p-0 text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
              disabled={navigationIndex <= 0}
              onClick={() => navigationIndex > 0 && onNavigate(testCaseList[navigationIndex - 1])}
              aria-label="Previous test case"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[40px] text-center text-[11px] font-medium text-muted-foreground">
              {navigationIndex + 1}/{testCaseList.length}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 rounded-xl p-0 text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
              disabled={navigationIndex >= testCaseList.length - 1}
              onClick={() => navigationIndex < testCaseList.length - 1 && onNavigate(testCaseList[navigationIndex + 1])}
              aria-label="Next test case"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <DialogDescription className="sr-only">
        Detail test case dan DevLog untuk hasil eksekusi automation maupun manual capture.
      </DialogDescription>
    </DialogHeader>
  );
}
