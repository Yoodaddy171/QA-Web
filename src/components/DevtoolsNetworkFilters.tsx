'use client';

import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DEVTOOLS_NETWORK_TYPES,
  DEFAULT_DEVTOOLS_NETWORK_FILTERS,
  formatNetworkSize,
  formatNetworkTime,
  getDevtoolsNetworkDisplayType,
  getDevtoolsNetworkDisplayUrl,
  getDevtoolsNetworkInitiator,
  getDevtoolsNetworkName,
  networkRecord,
  type DevtoolsNetworkFilterState,
  type DevtoolsNetworkRequest,
  type DevtoolsNetworkType,
} from '@/lib/client/automation/devtools-network';
import { cn } from '@/lib/utils';

export function DevtoolsNetworkFilters({ filters, onChange, shownCount, totalCount }: {
  filters: DevtoolsNetworkFilterState;
  onChange: (next: DevtoolsNetworkFilterState) => void;
  shownCount?: number;
  totalCount?: number;
}) {
  const filtered = Boolean(filters.query || filters.types.length || filters.invert || filters.hideDataUrls || filters.hideExtensionUrls);
  const selectType = (type: DevtoolsNetworkType, multi: boolean) => {
    const types = multi
      ? filters.types.includes(type) ? filters.types.filter(value => value !== type) : [...filters.types, type]
      : [type];
    onChange({ ...filters, types });
  };

  return (
    <div className="space-y-2 border-b border-border bg-teal-50/60 px-3 py-2 dark:bg-teal-950/30">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="relative min-w-28 flex-1">
          <Filter className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-teal-800 dark:text-teal-200" aria-hidden="true" />
          <Input
            aria-label="Filter requests"
            title="Filter by URL, regular expression or properties such as method:POST status-code:422"
            placeholder="Filter"
            value={filters.query}
            data-devlog-filter={filters.query ? '' : undefined}
            onChange={event => onChange({ ...filters, query: event.target.value })}
            onKeyDown={event => {
              if (event.key === 'Escape' && filters.query) {
                event.preventDefault();
                event.stopPropagation();
                onChange({ ...filters, query: '' });
              }
            }}
            className="h-9 bg-background pl-8 pr-9 text-xs"
          />
          {filters.query && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Clear filter"
              onClick={() => onChange({ ...filters, query: '' })}
              className="absolute inset-y-0 right-0 size-9"
            ><X aria-hidden="true" /></Button>
          )}
        </div>
        <label className="flex min-h-8 cursor-pointer items-center gap-1.5 text-xs">
          <input type="checkbox" checked={filters.invert} onChange={event => onChange({ ...filters, invert: event.target.checked })} />
          Invert
        </label>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="outline" className="h-9 px-2 text-xs" title="Show only/hide requests">
              More filters
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="z-[120] w-auto max-w-[calc(100vw-1rem)] space-y-1 p-2">
            {([
              ['hideDataUrls', 'Hide data URLs'],
              ['hideExtensionUrls', 'Hide extension URLs'],
            ] as const).map(([key, label]) => (
              <label key={key} className="flex min-h-8 cursor-pointer items-center gap-2 px-1 text-xs">
                <input type="checkbox" checked={filters[key]} onChange={event => onChange({ ...filters, [key]: event.target.checked })} />
                {label}
              </label>
            ))}
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex flex-wrap items-center gap-0.5" role="group" aria-label="Resource type">
        {(['All', ...DEVTOOLS_NETWORK_TYPES] as const).map(type => {
          const selected = type === 'All' ? filters.types.length === 0 : filters.types.includes(type);
          return (
            <Button
              key={type}
              type="button"
              size="sm"
              variant="ghost"
              className={cn('h-8 rounded-md border border-transparent px-1.5 text-xs',
                selected
                  ? 'border-teal-300 bg-teal-100 font-semibold text-teal-900 hover:bg-teal-100 dark:border-teal-700 dark:bg-teal-950 dark:text-teal-100 dark:hover:bg-teal-950'
                  : 'text-muted-foreground hover:bg-background hover:text-foreground')}
              aria-pressed={selected}
              title={type === 'Socket' ? 'WebSocket | Web Transport | DirectSocket' : undefined}
              onClick={event => type === 'All' ? onChange({ ...filters, types: [] }) : selectType(type, event.ctrlKey || event.metaKey)}
            >{type}</Button>
          );
        })}
      </div>
      <div className="flex min-h-6 flex-wrap items-center justify-between gap-x-2 gap-y-1">
        {shownCount !== undefined && totalCount !== undefined && (
          <span className="text-xs font-medium tabular-nums text-teal-900 dark:text-teal-200" role="status">
            {shownCount === totalCount ? `${totalCount} requests` : `${shownCount} / ${totalCount} requests`}
          </span>
        )}
        {filtered && <Button type="button" variant="ghost" size="sm" onClick={() => onChange(DEFAULT_DEVTOOLS_NETWORK_FILTERS)}
          className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground">Reset filters</Button>}
      </div>
    </div>
  );
}

