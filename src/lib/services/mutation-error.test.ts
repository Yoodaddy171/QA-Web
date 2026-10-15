import { afterEach, expect, it, vi } from 'vitest';
import { MutationError, mutationFailure, nextMutationTime } from './mutation-error';

afterEach(() => vi.restoreAllMocks());

it.each([400, 404, 409] as const)('6A-ERROR: preserves controlled domain status %s', status => {
  expect(mutationFailure(new MutationError(status, 'Controlled'), 'test', 'Fallback')).toEqual({ status, error: 'Controlled' });
});

it.each(['P2034', 'P1008', 'P2028', 'P2025'])('6A-RACE: maps %s to a safe reload conflict', code => {
  const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const result = mutationFailure({ code, message: 'SQL with synthetic-secret' }, 'mutation', 'Fallback');
  expect(result.status).toBe(409);
  expect(result.error).toContain('Muat ulang');
  expect(log).toHaveBeenCalledWith('mutation', { code });
});

it('6A-ERROR: generic failures expose neither SQL nor record data but retain a diagnostic code', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  expect(mutationFailure({ code: 'P2003', message: 'private SQL' }, 'mutation', 'Fallback')).toEqual({ status: 500, error: 'Fallback' });
  expect(log).toHaveBeenCalledWith('mutation', { code: 'P2003' });
});

it('6A-RACE: the optimistic version advances even if the clock does not', () => {
  const previous = new Date(Date.now() + 10_000);
  expect(nextMutationTime(previous).getTime()).toBe(previous.getTime() + 1);
});
