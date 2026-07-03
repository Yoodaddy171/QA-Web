import Groq from 'groq-sdk';

export type AIProviderName = 'groq' | 'gemini' | 'ollama';

export interface AIJsonRequest {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  models?: Partial<Record<AIProviderName, string>>;
  repairSchemaHint?: string;
}

export interface AIJsonResult {
  provider: AIProviderName;
  model: string;
  raw: string;
  parsed: Record<string, unknown>;
}

function getProviderPreference(): AIProviderName[] {
  const requested = String(process.env.AI_PROVIDER || 'auto').toLowerCase();
  if (requested === 'groq' || requested === 'gemini' || requested === 'ollama') return [requested];

  const providers: AIProviderName[] = [];
  if (process.env.GROQ_API_KEY) providers.push('groq');
  if (process.env.GEMINI_API_KEY) providers.push('gemini');
  if (process.env.OLLAMA_BASE_URL) providers.push('ollama');
  return providers.length ? providers : ['groq'];
}

function parseJsonObject(raw: string) {
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {}

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) {
    const parsed = JSON.parse(fenced);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const parsed = JSON.parse(trimmed.slice(start, end + 1));
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  }

  throw new Error('Provider tidak mengembalikan JSON object yang valid.');
}

async function repairJson(provider: AIProviderName, raw: string, original: AIJsonRequest) {
  const repairRequest: AIJsonRequest = {
    system: 'Return ONLY one valid JSON object. Do not add markdown.',
    user: `Repair this response into valid JSON object following this intended schema: ${original.repairSchemaHint || '{"answer":"string","drafts":[],"actionDrafts":[]}'}

BROKEN RESPONSE:
${raw}`,
    temperature: 0,
    maxTokens: Math.min(original.maxTokens || 1200, 1200),
    model: original.model,
    models: original.models,
    repairSchemaHint: original.repairSchemaHint,
  };
  const repaired = await callProvider(provider, repairRequest, false);
  return repaired;
}

async function callGroq(request: AIJsonRequest) {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY belum dikonfigurasi.');
  const model = request.models?.groq || request.model || process.env.GROQ_COPILOT_MODEL || process.env.GROQ_CHAT_MODEL || process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const completion = await groq.chat.completions.create({
    model,
    temperature: request.temperature ?? 0.25,
    max_tokens: request.maxTokens ?? 1600,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: request.system },
      { role: 'user', content: request.user },
    ],
  });
  return { model, raw: completion.choices[0]?.message?.content || '{}' };
}

async function callGemini(request: AIJsonRequest) {
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY belum dikonfigurasi.');
  const model = request.models?.gemini || request.model || process.env.GEMINI_COPILOT_MODEL || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{
        role: 'user',
        parts: [{ text: `${request.system}\n\n${request.user}` }],
      }],
      generationConfig: {
        temperature: request.temperature ?? 0.25,
        maxOutputTokens: request.maxTokens ?? 1600,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!response.ok) throw new Error(`Gemini error ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const raw = payload?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text).filter(Boolean).join('\n') || '{}';
  return { model, raw };
}

async function callOllama(request: AIJsonRequest) {
  const baseUrl = (process.env.OLLAMA_BASE_URL || '').replace(/\/$/, '');
  if (!baseUrl) throw new Error('OLLAMA_BASE_URL belum dikonfigurasi.');
  const model = request.models?.ollama || request.model || process.env.OLLAMA_COPILOT_MODEL || process.env.OLLAMA_MODEL || 'llama3.1';
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      format: 'json',
      options: {
        temperature: request.temperature ?? 0.15,
        num_predict: request.maxTokens ?? 1600,
      },
      messages: [
        { role: 'system', content: request.system },
        { role: 'user', content: request.user },
      ],
    }),
  });
  if (!response.ok) throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  return { model, raw: payload?.message?.content || payload?.response || '{}' };
}

async function callProvider(provider: AIProviderName, request: AIJsonRequest, allowRepair = true): Promise<AIJsonResult> {
  const result = provider === 'groq'
    ? await callGroq(request)
    : provider === 'gemini'
      ? await callGemini(request)
      : await callOllama(request);

  try {
    return {
      provider,
      model: result.model,
      raw: result.raw,
      parsed: parseJsonObject(result.raw),
    };
  } catch (error) {
    if (!allowRepair) throw error;
    return repairJson(provider, result.raw, request);
  }
}

export async function generateCopilotJson(request: AIJsonRequest): Promise<AIJsonResult> {
  const errors: string[] = [];
  for (const provider of getProviderPreference()) {
    try {
      return await callProvider(provider, request);
    } catch (error) {
      errors.push(`${provider}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
  throw new Error(errors.join(' | ') || 'Tidak ada AI provider yang bisa dipakai.');
}
