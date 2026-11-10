'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Laptop,
  Loader2,
  LogOut,
  Mail,
  RefreshCw,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCheck,
  UserRound,
} from 'lucide-react';
import { AnimatedNumber } from '@/components/ui/animated-number';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  fireParticleCelebration,
  gsap,
  isMotionAllowed,
  playVerdictStamp,
  scrambleDecodeText,
  useCardTilt3D,
  useGSAP,
} from '@/lib/client/gsap-motion';
import { cn } from '@/lib/utils';

export interface UserProfileData {
  id: string;
  name: string;
  email: string;
  isGuest: boolean;
  guestExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  memberships: Array<{
    id: string;
    role: string;
    createdAt: string;
    workspace: {
      id: string;
      name: string;
      slug: string;
      projectCount: number;
    };
  }>;
  sessions: Array<{
    id: string;
    createdAt: string;
    lastSeenAt: string;
    expiresAt: string;
    isCurrent: boolean;
  }>;
  stats: {
    totalActivities: number;
    totalExecutions: number;
    workspaceCount: number;
    activeSessionCount: number;
  };
  recentActivities: Array<{
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    createdAt: string;
    projectName: string;
  }>;
}

interface UserProfilePanelProps {
  onNavigate?: (tab: string) => void;
}

function ProfileKpiCard({
  label,
  value,
  subtext,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  subtext: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  useCardTilt3D(cardRef, { maxDeg: 4 });

  return (
    <div
      ref={cardRef}
      data-profile-kpi
      className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-colors duration-200 hover:border-primary/40"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-150 group-hover:scale-105',
            tone
          )}
        >
          <Icon className="size-4" />
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <AnimatedNumber
          value={value}
          className="font-mono text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums"
        />
        <span className="truncate text-[11px] text-muted-foreground">{subtext}</span>
      </div>
    </div>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function evaluatePasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: 'Belum diisi', color: 'bg-muted' };
  let score = 0;
  if (pw.length >= 12) score += 2;
  else if (pw.length >= 8) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw)) score += 1;
  if (/[^A-Za-z0-9]/.test(pw)) score += 1;

  if (pw.length < 12) {
    return { score: Math.min(score, 2), label: 'Kurang dari 12 karakter', color: 'bg-rose-500' };
  }
  if (score <= 3) return { score: 3, label: 'Cukup Kuat', color: 'bg-amber-500' };
  if (score === 4) return { score: 4, label: 'Kuat', color: 'bg-emerald-500' };
  return { score: 5, label: 'Sangat Kuat', color: 'bg-emerald-500' };
}

