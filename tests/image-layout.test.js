import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, parseProject } from '../src/project.js';
import { modernizeProject } from '../src/content.js';
import { diagramWidthLimit, layoutMetrics, layoutPaper } from '../src/layout.js';
import { readFile } from 'node:fs/promises';
import { exportPdf } from '../src/pdf-export.js';
import { exportDocx } from '../src/docx-export.js';
import { PDFDocument, decodePDFRawStream } from 'pdf-lib';
import JSZip from 'jszip';
import { questionView, imageDimensions } from '../src/views.js';
const measure = (text, size) => text.length * size / 2;
function paper(layout) {
  const p = createProject().paper;
  Object.assign(p.questions[0], { imageLayout: layout, images: [
    { name: 'skeleton', width: 400, height: 200 },
    { name: 'skeleton', width: 100, height: 150 },
    { name: 'skeleton', width: 80, height: 90 },
  ] });
  return p;
}
test('horizontal images wrap in pairs, fit proportionally, and use the tallest image for row spacing', () => {
  const p = paper('horizontal'), before = structuredClone(p);
  const rows = layoutPaper(p, measure).pages[0].rows[0].nodes.filter(n => n.type === 'image-row');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].images.length, 2);
  assert.equal(rows[1].images.length, 1);
  assert.ok(Math.abs(rows[0].images[0].width - 218.64) < .001);
  assert.ok(Math.abs(rows[0].images[0].height - 109.32) < .001);
  assert.equal(rows[0].images[1].width, 100, 'Small diagrams must not be enlarged');
  assert.ok(rows[0].images[1].x >= rows[0].images[0].x + rows[0].images[0].width + 12);
  assert.equal(rows[0].height, 160);
  assert.equal(rows[1].height, 100);
  assert.deepEqual(p, before, 'Fitting must not overwrite preferred vertical dimensions');
});
test('old drafts default to vertical and preserve their printed image sizes', () => {
  const p = paper(undefined);
  const nodes = layoutPaper(p, measure).pages[0].rows[0].nodes.filter(n => n.type === 'image');
  assert.deepEqual(nodes.map(n => [n.width, n.imageHeight]), [[400, 200], [100, 150], [80, 90]]);
  const project = createProject();
  assert.equal(modernizeProject(project).paper.questions[0].imageLayout, 'vertical');
});
test('image arrangement survives import and invalid arrangement values are rejected', () => {
  const project = createProject(); project.paper.questions[0].imageLayout = 'horizontal';
  assert.equal(parseProject(JSON.stringify(project)).paper.questions[0].imageLayout, 'horizontal');
  project.paper.questions[0].imageLayout = 'diagonal';
  assert.throws(() => parseProject(JSON.stringify(project)), /image layout/);
});

const assets = Object.fromEntries(await Promise.all(Object.entries({ regular: 'LiberationSans-Regular.ttf', bold: 'LiberationSans-Bold.ttf', school: 'school-logo.jpg', cambridge: 'cambridge-logo.png', skeleton: 'skeleton.png' }).map(async ([key, file]) => [key, new Uint8Array(await readFile(`public/assets/${file}`))])));
test('PDF draws every horizontal diagram and Word puts paired drawings in a borderless row', async () => {
  const p = paper('horizontal');
  p.targetMarks = 1; p.questions[0].parts[0].text = 'Compare these diagrams.';
  const result = await exportPdf(p, assets);
  const pdf = await PDFDocument.load(result.bytes);
  const contents = pdf.getPage(1).node.Contents();
  const stream = Array.from({ length: contents.size() }, (_, i) => Buffer.from(decodePDFRawStream(pdf.context.lookup(contents.get(i))).decode()).toString()).join('');
  assert.equal((stream.match(/ Do\n/g) || []).length, 3, 'PDF must draw all three diagrams');
  const blob = await exportDocx(p, result.plan, assets);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const xml = await zip.file('word/document.xml').async('string');
  const rows = xml.match(/<w:tr>[^]*?<\/w:tr>/g).filter(row => row.includes('<w:drawing>'));
  assert.deepEqual(rows.map(row => (row.match(/<w:drawing>/g) || []).length), [2, 2, 1]);
  assert.ok(rows[1].includes('w:val="nil"') || rows[1].includes('w:val="none"'), 'Image grid must have no printed borders');
});
test('editor offers arrangement and reports fitted printed dimensions with a bounded slider', () => {
  const project = createProject(); project.paper = paper('horizontal');
  project.images.skeleton = { dataUrl: 'data:image/png;base64,AA==' };
  const html = questionView(project, project.paper.questions[0]);
  assert.match(html, /Image arrangement/);
  assert.match(html, /value="horizontal" selected/);
  assert.match(html, /max="218"/);
  assert.equal(imageDimensions(project.paper.questions[0].images[0], project.paper.questions[0]), '7.7 × 3.9 cm on paper');
});

test('Cards diagram limits follow its wider measured content area', () => {
  const p = paper('horizontal');
  p.template = 'cards';
  const limit = diagramWidthLimit(p.questions[0], p.template);
  assert.ok(limit <= (layoutMetrics(p).textWidth - 12) / 2);
  assert.ok(limit > diagramWidthLimit(p.questions[0], 'ledger'));
});
