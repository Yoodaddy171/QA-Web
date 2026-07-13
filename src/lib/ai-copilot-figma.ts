import { matchTokens, normalizeForMatch } from '@/lib/ai-copilot-utils';

function extractFigmaPages(content: string) {
  const lines = content.split(/\r?\n/);
  const pages: Record<string, string[]> = {};
  let currentPage = '';

  for (const line of lines) {
    const pageMatch = line.match(/^## Page:\s*(.+)$/);
    if (pageMatch) {
      currentPage = pageMatch[1].trim();
      pages[currentPage] = [];
      continue;
    }
    if (currentPage) pages[currentPage].push(line);
  }

  return pages;
}

function chooseFigmaPage(query: string, pageNames: string[]) {
  const normalizedQuery = normalizeForMatch(query);
  const direct = pageNames.find(page => normalizedQuery.includes(normalizeForMatch(page)));
  if (direct) return direct;

  const keywordMatch = pageNames.find(page => matchTokens(page).some(token => normalizedQuery.includes(token)));
  return keywordMatch || pageNames[0] || '';
}

function parseFigmaScreens(pageName: string, lines: string[]) {
  const screens: Array<{ name: string; text: string[] }> = [];
  let current: { name: string; text: string[] } | null = null;
  let inVisibleText = false;

  const pushCurrent = () => {
    if (!current) return;
    const combined = normalizeForMatch([current.name, ...current.text].join(' '));
    const isNoise = /^(fixed|frame \d+|components?|section \d+)$/i.test(current.name)
      || combined.length < 3
      || current.name === pageName;
    if (!isNoise) screens.push(current);
  };

  for (const line of lines) {
    const screenMatch = line.match(/^###\s*(.+)$/);
    if (screenMatch) {
      pushCurrent();
      current = { name: screenMatch[1].trim(), text: [] };
      inVisibleText = false;
      continue;
    }

    if (!current) continue;
    if (/^- Visible\/copy text:/.test(line)) {
      inVisibleText = true;
      continue;
    }
    if (/^- (Node|Type|Child nodes):/.test(line)) {
      inVisibleText = false;
      continue;
    }
    if (inVisibleText) {
      const textMatch = line.match(/^\s*-\s+(.+)$/);
      if (textMatch) current.text.push(textMatch[1].trim());
    }
  }
  pushCurrent();

  const seen = new Set<string>();
  return screens.filter((screen) => {
    const key = normalizeForMatch(screen.name);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 80);
}

function scoreScreenCoverage(screen: { name: string; text: string[] }, testCase: {
  page: string;
  subMenu: string | null;
  testAction: string;
  steps: string;
  expectedResult: string;
}) {
  const screenText = [screen.name, ...screen.text].join(' ');
  const screenTokens = matchTokens(screenText);
  const rowText = normalizeForMatch([
    testCase.page,
    testCase.subMenu,
    testCase.testAction,
    testCase.steps,
    testCase.expectedResult,
  ].join(' '));
  const rowTokens = new Set(matchTokens(rowText));
  const screenName = normalizeForMatch(screen.name);
  let score = 0;

  if (screenName && rowText.includes(screenName)) score += 8;
  for (const token of screenTokens) {
    if (rowTokens.has(token)) score += token.length >= 5 ? 2 : 1;
  }

  return score;
}
export { extractFigmaPages, chooseFigmaPage, parseFigmaScreens, scoreScreenCoverage };

