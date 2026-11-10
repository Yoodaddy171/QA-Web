/** A debounce that survives navigation: flush before changing its storage identity. */
export class RunDraft {
  private pending: { key: string; value: string } | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  constructor(private write: (key: string, value: string) => void, private fail: () => void) {}
  stage(key: string, value: string) {
    if (this.pending?.key !== key && !this.flush()) return false;
    this.pending = { key, value }; clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 180); return true;
  }
  flush() {
    clearTimeout(this.timer);
    if (!this.pending) return true;
    try { this.write(this.pending.key, this.pending.value); this.pending = null; return true; }
    catch { this.fail(); return false; }
  }
  clear(key: string) { if (this.pending?.key === key) { clearTimeout(this.timer); this.pending = null; } }
}
export function readLocal(key: string) { try { return window.localStorage.getItem(key); } catch { return null; } }
export function resumeKey(scope: string, runId: string) { return `traceva.testRun.lastCase.v2.${scope}.${runId}`; }
