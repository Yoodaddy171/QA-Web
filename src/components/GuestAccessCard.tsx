'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Copy, KeyRound, Loader2, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { GUEST_PERMISSIONS, GUEST_PRESETS, permissionDependencies, type GuestPermission } from '@/lib/domain/guest-access';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface Project { id: string; name: string; workspaceId?: string }
interface Grant { id: string; label: string; preset: string; permissions: GuestPermission[]; expiresAt: string; revokedAt: string | null; usedCount: number; maxUses: number; projects: { project: { id: string; name: string } }[] }
const formatTime = (value: string) => new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export function GuestAccessCard({ workspaceId, projects }: { workspaceId: string; projects: Project[] }) {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [token, setToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [label, setLabel] = useState('');
  const [preset, setPreset] = useState<'REVIEWER' | 'TESTER'>('REVIEWER');
  const [permissions, setPermissions] = useState<GuestPermission[]>(GUEST_PRESETS.REVIEWER);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [hours, setHours] = useState('24');
  const [maxUses, setMaxUses] = useState('1');
  const available = projects.filter(project => project.workspaceId === workspaceId);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/workspaces/guest-access?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: 'no-store', signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal memuat akses tamu.');
      if (!signal?.aborted) setGrants(data.grants);
    } catch (error) { if (!signal?.aborted) setMessage(error instanceof Error ? error.message : 'Gagal memuat akses tamu.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [workspaceId]);
  useEffect(() => { const controller = new AbortController(); const timer = window.setTimeout(() => void load(controller.signal), 0); return () => { window.clearTimeout(timer); controller.abort(); }; }, [load]);
  const togglePermission = (permission: GuestPermission, checked: boolean) => {
    setPermissions(current => checked ? [...new Set([...current, permission, ...permissionDependencies(permission)])] : current.filter(p => p !== permission && !permissionDependencies(p).includes(permission)));
  };
  const create = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setMessage(''); setToken(''); setCopied(false);
    try {
      const response = await fetch('/api/workspaces/guest-access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId, label, preset, projectIds, permissions, expiresInHours: Number(hours), maxUses: Number(maxUses) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal membuat token.');
      setGrants(current => [data.grant, ...current].slice(0, 100)); setToken(data.token); setShowForm(false); setLabel('');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal membuat token.'); }
    finally { setSaving(false); }
  };
  const revoke = async (id: string) => {
    setSaving(true); setMessage('');
    try {
      const response = await fetch('/api/workspaces/guest-access', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId, id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Gagal mencabut akses.');
      setToken(''); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Gagal mencabut akses.'); }
    finally { setSaving(false); }
  };
  return <Card>
    <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-2"><CardTitle>Akses tamu</CardTitle><CardDescription>Bagikan project tertentu tanpa membuat akun anggota permanen. Satu token mewakili satu identitas tamu.</CardDescription></div>
      <div className="flex shrink-0 gap-2"><Button variant="outline" size="icon" aria-label="Muat ulang akses tamu" onClick={() => void load()} disabled={loading}><RefreshCw /></Button><Button onClick={() => { setShowForm(value => !value); setMessage(''); setToken(''); }} aria-expanded={showForm}><Plus data-icon="inline-start" />{showForm ? 'Tutup form' : 'Buat token'}</Button></div>
    </CardHeader>
    <CardContent className="flex flex-col gap-6">
      {message && <Alert variant="destructive"><AlertTitle>Aksi belum berhasil</AlertTitle><AlertDescription>{message}</AlertDescription></Alert>}
      {token && <Alert><KeyRound /><AlertTitle className="line-clamp-none whitespace-normal break-words">Salin token sekarang — hanya ditampilkan sekali</AlertTitle><AlertDescription className="flex flex-col gap-3"><p>Kirim secara pribadi. Jangan taruh token di URL. Masa aktif dimulai saat token dibuat, bukan saat pertama kali dipakai.</p><Input aria-label="Token baru" readOnly value={token} autoComplete="off" className="font-mono" /><div className="flex flex-wrap gap-2"><Button size="sm" onClick={async () => { try { await navigator.clipboard.writeText(token); setCopied(true); } catch { setMessage('Clipboard tidak tersedia. Pilih dan salin token secara manual.'); } }}><Copy data-icon="inline-start" />{copied ? 'Tersalin' : 'Salin token'}</Button><Button size="sm" variant="outline" onClick={() => setToken('')}>Sudah disimpan, tutup</Button></div></AlertDescription></Alert>}
      {showForm && <form onSubmit={create} className="flex flex-col gap-5 border-b border-border pb-6" aria-busy={saving}>
        <div className="grid gap-4 sm:grid-cols-2"><div className="flex flex-col gap-2"><Label htmlFor="guest-label">Nama / label tamu</Label><Input id="guest-label" required maxLength={100} value={label} onChange={e => setLabel(e.target.value)} placeholder="Contoh: Reviewer client — Andi" /></div><div className="flex flex-col gap-2"><Label htmlFor="guest-preset">Preset izin</Label><Select value={preset} onValueChange={(value: 'REVIEWER' | 'TESTER') => { setPreset(value); setPermissions([...GUEST_PRESETS[value]]); }}><SelectTrigger id="guest-preset"><SelectValue /></SelectTrigger><SelectContent><SelectGroup><SelectItem value="REVIEWER">Reviewer — melihat hasil</SelectItem><SelectItem value="TESTER">Tester — execution & evidence</SelectItem></SelectGroup></SelectContent></Select></div></div>
        <fieldset className="flex flex-col gap-3"><legend className="mb-3 text-sm font-medium">Project yang boleh diakses</legend>{available.length ? <div className="grid gap-2 sm:grid-cols-2">{available.map(project => <Label key={project.id} className="flex min-h-11 items-center gap-3 rounded-lg border border-border p-3"><Checkbox checked={projectIds.includes(project.id)} onCheckedChange={checked => setProjectIds(current => checked ? [...current, project.id] : current.filter(id => id !== project.id))} /><span className="break-words">{project.name}</span></Label>)}</div> : <p className="text-sm text-muted-foreground">Belum ada project aktif pada workspace ini.</p>}</fieldset>
        <fieldset className="flex flex-col gap-3"><legend className="mb-3 text-sm font-medium">Izin akses</legend><p className="text-sm text-muted-foreground">Preset dapat disesuaikan. Izin pendukung akan dipilih otomatis. Settings, AI, relay, dan raw Devlog tidak tersedia untuk tamu.</p><div className="grid gap-2 sm:grid-cols-2">{Object.entries(GUEST_PERMISSIONS).map(([key, text]) => <Label key={key} className="flex min-h-11 items-start gap-3 py-2"><Checkbox className="mt-0.5" checked={permissions.includes(key as GuestPermission)} onCheckedChange={checked => togglePermission(key as GuestPermission, checked === true)} /><span className="leading-5">{text}</span></Label>)}</div><p className="text-xs leading-5 text-muted-foreground">Izin melihat evidence memberi akses ke isi file; file yang sudah dilihat tetap dapat disimpan oleh penerima.</p></fieldset>
        <div className="grid gap-4 sm:grid-cols-2"><div className="flex flex-col gap-2"><Label htmlFor="guest-hours">Masa aktif (jam sejak dibuat)</Label><Input id="guest-hours" type="number" min={1} max={720} required value={hours} onChange={e => setHours(e.target.value)} /></div><div className="flex flex-col gap-2"><Label htmlFor="guest-uses">Batas penukaran token</Label><Input id="guest-uses" type="number" min={1} max={100} required value={maxUses} onChange={e => setMaxUses(e.target.value)} /><p className="text-xs leading-5 text-muted-foreground">Dihitung per login dengan token, bukan per klik. Default satu kali.</p></div></div>
        <Button className="self-start" type="submit" disabled={saving || !projectIds.length || !permissions.length}>{saving ? <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" /> : <ShieldCheck data-icon="inline-start" />}Terbitkan token tamu</Button>
      </form>}
      <div className="flex flex-col gap-3"><h3 className="text-sm font-semibold">Token terbaru <span className="font-normal text-muted-foreground">(maks. 100)</span></h3>{loading ? <p role="status" className="py-6 text-sm text-muted-foreground">Memuat akses tamu...</p> : !grants.length ? <p className="py-6 text-sm leading-6 text-muted-foreground">Belum ada token. Pilih Buat token untuk memberikan akses Reviewer atau Tester.</p> : grants.map(grant => {
        const expired = new Date(grant.expiresAt).getTime() <= Date.now();
        return <article key={grant.id} className="flex flex-col gap-3 border-t border-border py-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 flex-col gap-2"><div className="flex flex-wrap items-center gap-2"><h4 className="break-words text-sm font-semibold">{grant.label}</h4><Badge variant="outline">{grant.revokedAt ? 'Dicabut' : expired ? 'Kedaluwarsa' : 'Aktif'}</Badge></div><p className="break-words text-sm text-muted-foreground">{grant.projects.map(link => link.project.name).join(', ')}</p><p className="text-xs leading-5 text-muted-foreground">Berakhir {formatTime(grant.expiresAt)} · {grant.usedCount}/{grant.maxUses} penukaran · {grant.permissions.length} izin</p><details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-1">Lihat izin</summary><ul className="mt-2 flex list-disc flex-col gap-1 pl-4">{grant.permissions.map(permission => <li key={permission}>{GUEST_PERMISSIONS[permission]}</li>)}</ul></details></div>{!grant.revokedAt && !expired && <AlertDialog><AlertDialogTrigger asChild><Button size="sm" variant="outline" disabled={saving}>Cabut akses</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Cabut akses {grant.label}?</AlertDialogTitle><AlertDialogDescription>Token tidak bisa dipakai lagi dan seluruh sesi tamu ini akan dihentikan. History aktivitas tetap disimpan.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction onClick={() => void revoke(grant.id)}>Cabut akses</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</article>;
      })}</div>
    </CardContent>
  </Card>;
}
