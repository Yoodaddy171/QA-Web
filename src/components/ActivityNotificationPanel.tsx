'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Bell,
  BellRing,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  Clock3,
  FileText,
  Filter,
  History,
  Info,
  Layers,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';
import {
  gsap,
  isMotionAllowed,
  useCardTilt3D,
  useGSAP,
  useMagneticHover,
} from '@/lib/client/gsap-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { NotificationItem } from '@/components/NotificationCenter';

interface ActivityRecord {
  id: string;
  projectId: string;
  entityType: string;
  entityId: string;
  action: string;
  field?: string | null;
  beforeValue?: unknown;
  afterValue?: unknown;
  actor?: string | null;
  actorUserId?: string | null;
  createdAt: string;
}

interface ActivitySummary {
  totalCount: number;
  todayCount: number;
  actors: string[];
  entityBreakdown: Record<string, number>;
}

interface ActivityNotificationPanelProps {
  projectId: string;
  onNavigate?: (tab: string) => void;
}

const SEVERITY_CONFIG = {
  critical: {
    label: 'Critical',
    icon: CircleAlert,
    badgeClass: 'border-rose-500/30 bg-rose-500/10 text-rose-500',
    iconWrapClass: 'border-rose-500/25 bg-rose-500/10 text-rose-500',
  },
  warning: {
    label: 'Warning',
    icon: Clock3,
    badgeClass: 'border-amber-500/30 bg-amber-500/10 text-amber-500',
    iconWrapClass: 'border-amber-500/25 bg-amber-500/10 text-amber-500',
  },
  success: {
    label: 'Success',
    icon: CircleCheck,
    badgeClass: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500',
    iconWrapClass: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500',
  },
  info: {
    label: 'Info',
    icon: Info,
    badgeClass: 'border-primary/30 bg-primary/10 text-primary',
    iconWrapClass: 'border-primary/25 bg-primary/10 text-primary',
  },
} as const;

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function formatRelativeTime(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
}

function formatJsonPreview(val: unknown): string {
  if (val === null || val === undefined) return '-';
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') {
    return String(val);
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    if (typeof obj.comment === 'string') return obj.comment;
    if (typeof obj.status === 'string') return obj.status;
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj.title === 'string') return obj.title;
    try {
      const compact = JSON.stringify(val);
      return compact.length > 90 ? `${compact.slice(0, 87)}...` : compact;
    } catch {
      return '[Object]';
    }
  }
  return String(val);
}

function actionBadgeClass(action: string) {
  const upper = action.toUpperCase();
  if (upper.includes('CREATE') || upper.includes('ADD')) {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400';
  }
  if (upper.includes('DELETE') || upper.includes('REVOKE')) {
    return 'border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400';
  }
  if (upper.includes('FINALIZE') || upper.includes('COMMENT')) {
    return 'border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400';
  }
  return 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400';
}

