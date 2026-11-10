import { describe, expect, it } from 'vitest';
import {
  BASKETBALL_DROPZONE_STORAGE_KEY,
  getStoredBasketballDropzoneSetting,
} from './use-basketball-dropzone-setting';

describe('useBasketballDropzoneSetting', () => {
  it('defaults to true when no item exists in storage', () => {
    const mockStorage = {
      getItem: () => null,
    };
    expect(getStoredBasketballDropzoneSetting(mockStorage)).toBe(true);
  });

  it('returns true when storage item is "true"', () => {
    const mockStorage = {
      getItem: (key: string) => (key === BASKETBALL_DROPZONE_STORAGE_KEY ? 'true' : null),
    };
    expect(getStoredBasketballDropzoneSetting(mockStorage)).toBe(true);
  });

  it('returns false when storage item is "false"', () => {
    const mockStorage = {
      getItem: (key: string) => (key === BASKETBALL_DROPZONE_STORAGE_KEY ? 'false' : null),
    };
    expect(getStoredBasketballDropzoneSetting(mockStorage)).toBe(false);
  });
});
