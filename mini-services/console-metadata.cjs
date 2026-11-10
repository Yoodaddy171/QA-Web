const sensitiveKey = /authorization|cookie|token|password|secret|api[-_]?key|credential|session|pin/i;

function consoleLevel(type) {
  switch (type) {
    case 'error':
    case 'assert':
    case 'exception':
      return 'SEVERE';
    case 'warning':
    case 'warn':
      return 'WARNING';
    case 'debug':
    case 'verbose':
      return 'VERBOSE';
    default:
      return 'INFO';
  }
}

function sanitizeScriptUrl(value) {
  if (typeof value !== 'string' || !value || value.length > 4096) return undefined;
  try {
    const url = new URL(value);
    if (!['http:', 'https:', 'file:', 'webpack:', 'webpack-internal:'].includes(url.protocol)) return undefined;
    url.username = '';
    url.password = '';
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (sensitiveKey.test(key)) url.searchParams.set(key, '[REDACTED]');
    }
    return url.href;
  } catch {
    return undefined;
  }
}

function consoleMetadata(type, location) {
  const url = sanitizeScriptUrl(location?.url);
  if (!url) return { consoleDetails: { type } };
  const { lineNumber, columnNumber } = location;
  return {
    consoleDetails: {
      type,
      url,
      lineNumber: Number.isSafeInteger(lineNumber) && lineNumber >= 0 ? lineNumber : undefined,
      columnNumber: Number.isSafeInteger(columnNumber) && columnNumber >= 0 ? columnNumber : undefined,
    },
  };
}

module.exports = { consoleLevel, consoleMetadata };
