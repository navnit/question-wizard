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

test('typing waits briefly and renders only the latest text', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const frames = [], queue = new LatestPreviewQueue(async text => frames.push(text));
  queue.schedule('a'); t.mock.timers.tick(100); queue.schedule('ab');
  t.mock.timers.tick(179); assert.deepEqual(frames, []);
  t.mock.timers.tick(1); await queue.flush(); assert.deepEqual(frames, ['ab']);
});
test('continuous typing refreshes within 600 ms instead of waiting indefinitely', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const frames = [], queue = new LatestPreviewQueue(async text => frames.push(text));
  for (let i = 0; i < 6; i++) { queue.schedule(i); t.mock.timers.tick(100); }
  await queue.flush(); assert.deepEqual(frames, [5]);
});
test('immediate actions replace scheduled typing, and leaving cancels it', async t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'] });
  const frames = [], queue = new LatestPreviewQueue(async text => frames.push(text));
  queue.schedule('old'); await queue.request('now'); t.mock.timers.tick(1000);
  assert.deepEqual(frames, ['now']);
  queue.schedule('other paper'); queue.cancel(); t.mock.timers.tick(1000);
  await queue.flush(); assert.deepEqual(frames, ['now']);
});
