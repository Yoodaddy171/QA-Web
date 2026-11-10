'use client';

import { ChevronDown, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { TabsContent } from '@/components/ui/tabs';
import { BulletTextView } from '@/components/TestCaseDetailDialog.helpers';
import type { TestCase } from '@/components/TestCaseTable';
import { cn } from '@/lib/utils';
import { detailTestCaseId, isBugDetail } from '@/lib/client/testcase-detail-identity';
import { TestCaseSourceNotes } from '@/components/TestCaseSourceNotes';

interface TestCaseDetailsTabProps {
  viewTestCase: TestCase;
  onCopyId: (id: string) => void;
  getTestTypeColor: (type: string) => string;
  getPriorityColor: (priority: string) => string;
}

export function TestCaseDetailsTab({ viewTestCase, onCopyId, getTestTypeColor, getPriorityColor }: TestCaseDetailsTabProps) {
  const testCaseId = detailTestCaseId(viewTestCase);
  return (
    <TabsContent value="details" className="mt-0 flex flex-col gap-6 outline-none">
      <section className="flex flex-col gap-3" aria-label="Test action">
        <h3 className="max-w-prose break-words text-lg font-semibold leading-7 text-foreground sm:text-xl">{viewTestCase.testAction || 'Test action belum diisi'}</h3>
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-secondary/20 p-3 sm:grid-cols-4 text-xs">
          <div>
            <span className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Module</span>
            <span className="mt-0.5 block truncate font-medium text-foreground" title={viewTestCase.module?.name || 'Tanpa Module'}>
              {viewTestCase.module?.name || 'Tanpa Module'}
            </span>
          </div>
          <div>
            <span className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Page / Sub Menu</span>
            <span className="mt-0.5 block truncate font-medium text-foreground" title={`${viewTestCase.page || '-'}${viewTestCase.subMenu ? ` / ${viewTestCase.subMenu}` : ''}`}>
              {viewTestCase.page || '-'}{viewTestCase.subMenu ? ` / ${viewTestCase.subMenu}` : ''}
            </span>
          </div>
          <div>
            <span className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tipe Test</span>
            <span className="mt-0.5 inline-flex items-center rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground">
              {viewTestCase.testType}
            </span>
          </div>
          <div>
            <span className="block text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Prioritas</span>
            <span className="mt-0.5 inline-flex items-center gap-1.5 font-medium text-foreground">
              <span className={cn(
                "size-2 rounded-full",
                viewTestCase.priority === 'Critical' && "bg-status-failed",
                viewTestCase.priority === 'High' && "bg-bug-open",
                viewTestCase.priority === 'Medium' && "bg-status-in-progress",
                viewTestCase.priority === 'Low' && "bg-status-not-run"
              )} />
              {viewTestCase.priority}
            </span>
          </div>
        </div>
      </section>

      <Separator />
      <div className="grid gap-6 md:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-3" aria-labelledby="overview-test-steps">
          <h3 id="overview-test-steps" className="text-sm font-semibold">Test steps</h3>
          <BulletTextView value={viewTestCase.steps || '-'} className="break-words whitespace-pre-wrap text-base leading-7 text-foreground sm:text-sm" />
        </section>
        <section className="flex min-w-0 flex-col gap-3" aria-labelledby="overview-expected-result">
          <h3 id="overview-expected-result" className="text-sm font-semibold">Expected result</h3>
          <BulletTextView value={viewTestCase.expectedResult || '-'} className="break-words whitespace-pre-wrap text-base leading-7 text-foreground sm:text-sm" />
        </section>
      </div>

      <section className="flex flex-col gap-3 border-t border-border pt-5" aria-label="Hasil dan catatan inventory">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold">Actual result</h3>
          <Badge variant={viewTestCase.actualResult === 'As Expected' ? 'success' : viewTestCase.actualResult === 'Not As Expected' ? 'failed' : 'outline'}>{viewTestCase.actualResult || 'Belum diuji'}</Badge>
        </div>
        <div className="flex flex-col gap-1">
          <h4 className="text-sm font-medium text-muted-foreground">{isBugDetail(viewTestCase) ? 'Catatan testcase asal' : 'Catatan'}</h4>
          {isBugDetail(viewTestCase)
            ? <TestCaseSourceNotes key={`${viewTestCase.projectId}:${testCaseId}`} projectId={viewTestCase.projectId} testCaseId={testCaseId} />
            : <p className="break-words whitespace-pre-wrap text-base leading-7 sm:text-sm">{viewTestCase.remarks?.trim() || 'Belum ada catatan.'}</p>}
        </div>
      </section>

      <details className="group border-t border-border pt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
          Metadata testcase
          <ChevronDown className="size-4 group-open:rotate-180" aria-hidden="true" />
        </summary>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 py-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Display ID</dt><dd className="mt-1 break-words font-mono font-medium">{viewTestCase.testCaseId}</dd></div>
          <div><dt className="text-muted-foreground">Sub Menu</dt><dd className="mt-1 break-words">{viewTestCase.subMenu || '-'}</dd></div>
          <div><dt className="text-muted-foreground">Bobot transaksi</dt><dd className="mt-1 tabular-nums">{viewTestCase.calculatedWeight != null ? `${viewTestCase.calculatedWeight.toFixed(2)}%` : (viewTestCase.weight || '-')}</dd></div>
          <div><dt className="text-muted-foreground">Progress inventory</dt><dd className="mt-1 tabular-nums">{viewTestCase.progress}%</dd></div>
          <div><dt className="text-muted-foreground">Terakhir diperbarui</dt><dd className="mt-1">{new Date(viewTestCase.updatedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</dd></div>
          <div className="min-w-0"><dt className="text-muted-foreground">UUID untuk automation</dt><dd className="mt-1 flex min-w-0 items-center gap-2"><code className="min-w-0 flex-1 break-all text-xs">{testCaseId}</code><Button variant="ghost" size="icon" className="size-11 sm:size-9" onClick={() => onCopyId(testCaseId)} aria-label="Salin UUID testcase"><Copy /></Button></dd></div>
        </dl>
      </details>
    </TabsContent>
  );
}
