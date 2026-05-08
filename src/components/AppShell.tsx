'use client';

import { Bug, ClipboardList, FolderOpen, LayoutDashboard, MonitorDot, Settings2 } from 'lucide-react';
import { ReactNode } from 'react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { BrandMark } from '@/components/BrandMark';
import { ThemeToggle } from '@/components/ThemeToggle';
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
  { value: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { value: 'testcases', label: 'Cases', icon: ClipboardList },
  { value: 'bugfix', label: 'Bugs', icon: Bug },
  { value: 'automated', label: 'Runs', icon: MonitorDot },
  { value: 'settings', label: 'Settings', icon: Settings2 },
] as const;

export function AppShell({
  projects,
  selectedProject,
  activeTab,
  projectHealth,
  setSelectedProject,
  setActiveTab,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background" suppressHydrationWarning>
      {/* ===== HEADER - Material Design Surface with elevation ===== */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-lg elevation-2 border-b border-border/30">
        <div className="mx-auto flex min-w-0 max-w-[1440px] flex-wrap items-center justify-between gap-3 px-5 py-3 sm:flex-nowrap sm:px-8">
          {/* Left: Brand + Project Selector */}
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <BrandMark compact />

            {projects.length > 0 && (
              <>
                <div className="h-5 w-px bg-border/60" />
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="h-9 min-w-0 max-w-[45vw] rounded-xl border-0 bg-secondary/60 px-3 text-sm font-medium text-foreground shadow-none hover:bg-secondary focus:ring-1 focus:ring-primary/30 sm:w-[200px] sm:max-w-none">
                    <FolderOpen className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-border/60 bg-card elevation-3">
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id} className="cursor-pointer rounded-xl text-sm">
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          {/* Center: Navigation Pills - Material Design 3 style */}
          <nav className="order-3 flex w-full min-w-0 items-center justify-center gap-0.5 rounded-2xl bg-secondary/50 p-1 sm:order-none sm:w-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.value;
              return (
                <button
                  key={item.value}
                  onClick={() => setActiveTab(item.value)}
                  className={cn(
                    'relative flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium transition-all duration-200 sm:text-sm md:px-4',
                    isActive
                      ? 'bg-primary text-primary-foreground elevation-1'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden md:inline">{item.label}</span>
                  {isActive && (
                    <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-primary-foreground/50 md:hidden" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: Theme Toggle */}
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <main className="mx-auto min-w-0 max-w-[1440px] overflow-x-hidden px-5 py-6 sm:px-8 sm:py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="dashboard" className="m-0">{activeTab === 'dashboard' ? children.dashboard : null}</TabsContent>
          <TabsContent value="testcases" className="m-0">{activeTab === 'testcases' ? children.testcases : null}</TabsContent>
          <TabsContent value="bugfix" className="m-0">{activeTab === 'bugfix' ? children.bugfix : null}</TabsContent>
          <TabsContent value="automated" className="m-0">{activeTab === 'automated' ? children.automated : null}</TabsContent>
          <TabsContent value="settings" className="m-0">{activeTab === 'settings' ? children.settings : null}</TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
