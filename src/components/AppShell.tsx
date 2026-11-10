'use client';

import { ArrowRight, Check, ChevronsUpDown, Command, FolderOpen, HelpCircle, Plus, Search, UserRound, X } from 'lucide-react';
import { KeyboardShortcutsDialog } from '@/components/KeyboardShortcutsDialog';
import {
  DashboardIcon,
  TestCasesIcon,
  DefectIcon,
  AutomationIcon,
  TestCyclesIcon,
  TraceabilityIcon,
  ReportsIcon,
  WorkspaceSettingsIcon,
  CopilotIcon,
} from '@/components/icons/qa-icons';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { gsap, useGSAP, isMotionAllowed, useMagneticHover } from '@/lib/client/gsap-motion';
import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationCenter } from '@/components/NotificationCenter';
import { AccountMenu } from '@/components/AccountMenu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SimpleTooltip } from '@/components/ui/tooltip';
import { Kbd } from '@/components/ui/kbd';
import { UI_MOTION, contentTransition } from '@/lib/client/ui-motion';
import { useWorkspaceAccess } from '@/components/WorkspaceAccess';
import { guestTabPermission } from '@/lib/domain/guest-access';
import { FEATURES } from '@/lib/features';

function useAllowedTabs() {
  const { guest } = useWorkspaceAccess();
  return NAV_ITEMS.filter(item => !guest || Boolean(guestTabPermission(item.value) && guest.permissions.includes(guestTabPermission(item.value)!)));
}

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
  onCreateProject?: () => void;
  children: {
    dashboard: ReactNode;
    testcases: ReactNode;
    bugfix: ReactNode;
    automated: ReactNode;
    testRuns: ReactNode;
    traceability: ReactNode;
    reports: ReactNode;
    settings: ReactNode;
    profile?: ReactNode;
  };
}

const NAV_ITEMS = [
  { value: 'dashboard', label: 'Dashboard', description: 'Readiness overview', icon: DashboardIcon },
  { value: 'testcases', label: 'Cases', description: 'Test inventory', icon: TestCasesIcon },
  { value: 'bugfix', label: 'Bugs', description: 'Defect lifecycle', icon: DefectIcon },
  { value: 'automated', label: 'Automation Logs', description: 'Automation records', icon: AutomationIcon },
  { value: 'testRuns', label: 'Test Cycles', description: 'QA execution cycles', icon: TestCyclesIcon },
  { value: 'traceability', label: 'Traceability', description: 'Requirements & plans', icon: TraceabilityIcon },
  { value: 'reports', label: 'Reports', description: 'Test reports', icon: ReportsIcon },
  { value: 'settings', label: 'Settings', description: 'Configuration & readiness', icon: WorkspaceSettingsIcon },
] as const;

