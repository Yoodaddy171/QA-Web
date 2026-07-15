export interface ParsedTestCaseId {
  prefix: string;
  number: number;
  width: number;
}

const TEST_CASE_ID_PATTERN = /^(.*?)-(\d+)$/;

export function parseTestCaseId(value: string): ParsedTestCaseId | null {
  const match = value.trim().match(TEST_CASE_ID_PATTERN);
  if (!match) return null;

  const number = Number.parseInt(match[2], 10);
  if (!Number.isFinite(number)) return null;

  return {
    prefix: match[1],
    number,
    width: match[2].length,
  };
}

export function formatTestCaseId(prefix: string, number: number, width: number) {
  return `${prefix}-${String(number).padStart(width, '0')}`;
}

export function resequenceTestCaseIds<T extends { id: string; testCaseId: string; createdAt?: Date | string }>(cases: T[]) {
  const groups = new Map<string, T[]>();

  for (const testCase of cases) {
    const parsed = parseTestCaseId(testCase.testCaseId);
    if (!parsed) continue;

    const groupKey = parsed.prefix.toUpperCase();
    const group = groups.get(groupKey) || [];
    group.push(testCase);
    groups.set(groupKey, group);
  }

  const updates: Array<{ id: string; oldTestCaseId: string; newTestCaseId: string }> = [];

  for (const group of groups.values()) {
    const parsedGroup = group
      .map(testCase => ({
        testCase,
        parsed: parseTestCaseId(testCase.testCaseId)!,
      }))
      .sort((a, b) => {
        const numberOrder = a.parsed.number - b.parsed.number;
        if (numberOrder !== 0) return numberOrder;
        return String(a.testCase.id).localeCompare(String(b.testCase.id));
      });
    const width = Math.max(3, ...parsedGroup.map(item => item.parsed.width));
    const prefix = parsedGroup[0]?.parsed.prefix;

    if (!prefix) continue;

    parsedGroup.forEach(({ testCase }, index) => {
      const newTestCaseId = formatTestCaseId(prefix, index + 1, width);
      if (newTestCaseId !== testCase.testCaseId) {
        updates.push({ id: testCase.id, oldTestCaseId: testCase.testCaseId, newTestCaseId });
      }
    });
  }

  return updates;
}
