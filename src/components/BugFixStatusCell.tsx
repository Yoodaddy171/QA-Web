'use client';

import { memo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { SELECT_TRIGGER_CLASSES, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { canTransitionBugFixStatus, EDITABLE_BUGFIX_STATUSES } from '@/lib/domain/bugfix';
import { cn } from '@/lib/utils';

const labels: Record<string, string> = {
  'SUDAH DILAPORKAN': 'DILAPORKAN',
  'SEDANG DI FIX': 'SEDANG DI FIX',
  'READY TO RETEST': 'READY TO RETEST',
};

type Props = {
  id: string;
  displayId: string;
  status: string;
  color: string;
  onChange: (id: string, status: string) => void;
};

// Retain the real trigger once activated: Radix must own dismissal and focus
// restoration. Untouched rows do not need its collection/presence effects.
export const BugFixStatusCell = memo(function BugFixStatusCell({ id, displayId, status, color, onChange }: Props) {
  const [activated, setActivated] = useState(false);
  const [open, setOpen] = useState(false);
  const label = `Status for bug ${displayId}`;
  const optionsId = `bug-status-options-${id}`;
  const triggerClass = cn('h-8 w-[178px] rounded-lg border px-2 text-xs font-semibold shadow-none', color);
  const activate = () => { setActivated(true); setOpen(true); };

  if (!activated) return (
    <button type="button" aria-label={label} aria-expanded={false} aria-haspopup="listbox"
      data-slot="select-trigger" data-size="default" data-state="closed" data-bug-status-kind="dormant"
      className={cn(SELECT_TRIGGER_CLASSES, triggerClass)} onClick={activate}
      onKeyDown={event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); activate(); }
      }}>
      <span data-slot="select-value">{labels[status] || status}</span>
      <ChevronDown className="size-4 opacity-50" />
    </button>
  );

  return (
    <Select open={open} onOpenChange={setOpen} value={status} onValueChange={value => {
      if (value !== status && canTransitionBugFixStatus(status, value)) onChange(id, value);
    }}>
      <SelectTrigger aria-label={label} aria-controls={optionsId} data-bug-status-kind="radix" className={triggerClass}><SelectValue /></SelectTrigger>
      <SelectContent id={optionsId} className="rounded-2xl bg-card border border-border/50 shadow-lg text-foreground">
        {EDITABLE_BUGFIX_STATUSES.map(value => (
          <SelectItem key={value} value={value} disabled={!canTransitionBugFixStatus(status, value)} className="text-xs font-bold rounded-lg my-0.5 mx-1">
            {labels[value]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
});
