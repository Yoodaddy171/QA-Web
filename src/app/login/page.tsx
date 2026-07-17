'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', email: '', password: '', workspaceName: 'Local Workspace', bootstrapToken: '' });

  useEffect(() => {
    void fetch('/api/auth/status', { cache: 'no-store' })
      .then(response => response.json())
      .then(data => {
        if (data.authenticated) window.location.replace('/');
        setSetupRequired(Boolean(data.setupRequired));
      })
      .catch(() => setError('Status authentication tidak dapat dibaca.'))
      .finally(() => setLoading(false));
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(setupRequired ? '/api/auth/bootstrap' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Authentication gagal.');
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.replace(next?.startsWith('/') && !next.startsWith('//') ? next : '/');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden bg-background p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.12),transparent_32%),radial-gradient(circle_at_80%_80%,hsl(var(--primary)/0.08),transparent_30%)]" />
      <Card className="relative w-full max-w-md overflow-hidden border-border/70 shadow-2xl">
        <div className="h-1 bg-gradient-to-r from-primary via-indigo-400 to-cyan-400" />
        <CardHeader className="space-y-4 pb-4 pt-7">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><ShieldCheck className="size-5" /></span><div><p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">QADesk Console</p><CardTitle className="mt-1 text-xl">{setupRequired ? 'Siapkan workspace pertama' : 'Masuk ke workspace'}</CardTitle></div></div>
          <p className="text-sm leading-relaxed text-muted-foreground">{setupRequired ? 'Buat owner pertama. Bootstrap otomatis terkunci setelah akun pertama tersedia.' : 'Gunakan akun workspace untuk mengakses project QA.'}</p>
        </CardHeader>
        <CardContent>
          {loading ? <div className="flex h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 animate-spin" />Memeriksa session...</div> : (
            <form className="space-y-4" onSubmit={submit}>
              {setupRequired && <><div className="space-y-1.5"><Label htmlFor="name">Nama owner</Label><Input id="name" autoComplete="name" required value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} /></div><div className="space-y-1.5"><Label htmlFor="workspace">Nama workspace</Label><Input id="workspace" required value={form.workspaceName} onChange={event => setForm(current => ({ ...current, workspaceName: event.target.value }))} /></div></>}
              <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} /></div>
              <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" minLength={12} autoComplete={setupRequired ? 'new-password' : 'current-password'} required value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} /><p className="text-[11px] text-muted-foreground">Minimal 12 karakter.</p></div>
              {setupRequired && <div className="space-y-1.5"><Label htmlFor="token">Bootstrap token</Label><div className="relative"><KeyRound className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input id="token" type="password" className="pl-9" required value={form.bootstrapToken} onChange={event => setForm(current => ({ ...current, bootstrapToken: event.target.value }))} /></div><p className="text-[11px] leading-relaxed text-muted-foreground">Nilai dari <code>QA_BOOTSTRAP_TOKEN</code> pada environment host.</p></div>}
              {error && <div role="alert" className="rounded-lg border border-red-500/25 bg-red-500/8 px-3 py-2.5 text-xs text-red-600 dark:text-red-400">{error}</div>}
              <Button className="w-full" type="submit" disabled={submitting}>{submitting ? <Loader2 className="animate-spin" /> : <ArrowRight />}{setupRequired ? 'Buat owner & masuk' : 'Masuk'}</Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
