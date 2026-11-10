'use client';

import { ChevronDown, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  DEFAULT_DEVTOOLS_CONSOLE_LEVELS,
  DEVTOOLS_CONSOLE_LEVELS,
  type DevtoolsConsoleLevel,
} from '@/lib/client/automation/devtools-console';

type DevtoolsConsoleFiltersProps = {
  query: string;
  onQueryChange: (value: string) => void;
  levels: readonly DevtoolsConsoleLevel[];
  onLevelsChange: (levels: DevtoolsConsoleLevel[]) => void;
  hiddenCount?: number;
};

export function DevtoolsConsoleFilters({
  query, onQueryChange, levels, onLevelsChange, hiddenCount = 0,
}: DevtoolsConsoleFiltersProps) {
  const visibleLevels = DEVTOOLS_CONSOLE_LEVELS.filter(({ value }) => levels.includes(value));
  let levelLabel = 'Custom levels';
  if (visibleLevels.length === DEVTOOLS_CONSOLE_LEVELS.length) levelLabel = 'All levels';
  else if (visibleLevels.length === DEFAULT_DEVTOOLS_CONSOLE_LEVELS.length && !levels.includes('verbose')) levelLabel = 'Default levels';
  else if (visibleLevels.length === 1) levelLabel = `${visibleLevels[0].label} only`;
  else if (!visibleLevels.length) levelLabel = 'Hide all';

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-sky-50/60 px-3 py-2 font-sans dark:bg-sky-950/30">
      <div className="relative min-w-28 flex-1">
        <Filter aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-sky-800 dark:text-sky-200" />
        <Input
          aria-label="Filter"
          placeholder="Filter"
          title="Filter messages by text, /regular expression/, or url:script"
          value={query}
          data-devlog-filter={query ? '' : undefined}
          onChange={event => onQueryChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Escape' && query) {
              event.preventDefault();
              event.stopPropagation();
              onQueryChange('');
            }
          }}
          className="h-9 bg-background pl-8 pr-9 text-xs"
        />
        {query && <Button type="button" variant="ghost" size="icon" aria-label="Clear filter" className="absolute right-0 top-0 size-9" onClick={() => onQueryChange('')}><X aria-hidden="true" /></Button>}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 px-2 text-xs" aria-label={`Log level: ${levelLabel}`}>
            {levelLabel}<ChevronDown aria-hidden="true" className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="z-[140]">
          <DropdownMenuItem onSelect={() => onLevelsChange([...DEFAULT_DEVTOOLS_CONSOLE_LEVELS])}>Default</DropdownMenuItem>
          <DropdownMenuSeparator />
          {DEVTOOLS_CONSOLE_LEVELS.map(({ value, label }) => (
            <DropdownMenuCheckboxItem
              key={value}
              checked={levels.includes(value)}
              onCheckedChange={checked => onLevelsChange(checked ? [...levels, value] : levels.filter(level => level !== value))}
            >
              {label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <span role="status" className="whitespace-nowrap text-xs font-medium tabular-nums text-sky-900 dark:text-sky-200">{hiddenCount > 0 ? `${hiddenCount} hidden` : ''}</span>
    </div>
  );
}
