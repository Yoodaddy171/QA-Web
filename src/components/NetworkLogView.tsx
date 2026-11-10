'use client';

import { memo, useRef, useState, type Ref } from 'react';
import { X } from 'lucide-react';
import { DevlogEmptyState } from '@/components/DevlogPanelChrome';
import {
  DEVTOOLS_NETWORK_GRID, DevtoolsNetworkCells, DevtoolsNetworkColumns, DevtoolsNetworkFilters,
} from '@/components/DevtoolsNetworkFilters';
import { NetworkRequestDetails } from '@/components/NetworkRequestDetails';
import {
  formatPrettyValue, getRequestHeaders, getRequestPayload, getResponsePayload,
  type LogEntry, type NetworkLogGroup,
} from '@/components/TestCaseDetailDialog.helpers';
import { Button } from '@/components/ui/button';
import { VirtualLogList } from '@/components/VirtualLogList';
import { getDevtoolsNetworkName, type DevtoolsNetworkFilterState } from '@/lib/client/automation/devtools-network';
import { cn } from '@/lib/utils';

type RequestRow = Pick<NetworkLogGroup, 'id' | 'log'>;

interface NetworkLogViewProps {
  filters: DevtoolsNetworkFilterState;
  onFiltersChange: (filters: DevtoolsNetworkFilterState) => void;
  totalCount: number;
  groupedNetworkLogs: RequestRow[];
  logEndRef: Ref<HTMLDivElement>;
  seekRecordingFromLog: (log: LogEntry) => void;
  expandedLogId: string | null;
  setExpandedLogId: (id: string | null) => void;
  networkCodeWrap?: boolean;
  setNetworkCodeWrap?: (wrap: boolean) => void;
}

const rowKey = (row: RequestRow) => row.id;

export const NetworkLogView = memo(function NetworkLogView({
  filters, onFiltersChange, totalCount, groupedNetworkLogs, logEndRef, seekRecordingFromLog,
  expandedLogId, setExpandedLogId, networkCodeWrap, setNetworkCodeWrap,
}: NetworkLogViewProps) {
  const [localWrap, setLocalWrap] = useState(true);
  const selected = groupedNetworkLogs.find(group => group.id === expandedLogId);
  const selectedButton = useRef<HTMLButtonElement>(null);
  const network = selected?.log.network;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DevtoolsNetworkFilters filters={filters} onChange={onFiltersChange} shownCount={groupedNetworkLogs.length} totalCount={totalCount} />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="@container min-h-24 min-w-0 flex-1 overflow-auto">
          <div className="sticky top-0 z-10 bg-background"><DevtoolsNetworkColumns /></div>
          {groupedNetworkLogs.length === 0 ? (
            <DevlogEmptyState kind="network" title={totalCount ? 'No matching requests' : 'No requests recorded'}
              hint={totalCount ? 'Clear the filter or choose All to see more requests.' : undefined} />
          ) : (
            <VirtualLogList items={groupedNetworkLogs} itemKey={rowKey} activeId={expandedLogId} estimate={28}>
              {row => (
                <button
                  type="button"
                  ref={row.id === expandedLogId ? selectedButton : undefined}
                  aria-pressed={row.id === expandedLogId}
                  aria-label={`Inspect ${getDevtoolsNetworkName(row.log.network)}`}
                  className={cn(
                    DEVTOOLS_NETWORK_GRID,
                    'min-h-9 w-full cursor-pointer border-b border-border text-left text-xs text-muted-foreground hover:bg-teal-50 dark:hover:bg-teal-950/60 focus-visible:outline-2 focus-visible:outline-ring focus-visible:-outline-offset-2',
                    row.id === expandedLogId && 'bg-teal-100 dark:bg-teal-950',
                  )}
                  onClick={() => { seekRecordingFromLog(row.log); setExpandedLogId(row.id); }}
                >
                  <DevtoolsNetworkCells network={row.log.network} />
                </button>
              )}
            </VirtualLogList>
          )}
          <div ref={logEndRef} />
        </div>
        {network && (
          <section key={selected?.id} aria-label="Request details" className="devlog-detail-enter min-h-0 min-w-0 flex-1 overflow-auto border-t border-border p-2 lg:border-l lg:border-t-0">
            <div className="mb-1 flex items-center gap-2">
              <Button type="button" size="icon" variant="ghost" aria-label="Close request details" className="size-7" onClick={() => {
                setExpandedLogId(null);
                selectedButton.current?.focus();
              }}><X aria-hidden="true" /></Button>
              <p className="truncate text-xs font-medium" title={getDevtoolsNetworkName(network)}>{getDevtoolsNetworkName(network)}</p>
            </div>
            <NetworkRequestDetails
              key={selected.id}
              network={network}
              headers={network.headers}
              requestHeaders={getRequestHeaders(network.data)}
              payload={getRequestPayload(network.data)}
              response={getResponsePayload(network.data)}
              wrap={networkCodeWrap ?? localWrap}
              onWrapChange={setNetworkCodeWrap ?? setLocalWrap}
              formatValue={formatPrettyValue}
            />
          </section>
        )}
      </div>
    </div>
  );
});
