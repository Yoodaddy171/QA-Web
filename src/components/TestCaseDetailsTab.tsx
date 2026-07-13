'use client';

import { Copy, Layers } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { TabsContent } from '@/components/ui/tabs';
import { BulletTextView } from '@/components/TestCaseDetailDialog.helpers';
import type { TestCase } from '@/components/TestCaseTable';
import { cn } from '@/lib/utils';

interface TestCaseDetailsTabProps {
  viewTestCase: TestCase;
  onCopyId: (id: string) => void;
  getTestTypeColor: (type: string) => string;
  getPriorityColor: (priority: string) => string;
}

export function TestCaseDetailsTab({ viewTestCase, onCopyId, getTestTypeColor, getPriorityColor }: TestCaseDetailsTabProps) {
  return (
<TabsContent value="details" className="space-y-6 mt-0 outline-none">
  <motion.div
    key="details"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.2 }}
  >
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Identification</p>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Test Case ID (Display)</p>
              <p className="font-mono text-base font-bold text-foreground">{viewTestCase.testCaseId}</p>
            </div>
            <div>
              <div className="mb-1">
                <p className="text-[11px] text-muted-foreground/70" title="ID internal ini dipakai Katalon/automation untuk menautkan log ke test case.">
                  ID Internal (untuk automation log)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p className="flex-1 truncate rounded border border-border/60 bg-muted/30 px-2 py-1 font-mono text-[11px] text-muted-foreground shadow-inner">
                  {viewTestCase.id}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 border-border/60 bg-secondary/50 p-0 text-muted-foreground hover:bg-indigo-50 hover:text-indigo-700 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
                  onClick={() => onCopyId(viewTestCase.id)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Classification</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Page / Menu</p>
              <p className="font-bold text-foreground">{viewTestCase.page}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Sub Menu</p>
              <p className="text-sm font-medium">{viewTestCase.subMenu || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Tipe Test</p>
              <Badge variant="outline" className={getTestTypeColor(viewTestCase.testType)}>{viewTestCase.testType}</Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Prioritas</p>
              <Badge className={getPriorityColor(viewTestCase.priority)}>{viewTestCase.priority}</Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Project Tracking</p>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Module</p>
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="font-semibold text-foreground">{viewTestCase.module?.name || 'Tanpa Module'}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Bobot Transaksi</p>
                <Badge variant="secondary" className="border-indigo-200 bg-indigo-50 font-mono text-indigo-700 dark:border-indigo-500/20 dark:bg-indigo-500/10 dark:text-indigo-300">
                  {viewTestCase.calculatedWeight != null ? `${viewTestCase.calculatedWeight.toFixed(2)}%` : (viewTestCase.weight || '-')}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Progress</p>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={viewTestCase.progress} className="h-2 flex-1" />
                  <span className="text-xs font-bold text-foreground">{viewTestCase.progress}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Test Status</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Actual Result</p>
              <Badge className={cn(viewTestCase.actualResult === 'As Expected' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300' : viewTestCase.actualResult === 'Not As Expected' ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300' : 'border-border bg-muted text-muted-foreground dark:border-slate-500/20 dark:bg-slate-500/10 dark:text-slate-300')}>
                {viewTestCase.actualResult || 'BELUM DI-TEST'}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Terakhir Diupdate</p>
              <p className="text-[10px] font-medium text-muted-foreground">
                {new Date(viewTestCase.updatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Separator className="my-6" />

    <div className="grid grid-cols-1 gap-6">
      <div className="space-y-2">
        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Test Action</Label>
        <div className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-sm italic leading-relaxed text-muted-foreground">
          "{viewTestCase.testAction}"
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Test Steps</Label>
          <BulletTextView
            value={viewTestCase.steps}
            className="min-h-[120px] whitespace-pre-wrap rounded-xl border border-border/60 bg-secondary/30 p-4 text-sm font-medium leading-relaxed text-foreground shadow-inner"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Expected Result</Label>
          <BulletTextView
            value={viewTestCase.expectedResult}
            className="min-h-[120px] rounded-xl border border-emerald-500/15 bg-emerald-500/10 p-4 text-sm font-semibold leading-relaxed text-foreground shadow-inner"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Remarks / Catatan</Label>
        <div className="min-h-[72px] whitespace-pre-wrap rounded-xl border border-amber-500/15 bg-amber-500/10 p-4 text-sm italic text-foreground shadow-inner">
          {viewTestCase.remarks?.trim() || '-'}
        </div>
      </div>
    </div>
  </motion.div>
</TabsContent>

  );
}
