const crypto = require('crypto');

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseAllowedOrigins(value) {
  const configured = String(value || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_ALLOWED_ORIGINS);
}

function validateRelayToken(value) {
  const token = String(value || '');
  if (Buffer.byteLength(token, 'utf8') < 32) {
    throw new Error('QA_RELAY_TOKEN wajib berupa token acak minimal 32 byte. Relay dihentikan agar tidak berjalan tanpa autentikasi.');
  }
  return token;
}

function safeTokenEqual(actual, expected) {
  const actualBuffer = Buffer.from(String(actual || ''), 'utf8');
  const expectedBuffer = Buffer.from(String(expected || ''), 'utf8');
  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function requestToken(req, requestUrl) {
  const authorization = String(req.headers.authorization || '');
  if (/^Bearer\s+/i.test(authorization)) return authorization.replace(/^Bearer\s+/i, '').trim();
  return requestUrl.searchParams.get('access_token') || '';
}

function createRateLimiter({ limit, windowMs }) {
  const buckets = new Map();
  return function consume(key, now = Date.now()) {
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return { allowed: true, remaining: Math.max(0, limit - 1), resetAt: now + windowMs };
    }
    current.count += 1;
    if (current.count > limit) return { allowed: false, remaining: 0, resetAt: current.resetAt };
    return { allowed: true, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
  };
}

function createRelaySecurity(env = process.env) {
  const token = validateRelayToken(env.QA_RELAY_TOKEN || env.NEXT_PUBLIC_QA_RELAY_TOKEN);
  const allowedOrigins = parseAllowedOrigins(env.QA_RELAY_ALLOWED_ORIGINS);
  const requestLimit = positiveInteger(env.QA_RELAY_RATE_LIMIT, 240);
  const rateWindowMs = positiveInteger(env.QA_RELAY_RATE_WINDOW_MS, 60_000);
  const consumeRate = createRateLimiter({ limit: requestLimit, windowMs: rateWindowMs });

  return {
    host: String(env.QA_RELAY_HOST || '127.0.0.1'),
    port: positiveInteger(env.QA_RELAY_PORT, 3001),
    token,
    allowedOrigins,
    allowBrowserLaunch: env.QA_RELAY_ALLOW_BROWSER_LAUNCH === '1',
    maxBodyBytes: positiveInteger(env.QA_RELAY_MAX_BODY_BYTES, 1_000_000),
    maxWsPayloadBytes: positiveInteger(env.QA_RELAY_MAX_WS_PAYLOAD_BYTES, 1_000_000),
    maxWsConnections: positiveInteger(env.QA_RELAY_MAX_WS_CONNECTIONS, 8),
    maxWsConnectionsPerIp: positiveInteger(env.QA_RELAY_MAX_WS_CONNECTIONS_PER_IP, 4),
    maxWsBufferedBytes: positiveInteger(env.QA_RELAY_MAX_WS_BUFFERED_BYTES, 1_000_000),
    isAllowedOrigin(origin) {
      return !origin || allowedOrigins.has(origin);
    },
    authenticate(req, requestUrl) {
      return safeTokenEqual(requestToken(req, requestUrl), token);
    },
    authorize(req, requestUrl) {
      const origin = String(req.headers.origin || '');
      if (!this.isAllowedOrigin(origin)) return { allowed: false, status: 403, error: 'Origin tidak diizinkan.' };
      if (!this.authenticate(req, requestUrl)) return { allowed: false, status: 401, error: 'Relay token tidak valid.' };
      const ip = req.socket?.remoteAddress || 'unknown';
      const rate = consumeRate(ip);
      if (!rate.allowed) return { allowed: false, status: 429, error: 'Terlalu banyak request ke relay.', retryAfter: Math.max(1, Math.ceil((rate.resetAt - Date.now()) / 1000)) };
      return { allowed: true, ip, rate };
    },
    applyCors(req, res) {
      const origin = String(req.headers.origin || '');
      if (origin && allowedOrigins.has(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Max-Age', '600');
    },
    ownerKey(req) {
      const address = req.socket?.remoteAddress || 'unknown';
      return crypto.createHash('sha256').update(`${address}\0${token}`).digest('hex');
    },
  };
}

module.exports = {
  DEFAULT_ALLOWED_ORIGINS,
  createRateLimiter,
  createRelaySecurity,
  parseAllowedOrigins,
  requestToken,
  safeTokenEqual,
  validateRelayToken,
};
