import { cleanText } from '@/lib/ai-copilot-utils';
import { limitText } from '@/lib/ai-context';
import type { CopilotToolResult } from '@/lib/ai-copilot-tools';

export function formatToolResultsForPrompt(tools: CopilotToolResult[]) {
  return tools.map(tool => [
    `## TOOL: ${tool.name}`,
    `Summary: ${tool.summary}`,
    `Data: ${compactToolData(tool)}`,
  ].join('\n')).join('\n\n');
}

function compactValue(value: unknown, max = 90) {
  return cleanText(value).replace(/\s+/g, ' ').replace(/\|/g, '/').slice(0, max);
}

function formatRows<T>(rows: T[], formatter: (row: T, index: number) => string, maxRows = 12) {
  if (!rows.length) return '-';
  const visible = rows.slice(0, maxRows).map(formatter);
  const remaining = rows.length - visible.length;
  return remaining > 0 ? [...visible, `...+${remaining} more`].join('\n') : visible.join('\n');
}

function compactProjectOverview(data: any) {
  const project = data?.project;
  const modules = Array.isArray(data?.modules) ? data.modules : [];
  const statusGroups = Array.isArray(data?.statusGroups) ? data.statusGroups : [];
  const bugGroups = Array.isArray(data?.bugGroups) ? data.bugGroups : [];
  const priorityGroups = Array.isArray(data?.priorityGroups) ? data.priorityGroups : [];

  return [
    `project|${compactValue(project?.name)}|tc:${project?.counts?.testCases ?? '-'}|modules:${project?.counts?.modules ?? '-'}|bugs:${project?.counts?.bugFixItems ?? '-'}`,
    modules.length ? `modules:\n${formatRows(modules, (row: any) => `${compactValue(row.name, 40)}|tc:${row._count?.testCases ?? 0}|bugs:${row._count?.bugFixItems ?? 0}`, 16)}` : '',
    statusGroups.length ? `testcase_status:${statusGroups.map((row: any) => `${compactValue(row.status, 28)}=${row._count?.id ?? 0}`).join(',')}` : '',
    priorityGroups.length ? `priority:${priorityGroups.map((row: any) => `${compactValue(row.priority, 16)}=${row._count?.id ?? 0}`).join(',')}` : '',
    bugGroups.length ? `bug_status:${bugGroups.map((row: any) => `${compactValue(row.status, 28)}=${row._count?.id ?? 0}`).join(',')}` : '',
  ].filter(Boolean).join('\n');
}

