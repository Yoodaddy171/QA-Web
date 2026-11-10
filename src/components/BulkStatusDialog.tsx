'use client';

import { useState } from 'react';
import { CheckCircle2, Layers } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BulkStatusDialogProps {
  open: boolean;
  selectedCount: number;
  bulkStatus: string;
  modules?: Array<{ id: string; name: string }>;
  onOpenChange: (value: boolean) => void;
  setBulkStatus: (value: string) => void;
  onSubmit: (extra?: { priority?: string; moduleId?: string }) => void;
}

const STATUS_OPTIONS: Array<{ value: string; label: string; color: string }> = [
  { value: '__keep__', label: 'Jangan Ubah Status', color: 'bg-muted-foreground/40' },
  { value: 'DONE', label: 'Done', color: 'bg-emerald-500' },
  { value: 'NOT DONE', label: 'Not Done', color: 'bg-zinc-400' },
  { value: 'IN PROGRESS', label: 'In Progress', color: 'bg-blue-500' },
  { value: 'BLOCKED', label: 'Blocked', color: 'bg-amber-500' },
  { value: 'FAILED', label: 'Failed', color: 'bg-rose-500' },
  { value: 'READY TO RETEST', label: 'Ready to Retest', color: 'bg-purple-500' },
  { value: 'TBA', label: 'TBA (To Be Announced)', color: 'bg-slate-400' },
];

const PRIORITY_OPTIONS = [
  { value: '__keep__', label: 'Jangan Ubah Prioritas' },
  { value: 'Critical', label: 'Critical' },
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

export function BulkStatusDialog({
  open,
  selectedCount,
  bulkStatus,
  modules = [],
  onOpenChange,
  setBulkStatus,
  onSubmit,
}: BulkStatusDialogProps) {
  const [bulkPriority, setBulkPriority] = useState('__keep__');
  const [bulkModuleId, setBulkModuleId] = useState('__keep__');

  const canSubmit =
    (bulkStatus && bulkStatus !== '__keep__') ||
    bulkPriority !== '__keep__' ||
    bulkModuleId !== '__keep__';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-border bg-card text-foreground shadow-xl rounded-2xl sm:max-w-md p-0 overflow-hidden">
        <DialogHeader className="border-b border-border/40 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold text-foreground tracking-tight">
                  Update Massal Test Case
                </DialogTitle>
                <Badge variant="outline" className="text-[10px] font-semibold text-primary border-primary/20 bg-primary/5">
                  {selectedCount} item
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Ubah status, prioritas, atau module untuk semua test case yang dipilih sekaligus.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Status Baru</Label>
            <Select value={bulkStatus || '__keep__'} onValueChange={setBulkStatus}>
              <SelectTrigger className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm font-medium text-foreground focus:ring-primary/20">
                <SelectValue placeholder="Pilih status" />
              </SelectTrigger>
              <SelectContent className="border-border/60 bg-card rounded-xl shadow-lg">
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status.value} value={status.value} className="rounded-lg text-xs font-medium cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${status.color}`} />
                      <span>{status.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Prioritas Baru (Opsional)</Label>
            <Select value={bulkPriority} onValueChange={setBulkPriority}>
              <SelectTrigger className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm font-medium text-foreground focus:ring-primary/20">
                <SelectValue placeholder="Pilih prioritas" />
              </SelectTrigger>
              <SelectContent className="border-border/60 bg-card rounded-xl shadow-lg">
                {PRIORITY_OPTIONS.map((prio) => (
                  <SelectItem key={prio.value} value={prio.value} className="rounded-lg text-xs font-medium cursor-pointer">
                    {prio.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">Module Target (Opsional)</Label>
            <Select value={bulkModuleId} onValueChange={setBulkModuleId}>
              <SelectTrigger className="h-10 rounded-xl border-border/60 bg-secondary/30 text-sm font-medium text-foreground focus:ring-primary/20">
                <SelectValue placeholder="Pilih module" />
              </SelectTrigger>
              <SelectContent className="border-border/60 bg-card rounded-xl shadow-lg">
                <SelectItem value="__keep__" className="rounded-lg text-xs font-medium cursor-pointer">
                  Jangan Ubah Module
                </SelectItem>
                <SelectItem value="unassigned" className="rounded-lg text-xs font-medium cursor-pointer">
                  Tanpa Module (Unassigned)
                </SelectItem>
                {modules.map((mod) => (
                  <SelectItem key={mod.id} value={mod.id} className="rounded-lg text-xs font-medium cursor-pointer">
                    {mod.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            onClick={() =>
              onSubmit({
                priority: bulkPriority !== '__keep__' ? bulkPriority : undefined,
                moduleId: bulkModuleId !== '__keep__' ? bulkModuleId : undefined,
              })
            }
            disabled={!canSubmit}
            className="h-9 gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-xs px-5 shadow-sm"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Terapkan ({selectedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
