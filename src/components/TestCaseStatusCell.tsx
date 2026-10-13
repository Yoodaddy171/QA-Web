'use client';

import { memo, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { SELECT_TRIGGER_CLASSES, Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const STATUSES = ['DONE', 'NOT DONE', 'IN PROGRESS', 'BLOCKED', 'FAILED', 'READY TO RETEST', 'TBA'];
type Props = {
  id: string;
  displayId: string;
  status: string;
  onChange: (id: string, status: string) => void;
  celebrate: (id: string) => void;
  color: (status: string) => string;
  icon: (status: string) => ReactNode;
};

// Closed cells are read-only presentation until activated. Radix Select mounts
// its collection/effects only for a cell the tester actually uses. Keep that
// activated trigger mounted afterwards so Radix can restore keyboard focus.
export const TestCaseStatusCell = memo(function TestCaseStatusCell({ id, displayId, status, onChange, celebrate, color, icon }: Props) {
  const [activated, setActivated] = useState(false);
  const [open, setOpen] = useState(false);
  const label = `Status for ${displayId}`;
  const optionsId = `status-options-${id}`;
  const triggerClass = cn('h-8 w-[178px] rounded-lg text-xs font-bold shadow-none gap-1 px-2', color(status));
  const activate = () => { setActivated(true); setOpen(true); };
  if (!activated) return (
    <button type="button" role="combobox" data-slot="select-trigger" data-size="default" data-state="closed" aria-label={label} aria-controls={optionsId} aria-expanded={false} aria-haspopup="listbox" className={cn(SELECT_TRIGGER_CLASSES, triggerClass)} onClick={activate} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); activate(); }
    }}>
      <span className="flex min-w-0 items-center gap-1">{icon(status)} {status}</span>
      <ChevronDown className="size-4 opacity-50" />
    </button>
  );
  return (
    <Select open={open} onOpenChange={setOpen} value={status} onValueChange={value => {
      if (value === 'DONE' && status !== 'DONE') celebrate(id);
      onChange(id, value);
    }}>
      <SelectTrigger aria-label={label} aria-controls={optionsId} className={triggerClass}>{icon(status)} <SelectValue /></SelectTrigger>
      <SelectContent id={optionsId} className="rounded-xl bg-card border-border/60 elevation-3">
        <SelectGroup>{STATUSES.map(value => <SelectItem key={value} value={value} className="text-xs font-bold rounded-lg">{value}</SelectItem>)}</SelectGroup>
      </SelectContent>
    </Select>
  );
});
