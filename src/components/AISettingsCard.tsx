'use client';

import { Bot, Eye, EyeOff, Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AISettingsCardProps {
  provider: string;
  setProvider: (value: string) => void;
  ollamaBaseUrl: string;
  setOllamaBaseUrl: (value: string) => void;
  groqApiKey: string;
  setGroqApiKey: (value: string) => void;
  geminiApiKey: string;
  setGeminiApiKey: (value: string) => void;
  groqStatus: string;
  geminiStatus: string;
  showKeys: boolean;
  keysLoading: boolean;
  saving: boolean;
  message: string;
  onToggleKeys: () => void;
  onSave: () => void;
}

export function AISettingsCard({ provider, setProvider, ollamaBaseUrl, setOllamaBaseUrl, groqApiKey, setGroqApiKey, geminiApiKey, setGeminiApiKey, groqStatus, geminiStatus, showKeys, keysLoading, saving, message, onToggleKeys, onSave }: AISettingsCardProps) {
  return (
    <Card variant="majestic">
      <CardHeader className="border-b border-border/40 pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-lg font-bold tracking-tight"><Bot className="h-5 w-5 text-primary" />AI Configuration</CardTitle>
          <Button type="button" variant="ghost" size="icon" onClick={onToggleKeys} disabled={keysLoading} aria-label={showKeys ? 'Sembunyikan API key' : 'Tampilkan API key'} title={showKeys ? 'Sembunyikan API key' : 'Tampilkan API key'}>
            {keysLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : showKeys ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4 md:grid-cols-2">
        <div className="space-y-2"><Label>Provider utama</Label><Select value={provider} onValueChange={setProvider}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Auto fallback</SelectItem><SelectItem value="groq">Groq</SelectItem><SelectItem value="gemini">Gemini</SelectItem><SelectItem value="ollama">Ollama</SelectItem></SelectContent></Select></div>
        <div className="space-y-2"><Label>Ollama Base URL</Label><Input value={ollamaBaseUrl} onChange={event => setOllamaBaseUrl(event.target.value)} placeholder="http://127.0.0.1:11434" /></div>
        <div className="space-y-2"><Label>Groq API Key</Label><Input type={showKeys ? 'text' : 'password'} value={groqApiKey} onChange={event => setGroqApiKey(event.target.value)} placeholder={groqStatus} autoComplete="off" /><p className="text-xs text-muted-foreground">{groqStatus}</p></div>
        <div className="space-y-2"><Label>Gemini API Key</Label><Input type={showKeys ? 'text' : 'password'} value={geminiApiKey} onChange={event => setGeminiApiKey(event.target.value)} placeholder={geminiStatus} autoComplete="off" /><p className="text-xs text-muted-foreground">{geminiStatus}</p></div>
        <div className="flex items-center gap-3 md:col-span-2"><Button type="button" onClick={onSave} disabled={saving} className="gap-2">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Simpan AI</Button>{message ? <p className="text-sm text-muted-foreground">{message}</p> : null}</div>
      </CardContent>
    </Card>
  );
}
