import { NextResponse } from 'next/server';
import { maskSecret, normalizeLocalOllamaUrl } from '@/lib/ai-settings';

export async function GET() {
  let ollamaBaseUrl = '';
  let ollamaError = '';
  try {
    ollamaBaseUrl = normalizeLocalOllamaUrl(process.env.OLLAMA_BASE_URL);
  } catch (error) {
    ollamaError = error instanceof Error ? error.message : 'Konfigurasi Ollama tidak aman.';
  }

  return NextResponse.json({
    provider: process.env.AI_PROVIDER || 'auto',
    groq: maskSecret(process.env.GROQ_API_KEY),
    gemini: maskSecret(process.env.GEMINI_API_KEY),
    ollamaBaseUrl,
    ollamaError,
    readOnly: true,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function PUT() {
  return NextResponse.json({
    error: 'Perubahan secret melalui HTTP dinonaktifkan. Konfigurasikan AI pada environment host dan restart aplikasi.',
  }, { status: 405, headers: { Allow: 'GET', 'Cache-Control': 'no-store' } });
}
