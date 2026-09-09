import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRich, plainText, richBlocks } from '../src/rich-text.js';
import { responseType } from '../src/content.js';
import { createProject, backupProject, parseProject } from '../src/project.js';
import { validatePaper } from '../src/paper.js';

const paragraph = content => ({ type: 'paragraph', content });
const text = (value, marks = []) => ({ type: 'text', text: value, marks });

test('legacy conversion preserves line breaks without modifying its source', () => {
  const source = new String('First\n\nThird');
  const original = source.valueOf();
  const normalized = normalizeRich(source.valueOf());

  assert.equal(plainText(normalized), original);
  assert.deepEqual(normalized, {
    type: 'doc',
    blocks: [paragraph([text('First')]), paragraph([]), paragraph([text('Third')])],
  });
  assert.equal(source.valueOf(), original);
});

test('styled runs, blanks, and separate list groups round-trip canonically', () => {
  const source = {
    type: 'doc',
    blocks: [
      paragraph([
        text('Styled', ['underline', 'bold']),
        text('', ['italic']),
        text(' text', ['bold', 'underline']),
        { type: 'blank' },
      ]),
      { type: 'bullet', group: 'list-1', content: [text('First')] },
      { type: 'bullet', group: 'list-1', content: [text('Second', ['italic'])] },
      { type: 'ordered', group: 'list-2', content: [{ type: 'blank' }] },
    ],
  };
  const original = structuredClone(source);

  const normalized = normalizeRich(source);

  assert.deepEqual(normalized, {
    type: 'doc',
    blocks: [
      paragraph([text('Styled text', ['bold', 'underline']), { type: 'blank' }]),
      { type: 'bullet', group: 'list-1', content: [text('First')] },
      { type: 'bullet', group: 'list-1', content: [text('Second', ['italic'])] },
      { type: 'ordered', group: 'list-2', content: [{ type: 'blank' }] },
    ],
  });
  assert.deepEqual(source, original);
  assert.equal(plainText(normalized, { blanks: '___' }), 'Styled text___\nFirst\nSecond\n___');
  assert.deepEqual(richBlocks(normalized), normalized.blocks);
});

test('unsupported nodes, fields, marks, scripts, and blanks are rejected', () => {
  const doc = blocks => ({ type: 'doc', blocks });
  assert.throws(() => normalizeRich({ type: 'doc', blocks: [], html: '<script>' }), /document/);
  assert.throws(() => normalizeRich(doc([{ type: 'script', content: [] }])), /block/);
  assert.throws(() => normalizeRich(doc([{ type: 'bullet', group: '', content: [] }])), /group/);
  assert.throws(() => normalizeRich(doc([{ type: 'paragraph', content: [], children: [] }])), /block/);
  assert.throws(() => normalizeRich(doc([paragraph([{ type: 'text', text: 'x', marks: ['link'] }])])), /mark/);
  assert.throws(() => normalizeRich(doc([paragraph([{ type: 'text', text: 'x', marks: ['bold'], href: 'https://example.com' }])])), /inline/);
  assert.throws(() => normalizeRich(doc([paragraph([text('x', ['superscript', 'subscript'])])])), /superscript|subscript/);
  assert.throws(() => normalizeRich(doc([paragraph([{ type: 'blank' }])]), { allowBlank: false }), /blank/);
  assert.throws(() => normalizeRich(doc([paragraph([{ type: 'paragraph', content: [] }])])), /inline/);

  let getterCalled = false;
  const activeNode = Object.defineProperty({}, 'type', { enumerable: true, get() { getterCalled = true; return 'blank'; } });
  assert.throws(() => normalizeRich(doc([paragraph([activeNode])])), /inline/);
  assert.equal(getterCalled, false);
});

test('sparse block arrays are rejected instead of preserving unvalidated holes', () => {
  assert.throws(() => normalizeRich({ type: 'doc', blocks: new Array(1) }), /block/);
});

test('character, block, inline-node, and group limits are enforced at their boundaries', () => {
  assert.equal(plainText(normalizeRich('x'.repeat(8000))).length, 8000);
  assert.throws(() => normalizeRich('x'.repeat(8001)), /8,000/);

  const maximumBlocks = { type: 'doc', blocks: Array.from({ length: 8001 }, () => paragraph([])) };
  assert.equal(normalizeRich(maximumBlocks).blocks.length, 8001);
  assert.throws(() => normalizeRich({ type: 'doc', blocks: [...maximumBlocks.blocks, paragraph([])] }), /8,001/);

  const maximumNodes = { type: 'doc', blocks: [paragraph(Array.from({ length: 16000 }, () => text('')))] };
  assert.deepEqual(normalizeRich(maximumNodes), { type: 'doc', blocks: [paragraph([])] });
  assert.throws(() => normalizeRich({ type: 'doc', blocks: [paragraph(Array.from({ length: 16001 }, () => text('')))] }), /16,000/);
  assert.throws(() => normalizeRich({ type: 'doc', blocks: [paragraph([text('x', Array(6).fill('bold'))])] }), /mark/);

  assert.equal(normalizeRich({ type: 'doc', blocks: [{ type: 'bullet', group: 'g'.repeat(100), content: [] }] }).blocks[0].group.length, 100);
  assert.throws(() => normalizeRich({ type: 'doc', blocks: [{ type: 'bullet', group: 'g'.repeat(101), content: [] }] }), /group/);
});

