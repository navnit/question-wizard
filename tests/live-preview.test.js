import test from 'node:test';
import assert from 'node:assert/strict';
import { LatestPreviewQueue } from '../src/live-preview.js';
test('continuous resizing renders intermediate work then the newest size, never a backlog', async () => {
  let release;
  const sizes = [];
  const queue = new LatestPreviewQueue(async size => {
    sizes.push(size);
    if (size === 100) await new Promise(resolve => release = resolve);
  });
  queue.request(100); queue.request(110); queue.request(120); queue.request(160);
  release(); await queue.flush();
  assert.deepEqual(sizes, [100, 160]);
});
test('leaving a paper cancels queued resizing work', async () => {
  let release; const sizes = [];
  const queue = new LatestPreviewQueue(async size => { sizes.push(size); await new Promise(resolve => release = resolve); });
  queue.request(100); queue.request(150); queue.cancel(); release(); await queue.flush();
  assert.deepEqual(sizes, [100]);
});
