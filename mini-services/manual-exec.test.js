const { executeManual, boundedResponse, MAX_RESPONSE_BYTES } = require('./manual-exec');

describe('manual exec', () => {
  const invoke = (overrides = {}) => executeManual({ session: { active: true, ownerKey: 'owner' }, sessionInfo: { cdp: { send: async () => ({ result: { value: 42 } }) } }, ownerKey: 'owner', body: { expression: '42' }, ...overrides });
  it('requires active CDP session and matching owner', async () => {
    expect((await invoke({ session: null })).status).toBe(404);
    expect((await invoke({ sessionInfo: null })).status).toBe(404);
    expect((await invoke({ session: { active: false, ownerKey: 'owner' } })).status).toBe(404);
    expect((await invoke({ ownerKey: 'other' })).status).toBe(403);
  });
  it('validates expression and timeout', async () => {
    for (const body of [null, [], {}, { expression: ' ' }, { expression: 'a'.repeat(65537) }, ...[0, -1, 120001, 1.5, '30000'].map(timeoutMs => ({ expression: '42', timeoutMs }))]) {
      expect((await invoke({ body })).status).toBe(400);
    }
  });
  it('reuses supplied CDP with promise/value flags and bounded timeout', async () => {
    for (const timeoutMs of [undefined, 120000]) {
      const send = vi.fn().mockResolvedValue({ result: { value: false } });
      const result = await invoke({ sessionInfo: { cdp: { send } }, body: { expression: 'false', timeoutMs } });
      expect(send).toHaveBeenCalledWith('Runtime.evaluate', { expression: 'false', awaitPromise: true, returnByValue: true }, timeoutMs ?? 30000);
      expect(result.payload.result).toBe(false);
    }
  });
  it('returns JS exceptions at 200 but transport failures at 500 without retry', async () => {
    const send = vi.fn().mockResolvedValue({ exceptionDetails: { text: 'Uncaught' } });
    expect(await invoke({ sessionInfo: { cdp: { send } } })).toMatchObject({ status: 200, payload: { success: true, exceptionDetails: { text: 'Uncaught' } } });
    send.mockReset().mockRejectedValue(new Error('timeout'));
    expect(await invoke({ sessionInfo: { cdp: { send } } })).toMatchObject({ status: 500, payload: { outcome: 'UNKNOWN' } });
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('bounds oversized Unicode/object/exception results with an explicit marker', () => {
    const payload = boundedResponse({ success: true, result: { huge: '\u0000😀'.repeat(100000) }, exceptionDetails: { text: 'x'.repeat(100000) } });
    expect(payload.truncated).toBe(true);
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeLessThanOrEqual(MAX_RESPONSE_BYTES);
  });
});
