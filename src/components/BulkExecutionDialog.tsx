'use client';

import { PlayCircle, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type TestRunOption = { id: string; name: string; status: string };

interface BulkExecutionDialogProps {
  open: boolean;
  selectedCount: number;
  testRuns: TestRunOption[];
  testRunId: string;
  status: string;
  tester: string;
  onOpenChange: (open: boolean) => void;
  onTestRunChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onTesterChange: (value: string) => void;
  onSubmit: () => void;
}

const EXECUTION_STATUS_OPTIONS: Array<{ value: string; label: string; color: string }> = [
  { value: 'PASSED', label: 'Passed', color: 'bg-emerald-500' },
  { value: 'FAILED', label: 'Failed', color: 'bg-rose-500' },
  { value: 'BLOCKED', label: 'Blocked', color: 'bg-amber-500' },
  { value: 'RETEST', label: 'Retest', color: 'bg-purple-500' },
];

export function BulkExecutionDialog({
  open,
  selectedCount,
  testRuns,
  testRunId,
  status,
  tester,
  onOpenChange,
  onTestRunChange,
  onStatusChange,
  onTesterChange,
  onSubmit,
}: BulkExecutionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card text-foreground shadow-xl rounded-2xl sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="border-b border-border/40 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <PlayCircle className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
                  Eksekusi Massal
                </DialogTitle>
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/20 bg-primary/5">
                  {selectedCount} item
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Catat status eksekusi untuk test case terpilih ke dalam Test Run.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Target Test Run</Label>
            <Select value={testRunId} onValueChange={onTestRunChange}>
              <SelectTrigger className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm font-medium text-foreground focus:ring-primary/20">
                <SelectValue placeholder="Pilih Test Run" />
              </SelectTrigger>
              <SelectContent className="border-border/60 bg-card rounded-xl shadow-lg">
                {testRuns.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    Tidak ada Test Run yang aktif
                  </div>
                ) : (
                  testRuns.map((run) => (
                    <SelectItem key={run.id} value={run.id} className="rounded-lg text-xs font-medium cursor-pointer">
                      <div className="flex items-center justify-between gap-2">
                        <span>{run.name}</span>
                        <span className="text-[10px] text-muted-foreground uppercase">{run.status}</span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Status Hasil Eksekusi</Label>
            <Select value={status} onValueChange={onStatusChange}>
              <SelectTrigger className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm font-medium text-foreground focus:ring-primary/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-border/60 bg-card rounded-xl shadow-lg">
                {EXECUTION_STATUS_OPTIONS.map((item) => (
                  <SelectItem key={item.value} value={item.value} className="rounded-lg text-xs font-medium cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${item.color}`} />
                      <span>{item.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Nama Tester (Opsional)</Label>
            <Input
              value={tester}
              onChange={(e) => onTesterChange(e.target.value)}
              placeholder="Kosongkan jika sesuai akun saat ini"
              className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm font-medium text-foreground placeholder:text-muted-foreground/50 focus-visible:ring-primary/20"
            />
          </div>
        </div>

        <DialogFooter className="border-t border-border/40 px-6 py-4 bg-secondary/10 flex items-center justify-end gap-2.5">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 rounded-xl border-border/60 bg-card text-muted-foreground font-medium text-xs px-4 hover:bg-secondary"
          >
            Batal
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!testRunId}
            className="h-9 gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs px-5 shadow-sm"
          >
            <CheckCircle className="h-3.5 w-3.5" />
            Eksekusi ({selectedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
