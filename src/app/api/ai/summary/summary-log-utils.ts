export type ClassifiedLog = {
  category: 'setup_cleanup' | 'non_blocking_error' | 'critical_error' | 'final_evidence' | 'pass_evidence' | 'general';
  line: string;
  score: number;
  index: number;
};

export const IMPORTANT_LOG_PATTERN = /error|failed|failure|exception|timeout|severe|warn|warning|status["': ]+(4|5)\d\d|"\s*success\s*"\s*:\s*false|success[:= ]+false/i;
const SETUP_CLEANUP_PATTERN = /setup|cleanup|clear[-_\s]?session|reset|remove|delete|logout|pre[-_\s]?condition|precondition|tear[-_\s]?down|teardown/i;
const STATIC_NOISE_PATTERN = /\/_next\/|\/assets\/|\/public\/|\/media\/|\/images\/|\/cdn-cgi\/rum|\.(js|css|png|jpe?g|svg|gif|webp|ico|woff2?|ttf|map)(\?|$)|data:image|blob:/i;
export const PASS_EVIDENCE_PATTERN = /passed|success|succeed|berhasil|as expected|status["': ]+20[01]|status=20[01]|"\s*success\s*"\s*:\s*true|success[:= ]+true/i;
const FAIL_EVIDENCE_PATTERN = /assertion.*fail|verification.*fail|not as expected|expected.*but|actual.*failed|test failed|severe|exception|uncaught|timeout/i;

export function limitText(value: string | null | undefined, maxChars: number) {
  const text = (value || '').trim();
  if (text.length <= maxChars) return text;
  const headLength = Math.floor(maxChars * 0.35);
  const tailLength = maxChars - headLength - 80;
  return [text.slice(0, headLength).trimEnd(), `\n...[dipotong: ${text.length - headLength - tailLength} karakter]...\n`, text.slice(-tailLength).trimStart()].join('');
}

export function compactLogLine(line: string) {
  const trimmed = line.trim();
  try {
    const parsed = JSON.parse(trimmed);
    const parts = [parsed.timestamp || parsed.time, parsed.level, parsed.network?.event, parsed.network?.method, parsed.network?.status ? `status=${parsed.network.status}` : '', parsed.network?.success === false ? 'success=false' : '', parsed.network?.url, parsed.log].filter(Boolean);
    return limitText(parts.join(' | ') || trimmed, 500);
  } catch {
    return limitText(trimmed, 500);
  }
}

function getLogStatus(line: string) {
  const match = line.match(/status(?:["':=\s]+)(\d{3})/i);
  return match ? Number(match[1]) : null;
}

function classifyCompactLine(line: string, index: number, total: number): ClassifiedLog {
  const status = getLogStatus(line);
  const isLate = total > 0 && index >= Math.floor(total * 0.85);
  const isSetupCleanup = SETUP_CLEANUP_PATTERN.test(line);
  const isStaticNoise = STATIC_NOISE_PATTERN.test(line);
  const hasFailureSignal = IMPORTANT_LOG_PATTERN.test(line) || FAIL_EVIDENCE_PATTERN.test(line);
  const hasPassSignal = PASS_EVIDENCE_PATTERN.test(line);
  const isHttpError = typeof status === 'number' && status >= 400;
  if (isLate || hasPassSignal) return { category: hasPassSignal ? 'pass_evidence' : 'final_evidence', line, score: hasPassSignal ? 90 : 75, index };
  if ((isSetupCleanup || isStaticNoise) && (isHttpError || hasFailureSignal)) return { category: 'non_blocking_error', line, score: 45, index };
  if (isSetupCleanup || isStaticNoise) return { category: 'setup_cleanup', line, score: 20, index };
  if (hasFailureSignal || isHttpError) return { category: 'critical_error', line, score: 85, index };
  return { category: 'general', line, score: 35, index };
}

export function formatClassifiedLogs(rawLogs: string, maxChars: number) {
  const lines = rawLogs.split('\n').map(compactLogLine).filter(Boolean);
  if (!lines.length) return '';
  const classified = lines.map((line, index) => classifyCompactLine(line, index, lines.length));
  const byCategory = (category: ClassifiedLog['category'], limit: number) => classified.filter(item => item.category === category).sort((a, b) => (b.score - a.score) || (b.index - a.index)).slice(0, limit).sort((a, b) => a.index - b.index).map(item => item.line);
  const sections = [
    ['FINAL / LATE EVIDENCE', [...byCategory('final_evidence', 18), ...byCategory('pass_evidence', 16)]],
    ['CRITICAL ERROR CANDIDATES', byCategory('critical_error', 28)],
    ['NON-BLOCKING SETUP/CLEANUP NOISE', byCategory('non_blocking_error', 18)],
    ['SETUP/CLEANUP OR STATIC NOISE', byCategory('setup_cleanup', 12)],
    ['RECENT GENERAL LOGS', classified.slice(-28).map(item => item.line)],
  ].filter(([, items]) => Array.isArray(items) && items.length > 0).map(([title, items]) => `## ${title}\n${Array.from(new Set(items as string[])).join('\n')}`);
  return limitText(sections.join('\n\n'), maxChars);
}
