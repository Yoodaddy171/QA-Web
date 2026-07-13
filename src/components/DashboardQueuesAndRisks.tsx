'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, Layers, RefreshCw, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardStats } from './DashboardPanel';

type DashboardQueuesAndRisksProps = {
  stats: DashboardStats;
  onOpenDetail: (item: any, context: any[]) => void;
  onModuleRiskClick?: (item: any) => void;
};

const getPriorityBadgeClass = (priority: string) => {
  switch (priority) {
    case 'Critical': return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300';
    case 'High': return 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/25 dark:bg-orange-500/10 dark:text-orange-300';
    case 'Medium': return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300';
    case 'Low': return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300';
    default: return 'border-border bg-muted text-muted-foreground';
  }
};

const getAgeClass = (days: number) => {
  if (days >= 7) return 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-300';
  if (days >= 3) return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300';
  return 'border-border bg-muted text-muted-foreground';
};

export function DashboardQueuesAndRisks({ stats, onOpenDetail, onModuleRiskClick }: DashboardQueuesAndRisksProps) {
  const [retestAtBottom, setRetestAtBottom] = React.useState(false);
  const [bugAgingAtBottom, setBugAgingAtBottom] = React.useState(false);
  const [moduleRiskAtBottom, setModuleRiskAtBottom] = React.useState(false);
  const handleScroll = (event: React.UIEvent<HTMLDivElement>, setter: (value: boolean) => void) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    setter(scrollTop + clientHeight >= scrollHeight - 5);
  };

  return (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card variant="majestic" className="border-border/40 bg-card shadow-sm">
            <CardHeader className="border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-cyan-500" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Antrian Retest</CardTitle>
              </div>
            </CardHeader>
            <CardContent
              className="group/scroll relative h-[330px] space-y-3 overflow-y-auto pt-4"
             
              onScroll={(event) => handleScroll(event, setRetestAtBottom)}
            >
              {(stats.retestQueue || []).length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border/60 px-6 text-center">
                  <CheckCircle2 className="mb-3 h-8 w-8 text-emerald-500/50" />
                  <p className="text-xs font-semibold text-muted-foreground">Tidak ada test case yang menunggu retest.</p>
                </div>
              ) : (
                <>
                  {(stats.retestQueue || []).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpenDetail(item, stats.retestQueue || [])}
                      className="w-full rounded-xl border border-border/50 bg-secondary/30 p-3 text-left transition-colors hover:border-primary/30 hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold text-foreground">{item.testCaseId}</p>
                          <p className="mt-1 truncate text-[10px] font-medium text-muted-foreground">{item.moduleName || item.page}</p>
                        </div>
                        <Badge variant="outline" className={getPriorityBadgeClass(item.priority)}>{item.priority}</Badge>
                      </div>
                      <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Menunggu {item.waitingDays} hari</p>
                    </button>
                  ))}
                  {(stats.retestQueue || []).length > 4 && !retestAtBottom && (
                    <p className="sticky bottom-0 bg-gradient-to-t from-card via-card to-transparent py-3 text-center text-[9px] font-bold uppercase tracking-wider text-primary">Scroll untuk lainnya</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card variant="majestic" className="border-border/40 bg-card shadow-sm">
            <CardHeader className="border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Umur Bug</CardTitle>
              </div>
            </CardHeader>
            <CardContent
              className="group/scroll relative h-[330px] space-y-3 overflow-y-auto pt-4"
             
              onScroll={(event) => handleScroll(event, setBugAgingAtBottom)}
            >
              {(stats.bugAging || []).length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border/60 px-6 text-center">
                  <ShieldAlert className="mb-3 h-8 w-8 text-amber-500/45" />
                  <p className="text-xs font-semibold text-muted-foreground">Tidak ada bug yang menua.</p>
                </div>
              ) : (
                <>
                  {(stats.bugAging || []).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpenDetail(item, stats.bugAging || [])}
                      className="w-full rounded-xl border border-border/50 bg-secondary/30 p-3 text-left transition-colors hover:border-primary/30 hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold text-foreground">{item.testCaseId}</p>
                          <p className="mt-1 truncate text-[10px] font-medium text-muted-foreground">{item.testAction}</p>
                        </div>
                        <Badge variant="outline" className={getAgeClass(item.ageDays)}>{item.ageDays} hari</Badge>
                      </div>
                      <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-amber-500">{item.status}</p>
                    </button>
                  ))}
                  {(stats.bugAging || []).length > 4 && !bugAgingAtBottom && (
                    <p className="sticky bottom-0 bg-gradient-to-t from-card via-card to-transparent py-3 text-center text-[9px] font-bold uppercase tracking-wider text-primary">Scroll untuk lainnya</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card variant="majestic" className="border-border/40 bg-card shadow-sm">
            <CardHeader className="border-b border-border/40 pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-500" />
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Risiko per Module</CardTitle>
              </div>
            </CardHeader>
            <CardContent
              className="group/scroll relative h-[330px] space-y-3 overflow-y-auto pt-4"
             
              onScroll={(event) => handleScroll(event, setModuleRiskAtBottom)}
            >
              {(stats.moduleRisks || []).length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-border/60 px-6 text-center">
                  <Layers className="mb-3 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs font-semibold text-muted-foreground">Belum ada data risiko module.</p>
                </div>
              ) : (
                <>
                  {(stats.moduleRisks || []).map((item) => (
                    <button
                      key={item.moduleId || 'ungrouped'}
                      type="button"
                      onClick={() => onModuleRiskClick?.(item)}
                      className="w-full rounded-xl border border-border/50 bg-secondary/30 p-3 text-left transition-colors hover:border-primary/30 hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-xs font-semibold text-foreground">{item.moduleName}</p>
                          <p className="mt-1 text-[10px] font-medium text-muted-foreground">{item.total} test case</p>
                        </div>
                        <Badge variant="outline" className={getPriorityBadgeClass(item.riskScore >= 70 ? 'Critical' : item.riskScore >= 40 ? 'High' : item.riskScore >= 20 ? 'Medium' : 'Low')}>
                          Risiko {item.riskScore}
                        </Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-semibold">
                        {item.failed > 0 && <span className="text-red-500">{item.failed} failed</span>}
                        {item.blocked > 0 && <span className="text-rose-500">{item.blocked} blocked</span>}
                        {item.readyToRetest > 0 && <span className="text-cyan-500">{item.readyToRetest} retest</span>}
                      </div>
                    </button>
                  ))}
                  {(stats.moduleRisks || []).length > 4 && !moduleRiskAtBottom && (
                    <p className="sticky bottom-0 bg-gradient-to-t from-card via-card to-transparent py-3 text-center text-[9px] font-bold uppercase tracking-wider text-primary">Scroll untuk lainnya</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>


  );
}
