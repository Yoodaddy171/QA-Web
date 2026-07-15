'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Clock, Layers, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapse } from '@/components/ui/collapse';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { DashboardStats } from './DashboardPanel';

type DashboardModuleProgressProps = Record<string, any>;

export function DashboardModuleProgress(props: DashboardModuleProgressProps) {
  const { stats, modules, selectedModuleFilter, setSelectedModuleFilter, expandedModules, setExpandedModules } = props;
  return (
    <>
        {/* Module Progress */}
        {stats.moduleProgress.length > 0 && (
          <Card variant="majestic" className="border-border/40 shadow-sm bg-card">
            <CardHeader className="pb-3 border-b border-border/40">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-primary" />
                  <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Progress per Module</CardTitle>
                </div>
                <Select value={selectedModuleFilter} onValueChange={setSelectedModuleFilter}>
                  <SelectTrigger className="h-8 w-[160px] rounded-xl border border-border/50 bg-secondary/40 text-xs font-semibold">
                    <SelectValue placeholder="All Modules" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl bg-card border border-border/50 shadow-lg">
                    <SelectItem value="all" className="rounded-lg text-xs font-medium">All Modules</SelectItem>
                    {modules.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="rounded-lg text-xs font-medium">{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {(selectedModuleFilter === 'all'
                  ? [...stats.moduleProgress, ...(stats.ungroupedProgress ? [stats.ungroupedProgress] : [])]
                  : stats.moduleProgress.filter(m => m.id === selectedModuleFilter)
                ).map((mod) => {
                  const isExpanded = expandedModules.has(mod.id || 'ungrouped');
                  const toggleExpand = () => {
                    setExpandedModules(prev => {
                      const next = new Set(prev);
                      const key = mod.id || 'ungrouped';
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    });
                  };
                  return (
                    <div key={mod.id || 'ungrouped'} className="rounded-xl border border-border/60 overflow-hidden">
                      <button onClick={toggleExpand} className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-secondary/50 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                            <Layers className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{mod.name}</p>
                            <p className="text-[11px] text-muted-foreground">{mod.totalCases} cases · {mod.totalMenus} menus</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-lg font-bold text-foreground">{mod.avgProgress}%</p>
                          <div className="w-24 hidden sm:block"><Progress value={mod.avgProgress} className="h-2 bg-secondary" /></div>
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </button>
                      <Collapse open={isExpanded}>
                        <div className="border-t border-border/50 bg-secondary/20">
                            <Table>
                              <TableHeader>
                                <TableRow className="hover:bg-transparent border-border/50">
                                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground h-9">Page</TableHead>
                                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground h-9">Sub Menu</TableHead>
                                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground h-9 text-center">Cases</TableHead>
                                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground h-9 text-center">Progress</TableHead>
                                  <TableHead className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground h-9">Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {mod.menus.map((mp, idx) => (
                                  <TableRow key={idx} className="hover:bg-secondary/50 border-border/30">
                                    <TableCell className="text-xs font-medium text-foreground py-3">{mp.page}</TableCell>
                                    <TableCell className="text-xs text-muted-foreground py-3">{mp.subMenu || '—'}</TableCell>
                                    <TableCell className="text-xs text-center font-medium text-foreground py-3">{mp.totalCases}</TableCell>
                                    <TableCell className="py-3">
                                      <div className="flex items-center justify-center gap-2">
                                        <Progress value={mp.progressPercent} className="h-1.5 w-16 bg-secondary" />
                                        <span className="text-[10px] font-semibold text-muted-foreground w-8">{mp.progressPercent}%</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-3">
                                      <div className="flex flex-wrap gap-1.5">
                                        {mp.doneCount > 0 && (<Badge className="gap-1 border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700 shadow-none dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"><CheckCircle2 className="w-3 h-3" /> {mp.doneCount}</Badge>)}
                                        {mp.inProgressCount > 0 && (<Badge className="gap-1 border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 shadow-none dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"><Clock className="w-3 h-3" /> {mp.inProgressCount}</Badge>)}
                                        {mp.notDoneCount > 0 && (<Badge className="gap-1 border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground shadow-none"><XCircle className="w-3 h-3" /> {mp.notDoneCount}</Badge>)}
                                        {mp.blockedCount > 0 && (<Badge className="gap-1 border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700 shadow-none dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300"><AlertTriangle className="w-3 h-3" /> {mp.blockedCount}</Badge>)}
                                        {mp.failedCount > 0 && (<Badge className="gap-1 border-red-200 bg-red-50 px-2 py-0.5 text-[10px] text-red-700 shadow-none dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"><XCircle className="w-3 h-3" /> {mp.failedCount}</Badge>)}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                        </div>
                      </Collapse>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
    </>
  );
}
