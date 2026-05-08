import { db } from '@/lib/db';

/**
 * Shared AI context utilities for all AI endpoints.
 * Provides reusable functions for building project context, reading knowledge, etc.
 */

// ============== TYPES ==============

interface KnowledgeRow {
  id: string;
  type: string;
  title: string;
  content: string;
  updatedAt: string;
}

export interface ProjectSummary {
  name: string;
  description: string | null;
  automationContext: string | null;
  totalTestCases: number;
  totalModules: number;
  totalBugFixes: number;
  modules: Array<{ id: string; name: string; testCaseCount: number; bugFixCount: number }>;
  statusDistribution: Record<string, number>;
  bugFixDistribution: Record<string, number>;
  priorityDistribution: Record<string, number>;
}

// ============== CONSTANTS ==============

const GENERIC_KEYWORDS = new Set([
  'add', 'and', 'api', 'atau', 'both', 'cache', 'case', 'correct', 'data', 'date',
  'dengan', 'developer', 'dia', 'fix', 'for', 'from', 'get', 'ini', 'input', 'include',
  'list', 'management', 'method', 'original', 'pass', 'provided', 'reduce', 'remove',
  'response', 'service', 'status', 'support', 'table', 'task', 'test', 'testcase',
  'total', 'update', 'user', 'validation', 'yang',
]);

// ============== UTILITY FUNCTIONS ==============

export function limitText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '…';
}

export function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !GENERIC_KEYWORDS.has(w));
  return [...new Set(words)].slice(0, 8);
}

function knowledgeScore(item: KnowledgeRow, keywords: string[]): number {
  let score = 0;
  // High-priority types always relevant
  if (['QA_RULES', 'TEST_STRATEGY'].includes(item.type)) score += 8;
  if (['DOMAIN_DICTIONARY', 'FEATURE_MAP'].includes(item.type)) score += 5;
  if (['API_DOCS', 'KNOWN_ISSUE'].includes(item.type)) score += 3;

  // Keyword matching
  const combined = `${item.title} ${item.content}`.toLowerCase();
  for (const kw of keywords) {
    if (combined.includes(kw)) score += 4;
  }
  return score;
}

// ============== MAIN FUNCTIONS ==============

/**
 * Read relevant ProjectKnowledge items for a given project.
 * Scores items by type priority and keyword relevance.
 */
export async function readRelevantKnowledge(
  projectId: string,
  contextHint: string,
  options?: { maxItems?: number; maxCharsPerItem?: number; maxTotalChars?: number }
): Promise<string> {
  const { maxItems = 8, maxCharsPerItem = 1200, maxTotalChars = 5000 } = options || {};
  const keywords = extractKeywords(contextHint);

  const rows = await db.$queryRawUnsafe<KnowledgeRow[]>(
    `SELECT id, type, title, content, updatedAt
     FROM ProjectKnowledge
     WHERE projectId = ?
     ORDER BY updatedAt DESC
     LIMIT 40`,
    projectId
  );

  if (rows.length === 0) return '';

  const relevant = rows
    .map(item => ({ item, score: knowledgeScore(item, keywords) }))
    .filter(entry => entry.score > 0 || keywords.length === 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems)
    .map(({ item }) => `### ${item.type}: ${item.title}\n${limitText(item.content, maxCharsPerItem)}`);

  return relevant.length > 0 ? limitText(relevant.join('\n\n'), maxTotalChars) : '';
}

/**
 * Build a comprehensive project summary for AI context.
 */
