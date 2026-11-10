'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type SyncedVideoEventsPanelProps = Record<string, any>;

export function SyncedVideoEventsPanel(props: SyncedVideoEventsPanelProps) {
  const {
    hasManualRecordingVideo, filteredSyncedVideoEvents, syncedVideoEvents, syncedEventFilters,
    toggleSyncedEventFilter, getSyncedEventSeverityClass, selectedSyncedEventId,
    seekRecordingFromSyncedEvent, formatRelativeTime, selectedSyncedVideoEventDetail,
    selectedSyncedVideoEvent,
  } = props;
  const [paging, setPaging] = useState({ key: '', page: 0, selection: '' });
  const pageKey = `${filteredSyncedVideoEvents.length}:${filteredSyncedVideoEvents[0]?.id}:${filteredSyncedVideoEvents.at(-1)?.id}:${Object.values(syncedEventFilters).join(',')}`;
  const selectedIndex = filteredSyncedVideoEvents.findIndex((event: { id: string }) => event.id === selectedSyncedEventId);
  const pageCount = Math.max(1, Math.ceil(filteredSyncedVideoEvents.length / 24));
  const page = Math.min(pageCount - 1, selectedIndex >= 0 && paging.selection !== selectedSyncedEventId ? Math.floor(selectedIndex / 24) : paging.key === pageKey ? paging.page : 0);
  const changePage = (next: number) => setPaging({ key: pageKey, page: next, selection: selectedSyncedEventId || '' });
  return (
              hasManualRecordingVideo ? (
                <div className="shrink-0 border-b border-border bg-background px-3 py-2">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-foreground">Synced Events</p>
                    <span className="text-[10px] font-bold text-muted-foreground">{filteredSyncedVideoEvents.length}/{syncedVideoEvents.length} events</span>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {[
                      { key: 'network' as const, label: 'Network' },
                      { key: 'console' as const, label: 'Console' },
                      { key: 'errors' as const, label: 'Errors' },
                      { key: 'warnings' as const, label: 'Warnings' },
                      { key: 'steps' as const, label: 'Steps' },
                      { key: 'evidence' as const, label: 'Evidence' },
                      { key: 'unknown' as const, label: 'Unknown' },
                    ].map((item) => (
                      <Button
                        key={item.key}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-6 rounded-md border px-2 text-[9px] font-semibold uppercase tracking-wider",
                          syncedEventFilters[item.key]
                            ? "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200"
                            : "border-border bg-muted text-muted-foreground hover:bg-secondary"
                        )}
                        onClick={() => toggleSyncedEventFilter(item.key)}
                      >
                        {item.label}
                      </Button>
                    ))}
                  </div>
                  {syncedVideoEvents.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-[10px] font-semibold text-muted-foreground">
                      Belum ada event dengan timestamp yang bisa disinkronkan ke video.
                    </p>
                  ) : filteredSyncedVideoEvents.length === 0 ? (
                    <p className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-[10px] font-semibold text-muted-foreground">
                      Tidak ada synced event yang cocok dengan filter aktif.
                    </p>
                  ) : (
                    <><div className="flex max-h-32 gap-2 overflow-x-auto pb-1">
                      {filteredSyncedVideoEvents.slice(page * 24, (page + 1) * 24).map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          className={cn(
                            "min-w-[180px] rounded-lg border px-2 py-1.5 text-left shadow-sm transition hover:scale-[1.01]",
                            getSyncedEventSeverityClass(event),
                            selectedSyncedEventId === event.id && "ring-2 ring-indigo-300 ring-offset-1 ring-offset-background"
                          )}
                          onClick={() => seekRecordingFromSyncedEvent(event)}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[9px] font-semibold uppercase tracking-wider">{event.label}</span>
                            <span className="font-mono text-[10px] font-semibold">{formatRelativeTime(event.clampedOffsetMs)}</span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[10px] font-semibold">{event.summary}</p>
                          {(event.isBeforeVideo || event.isAfterVideo) && (
                            <p className="mt-1 text-[9px] font-semibold uppercase tracking-wider opacity-80">
                              {event.isBeforeVideo ? 'Before video' : 'After video'}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>{pageCount > 1 && <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{page * 24 + 1}–{Math.min((page + 1) * 24, filteredSyncedVideoEvents.length)} dari {filteredSyncedVideoEvents.length} event</span><div className="flex gap-1"><Button variant="ghost" size="sm" disabled={page === 0} onClick={() => changePage(page - 1)}>Sebelumnya</Button><Button variant="ghost" size="sm" disabled={page + 1 >= pageCount} onClick={() => changePage(page + 1)}>Berikutnya</Button></div></div>}</>
                  )}
                  {selectedSyncedVideoEventDetail && (
                    <div className={cn("mt-2 rounded-lg border p-2 text-[10px]", getSyncedEventSeverityClass(selectedSyncedVideoEvent!))}>
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-semibold uppercase tracking-wider">{selectedSyncedVideoEventDetail.category}</span>
                        <span className="rounded border border-current/20 px-1.5 py-0.5 font-semibold uppercase tracking-wider">{selectedSyncedVideoEventDetail.severity}</span>
                        <span className="font-mono font-semibold">{selectedSyncedVideoEventDetail.offset}</span>
                        <span className="truncate font-mono opacity-75">{selectedSyncedVideoEventDetail.timestamp}</span>
                      </div>
                      {(selectedSyncedVideoEventDetail.method || selectedSyncedVideoEventDetail.url || selectedSyncedVideoEventDetail.responseStatus) && (
                        <div className="mb-1 grid grid-cols-[64px_1fr_48px] gap-2 rounded border border-current/15 bg-background/40 p-1.5">
                          <span className="truncate font-semibold">{selectedSyncedVideoEventDetail.method || '-'}</span>
                          <span className="truncate">{selectedSyncedVideoEventDetail.url || '-'}</span>
                          <span className="text-right font-semibold">{selectedSyncedVideoEventDetail.responseStatus || '-'}</span>
                        </div>
                      )}
                      <p className="line-clamp-3 font-semibold">{selectedSyncedVideoEventDetail.summary}</p>
                    </div>
                  )}
                </div>
              ) : null
  );
}