function CenterKpiCard({
  label,
  value,
  sublabel,
  icon: Icon,
  toneClass,
}: {
  label: string;
  value: number;
  sublabel: string;
  icon: React.ElementType;
  toneClass: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  useCardTilt3D(cardRef, { maxDeg: 4.5 });

  return (
    <div
      ref={cardRef}
      data-center-kpi
      className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:border-primary/35"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 font-mono text-2xl font-bold tracking-tight text-foreground tabular-nums">
            <AnimatedNumber value={value} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>
        </div>
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl border transition-transform duration-200 group-hover:scale-105',
            toneClass
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
    </div>
  );
}

export function ActivityNotificationPanel({
  projectId,
  onNavigate,
}: ActivityNotificationPanelProps) {
  const { toast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const refreshBtnRef = useRef<HTMLButtonElement>(null);
  useMagneticHover(refreshBtnRef, { strength: 0.25 });

  const [activeSubTab, setActiveSubTab] = useState<'notifications' | 'audit'>('notifications');

  // Notifications state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifLoading, setNotifLoading] = useState(true);
  const [notifSearch, setNotifSearch] = useState('');
  const [notifReadFilter, setNotifReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [notifSeverityFilter, setNotifSeverityFilter] = useState<string>('all');
  const [markingAll, setMarkingAll] = useState(false);

  // Activity Audit state
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [activitySummary, setActivitySummary] = useState<ActivitySummary>({
    totalCount: 0,
    todayCount: 0,
    actors: [],
    entityBreakdown: {},
  });
  const [auditLoading, setAuditLoading] = useState(true);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState<string>('all');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('all');
  const [auditActorFilter, setAuditActorFilter] = useState<string>('all');

  const loadNotifications = useCallback(async () => {
    if (!projectId) {
      setNotifications([]);
      setNotifLoading(false);
      return;
    }
    setNotifLoading(true);
    try {
      const res = await fetch(
        `/api/notifications?projectId=${encodeURIComponent(projectId)}&limit=100`,
        { cache: 'no-store' }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat notifikasi.');
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(Number(data.unreadCount) || 0);
    } catch (error) {
      toast({
        title: 'Gagal memuat notifikasi',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
        variant: 'destructive',
      });
    } finally {
      setNotifLoading(false);
    }
  }, [projectId, toast]);

  const loadAuditLog = useCallback(async () => {
    if (!projectId) {
      setActivities([]);
      setAuditLoading(false);
      return;
    }
    setAuditLoading(true);
    try {
      const params = new URLSearchParams({
        projectId,
        limit: '120',
      });
      if (auditEntityFilter !== 'all') params.set('entityType', auditEntityFilter);
      if (auditActionFilter !== 'all') params.set('action', auditActionFilter);
      if (auditActorFilter !== 'all') params.set('actor', auditActorFilter);
      if (auditSearch.trim()) params.set('search', auditSearch.trim());

      const res = await fetch(`/api/activity?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat audit log project.');
      setActivities(Array.isArray(data.activities) ? data.activities : []);
      if (data.summary) {
        setActivitySummary(data.summary);
      }
    } catch (error) {
      toast({
        title: 'Gagal memuat audit trail',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
        variant: 'destructive',
      });
    } finally {
      setAuditLoading(false);
    }
  }, [projectId, auditEntityFilter, auditActionFilter, auditActorFilter, auditSearch, toast]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAuditLog();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [loadAuditLog]);

  useGSAP(
    () => {
      if (!containerRef.current || !isMotionAllowed()) return;
      const kpis = containerRef.current.querySelectorAll('[data-center-kpi]');
      if (kpis.length) {
        gsap.fromTo(
          kpis,
          { y: 14, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.36,
            stagger: 0.06,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
          }
        );
      }
    },
    { dependencies: [projectId], scope: containerRef }
  );

  const filteredNotifications = useMemo(() => {
    const q = notifSearch.trim().toLowerCase();
    return notifications.filter((item) => {
      if (notifReadFilter === 'unread' && item.readAt) return false;
      if (notifReadFilter === 'read' && !item.readAt) return false;
      if (notifSeverityFilter !== 'all' && item.severity !== notifSeverityFilter) return false;
      if (q) {
        const hay = `${item.title} ${item.message} ${item.type} ${item.entityType || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notifications, notifSearch, notifReadFilter, notifSeverityFilter]);

  const markAllAsRead = async () => {
    if (!projectId || unreadCount === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      if (!res.ok) throw new Error('Gagal menandai semua notifikasi.');
      const nowIso = new Date().toISOString();
      setNotifications((prev) => prev.map((item) => ({ ...item, readAt: item.readAt || nowIso })));
      setUnreadCount(0);
      toast({
        variant: 'success',
        title: 'Semua notifikasi ditandai dibaca',
        description: 'Inbox notifikasi project telah diperbarui.',
      });
    } catch (error) {
      toast({
        title: 'Gagal memperbarui notifikasi',
        description: error instanceof Error ? error.message : 'Coba lagi.',
        variant: 'destructive',
      });
    } finally {
      setMarkingAll(false);
    }
  };

  const handleOpenNotification = async (item: NotificationItem) => {
    if (!item.readAt && projectId) {
      try {
        const res = await fetch(`/api/notifications/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, read: true }),
        });
        if (res.ok) {
          const nowIso = new Date().toISOString();
          setNotifications((prev) =>
            prev.map((n) => (n.id === item.id ? { ...n, readAt: nowIso } : n))
          );
          setUnreadCount((c) => Math.max(0, c - 1));
        }
      } catch {
        // Proceed with navigation even if read status fails
      }
    }
    const targetTab = item.metadata?.tab || (item.entityType === 'TestRun' ? 'testRuns' : 'testcases');
    const target = { entityType: item.entityType, entityId: item.entityId, ...item.metadata };
    window.localStorage.setItem(`qaDesk.navigationTarget.v1.${projectId}`, JSON.stringify(target));
    window.dispatchEvent(new CustomEvent('qa-desk:navigate-entity', { detail: target }));
    onNavigate?.(targetTab);
  };

  const handleJumpToEntity = (record: ActivityRecord) => {
    if (record.entityType === 'TestCase') {
      const target = { entityType: 'TestCase', entityId: record.entityId };
      window.dispatchEvent(new CustomEvent('qa-desk:navigate-entity', { detail: target }));
      onNavigate?.('testcases');
    } else if (record.entityType === 'BugFix') {
      onNavigate?.('bugfix');
    } else if (record.entityType === 'TestRun' || record.entityType === 'TestExecution') {
      onNavigate?.('testRuns');
    } else if (record.entityType === 'Report') {
      onNavigate?.('reports');
    } else if (record.entityType === 'Requirement' || record.entityType === 'TestPlan') {
      onNavigate?.('traceability');
    }
  };

  if (!projectId) {
    return (
      <div className="qa-module-page flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center">
        <Bell className="mb-3 size-10 text-muted-foreground/40" />
        <h2 className="text-base font-semibold">Pilih project terlebih dahulu</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pilih project aktif di sidebar untuk melihat inbox notifikasi dan riwayat audit aktivitas.
        </p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="qa-module-page flex flex-col gap-6" aria-label="Notification and Activity Center">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
              <BellRing className="size-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  Notification &amp; Activity Center
                </h2>
                <Badge variant="outline" className="border-primary/30 bg-primary/5 text-primary">
                  Real-time Audit Trail
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Pusat kendali seluruh notifikasi sistem, peringatan eksekusi gagal, serta jejak audit perubahan data QA pada project aktif.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              ref={refreshBtnRef}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void loadNotifications();
                void loadAuditLog();
              }}
              className="gap-1.5"
            >
              <RefreshCw className={cn('size-3.5', (notifLoading || auditLoading) && 'animate-spin')} />
              Muat Ulang
            </Button>
            {unreadCount > 0 && (
              <Button
                type="button"
                size="sm"
                onClick={() => void markAllAsRead()}
                disabled={markingAll}
                className="gap-1.5"
              >
                {markingAll ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
                Tandai Semua Dibaca ({unreadCount})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CenterKpiCard
          label="Total Notifikasi"
          value={notifications.length}
          sublabel="Notifikasi tercatat di project"
          icon={Bell}
          toneClass="border-primary/25 bg-primary/10 text-primary"
        />
        <CenterKpiCard
          label="Belum Dibaca"
          value={unreadCount}
          sublabel={unreadCount > 0 ? 'Membutuhkan perhatian Anda' : 'Semua sudah ditinjau'}
          icon={ShieldAlert}
          toneClass={
            unreadCount > 0
              ? 'border-rose-500/25 bg-rose-500/10 text-rose-500'
              : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500'
          }
        />
        <CenterKpiCard
          label="Total Audit Log"
          value={activitySummary.totalCount}
          sublabel="Perubahan terekam di project"
          icon={History}
          toneClass="border-violet-500/25 bg-violet-500/10 text-violet-500"
        />
        <CenterKpiCard
          label="Aktivitas Hari Ini"
          value={activitySummary.todayCount}
          sublabel={`${activitySummary.actors.length} kontributor aktif`}
          icon={Activity}
          toneClass="border-amber-500/25 bg-amber-500/10 text-amber-500"
        />
      </div>

      {/* Main Tabs: Notifications vs Audit Trail */}
      <Tabs
        value={activeSubTab}
        onValueChange={(v) => setActiveSubTab(v as 'notifications' | 'audit')}
        className="w-full"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="size-4" />
              <span>Inbox Notifikasi</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                  {unreadCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-2">
              <History className="size-4" />
              <span>Audit Trail Project</span>
              <Badge variant="outline" className="ml-1 h-5 px-1.5 font-mono text-[10px]">
                {activitySummary.totalCount}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* TAB 1: INBOX NOTIFIKASI */}
        <TabsContent value="notifications" className="mt-4">
          <Card variant="majestic">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Daftar Notifikasi Project</CardTitle>
                  <CardDescription className="text-xs">
                    Klik item notifikasi untuk menandai dibaca dan langsung melompat ke testcase atau test cycle terkait.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[220px] flex-1 sm:flex-initial">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={notifSearch}
                      onChange={(e) => setNotifSearch(e.target.value)}
                      placeholder="Cari judul atau pesan..."
                      className="h-9 pl-8 text-xs"
                    />
                  </div>
                  <Select
                    value={notifReadFilter}
                    onValueChange={(v) => setNotifReadFilter(v as 'all' | 'unread' | 'read')}
                  >
                    <SelectTrigger className="h-9 w-[145px] text-xs">
                      <SelectValue placeholder="Status baca" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Status</SelectItem>
                      <SelectItem value="unread">Belum Dibaca</SelectItem>
                      <SelectItem value="read">Sudah Dibaca</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={notifSeverityFilter} onValueChange={setNotifSeverityFilter}>
                    <SelectTrigger className="h-9 w-[145px] text-xs">
                      <SelectValue placeholder="Severity" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Severity</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {notifLoading ? (
                <div className="space-y-3 p-5">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <Bell className="mb-3 size-9 text-muted-foreground/35" />
                  <p className="text-sm font-semibold">Tidak ada notifikasi yang cocok</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ubah filter pencarian atau tunggu event eksekusi pengujian berikutnya.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {filteredNotifications.map((item) => {
                    const sev =
                      SEVERITY_CONFIG[item.severity as keyof typeof SEVERITY_CONFIG] ||
                      SEVERITY_CONFIG.info;
                    const SevIcon = sev.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => void handleOpenNotification(item)}
                        className={cn(
                          'group flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-secondary/50',
                          !item.readAt && 'bg-primary/[0.03]'
                        )}
                      >
                        <span
                          className={cn(
                            'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border',
                            sev.iconWrapClass
                          )}
                        >
                          <SevIcon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{item.title}</span>
                            <Badge variant="outline" className={cn('text-[10px]', sev.badgeClass)}>
                              {sev.label}
                            </Badge>
                            {item.entityType && (
                              <Badge variant="secondary" className="font-mono text-[10px]">
                                {item.entityType}
                              </Badge>
                            )}
                            {!item.readAt && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                                <span className="size-1.5 rounded-full bg-primary" />
                                Baru
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {item.message}
                          </p>
                          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground/75">
                            <span>{formatRelativeTime(item.createdAt)}</span>
                            <span>·</span>
                            <span>{formatDateTime(item.createdAt)}</span>
                          </div>
                        </div>
                        <ArrowRight className="mt-2 size-4 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: AUDIT TRAIL PROJECT */}
        <TabsContent value="audit" className="mt-4">
          <Card variant="majestic">
            <CardHeader className="border-b border-border/50 pb-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <CardTitle className="text-base font-bold">Audit Trail &amp; Riwayat Aktivitas</CardTitle>
                  <CardDescription className="text-xs">
                    Log kronologis pembuatan, perubahan field, eksekusi pengujian, dan finalisasi laporan di dalam project.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      placeholder="Cari ID, field, atau aktor..."
                      className="h-9 pl-8 text-xs"
                    />
                  </div>
                  <Select value={auditEntityFilter} onValueChange={setAuditEntityFilter}>
                    <SelectTrigger className="h-9 w-[150px] text-xs">
                      <SelectValue placeholder="Tipe Entitas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Entitas</SelectItem>
                      <SelectItem value="TestCase">TestCase</SelectItem>
                      <SelectItem value="BugFix">BugFix</SelectItem>
                      <SelectItem value="TestRun">TestRun</SelectItem>
                      <SelectItem value="TestExecution">TestExecution</SelectItem>
                      <SelectItem value="Report">Report</SelectItem>
                      <SelectItem value="Requirement">Requirement</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                    <SelectTrigger className="h-9 w-[140px] text-xs">
                      <SelectValue placeholder="Tindakan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Aksi</SelectItem>
                      <SelectItem value="CREATED">CREATED</SelectItem>
                      <SelectItem value="UPDATED">UPDATED</SelectItem>
                      <SelectItem value="DELETED">DELETED</SelectItem>
                      <SelectItem value="COMMENTED">COMMENTED</SelectItem>
                      <SelectItem value="FINALIZED">FINALIZED</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={auditActorFilter} onValueChange={setAuditActorFilter}>
                    <SelectTrigger className="h-9 w-[150px] text-xs">
                      <SelectValue placeholder="Semua Aktor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Aktor</SelectItem>
                      {activitySummary.actors.map((actorName) => (
                        <SelectItem key={actorName} value={actorName}>
                          {actorName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {auditLoading ? (
                <div className="space-y-3 p-5">
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                  <Skeleton className="h-16 w-full rounded-xl" />
                </div>
              ) : activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <History className="mb-3 size-9 text-muted-foreground/35" />
                  <p className="text-sm font-semibold">Belum ada aktivitas yang cocok</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Setiap perubahan testcase, eksekusi, bug, dan laporan akan tercatat secara otomatis di sini.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {activities.map((act) => {
                    const hasBefore = act.beforeValue !== null && act.beforeValue !== undefined;
                    const hasAfter = act.afterValue !== null && act.afterValue !== undefined;
                    return (
                      <div
                        key={act.id}
                        className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-secondary/40 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-start gap-3.5 min-w-0">
                          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/50 text-muted-foreground">
                            <Layers className="size-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={cn('text-[10px] font-bold', actionBadgeClass(act.action))}>
                                {act.action}
                              </Badge>
                              <Badge variant="secondary" className="font-mono text-[10px]">
                                {act.entityType}
                              </Badge>
                              {act.field && (
                                <span className="rounded-md border border-border/70 bg-background px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                                  field: {act.field}
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
                                <UserRound className="size-3 text-primary" />
                                {act.actor || 'System'}
                              </span>
                            </div>

                            {(hasBefore || hasAfter) && (
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                {hasBefore && (
                                  <span className="max-w-xs truncate rounded-md border border-rose-500/20 bg-rose-500/5 px-2 py-0.5 font-mono text-[11px] text-rose-600 dark:text-rose-400">
                                    {formatJsonPreview(act.beforeValue)}
                                  </span>
                                )}
                                {hasBefore && hasAfter && (
                                  <ArrowRight className="size-3.5 text-muted-foreground" />
                                )}
                                {hasAfter && (
                                  <span className="max-w-md truncate rounded-md border border-emerald-500/20 bg-emerald-500/5 px-2 py-0.5 font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                                    {formatJsonPreview(act.afterValue)}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                              <span className="font-mono">ID: {act.entityId.slice(0, 14)}</span>
                              <span>·</span>
                              <span>{formatRelativeTime(act.createdAt)}</span>
                              <span>·</span>
                              <span>{formatDateTime(act.createdAt)}</span>
                            </div>
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleJumpToEntity(act)}
                          className="shrink-0 self-start sm:self-center gap-1.5 text-xs"
                        >
                          <span>Buka Modul</span>
                          <ArrowRight className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
