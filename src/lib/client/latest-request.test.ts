import { describe, expect, it } from 'vitest';
import { LatestRequest } from './latest-request';
describe('latest request ownership', () => {
  it('rejects a late response even if the transport ignored abort', async () => {
    const gate = new LatestRequest(); const writes: string[] = [];
    let finish!: () => void;
    const first = gate.begin();
    const old = new Promise<void>(resolve => { finish = resolve; }).then(() => { if (first.current()) writes.push('old-project'); });
    const second = gate.begin(); if (second.current()) writes.push('new-project'); finish(); await old;
    expect(writes).toEqual(['new-project']); expect(first.signal.aborted).toBe(true);
  });
  it('invalidates reads on unmount or project reset', () => { const gate = new LatestRequest(); const request = gate.begin(); gate.cancel(); expect(request.current()).toBe(false); });
});