function WorkspaceCommandPalette({
  open,
  onOpenChange,
  setActiveTab,
  onOpenShortcuts,
  projects,
  selectedProject,
  setSelectedProject,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setActiveTab: (value: string) => void;
  onOpenShortcuts?: () => void;
  projects?: Project[];
  selectedProject?: string;
  setSelectedProject?: (id: string) => void;
}) {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const { canEdit, guest } = useWorkspaceAccess();
  const allowed = useAllowedTabs();
  const filteredItems = allowed.filter(item => `${item.label} ${item.description}`.toLowerCase().includes(normalizedQuery));

  const filteredProjects = useMemo(() => {
    if (!projects?.length) return [];
    if (!normalizedQuery) return projects;
    return projects.filter(
      p =>
        p.name.toLowerCase().includes(normalizedQuery) ||
        (p.description && p.description.toLowerCase().includes(normalizedQuery)) ||
        'ganti switch project proyek'.includes(normalizedQuery)
    );
  }, [projects, normalizedQuery]);

  const navigate = (value: string, focusSearch = false) => {
    setActiveTab(value);
    onOpenChange(false);
    setQuery('');
    if (focusSearch) window.setTimeout(() => document.querySelector<HTMLInputElement>('[data-search-input]')?.focus(), 120);
  };

  const switchProject = (projectId: string) => {
    setSelectedProject?.(projectId);
    onOpenChange(false);
    setQuery('');
  };

  const cmdListRef = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!open || !cmdListRef.current || !isMotionAllowed()) return;
      const items = cmdListRef.current.querySelectorAll('[data-cmd-item]');
      if (!items.length) return;
      gsap.fromTo(
        items,
        { x: -10, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.22, stagger: 0.02, ease: 'power3.out', clearProps: 'x,opacity' }
      );
    },
    { dependencies: [open], scope: cmdListRef }
  );

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { onOpenChange(nextOpen); if (!nextOpen) setQuery(''); }}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="sr-only"><DialogTitle>Command palette</DialogTitle><DialogDescription>Cari menu atau aksi cepat.</DialogDescription></DialogHeader>
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 text-muted-foreground" />
          <Input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Cari menu, aksi, atau project..." className="h-14 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0" />
          <Kbd size="sm">ESC</Kbd>
        </div>
        <div ref={cmdListRef} className="max-h-[420px] overflow-y-auto p-2">
          {filteredItems.length > 0 && (
            <>
              <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Navigasi</p>
              <div className="flex flex-col gap-1">
                {filteredItems.map(item => {
                  const Icon = item.icon;
                  return (
                    <button data-cmd-item key={item.value} type="button" onClick={() => navigate(item.value)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none">
                      <span className="flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-transform duration-150 group-hover:scale-105 group-hover:text-primary"><Icon className="size-4" /></span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{item.label}</span><span className="block truncate text-xs text-muted-foreground">{item.description}</span></span>
                      <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
                    </button>
                  );
                })}
                {(!guest || guest.permissions.includes('cases.view')) && (!normalizedQuery || 'search test cases'.includes(normalizedQuery)) ? (
                  <button type="button" onClick={() => navigate('testcases', true)} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none">
                    <span className="flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground group-hover:text-primary"><Search className="size-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Cari testcase</span><span className="block truncate text-xs text-muted-foreground">Buka Cases dan fokus ke pencarian</span></span>
                  </button>
                ) : null}
                {canEdit && (!normalizedQuery || 'add create new testcase'.includes(normalizedQuery)) ? (
                  <button type="button" onClick={() => { navigate('testcases'); window.setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' })), 140); }} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none">
                    <span className="flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground group-hover:text-primary"><Plus className="size-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Buat testcase</span><span className="block truncate text-xs text-muted-foreground">Mulai testcase baru dari mana saja</span></span>
                  </button>
                ) : null}
                {(!normalizedQuery || 'profile akun user password sesi keamanan'.includes(normalizedQuery)) ? (
                  <button data-cmd-item type="button" onClick={() => navigate('profile')} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none">
                    <span className="flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground group-hover:text-primary"><UserRound className="size-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Profile User</span><span className="block truncate text-xs text-muted-foreground">Kelola identitas akun, password, dan sesi aktif</span></span>
                    <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-all duration-150 group-hover:translate-x-0.5 group-hover:opacity-100" />
                  </button>
                ) : null}
                {(!normalizedQuery || 'keyboard shortcut panduan bantuan tombol'.includes(normalizedQuery)) ? (
                  <button type="button" onClick={() => { onOpenChange(false); onOpenShortcuts?.(); }} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none">
                    <span className="flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground group-hover:text-primary"><HelpCircle className="size-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Panduan Pintasan Keyboard</span><span className="block truncate text-xs text-muted-foreground">Lihat daftar tombol pintas desktop</span></span>
                    <Kbd size="sm">?</Kbd>
                  </button>
                ) : null}
              </div>
            </>
          )}

          {filteredProjects.length > 0 && (
            <div className="mt-3 border-t border-border/50 pt-2">
              <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Ganti Project
              </p>
              <div className="flex flex-col gap-1">
                {filteredProjects.map((p) => {
                  const isCurrent = p.id === selectedProject;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => switchProject(p.id)}
                      className="group flex items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
                    >
                      <span className="flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground group-hover:text-primary">
                        <FolderOpen className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <span className="truncate">{p.name}</span>
                          {isCurrent && (
                            <Badge variant="outline" className="text-[10px] py-0 h-4 border-primary/30 text-primary">
                              Aktif
                            </Badge>
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p._count?.testCases ?? 0} cases · {p._count?.modules ?? 0} modul
                        </span>
                      </span>
                      {isCurrent ? (
                        <Check className="size-4 text-primary" />
                      ) : (
                        <ArrowRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {filteredItems.length === 0 && filteredProjects.length === 0 && normalizedQuery && !'search test cases add create new testcase'.includes(normalizedQuery) ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">Tidak ada menu, aksi, atau project yang cocok.</p>
          ) : null}
        </div>
        <div className="flex items-center justify-between border-t border-border bg-secondary/25 px-4 py-2 text-xs text-muted-foreground"><span>Gunakan pencarian untuk berpindah cepat</span><span className="flex items-center gap-1"><Command className="size-3" /> K</span></div>
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
  onCreateProject,
}: Omit<AppShellProps, 'children'>) {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const allowedTabs = useAllowedTabs();
  const expanded = state === 'expanded' || isMobile;
  const reduceMotion = useReducedMotion();
  const [projectPopoverOpen, setProjectPopoverOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');

  const selectedProjectName = useMemo(() => {
    return projects.find(p => p.id === selectedProject)?.name || '';
  }, [projects, selectedProject]);

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter(
      p => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q))
    );
  }, [projects, projectSearch]);

  const selectTab = (value: string) => {
    setActiveTab(value);
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border/80 bg-sidebar">
      <SidebarHeader className="gap-3 border-b border-sidebar-border/70 px-3 py-4 overflow-hidden">
        <div className="flex min-h-10 items-center justify-between overflow-hidden">
          <BrandMark compact={!expanded} />
          <div
            className={cn(
              'overflow-hidden transition-all duration-300 ease-[var(--motion-ease)] shrink-0',
              expanded ? 'max-w-8 opacity-100 scale-100' : 'max-w-0 opacity-0 scale-75 pointer-events-none'
            )}
          >
            <SidebarTrigger className="h-8 w-8 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
          </div>
        </div>

        <div className="relative min-h-10">
          {projectsLoading && expanded ? (
            <Skeleton className="h-10 w-full rounded-lg" aria-label="Memuat project" />
          ) : projects.length > 0 ? (
            <>
              {/* Expanded Project Switcher Popover */}
              <div
                className={cn(
                  'overflow-hidden transition-all duration-300 ease-[var(--motion-ease)]',
                  expanded ? 'max-h-10 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
                )}
              >
                <Popover open={projectPopoverOpen} onOpenChange={setProjectPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      role="combobox"
                      aria-expanded={projectPopoverOpen}
                      aria-label="Pilih project"
                      className="flex h-10 w-full items-center justify-between rounded-lg border border-sidebar-border/80 bg-sidebar-accent/55 px-3 text-sm font-semibold text-sidebar-foreground shadow-none hover:bg-sidebar-accent/80 focus:outline-none focus:ring-2 focus:ring-sidebar-ring/40 transition-colors"
                    >
                      <span className="flex items-center min-w-0 gap-2">
                        <FolderOpen className="h-4 w-4 shrink-0 text-sidebar-primary" />
                        <span className="truncate">{selectedProjectName || 'Pilih project'}</span>
                      </span>
                      <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground/50" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-[280px] p-0 rounded-xl border border-border/70 bg-popover shadow-xl">
                    <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
                      <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <input
                        type="text"
                        value={projectSearch}
                        onChange={(e) => setProjectSearch(e.target.value)}
                        placeholder="Cari project..."
                        className="h-7 w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/60 outline-none"
                        autoFocus
                      />
                      {projectSearch && (
                        <button
                          type="button"
                          onClick={() => setProjectSearch('')}
                          className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                          aria-label="Bersihkan pencarian"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="max-h-60 overflow-y-auto p-1.5">
                      {filteredProjects.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          Tidak ada project ditemukan
                        </div>
                      ) : (
                        filteredProjects.map((project) => {
                          const isSelected = project.id === selectedProject;
                          return (
                            <button
                              key={project.id}
                              type="button"
                              onClick={() => {
                                setSelectedProject(project.id);
                                setProjectPopoverOpen(false);
                                setProjectSearch('');
                              }}
                              className={cn(
                                'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                                isSelected
                                  ? 'bg-primary/10 text-primary font-semibold'
                                  : 'text-foreground hover:bg-secondary/70'
                              )}
                            >
                              <div className="min-w-0 flex-1 pr-2">
                                <div className="truncate font-medium">{project.name}</div>
                                <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                                  <span>{project._count?.testCases ?? 0} cases</span>
                                  <span>•</span>
                                  <span>{project._count?.modules ?? 0} modul</span>
                                </div>
                              </div>
                              {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                            </button>
                          );
                        })
                      )}
                    </div>
                    {onCreateProject && (
                      <div className="border-t border-border/60 p-1.5 bg-secondary/15">
                        <button
                          type="button"
                          onClick={() => {
                            setProjectPopoverOpen(false);
                            onCreateProject();
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/10 transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Buat Project Baru</span>
                        </button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>

              {/* Collapsed Icon */}
              <div
                className={cn(
                  'flex justify-center transition-all duration-300 ease-[var(--motion-ease)]',
                  !expanded ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none absolute inset-0'
                )}
              >
                <SimpleTooltip content={selectedProjectName ? `Project: ${selectedProjectName}` : 'Pilih project'}>
                  <div className="flex size-9 items-center justify-center rounded-lg border border-sidebar-border/70 bg-sidebar-accent/55 text-sidebar-primary shadow-xs">
                    <FolderOpen className="size-4" />
                  </div>
                </SimpleTooltip>
              </div>
            </>
          ) : null}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup className="p-0">
          <SidebarGroupLabel className="px-2 text-xs font-bold uppercase tracking-[0.16em] text-sidebar-foreground/45">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {allowedTabs.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.value;
                return (
                  <SidebarMenuItem key={item.value}>
                    <SidebarMenuButton
                      type="button"
                      size="default"
                      isActive={active}
                      tooltip={item.label}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => selectTab(item.value)}
                      className={cn(
                        'group/btn relative h-9 w-full rounded-md border border-transparent px-2.5 gap-2.5 transition-all duration-200 active:scale-[0.98]',
                        'hover:bg-sidebar-accent/50',
                        'group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0!',
                        'data-[active=true]:text-sidebar-primary',
                        '[&>svg]:h-4 [&>svg]:w-4 [&>svg]:text-sidebar-foreground/55',
                        '[&>svg]:transition-colors [&>svg]:duration-150',
                        'data-[active=true]:[&>svg]:text-sidebar-primary'
                      )}
                    >
                      {active && (
                        <motion.div
                          layoutId="sidebar-active-pill"
                          className="absolute inset-0 rounded-md bg-sidebar-accent/80 border border-sidebar-border/50 pointer-events-none z-0"
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        />
                      )}
                      {active && (
                        <motion.span
                          layoutId="sidebar-active-strip"
                          className={cn(
                            'pointer-events-none absolute inset-y-2 left-0.5 w-1 rounded-full bg-sidebar-primary z-20',
                            expanded ? 'block' : 'hidden'
                          )}
                          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                        />
                      )}
                      <Icon className="relative z-10 size-4 shrink-0 transition-transform duration-200 ease-out group-hover/btn:scale-110 group-hover/btn:translate-x-0.5" />
                      <span className="relative z-10 flex min-w-0 flex-1 truncate text-[13px] font-medium data-[active=true]:font-semibold leading-none transition-all duration-300 ease-[var(--motion-ease)] group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:-translate-x-2 group-data-[collapsible=icon]:opacity-0">
                        {item.label}
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70 p-3">
        <div className={cn('flex items-center transition-all duration-300', expanded ? 'justify-between' : 'justify-center')}>
          <div
            className={cn(
              'overflow-hidden transition-all duration-300 ease-[var(--motion-ease)]',
              expanded ? 'max-w-[8rem] opacity-100' : 'max-w-0 opacity-0 pointer-events-none'
            )}
          >
            <span className="text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/45 whitespace-nowrap">
              Appearance
            </span>
          </div>
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
  onCreateProject,
  children,
}: AppShellProps) {
  const [mounted, setMounted] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { guest, ready, canEdit } = useWorkspaceAccess();
  const allowedTabs = useAllowedTabs();
  const tabAllowed = activeTab === 'profile' || allowedTabs.some(item => item.value === activeTab);
  const firstAllowed = allowedTabs[0]?.value;
  useEffect(() => {
    if (!ready || tabAllowed || !firstAllowed) return;
    const timer = window.setTimeout(() => setActiveTab(firstAllowed), 0);
    return () => window.clearTimeout(timer);
  }, [ready, tabAllowed, firstAllowed, setActiveTab]);
  const reduceMotion = useReducedMotion();
  const activeItem = useMemo(
    () =>
      activeTab === 'profile'
        ? { value: 'profile', label: 'User Profile', description: 'Account identity, security & workspace sessions', icon: UserRound }
        : NAV_ITEMS.find((item) => item.value === activeTab) || NAV_ITEMS[0],
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
      if (tab === 'profile' || (NAV_ITEMS.some(item => item.value === tab) && (!guest || Boolean(guestTabPermission(tab) && guest.permissions.includes(guestTabPermission(tab)!))))) setActiveTab(tab);
    };
    window.addEventListener('qa-desk:set-tab', navigate);
    return () => window.removeEventListener('qa-desk:set-tab', navigate);
  }, [setActiveTab, guest]);

  useEffect(() => {
    const handleCommandShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(current => !current);
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if (event.key === '?' && !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        setShortcutsOpen(prev => !prev);
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
          onCreateProject={onCreateProject}
        />

        <SidebarInset className="min-w-0 overflow-x-hidden bg-background">
          <header className="sticky top-0 z-40 grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background px-4 sm:px-6 lg:px-8 xl:grid-cols-[1fr_minmax(280px,420px)_1fr]">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="h-8 w-8 shrink-0 rounded-lg border border-border/60 bg-card text-muted-foreground shadow-sm hover:bg-secondary hover:text-foreground" />
              <div className="flex min-w-0 items-center overflow-hidden">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeTab}
                    initial={!reduceMotion ? { opacity: 0, y: 5 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={!reduceMotion ? { opacity: 0, y: -5 } : undefined}
                    transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                    className="flex min-w-0 items-center gap-2"
                  >
                    <ActiveIcon className="h-4 w-4 shrink-0 text-primary" />
                    <div className="flex min-w-0 items-center gap-1.5 truncate">
                      <span className="text-sm font-medium text-muted-foreground">{selectedProjectName}</span>
                      <span className="text-muted-foreground/40">/</span>
                      <h1 className="text-sm font-semibold text-foreground">{activeItem.label}</h1>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            <Button type="button" variant="outline" onClick={() => setCommandOpen(true)} className="hidden h-9 justify-between rounded-lg border-border/70 bg-card px-3 text-muted-foreground shadow-none xl:flex">
              <span className="flex items-center gap-2"><Search className="size-4" />Cari atau pindah menu...</span>
              <Kbd size="sm">Ctrl K</Kbd>
            </Button>
            <div className="flex items-center justify-self-end gap-2">
              <Button type="button" variant="outline" size="icon" onClick={() => setCommandOpen(true)} aria-label="Buka command palette" className="size-9 rounded-lg border-border/70 bg-card shadow-none xl:hidden"><Search /></Button>
              {typeof projectHealth === 'number' && (
                <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground sm:flex">
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      projectHealth >= 80
                        ? 'bg-emerald-500'
                        : projectHealth >= 50
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                    )}
                  />
                  Readiness <span className="font-medium text-foreground tabular-nums">{projectHealth}%</span>
                </div>
              )}
              {canEdit && FEATURES.aiTestcaseFlows && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => window.dispatchEvent(new CustomEvent('qa-desk:toggle-copilot'))}
                  aria-label="Open QA AI chat"
                  className="h-8 gap-1.5 rounded-md border-border/70 bg-card px-2.5 text-xs font-medium text-foreground shadow-none hover:bg-secondary"
                >
                  <CopilotIcon className="size-3.5 text-primary" />
                  <span className="hidden sm:inline">Copilot</span>
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShortcutsOpen(true)}
                title="Pintasan Keyboard (?)"
                aria-label="Pintasan Keyboard"
                className="size-8 text-muted-foreground hover:text-foreground hidden sm:inline-flex"
              >
                <HelpCircle className="size-4" />
              </Button>
              <NotificationCenter projectId={selectedProject} onNavigate={setActiveTab} />
              <AccountMenu onOpenProfile={() => setActiveTab('profile')} />
            </div>
          </header>

          <WorkspaceCommandPalette
            open={commandOpen}
            onOpenChange={setCommandOpen}
            setActiveTab={setActiveTab}
            onOpenShortcuts={() => setShortcutsOpen(true)}
            projects={projects}
            selectedProject={selectedProject}
            setSelectedProject={setSelectedProject}
          />
          <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
          {guest && <div role="status" className="border-b border-border bg-secondary px-4 py-3 text-sm text-muted-foreground sm:px-6 lg:px-8">Akses tamu · {guest.permissions.includes('execution.run') ? 'Tester' : 'Reviewer'} · berakhir {new Date(guest.expiresAt).toLocaleString('id-ID')}. Hanya project dan tindakan yang diberikan admin yang tersedia.</div>}

          <div className="flex min-w-0 flex-1 flex-col px-4 py-4 sm:px-6 sm:py-5 lg:px-8 lg:py-6">
            <div className="flex w-full flex-1 flex-col">
              {projectsLoading || !ready || !tabAllowed ? (
                <div className="flex flex-col gap-4" aria-label="Memuat workspace">
                  <Skeleton className="h-32 w-full rounded-xl" />
                  <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-36 rounded-xl" /><Skeleton className="h-36 rounded-xl" /><Skeleton className="h-36 rounded-xl" /></div>
                  <Skeleton className="h-72 w-full rounded-xl" />
                </div>
              ) : (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={activeTab}
                  initial={!reduceMotion ? { opacity: 0, y: 6 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  exit={!reduceMotion ? { opacity: 0, y: -6 } : undefined}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-1 flex-col min-w-0"
                >
                  {children[activeTab as keyof typeof children]}
                </motion.div>
              </AnimatePresence>
              )}
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