export const DEVTOOLS_NETWORK_GRID = 'grid grid-cols-[minmax(0,1fr)_minmax(42px,0.3fr)_minmax(42px,0.35fr)_minmax(44px,0.35fr)] @min-[28rem]:grid-cols-[minmax(90px,2fr)_50px_62px_minmax(65px,1fr)_56px_56px] items-center gap-2 px-2';

export function DevtoolsNetworkColumns() {
  return (
    <div className={cn(DEVTOOLS_NETWORK_GRID, 'min-h-8 shrink-0 border-b border-border bg-muted text-xs font-semibold text-foreground')}>
      <span>Name</span><span>Status</span><span>Type</span><span className="hidden @min-[28rem]:block">Initiator</span>
      <span className="hidden text-right @min-[28rem]:block">Size</span><span className="text-right">Time</span>
    </div>
  );
}

export function DevtoolsNetworkCells({ network }: { network: DevtoolsNetworkRequest }) {
  const data = networkRecord(network.data);
  const initiator = getDevtoolsNetworkInitiator(network);
  const initiatorUrl = typeof initiator?.url === 'string' ? initiator.url : undefined;
  const initiatorName = initiatorUrl ? getDevtoolsNetworkName({ url: initiatorUrl }) : initiator?.type;
  const initiatorLine = typeof initiator?.lineNumber === 'number' && initiator.lineNumber >= 0 ? `:${initiator.lineNumber + 1}` : '';
  const failure = typeof data?.failureText === 'string' ? data.failureText : undefined;
  const status = typeof network.status === 'number' && network.status > 0 ? network.status : undefined;
  const size = formatNetworkSize(data?.transferSize);
  const time = formatNetworkTime(network.duration);
  const name = getDevtoolsNetworkName(network);

  return (
    <>
      <span className="truncate text-foreground" title={network.url.startsWith('data:') ? name : getDevtoolsNetworkDisplayUrl(network.url)}>{name}</span>
      <span className={cn('w-fit max-w-full truncate rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums',
        failure || (status !== undefined && status >= 400) ? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200'
          : status !== undefined && status >= 300 ? 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200'
            : status !== undefined && status >= 200 ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
              : 'text-muted-foreground')} title={failure}>
        {failure ? '(failed)' : status ?? '—'}
      </span>
      <span className="truncate">{getDevtoolsNetworkDisplayType(network) || '—'}</span>
      <span className="hidden truncate @min-[28rem]:block" title={initiatorUrl && getDevtoolsNetworkDisplayUrl(initiatorUrl)}>{typeof initiatorName === 'string' ? `${initiatorName}${initiatorLine}` : '—'}</span>
      <span className="hidden truncate text-right tabular-nums @min-[28rem]:block" title={size}>{size}</span>
      <span className="truncate text-right tabular-nums" title={time}>{time}</span>
    </>
  );
}
