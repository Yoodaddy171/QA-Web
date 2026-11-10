/** Append pages without copying all prior events. Publish immutable snapshots at UI cadence. */
export class EventBuffer<T> {
  private pages: T[][] = [];
  private published: T[] = [];
  reset(events: T[] = []) { this.pages = []; this.published = events; }
  append(events: T[]) { if (events.length) this.pages.push(events); }
  snapshot(): T[] {
    if (this.pages.length) { this.published = this.published.concat(...this.pages); this.pages = []; }
    return this.published;
  }
}
