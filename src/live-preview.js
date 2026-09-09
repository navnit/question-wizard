// Keep one render in flight and only the newest pending change.
export class LatestPreviewQueue {
  constructor(render) { this.render = render; this.pending = null; this.running = null; }
  request(value) {
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
  cancel() { this.pending = null; }
  async flush() { await this.running; }
}
