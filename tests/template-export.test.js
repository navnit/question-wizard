import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PDFDocument, decodePDFRawStream } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import JSZip from 'jszip';
import { createProject } from '../src/project.js';
import { normalizeRich } from '../src/rich-text.js';
import { exportPdf } from '../src/pdf-export.js';
import { exportDocx } from '../src/docx-export.js';
import { PAGE } from '../src/layout.js';

const assets = Object.fromEntries(await Promise.all(Object.entries({
  regular: 'LiberationSans-Regular.ttf', bold: 'LiberationSans-Bold.ttf',
  school: 'school-logo.jpg', cambridge: 'cambridge-logo.png',
}).map(async ([key, file]) => [key, new Uint8Array(await readFile(`public/assets/${file}`))])));

function fixture(template) {
  const paper = createProject().paper;
  paper.template = template;
  paper.targetMarks = 3;
  paper.questions[0].context = normalizeRich('', { allowBlank: false });
  paper.questions[0].parts = [
    { id: crypto.randomUUID(), text: normalizeRich('First prompt'), marks: 1, lines: 1, responseType: 'written' },
    { id: crypto.randomUUID(), text: normalizeRich('Second prompt'), marks: 2, lines: 1, responseType: 'written' },
  ];
  return paper;
}

async function pageText(bytes, pageNumber) {
  const task = getDocument({ data: bytes.slice(), useSystemFonts: false });
  const pdf = await task.promise;
  const content = await (await pdf.getPage(pageNumber)).getTextContent();
  const value = content.items.map(item => item.str).join(' ');
  await task.destroy();
  return value;
}

async function pageOperators(bytes, pageIndex = 1) {
  const pdf = await PDFDocument.load(bytes);
  const contents = pdf.getPage(pageIndex).node.Contents();
  return Array.from({ length: contents.size() }, (_, index) => Buffer.from(decodePDFRawStream(pdf.context.lookup(contents.get(index))).decode()).toString()).join('\n');
}

async function documentXml(paper) {
  const result = await exportPdf(paper, assets);
  const blob = await exportDocx(paper, result.plan, assets);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return zip.file('word/document.xml').async('string');
}

for (const id of ['classic', 'ledger', 'cards']) test(`${id} PDF uses brackets and retains content`, async () => {
  const result = await exportPdf(fixture(id), assets);
  const value = await pageText(result.bytes, 2);
  assert.match(value, /\[1\]/);
  assert.match(value, /\[2\]/);
  assert.match(value, /First prompt/);
  assert.match(value, /Second prompt/);

  const operators = await pageOperators(result.bytes);
  const fullWidthRects = [...operators.matchAll(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) re/g)]
    .filter(([, , , width]) => Math.abs(Number(width) - PAGE.body) < 0.01);
  assert.ok(fullWidthRects.length <= 1, 'question chrome must not redraw a full-width box for each subquestion');
});

test('cards PDF prints one question header and no editor-only name', async () => {
  const paper = fixture('cards');
  paper.questions[0].title = 'Private outline label';
  const result = await exportPdf(paper, assets);
  const value = await pageText(result.bytes, 2);
  assert.equal((value.match(/QUESTION 1/g) || []).length, 1);
  assert.doesNotMatch(value, /Private outline label/);

  const operators = await pageOperators(result.bytes);
  const colors = [...operators.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) (?:rg|RG)/g)].map(match => match.slice(1, 4).map(Number));
  assert.ok(colors.some(([r, g, b]) => Math.abs(r - 217 / 255) < 0.001 && Math.abs(g - r) < 0.001 && Math.abs(b - r) < 0.001), 'Cards header uses the approved gray');
  assert.ok(colors.every(([r, g, b]) => (r === 0 && g === 0 && b === 0) || (Math.abs(r - 217 / 255) < 0.001 && Math.abs(g - r) < 0.001 && Math.abs(b - r) < 0.001)), 'generated page chrome uses only black and approved gray');
});

for (const id of ['classic', 'ledger', 'cards']) test(`${id} Word output keeps marks and removes part dividers`, async () => {
  const xml = await documentXml(fixture(id));
  assert.match(xml, />\[1\]<\/w:t>/);
  assert.match(xml, />\[2\]<\/w:t>/);
  assert.match(xml, /w:insideH w:val="(?:nil|none)"/);
  assert.match(xml, /w:line="600"/);
  assert.match(xml, /w:bottom w:val="dotted"[^>]+w:color="000000"/);
});

test('cards Word output uses one gray native header and no private title', async () => {
  const paper = fixture('cards');
  paper.questions[0].title = 'Private outline label';
  const xml = await documentXml(paper);
  assert.match(xml, /w:fill="D9D9D9"/);
  assert.equal((xml.match(/>QUESTION 1<\/w:t>/g) || []).length, 1);
  assert.doesNotMatch(xml, /Private outline label/);
  assert.doesNotMatch(xml, /wps:|v:shape|w:txbxContent/);
});

test('ledger Word output uses a fixed 22-point number block instead of a full-height rail', async () => {
  const xml = await documentXml(fixture('ledger'));
  assert.match(xml, /w:trHeight w:val="440" w:hRule="exact"[\s\S]{0,1500}w:tcW w:type="dxa" w:w="440"[\s\S]{0,1500}w:fill="000000"/);
});

test('blank answer space exports without dotted borders in Word', async () => {
  const paper = fixture('classic');
  paper.questions.forEach(q => q.parts.forEach(part => { part.showAnswerLines = false; }));
  const xml = await documentXml(paper);
  assert.doesNotMatch(xml, /w:val="dotted"/);
  assert.match(xml, /w:line="600"/);
});

test('blank answer space omits dotted answer strokes in PDF', async () => {
  const paper = fixture('classic');
  const lined = await exportPdf(paper, assets);
  assert.match(await pageOperators(lined.bytes), /\[1 2\] 0 d/);
  paper.questions.forEach(q => q.parts.forEach(part => { part.showAnswerLines = false; }));
  const blank = await exportPdf(paper, assets);
  assert.doesNotMatch(await pageOperators(blank.bytes), /\[1 2\] 0 d/);
  assert.equal(blank.plan.pageCount, lined.plan.pageCount);
});
