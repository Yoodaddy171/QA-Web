'use client';

import { Bug, ClipboardList, FolderOpen, LayoutDashboard, MonitorDot, Settings2 } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ReactNode, useEffect, useMemo, useState } from 'react';
import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle } from '@/components/ThemeToggle';
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
import { cn } from '@/lib/utils';

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
    settings: ReactNode;
  };
}

const NAV_ITEMS = [
  { value: 'dashboard', label: 'Dashboard', description: 'Readiness overview', icon: LayoutDashboard },
  { value: 'testcases', label: 'Cases', description: 'Test inventory', icon: ClipboardList },
  { value: 'bugfix', label: 'Bugs', description: 'Defect lifecycle', icon: Bug },
  { value: 'automated', label: 'Runs', description: 'Execution records', icon: MonitorDot },
  { value: 'settings', label: 'Settings', description: 'Project knowledge', icon: Settings2 },
] as const;

function WorkspaceSidebar({
  projects,
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
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}>
                <SidebarTrigger className="h-8 w-8 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence initial={false}>
          {projects.length > 0 && expanded && (
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
            >
              <Select value={selectedProject} onValueChange={setSelectedProject}>
                <SelectTrigger className="h-10 w-full rounded-lg border-sidebar-border/80 bg-sidebar-accent/55 px-3 text-sm font-semibold text-sidebar-foreground shadow-none focus:ring-2 focus:ring-sidebar-ring/40">
                  <FolderOpen className="mr-2 h-4 w-4 shrink-0 text-sidebar-primary" />
                  <SelectValue placeholder="Select project" />
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
          )}
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
                        'data-[active=true]:text-sidebar-primary',
                        '[&>svg]:h-[18px] [&>svg]:w-[18px] [&>svg]:text-sidebar-foreground/55',
                        '[&>svg]:transition-transform [&>svg]:duration-200 hover:[&>svg]:scale-110 hover:[&>svg]:-rotate-6 motion-reduce:hover:[&>svg]:transform-none',
                        'data-[active=true]:[&>svg]:text-sidebar-primary'
                      )}
                    >
                      {active && (
                        <motion.span
                          layoutId="sidebar-active-pill"
                          transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 450, damping: 32 }}
                          className="absolute inset-0 rounded-lg border border-sidebar-primary/25 bg-sidebar-primary/10"
                        />
                      )}
                      <Icon className="relative" />
                      <span className="relative flex min-w-0 flex-col gap-0.5 leading-none transition-[max-width,opacity,transform] duration-300 ease-[cubic-bezier(0.2,0,0,1)] group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:translate-x-1 group-data-[collapsible=icon]:overflow-hidden group-data-[collapsible=icon]:opacity-0">
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
              transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
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
                transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
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
  selectedProject,
  activeTab,
  projectHealth,
  setSelectedProject,
  setActiveTab,
  children,
}: AppShellProps) {
  const [mounted, setMounted] = useState(false);
  const reduceMotion = useReducedMotion();
  const activeItem = useMemo(
    () => NAV_ITEMS.find((item) => item.value === activeTab) || NAV_ITEMS[0],
    [activeTab]
  );
  const ActiveIcon = activeItem.icon;

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-svh w-full bg-background" suppressHydrationWarning>
        <WorkspaceSidebar
          projects={projects}
          selectedProject={selectedProject}
          activeTab={activeTab}
          projectHealth={projectHealth}
          setSelectedProject={setSelectedProject}
          setActiveTab={setActiveTab}
        />

        <SidebarInset className="min-w-0 overflow-x-hidden bg-background">
          <header className="sticky top-0 z-40 flex min-h-16 items-center justify-between gap-4 border-b border-border bg-background px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger className="h-9 w-9 shrink-0 rounded-lg border border-border/60 bg-card text-muted-foreground shadow-sm hover:bg-secondary hover:text-foreground" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <ActiveIcon className="h-4 w-4 shrink-0 text-primary" />
                  <h1 className="truncate text-sm font-bold text-foreground sm:text-base">{activeItem.label}</h1>
                </div>
                <p className="hidden truncate text-[11px] font-medium text-muted-foreground sm:block">{activeItem.description}</p>
              </div>
            </div>
            {typeof projectHealth === 'number' && (
              <div className="hidden items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Readiness <span className="font-medium text-foreground tabular-nums">{projectHealth}%</span>
              </div>
            )}
          </header>

          <div className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <div className="mx-auto w-full max-w-[1600px]">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeTab}
                    initial={mounted && !reduceMotion ? { opacity: 0, y: 8 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
                    transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.2, 0, 0, 1] }}
                  >
                    <TabsContent value="dashboard" className="m-0">{activeTab === 'dashboard' ? children.dashboard : null}</TabsContent>
                    <TabsContent value="testcases" className="m-0">{activeTab === 'testcases' ? children.testcases : null}</TabsContent>
                    <TabsContent value="bugfix" className="m-0">{activeTab === 'bugfix' ? children.bugfix : null}</TabsContent>
                    <TabsContent value="automated" className="m-0">{activeTab === 'automated' ? children.automated : null}</TabsContent>
                    <TabsContent value="settings" className="m-0">{activeTab === 'settings' ? children.settings : null}</TabsContent>
                  </motion.div>
                </AnimatePresence>
              </Tabs>
            </div>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
