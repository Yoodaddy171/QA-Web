import { extractKeywords, limitText } from '@/lib/ai-context';

export interface CopilotCitationLike {
  id: string;
  type: string;
  label?: string;
  description?: string;
  testCaseId?: string;
}

const TESTCASE_ID_PATTERN = /\b[A-Z]{1,4}-\d{2,4}\b/g;
const ACTION_WORD_PATTERN = /\b(buat|buatkan|dibuatkan|generate|draft|tambahkan|create)\b/i;
const COVERAGE_STOPWORDS = new Set([
  'ada', 'atau', 'bagian', 'berdasarkan', 'case', 'cases', 'cek', 'cover', 'coverage', 'dari', 'dan', 'dengan',
  'di', 'figma', 'ini', 'knowledge', 'mencakup', 'page', 'screen', 'screens', 'sudah', 'test', 'testcase',
  'yang', 'untuk',
]);

function cleanText(value: unknown) {
  return String(value ?? '').trim();
}

function compact(value: unknown, max = 300) {
  return limitText(cleanText(value), max);
}

function normalizeForMatch(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchTokens(value: unknown) {
  return Array.from(new Set(
    normalizeForMatch(value)
      .split(/\s+/)
      .filter(token => token.length >= 3)
      .filter(token => !COVERAGE_STOPWORDS.has(token))
  ));
}

function uniqueCitations<T extends CopilotCitationLike>(citations: T[]): T[] {
  const map = new Map<string, T>();
  for (const citation of citations) {
    map.set(`${citation.type}:${citation.id}`, citation);
  }
  return Array.from(map.values());
}

function buildContainsFilters(query: string) {
  const keywords = extractKeywords(query).slice(0, 8);
  if (keywords.length === 0) return [];

  return keywords.flatMap(keyword => [
    { testCaseId: { contains: keyword } },
    { page: { contains: keyword } },
    { subMenu: { contains: keyword } },
    { testAction: { contains: keyword } },
    { steps: { contains: keyword } },
    { expectedResult: { contains: keyword } },
    { actualResult: { contains: keyword } },
    { status: { contains: keyword } },
    { priority: { contains: keyword } },
  ]);
}

function parseVisualIds(text: string) {
  return Array.from(new Set(cleanText(text).match(TESTCASE_ID_PATTERN) || []));
}

function questionNeedsSelectedContext(question: string) {
  return /\b(ini|detail|recording ini|screenshot ini|screen ini|evidence ini|summary ini|ringkas ini|testcase ini|case ini|devlog ini|log ini)\b/i.test(question);
}

function parseRequestedStatuses(question: string) {
  const lower = question.toLowerCase();
  const statuses: string[] = [];
  if (/\bnot done\b|belum selesai|belum done/.test(lower)) statuses.push('NOT DONE');
  if (/\bdone\b|sudah selesai/.test(lower) && !/\bnot done\b/.test(lower)) statuses.push('DONE');
  if (/in progress|sedang/.test(lower)) statuses.push('IN PROGRESS');
  if (/failed|gagal/.test(lower)) statuses.push('FAILED');
  if (/blocked|terblokir/.test(lower)) statuses.push('BLOCKED');
  if (/ready to retest|siap retest/.test(lower)) statuses.push('READY TO RETEST');
  return Array.from(new Set(statuses));
}

function parseRequestedPriorities(question: string) {
  const lower = question.toLowerCase();
  const priorities: string[] = [];
  if (/critical|kritis/.test(lower)) priorities.push('Critical');
  if (/\bhigh\b|tinggi/.test(lower)) priorities.push('High');
  if (/medium|sedang/.test(lower)) priorities.push('Medium');
  if (/\blow\b|rendah/.test(lower)) priorities.push('Low');
  return Array.from(new Set(priorities));
}

function isErrorLogLine(line: string) {
  const lower = line.toLowerCase();
  if (/error|failed|failure|exception|timeout|severe|uncaught|not as expected/.test(lower)) return true;
  try {
    const parsed = JSON.parse(line);
    const status = Number(parsed?.network?.status ?? parsed?.status);
    if (Number.isFinite(status) && status >= 400) return true;
    if (parsed?.network?.success === false || parsed?.success === false) return true;
    if (String(parsed?.level || '').toUpperCase() === 'SEVERE') return true;
  } catch {}
  return false;
}

function parseDevLogError(line: string) {
  try {
    const parsed = JSON.parse(line);
    const network = parsed?.network || null;
    const status = Number(network?.status ?? parsed?.status);
    const method = cleanText(network?.method || parsed?.method);
    const url = cleanText(network?.url || parsed?.url);
    const success = network?.success ?? parsed?.success;
    const level = cleanText(parsed?.level).toUpperCase();
    const message = compact(parsed?.log || parsed?.message || line, 140);
    const isNetworkError = Boolean(url) && ((Number.isFinite(status) && status >= 400) || success === false);
    const isConsoleError = level === 'SEVERE' || /error|failed|failure|exception|timeout|uncaught/i.test(message);
    const key = isNetworkError
      ? `network:${method || '-'}:${status || '-'}:${url}`
      : `console:${level || '-'}:${message}`;

    return {
      key,
      type: isNetworkError ? 'network' : 'console',
      method,
      status: Number.isFinite(status) ? status : null,
      url,
      message,
      isError: isNetworkError || isConsoleError,
    };
  } catch {
    return {
      key: `raw:${compact(line, 140)}`,
      type: 'console',
      method: '',
      status: null,
      url: '',
      message: compact(line, 140),
      isError: isErrorLogLine(line),
    };
  }
}

function modulePrefix(moduleName: string) {
  const name = moduleName.toLowerCase();
  if (/kds|kitchen|chef|dapur/.test(name)) return 'B-';
  if (/kiosk/.test(name)) return 'C-';
  if (/queue|antrian|display/.test(name)) return 'D-';
  if (/customer|mobile|menu|dining/.test(name)) return 'E-';
  return 'A-';
}

function parseTestCaseId(value: string) {
  const match = value.match(/^(.+?-)(\d+)$/);
  if (!match) return null;
  return { prefix: match[1], number: Number(match[2]), width: match[2].length };
}
export { cleanText, compact, normalizeForMatch, matchTokens, uniqueCitations, buildContainsFilters, parseVisualIds, questionNeedsSelectedContext, parseRequestedStatuses, parseRequestedPriorities, isErrorLogLine, parseDevLogError, modulePrefix, parseTestCaseId };
