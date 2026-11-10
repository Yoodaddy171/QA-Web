'use client';

import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DevtoolsConsoleFilters } from '@/components/DevtoolsConsoleFilters';
import { DevtoolsNetworkFilters } from '@/components/DevtoolsNetworkFilters';
import type { useDevlogSearch } from '@/hooks/use-devlog-search';

export function DevlogFilterBar({ tab, search }: { tab: string; search: ReturnType<typeof useDevlogSearch> }) {
  if (tab === 'console') {
    return <DevtoolsConsoleFilters query={search.consoleQuery} onQueryChange={search.setConsoleQuery} levels={search.consoleLevels}
      onLevelsChange={search.setConsoleLevels} hiddenCount={search.consoleHidden} />;
  }
  if (tab === 'network') {
    return <DevtoolsNetworkFilters filters={search.networkFilters} onChange={search.setNetworkFilters}
      shownCount={search.network.length} totalCount={search.networkTotal} />;
  }
  return <DevlogSearchBar query={search.query} onChange={search.setQuery} tab={tab} count={search.count} total={search.total} pending={search.pending} />;
}

export function DevlogSearchBar({ query, onChange, tab, count, total, pending }: {
  query: string; onChange: (value: string) => void; tab: string; count: number; total: number; pending: boolean;
}) {
  return <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-violet-50/60 px-3 py-2 dark:bg-violet-950/30">
    <div className="relative min-w-40 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input aria-label={`Cari event ${tab}`} placeholder={`Cari di ${tab}: pesan, URL, status...`} value={query} onChange={event => onChange(event.target.value)}
        data-devlog-filter={query ? '' : undefined}
        onKeyDown={event => { if (event.key === 'Escape' && query) { event.preventDefault(); event.stopPropagation(); onChange(''); } }} className="h-9 pl-9 pr-9" />
      {query && <Button type="button" variant="ghost" size="icon" aria-label="Hapus pencarian event" className="absolute right-0 top-0 size-9" onClick={() => onChange('')}><X /></Button>}
    </div>
    <span role="status" aria-live="polite" className="text-xs tabular-nums text-muted-foreground">{pending ? 'Mencari...' : `${count}/${total} ${tab === 'execution' ? 'event' : 'grup'} termuat`}</span>
  </div>;
}

export function DevlogSearchEmpty({ query, onReset }: { query: string; onReset: () => void }) {
  return <div className="flex flex-col items-center gap-3 px-4 py-8 text-center">
    <p className="break-words text-sm text-muted-foreground">Tidak ada event yang cocok dengan “{query}” pada data termuat.</p>
    <Button type="button" variant="outline" size="sm" onClick={onReset}>Hapus pencarian</Button>
  </div>;
}
