'use client';

import { Profiler, createContext, useContext, useEffect, useMemo, useState, type ProfilerOnRenderCallback, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { UI_MOTION } from '@/lib/client/ui-motion';
import { createThemeTransitionGuard } from '@/lib/client/theme-transition';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const THEME_STORAGE_KEY = 'web-qa:theme';
const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let guardThemeTransition: (() => void) | undefined;
function applyTheme(theme: Theme) {
  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;
  if (document.documentElement.classList.contains('dark') !== (resolvedTheme === 'dark')) {
    guardThemeTransition ??= createThemeTransitionGuard(document.documentElement, callback => window.requestAnimationFrame(callback));
    guardThemeTransition();
  }
  document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  return resolvedTheme;
}

function AppThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      const nextTheme: Theme = savedTheme && ['light', 'dark', 'system'].includes(savedTheme) ? savedTheme : 'dark';
      setThemeState(nextTheme);
      setResolvedTheme(applyTheme(nextTheme));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (theme !== 'system') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setResolvedTheme(applyTheme('system'));
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    resolvedTheme,
    setTheme: (nextTheme) => {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      setThemeState(nextTheme);
      setResolvedTheme(applyTheme(nextTheme));
    },
  }), [theme, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme must be used within AppThemeProvider');
  return context;
}

export function Providers({ children }: { children: ReactNode }) {
  const content = process.env.NEXT_PUBLIC_QA_PERF_PROFILING === '1'
    ? <Profiler id="QADesk" onRender={recordPerformanceCommit}>{children}</Profiler>
    : children;
  return (
    <AppThemeProvider>
      <MotionConfig reducedMotion="user" transition={{ duration: UI_MOTION.content, ease: UI_MOTION.ease }}>
        {content}
      </MotionConfig>
    </AppThemeProvider>
  );
}

const recordPerformanceCommit: ProfilerOnRenderCallback = (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
  const target = window as typeof window & { __qaCommits?: unknown[] };
  const commits = target.__qaCommits ??= [];
  commits.push({ id, phase, actualDuration, baseDuration, startTime, commitTime });
  if (commits.length > 2000) commits.splice(0, commits.length - 2000);
};
