'use client';

import { ArrowRight, Bug, ClipboardList, Command, FileText, FolderOpen, GitBranch, LayoutDashboard, ListChecks, MonitorDot, Plus, Search, Settings2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationCenter } from '@/components/NotificationCenter';
import { AccountMenu } from '@/components/AccountMenu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface Project {
  id: string;
  name: string;
  description?: string;
  automationContext?: string;
  createdAt: string;
  _count?: { testCases: number; modules: number };
}

interface AppShellProps {
  projects: Project[];
  projectsLoading?: boolean;
  selectedProject: string;
  activeTab: string;
  projectHealth?: number | null;
  setSelectedProject: (value: string) => void;
  setActiveTab: (value: string) => void;
  children: {
    dashboard: ReactNode;
    testcases: ReactNode;
    bugfix: ReactNode;
    automated: ReactNode;
    testRuns: ReactNode;
    traceability: ReactNode;
    reports: ReactNode;
    settings: ReactNode;
  };
}

const NAV_ITEMS = [
  { value: 'dashboard', label: 'Dashboard', description: 'Readiness overview', icon: LayoutDashboard },
  { value: 'testcases', label: 'Cases', description: 'Test inventory', icon: ClipboardList },
  { value: 'bugfix', label: 'Bugs', description: 'Defect lifecycle', icon: Bug },
  { value: 'automated', label: 'Automation Logs', description: 'Automation records', icon: MonitorDot },
  { value: 'testRuns', label: 'Test Cycles', description: 'QA execution cycles', icon: ListChecks },
  { value: 'traceability', label: 'Traceability', description: 'Requirements & plans', icon: GitBranch },
  { value: 'reports', label: 'Reports', description: 'Test reports', icon: FileText },
  { value: 'settings', label: 'Settings', description: 'Configuration & readiness', icon: Settings2 },
] as const;

