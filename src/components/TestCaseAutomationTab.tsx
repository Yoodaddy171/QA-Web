'use client';

import React from 'react';
import { ChevronDown, Code2, Film, MonitorDot, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { MutationAction } from '@/components/WorkspaceAccess';
import { Button } from '@/components/ui/button';
import { TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ConsoleLogView } from '@/components/ConsoleLogView';
import { DevLogGuide } from '@/components/DevLogGuide';
import { ExecutionLogView } from '@/components/ExecutionLogView';
import { ManualCaptureCommand } from '@/components/ManualCaptureCommand';
import { ManualRecordingPreview } from '@/components/ManualRecordingPreview';
import { NetworkLogView } from '@/components/NetworkLogView';
import { PlaywrightScriptPanel } from '@/components/PlaywrightScriptPanel';
import { SystemDevLogHeader } from '@/components/SystemDevLogHeader';
import type { TestCase } from '@/components/TestCaseTable';
import type { AutomationLogEntry } from '@/hooks/useAutomationLogs';

type ConsoleLogViewProps = React.ComponentProps<typeof ConsoleLogView>;
type NetworkLogViewProps = React.ComponentProps<typeof NetworkLogView>;
type PlaywrightScriptPanelProps = React.ComponentProps<typeof PlaywrightScriptPanel>;
type DevLogGuideProps = React.ComponentProps<typeof DevLogGuide>;
type ExecutionLogViewProps = React.ComponentProps<typeof ExecutionLogView>;

interface TestCaseAutomationTabProps {
  viewTestCase: TestCase;
  sourceTestCaseId: string;
  canAdmin: boolean;
  automationMode: 'results' | 'script' | 'capture';
  showAutomationMode: (mode: 'results' | 'script' | 'capture') => void;
  selectedScript: { runId: string } | null;
  setScriptSelection: (value: null) => void;
  isManualCaptureActive: boolean;
  captureStartedAt?: PlaywrightScriptPanelProps['captureStartedAt'];
  inspectScriptRun: PlaywrightScriptPanelProps['onInspect'];
  setHasUnsavedScript: (dirty: boolean) => void;
  onScriptRunsDeleted: (ids: string[]) => void;
  expandedGuide: DevLogGuideProps['expandedGuide'];
  setExpandedGuide: DevLogGuideProps['setExpandedGuide'];
  manualCaptureCommandProps: React.ComponentProps<typeof ManualCaptureCommand>;
  manualRecordingPreviewProps: React.ComponentProps<typeof ManualRecordingPreview>;
  systemDevLogHeaderProps: React.ComponentProps<typeof SystemDevLogHeader>;
  aiSummary: string | null;
  setAiSummary: (summary: string | null) => void;
  activeDevLogTab: 'execution' | 'console' | 'network';
  executionLogs: AutomationLogEntry[];
  liveLogs: AutomationLogEntry[];
  logEndRef: React.RefObject<HTMLDivElement | null>;
  formatRelativeTime: ConsoleLogViewProps['formatRelativeTime'];
  seekRecordingFromLog: ConsoleLogViewProps['seekRecordingFromLog'];
  groupedConsoleLogs: ConsoleLogViewProps['groupedConsoleLogs'];
  consoleQuery: ConsoleLogViewProps['query'];
  consoleLevels: ConsoleLogViewProps['levels'];
  setConsoleQuery: ConsoleLogViewProps['onQueryChange'];
  setConsoleLevels: ConsoleLogViewProps['onLevelsChange'];
  expandedLogId: ConsoleLogViewProps['expandedLogId'];
  setExpandedLogId: ConsoleLogViewProps['setExpandedLogId'];
  getConsoleLogText: ConsoleLogViewProps['getConsoleLogText'];
  formatPrettyValue: ConsoleLogViewProps['formatPrettyValue'];
  networkFilters: NetworkLogViewProps['filters'];
  setNetworkFilters: NetworkLogViewProps['onFiltersChange'];
  fullscreenNetworkCount: number;
  groupedNetworkLogs: NetworkLogViewProps['groupedNetworkLogs'];
  networkCodeWrap: NetworkLogViewProps['networkCodeWrap'];
  setNetworkCodeWrap: NetworkLogViewProps['setNetworkCodeWrap'];
}

export function TestCaseAutomationTab({
  viewTestCase,
  sourceTestCaseId,
  canAdmin,
  automationMode,
  showAutomationMode,
  selectedScript,
  setScriptSelection,
  isManualCaptureActive,
  captureStartedAt,
  inspectScriptRun,
  setHasUnsavedScript,
  onScriptRunsDeleted,
  expandedGuide,
  setExpandedGuide,
  manualCaptureCommandProps,
  manualRecordingPreviewProps,
  systemDevLogHeaderProps,
  aiSummary,
  setAiSummary,
  activeDevLogTab,
  executionLogs,
  liveLogs,
  logEndRef,
  formatRelativeTime,
  seekRecordingFromLog,
  groupedConsoleLogs,
  consoleQuery,
  consoleLevels,
  setConsoleQuery,
  setConsoleLevels,
  expandedLogId,
  setExpandedLogId,
  getConsoleLogText,
  formatPrettyValue,
  networkFilters,
  setNetworkFilters,
  fullscreenNetworkCount,
  groupedNetworkLogs,
  networkCodeWrap,
  setNetworkCodeWrap,
}: TestCaseAutomationTabProps) {
  return (
    <TabsContent value="logs" className="space-y-4 mt-0 outline-none h-full flex flex-col">
      <motion.div
        key="logs"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className="h-full flex flex-col"
      >
        <div className="flex flex-col flex-1 min-h-0">
          <div role="group" aria-label="Mode Automation" className="inline-flex h-8 items-center rounded-lg border border-border bg-secondary/50 p-0.5 mb-4">
            <Button
              type="button"
              size="sm"
              variant={automationMode === 'results' ? 'secondary' : 'ghost'}
              aria-pressed={automationMode === 'results'}
              onClick={() => showAutomationMode('results')}
              className="h-7 rounded-md px-3 text-xs font-medium"
            >
              <Film className="size-3.5" />Hasil
            </Button>
            {canAdmin && (
              <Button
                type="button"
                size="sm"
                variant={automationMode === 'script' ? 'secondary' : 'ghost'}
                aria-pressed={automationMode === 'script'}
                onClick={() => showAutomationMode('script')}
                className="h-7 rounded-md px-3 text-xs font-medium"
              >
                <Code2 className="size-3.5" />Script
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant={automationMode === 'capture' ? 'secondary' : 'ghost'}
              aria-pressed={automationMode === 'capture'}
              onClick={() => {
                setScriptSelection(null);
                showAutomationMode('capture');
              }}
              className="h-7 rounded-md px-3 text-xs font-medium"
            >
              <MonitorDot className="size-3.5" />Capture Manual{isManualCaptureActive && <span className="text-xs">· Aktif</span>}
            </Button>
          </div>

          {canAdmin && (
            <PlaywrightScriptPanel
              key={sourceTestCaseId}
              projectId={viewTestCase.projectId}
              testCaseId={sourceTestCaseId}
              view={automationMode === 'capture' ? 'hidden' : automationMode}
              selectedRunId={selectedScript?.runId || null}
              captureStartedAt={captureStartedAt}
              onShowResults={() => showAutomationMode('results')}
              onCaptureResults={() => setScriptSelection(null)}
              onInspect={inspectScriptRun}
              onDirtyChange={setHasUnsavedScript}
              onRunsDeleted={onScriptRunsDeleted}
            />
          )}

          {automationMode === 'capture' && (
            <div className="shrink-0 space-y-4">
              <p className="text-sm text-muted-foreground">Rekam interaksi di browser, lalu buka Hasil untuk meninjau video dan devlog.</p>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedGuide(expandedGuide === 'manual' ? null : 'manual')}
                  className="w-full flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-xs font-bold text-foreground uppercase tracking-wider hover:bg-secondary/20 transition-colors"
                >
                  <span>Manual Capture</span>
                  <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-300', expandedGuide === 'manual' && 'rotate-180')} />
                </button>
                <AnimatePresence>
                  {expandedGuide === 'manual' && (
                    <motion.div
                      initial={false}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border px-4 pb-4 pt-3 text-xs leading-relaxed text-muted-foreground font-medium">
                        <ol className="ml-4 list-decimal space-y-2">
                          <li>Masukkan URL website yang ingin dites pada input Manual Capture.</li>
                          <li>Pilih Browser Kosong untuk sesi bersih, atau Profiled Browser untuk memakai ulang login/cookies profil Traceva.</li>
                          <li>Klik Start. Traceva akan membuka browser capture dan mulai merekam interaksi.</li>
                          <li>Lakukan testing manual di browser yang terbuka.</li>
                          <li>Klik Stop dari Traceva setelah selesai, lalu buka Hasil untuk meninjau rekaman.</li>
                        </ol>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <MutationAction>
                <ManualCaptureCommand {...manualCaptureCommandProps} />
              </MutationAction>
              <DevLogGuide expandedGuide={expandedGuide} setExpandedGuide={setExpandedGuide} />
            </div>
          )}

          {automationMode === 'results' && (
            <div className="flex min-w-0 shrink-0 flex-col gap-3">
              {!selectedScript && (
                <p className="text-xs text-muted-foreground">
                  Sumber: Capture manual / integrasi{isManualCaptureActive ? ' · Perekaman aktif. Buka Capture Manual untuk menghentikan.' : ''}
                </p>
              )}
              <ManualRecordingPreview {...manualRecordingPreviewProps} />
              <SystemDevLogHeader {...systemDevLogHeaderProps} />

              <div className="flex h-[min(680px,calc(100dvh-8rem))] min-h-[360px] max-h-[680px] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-background text-xs">
                {aiSummary && !selectedScript && (
                  <div className="border-b border-primary/20 bg-primary/5 p-4 animate-in fade-in slide-in-from-top-2 duration-500">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                        <Sparkles className="w-3.5 h-3.5" />
                        AI Result Summary
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-primary/60 hover:text-primary"
                        onClick={() => setAiSummary(null)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="text-foreground leading-relaxed whitespace-pre-wrap text-xs prose prose-sm max-w-none dark:prose-invert">
                      {aiSummary}
                    </div>
                  </div>
                )}
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent dark:scrollbar-thumb-slate-700">
                  <div key={activeDevLogTab} className="devlog-view-enter h-full min-h-0">
                    {activeDevLogTab === 'execution' ? (
                      <ExecutionLogView
                        stepLogs={viewTestCase.stepLogs}
                        logs={executionLogs}
                        evidenceLogs={liveLogs}
                        logEndRef={logEndRef}
                        formatRelativeTime={formatRelativeTime}
                        onSelectLog={seekRecordingFromLog}
                      />
                    ) : activeDevLogTab === 'console' ? (
                      <ConsoleLogView
                        groupedConsoleLogs={groupedConsoleLogs}
                        query={consoleQuery}
                        levels={consoleLevels}
                        onQueryChange={setConsoleQuery}
                        onLevelsChange={setConsoleLevels}
                        logEndRef={logEndRef}
                        expandedLogId={expandedLogId}
                        setExpandedLogId={setExpandedLogId}
                        seekRecordingFromLog={seekRecordingFromLog}
                        formatRelativeTime={formatRelativeTime}
                        getConsoleLogText={getConsoleLogText}
                        formatPrettyValue={formatPrettyValue}
                      />
                    ) : (
                      <NetworkLogView
                        filters={networkFilters}
                        onFiltersChange={setNetworkFilters}
                        totalCount={fullscreenNetworkCount}
                        groupedNetworkLogs={groupedNetworkLogs}
                        logEndRef={logEndRef}
                        seekRecordingFromLog={seekRecordingFromLog}
                        expandedLogId={expandedLogId}
                        setExpandedLogId={setExpandedLogId}
                        networkCodeWrap={networkCodeWrap}
                        setNetworkCodeWrap={setNetworkCodeWrap}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </TabsContent>
  );
}
