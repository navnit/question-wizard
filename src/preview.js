import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
GlobalWorkerOptions.workerSrc = workerUrl;
export class PaperPreview {
  constructor(canvas, onPage) { this.canvas = canvas; this.onPage = onPage; this.page = 1; this.epoch = 0; }
  async clear() {
    ++this.epoch;
    this.rendering?.cancel();
    const old = this.loading;
    this.loading = null; this.document = null;
    this.canvas.hidden = true; this.onPage(0, 0);
    if (old) await old.destroy();
  }
  async paint(pdf, number, accept) {
    const page = await pdf.getPage(number);
    if (!accept()) return false;
    // Render off-screen, then swap one complete frame. No blank flashes.
    const buffer = document.createElement('canvas');
    const viewport = page.getViewport({ scale: 1.6 });
    buffer.width = viewport.width; buffer.height = viewport.height;
    const rendering = page.render({ canvasContext: buffer.getContext('2d'), viewport });
    this.rendering = rendering;
    try { await rendering.promise; }
    catch (error) { if (error.name === 'RenderingCancelledException') return false; throw error; }
    finally { if (this.rendering === rendering) this.rendering = null; }
    if (!accept()) return false;
    this.canvas.width = buffer.width; this.canvas.height = buffer.height;
    this.canvas.getContext('2d').drawImage(buffer, 0, 0);
    this.canvas.hidden = false;
    this.canvas.setAttribute('aria-label', `Generated paper, page ${number} of ${pdf.numPages}`);
    this.page = number; this.onPage(number, pdf.numPages);
    return true;
  }
  async load(bytes, accept = () => true, number = 1) {
    const epoch = ++this.epoch;
    this.rendering?.cancel();
    const task = getDocument({ data: bytes.slice(), isEvalSupported: false });
    const valid = () => epoch === this.epoch && accept();
    try {
      const pdf = await task.promise;
      if (!valid() || !(await this.paint(pdf, Math.max(1, Math.min(number, pdf.numPages)), valid))) { await task.destroy(); return false; }
      const old = this.loading;
      this.loading = task; this.document = pdf;
      if (old) await old.destroy();
      return true;
    } catch (error) { await task.destroy(); if (valid()) throw error; return false; }
  }
  async show(number) {
    const pdf = this.document;
    if (!pdf) return;
    const epoch = ++this.epoch;
    this.rendering?.cancel();
    await this.paint(pdf, Math.max(1, Math.min(number, pdf.numPages)), () => epoch === this.epoch && pdf === this.document);
  }
}