function WorkspaceCommandPalette({ open, onOpenChange, setActiveTab }: { open: boolean; onOpenChange: (open: boolean) => void; setActiveTab: (value: string) => void }) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = NAV_ITEMS.filter(item => `${item.label} ${item.description}`.toLowerCase().includes(normalizedQuery));

  const navigate = (value: string, focusSearch = false) => {
    setActiveTab(value);
    onOpenChange(false);
    setQuery('');
    if (focusSearch) window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-search-input]')?.focus(), 120);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { onOpenChange(nextOpen); if (!nextOpen) setQuery(''); }}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="sr-only"><DialogTitle>Command palette</DialogTitle><DialogDescription>Cari menu atau aksi cepat.</DialogDescription></DialogHeader>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <Input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari menu atau aksi..." className="h-14 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0" />
          <kbd className="rounded border border-border bg-secondary px-2 py-1 font-mono text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-2">
          <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Navigasi</p>
          <div className="flex flex-col gap-1">
            {filteredItems.map(item => {
              const Icon = item.icon;
              return (
                <button key={item.value} type="button" onClick={() => navigate(item.value)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none">
                  <span className="flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground group-hover:text-primary"><Icon className="size-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="block truncate text-xs text-muted-foreground">{item.description}</span></span>
                  <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              );
            })}
            {!normalizedQuery || 'search test cases'.includes(normalizedQuery) ? (
              <button type="button" onClick={() => navigate('testcases', true)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none">
                <span className="flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground group-hover:text-primary"><Search className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Cari testcase</span><span className="block truncate text-xs text-muted-foreground">Buka Cases dan fokus ke pencarian</span></span>
              </button>
            ) : null}
            {!normalizedQuery || 'add create new testcase'.includes(normalizedQuery) ? (
              <button type="button" onClick={() => { navigate('testcases'); window.setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' })), 140); }} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none">
                <span className="flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground group-hover:text-primary"><Plus className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Buat testcase</span><span className="block truncate text-xs text-muted-foreground">Mulai testcase baru dari mana saja</span></span>
              </button>
            ) : null}
            {filteredItems.length === 0 && normalizedQuery && !'search test cases add create new testcase'.includes(normalizedQuery) ? <p className="px-3 py-8 text-center text-sm text-muted-foreground">Tidak ada menu atau aksi yang cocok.</p> : null}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border bg-secondary/25 px-4 py-2 text-[10px] text-muted-foreground"><span>Gunakan pencarian untuk berpindah cepat</span><span className="flex items-center gap-1"><Command className="size-3" /> K</span></div>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceSidebar({
  projects,
  projectsLoading,
  selectedProject,
  projectHealth,
  activeTab,
  setSelectedProject,
  setActiveTab,
}: Omit<AppShellProps, 'children'>) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const expanded = state === 'expanded' || isMobile;
  const reduceMotion = useReducedMotion();

  const selectTab = (value: string) => {
    setActiveTab(value);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border/80 bg-sidebar">
      <SidebarHeader className="gap-4 border-b border-sidebar-border/70 px-3 py-4">
        <motion.div layout className={cn('flex min-h-10 items-center', expanded ? 'justify-between' : 'justify-center')}>
          <BrandMark compact={!expanded} />
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}>
                <SidebarTrigger className="h-8 w-8 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence initial={false}>
          {projectsLoading && expanded ? <Skeleton className="h-10 w-full rounded-lg" aria-label="Memuat project" /> : projects.length > 0 && expanded ? (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="h-10 w-full rounded-lg border-sidebar-border/80 bg-sidebar-accent/55 px-3 text-sm font-semibold text-sidebar-foreground shadow-none focus:ring-2 focus:ring-sidebar-ring/40">
                  <FolderOpen className="mr-2 h-4 w-4 shrink-0 text-sidebar-primary" />
                  <SelectValue placeholder="Pilih project" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border/70 bg-popover shadow-xl">
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id} className="rounded-lg text-sm font-medium">
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-2 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/45">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.value;
                return (
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton
                      type="button"
                      size="lg"
                      isActive={active}
                      tooltip={item.label}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => selectTab(item.value)}
                      className={cn(
                        'relative h-12 rounded-lg border border-transparent px-3 transition-colors duration-200',
                        'hover:bg-sidebar-accent/70',
                        'group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0!',
                        'data-[active=true]:bg-sidebar-accent/70 data-[active=true]:text-sidebar-primary',
                        '[&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:text-sidebar-foreground/55',
                        '[&>svg]:transition-colors [&>svg]:duration-150',
                        'data-[active=true]:[&>svg]:text-sidebar-primary'
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="sidebar-active-pill"
                          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 32 }}
                          className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-sidebar-primary"
                        />
                      )}
                      <Icon className="relative" />
                      <span className="relative flex min-w-0 flex-col gap-0.5 leading-none transition-[max-width,opacity,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:translate-x-1 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:opacity-0">
                        <span className="truncate text-[13px] font-bold">{item.label}</span>
                        <span className="truncate text-[10px] font-medium text-sidebar-foreground/45">
                          {item.description}
                        </span>
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="gap-3 border-t border-sidebar-border/70 p-3">
        <AnimatePresence initial={false}>
          {expanded && typeof projectHealth === 'number' && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-lg border border-sidebar-border/70 bg-sidebar-accent/45 p-3"
            >
              <div className="flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/55">
                <span>Project readiness</span>
                <span className="font-mono text-sidebar-primary">{projectHealth}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sidebar-border/70">
                <div
                  className="h-full rounded-full bg-sidebar-primary transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${Math.max(0, Math.min(projectHealth, 100))}%` }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div className={cn('flex items-center', expanded ? 'justify-between' : 'justify-center')}>
          <AnimatePresence initial={false}>
            {expanded && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/45"
              >
                Appearance
              </motion.span>
            )}
          </AnimatePresence>
          <ThemeToggle />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

export function AppShell({
  projects,
  projectsLoading,
  selectedProject,
  activeTab,
  projectHealth,
  setSelectedProject,
  setActiveTab,
  children,
}: AppShellProps) {
  const [mounted, setMounted] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const activeItem = useMemo(
    () => NAV_ITEMS.find((item) => item.value === activeTab) || NAV_ITEMS[0],
    [activeTab]
  );
  const ActiveIcon = activeItem.icon;
  const selectedProjectName = projects.find(project => project.id === selectedProject)?.name || 'Workspace';

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const navigate = (event: Event) => {
      const tab = (event as CustomEvent<string>).detail;
      if (NAV_ITEMS.some(item => item.value === tab)) setActiveTab(tab);
    };
    window.addEventListener('qa-desk:set-tab', navigate);
    return () => window.removeEventListener('qa-desk:set-tab', navigate);
  }, [setActiveTab]);

  useEffect(() => {
    const handleCommandShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(current => !current);
      }
    };
    window.addEventListener('keydown', handleCommandShortcut);
    return () => window.removeEventListener('keydown', handleCommandShortcut);
  }, []);

  return (
    <SidebarProvider defaultOpen>
      <div className="command-canvas flex min-h-svh w-full bg-background" suppressHydrationWarning>
        <WorkspaceSidebar
          projects={projects}
          projectsLoading={projectsLoading}
          selectedProject={selectedProject}
          activeTab={activeTab}
          projectHealth={projectHealth}
          setSelectedProject={setSelectedProject}
          setActiveTab={setActiveTab}
        />

        <SidebarInset className="min-w-0 overflow-x-hidden bg-background">
          <header className="sticky top-0 z-40 grid min-h-16 grid-cols-[1fr_auto] items-center gap-4 border-b border-border/70 bg-background/95 px-4 backdrop-blur-md sm:px-6 lg:px-8 xl:grid-cols-[1fr_minmax(280px,420px)_1fr]">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="h-9 w-9 shrink-0 rounded-lg border border-border/60 bg-card text-muted-foreground shadow-sm hover:bg-secondary hover:text-foreground" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ActiveIcon className="h-4 w-4 shrink-0 text-primary" />
                  <h1 className="truncate text-sm font-bold text-foreground sm:text-base">{activeItem.label}</h1>
                </div>
                <p className="hidden truncate text-[11px] font-medium text-muted-foreground sm:block"><span>{selectedProjectName}</span><span className="px-1.5 text-border">/</span><span>{activeItem.description}</span></p>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => setCommandOpen(true)} className="hidden h-9 justify-between rounded-lg border-border/70 bg-card px-3 text-muted-foreground shadow-none xl:flex">
              <span className="flex items-center gap-2"><Search className="size-4" />Cari atau pindah menu...</span>
              <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[9px]">Ctrl K</kbd>
            </Button>
            <div className="flex items-center justify-self-end gap-2">
              <Button type="button" variant="outline" size="icon" onClick={() => setCommandOpen(true)} aria-label="Buka command palette" className="size-9 rounded-lg border-border/70 bg-card shadow-none xl:hidden"><Search /></Button>
              {typeof projectHealth === 'number' && (
                <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground sm:flex">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Readiness <span className="font-medium text-foreground tabular-nums">{projectHealth}%</span>
                </div>
              )}
              <NotificationCenter projectId={selectedProject} onNavigate={setActiveTab} />
              <AccountMenu />
            </div>
          </header>

          <WorkspaceCommandPalette open={commandOpen} onOpenChange={setCommandOpen} setActiveTab={setActiveTab} />

          <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-[1600px]">
              {projectsLoading ? (
                <div className="flex flex-col gap-4" aria-label="Memuat workspace">
                  <Skeleton className="h-32 w-full rounded-xl" />
                  <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-36 rounded-xl" /><Skeleton className="h-36 rounded-xl" /><Skeleton className="h-36 rounded-xl" /></div>
                  <Skeleton className="h-72 w-full rounded-xl" />
                </div>
              ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeTab}
                    initial={mounted && !reduceMotion ? { opacity: 0, y: 8 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
                    transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <TabsContent value="dashboard" className="m-0">{activeTab === 'dashboard' ? children.dashboard : null}</TabsContent>
                    <TabsContent value="testcases" className="m-0">{activeTab === 'testcases' ? children.testcases : null}</TabsContent>
                    <TabsContent value="bugfix" className="m-0">{activeTab === 'bugfix' ? children.bugfix : null}</TabsContent>
                    <TabsContent value="automated" className="m-0">{activeTab === 'automated' ? children.automated : null}</TabsContent>
                    <TabsContent value="testRuns" className="m-0">{activeTab === 'testRuns' ? children.testRuns : null}</TabsContent>
                    <TabsContent value="traceability" className="m-0">{activeTab === 'traceability' ? children.traceability : null}</TabsContent>
                    <TabsContent value="reports" className="m-0">{activeTab === 'reports' ? children.reports : null}</TabsContent>
                    <TabsContent value="settings" className="m-0">{activeTab === 'settings' ? children.settings : null}</TabsContent>
                  </motion.div>
                </AnimatePresence>
              </Tabs>
              )}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
