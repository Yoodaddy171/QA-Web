'use client';

import React, { useState } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Eye, ArrowRight, ArrowLeft, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { BUGFIX_STATUS, type BugFixStatus } from '@/lib/domain/bugfix';
import type { BugFixItem } from '@/components/BugFixPanel';
import { springTransition } from '@/lib/client/ui-motion';
import { cn } from '@/lib/utils';
import { useWorkspaceAccess } from '@/components/WorkspaceAccess';

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return 'Baru';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

interface BugFixKanbanBoardProps {
  items: BugFixItem[];
  getPriorityColor: (priority: string) => string;
  onStatusChange: (id: string, nextStatus: BugFixStatus) => void;
  onOpenDetail: (item: BugFixItem) => void;
}

interface ColumnConfig {
  status: BugFixStatus;
  label: string;
  badgeClass: string;
  accentBorder: string;
  bgLight: string;
}

const KANBAN_COLUMNS: ColumnConfig[] = [
  {
    status: BUGFIX_STATUS.REPORTED,
    label: 'Reported',
    badgeClass: 'qa-status qa-bug-open',
    accentBorder: 'border-t-orange-600 dark:border-t-orange-400',
    bgLight: 'bg-orange-500/5',
  },
  {
    status: BUGFIX_STATUS.FIXING,
    label: 'In Fix',
    badgeClass: 'qa-status qa-bug-fixing',
    accentBorder: 'border-t-purple-700 dark:border-t-purple-400',
    bgLight: 'bg-purple-500/5',
  },
  {
    status: BUGFIX_STATUS.READY_TO_RETEST,
    label: 'Ready to Retest',
    badgeClass: 'qa-status qa-bug-ready',
    accentBorder: 'border-t-sky-700 dark:border-t-sky-400',
    bgLight: 'bg-sky-500/5',
  },
  {
    status: BUGFIX_STATUS.VERIFIED_FIXED,
    label: 'Fixed & Verified',
    badgeClass: 'qa-status qa-bug-fixed',
    accentBorder: 'border-t-teal-700 dark:border-t-teal-400',
    bgLight: 'bg-teal-500/5',
  },
];

