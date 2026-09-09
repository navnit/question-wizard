import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Execute the real renderer while replacing only PDF.js/browser boundaries.
// Its Vite worker URL import is unavailable in the Node test runner.
const source = (await readFile(new URL('../src/preview.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\n/gm, '').replace('GlobalWorkerOptions.workerSrc = workerUrl;', '')
  .replace('export class PaperPreview', 'class PaperPreview');
function harness() {
  let resolve; const draws = [];
  const pdf = name => ({ name, numPages: 4, getPage: async number => ({
    getViewport: () => ({ width: 20, height: 30 }),
    render: ({ canvasContext }) => { canvasContext.name = `${name}:${number}`; return { promise: Promise.resolve(), cancel() {} }; },
  }) });
  const canvas = { getContext: () => ({ drawImage: buffer => draws.push(buffer.ctx.name) }), setAttribute() {} };
  const document = { createElement: () => { const node = { ctx: {} }; node.getContext = () => node.ctx; return node; } };
  const task = { promise: new Promise(r => resolve = r), destroy: async () => { task.destroyed = true; } };
  const Preview = new Function('getDocument', 'document', `${source}; return PaperPreview;`)(() => task, document);
  const preview = new Preview(canvas, () => {});
  const old = pdf('OLD'); preview.document = old; preview.loading = { destroy: async () => {} };
  return { preview, resolve, pdf, draws, task, old };
}
test('a cancelled replacement cannot report a committed current preview', async () => {
  const h = harness();
  const update = h.preview.load(new Uint8Array([1]), () => true, 2);
  await h.preview.show(3); h.resolve(h.pdf('NEW'));
  assert.equal(await update, false);
  assert.equal(h.preview.document, h.old);
  assert.equal(h.draws.at(-1), 'OLD:3');
  assert.equal(h.task.destroyed, true);
});
test('a successful replacement reports commitment only after its frame is visible', async () => {
  const h = harness();
  const update = h.preview.load(new Uint8Array([1]), () => true, 2);
  const next = h.pdf('NEW'); h.resolve(next);
  assert.equal(await update, true);
  assert.equal(h.preview.document, next);
  assert.equal(h.draws.at(-1), 'NEW:2');
});
