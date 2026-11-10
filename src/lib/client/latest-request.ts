/** Owns one request at a time; aborted responses can still resolve in mocks/proxies. */
export class LatestRequest {
  private version = 0;
  private controller: AbortController | null = null;
  begin() {
    this.cancel();
    const version = this.version;
    const controller = new AbortController();
    this.controller = controller;
    return { signal: controller.signal, current: () => version === this.version && !controller.signal.aborted };
  }
  cancel() { this.version++; this.controller?.abort(); this.controller = null; }
}
