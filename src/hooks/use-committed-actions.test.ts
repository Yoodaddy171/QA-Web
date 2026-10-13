import { expect, it, vi } from 'vitest';
import { createActionDispatcher } from './use-committed-actions';
it('keeps event identity while invoking the most recently committed callback', () => {
  const old = vi.fn((n:number)=>n+1), next = vi.fn((n:number)=>n+2);
  const dispatcher = createActionDispatcher({ select:old });
  const stable = dispatcher.actions.select;
  expect(old).not.toHaveBeenCalled(); expect(stable(1)).toBe(2);
  dispatcher.commit({select:next});expect(dispatcher.actions.select).toBe(stable);
  expect(stable(1)).toBe(3);expect(next).toHaveBeenCalledTimes(1);expect(old).toHaveBeenCalledTimes(1);
});