test('blank tokens and block boundaries each count toward the character limit', () => {
  const exact = { type: 'doc', blocks: [paragraph([text('x'.repeat(7998)), { type: 'blank' }]), paragraph([])] };
  assert.equal(plainText(normalizeRich(exact), { blanks: '_' }).length, 8000);
  exact.blocks[0].content[0].text += 'x';
  assert.throws(() => normalizeRich(exact), /8,000/);
});

test('response type defaults to written and rejects unknown stored values', () => {
  assert.equal(responseType({}), 'written');
  assert.equal(responseType({ responseType: 'multiple-choice' }), 'multiple-choice');
  assert.throws(() => responseType({ responseType: null }), /response type/);
  assert.throws(() => responseType({ responseType: 'essay' }), /response type/);
});

test('export validation requires real prompt text but ignores inactive choices', () => {
  const paper = createProject().paper;
  paper.targetMarks = 1;
  const part = paper.questions[0].parts[0];
  part.options = ['', ''];
  part.text = { type: 'doc', blocks: [paragraph([{ type: 'blank' }])] };
  assert.match(validatePaper(paper).errors.join(' '), /prompt/);

  part.text = normalizeRich('A complete prompt');
  assert.doesNotMatch(validatePaper(paper).errors.join(' '), /option/);
  part.responseType = 'true-false';
  assert.doesNotMatch(validatePaper(paper).errors.join(' '), /option/);
});

test('active multiple-choice export validation requires two to six nonempty choices', () => {
  const paper = createProject().paper;
  paper.targetMarks = 1;
  const part = paper.questions[0].parts[0];
  part.text = normalizeRich('Choose one.');
  part.responseType = 'multiple-choice';

  for (const options of [[], ['Only one'], ['A', ''], ['A', 'B', 'C', 'D', 'E', 'F', 'G']]) {
    part.options = options;
    assert.match(validatePaper(paper).errors.join(' '), /2 to 6 non-empty options/);
  }
  part.options = ['A', 'B'];
  assert.doesNotMatch(validatePaper(paper).errors.join(' '), /option/);
});

test('version 4 backups use documents while legacy imports require and migrate strings', () => {
  const project = createProject();
  project.paper.questions[0].context = 'Shared\ninstructions';
  project.paper.questions[0].parts[0].text = 'Prompt';
  const restored = parseProject(backupProject(project, {}));

  assert.equal(restored.version, 4);
  assert.equal(plainText(restored.paper.questions[0].context), 'Shared\ninstructions');
  assert.equal(plainText(restored.paper.questions[0].parts[0].text), 'Prompt');
  assert.equal(project.paper.questions[0].context, 'Shared\ninstructions');

  const legacy = structuredClone(project);
  legacy.version = 2;
  const migrated = parseProject(JSON.stringify(legacy));
  assert.equal(migrated.version, 4);
  assert.equal(plainText(migrated.paper.questions[0].parts[0].text), 'Prompt');

  const invalidV3 = structuredClone(legacy);
  invalidV3.version = 3;
  assert.throws(() => parseProject(JSON.stringify(invalidV3)), /question context|prompt/);
  const invalidV2 = structuredClone(restored);
  invalidV2.version = 2;
  assert.throws(() => parseProject(JSON.stringify(invalidV2)), /question context|prompt/);
});

test('version 4 import preserves bounded inactive response settings in incomplete drafts', () => {
  const project = createProject();
  const part = project.paper.questions[0].parts[0];
  part.responseType = 'multiple-choice';
  part.options = ['', 'Second'];
  part.lines = 7;

  const restored = parseProject(backupProject(project, {}));
  assert.equal(restored.paper.questions[0].parts[0].responseType, 'multiple-choice');
  assert.deepEqual(restored.paper.questions[0].parts[0].options, ['', 'Second']);
  assert.equal(restored.paper.questions[0].parts[0].lines, 7);

  const tooMany = JSON.parse(backupProject(project, {}));
  tooMany.paper.questions[0].parts[0].options = Array(7).fill('choice');
  assert.throws(() => parseProject(JSON.stringify(tooMany)), /options/);
  tooMany.paper.questions[0].parts[0].options = ['x'.repeat(301)];
  assert.throws(() => parseProject(JSON.stringify(tooMany)), /option/);
  tooMany.paper.questions[0].parts[0].options = [];
  tooMany.paper.questions[0].parts[0].responseType = 'essay';
  assert.throws(() => parseProject(JSON.stringify(tooMany)), /response type/);
});
