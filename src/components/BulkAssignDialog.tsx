'use client';

import { UsersRound, UserCheck } from 'lucide-react';
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

interface BulkAssignDialogProps {
  open: boolean;
  selectedCount: number;
  testRuns: TestRunOption[];
  testRunId: string;
  assignee: string;
  onOpenChange: (open: boolean) => void;
  onTestRunChange: (value: string) => void;
  onAssigneeChange: (value: string) => void;
  onSubmit: () => void;
}

export function BulkAssignDialog({
  open,
  selectedCount,
  testRuns,
  testRunId,
  assignee,
  onOpenChange,
  onTestRunChange,
  onAssigneeChange,
  onSubmit,
}: BulkAssignDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card text-foreground shadow-xl rounded-2xl sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="border-b border-border/40 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <UsersRound className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
                  Tugaskan Massal
                </DialogTitle>
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/20 bg-primary/5">
                  {selectedCount} item
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Pilih Test Run target dan tentukan nama tester yang bertugas.
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
            <Label className="text-xs font-medium text-foreground">Nama Tester / Assignee</Label>
            <Input
              value={assignee}
              onChange={(e) => onAssigneeChange(e.target.value)}
              placeholder="Contoh: Alex QA, Sarah"
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
            disabled={!testRunId || !assignee.trim()}
            className="h-9 gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs px-5 shadow-sm"
          >
            <UserCheck className="h-3.5 w-3.5" />
            Tugaskan ({selectedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
