'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BellRing, CheckCheck, CircleAlert, CircleCheck, Clock3, Info, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export type NotificationItem = {
  id: string;
  type: string;
  severity: 'info' | 'success' | 'warning' | 'critical' | string;
  title: string;
  message: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: { tab?: string; testRunId?: string; executionId?: string } | null;
  readAt?: string | null;
  createdAt: string;
};

type NotificationCenterProps = {
  projectId: string;
  onNavigate: (tab: string) => void;
};

const severityConfig = {
  critical: { icon: CircleAlert, className: 'border-red-500/25 bg-red-500/8 text-red-500' },
  warning: { icon: Clock3, className: 'border-amber-500/25 bg-amber-500/8 text-amber-500' },
  success: { icon: CircleCheck, className: 'border-emerald-500/25 bg-emerald-500/8 text-emerald-500' },
  info: { icon: Info, className: 'border-primary/25 bg-primary/8 text-primary' },
} as const;

function relativeTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

export function NotificationCenter({ projectId, onNavigate }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!projectId) return;
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`/api/notifications?projectId=${encodeURIComponent(projectId)}&limit=30`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat notifikasi.');
      setItems(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    const interval = window.setInterval(() => void load(true), 30_000);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); };
  }, [load]);

  const grouped = useMemo(() => {
    const now = new Date();
    return items.reduce<Record<string, NotificationItem[]>>((result, item) => {
      const date = new Date(item.createdAt);
      const label = date.toDateString() === now.toDateString() ? 'Hari ini' : 'Sebelumnya';
      (result[label] ||= []).push(item);
      return result;
    }, {});
  }, [items]);

  const markAllRead = async () => {
    if (!projectId || unreadCount === 0) return;
    const response = await fetch('/api/notifications/read-all', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId }),
    });
    if (response.ok) {
      const readAt = new Date().toISOString();
      setItems(current => current.map(item => ({ ...item, readAt: item.readAt || readAt })));
      setUnreadCount(0);
    }
  };

  const openItem = async (item: NotificationItem) => {
    if (!item.readAt) {
      setItems(current => current.map(candidate => candidate.id === item.id ? { ...candidate, readAt: new Date().toISOString() } : candidate));
      setUnreadCount(current => Math.max(0, current - 1));
      void fetch(`/api/notifications/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, read: true }),
      });
    }
    const tab = item.metadata?.tab || (item.entityType === 'TestRun' ? 'testRuns' : 'testcases');
    const target = { entityType: item.entityType, entityId: item.entityId, ...item.metadata };
    window.localStorage.setItem(`qaDesk.navigationTarget.v1.${projectId}`, JSON.stringify(target));
    window.dispatchEvent(new CustomEvent('qa-desk:navigate-entity', { detail: target }));
    onNavigate(tab);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={nextOpen => { setOpen(nextOpen); if (nextOpen) void load(true); }}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="relative size-9 rounded-lg border-border/70 bg-card shadow-none" aria-label={`Notifikasi${unreadCount ? `, ${unreadCount} belum dibaca` : ''}`}>
          {unreadCount ? <BellRing /> : <Bell />}
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 font-mono text-[9px] font-bold leading-4 text-white motion-safe:animate-in motion-safe:zoom-in-75">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={10} className="w-[min(390px,calc(100vw-1.5rem))] overflow-hidden p-0 shadow-xl">
        <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notification Center</p>
            <p className="text-[11px] text-muted-foreground">{unreadCount ? `${unreadCount} belum dibaca` : 'Semua sudah dibaca'}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void markAllRead()} disabled={!unreadCount}>
            <CheckCheck data-icon="inline-start" /> Tandai semua
          </Button>
        </div>
        <ScrollArea className="h-[min(520px,70vh)]">
          {loading && items.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground"><Loader2 className="animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center px-8 text-center">
              <Bell className="mb-3 text-muted-foreground/35" />
              <p className="text-sm font-semibold">Belum ada notifikasi</p>
              <p className="mt-1 text-xs text-muted-foreground">Update penting dari execution, import, dan evidence akan muncul di sini.</p>
            </div>
          ) : Object.entries(grouped).map(([label, notifications]) => (
            <section key={label} aria-label={label}>
              <p className="sticky top-0 border-b border-border/40 bg-popover/95 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur">{label}</p>
              {notifications.map(item => {
                const config = severityConfig[item.severity as keyof typeof severityConfig] || severityConfig.info;
                const Icon = config.icon;
                return (
                  <button key={item.id} type="button" onClick={() => void openItem(item)} className={cn('flex w-full gap-3 border-b border-border/40 px-4 py-3 text-left transition-colors duration-150 hover:bg-secondary/60 focus-visible:bg-secondary/60 focus-visible:outline-none', !item.readAt && 'bg-primary/[0.035]')}>
                    <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border', config.className)}><Icon className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3"><strong className="text-xs font-semibold text-foreground">{item.title}</strong>{!item.readAt && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />}</span>
                      <span className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted-foreground">{item.message}</span>
                      <span className="mt-1.5 block text-[10px] text-muted-foreground/70">{relativeTime(item.createdAt)}</span>
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
