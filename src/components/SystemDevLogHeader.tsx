'use client';

import { FileText, History, Loader2, Maximize2, Trash2 } from 'lucide-react';
import { DevlogTabs } from '@/components/DevlogPanelChrome';
import { Button } from '@/components/ui/button';

type SystemDevLogHeaderProps = Record<string, any>;

export function SystemDevLogHeader(props: SystemDevLogHeaderProps) {
  const { socketReady, scriptMode = false, openSystemDevLogFullscreen, isSummarizing, generateAISummary, activeDevLogTab, setActiveDevLogTab,
    groupedConsoleLogs, groupedNetworkLogs, loadedRunLabel, loadCurrentLogRun, isLoadingHistory, loadLogHistory, clearLogs } = props;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h4 className="text-base font-semibold tracking-tight">Devlog</h4>
          {scriptMode && <span className="rounded-md bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-900 dark:bg-violet-950 dark:text-violet-200">Playwright run</span>}
          {socketReady && <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-900 dark:bg-teal-950 dark:text-teal-200">
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />Relay live
          </span>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {!scriptMode && <Button type="button" variant="ghost" size="sm" onClick={generateAISummary} disabled={isSummarizing}>
            {isSummarizing ? <Loader2 className="motion-safe:animate-spin" aria-hidden="true" /> : <FileText aria-hidden="true" />}
            {isSummarizing ? 'Summarizing…' : 'AI Summary'}
          </Button>}
          <Button type="button" variant="outline" size="sm" onClick={openSystemDevLogFullscreen}><Maximize2 aria-hidden="true" />Fullscreen</Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DevlogTabs active={activeDevLogTab} onChange={setActiveDevLogTab} className="w-full sm:w-auto"
          counts={{ console: groupedConsoleLogs.length, network: groupedNetworkLogs.length }} />
        {!scriptMode && <div role="group" aria-label="Log history" className="flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="ghost" size="sm" onClick={loadCurrentLogRun} disabled={isLoadingHistory}
            aria-pressed={loadedRunLabel === 'current' || loadedRunLabel === 'live'} className="aria-pressed:bg-muted aria-pressed:font-semibold">Current</Button>
          <Button type="button" variant="ghost" size="sm" onClick={loadLogHistory} disabled={isLoadingHistory}
            aria-pressed={loadedRunLabel === 'previous'} className="aria-pressed:bg-muted aria-pressed:font-semibold">
            <History aria-hidden="true" />Previous
          </Button>
          <Button type="button" variant="ghost" size="icon" onClick={clearLogs} aria-label="Clear logs" title="Clear logs"
            className="size-9 text-muted-foreground hover:bg-rose-50 hover:text-rose-800 dark:hover:bg-rose-950 dark:hover:text-rose-200">
            <Trash2 aria-hidden="true" />
          </Button>
        </div>}
      </div>
    </div>
  );
}