export async function buildProjectSummary(projectId: string): Promise<ProjectSummary | null> {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      description: true,
      automationContext: true,
      _count: { select: { testCases: true, modules: true, bugFixItems: true } },
    },
  });

  if (!project) return null;

  const [modules, statusGroups, bugStatusGroups, priorityGroups] = await Promise.all([
    db.module.findMany({
      where: { projectId },
      select: { id: true, name: true, _count: { select: { testCases: true, bugFixItems: true } } },
      orderBy: { name: 'asc' },
      take: 30,
    }),
    db.testCase.groupBy({
      by: ['status'],
      where: { projectId },
      _count: { id: true },
    }),
    db.bugFix.groupBy({
      by: ['status'],
      where: { projectId },
      _count: { id: true },
    }),
    db.testCase.groupBy({
      by: ['priority'],
      where: { projectId },
      _count: { id: true },
    }),
  ]);

  const statusDistribution: Record<string, number> = {};
  for (const g of statusGroups) statusDistribution[g.status] = g._count.id;

  const bugFixDistribution: Record<string, number> = {};
  for (const g of bugStatusGroups) bugFixDistribution[g.status] = g._count.id;

  const priorityDistribution: Record<string, number> = {};
  for (const g of priorityGroups) priorityDistribution[g.priority] = g._count.id;

  return {
    name: project.name,
    description: project.description || null,
    automationContext: project.automationContext || null,
    totalTestCases: project._count.testCases,
    totalModules: project._count.modules,
    totalBugFixes: project._count.bugFixItems,
    modules: modules.map(m => ({
      id: m.id,
      name: m.name,
      testCaseCount: m._count.testCases,
      bugFixCount: m._count.bugFixItems,
    })),
    statusDistribution,
    bugFixDistribution,
    priorityDistribution,
  };
}

/**
 * Format project summary into a text block for LLM context.
 */
export function formatProjectContext(summary: ProjectSummary): string {
  const lines: string[] = [];

  lines.push(`PROJECT: ${summary.name}`);
  if (summary.description) lines.push(`Description: ${limitText(summary.description, 300)}`);
  if (summary.automationContext) lines.push(`App Context: ${limitText(summary.automationContext, 300)}`);
  lines.push(`Totals: ${summary.totalTestCases} test cases, ${summary.totalModules} modules, ${summary.totalBugFixes} bug fixes`);

  // Status distribution
  const statusParts = Object.entries(summary.statusDistribution)
    .map(([status, count]) => `${status}=${count}`)
    .join(', ');
  if (statusParts) lines.push(`Test Status: ${statusParts}`);

  // Priority distribution
  const priorityParts = Object.entries(summary.priorityDistribution)
    .map(([priority, count]) => `${priority}=${count}`)
    .join(', ');
  if (priorityParts) lines.push(`Priority: ${priorityParts}`);

  // Bug fix status
  const bugParts = Object.entries(summary.bugFixDistribution)
    .map(([status, count]) => `${status}=${count}`)
    .join(', ');
  if (bugParts) lines.push(`Bug Fix Status: ${bugParts}`);

  // Modules
  if (summary.modules.length > 0) {
    lines.push(`\nMODULES:`);
    for (const m of summary.modules) {
      lines.push(`- ${m.name}: ${m.testCaseCount} testcases${m.bugFixCount > 0 ? `, ${m.bugFixCount} bugs` : ''}`);
    }
  }

  return lines.join('\n');
}

/**
 * Get sibling test cases (same page/subMenu) for context.
 */
export async function getSiblingTestCases(
  projectId: string,
  page: string,
  subMenu: string | null | undefined,
  excludeId?: string,
  limit = 6
) {
  return db.testCase.findMany({
    where: {
      projectId,
      page,
      ...(subMenu ? { subMenu } : {}),
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      testCaseId: true,
      testType: true,
      testAction: true,
      steps: true,
      expectedResult: true,
      status: true,
      priority: true,
      module: { select: { name: true } },
    },
    orderBy: { testCaseId: 'asc' },
    take: limit,
  });
}

/**
 * Get recent bug fixes for a project to inform test generation.
 */
export async function getRecentBugFixes(projectId: string, limit = 6) {
  return db.bugFix.findMany({
    where: { projectId, status: { not: 'VERIFIED & FIXED' } },
    select: {
      testCaseId: true,
      page: true,
      subMenu: true,
      testAction: true,
      priority: true,
      status: true,
      module: { select: { name: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });
}
