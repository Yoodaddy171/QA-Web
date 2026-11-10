'use client';

import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Layers,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { Collapse } from '@/components/ui/collapse';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { DashboardStats } from './DashboardPanel';

interface Module {
  id: string;
  name: string;
  projectId: string;
  _count?: { testCases: number };
}

interface DashboardModuleProgressProps {
  stats: DashboardStats;
  modules: Module[];
  selectedModuleFilter: string;
  setSelectedModuleFilter: (value: string) => void;
  expandedModules: Set<string>;
  setExpandedModules: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function DashboardModuleProgress({
  stats,
  modules,
  selectedModuleFilter,
  setSelectedModuleFilter,
  expandedModules,
  setExpandedModules,
}: DashboardModuleProgressProps) {
  if (stats.moduleProgress.length === 0) return null;

  const filteredModules =
    selectedModuleFilter === 'all'
      ? [...stats.moduleProgress, ...(stats.ungroupedProgress ? [stats.ungroupedProgress] : [])]
      : stats.moduleProgress.filter((m) => m.id === selectedModuleFilter);

  return (
    <Card padding="none" className="overflow-hidden rounded-2xl border-border/80 bg-card shadow-xs">
      <CardHeader className="border-b border-border/60 p-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold text-foreground">
              Progress per Modul
            </CardTitle>
          </div>

          <Select value={selectedModuleFilter} onValueChange={setSelectedModuleFilter}>
            <SelectTrigger className="h-8 w-full sm:w-48 text-xs bg-secondary/50 border-border/60">
              <SelectValue placeholder="Semua modul" />
            </SelectTrigger>
            <SelectContent className="rounded-xl bg-card border border-border shadow-lg">
              <SelectItem value="all" className="text-xs">
                Semua Modul ({modules.length})
              </SelectItem>
              {modules.map((m) => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        <div className="space-y-3">
          {filteredModules.map((mod) => {
            const modKey = mod.id || 'ungrouped';
            const isExpanded = expandedModules.has(modKey);
            const toggleExpand = () => {
              setExpandedModules((prev) => {
                const next = new Set(prev);
                if (next.has(modKey)) next.delete(modKey);
                else next.add(modKey);
                return next;
              });
            };

            return (
              <div
                key={modKey}
                className="overflow-hidden rounded-xl border border-border/70 bg-card/60 transition-all"
              >
                <button
                  type="button"
                  onClick={toggleExpand}
                  className="flex w-full items-center justify-between gap-4 p-3.5 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  aria-expanded={isExpanded}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Layers className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-foreground">
                        {mod.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground font-mono tabular-nums">
                        {mod.totalCases} cases · {mod.totalMenus} menu
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <SimpleTooltip content={<span className="font-mono text-xs">Rata-rata progres: {mod.avgProgress}% ({mod.totalCases} kasus)</span>}>
                      <div className="hidden sm:flex items-center gap-2 w-32 cursor-pointer">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary transition-all duration-300"
                            style={{ width: `${Math.min(mod.avgProgress, 100)}%` }}
                          />
                        </div>
                      </div>
                    </SimpleTooltip>

                    <span className="w-10 text-right font-mono text-xs font-bold tabular-nums text-foreground">
                      {mod.avgProgress}%
                    </span>

                    <div className="rounded-md p-1 hover:bg-secondary text-muted-foreground">
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>
                </button>

                <Collapse open={isExpanded}>
                  <div className="border-t border-border/50 bg-secondary/15 p-2 overflow-x-auto">
                    <Table className="min-w-[600px] text-xs">
                      <TableHeader>
                        <TableRow className="border-border/40 hover:bg-transparent">
                          <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                            Halaman
                          </TableHead>
                          <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                            Sub Menu
                          </TableHead>
                          <TableHead className="h-8 text-center text-[11px] font-semibold text-muted-foreground">
                            Cases
                          </TableHead>
                          <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                            Progress
                          </TableHead>
                          <TableHead className="h-8 text-[11px] font-semibold text-muted-foreground">
                            Distribusi Status
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mod.menus.map((mp, idx) => (
                          <TableRow key={idx} className="border-border/30 hover:bg-secondary/30">
                            <TableCell tooltip={mp.page} className="py-2.5 text-xs font-medium text-foreground">
                              {mp.page}
                            </TableCell>
                            <TableCell tooltip={mp.subMenu || undefined} className="py-2.5 text-xs text-muted-foreground">
                              {mp.subMenu || '-'}
                            </TableCell>
                            <TableCell className="py-2.5 text-center font-mono text-xs font-medium tabular-nums text-foreground">
                              {mp.totalCases}
                            </TableCell>
                            <TableCell tooltip={`Progres eksekusi: ${mp.progressPercent}%`} className="py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-secondary">
                                  <div
                                    className="h-full rounded-full bg-primary"
                                    style={{ width: `${Math.min(mp.progressPercent, 100)}%` }}
                                  />
                                </div>
                                <span className="font-mono text-[11px] font-medium tabular-nums text-muted-foreground">
                                  {mp.progressPercent}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell tooltip={`Selesai: ${mp.doneCount}; gagal: ${mp.failedCount}; blocked: ${mp.blockedCount}; berlangsung: ${mp.inProgressCount}; belum dijalankan: ${mp.notDoneCount}`} className="py-2.5">
                              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] tabular-nums">
                                {mp.doneCount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="gap-1 border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium px-1.5 py-0.5"
                                  >
                                    <CheckCircle2 className="h-3 w-3" /> {mp.doneCount}
                                  </Badge>
                                )}
                                {mp.failedCount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="gap-1 border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400 font-medium px-1.5 py-0.5"
                                  >
                                    <XCircle className="h-3 w-3" /> {mp.failedCount}
                                  </Badge>
                                )}
                                {mp.blockedCount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="gap-1 border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium px-1.5 py-0.5"
                                  >
                                    <AlertTriangle className="h-3 w-3" /> {mp.blockedCount}
                                  </Badge>
                                )}
                                {mp.inProgressCount > 0 && (
                                  <Badge
                                    variant="outline"
                                    className="gap-1 border-indigo-500/25 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium px-1.5 py-0.5"
                                  >
                                    <Clock className="h-3 w-3" /> {mp.inProgressCount}
                                  </Badge>
                                )}
                                {mp.notDoneCount > 0 && (
                                  <span className="text-muted-foreground/60 px-1">
                                    {mp.notDoneCount} backlog
                                  </span>
                                )}
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
  );
}
