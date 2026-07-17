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