export function BugFixKanbanBoard({
  items,
  getPriorityColor,
  onStatusChange,
  onOpenDetail,
}: BugFixKanbanBoardProps) {
  const { canEdit } = useWorkspaceAccess();
  const reducedMotion = useReducedMotion();
  const layoutSpring = springTransition(reducedMotion, 'springLayout');

  const [draggedBugId, setDraggedBugId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<BugFixStatus | null>(null);

  const handleDropToColumn = (targetStatus: BugFixStatus) => {
    if (!canEdit || !draggedBugId) {
      setDraggedBugId(null);
      setDragOverColumn(null);
      return;
    }
    const draggedItem = items.find((item) => item.id === draggedBugId);
    if (draggedItem && draggedItem.status !== targetStatus) {
      onStatusChange(draggedItem.id, targetStatus);
    }
    setDraggedBugId(null);
    setDragOverColumn(null);
  };

  return (
    <LayoutGroup id="bugfix-kanban-board">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 min-[1400px]:grid-cols-4">
        {KANBAN_COLUMNS.map((col) => {
          const colItems = items.filter((item) => item.status === col.status);
          const isDropTarget = Boolean(canEdit && draggedBugId && dragOverColumn === col.status);

          return (
            <div
              key={col.status}
              onDragOver={(event) => {
                if (!canEdit || !draggedBugId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                if (dragOverColumn !== col.status) {
                  setDragOverColumn(col.status);
                }
              }}
              onDragLeave={(event) => {
                const nextTarget = event.relatedTarget as Node | null;
                if (nextTarget && event.currentTarget.contains(nextTarget)) return;
                if (dragOverColumn === col.status) {
                  setDragOverColumn(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                handleDropToColumn(col.status);
              }}
              className={cn(
                'flex flex-col rounded-xl border border-border bg-card/70 overflow-hidden border-t-4 transition-all duration-200',
                col.accentBorder,
                isDropTarget && 'border-primary/60 bg-primary/[0.04] ring-2 ring-primary/20 scale-[1.005]'
              )}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between border-b border-border/60 bg-secondary/30 px-3.5 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    {col.label}
                  </span>
                  <span
                    className={cn(
                      'flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-mono text-[11px] font-bold',
                      col.badgeClass
                    )}
                  >
                    <AnimatedNumber value={colItems.length} />
                  </span>
                </div>
                {canEdit && (
                  <span className="text-[10px] font-medium text-muted-foreground/70 hidden sm:inline">
                    Drag kartu
                  </span>
                )}
              </div>

              {/* Column Cards Container */}
              <div className="flex flex-1 flex-col gap-2.5 p-3 overflow-y-auto max-h-[calc(100vh-270px)] min-h-[300px]">
                <AnimatePresence mode="popLayout" initial={false}>
                  {colItems.length === 0 ? (
                    <motion.div
                      key={`empty-${col.status}`}
                      initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                      transition={{ duration: reducedMotion ? 0 : 0.16 }}
                      className={cn(
                        'flex flex-1 items-center justify-center rounded-lg border border-dashed border-border/60 py-8 text-center transition-colors',
                        isDropTarget && 'border-primary/50 bg-primary/5 text-primary font-medium'
                      )}
                    >
                      <p className="text-xs text-muted-foreground">
                        {isDropTarget ? `Lepaskan untuk pindah ke ${col.label}` : 'Tidak ada bug di kolom ini'}
                      </p>
                    </motion.div>
                  ) : (
                    colItems.map((item) => {
                      const isDraggingThis = draggedBugId === item.id;
                      return (
                        <motion.div
                          key={item.id}
                          layout={!reducedMotion}
                          layoutId={reducedMotion ? undefined : `bug-kanban-card-${item.id}`}
                          initial={reducedMotion ? false : { opacity: 0, scale: 0.94, y: 8 }}
                          animate={{ opacity: isDraggingThis ? 0.45 : 1, scale: isDraggingThis ? 0.97 : 1, y: 0 }}
                          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94 }}
                          transition={layoutSpring}
                          draggable={canEdit}
                          onDragStart={(event) => {
                            if (!canEdit) return;
                            setDraggedBugId(item.id);
                            const dataTransfer = (event as unknown as React.DragEvent).dataTransfer;
                            if (dataTransfer) {
                              dataTransfer.effectAllowed = 'move';
                              dataTransfer.setData('text/plain', item.id);
                            }
                          }}
                          onDragEnd={() => {
                            setDraggedBugId(null);
                            setDragOverColumn(null);
                          }}
                          className={cn(
                            'group flex flex-col justify-between rounded-lg border border-border/70 bg-card p-3 shadow-xs transition-[border-color,background-color,box-shadow] duration-150 hover:border-primary/50 hover:bg-secondary/20 hover:shadow-sm',
                            canEdit && 'cursor-grab active:cursor-grabbing'
                          )}
                        >
                          <div>
                            {/* Top row: ID + Priority + Open Detail */}
                            <div className="mb-2 flex items-center justify-between gap-1">
                              <div className="flex items-center gap-1 min-w-0">
                                {canEdit && (
                                  <GripVertical className="size-3.5 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                                )}
                                <span className="font-mono text-xs font-bold text-primary truncate">
                                  {item.testCaseId}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={cn(
                                    'rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase',
                                    getPriorityColor(item.priority)
                                  )}
                                >
                                  {item.priority}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-6 text-muted-foreground hover:text-foreground"
                                  onClick={() => onOpenDetail(item)}
                                  title="Lihat detail bug"
                                >
                                  <Eye className="size-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Action Title */}
                            <p className="line-clamp-2 text-xs font-semibold text-foreground">
                              {item.testAction}
                            </p>

                            {/* Module & Submenu */}
                            <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <span className="truncate">{item.page}</span>
                              {item.subMenu && (
                                <>
                                  <span>·</span>
                                  <span className="truncate">{item.subMenu}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Bottom Status Controls */}
                          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[11px]">
                            <span className="text-[10px] text-muted-foreground">
                              {formatDate(item.reportedAt)}
                            </span>

                            {canEdit && (
                              <div className="flex items-center gap-1">
                                {col.status === BUGFIX_STATUS.FIXING && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                    onClick={() => onStatusChange(item.id, BUGFIX_STATUS.REPORTED)}
                                    title="Kembalikan ke Reported"
                                  >
                                    <ArrowLeft className="mr-1 size-3" /> Report
                                  </Button>
                                )}

                                {col.status === BUGFIX_STATUS.REPORTED && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="qa-status qa-bug-fixing h-6 px-2 text-[10px] font-medium hover:opacity-90"
                                    onClick={() => onStatusChange(item.id, BUGFIX_STATUS.FIXING)}
                                  >
                                    Fix <ArrowRight className="ml-1 size-3" />
                                  </Button>
                                )}

                                {col.status === BUGFIX_STATUS.FIXING && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="qa-status qa-bug-ready h-6 px-2 text-[10px] font-medium hover:opacity-90"
                                    onClick={() => onStatusChange(item.id, BUGFIX_STATUS.READY_TO_RETEST)}
                                  >
                                    Retest <ArrowRight className="ml-1 size-3" />
                                  </Button>
                                )}

                                {col.status === BUGFIX_STATUS.READY_TO_RETEST && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                    onClick={() => onStatusChange(item.id, BUGFIX_STATUS.FIXING)}
                                    title="Kembalikan ke Fixing"
                                  >
                                    <ArrowLeft className="mr-1 size-3" /> Back
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
