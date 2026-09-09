import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorState, TextSelection } from 'prosemirror-state';
import { Slice } from 'prosemirror-model';
import { editorSchema, toEditorDoc, fromEditorDoc, editorCommand } from '../src/rich-editor.js';
import * as richEditor from '../src/rich-editor.js';
import { plainText } from '../src/rich-text.js';
import { icon } from '../src/icons.js';

test('editor adapter retains marked runs, blanks, separate list groups and empty paragraphs', () => {
  const source = { type: 'doc', blocks: [
    { type: 'paragraph', content: [{ type: 'text', text: 'H', marks: ['bold', 'italic'] }, { type: 'text', text: '2', marks: ['subscript'] }, { type: 'blank' }] },
    { type: 'ordered', group: 'first', content: [{ type: 'text', text: 'One', marks: [] }] },
    { type: 'ordered', group: 'second', content: [{ type: 'text', text: 'Restart', marks: [] }] },
    { type: 'paragraph', content: [] },
  ] };
  assert.deepEqual(fromEditorDoc(toEditorDoc(source)), source);
  assert.throws(() => fromEditorDoc(toEditorDoc(source), { allowBlank: false }), /blank/);
});

test('toolbar script commands replace the opposing script and clear removes marks', () => {
  let state = EditorState.create({ schema: editorSchema, doc: toEditorDoc('Water') });
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, 6)));
  const run = name => editorCommand(name)(state, tr => { state = state.apply(tr); });
  run('subscript'); run('superscript');
  assert.deepEqual(fromEditorDoc(state.doc).blocks[0].content[0].marks, ['superscript']);
  run('clear'); assert.deepEqual(fromEditorDoc(state.doc).blocks[0].content[0].marks, []);
  run('blank'); assert.deepEqual(fromEditorDoc(state.doc).blocks[0].content, [{ type: 'blank' }]);
});

test('list controls produce flat items and toggle the selected list off', () => {
  let state = EditorState.create({ schema: editorSchema, doc: toEditorDoc('One\nTwo') });
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 1, state.doc.content.size - 1)));
  const run = name => editorCommand(name)(state, tr => { state = state.apply(tr); });
  run('bullet');
  assert.deepEqual(fromEditorDoc(state.doc).blocks.map(b => b.type), ['bullet', 'bullet']);
  run('ordered');
  assert.deepEqual(fromEditorDoc(state.doc).blocks.map(b => b.type), ['ordered', 'ordered']);
  run('ordered');
  assert.deepEqual(fromEditorDoc(state.doc).blocks.map(b => b.type), ['paragraph', 'paragraph']);
  assert.equal(plainText(fromEditorDoc(state.doc)), 'One\nTwo');
});

test('editor serialization rejects oversized edits before the saved document changes', () => {
  const doc = toEditorDoc('Valid');
  const state = EditorState.create({ schema: editorSchema, doc });
  const next = state.apply(state.tr.insertText('x'.repeat(8001)));
  assert.throws(() => fromEditorDoc(next.doc), /8,000/);
  assert.equal(plainText(fromEditorDoc(state.doc)), 'Valid');
});

test('Shift-Enter splits a list into visible items matching serialization and reload', () => {
  for (const type of ['bullet', 'ordered']) {
    let state = EditorState.create({ schema: editorSchema, doc: toEditorDoc({ type: 'doc', blocks: [
      { type, group: 'list', content: [{ type: 'text', text: 'FirstSecond', marks: ['bold'] }] },
    ] }) });
    state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 8)));
    assert.equal(richEditor.editorKeyBindings['Shift-Enter'](state, tr => { state = state.apply(tr); }), true);
    assert.equal(state.doc.firstChild.childCount, 2);
    assert.deepEqual(fromEditorDoc(state.doc).blocks, [
      { type, group: 'list', content: [{ type: 'text', text: 'First', marks: ['bold'] }] },
      { type, group: 'list', content: [{ type: 'text', text: 'Second', marks: ['bold'] }] },
    ]);
    assert.deepEqual(toEditorDoc(fromEditorDoc(state.doc)).toJSON(), state.doc.toJSON());
  }
});

