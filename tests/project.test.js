import test from 'node:test';
import { outlineView } from '../src/views.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createProject, duplicateProject, backupProject, parseProject, dataUrl, imageBytes } from '../src/project.js';
import { DraftWriter } from '../src/storage.js';
import { validatePaper } from '../src/paper.js';
import { normalizeRich, plainText } from '../src/rich-text.js';

function legacyProject(project, version = 2) {
  const copy = structuredClone(project);
  copy.version = version;
  for (const question of copy.paper.questions) {
    question.context = plainText(question.context);
    for (const part of question.parts) part.text = plainText(part.text);
  }
  return copy;
}

test('the marks shortcut cannot create an unimportable maximum above 1000', () => {
  const project = createProject();
  project.paper.questions[0].parts = [{ text: 'One', marks: 1000, lines: 0 }, { text: 'Two', marks: 1, lines: 0 }];
  assert.doesNotMatch(outlineView(project, null), /data-action="use-total"/);
});

test('backup never reports success for a file that exceeds the import limit', () => {
  const project = createProject();
  // Represents the aggregate size of many otherwise individually valid diagrams.
  project.images['img-large'] = { name: 'large.png', type: 'image/png', dataUrl: `data:image/png;base64,${'A'.repeat(40 * 1024 * 1024)}` };
  project.paper.questions[0].image = { name: 'img-large', width: 100, height: 100 };
  assert.throws(() => backupProject(project, {}), /40 MB/);
});

test('backup includes image bytes and imports as a separate draft', async () => {
  const p = createProject(true);
  const bytes = new Uint8Array(await readFile('public/assets/skeleton.png'));
  const backup = backupProject(p, { skeleton: bytes });
  const imported = parseProject(backup);
  assert.notEqual(imported.id, p.id);
  assert.equal(imported.paper.questions[0].parts[0].marks, 6);
  assert.deepEqual(imageBytes(imported.images.skeleton.dataUrl), bytes);
  assert.equal(validatePaper(imported.paper).errors.length, 0);
});
test('an incomplete draft can be backed up and restored', () => {
  const project = createProject();
  project.paper.title = '';
  project.paper.questions[0].parts[0].bank = ['a'.repeat(140)];
  const imported = parseProject(backupProject(project, {}));
  assert.equal(imported.paper.title, '');
  assert.equal(imported.paper.questions[0].parts[0].bank[0].length, 140);
  assert.ok(validatePaper(imported.paper).errors.length > 0);
});
test('unknown versions and malformed content cannot replace a draft', () => {
  const project = createProject();
  const original = structuredClone(project);
  assert.throws(() => parseProject('{'), /valid/);
  const bad = structuredClone(project); bad.version = 99;
  assert.throws(() => parseProject(JSON.stringify(bad)), /version 1/);
  const malformedLegacy = legacyProject(bad, 1);
  malformedLegacy.paper.questions[0].parts[0].table = { rows: [['one', 'two'], ['three']] };
  assert.throws(() => parseProject(JSON.stringify(malformedLegacy)), /response table/);
  assert.deepEqual(project, original);
});
test('external image URLs and missing diagrams are rejected', () => {
  const p = createProject();
  p.paper.questions[0].image = { name: 'img-test', width: 200, height: 100 };
  assert.throws(() => parseProject(JSON.stringify(p)), /missing image/);
  p.images['img-test'] = { type: 'image/png', name: 'test', dataUrl: 'https://example.com/image.png' };
  assert.throws(() => parseProject(JSON.stringify(p)), /image data/);
});
test('only known fields survive import; markup remains inert text', () => {
  const p = createProject();
  p.paper.questions[0].parts[0].text = normalizeRich('<img src=x onerror=alert(1)>');
  p.unknown = { something: 'untrusted' };
  const imported = parseProject(JSON.stringify(p));
  assert.equal(imported.unknown, undefined);
  assert.equal(plainText(imported.paper.questions[0].parts[0].text), '<img src=x onerror=alert(1)>');
});
test('duplicating a paper preserves the source and gives it a new identity', () => {
  const p = createProject(true); const copy = duplicateProject(p);
  copy.paper.questions[0].parts[0].text = normalizeRich('New text');
  assert.notEqual(copy.id, p.id);
  assert.notEqual(copy.paper.questions[0].parts[0].text, p.paper.questions[0].parts[0].text);
  assert.equal(copy.paper.sample, false);
});
test('draft writes coalesce and always finish with the latest snapshot', async () => {
  const writes = [], states = [];
  let release;
  const writer = new DraftWriter(async project => {
    writes.push(project);
    if (writes.length === 1) await new Promise(resolve => { release = resolve; });
  }, state => states.push(state));
  const p = createProject();
  writer.enqueue(p);
  p.paper.title = 'Second'; writer.enqueue(p);
  p.paper.title = 'Newest'; writer.enqueue(p);
  release();
  assert.equal(await writer.flush(), true);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].paper.title, 'Newest');
  assert.equal(states.at(-1), 'saved');
});
test('a failed save stays visible and can be retried', async () => {
  const states = []; let fails = true;
  const writer = new DraftWriter(async () => { if (fails) throw new Error('Quota exceeded'); }, s => states.push(s));
  writer.enqueue(createProject());
  assert.equal(await writer.flush(), false); assert.equal(states.at(-1), 'error');
  fails = false; writer.enqueue(createProject());
  assert.equal(await writer.flush(), true); assert.equal(states.at(-1), 'saved');
});
