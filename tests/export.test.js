import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { exportPdf } from '../src/pdf-export.js';
import { PDFDocument } from 'pdf-lib';
import { samplePaper } from '../src/paper.js';
const assets = Object.fromEntries(await Promise.all(Object.entries({ regular: 'LiberationSans-Regular.ttf', bold: 'LiberationSans-Bold.ttf', school: 'school-logo.jpg', cambridge: 'cambridge-logo.png', skeleton: 'skeleton.png' }).map(async ([key, file]) => [key, new Uint8Array(await readFile(`public/assets/${file}`))])));

test('unsupported question characters are reported instead of exporting missing glyphs', async () => {
  const paper = samplePaper(); paper.questions[0].parts[0].text = 'Describe this 🦴.';
  await assert.rejects(exportPdf(paper, assets), /font does not support/);
});

for (const [stress, pages] of [[false, 7], [true, 9]]) test(`sample PDF export retains ${pages} planned pages`, async () => {
  const result = await exportPdf(samplePaper(stress), assets);
  const pdf = await PDFDocument.load(result.bytes);
  assert.equal(pdf.getPageCount(), pages);
  assert.equal(result.plan.totalMarks, 40);
});
