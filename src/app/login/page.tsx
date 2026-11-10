'use client';

import { FormEvent, useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QAPipelineHero } from '@/components/login/QAPipelineHero';

export default function LoginPage() {
  const [setupRequired, setSetupRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [guestMode, setGuestMode] = useState(false);
  const [guestToken, setGuestToken] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    workspaceName: 'Local Workspace',
    bootstrapToken: '',
  });

  useEffect(() => {
    void fetch('/api/auth/status', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
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
      const response = await fetch(
        setupRequired
          ? '/api/auth/bootstrap'
          : guestMode
          ? '/api/auth/guest'
          : '/api/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(guestMode && !setupRequired ? { token: guestToken } : form),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Authentication gagal.');
      const next = new URLSearchParams(window.location.search).get('next');
      setGuestToken('');
      window.location.replace(
        !guestMode && next?.startsWith('/') && !next.startsWith('//') ? next : '/'
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="traceva-login">
      {/* Left Column: Industrial QA Intelligence Hero (Desktop only) */}
      <aside className="traceva-login-hero dark" aria-labelledby="brand-heading">
        <QAPipelineHero />
      </aside>

      {/* Right Column: Clean Frosted Auth Card */}
      <section className="traceva-login-panel" aria-labelledby="login-heading">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="traceva-login-card relative overflow-hidden"
        >
          <div className="traceva-login-content">
            <div className="traceva-login-mobile-logo">
              <BrandMark />
            </div>

            <header className="traceva-login-heading">
              <h1 id="login-heading">
                {setupRequired
                  ? 'Siapkan Workspace Pertama'
                  : guestMode
                  ? 'Akses Tamu Workspace'
                  : 'Masuk ke Traceva'}
              </h1>
              <p>
                {setupRequired
                  ? 'Buat akun owner untuk menginisialisasi workspace. Akses bootstrap otomatis dikunci setelah akun dibuat.'
                  : guestMode
                  ? 'Gunakan token akses dari administrator project untuk masuk.'
                  : 'Pusat pengelolaan test case, eksekusi, dan traceability.'}
              </p>
            </header>

            {loading ? (
              <div className="traceva-login-loading" role="status">
                <Loader2
                  className="size-5 animate-spin text-primary motion-reduce:animate-none"
                  aria-hidden="true"
                />
                <span>Memeriksa session...</span>
              </div>
            ) : (
              <form className="traceva-login-form" onSubmit={submit} aria-busy={submitting}>
                {setupRequired && (
                  <>
                    <div className="traceva-login-field">
                      <Label htmlFor="name">Nama Owner</Label>
                      <Input
                        id="name"
                        autoComplete="name"
                        required
                        value={form.name}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, name: event.target.value }))
                        }
                      />
                    </div>
                    <div className="traceva-login-field">
                      <Label htmlFor="workspace">Nama Workspace</Label>
                      <Input
                        id="workspace"
                        required
                        value={form.workspaceName}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, workspaceName: event.target.value }))
                        }
                      />
                    </div>
                  </>
                )}

                {guestMode && !setupRequired ? (
                  <div className="traceva-login-field">
                    <Label htmlFor="guest-token">Token Akses Tamu</Label>
                    <Input
                      id="guest-token"
                      type="password"
                      autoComplete="off"
                      spellCheck={false}
                      required
                      value={guestToken}
                      maxLength={100}
                      onChange={(event) => setGuestToken(event.target.value)}
                      aria-describedby="guest-token-hint"
                      placeholder="Masukkan token dari admin"
                    />
                    <p id="guest-token-hint" className="traceva-login-hint">
                      Token bukan kata sandi akun. Minta token baru jika sudah habis dipakai atau
                      kedaluwarsa.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="traceva-login-field">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="nama@perusahaan.com"
                        required
                        value={form.email}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, email: event.target.value }))
                        }
                      />
                    </div>
                    <div className="traceva-login-field">
                      <div className="traceva-login-password-label">
                        <Label htmlFor="password">Password</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          className="traceva-login-password-toggle"
                          disabled={submitting}
                          aria-controls="password"
                          aria-label={passwordVisible ? 'Sembunyikan password' : 'Tampilkan password'}
                          aria-pressed={passwordVisible}
                          onClick={() => setPasswordVisible((value) => !value)}
                        >
                          {passwordVisible ? (
                            <EyeOff className="size-3.5 mr-1" aria-hidden="true" />
                          ) : (
                            <Eye className="size-3.5 mr-1" aria-hidden="true" />
                          )}
                          <span>{passwordVisible ? 'Sembunyikan' : 'Tampilkan'}</span>
                        </Button>
                      </div>
                      <Input
                        id="password"
                        type={passwordVisible ? 'text' : 'password'}
                        minLength={12}
                        aria-describedby={setupRequired ? 'password-hint' : undefined}
                        autoComplete={setupRequired ? 'new-password' : 'current-password'}
                        required
                        value={form.password}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, password: event.target.value }))
                        }
                      />
                      {setupRequired && (
                        <p id="password-hint" className="traceva-login-hint">
                          Minimal 12 karakter.
                        </p>
                      )}
                    </div>
                  </>
                )}

                {setupRequired && (
                  <div className="traceva-login-field">
                    <Label htmlFor="token">Bootstrap Token</Label>
                    <div className="traceva-login-token">
                      <KeyRound className="size-4" aria-hidden="true" />
                      <Input
                        id="token"
                        type="password"
                        aria-describedby="token-hint"
                        required
                        value={form.bootstrapToken}
                        onChange={(event) =>
                          setForm((current) => ({ ...current, bootstrapToken: event.target.value }))
                        }
                      />
                    </div>
                    <p id="token-hint" className="traceva-login-hint">
                      Nilai dari <code>QA_BOOTSTRAP_TOKEN</code> pada host environment.
                    </p>
                  </div>
                )}

                {error && (
                  <div role="alert" className="traceva-login-error">
                    {error}
                  </div>
                )}

                <Button className="traceva-login-submit" type="submit" disabled={submitting}>
                  <span>
                    {submitting
                      ? 'Memproses...'
                      : setupRequired
                      ? 'Buat Owner & Masuk'
                      : guestMode
                      ? 'Gunakan Token & Masuk'
                      : 'Masuk ke Workspace'}
                  </span>
                  {submitting ? (
                    <Loader2
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowRight className="size-4" aria-hidden="true" />
                  )}
                </Button>

                {!setupRequired && (
                  <Button
                    className="traceva-login-guest"
                    type="button"
                    variant="ghost"
                    disabled={submitting}
                    onClick={() => {
                      setGuestMode((value) => !value);
                      setGuestToken('');
                      setPasswordVisible(false);
                      setError('');
                    }}
                  >
                    <KeyRound className="size-3.5 mr-2" aria-hidden="true" />
                    <span>{guestMode ? 'Kembali ke login akun' : 'Masuk dengan token tamu'}</span>
                  </Button>
                )}
              </form>
            )}

            <div className="traceva-login-footer-meta">
              <span className="flex items-center gap-1.5 font-mono">
                <span className="size-1.5 rounded-full bg-emerald-500" />
                <span>Traceva Console v0.2.0</span>
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">Local Workspace</span>
            </div>
          </div>
        </motion.div>
      </section>
    </main>
  );
}
