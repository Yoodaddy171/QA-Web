import fs from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { maskSecret, updateEnvText } from '@/lib/ai-settings';

const PROVIDERS = new Set(['auto', 'groq', 'gemini', 'ollama']);
const ENV_PATH = path.join(process.cwd(), '.env');

export async function GET() {
  return NextResponse.json({
    provider: process.env.AI_PROVIDER || 'auto',
    groq: maskSecret(process.env.GROQ_API_KEY),
    gemini: maskSecret(process.env.GEMINI_API_KEY),
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || '',
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const provider = String(body.provider || 'auto').toLowerCase();
    if (!PROVIDERS.has(provider)) {
      return NextResponse.json({ error: 'Provider AI tidak valid.' }, { status: 400 });
    }

    const updates: Record<string, string> = { AI_PROVIDER: provider };
    const groqApiKey = String(body.groqApiKey || '').trim();
    const geminiApiKey = String(body.geminiApiKey || '').trim();
    if (groqApiKey) updates.GROQ_API_KEY = groqApiKey;
    if (geminiApiKey) updates.GEMINI_API_KEY = geminiApiKey;
    if (typeof body.ollamaBaseUrl === 'string') updates.OLLAMA_BASE_URL = body.ollamaBaseUrl.trim();

    const current = await fs.readFile(ENV_PATH, 'utf8').catch(() => '');
    await fs.writeFile(ENV_PATH, updateEnvText(current, updates), 'utf8');
    Object.assign(process.env, updates);

    return NextResponse.json({
      success: true,
      provider,
      groq: maskSecret(process.env.GROQ_API_KEY),
      gemini: maskSecret(process.env.GEMINI_API_KEY),
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL || '',
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Gagal menyimpan konfigurasi AI.',
    }, { status: 500 });
  }
}
