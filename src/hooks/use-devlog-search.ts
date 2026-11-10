'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { logSearchText } from '@/lib/client/automation/devlog-review';
import { DEFAULT_DEVTOOLS_CONSOLE_LEVELS, filterDevtoolsConsoleGroups, type DevtoolsConsoleLevel } from '@/lib/client/automation/devtools-console';
import { DEFAULT_DEVTOOLS_NETWORK_FILTERS, createDevtoolsNetworkPredicate, type DevtoolsNetworkFilterState } from '@/lib/client/automation/devtools-network';
import type { ConsoleLogGroup, NetworkLogGroup } from '@/components/TestCaseDetailDialog.helpers';

interface DevtoolsFilterControls {
  networkFilters: DevtoolsNetworkFilterState;
  setNetworkFilters: (filters: DevtoolsNetworkFilterState) => void;
  consoleQuery: string;
  setConsoleQuery: (value: string) => void;
  consoleLevels: DevtoolsConsoleLevel[];
  setConsoleLevels: (value: DevtoolsConsoleLevel[]) => void;
}

export function useDevlogSearch({ executionLogs, networkGroups, consoleGroups, tab, onSearch, filters }: {
  executionLogs: any[];
  networkGroups: NetworkLogGroup[];
  consoleGroups: ConsoleLogGroup[];
  tab: string;
  onSearch?: () => void;
  filters?: DevtoolsFilterControls;
}) {
  const [query, setQueryState] = useState('');
  const deferred = useDeferredValue(query.trim().toLocaleLowerCase());
  const [localNetworkFilters, setLocalNetworkFilters] = useState(DEFAULT_DEVTOOLS_NETWORK_FILTERS);
  const [localConsoleQuery, setLocalConsoleQuery] = useState('');
  const [localConsoleLevels, setLocalConsoleLevels] = useState(() => [...DEFAULT_DEVTOOLS_CONSOLE_LEVELS]);
  const networkFilters = filters?.networkFilters ?? localNetworkFilters;
  const consoleQuery = filters?.consoleQuery ?? localConsoleQuery;
  const consoleLevels = filters?.consoleLevels ?? localConsoleLevels;
  const execution = useMemo(() => !deferred || tab !== 'execution' ? executionLogs
    : executionLogs.filter(log => logSearchText(log).includes(deferred)), [deferred, executionLogs, tab]);
  const network = useMemo(() => {
    if (tab !== 'network') return networkGroups;
    const matches = createDevtoolsNetworkPredicate(networkFilters);
    return networkGroups.filter(group => matches(group.log.network));
  }, [networkFilters, networkGroups, tab]);
  const console = useMemo(() => tab === 'console' ? filterDevtoolsConsoleGroups(consoleGroups, consoleQuery, consoleLevels)
    : consoleGroups, [consoleGroups, consoleQuery, consoleLevels, tab]);
  const consoleTotal = consoleGroups.reduce((total, group) => total + group.count, 0);
  const consoleHidden = consoleTotal - console.reduce((total, group) => total + group.count, 0);
  return {
    execution, network, console, query, pending: query.trim().toLocaleLowerCase() !== deferred,
    count: execution.length, total: executionLogs.length, consoleHidden, networkTotal: networkGroups.length,
    networkFilters, consoleQuery, consoleLevels,
    setQuery: (value: string) => { setQueryState(value); if (value.trim()) onSearch?.(); },
    setNetworkFilters: (value: DevtoolsNetworkFilterState) => {
      (filters?.setNetworkFilters ?? setLocalNetworkFilters)(value);
      onSearch?.();
    },
    setConsoleQuery: (value: string) => {
      (filters?.setConsoleQuery ?? setLocalConsoleQuery)(value);
      onSearch?.();
    },
    setConsoleLevels: (value: DevtoolsConsoleLevel[]) => {
      (filters?.setConsoleLevels ?? setLocalConsoleLevels)(value);
      onSearch?.();
    },
  };
}
