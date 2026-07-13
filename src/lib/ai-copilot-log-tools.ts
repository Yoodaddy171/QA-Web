import fs from 'fs/promises';
import path from 'path';
import { db } from '@/lib/db';
import { cleanText, compact, parseDevLogError } from '@/lib/ai-copilot-utils';
import type { CopilotToolResult } from './ai-copilot-tools';

const MAX_ROWS = 12;

export async function readLogFileLines(filePath: string, maxLines = 80) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content.trim().split('\n').filter(Boolean).slice(-maxLines);
  } catch {
    return [];
  }
}

export async function getDevLogSummary(testCaseId: string): Promise<CopilotToolResult> {
  const id = cleanText(testCaseId);
  if (!id) return { name: 'getDevLogSummary', summary: 'Tidak ada testcase dipilih.', data: null, citations: [] };

  const logsDir = path.join(process.cwd(), 'mini-services', 'logs');
  const candidates = [
    path.join(logsDir, `${id}.current.jsonl`),
    path.join(logsDir, `${id}.previous.jsonl`),
    path.join(logsDir, `${id}.jsonl`),
  ];
  const lines = (await Promise.all(candidates.map(file => readLogFileLines(file, 100)))).flat();
  const parsed = lines.map((line) => {
    try {
      const item = JSON.parse(line);
      return {
        timestamp: item.timestamp,
        level: item.level,
        source: item.source,
        relativeMs: item.relativeMs,
      log: compact(typeof item.log === 'string' ? item.log : JSON.stringify(item.log), 180),
        network: item.network ? {
          method: item.network.method,
          status: item.network.status,
          url: item.network.url,
          success: item.network.success,
        } : null,
      };
    } catch {
      return { raw: compact(line, 300) };
    }
  }).slice(-24);

  const errorCount = parsed.filter((item: any) => item.level === 'SEVERE' || item.network?.success === false || Number(item.network?.status) >= 400).length;
  return {
    name: 'getDevLogSummary',
    summary: parsed.length ? `${parsed.length} log terbaru dibaca, ${errorCount} indikasi error.` : `Log untuk ${id} tidak ditemukan.`,
    data: { testCaseId: id, recentLogs: parsed, errorCount },
    citations: parsed.length ? [{ id, type: 'devlog', label: `DevLog ${id}`, testCaseId: id, description: `${parsed.length} recent rows` }] : [],
  };
}

export async function getAutomationHistory(projectId: string, testCaseId?: string): Promise<CopilotToolResult> {
  const logsDir = path.join(process.cwd(), 'mini-services', 'logs');
  let files: string[] = [];
  try {
    files = await fs.readdir(logsDir);
  } catch {
    return { name: 'getAutomationHistory', summary: 'Folder automation log tidak ditemukan.', data: [], citations: [] };
  }

  const testCases = await db.testCase.findMany({
    where: {
      projectId,
      ...(testCaseId ? { OR: [{ id: testCaseId }, { testCaseId }] } : {}),
    },
    select: { id: true, testCaseId: true, page: true, subMenu: true, status: true, module: { select: { name: true } } },
    take: testCaseId ? 5 : 80,
  });
  const idMap = new Map(testCases.flatMap(row => [[row.id, row], [row.testCaseId, row]]));
  const items: Array<Record<string, unknown>> = [];

  for (const file of files) {
    const match = file.match(/^(.+?)(?:\.(current|previous))?\.jsonl$/);
    if (!match) continue;
    const owner = idMap.get(match[1]);
    if (!owner) continue;
    const stat = await fs.stat(path.join(logsDir, file));
    items.push({
      file,
      kind: match[2] || 'legacy',
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
      testCaseId: owner.testCaseId,
      page: owner.page,
      module: owner.module?.name || '-',
      status: owner.status,
    });
  }

  items.sort((a, b) => new Date(String(b.updatedAt)).getTime() - new Date(String(a.updatedAt)).getTime());
  const latestByTestCase = new Map<string, Record<string, unknown>>();
  for (const item of items) {
    if (!latestByTestCase.has(String(item.testCaseId))) {
      latestByTestCase.set(String(item.testCaseId), item);
    }
  }
  const limited = Array.from(latestByTestCase.values()).slice(0, MAX_ROWS);
  return {
    name: 'getAutomationHistory',
    summary: limited.length ? `${limited.length} automation history terbaru ditemukan.` : 'Tidak ada automation history ditemukan.',
    data: limited,
    citations: limited.map(item => ({
      id: String(item.file),
      type: 'automation',
      label: String(item.testCaseId),
      testCaseId: String(item.testCaseId),
      description: `${item.kind} | ${item.updatedAt}`,
    })),
  };
}

