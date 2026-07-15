'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type TestRunOption = { id: string; name: string; status: string };

export function BulkAssignDialog({ open, selectedCount, testRuns, testRunId, assignee, onOpenChange, onTestRunChange, onAssigneeChange, onSubmit }: { open: boolean; selectedCount: number; testRuns: TestRunOption[]; testRunId: string; assignee: string; onOpenChange: (open: boolean) => void; onTestRunChange: (value: string) => void; onAssigneeChange: (value: string) => void; onSubmit: () => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="rounded-2xl border-border bg-card text-foreground sm:max-w-md"><DialogHeader><DialogTitle>Bulk Assign</DialogTitle><DialogDescription>Assign {selectedCount} testcase ke tester dalam Test Run.</DialogDescription></DialogHeader><div className="space-y-4"><div className="space-y-2"><Label>Test Run</Label><Select value={testRunId} onValueChange={onTestRunChange}><SelectTrigger><SelectValue placeholder="Pilih Test Run" /></SelectTrigger><SelectContent>{testRuns.map(run => <SelectItem key={run.id} value={run.id}>{run.name} · {run.status}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Tester / assignee</Label><Input value={assignee} onChange={event => onAssigneeChange(event.target.value)} placeholder="Nama tester" /></div></div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button><Button onClick={onSubmit} disabled={!testRunId || !assignee.trim()}>Assign {selectedCount}</Button></DialogFooter></DialogContent></Dialog>;
}
