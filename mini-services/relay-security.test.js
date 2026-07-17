const {
  createRateLimiter,
  createRelaySecurity,
  parseAllowedOrigins,
  safeTokenEqual,
  validateRelayToken,
} = require('./relay-security');

const TOKEN = '0123456789abcdef0123456789abcdef';

function request({ token = TOKEN, origin = 'http://localhost:3000', address = '127.0.0.1' } = {}) {
  return {
    headers: { authorization: `Bearer ${token}`, origin },
    socket: { remoteAddress: address },
  };
}

describe('relay security boundary', () => {
  it('fails closed when the relay token is shorter than 32 bytes', () => {
    expect(() => validateRelayToken('short')).toThrow(/minimal 32 byte/);
  });

  it('uses constant-length token comparison semantics', () => {
    expect(safeTokenEqual(TOKEN, TOKEN)).toBe(true);
    expect(safeTokenEqual(`${TOKEN}x`, TOKEN)).toBe(false);
    expect(safeTokenEqual('x'.repeat(32), TOKEN)).toBe(false);
  });

  it('allows only configured browser origins while permitting non-browser clients without Origin', () => {
    const security = createRelaySecurity({ QA_RELAY_TOKEN: TOKEN });
    expect(security.authorize(request(), new URL('http://localhost/log')).allowed).toBe(true);
    expect(security.authorize(request({ origin: 'https://evil.example' }), new URL('http://localhost/log'))).toMatchObject({ allowed: false, status: 403 });
    expect(security.authorize(request({ origin: '' }), new URL('http://localhost/log'))).toMatchObject({ allowed: true });
  });

  it('rejects missing or invalid credentials', () => {
    const security = createRelaySecurity({ QA_RELAY_TOKEN: TOKEN });
    expect(security.authorize(request({ token: 'x'.repeat(32) }), new URL('http://localhost/log'))).toMatchObject({ allowed: false, status: 401 });
  });

  it('rate limits repeated requests per client address', () => {
    const consume = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(consume('client', 0).allowed).toBe(true);
    expect(consume('client', 1).allowed).toBe(true);
    expect(consume('client', 2).allowed).toBe(false);
    expect(consume('client', 1001).allowed).toBe(true);
  });

  it('supports an explicit origin allowlist', () => {
    expect([...parseAllowedOrigins('http://localhost:4000, http://127.0.0.1:4000')]).toEqual([
      'http://localhost:4000',
      'http://127.0.0.1:4000',
    ]);
  });
});
