'use client';

import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';
import type { TestCase } from '@/components/TestCaseTable';
import { cn } from '@/lib/utils';

export interface LifecycleItem {
  key: string;
  label: string;
  description: string;
  date?: string | null;
}

interface TestCaseLifecycleTabProps {
  viewTestCase: TestCase;
  lifecycleItems: LifecycleItem[];
  lifecycleIndex: number;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusBadgeVariant: (status: string) => 'success' | 'failed' | 'warning' | 'info' | 'notdone' | 'inprogress' | 'blocked' | 'readyretest' | 'verifiedfixed' | 'tba' | 'outline';
  formatDateTime: (date?: string | null) => string;
}

export function TestCaseLifecycleTab({ viewTestCase, lifecycleItems, lifecycleIndex, getStatusIcon, getStatusBadgeVariant, formatDateTime }: TestCaseLifecycleTabProps) {
  return (
  <TabsContent value="lifecycle" className="space-y-6 mt-0 outline-none">
    <motion.div
      key="lifecycle"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="rounded-xl border border-border/60 bg-secondary/30 p-5">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bug Lifecycle</p>
            <h3 className="mt-1 text-lg font-bold text-foreground">{viewTestCase.testCaseId}</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Perjalanan bug dari laporan awal sampai verified fixed. Status maksimal dari halaman BugFix adalah Ready to Retest; Verified & Fixed terjadi setelah retest berhasil dari halaman Test Case.
            </p>
          </div>
          <Badge variant={getStatusBadgeVariant(viewTestCase.status)} className={cn("gap-1")}>
            {getStatusIcon(viewTestCase.status)} {viewTestCase.status}
          </Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {lifecycleItems.map((item, index) => {
            const isDone = index <= lifecycleIndex && Boolean(item.date);
            const isCurrent = index === lifecycleIndex && viewTestCase.status !== 'VERIFIED & FIXED';

            return (
              <div
                key={item.key}
                className={cn(
                  "rounded-md border p-3",
                  isDone
                    ? 'border-emerald-500/20 bg-emerald-500/10'
                    : isCurrent
                      ? 'border-cyan-500/20 bg-cyan-500/10'
                      : 'border-border/50 bg-secondary/20'
                )}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full",
                    isDone
                      ? 'bg-emerald-600 text-white'
                      : isCurrent
                        ? 'bg-cyan-600 text-white'
                        : 'bg-muted text-muted-foreground dark:bg-slate-700 dark:text-slate-400'
                  )}>
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : isCurrent ? <Clock className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  </div>
                  <p className="text-sm font-bold text-foreground">{item.label}</p>
                </div>
                <p className="min-h-[36px] text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                <p className="mt-3 text-xs font-semibold text-foreground">{formatDateTime(item.date)}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bug Source</p>
          <div className="mt-3 space-y-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Original Test Case ID</p>
              <p className="font-mono font-bold text-foreground">{viewTestCase.sourceTestCaseId || viewTestCase.id}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Actual Result</p>
              <p className="font-semibold text-red-700 dark:text-red-300">{viewTestCase.actualResult || 'Not As Expected'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status Timing</p>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Reported</p>
              <p className="font-medium text-foreground">{formatDateTime(viewTestCase.reportedAt || viewTestCase.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Updated</p>
              <p className="font-medium text-foreground">{formatDateTime(viewTestCase.updatedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ready Retest</p>
              <p className="font-medium text-foreground">{formatDateTime(viewTestCase.readyAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fixed</p>
              <p className="font-medium text-foreground">{formatDateTime(viewTestCase.fixedAt)}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  </TabsContent>

  );
}
