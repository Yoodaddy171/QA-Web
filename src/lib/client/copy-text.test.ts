import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './copy-text';

afterEach(() => vi.unstubAllGlobals());

describe('REPORT-CLIPBOARD: copy fallback', () => {
  function fallbackFixture(result: boolean | Error) {
    class Element { focus = vi.fn(); }
    const previous = new Element();
    const textarea = { style: {}, value: '', readOnly: false, focus: vi.fn(), select: vi.fn(), remove: vi.fn() };
    const execCommand = vi.fn(() => { if (result instanceof Error) throw result; return result; });
    vi.stubGlobal('HTMLElement', Element);
    vi.stubGlobal('document', { activeElement: previous, createElement: vi.fn(() => textarea), body: { appendChild: vi.fn() }, execCommand });
    return { textarea, previous, execCommand };
  }

  it('uses Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await copyText('Synthetic summary');
    expect(writeText).toHaveBeenCalledWith('Synthetic summary');
  });

  it.each(['unavailable', 'denied'])('falls back when Clipboard API is %s', async (mode) => {
    const fixture = fallbackFixture(true);
    vi.stubGlobal('navigator', mode === 'denied' ? { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } } : {});
    await copyText('Synthetic summary');
    expect(fixture.textarea.value).toBe('Synthetic summary');
    expect(fixture.execCommand).toHaveBeenCalledWith('copy');
    expect(fixture.textarea.remove).toHaveBeenCalledOnce();
    expect(fixture.previous.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it.each([false, new Error('Unsupported')])('cleans up and rejects unsuccessful legacy copy (%s)', async (result) => {
    const fixture = fallbackFixture(result);
    vi.stubGlobal('navigator', {});
    await expect(copyText('Synthetic summary')).rejects.toThrow();
    expect(fixture.textarea.remove).toHaveBeenCalledOnce();
    expect(fixture.previous.focus).toHaveBeenCalledOnce();
  });
});
