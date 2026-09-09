import test from 'node:test';
import assert from 'node:assert/strict';
import { cropPixels, printedSize } from '../src/image-editor.js';

test('crop percentages select the right pixels without crossing image edges', () => {
  assert.deepEqual(cropPixels(800, 600, { left: 25, top: 10, right: 75, bottom: 90 }), { x: 200, y: 60, width: 400, height: 480 });
  assert.throws(() => cropPixels(800, 600, { left: 80, top: 0, right: 20, bottom: 100 }), /crop/i);
});
test('rotated print dimensions preserve proportions within project limits', () => {
  assert.deepEqual(printedSize(600, 800, 150), { width: 150, height: 200 });
  const tall = printedSize(100, 2000, 150);
  assert.equal(tall.height, 600);
  assert.equal(tall.height / tall.width, 20);
  assert.throws(() => printedSize(1, 2000, 150), /narrow/i);
});
