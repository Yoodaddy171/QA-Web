'use client';

import { AlignJustify, Rows3 } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { TableDensity } from '@/hooks/use-table-density';

export function DataTableDensityToggle({ value, onValueChange }: { value: TableDensity; onValueChange: (value: TableDensity) => void }) {
  return (
    <ToggleGroup type="single" value={value} onValueChange={next => next && onValueChange(next as TableDensity)} aria-label="Kepadatan tabel" className="rounded-lg border border-border/70 bg-card p-0.5">
      <ToggleGroupItem value="comfortable" aria-label="Tabel nyaman" title="Comfortable" className="size-7 p-0"><Rows3 /></ToggleGroupItem>
      <ToggleGroupItem value="compact" aria-label="Tabel ringkas" title="Compact" className="size-7 p-0"><AlignJustify /></ToggleGroupItem>
    </ToggleGroup>
  );
}