export function UserProfilePanel({ onNavigate }: UserProfilePanelProps) {
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit profile form state
  const [displayName, setDisplayName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Change password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [revokingSessions, setRevokingSessions] = useState(false);

  const pageRef = useRef<HTMLDivElement>(null);
  const profileFormCardRef = useRef<HTMLDivElement>(null);
  const passwordFormCardRef = useRef<HTMLDivElement>(null);
  const roleBadgeRef = useRef<HTMLSpanElement>(null);
  const idCodeRef = useRef<HTMLSpanElement>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/profile', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.profile) {
        throw new Error(data.error || 'Gagal memuat profil pengguna.');
      }
      setProfile(data.profile);
      setDisplayName(data.profile.name || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat profil pengguna.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useGSAP(
    () => {
      if (!pageRef.current || !profile || !isMotionAllowed()) return;
      const sections = pageRef.current.querySelectorAll('[data-profile-section]');
      if (sections.length) {
        gsap.fromTo(
          sections,
          { y: 16, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.4,
            stagger: 0.06,
            ease: 'power3.out',
            clearProps: 'y,opacity',
          }
        );
      }
      const kpis = pageRef.current.querySelectorAll('[data-profile-kpi]');
      if (kpis.length) {
        gsap.fromTo(
          kpis,
          { y: 14, opacity: 0, scale: 0.96 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 0.42,
            stagger: 0.05,
            ease: 'back.out(1.5)',
            clearProps: 'y,opacity,scale',
          }
        );
      }
      const primaryRole = profile.memberships[0]?.role || (profile.isGuest ? 'GUEST' : 'MEMBER');
      if (roleBadgeRef.current) {
        scrambleDecodeText(roleBadgeRef.current, primaryRole, { duration: 0.42 });
      }
    },
    { dependencies: [profile?.id], scope: pageRef }
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || profile.isGuest) return;
    const trimmed = displayName.trim();
    if (trimmed.length < 2) {
      if (profileFormCardRef.current) {
        playVerdictStamp(profileFormCardRef.current, { verdict: 'FAILED' });
      }
      toast({
        variant: 'destructive',
        title: 'Nama terlalu pendek',
        description: 'Nama tampilan minimal 2 karakter.',
      });
      return;
    }

    setSavingProfile(true);
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-profile', name: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal menyimpan profil.');
      }
      setProfile((prev) => (prev ? { ...prev, name: trimmed, updatedAt: new Date().toISOString() } : prev));
      window.dispatchEvent(new CustomEvent('qa-desk:profile-updated', { detail: { name: trimmed } }));
      if (profileFormCardRef.current) {
        fireParticleCelebration(profileFormCardRef.current, {
          particleCount: 24,
          colors: ['#10B981', '#06B6D4', '#6366F1'],
        });
      }
      toast({
        variant: 'success',
        title: 'Profil Diperbarui',
        description: 'Nama tampilan Anda berhasil disimpan.',
      });
    } catch (err) {
      if (profileFormCardRef.current) {
        playVerdictStamp(profileFormCardRef.current, { verdict: 'FAILED' });
      }
      toast({
        variant: 'destructive',
        title: 'Gagal menyimpan profil',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || profile.isGuest) return;

    if (newPassword.length < 12) {
      if (passwordFormCardRef.current) {
        playVerdictStamp(passwordFormCardRef.current, { verdict: 'FAILED' });
      }
      toast({
        variant: 'destructive',
        title: 'Password belum memenuhi syarat',
        description: 'Password baru minimal 12 karakter.',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      if (passwordFormCardRef.current) {
        playVerdictStamp(passwordFormCardRef.current, { verdict: 'FAILED' });
      }
      toast({
        variant: 'destructive',
        title: 'Konfirmasi tidak cocok',
        description: 'Konfirmasi password baru harus sama persis.',
      });
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change-password',
          currentPassword,
          newPassword,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal memperbarui password.');
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (passwordFormCardRef.current) {
        fireParticleCelebration(passwordFormCardRef.current, {
          particleCount: 28,
          colors: ['#10B981', '#34D399', '#06B6D4', '#F59E0B'],
        });
      }
      toast({
        variant: 'success',
        title: 'Password Diperbarui',
        description: data.message || 'Password berhasil diperbarui.',
      });
      void loadProfile();
    } catch (err) {
      if (passwordFormCardRef.current) {
        playVerdictStamp(passwordFormCardRef.current, { verdict: 'FAILED' });
      }
      toast({
        variant: 'destructive',
        title: 'Gagal mengubah password',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRevokeOtherSessions = async () => {
    if (!profile || profile.isGuest) return;
    setRevokingSessions(true);
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke-other-sessions' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal mencabut sesi.');
      }
      toast({
        variant: 'success',
        title: 'Sesi Diperbarui',
        description: data.message,
      });
      void loadProfile();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Gagal mencabut sesi',
        description: err instanceof Error ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setRevokingSessions(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.replace('/login');
  };

  const copyUserId = async () => {
    if (!profile) return;
    try {
      await navigator.clipboard.writeText(profile.id);
      toast({
        variant: 'success',
        title: 'ID Pengguna Disalin',
        description: 'User ID berhasil disalin ke clipboard.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Gagal menyalin',
        description: 'Silakan salin ID secara manual.',
      });
    }
  };

  if (loading && !profile) {
    return (
      <div className="qa-module-page flex flex-col gap-5" aria-label="Memuat profil pengguna">
        <Skeleton className="h-36 w-full rounded-2xl" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
          <Skeleton className="h-28 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Skeleton className="h-96 rounded-2xl lg:col-span-7" />
          <Skeleton className="h-96 rounded-2xl lg:col-span-5" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="qa-module-page flex flex-col items-center justify-center gap-4 rounded-2xl border border-border bg-card p-10 text-center">
        <p className="text-sm font-medium text-destructive">{error || 'Profil tidak dapat dimuat.'}</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadProfile()}>
            <RefreshCw className="mr-1.5 size-3.5" /> Coba Lagi
          </Button>
          {onNavigate && (
            <Button variant="ghost" size="sm" onClick={() => onNavigate('dashboard')}>
              Kembali ke Dashboard
            </Button>
          )}
        </div>
      </div>
    );
  }

  const primaryRole = profile.memberships[0]?.role || (profile.isGuest ? 'GUEST' : 'MEMBER');
  const pwStrength = evaluatePasswordStrength(newPassword);
  const otherSessionsCount = Math.max(0, profile.sessions.length - 1);

  return (
    <div ref={pageRef} className="qa-module-page flex flex-col gap-6">
      {/* Top Hero Banner */}
      <div
        data-profile-section
        className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-5 sm:p-6 shadow-xs"
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start sm:items-center gap-4">
            {/* Avatar Badge */}
            <div className="relative flex size-16 sm:size-20 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-xl sm:text-2xl font-extrabold tracking-tight text-primary shadow-xs">
              {getInitials(profile.name)}
              <span
                className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-card bg-emerald-500 text-white"
                title="Sesi aktif"
              >
                <CheckCircle2 className="size-3" />
              </span>
            </div>

            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                  {profile.name}
                </h2>
                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-mono text-xs font-bold">
                  <span ref={roleBadgeRef}>{primaryRole}</span>
                </Badge>
                {profile.isGuest && (
                  <Badge variant="warning" className="text-xs">
                    Akses Tamu Sementara
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="size-3.5 text-primary/80" />
                  {profile.email}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-primary/80" />
                  Bergabung {new Date(profile.createdAt).toLocaleDateString('id-ID', { dateStyle: 'long' })}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => void copyUserId()}
                  onMouseEnter={() => scrambleDecodeText(idCodeRef.current, profile.id.slice(0, 14), { duration: 0.3 })}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-secondary/50 px-2 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  title="Klik untuk menyalin User ID"
                >
                  <span>ID:</span>
                  <span ref={idCodeRef}>{profile.id.slice(0, 14)}</span>
                  <Copy className="size-3 opacity-70" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
            {onNavigate && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNavigate('dashboard')}
                className="gap-1.5 text-xs"
              >
                <ArrowLeft className="size-3.5" /> Dashboard
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void loadProfile()}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} /> Segarkan
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => void handleLogout()}
              className="gap-1.5 text-xs"
            >
              <LogOut className="size-3.5" /> Keluar
            </Button>
          </div>
        </div>
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ProfileKpiCard
          label="Total Aktivitas QA"
          value={profile.stats.totalActivities}
          subtext="mutasi & aksi terekam"
          icon={Activity}
          tone="bg-primary/10 text-primary"
        />
        <ProfileKpiCard
          label="Eksekusi Pengujian"
          value={profile.stats.totalExecutions}
          subtext="skenario dieksekusi"
          icon={Sparkles}
          tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        />
        <ProfileKpiCard
          label="Workspace Terhubung"
          value={profile.stats.workspaceCount}
          subtext="organisasi aktif"
          icon={Building2}
          tone="bg-sky-500/10 text-sky-600 dark:text-sky-400"
        />
        <ProfileKpiCard
          label="Sesi Perangkat Aktif"
          value={profile.stats.activeSessionCount}
          subtext="login terautentikasi"
          icon={Laptop}
          tone="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        />
      </div>

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Edit Profile & Security */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          {/* Edit Profile Card */}
          <Card
            ref={profileFormCardRef}
            data-profile-section
            className="relative overflow-hidden rounded-2xl border-border/80 bg-card shadow-xs"
          >
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <UserRound className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Informasi Identitas Profil</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Nama tampilan digunakan pada log eksekusi, laporan QA, dan riwayat audit.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <form onSubmit={(e) => void handleSaveProfile(e)} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="profile-display-name">Nama Tampilan</Label>
                    <Input
                      id="profile-display-name"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      disabled={profile.isGuest || savingProfile}
                      placeholder="Nama lengkap Anda"
                      maxLength={80}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profile-email-readonly">Alamat Email (Kredensial Login)</Label>
                    <Input
                      id="profile-email-readonly"
                      value={profile.email}
                      disabled
                      readOnly
                      className="bg-secondary/40 text-muted-foreground"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-border/50 pt-4">
                  <span className="text-xs text-muted-foreground">
                    Terakhir diperbarui: {formatDateTime(profile.updatedAt)}
                  </span>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      profile.isGuest ||
                      savingProfile ||
                      displayName.trim() === profile.name ||
                      displayName.trim().length < 2
                    }
                    className="gap-1.5"
                  >
                    {savingProfile ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    Simpan Perubahan
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card
            ref={passwordFormCardRef}
            data-profile-section
            className="relative overflow-hidden rounded-2xl border-border/80 bg-card shadow-xs"
          >
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <KeyRound className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Keamanan & Ubah Password</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Gunakan minimal 12 karakter. Mengubah password akan mencabut sesi perangkat lain secara otomatis.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              {profile.isGuest ? (
                <p className="rounded-xl border border-border/60 bg-secondary/30 p-4 text-xs text-muted-foreground">
                  Anda sedang menggunakan akses tamu sementara. Pengaturan password tidak tersedia untuk akun tamu.
                </p>
              ) : (
                <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="profile-current-password">Password Saat Ini</Label>
                    <div className="relative">
                      <Input
                        id="profile-current-password"
                        type={showCurrentPw ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        disabled={savingPassword}
                        placeholder="Masukkan password saat ini"
                        autoComplete="current-password"
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw((v) => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showCurrentPw ? 'Sembunyikan password' : 'Tampilkan password'}
                      >
                        {showCurrentPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="profile-new-password">Password Baru (Min. 12 Karakter)</Label>
                      <div className="relative">
                        <Input
                          id="profile-new-password"
                          type={showNewPw ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          disabled={savingPassword}
                          placeholder="Minimal 12 karakter"
                          autoComplete="new-password"
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPw((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          aria-label={showNewPw ? 'Sembunyikan password baru' : 'Tampilkan password baru'}
                        >
                          {showNewPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="profile-confirm-password">Konfirmasi Password Baru</Label>
                      <Input
                        id="profile-confirm-password"
                        type={showNewPw ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={savingPassword}
                        placeholder="Ulangi password baru"
                        autoComplete="new-password"
                      />
                    </div>
                  </div>

                  {/* Password strength indicator */}
                  {newPassword.length > 0 && (
                    <div className="space-y-1.5 rounded-xl border border-border/60 bg-secondary/25 p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Kekuatan Password</span>
                        <span className="font-semibold text-foreground">{pwStrength.label}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className={cn('h-full rounded-full transition-all duration-300', pwStrength.color)}
                          style={{ width: `${(pwStrength.score / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end border-t border-border/50 pt-4">
                    <Button
                      type="submit"
                      size="sm"
                      disabled={
                        savingPassword ||
                        !currentPassword ||
                        newPassword.length < 12 ||
                        newPassword !== confirmPassword
                      }
                      className="gap-1.5"
                    >
                      {savingPassword ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <ShieldCheck className="size-3.5" />
                      )}
                      Perbarui Password
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Workspaces, Active Sessions, Recent Activity */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          {/* Workspace Memberships */}
          <Card data-profile-section className="rounded-2xl border-border/80 bg-card shadow-xs">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                    <Building2 className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Hak Akses Workspace</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Peran otorisasi Anda di dalam organisasi
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  {profile.memberships.length} workspace
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border/50 pt-2">
              {profile.memberships.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {m.workspace.name}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      slug: {m.workspace.slug} · {m.workspace.projectCount} project aktif
                    </p>
                  </div>
                  <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary font-mono text-xs font-semibold shrink-0">
                    <UserCheck className="mr-1 size-3" />
                    {m.role}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Active Sessions */}
          <Card data-profile-section className="rounded-2xl border-border/80 bg-card shadow-xs">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Laptop className="size-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Sesi Login Aktif</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Daftar sesi browser yang memiliki akses ke akun Anda
                    </p>
                  </div>
                </div>
                {!profile.isGuest && otherSessionsCount > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={revokingSessions}
                    onClick={() => void handleRevokeOtherSessions()}
                    className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive"
                  >
                    {revokingSessions ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    Cabut {otherSessionsCount} Sesi Lain
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border/50 pt-2">
              {profile.sessions.map((s) => (
                <div key={s.id} className="flex items-start justify-between gap-3 py-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'size-2 rounded-full',
                          s.isCurrent ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/50'
                        )}
                      />
                      <span className="font-semibold text-foreground">
                        {s.isCurrent ? 'Perangkat Ini (Sesi Saat Ini)' : `Sesi #${s.id.slice(-6)}`}
                      </span>
                    </div>
                    <p className="text-muted-foreground">
                      Terakhir aktif: {formatDateTime(s.lastSeenAt)}
                    </p>
                    <p className="text-[11px] text-muted-foreground/80">
                      Berlaku hingga: {formatDateTime(s.expiresAt)}
                    </p>
                  </div>
                  {s.isCurrent && (
                    <Badge variant="success" className="text-[10px]">
                      Aktif
                    </Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recent User Activity */}
          <Card data-profile-section className="rounded-2xl border-border/80 bg-card shadow-xs">
            <CardHeader className="border-b border-border/60 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Clock className="size-4" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Jejak Aktivitas Terakhir Saya</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    6 mutasi terbaru yang Anda lakukan di workspace
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="divide-y divide-border/50 pt-2">
              {profile.recentActivities.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">
                  Belum ada aktivitas terekam untuk akun ini.
                </p>
              ) : (
                profile.recentActivities.map((act) => (
                  <div key={act.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {act.action} · {act.entityType}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        Project: {act.projectName}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {new Date(act.createdAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
