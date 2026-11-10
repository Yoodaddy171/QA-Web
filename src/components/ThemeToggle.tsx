'use client';

import * as React from 'react';
import { Moon, Sun, Monitor } from 'lucide-react';
import { useAppTheme } from '@/components/Providers';
import { gsap, isMotionAllowed, useMagneticHover } from '@/lib/client/gsap-motion';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function ThemeToggle() {
  const { setTheme } = useAppTheme();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  useMagneticHover(triggerRef, { maxShift: 4 });

  const switchThemeWithPop = (next: 'light' | 'dark' | 'system') => {
    setTheme(next);
    if (triggerRef.current && isMotionAllowed()) {
      gsap.fromTo(
        triggerRef.current,
        { scale: 0.78, rotation: next === 'dark' ? -25 : 25 },
        { scale: 1, rotation: 0, duration: 0.42, ease: 'elastic.out(1.2, 0.4)', clearProps: 'scale,rotation' }
      );
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button ref={triggerRef} variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground">
          <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition duration-300 dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition duration-300 dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-2xl border-border/60 bg-card shadow-xl min-w-[140px]">
        <DropdownMenuItem onClick={() => switchThemeWithPop('light')} className="cursor-pointer gap-2.5 rounded-xl text-sm focus:bg-secondary">
          <Sun className="h-4 w-4 text-amber-500" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => switchThemeWithPop('dark')} className="cursor-pointer gap-2.5 rounded-xl text-sm focus:bg-secondary">
          <Moon className="h-4 w-4 text-status-in-progress" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => switchThemeWithPop('system')} className="cursor-pointer gap-2.5 rounded-xl text-sm focus:bg-secondary">
          <Monitor className="h-4 w-4 text-muted-foreground" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