test('list schema and serializer disallow multiple paragraphs under a single marker', () => {
  const paragraphs = [editorSchema.nodes.paragraph.create(null, editorSchema.text('First')), editorSchema.nodes.paragraph.create(null, editorSchema.text('Second'))];
  const item = editorSchema.nodes.list_item.create(null, paragraphs);
  assert.equal(editorSchema.nodes.list_item.validContent(item.content), false);
  const doc = editorSchema.nodes.doc.create(null, editorSchema.nodes.bullet_list.create(null, item));
  assert.throws(() => fromEditorDoc(doc), /one paragraph/);
});

test('flat list controls preserve a partial text selection when lifting a middle item', () => {
  let state = EditorState.create({ schema: editorSchema, doc: toEditorDoc('One\nTwo\nThree') });
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 2, 12)));
  const run = name => editorCommand(name)(state, tr => { state = state.apply(tr); });
  run('bullet');
  assert.equal(state.doc.textBetween(state.selection.from, state.selection.to, '\n'), 'ne\nTwo\nT');
  state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, 11, 12)));
  run('bullet');
  assert.deepEqual(fromEditorDoc(state.doc).blocks.map(block => block.type), ['bullet', 'paragraph', 'bullet']);
  assert.equal(state.doc.textBetween(state.selection.from, state.selection.to), 'w');
  run('bullet');
  assert.deepEqual(fromEditorDoc(state.doc).blocks.map(block => block.type), ['bullet', 'bullet', 'bullet']);
  assert.equal(state.doc.textBetween(state.selection.from, state.selection.to), 'w');
});

test('parsed bullet and numbered clipboard breaks become visible items before storage and reload', () => {
  for (const [listName, type] of [['bullet_list', 'bullet'], ['ordered_list', 'ordered']]) {
    // The editor parser representation of <ul|ol><li><strong>First</strong>
    // <br><em>Second</em><br>Third</li></ul|ol>, including its open paste edges.
    const paragraph = editorSchema.nodes.paragraph.create(null, [
      editorSchema.text('First', [editorSchema.marks.bold.create()]), editorSchema.nodes.hard_break.create(),
      editorSchema.text('Second', [editorSchema.marks.italic.create()]), editorSchema.nodes.hard_break.create(),
      editorSchema.text('Third'),
    ]);
    const doc = editorSchema.nodes.doc.create(null, editorSchema.nodes[listName].create({ group: 'pasted' }, editorSchema.nodes.list_item.create(null, paragraph)));
    const input = Slice.maxOpen(doc.content);
    const pasted = richEditor.normalizePastedSlice(input);
    assert.equal(pasted.content.firstChild.childCount, 3);
    assert.equal(pasted.openStart, input.openStart);
    assert.equal(pasted.openEnd, input.openEnd);
    const visible = editorSchema.nodes.doc.create(null, pasted.content);
    const saved = fromEditorDoc(visible);
    assert.deepEqual(saved.blocks, [
      { type, group: 'pasted', content: [{ type: 'text', text: 'First', marks: ['bold'] }] },
      { type, group: 'pasted', content: [{ type: 'text', text: 'Second', marks: ['italic'] }] },
      { type, group: 'pasted', content: [{ type: 'text', text: 'Third', marks: [] }] },
    ]);
    assert.deepEqual(toEditorDoc(saved).toJSON(), visible.toJSON());
    assert.equal(doc.firstChild.childCount, 1, 'clipboard input is not mutated');
  }
});

test('fixed blank toolbar action keeps its icon, visible label and accessible name', () => {
  assert.equal(typeof richEditor.richToolbarMarkup, 'function');
  const markup = richEditor.richToolbarMarkup(true);
  const blank = markup.match(/<button[^>]*data-rich-command="blank"[^>]*>[\s\S]*?<\/button>/)?.[0] || '';
  assert.match(blank, /aria-label="Insert blank"/);
  assert.match(blank, /title="Insert blank"/);
  assert.ok(blank.includes(icon('text-cursor-input')));
  assert.match(blank, /<span>Blank<\/span>/);
});
