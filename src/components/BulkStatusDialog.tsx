'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface BulkStatusDialogProps {
  open: boolean;
  selectedCount: number;
  bulkStatus: string;
  onOpenChange: (value: boolean) => void;
  setBulkStatus: (value: string) => void;
  onSubmit: () => void;
}

export function BulkStatusDialog({
  open,
  selectedCount,
  bulkStatus,
  onOpenChange,
  setBulkStatus,
  onSubmit,
}: BulkStatusDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card text-foreground elevation-3 rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Update Status Massal</DialogTitle>
          <DialogDescription className="text-muted-foreground">Ubah status {selectedCount} test case yang dipilih.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status Baru</Label>
            <Select value={bulkStatus} onValueChange={setBulkStatus}>
              <SelectTrigger className="border-border/60 bg-secondary/50 text-foreground focus:ring-primary/30 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent className="border-border/60 bg-card rounded-xl elevation-3">
                <SelectItem value="DONE" className="rounded-lg">Done</SelectItem>
                <SelectItem value="NOT DONE" className="rounded-lg">Not Done</SelectItem>
                <SelectItem value="IN PROGRESS" className="rounded-lg">In Progress</SelectItem>
                <SelectItem value="BLOCKED" className="rounded-lg">Blocked</SelectItem>
                <SelectItem value="FAILED" className="rounded-lg">Failed</SelectItem>
                <SelectItem value="READY TO RETEST" className="rounded-lg">Ready to Retest</SelectItem>
                <SelectItem value="TBA" className="rounded-lg">TBA (To Be Announced)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="border-t border-border/50 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">Batal</Button>
          <Button onClick={onSubmit} variant="majestic" className="rounded-xl">Update Status</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