function compactToolData(tool: CopilotToolResult) {
  const data: any = tool.data;

  if (tool.name === 'getProjectOverview') return compactProjectOverview(data);

  if (tool.name === 'searchTestCases' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${row.testCaseId}|${compactValue(row.module?.name || row.page, 28)}|${compactValue(row.subMenu, 24)}|${row.testType}|${row.status}|${row.priority}|action:${compactValue(row.testAction, 160)}|steps:${compactValue(row.steps, 220)}|expected:${compactValue(row.expectedResult, 180)}`
    ));
  }

  if (tool.name === 'getTestCaseDetail' && data) {
    return [
      `id|${data.testCaseId}|${compactValue(data.module?.name || data.page, 32)}|${compactValue(data.subMenu, 32)}|${data.testType}|${data.status}|${data.priority}|progress:${data.progress ?? '-'}`,
      `action|${compactValue(data.testAction, 320)}`,
      `steps|${compactValue(data.steps, 1000)}`,
      `expected|${compactValue(data.expectedResult, 700)}`,
      data.actualResult ? `actual|${compactValue(data.actualResult, 500)}` : '',
      data.stepLogs ? `stepLogs|${compactValue(data.stepLogs, 700)}` : '',
    ].filter(Boolean).join('\n');
  }

  if (tool.name === 'getBugFixes' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${row.testCaseId}|src:${row.sourceTestCaseId || '-'}|${compactValue(row.module?.name || row.page, 28)}|${row.status}|${row.priority}|${compactValue(row.testAction, 120)}`
    ));
  }

  if (tool.name === 'getStatusPriorityCases' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${row.testCaseId}|${compactValue(row.module?.name || row.page, 28)}|${compactValue(row.subMenu, 24)}|${row.testType}|${row.status}|${row.priority}|${compactValue(row.testAction, 120)}`
    ));
  }

  if (tool.name === 'getGenericExpectedResultCases' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${row.testCaseId}|${compactValue(row.module?.name || row.page, 28)}|${compactValue(row.subMenu, 24)}|${row.status}|${row.priority}|score:${row.score}|expected:${compactValue(row.expectedResult, 140)}`
    ));
  }

  if (tool.name === 'getWeakStepCases' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${row.testCaseId}|${compactValue(row.module?.name || row.page, 28)}|${compactValue(row.subMenu, 24)}|${row.status}|${row.priority}|score:${row.score}|lines:${row.lineCount}|steps:${compactValue(row.steps, 150)}`
    ));
  }

  if (tool.name === 'getModuleRisk' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${compactValue(row.moduleName, 32)}|risk:${row.riskScore}|tc:${row.total}|failed:${row.failed}|blocked:${row.blocked}|retest:${row.readyToRetest}|progress:${row.inProgress}|high:${row.highPriority}`
    ));
  }

  if (tool.name === 'getCoverageGap' && data) {
    const gaps = Array.isArray(data.topGaps) ? data.topGaps : [];
    return [
      `target|${data.target?.name || data.target?.type || '-'}|total:${data.totals?.total ?? 0}|positive:${data.totals?.positive ?? 0}|negative:${data.totals?.negative ?? 0}|negativeRatio:${data.totals?.negativeRatio ?? 0}`,
      gaps.length ? `topGaps:\n${formatRows(gaps, (row: any) => (
        `${compactValue(row.moduleName, 24)}|${compactValue(row.page, 28)}>${compactValue(row.subMenu, 24)}|tc:${row.total}|neg:${row.negative}|pos:${row.positive}|score:${row.gapScore}|samples:${(row.samples || []).map((sample: any) => sample.testCaseId).join(',')}`
      ), 10)}` : '',
    ].filter(Boolean).join('\n');
  }

  if (tool.name === 'getFigmaScreenCoverage' && data) {
    const screens = Array.isArray(data.screens) ? data.screens : [];
    return [
      `figma|${compactValue(data.figmaKnowledge?.title, 50)}|page:${compactValue(data.pageName, 32)}|module:${compactValue(data.targetModule?.name || '-', 24)}|screens:${data.totals?.figmaScreens ?? 0}|covered:${data.totals?.covered ?? 0}|missing:${data.totals?.missing ?? 0}`,
      formatRows(screens, (row: any) => (
        `${compactValue(row.screen, 36)}|${row.covered ? 'covered' : 'missing'}|matches:${(row.matches || []).map((match: any) => `${match.testCaseId}(score:${match.score})`).join(',') || '-'}|figmaText:${compactValue((row.figmaText || []).join(' / '), 90)}`
      ), 18),
    ].join('\n');
  }

  if (tool.name === 'getDevLogSummary' && data) {
    const recentLogs = Array.isArray(data.recentLogs) ? data.recentLogs : [];
    return [
      `devlog|${data.testCaseId}|errors:${data.errorCount ?? 0}|rows:${recentLogs.length}`,
      formatRows(recentLogs, (row: any) => (
        row.network
          ? `${row.relativeMs ?? '-'}|net|${row.network.method || '-'}|${row.network.status || '-'}|${compactValue(row.network.url, 90)}`
          : `${row.relativeMs ?? '-'}|${row.level || row.source || 'log'}|${compactValue(row.log || row.raw, 120)}`
      ), 16),
    ].join('\n');
  }

  if (tool.name === 'getAutomationHistory' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${row.testCaseId}|${row.kind}|${row.updatedAt}|${compactValue(row.module, 24)}|${row.status}|${compactValue(row.file, 80)}`
    ));
  }

  if (tool.name === 'getLatestDevLogErrors' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${row.testCaseId}|${compactValue(row.module, 24)}|${compactValue(row.subMenu || row.page, 28)}|${row.status}|networkErrors:${row.uniqueNetworkErrorCount || 0}|consoleErrors:${row.uniqueConsoleErrorCount || 0}|rawErrorLines:${row.errorCount}|${row.kind}|${row.updatedAt}|last:${compactValue(row.lastError, 120)}`
    ));
  }

  if (tool.name === 'searchProjectKnowledge' && Array.isArray(data)) {
    return formatRows(data, (row: any) => (
      `${row.type}|${compactValue(row.title, 60)}|${compactValue(row.content, 180)}`
    ), 8);
  }

  return limitText(JSON.stringify(data), 900);
}

