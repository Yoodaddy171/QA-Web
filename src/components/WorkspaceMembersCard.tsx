'use client';

import { FormEvent, useCallback, useEffect, useId, useState } from 'react';
import { Loader2, Pencil, Plus, RefreshCw, Trash2, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const roles = ['VIEWER', 'QA', 'QA_LEAD', 'ADMIN', 'OWNER'];
const blankForm = { name: '', email: '', password: '', role: 'QA' };
interface Member {
  id: string; role: string; updatedAt: string;
  user: { id: string; name: string; email: string; disabledAt: string | null; updatedAt: string };
  isSelf: boolean; sharedAccount: boolean; canEdit: boolean; canEditIdentity: boolean; canRemove: boolean; protectedOwner: boolean;
}
type Draft = typeof blankForm;

async function request(url: string, options?: RequestInit) {
  const response = await fetch(url, { cache: 'no-store', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Perubahan gagal. Muat ulang team lalu coba lagi.');
  return data;
}

function RoleField({ id, value, onChange, ownerAllowed, locked, disabled }: { id: string; value: string; onChange: (value: string) => void; ownerAllowed: boolean; locked?: boolean; disabled?: boolean }) {
  return <div className="flex min-w-0 flex-col gap-2">
    <Label htmlFor={id}>Role</Label>
    <Select value={value} onValueChange={onChange} disabled={disabled || locked}>
      <SelectTrigger id={id} className="w-full"><SelectValue /></SelectTrigger>
      <SelectContent><SelectGroup>{roles.filter(role => role !== 'OWNER' || ownerAllowed).map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}</SelectGroup></SelectContent>
    </Select>
    {locked && <p className="text-xs leading-5 text-muted-foreground">Role owner aktif terakhir tidak dapat diturunkan.</p>}
  </div>;
}

export function WorkspaceMembersCard() {
  const prefix = useId();
  const [members, setMembers] = useState<Member[]>([]);
  const [actorRole, setActorRole] = useState('');
  const [form, setForm] = useState<Draft>(blankForm);
  const [editing, setEditing] = useState<Member | null>(null);
  const [draft, setDraft] = useState<Draft>(blankForm);
  const [removing, setRemoving] = useState<Member | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request('/api/workspaces/members');
      setMembers(data.members || []); setActorRole(data.actorRole || '');
    } catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : 'Gagal memuat team.' }); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const add = async (event: FormEvent) => {
    event.preventDefault(); setBusy('add'); setFeedback(null);
    try {
      await request('/api/workspaces/members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      setForm(blankForm); setFeedback({ error: false, text: 'Member berhasil ditambahkan.' }); await load();
    } catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : 'Gagal menambah member.' }); }
    finally { setBusy(''); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!editing) return;
    setBusy(editing.id); setFeedback(null);
    try {
      const data = await request('/api/workspaces/members', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        membershipId: editing.id, role: draft.role,
        ...(editing.canEditIdentity ? { name: draft.name, email: draft.email, ...(draft.password ? { password: draft.password } : {}) } : {}),
        expectedUpdatedAt: editing.updatedAt, expectedUserUpdatedAt: editing.user.updatedAt,
      }) });
      setEditing(null); setDraft(blankForm);
      if (data.sessionRevoked) { window.location.replace('/login'); return; }
      if (data.refreshRequired) { window.location.reload(); return; }
      setFeedback({ error: false, text: 'Akun berhasil diperbarui.' }); await load();
    } catch (error) { setFeedback({ error: true, text: error instanceof Error ? error.message : 'Gagal memperbarui akun.' }); }
    finally { setBusy(''); }
  };
  const remove = async () => {
    if (!removing) return;
    setBusy(removing.id); setDeleteError(''); setFeedback(null);
    try {
      const data = await request(`/api/workspaces/members?membershipId=${encodeURIComponent(removing.id)}`, { method: 'DELETE' });
      setRemoving(null);
      if (data.removedSelf) { window.location.replace('/login'); return; }
      setFeedback({ error: false, text: data.accountDisabled ? 'Akses workspace dihapus dan akun dinonaktifkan. Riwayat QA tetap tersimpan.' : 'Akses ke workspace ini dihapus. Akun tetap tersedia di workspace lainnya.' });
      await load();
    } catch (error) { setDeleteError(error instanceof Error ? error.message : 'Gagal menghapus akses akun.'); }
    finally { setBusy(''); }
  };

  return <Card variant="majestic">
    <CardHeader className="border-b border-border/60">
      <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 flex-col gap-1">
        <CardTitle className="flex items-center gap-2"><UsersRound className="size-5 text-primary" />Workspace team</CardTitle>
        <CardDescription>Kelola akun dan role untuk seluruh project di workspace ini.</CardDescription>
      </div><Button type="button" variant="outline" size="icon" disabled={loading || Boolean(busy) || Boolean(editing)} onClick={() => { setFeedback(null); void load(); }} aria-label="Muat ulang team"><RefreshCw /></Button></div>
    </CardHeader>
    <CardContent className="flex min-w-0 flex-col gap-5 pt-5">
      {feedback && <Alert role={feedback.error ? 'alert' : 'status'}><AlertDescription className={feedback.error ? 'text-status-failed' : undefined}>{feedback.text}</AlertDescription></Alert>}
      <form onSubmit={add} aria-label="Tambah member" className="grid min-w-0 gap-4 rounded-lg border border-border bg-secondary/20 p-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={`${prefix}-name`}>Nama</Label><Input id={`${prefix}-name`} required maxLength={100} value={form.name} disabled={Boolean(busy)} onChange={e => setForm(current => ({ ...current, name: e.target.value }))} /></div>
        <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={`${prefix}-email`}>Email</Label><Input id={`${prefix}-email`} type="email" required maxLength={254} value={form.email} disabled={Boolean(busy)} autoComplete="off" onChange={e => setForm(current => ({ ...current, email: e.target.value }))} /></div>
        <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={`${prefix}-password`}>Password awal</Label><Input id={`${prefix}-password`} type="password" required minLength={12} maxLength={200} autoComplete="new-password" value={form.password} disabled={Boolean(busy)} placeholder="Min. 12 karakter" onChange={e => setForm(current => ({ ...current, password: e.target.value }))} /></div>
        <RoleField id={`${prefix}-role`} value={form.role} onChange={role => setForm(current => ({ ...current, role }))} ownerAllowed={actorRole === 'OWNER'} disabled={Boolean(busy)} />
        <div className="flex items-end"><Button className="w-full" type="submit" disabled={Boolean(busy) || loading || Boolean(editing)}>{busy === 'add' ? <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" /> : <Plus data-icon="inline-start" />}Tambah member</Button></div>
      </form>
      {loading && <p role="status" className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin motion-reduce:animate-none" />Memuat team...</p>}
      {!loading && members.length === 0 && <p className="py-4 text-sm text-muted-foreground">Belum ada member yang dapat ditampilkan. Gunakan “Muat ulang team” untuk mencoba lagi.</p>}
      {!loading && <div className="divide-y divide-border rounded-lg border border-border">{members.map(member => <div key={member.id} className="flex min-w-0 flex-col gap-4 p-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{member.user.name}{member.isSelf && <span className="ms-2 text-xs font-normal text-muted-foreground">Anda</span>}</p><p className="break-all text-xs leading-5 text-muted-foreground">{member.user.email}</p></div>
          <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{member.role}</Badge>{member.user.disabledAt && <Badge variant="outline">Nonaktif</Badge>}
            <Button type="button" variant="outline" size="sm" disabled={!member.canEdit || Boolean(busy) || Boolean(editing)} onClick={() => { setEditing(member); setDraft({ name: member.user.name, email: member.user.email, password: '', role: member.role }); setFeedback(null); }} aria-label={`Edit akun ${member.user.name}`}><Pencil data-icon="inline-start" />Edit akun</Button>
            <Button type="button" variant="ghost" size="icon" disabled={!member.canRemove || Boolean(busy) || Boolean(editing)} title={member.protectedOwner ? 'Owner aktif terakhir tidak dapat dihapus.' : undefined} onClick={() => { setRemoving(member); setDeleteError(''); }} aria-label={`Hapus akun ${member.user.name}`}><Trash2 /></Button>
          </div>
        </div>
        {member.protectedOwner && <p className="text-xs leading-5 text-muted-foreground">Owner aktif terakhir tidak dapat dihapus. Tambahkan owner aktif lain terlebih dahulu.</p>}
        {editing?.id === member.id && <form onSubmit={save} aria-label={`Edit akun ${member.user.name}`} className="flex min-w-0 flex-col gap-4 border-t border-border pt-4">
          {!member.canEditIdentity && <p className="text-sm leading-6 text-muted-foreground">Akun ini juga dipakai di workspace lain. Di sini Anda hanya dapat mengubah role workspace ini.</p>}
          {member.isSelf && <p className="text-xs leading-5 text-muted-foreground">Mengubah email atau password Anda akan mengakhiri session dan meminta login ulang.</p>}
          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={`${prefix}-edit-name`}>Nama akun</Label><Input id={`${prefix}-edit-name`} required maxLength={100} disabled={!member.canEditIdentity || Boolean(busy)} value={draft.name} onChange={e => setDraft(current => ({ ...current, name: e.target.value }))} /></div>
            <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={`${prefix}-edit-email`}>Email akun</Label><Input id={`${prefix}-edit-email`} type="email" required maxLength={254} autoComplete="off" disabled={!member.canEditIdentity || Boolean(busy)} value={draft.email} onChange={e => setDraft(current => ({ ...current, email: e.target.value }))} /></div>
            <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={`${prefix}-edit-password`}>Password baru (opsional)</Label><Input id={`${prefix}-edit-password`} type="password" minLength={12} maxLength={200} autoComplete="new-password" aria-describedby={`${prefix}-edit-password-hint`} disabled={!member.canEditIdentity || Boolean(busy)} value={draft.password} onChange={e => setDraft(current => ({ ...current, password: e.target.value }))} /><p id={`${prefix}-edit-password-hint`} className="text-xs leading-5 text-muted-foreground">Kosongkan agar password tidak berubah. Password baru minimal 12 karakter.</p></div>
            <RoleField id={`${prefix}-edit-role`} value={draft.role} onChange={role => setDraft(current => ({ ...current, role }))} ownerAllowed={actorRole === 'OWNER'} locked={member.protectedOwner} disabled={Boolean(busy)} />
          </div>
          <div className="flex flex-wrap gap-2"><Button type="submit" disabled={Boolean(busy)}>{busy === member.id && <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />}Simpan perubahan</Button><Button type="button" variant="outline" disabled={Boolean(busy)} onClick={() => { setEditing(null); setDraft(blankForm); }}>Batalkan</Button></div>
        </form>}
      </div>)}</div>}
    </CardContent>
    <AlertDialog open={Boolean(removing)} onOpenChange={open => { if (!open && !busy) { setRemoving(null); setDeleteError(''); } }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus akses akun?</AlertDialogTitle><AlertDialogDescription>Akses {removing?.user.name} ke workspace ini akan dicabut dan session akunnya diakhiri. Jika tidak punya workspace lain, akun juga dinonaktifkan sehingga tidak bisa login. Riwayat QA tidak dihapus.</AlertDialogDescription></AlertDialogHeader>
        {deleteError && <Alert role="alert"><AlertDescription className="text-status-failed">{deleteError}</AlertDescription></Alert>}
        <AlertDialogFooter><AlertDialogCancel disabled={Boolean(busy)}>Batalkan</AlertDialogCancel><AlertDialogAction disabled={Boolean(busy)} onClick={event => { event.preventDefault(); void remove(); }}>{busy && <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />}Hapus akses akun</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Card>;
}
