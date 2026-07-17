import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const FIGMA_FILE_URL_PATTERN = /figma\.com\/(?:file|design)\/([a-zA-Z0-9_-]+)/;
const MAX_SUMMARY_FRAMES = 120;
const MAX_TEXT_LINES = 240;
const MAX_CONTENT_CHARS = 120_000;

type FigmaNode = {
  id: string;
  name: string;
  type: string;
  characters?: string;
  children?: FigmaNode[];
};

type FigmaFileResponse = {
  name?: string;
  lastModified?: string;
  thumbnailUrl?: string;
  document?: FigmaNode;
  components?: Record<string, { name?: string; description?: string }>;
  styles?: Record<string, { name?: string; description?: string }>;
};

const cleanText = (value: unknown) => String(value ?? '').trim();

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function parseFigmaFileKey(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return '';

  const match = trimmed.match(FIGMA_FILE_URL_PATTERN);
  if (match?.[1]) return match[1];

  if (/^[a-zA-Z0-9_-]{10,}$/.test(trimmed)) return trimmed;
  return '';
}

function safeDepth(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(Math.max(parsed, 1), 6);
}

function normalizeLine(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function collectTextNodes(node: FigmaNode | undefined, output: string[] = []) {
  if (!node || output.length >= MAX_TEXT_LINES) return output;

  if (node.type === 'TEXT' && node.characters) {
    const text = normalizeLine(node.characters);
    if (text && !output.includes(text)) output.push(text);
  }

  for (const child of node.children || []) {
    if (output.length >= MAX_TEXT_LINES) break;
    collectTextNodes(child, output);
  }

  return output;
}

function countNodes(node: FigmaNode | undefined): number {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((total, child) => total + countNodes(child), 0);
}

function collectFrameSummaries(page: FigmaNode) {
  const frames: Array<{ id: string; name: string; type: string; text: string[]; childCount: number }> = [];

  const visit = (node: FigmaNode) => {
    if (frames.length >= MAX_SUMMARY_FRAMES) return;

    const isScreenLike = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION'].includes(node.type);
    if (isScreenLike) {
      frames.push({
        id: node.id,
        name: node.name,
        type: node.type,
        text: collectTextNodes(node, []).slice(0, 12),
        childCount: countNodes(node) - 1,
      });
      return;
    }

    for (const child of node.children || []) {
      if (frames.length >= MAX_SUMMARY_FRAMES) break;
      visit(child);
    }
  };

  for (const child of page.children || []) {
    if (frames.length >= MAX_SUMMARY_FRAMES) break;
    visit(child);
  }

  return frames;
}

function limitContent(value: string) {
  return value.length > MAX_CONTENT_CHARS
    ? `${value.slice(0, MAX_CONTENT_CHARS)}\n\n[Knowledge truncated at ${MAX_CONTENT_CHARS} characters]`
    : value;
}

function buildKnowledgeContent(figmaFile: FigmaFileResponse, fileKey: string, sourceUrl: string, depth: number) {
  const pages = (figmaFile.document?.children || []).filter(node => node.type === 'CANVAS');
  const allText = collectTextNodes(figmaFile.document, []);
  const componentNames = Object.values(figmaFile.components || {})
    .map(component => cleanText(component.name))
    .filter(Boolean)
    .slice(0, 80);
  const styleNames = Object.values(figmaFile.styles || {})
    .map(style => cleanText(style.name))
    .filter(Boolean)
    .slice(0, 80);

  const lines = [
    `Source: Figma API`,
    `File key: ${fileKey}`,
    `Figma URL: ${sourceUrl || '-'}`,
    `File name: ${figmaFile.name || '-'}`,
    `Last modified: ${figmaFile.lastModified || '-'}`,
    `Fetch depth: ${depth}`,
    '',
    '# Figma Feature Map',
    '',
    '## Pages',
    ...(pages.length ? pages.map(page => `- ${page.name}`) : ['- No pages found']),
    '',
  ];

  for (const page of pages) {
    const frames = collectFrameSummaries(page);
    lines.push(`## Page: ${page.name}`);
    if (frames.length === 0) {
      lines.push('- No frame/component summary available at this depth.', '');
      continue;
    }

    for (const frame of frames) {
      lines.push(`### ${frame.name}`);
      lines.push(`- Node: ${frame.id}`);
      lines.push(`- Type: ${frame.type}`);
      lines.push(`- Child nodes: ${frame.childCount}`);
      if (frame.text.length > 0) {
        lines.push('- Visible/copy text:');
        lines.push(...frame.text.map(text => `  - ${text}`));
      }
      lines.push('');
    }
  }

  if (componentNames.length > 0) {
    lines.push('## Components');
    lines.push(...componentNames.map(name => `- ${name}`));
    lines.push('');
  }

  if (styleNames.length > 0) {
    lines.push('## Styles');
    lines.push(...styleNames.map(name => `- ${name}`));
    lines.push('');
  }

  if (allText.length > 0) {
    lines.push('## Text Inventory');
    lines.push(...allText.map(text => `- ${text}`));
  }

  return limitContent(lines.join('\n'));
}

export async function POST(req: NextRequest) {
  try {
    const token = process.env.FIGMA_ACCESS_TOKEN || process.env.FIGMA_API_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: 'FIGMA_ACCESS_TOKEN belum dikonfigurasi di environment server.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const projectId = cleanText(body.projectId);
    const figmaUrl = cleanText(body.figmaUrl || body.fileKey);
    const titleInput = cleanText(body.title);
    const depth = safeDepth(body.depth);
    const fileKey = parseFigmaFileKey(figmaUrl);

    if (!projectId) return validationError('projectId is required');
    if (!fileKey) return validationError('Figma URL atau file key tidak valid.');

    const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

    const endpoint = new URL(`https://api.figma.com/v1/files/${fileKey}`);
    endpoint.searchParams.set('depth', String(depth));

    const response = await fetch(endpoint, {
      headers: {
        'X-Figma-Token': token,
      },
      cache: 'no-store',
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: payload?.message || `Figma API error ${response.status}` },
        { status: response.status === 403 ? 403 : 502 }
      );
    }

    const figmaFile = payload as FigmaFileResponse;
    const content = buildKnowledgeContent(figmaFile, fileKey, figmaUrl, depth);
    const title = titleInput || `Figma Import - ${figmaFile.name || fileKey}`;
    const item = await db.projectKnowledge.create({ data: { projectId, type: 'FEATURE_MAP', title, content } });

    return NextResponse.json({
      ...item,
      figma: {
        fileKey,
        name: figmaFile.name || null,
        lastModified: figmaFile.lastModified || null,
        depth,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/project-knowledge/figma-sync error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to sync Figma knowledge',
    }, { status: 500 });
  }
}
