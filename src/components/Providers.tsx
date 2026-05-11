'use client';

import { ThemeProvider } from 'next-themes';
import { ReactLenis } from 'lenis/react';
import { type ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ReactLenis root>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange={false}>
        {children}
      </ThemeProvider>
    </ReactLenis>
  );
}