export async function getLatestDevLogErrors(projectId: string): Promise<CopilotToolResult> {
  const logsDir = path.join(process.cwd(), 'mini-services', 'logs');
  let files: string[] = [];
  try {
    files = await fs.readdir(logsDir);
  } catch {
    return { name: 'getLatestDevLogErrors', summary: 'Folder devlog tidak ditemukan.', data: [], citations: [] };
  }

  const testCases = await db.testCase.findMany({
    where: { projectId },
    select: {
      id: true,
      testCaseId: true,
      page: true,
      subMenu: true,
      status: true,
      module: { select: { name: true } },
    },
  });
  const idMap = new Map(testCases.flatMap(row => [[row.id, row], [row.testCaseId, row]]));
  const items: Array<Record<string, unknown>> = [];

  for (const file of files) {
    const match = file.match(/^(.+?)(?:\.(current|previous))?\.jsonl$/);
    if (!match) continue;
    const owner = idMap.get(match[1]);
    if (!owner) continue;

    const filePath = path.join(logsDir, file);
    const [stat, lines] = await Promise.all([
      fs.stat(filePath),
      readLogFileLines(filePath, 120),
    ]);
    const parsedErrors = lines.map(parseDevLogError).filter(item => item.isError);
    if (!parsedErrors.length) continue;
    const uniqueNetworkErrors = new Map<string, typeof parsedErrors[number]>();
    const uniqueConsoleErrors = new Map<string, typeof parsedErrors[number]>();
    for (const item of parsedErrors) {
      if (item.type === 'network') uniqueNetworkErrors.set(item.key, item);
      else uniqueConsoleErrors.set(item.key, item);
    }
    const lastError = parsedErrors[parsedErrors.length - 1];

    items.push({
      file,
      kind: match[2] || 'legacy',
      size: stat.size,
      updatedAt: stat.mtime.toISOString(),
      testCaseId: owner.testCaseId,
      databaseId: owner.id,
      module: owner.module?.name || '-',
      page: owner.page,
      subMenu: owner.subMenu || '',
      status: owner.status,
      errorCount: parsedErrors.length,
      uniqueNetworkErrorCount: uniqueNetworkErrors.size,
      uniqueConsoleErrorCount: uniqueConsoleErrors.size,
      lastError: lastError.type === 'network'
        ? `${lastError.method || '-'} ${lastError.status || '-'} ${lastError.url}`
        : lastError.message,
    });
  }

  items.sort((a, b) => new Date(String(b.updatedAt)).getTime() - new Date(String(a.updatedAt)).getTime());
  const latestErrorByTestCase = new Map<string, Record<string, unknown>>();
  for (const item of items) {
    if (!latestErrorByTestCase.has(String(item.testCaseId))) {
      latestErrorByTestCase.set(String(item.testCaseId), item);
    }
  }
  const limited = Array.from(latestErrorByTestCase.values()).slice(0, MAX_ROWS);
  return {
    name: 'getLatestDevLogErrors',
    summary: limited.length
      ? `${limited.length} testcase memiliki devlog terbaru dengan indikasi error.`
      : 'Tidak ditemukan devlog terbaru dengan indikasi error.',
    data: limited,
    citations: limited.map(item => ({
      id: String(item.databaseId),
      type: 'testcase',
      label: String(item.testCaseId),
      testCaseId: String(item.testCaseId),
      description: `${item.module} | ${item.uniqueNetworkErrorCount || 0} network error | ${item.updatedAt}`,
    })),
  };
}
