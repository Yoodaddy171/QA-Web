'use client';

import { FormEvent, useEffect, useState, useSyncExternalStore } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, Pause, Play } from 'lucide-react';
import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const motionQuery = '(min-width: 1024px) and (prefers-reduced-motion: no-preference)';
function subscribeBrandMotion(onChange: () => void) {
  const query = window.matchMedia(motionQuery);
  query.addEventListener('change', onChange);
  document.addEventListener('visibilitychange', onChange);
  return () => {
    query.removeEventListener('change', onChange);
    document.removeEventListener('visibilitychange', onChange);
  };
}
const brandMotionAvailable = () => document.visibilityState === 'visible' && window.matchMedia(motionQuery).matches;
const noServerMotion = () => false;

function LoginBrandMotion() {
  const available = useSyncExternalStore(subscribeBrandMotion, brandMotionAvailable, noServerMotion);
  const [paused, setPaused] = useState(false);
  return <>
    {available && !paused && (
      // Native SVG timeline; no React animation loop or image optimization.
      <img className="traceva-login-motion" src="/brand/traceva/traceva-login-trace-overlay.svg" width={1672} height={941} alt="" aria-hidden="true" draggable={false} />
    )}
    {available && <Button className="traceva-login-motion-toggle" type="button" variant="ghost" onClick={() => setPaused(value => !value)} aria-pressed={paused}>
      {paused ? <Play data-icon="inline-start" aria-hidden="true" /> : <Pause data-icon="inline-start" aria-hidden="true" />}
      {paused ? 'Putar animasi' : 'Jeda animasi'}
    </Button>}
  </>;
}

export default function LoginPage() {
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [guestMode, setGuestMode] = useState(false);
  const [guestToken, setGuestToken] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
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
      const response = await fetch(setupRequired ? '/api/auth/bootstrap' : guestMode ? '/api/auth/guest' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(guestMode && !setupRequired ? { token: guestToken } : form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Authentication gagal.');
      const next = new URLSearchParams(window.location.search).get('next');
      setGuestToken('');
      window.location.replace(!guestMode && next?.startsWith('/') && !next.startsWith('//') ? next : '/');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="traceva-login">
      <aside className="traceva-login-hero dark" aria-labelledby="brand-heading">
        <LoginBrandMotion />
        <div className="traceva-login-hero-logo"><BrandMark /></div>
        <div className="traceva-login-story">
          <h2 id="brand-heading">Quality,<br />connected.</h2>
          <p>Kelola testcase, execution, bug, dan traceability dalam satu workspace.</p>
        </div>
      </aside>

      <section className="traceva-login-panel" aria-labelledby="login-heading">
        <div className="traceva-login-content">
          <div className="traceva-login-mobile-logo"><BrandMark /></div>
          <header className="traceva-login-heading">
            <h1 id="login-heading">{setupRequired ? 'Siapkan workspace pertama.' : guestMode ? 'Masuk sebagai tamu.' : 'Selamat datang kembali.'}</h1>
            <p>{setupRequired ? 'Buat owner pertama untuk memulai. Bootstrap otomatis terkunci setelah akun pertama tersedia.' : guestMode ? 'Gunakan token dari admin. Akses dibatasi pada project, izin, dan masa aktif yang ditentukan.' : 'Masuk untuk melanjutkan pekerjaan QA Anda.'}</p>
          </header>

          {loading ? (
            <div className="traceva-login-loading" role="status">
              <Loader2 className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Memeriksa session...
            </div>
          ) : (
            <form className="traceva-login-form" onSubmit={submit} aria-busy={submitting}>
              {setupRequired && <>
                <div className="traceva-login-field">
                  <Label htmlFor="name">Nama owner</Label>
                  <Input id="name" autoComplete="name" required value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="traceva-login-field">
                  <Label htmlFor="workspace">Nama workspace</Label>
                  <Input id="workspace" required value={form.workspaceName} onChange={event => setForm(current => ({ ...current, workspaceName: event.target.value }))} />
                </div>
              </>}
              {guestMode && !setupRequired ? <div className="traceva-login-field">
                <Label htmlFor="guest-token">Token akses tamu</Label>
                <Input id="guest-token" type="password" autoComplete="off" spellCheck={false} required value={guestToken} maxLength={100} onChange={event => setGuestToken(event.target.value)} aria-describedby="guest-token-hint" />
                <p id="guest-token-hint" className="traceva-login-hint">Token bukan password akun. Minta token baru jika sudah habis dipakai atau kedaluwarsa.</p>
              </div> : <>
              <div className="traceva-login-field">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" placeholder="nama@perusahaan.com" required value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} />
              </div>
              <div className="traceva-login-field">
                <div className="traceva-login-password-label">
                  <Label htmlFor="password">Password</Label>
                  <Button type="button" variant="ghost" className="traceva-login-password-toggle" disabled={submitting} aria-controls="password" aria-label={passwordVisible ? 'Sembunyikan password' : 'Tampilkan password'} aria-pressed={passwordVisible} onClick={() => setPasswordVisible(value => !value)}>
                    {passwordVisible ? <EyeOff data-icon="inline-start" aria-hidden="true" /> : <Eye data-icon="inline-start" aria-hidden="true" />}
                    {passwordVisible ? 'Sembunyikan' : 'Tampilkan'}
                  </Button>
                </div>
                <Input id="password" type={passwordVisible ? 'text' : 'password'} minLength={12} aria-describedby={setupRequired ? 'password-hint' : undefined} autoComplete={setupRequired ? 'new-password' : 'current-password'} required value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} />
                {setupRequired && <p id="password-hint" className="traceva-login-hint">Minimal 12 karakter.</p>}
              </div>
              </>}
              {setupRequired && <div className="traceva-login-field">
                <Label htmlFor="token">Bootstrap token</Label>
                <div className="traceva-login-token">
                  <KeyRound className="size-4" aria-hidden="true" />
                  <Input id="token" type="password" aria-describedby="token-hint" required value={form.bootstrapToken} onChange={event => setForm(current => ({ ...current, bootstrapToken: event.target.value }))} />
                </div>
                <p id="token-hint" className="traceva-login-hint">Nilai dari <code>QA_BOOTSTRAP_TOKEN</code> pada environment host.</p>
              </div>}
              {error && <div role="alert" className="traceva-login-error">{error}</div>}
              <Button className="traceva-login-submit" type="submit" disabled={submitting}>
                <span>{submitting ? 'Memproses...' : setupRequired ? 'Buat owner & masuk' : guestMode ? 'Gunakan token & masuk' : 'Masuk ke workspace'}</span>
                {submitting ? <Loader2 data-icon="inline-end" className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowRight data-icon="inline-end" aria-hidden="true" />}
              </Button>
              {!setupRequired && <Button className="traceva-login-guest" type="button" variant="ghost" disabled={submitting} onClick={() => { setGuestMode(value => !value); setGuestToken(''); setPasswordVisible(false); setError(''); }}><KeyRound data-icon="inline-start" aria-hidden="true" />{guestMode ? 'Kembali ke login akun' : 'Masuk dengan token tamu'}</Button>}
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
