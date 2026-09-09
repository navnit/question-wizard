// Keep one render in flight and only the newest pending change.
export class LatestPreviewQueue {
  constructor(render) { this.render = render; this.pending = null; this.running = null; }
  schedule(value) {
    // A short trailing delay smooths typing, with a bound for long bursts.
    const started = this.scheduled?.started ?? Date.now();
    this.scheduled = { value, started };
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.request(this.scheduled.value), Math.max(0, Math.min(180, 600 - (Date.now() - started))));
  }
  request(value) {
    clearTimeout(this.timer); this.scheduled = null;
    this.pending = { value };
    if (!this.running) this.running = this.pump().finally(() => { this.running = null; });
    return this.running;
  }
  async pump() {
    while (this.pending) {
      const { value } = this.pending; this.pending = null;
      await this.render(value);
    }
  }
  cancel() { clearTimeout(this.timer); this.scheduled = null; this.pending = null; }
  async flush() { await this.running; }
}
