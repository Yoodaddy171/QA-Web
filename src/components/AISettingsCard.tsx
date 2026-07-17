'use client';

import { useEffect, useState } from 'react';
import { Bot, Loader2, Save, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface AISettingsCardProps {
  projectId: string;
  provider: string;
  ollamaBaseUrl: string;
  groqStatus: string;
  geminiStatus: string;
  message: string;
}

interface GovernanceState { allowExternalAi: boolean; aiMonthlyTokenBudget: number; usedTokens: number; requestCount: number; month: string; audits: Array<{ id: string; operation: string; provider: string; model: string; inputTokens: number; outputTokens: number; status: string; createdAt: string; dataCategories?: string[] }> }

export function AISettingsCard({ projectId, provider, ollamaBaseUrl, groqStatus, geminiStatus, message }: AISettingsCardProps) {
  const [governance, setGovernance] = useState<GovernanceState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [governanceMessage, setGovernanceMessage] = useState('');
  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      setLoading(true);
      void fetch(`/api/ai/governance?projectId=${encodeURIComponent(projectId)}`, { cache: 'no-store', signal: controller.signal }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Gagal memuat AI governance.'); setGovernance(data); }).catch(error => { if (error instanceof Error && error.name !== 'AbortError') setGovernanceMessage(error.message); }).finally(() => setLoading(false));
    });
    return () => controller.abort();
  }, [projectId]);
  const saveGovernance = async () => {
    if (!governance) return;
    setSaving(true); setGovernanceMessage('');
    try { const response = await fetch('/api/ai/governance', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId, allowExternalAi: governance.allowExternalAi, aiMonthlyTokenBudget: governance.aiMonthlyTokenBudget }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Gagal menyimpan AI governance.'); setGovernance(current => current ? { ...current, ...data } : current); setGovernanceMessage('AI governance tersimpan.'); } catch (error) { setGovernanceMessage(error instanceof Error ? error.message : 'Gagal menyimpan AI governance.'); } finally { setSaving(false); }
  };
  const formatStatus = (status: string) => {
    if (status === 'Not configured') return 'Belum dikonfigurasi';
    return status.replace(/^Configured/, 'Terkonfigurasi');
  };
  return (
    <Card variant="majestic">
      <CardHeader className="border-b border-border/40 pb-3">
        <div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2 text-lg font-bold tracking-tight"><Bot className="h-5 w-5 text-primary" />Konfigurasi AI</CardTitle><Badge variant="outline" className="gap-1.5"><ShieldCheck className="size-3.5 text-emerald-500" />Host-managed</Badge></div>
      </CardHeader>
      <CardContent className="grid gap-3 pt-4 md:grid-cols-2">
        <SettingValue label="Provider aktif" value={provider} />
        <SettingValue label="Ollama loopback" value={ollamaBaseUrl || 'Belum dikonfigurasi'} />
        <SettingValue label="Groq API key" value={formatStatus(groqStatus)} />
        <SettingValue label="Gemini API key" value={formatStatus(geminiStatus)} />
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 text-xs leading-relaxed text-muted-foreground md:col-span-2">API key tidak pernah dikirim kembali ke browser dan tidak dapat diubah melalui HTTP. Atur <code>AI_PROVIDER</code>, <code>GROQ_API_KEY</code>, <code>GEMINI_API_KEY</code>, atau <code>OLLAMA_BASE_URL</code> pada environment host, lalu restart aplikasi.</div>
        {message ? <p className="text-sm text-destructive md:col-span-2">{message}</p> : null}
        <div className="mt-2 space-y-4 rounded-xl border border-border/60 bg-secondary/20 p-4 md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">Project AI governance</p><p className="mt-1 text-xs text-muted-foreground">External data egress harus diaktifkan eksplisit per project.</p></div>{loading && <Loader2 className="animate-spin text-primary" />}</div>
          {governance && <><div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-card p-3"><div><Label htmlFor="allow-external-ai">Allow external AI</Label><p className="mt-1 text-[11px] text-muted-foreground">Groq/Gemini dapat menerima context project yang sudah disanitasi.</p></div><Switch id="allow-external-ai" checked={governance.allowExternalAi} onCheckedChange={allowExternalAi => setGovernance(current => current ? { ...current, allowExternalAi } : current)} /></div><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><div><Label htmlFor="ai-budget">Monthly token budget</Label><Input id="ai-budget" type="number" min={1000} max={10000000} value={governance.aiMonthlyTokenBudget} onChange={event => setGovernance(current => current ? { ...current, aiMonthlyTokenBudget: Number(event.target.value) } : current)} /></div><div className="flex items-end"><Button onClick={() => void saveGovernance()} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Save />}Simpan policy</Button></div></div><div><div className="flex justify-between text-xs"><span>{governance.month}: {governance.usedTokens.toLocaleString('id-ID')} token</span><span>{governance.requestCount} request</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"><span className="block h-full origin-left rounded-full bg-primary" style={{ transform: `scaleX(${Math.min(1, governance.usedTokens / Math.max(1, governance.aiMonthlyTokenBudget))})` }} /></div></div><div className="space-y-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Audit terbaru</p>{governance.audits.length ? governance.audits.slice(0, 5).map(audit => <div key={audit.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-2 text-xs"><Badge variant="outline">{audit.status}</Badge><span className="font-semibold">{audit.operation}</span><span className="text-muted-foreground">{audit.provider} · {audit.model}</span><span className="ml-auto tabular-nums text-muted-foreground">{audit.inputTokens + audit.outputTokens} tokens</span></div>) : <p className="text-xs text-muted-foreground">Belum ada request AI pada project ini.</p>}</div></>}
          {governanceMessage && <p className="text-xs text-muted-foreground">{governanceMessage}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function SettingValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-border/60 bg-secondary/20 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1.5 truncate font-mono text-sm font-semibold">{value}</p></div>;
}
