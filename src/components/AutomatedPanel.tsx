'use client';

import type React from 'react';
import { Bot, CalendarClock, Eye, FileClock, MonitorDot, RefreshCw, Search, TerminalSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Module {
  id: string;
  name: string;
  projectId: string;
  _count?: { testCases: number };
}

interface Project {
  id: string;
  name: string;
  description?: string;
  automationContext?: string;
  createdAt: string;
  _count?: { testCases: number; modules: number };
}

export interface AutomatedTestCase {
  id: string;
  testCaseId: string;
  page: string;
  subMenu?: string | null;
  weight?: string | null;
  calculatedWeight?: number | null;
  testType: string;
  testAction: string;
  steps: string;
  expectedResult: string;
  actualResult?: string | null;
  stepLogs?: string | null;
  status: string;
  progress: number;
  remarks?: string | null;
  priority: string;
  projectId: string;
  moduleId?: string | null;
  project?: Project;
  module?: Module;
  createdAt: string;
  updatedAt: string;
  automationSource?: 'testcase' | 'bugfix';
  sourceTestCaseId?: string;
  automation: {
    hasCurrent: boolean;
    hasPrevious: boolean;
    hasLegacy: boolean;
    hasAutomationRun: boolean;
    hasManualCapture: boolean;
    totalBytes: number;
    lastRunAt: string | null;
    files: Array<{
      kind: 'current' | 'previous' | 'legacy';
      name: string;
      size: number;
      updatedAt: string;
    }>;
  };
}

interface AutomatedPanelProps {
  selectedProject: string;
  modules: Module[];
  items: AutomatedTestCase[];
  search: string;
  filterModule: string;
  loading: boolean;
  setSearch: (value: string) => void;
  setFilterModule: (value: string) => void;
  onRefresh: () => void;
  onOpenDetail: (testCase: AutomatedTestCase) => void;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusBadgeVariant: (status: string) => 'success' | 'failed' | 'warning' | 'info' | 'notdone' | 'inprogress' | 'blocked' | 'readyretest' | 'verifiedfixed' | 'tba' | 'outline';
  getPriorityColor: (priority: string) => string;
  getTestTypeColor: (type: string) => string;
}

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export function AutomatedPanel({
  selectedProject,
  modules,
  items,
  search,
  filterModule,
  loading,
  setSearch,
  setFilterModule,
  onRefresh,
  onOpenDetail,
  getStatusColor,
  getStatusIcon,
  getStatusBadgeVariant,
  getPriorityColor,
  getTestTypeColor,
}: AutomatedPanelProps) {
  const moduleIdsWithRuns = new Set(items.map(item => item.moduleId).filter(Boolean));
  const availableModules = modules.filter(module => moduleIdsWithRuns.has(module.id) || module.id === filterModule);
  const hasUnassignedRuns = items.some((item) => !item.moduleId);
  const filteredItems = items.filter((item) => {
    if (filterModule !== 'all') {
      const moduleKey = item.moduleId || 'unassigned';
      if (moduleKey !== filterModule) return false;
    }

    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return [
      item.testCaseId,
      item.page,
      item.subMenu || '',
      item.testAction,
      item.module?.name || '',
      item.status,
    ].some((value) => value.toLowerCase().includes(keyword));
  });
  const showingLabel = filteredItems.length !== items.length
    ? `Showing ${filteredItems.length} of ${items.length} data`
    : `Showing ${filteredItems.length} data`;

  if (!selectedProject) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border/60 bg-secondary/30 backdrop-blur-sm">
        <div className="text-center">
          <Bot className="mx-auto mb-2 h-9 w-9 text-muted-foreground opacity-20" />
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Project Selection Required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4 overflow-x-hidden">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card variant="majestic" padding="none" className="border-teal-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-teal-500/10 p-2.5 text-teal-400">
              <MonitorDot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{filteredItems.length}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-teal-500/70">Vault Scenarios</p>
            </div>
          </CardContent>
        </Card>
        <Card variant="majestic" padding="none" className="border-sky-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-sky-500/10 p-2.5 text-sky-400">
              <FileClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">
                {filteredItems.filter((item) => item.automation.hasManualCapture).length}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-sky-500/70">Manual Artifacts</p>
            </div>
          </CardContent>
        </Card>
        <Card variant="majestic" padding="none" className="border-amber-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-400">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-foreground uppercase">
                {filteredItems[0]?.automation.lastRunAt ? new Date(filteredItems[0].automation.lastRunAt).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No Activity'}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/70">Latest Run</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-secondary/30 p-3 shadow-xl backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search test intelligence..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 rounded-md border-border/60 bg-secondary/30 pl-9 shadow-inner text-foreground placeholder:text-muted-foreground focus-visible:ring-teal-500/50"
            />
          </div>
          <Select value={filterModule} onValueChange={setFilterModule}>
            <SelectTrigger className="h-9 w-full rounded-md border-border/60 bg-secondary/30 text-sm text-foreground shadow-sm sm:w-[190px]">
              <SelectValue placeholder="Module" />
            </SelectTrigger>
            <SelectContent className="border-border/60 bg-card text-foreground elevation-3">
              <SelectItem value="all">Semua Module</SelectItem>
              {availableModules.map((module) => (
                <SelectItem key={module.id} value={module.id}>{module.name}</SelectItem>
              ))}
              {(hasUnassignedRuns || filterModule === 'unassigned') && (
                <SelectItem value="unassigned">Tanpa Module</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="h-9 justify-center rounded-md border-border/60 bg-muted px-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            {showingLabel}
          </Badge>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading} className="h-9 rounded-md gap-2 font-bold border-border/60 bg-secondary/30 text-foreground">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Synchronize
          </Button>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center space-y-2 rounded-xl border border-dashed border-border/60 bg-secondary/30 py-20 backdrop-blur-sm">
          <TerminalSquare className="h-12 w-12 text-muted-foreground opacity-20" />
          <p className="text-sm font-bold uppercase tracking-tight text-muted-foreground">
            {items.length === 0 ? 'No Intelligence Records' : 'No Matching Results'}
          </p>
          <p className="max-w-md text-center text-[11px] font-medium text-muted-foreground">
            Automated scenarios will populate here once execution logs are captured by the DevLog Engine.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40 elevation-2 backdrop-blur-md">
            <div className="overflow-hidden">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                   <TableRow className="border-border/60 bg-secondary/30 hover:bg-secondary/30">
                    <TableHead className="w-[52px] text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground">No</TableHead>
                    <TableHead className="w-[90px] text-[10px] font-black uppercase tracking-widest text-muted-foreground">TC ID</TableHead>
                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Page</TableHead>
                    <TableHead className="hidden text-[10px] font-black uppercase tracking-widest text-muted-foreground lg:table-cell">Module</TableHead>
                    <TableHead className="hidden text-[10px] font-black uppercase tracking-widest text-muted-foreground md:table-cell">Test Action</TableHead>
                    <TableHead className="hidden w-[86px] text-[10px] font-black uppercase tracking-widest text-muted-foreground xl:table-cell">Tipe</TableHead>
                    <TableHead className="hidden w-[94px] text-[10px] font-black uppercase tracking-widest text-muted-foreground sm:table-cell">Priority</TableHead>
                    <TableHead className="w-[112px] text-[10px] font-black uppercase tracking-widest text-muted-foreground">Status</TableHead>
                    <TableHead className="hidden text-[10px] font-black uppercase tracking-widest text-muted-foreground xl:table-cell">Last Run</TableHead>
                    <TableHead className="hidden text-[10px] font-black uppercase tracking-widest text-muted-foreground lg:table-cell">Source</TableHead>
                    <TableHead className="hidden text-[10px] font-black uppercase tracking-widest text-muted-foreground lg:table-cell">History</TableHead>
                    <TableHead className="w-[80px] text-[10px] font-black uppercase tracking-widest text-muted-foreground">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.map((item, index) => (
                    <TableRow key={item.id} className="border-border/60 hover:bg-secondary/30 transition-colors group">
                      <TableCell className="text-center font-mono text-xs font-bold text-muted-foreground">{index + 1}</TableCell>
                      <TableCell className="font-mono text-sm font-black text-foreground">{item.testCaseId}</TableCell>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-foreground">{item.page}</p>
                            {item.automationSource === 'bugfix' && (
                              <Badge variant="warning" className="text-[9px] font-black border-orange-500/20 bg-orange-500/10">
                                BUGFIX
                              </Badge>
                            )}
                          </div>
                          {item.subMenu && <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-tight">{item.subMenu}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-[13px] font-medium text-muted-foreground lg:table-cell">{item.module?.name || '-'}</TableCell>
                      <TableCell className="hidden max-w-[260px] truncate text-sm text-muted-foreground group-hover:text-foreground transition-colors md:table-cell">{item.testAction}</TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <Badge variant="outline" className={`rounded-md text-[10px] font-bold border-border/60 bg-secondary/30 ${item.testType === 'Negative' ? 'text-rose-400' : 'text-sky-400'}`}>
                          {item.testType}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant={item.priority === 'Critical' ? 'failed' : item.priority === 'High' ? 'warning' : 'outline'} className="text-[10px] font-bold">
                          {item.priority}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(item.status)} className="gap-1 text-[10px] font-black">
                          {getStatusIcon(item.status)} {item.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden text-[11px] font-bold text-muted-foreground uppercase tracking-tighter xl:table-cell">{formatDate(item.automation.lastRunAt)}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {item.automation.hasAutomationRun && <Badge className="rounded-md bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-[9px] font-black uppercase">Auto</Badge>}
                          {item.automation.hasManualCapture && <Badge className="rounded-md bg-teal-500/10 text-teal-400 border-teal-500/20 text-[9px] font-black uppercase">Manual</Badge>}
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {item.automation.hasCurrent && <Badge variant="success" className="text-[9px] font-black uppercase tracking-tighter">Latest</Badge>}
                          {(item.automation.hasPrevious || item.automation.hasLegacy) && <Badge variant="info" className="text-[9px] font-black uppercase tracking-tighter">History</Badge>}
                          <Badge variant="outline" className="rounded-md border-border/60 bg-secondary/30 text-[9px] font-mono text-muted-foreground">
                            {formatSize(item.automation.totalBytes)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 rounded-md p-0 text-muted-foreground hover:text-foreground hover:bg-secondary"
                          onClick={() => onOpenDetail(item)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
        </div>
      )}
    </div>
  );
}
