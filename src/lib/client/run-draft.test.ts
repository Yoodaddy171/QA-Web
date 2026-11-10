import { afterEach, describe, expect, it, vi } from 'vitest';
import { RunDraft, resumeKey } from './run-draft';
afterEach(() => vi.useRealTimers());
describe('navigation-safe execution drafts', () => {
  it('flushes edits made less than 180ms before navigation', () => {
    vi.useFakeTimers(); const write = vi.fn(); const draft = new RunDraft(write, vi.fn());
    draft.stage('case-a', 'latest notes'); expect(write).not.toHaveBeenCalled();
    expect(draft.flush()).toBe(true); expect(write).toHaveBeenCalledWith('case-a', 'latest notes');
    vi.runAllTimers(); expect(write).toHaveBeenCalledTimes(1);
  });
  it('never writes a case draft under the next case identity', () => {
    vi.useFakeTimers(); const write = vi.fn(); const draft = new RunDraft(write, vi.fn());
    draft.stage('a', 'old'); draft.stage('a', 'latest'); draft.stage('b', 'next'); draft.flush();
    expect(write.mock.calls).toEqual([['a', 'latest'], ['b', 'next']]);
  });
  it('retains the pending draft when storage fails and retries on flush', () => {
    vi.useFakeTimers(); const write = vi.fn().mockImplementationOnce(() => { throw new Error('quota'); }); const fail = vi.fn(); const draft = new RunDraft(write, fail);
    draft.stage('a', 'notes'); expect(draft.flush()).toBe(false); expect(fail).toHaveBeenCalledOnce(); expect(draft.flush()).toBe(true); expect(write).toHaveBeenLastCalledWith('a', 'notes');
  });
  it('cancels the pending debounce only for the saved case and isolates guest resume keys', () => {
    vi.useFakeTimers(); const write = vi.fn(); const draft = new RunDraft(write, vi.fn());
    draft.stage('a', 'saved'); draft.clear('a'); vi.runAllTimers(); expect(write).not.toHaveBeenCalled();
    expect(resumeKey('p:guest:1', 'r')).not.toBe(resumeKey('p:guest:2', 'r'));
  });
});
