import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { readFile } from 'node:fs/promises';
import { layoutPaper, PAGE, COLUMN, PAD, wrapText } from '../src/layout.js';
import { samplePaper, validatePaper } from '../src/paper.js';

const document = await PDFDocument.create();
document.registerFontkit(fontkit);
const regular = await document.embedFont(await readFile('public/assets/LiberationSans-Regular.ttf'));
const bold = await document.embedFont(await readFile('public/assets/LiberationSans-Bold.ttf'));
const measure = (text, size, isBold) => (isBold ? bold : regular).widthOfTextAtSize(text, size);

for (const stress of [false, true]) test(`pagination preserves all content and marks (long answers: ${stress})`, () => {
  const paper = samplePaper(stress);
  const plan = layoutPaper(paper, measure);
  const rows = plan.pages.flatMap(p => p.rows);
  assert.equal(rows.length, paper.questions.reduce((s, q) => s + q.parts.length, 0));
  assert.equal(rows.reduce((s, r) => s + r.marks, 0), 40);
  assert.deepEqual(validatePaper(paper).errors, []);
  assert.ok(plan.pages.length >= 3);
  for (const page of plan.pages) {
    assert.ok(page.rows.length);
    for (const row of page.rows) assert.ok(row.y + row.height <= PAGE.bottom + 0.01);
    assert.ok(page.rows[0].number, 'Every page starts with a question number');
    if (!page.rows[0].first) assert.match(page.rows[0].nodes[0].lines[0], /continued/);
  }
});

test('a single oversized subquestion is rejected instead of clipped', () => {
  const paper = samplePaper();
  paper.questions[1].parts[0].lines = 100;
  assert.throws(() => layoutPaper(paper, measure), /too tall/);
});
test('marks mismatch is detected', () => {
  const paper = samplePaper(); paper.questions[0].parts[0].marks = 5;
  assert.match(validatePaper(paper).errors[0], /39/);
});
test('unbreakable overflowing text is rejected', () => {
  assert.throws(() => wrapText('X'.repeat(200), 100, measure), /too wide/);
});

test('a permitted character count cannot overflow the cover title', () => {
  const paper = samplePaper(); paper.title = 'W'.repeat(45);
  assert.deepEqual(validatePaper(paper).errors, []);
  assert.throws(() => layoutPaper(paper, measure), /Paper title.*too wide/);
});

test('large marks fit inside the marks column without wrapping', () => {
  const paper = samplePaper();
  paper.questions = [{ context: '', parts: [{ text: 'Describe your investigation.', marks: 1000, lines: 2 }] }];
  paper.targetMarks = 1000;
  const row = layoutPaper(paper, measure).pages[0].rows[0];
  assert.ok(measure('[1000]', row.markSize || 11) <= COLUMN.marks - 12);
});

test('three-digit question numbers fit without wrapping in Word', () => {
  const paper = samplePaper();
  paper.questions = Array.from({ length: 100 }, () => ({ context: '', parts: [{ text: 'Answer this question.', marks: 1, lines: 0 }] }));
  paper.targetMarks = 100;
  const rows = layoutPaper(paper, measure).pages.flatMap(page => page.rows);
  const row = rows.find(row => row.number === '100');
  assert.ok(measure(row.number, row.numberSize || 11.5, true) <= COLUMN.number - 8);
});

for (const template of ['classic', 'ledger', 'cards']) test(`${template} uses shared answer and subquestion spacing`, () => {
  const paper = samplePaper();
  paper.template = template;
  const plan = layoutPaper(paper, measure);
  const rows = plan.pages.flatMap(page => page.rows);
  assert.equal(rows.find(row => !row.first).before, 10);
  const answers = rows.flatMap(row => row.nodes).find(node => node.type === 'answers');
  assert.equal(answers.leading, 30);
  assert.equal(answers.height, answers.count * 30 + 2);
});

test('page plans expose complete question fragments and card headers', () => {
  const paper = samplePaper(true);
  paper.template = 'cards';
  const plan = layoutPaper(paper, measure);
  const fragments = plan.pages.flatMap(page => page.fragments);
  assert.ok(fragments.some(fragment => fragment.continued));
  for (const page of plan.pages) {
    assert.equal(page.fragments.flatMap(fragment => fragment.rows).length, page.rows.length);
    for (const fragment of page.fragments) {
      assert.equal(fragment.headerHeight, 26);
      assert.equal(fragment.rows[0].fragmentStart, true);
      assert.equal(fragment.rows.at(-1).fragmentEnd, true);
      assert.ok(fragment.y + fragment.height <= PAGE.bottom + 0.01);
    }
  }
});

for (const template of ['classic', 'ledger', 'cards']) test(`${template} fills question pages by breaking between complete subquestions`, () => {
  const paper = samplePaper();
  paper.template = template;
  paper.questions = [
    { context: '', parts: [{ text: 'Explain your answer.', marks: 1, lines: 12 }] },
    { context: '', parts: [{ text: 'State one reason.', marks: 1, lines: 2 }, { text: 'Describe the method.', marks: 1, lines: 10 }] },
  ];
  const plan = layoutPaper(paper, measure);
  assert.deepEqual(plan.pages[0].rows.map(row => [row.question, row.part]), [[1, 'a'], [2, 'a']]);
  assert.equal(plan.pages[1].rows[0].part, 'b');
  assert.ok(plan.pages[1].fragments[0].continued);
  assert.deepEqual(plan.pages.flatMap(page => page.rows).map(row => row.nodes.find(node => node.type === 'answers').count), [12, 2, 10]);
  for (const page of plan.pages) assert.ok(page.top + page.used <= PAGE.bottom);
});

test('cover fits common rules and a short custom instruction without an extra page', () => {
  const paper = samplePaper();
  paper.instructions = { writing: 'pen', calculator: 'allowed', nameDate: true, diagrams: true, noAttachments: true, noCorrection: true, showWorking: true, ruler: true, custom: 'Check your answers.' };
  const plan = layoutPaper(paper, measure);
  assert.equal(plan.instructionPages.length, 0);
  assert.ok(plan.cover.marksY + 51 <= PAGE.bottom);
});

test('hiding answer lines preserves writing space and pagination', () => {
  const paper = samplePaper();
  const lined = layoutPaper(paper, measure);
  paper.questions.forEach(q => q.parts.forEach(part => { part.showAnswerLines = false; }));
  const blank = layoutPaper(paper, measure);
  assert.deepEqual(blank.pages.map(p => p.rows.map(r => [r.y, r.height])), lined.pages.map(p => p.rows.map(r => [r.y, r.height])));
  assert.ok(blank.pages.flatMap(p => p.rows).flatMap(r => r.nodes).filter(n => n.type === 'answers').every(n => n.visible === false));
});
