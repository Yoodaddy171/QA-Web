'use client';

import { useRef, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';

export function DevlogFullscreenDialog({ open, onClose, onAfterClose, title, description, children }: {
  open: boolean;
  onClose: () => void;
  onAfterClose?: () => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const opener = useRef<HTMLElement | null>(null);

  return (
    <Dialog open={open} onOpenChange={next => { if (!next) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="devlog-fullscreen-overlay z-[75] backdrop-blur-none"
        className="devlog-fullscreen-dialog z-[80] m-0 flex max-h-none max-w-none items-stretch gap-0 overflow-hidden rounded-none border-0 bg-background p-0 text-foreground sm:max-w-none"
        style={{ inset: 0, transform: 'none', translate: 'none', width: '100vw', height: '100dvh' }}
        onOpenAutoFocus={() => {
          opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={event => {
          onAfterClose?.();
          if (opener.current?.isConnected) {
            event.preventDefault();
            opener.current.focus({ preventScroll: true });
          }
        }}
        onEscapeKeyDown={event => {
          event.preventDefault();
          if (!(event.target instanceof HTMLElement && event.target.hasAttribute('data-devlog-filter'))) onClose();
        }}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
