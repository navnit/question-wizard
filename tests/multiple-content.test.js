import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createProject, backupProject, parseProject, dataUrl } from '../src/project.js';
import { exportPdf } from '../src/pdf-export.js';
import { modernizeProject } from '../src/content.js';
import { normalizeRich, plainText } from '../src/rich-text.js';
const assets = Object.fromEntries(await Promise.all(Object.entries({ regular: 'LiberationSans-Regular.ttf', bold: 'LiberationSans-Bold.ttf', school: 'school-logo.jpg', cambridge: 'cambridge-logo.png', skeleton: 'skeleton.png' }).map(async ([key, file]) => [key, new Uint8Array(await readFile(`public/assets/${file}`))])));
function fixture() {
  const project = createProject();
  project.paper.targetMarks = 1;
  const q = project.paper.questions[0];
  q.images = [{ name: 'img-first', width: 80, height: 90 }, { name: 'img-second', width: 100, height: 110 }];
  q.parts[0].text = normalizeRich('Compare the diagrams and complete both tables.');
  q.parts[0].tables = [{ rows: [['First', ''], ['', '']], header: true }, { rows: [['Second', ''], ['', '']], header: true }];
  for (const name of ['img-first', 'img-second']) project.images[name] = { name: `${name}.png`, type: 'image/png', dataUrl: dataUrl(assets.skeleton) };
  return project;
}
test('every diagram and response table survives a portable backup', () => {
  const restored = parseProject(backupProject(fixture(), assets));
  assert.equal(restored.paper.questions[0].images.length, 2);
  assert.equal(restored.paper.questions[0].parts[0].tables.length, 2);
  assert.deepEqual(Object.keys(restored.images).sort(), ['img-first', 'img-second']);
});
test('both diagrams and both tables enter the measured PDF page plan', async () => {
  const project = fixture();
  const pdf = await exportPdf(project.paper, { ...assets, 'img-first': assets.skeleton, 'img-second': assets.skeleton });
  const nodes = pdf.plan.pages.flatMap(p => p.rows.flatMap(r => r.nodes));
  assert.equal(nodes.filter(n => n.type === 'image').length, 2);
  assert.equal(nodes.filter(n => n.type === 'table').length, 2);
});
test('draft PDF preview works with unfinished prompts and unbalanced marks; exports still reject them', async () => {
  const project = fixture(); project.paper.targetMarks = 40; project.paper.questions[0].parts[0].text = normalizeRich('');
  await assert.rejects(exportPdf(project.paper, assets), /prompt|marks/);
  const pdf = await exportPdf(project.paper, { ...assets, 'img-first': assets.skeleton, 'img-second': assets.skeleton }, { draft: true });
  assert.ok(pdf.bytes.length > 1000);
});

test('version 1 diagrams, tables, and strings upgrade without modifying the original draft', () => {
  const old = createProject(true); old.version = 1;
  for (const question of old.paper.questions) {
    question.context = plainText(question.context);
    for (const part of question.parts) part.text = plainText(part.text);
  }
  const original = structuredClone(old);
  const migrated = modernizeProject(parseProject(JSON.stringify(old)));
  assert.equal(migrated.version, 4);
  assert.equal(plainText(migrated.paper.questions[0].context), original.paper.questions[0].context);
  assert.equal(plainText(migrated.paper.questions[0].parts[0].text), original.paper.questions[0].parts[0].text);
  assert.equal(migrated.paper.questions[0].images[0].name, 'skeleton');
  assert.equal(migrated.paper.questions[0].parts[0].tables[0].rows.length, 6);
  assert.deepEqual(old, original);
  const restored = parseProject(backupProject(migrated, assets));
  assert.equal(restored.paper.questions[0].images[0].name, 'skeleton');
  assert.equal(restored.paper.questions[0].parts[0].tables[0].rows.length, 6);
});

test('oversized or malformed diagram/table collections are rejected', () => {
  const project = fixture(); project.paper.questions[0].images = Array(13).fill(project.paper.questions[0].images[0]);
  assert.throws(() => parseProject(JSON.stringify(project)), /diagrams/);
  const other = fixture(); other.paper.questions[0].parts[0].tables[1].rows.push(['ragged']);
  assert.throws(() => parseProject(JSON.stringify(other)), /response table/);
});
