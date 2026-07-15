'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type TestRunOption = { id: string; name: string; status: string };

export function BulkExecutionDialog({ open, selectedCount, testRuns, testRunId, status, tester, onOpenChange, onTestRunChange, onStatusChange, onTesterChange, onSubmit }: { open: boolean; selectedCount: number; testRuns: TestRunOption[]; testRunId: string; status: string; tester: string; onOpenChange: (open: boolean) => void; onTestRunChange: (value: string) => void; onStatusChange: (value: string) => void; onTesterChange: (value: string) => void; onSubmit: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="rounded-2xl border-border bg-card text-foreground sm:max-w-md"><DialogHeader><DialogTitle>Bulk Execute</DialogTitle><DialogDescription>Jalankan {selectedCount} testcase ke Test Run yang dipilih.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Test Run</Label><Select value={testRunId} onValueChange={onTestRunChange}><SelectTrigger><SelectValue placeholder="Pilih Test Run" /></SelectTrigger><SelectContent>{testRuns.map(run => <SelectItem key={run.id} value={run.id}>{run.name} · {run.status}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Status execution</Label><Select value={status} onValueChange={onStatusChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PASSED">Passed</SelectItem><SelectItem value="FAILED">Failed</SelectItem><SelectItem value="BLOCKED">Blocked</SelectItem><SelectItem value="RETEST">Retest</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Tester</Label><Input value={tester} onChange={event => onTesterChange(event.target.value)} placeholder="Nama tester (opsional)" /></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button><Button onClick={onSubmit} disabled={!testRunId}>Execute {selectedCount}</Button></DialogFooter></DialogContent></Dialog>;
}
