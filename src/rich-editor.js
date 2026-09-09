import { Schema, DOMParser, Fragment, Slice } from 'prosemirror-model';
import { EditorState, TextSelection } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { baseKeymap, toggleMark, chainCommands } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { wrapInList, splitListItem } from 'prosemirror-schema-list';
import { normalizeRich } from './rich-text.js';
import { icon } from './icons.js';

const markSpec = (tag, extra = {}) => ({ parseDOM: [{ tag }], toDOM: () => [tag, 0], ...extra });
export const editorSchema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*', parseDOM: [{ tag: 'p' }], toDOM: () => ['p', 0] },
    bullet_list: { group: 'block', content: 'list_item+', attrs: { group: { default: null } }, parseDOM: [{ tag: 'ul' }], toDOM: () => ['ul', 0] },
    ordered_list: { group: 'block', content: 'list_item+', attrs: { group: { default: null } }, parseDOM: [{ tag: 'ol' }], toDOM: () => ['ol', 0] },
    list_item: { content: 'paragraph', defining: true, parseDOM: [{ tag: 'li' }], toDOM: () => ['li', 0] },
    text: { group: 'inline' },
    hard_break: { inline: true, group: 'inline', selectable: false, parseDOM: [{ tag: 'br' }], toDOM: () => ['br'] },
    blank: { inline: true, group: 'inline', atom: true, marks: '', parseDOM: [{ tag: 'span[data-rich-blank]' }], toDOM: () => ['span', { 'data-rich-blank': 'true', class: 'rich-blank', contenteditable: 'false', 'aria-label': '3 centimetre answer blank' }, '\u00a0'] },
  },
  marks: {
    bold: markSpec('strong', { parseDOM: [{ tag: 'strong' }, { tag: 'b' }] }),
    italic: markSpec('em', { parseDOM: [{ tag: 'em' }, { tag: 'i' }] }),
    underline: markSpec('u'),
    superscript: markSpec('sup', { excludes: 'superscript subscript' }),
    subscript: markSpec('sub', { excludes: 'superscript subscript' }),
  },
});

export function toEditorDoc(value, options) {
  const blocks = normalizeRich(value, options).blocks, children = [];
  for (let index = 0; index < blocks.length; index++) {
    const block = blocks[index];
    const paragraph = item => editorSchema.nodes.paragraph.create(null, item.content.map(node => node.type === 'blank'
      ? editorSchema.nodes.blank.create() : editorSchema.text(node.text, node.marks.map(mark => editorSchema.marks[mark].create()))));
    if (block.type === 'paragraph') children.push(paragraph(block));
    else {
      const items = [editorSchema.nodes.list_item.create(null, paragraph(block))];
      while (blocks[index + 1]?.type === block.type && blocks[index + 1].group === block.group) items.push(editorSchema.nodes.list_item.create(null, paragraph(blocks[++index])));
      children.push(editorSchema.nodes[block.type === 'bullet' ? 'bullet_list' : 'ordered_list'].create({ group: block.group }, items));
    }
  }
  return editorSchema.nodes.doc.create(null, children.length ? children : editorSchema.nodes.paragraph.create());
}

export function fromEditorDoc(doc, options) {
  const blocks = [];
  const paragraph = (node, type = 'paragraph', group) => {
    let block = { type, ...(group ? { group } : {}), content: [] };
    blocks.push(block);
    node.forEach(inline => {
      if (inline.type.name === 'hard_break') { block = { type, ...(group ? { group } : {}), content: [] }; blocks.push(block); }
      else if (inline.type.name === 'blank') block.content.push({ type: 'blank' });
      else if (inline.isText) block.content.push({ type: 'text', text: inline.text, marks: inline.marks.map(mark => mark.type.name) });
      else throw new Error('Unsupported content in this rich-text field.');
    });
  };
  const existingGroups = new Set();
  doc.forEach(node => { if (node.attrs.group) existingGroups.add(node.attrs.group); });
  let groupId = 0;
  doc.forEach(node => {
    if (node.type.name === 'paragraph') paragraph(node);
    else if (['bullet_list', 'ordered_list'].includes(node.type.name)) {
      let group = node.attrs.group;
      if (!group) { do { group = `editor-list-${++groupId}`; } while (existingGroups.has(group)); existingGroups.add(group); }
      node.forEach(item => {
        if (item.childCount !== 1 || item.firstChild.type.name !== 'paragraph') throw new Error('Use one paragraph per list item in this field.');
        paragraph(item.firstChild, node.type.name === 'bullet_list' ? 'bullet' : 'ordered', group);
      });
    } else throw new Error('Unsupported block in this rich-text field.');
  });
  return normalizeRich({ type: 'doc', blocks }, options);
}

function selectedList(state) {
  const { $from } = state.selection;
  for (let depth = $from.depth; depth > 0; depth--) if (['bullet_list', 'ordered_list'].includes($from.node(depth).type.name)) return { node: $from.node(depth), pos: $from.before(depth) };
  return null;
}

function wrapFlatList(type, state, dispatch) {
  const { $from, $to } = state.selection, range = $from.blockRange($to);
  if (!range || range.depth !== 0) return false;
  if (range.endIndex - range.startIndex === 1) return wrapInList(type)(state, dispatch);
  const items = [];
  for (let index = range.startIndex; index < range.endIndex; index++) {
    const node = range.parent.child(index);
    if (node.type !== editorSchema.nodes.paragraph) return false;
    items.push(editorSchema.nodes.list_item.create(null, node));
  }
  if (dispatch) {
    // The standard wrapper first puts every paragraph in one list item. Build
    // flat items directly because our schema permits only one paragraph each.
    const tr = state.tr.replaceWith(range.start, range.end, type.create(null, items));
    if (state.selection instanceof TextSelection) {
      const position = pos => pos + 2 + 2 * (state.doc.resolve(pos).index(range.depth) - range.startIndex);
      tr.setSelection(TextSelection.create(tr.doc, position(state.selection.anchor), position(state.selection.head)));
    }
    dispatch(tr.scrollIntoView());
  }
  return true;
}

function liftFlatList(state, dispatch) {
  const range = state.selection.$from.blockRange(state.selection.$to, node => node.firstChild?.type === editorSchema.nodes.list_item);
  if (!range) return false;
  if (dispatch) {
    const list = range.parent, start = range.$from.before(range.depth), replacement = [];
    if (range.startIndex) replacement.push(list.copy(list.content.cut(0, range.start - start - 1)));
    for (let index = range.startIndex; index < range.endIndex; index++) replacement.push(list.child(index).firstChild);
    if (range.endIndex < list.childCount) replacement.push(list.copy(list.content.cut(range.end - start - 1)));
    const tr = state.tr.replaceWith(start, start + list.nodeSize, replacement);
    if (state.selection instanceof TextSelection) {
      const position = pos => pos - (range.startIndex ? 0 : 2) - 2 * (state.doc.resolve(pos).index(range.depth) - range.startIndex);
      tr.setSelection(TextSelection.create(tr.doc, position(state.selection.anchor), position(state.selection.head)));
    }
    dispatch(tr.scrollIntoView());
  }
  return true;
}

export function editorCommand(name) {
  if (name === 'undo') return undo;
  if (name === 'redo') return redo;
  if (name === 'blank') return (state, dispatch) => { if (dispatch) dispatch(state.tr.replaceSelectionWith(editorSchema.nodes.blank.create()).scrollIntoView()); return true; };
  if (name === 'clear') return (state, dispatch) => {
    if (dispatch) dispatch(state.tr.removeMark(state.selection.from, state.selection.to).setStoredMarks([]).scrollIntoView());
    return true;
  };
  if (name === 'bullet' || name === 'ordered') return (state, dispatch) => {
    const type = editorSchema.nodes[name === 'bullet' ? 'bullet_list' : 'ordered_list'], list = selectedList(state);
    if (list?.node.type === type) return liftFlatList(state, dispatch);
    if (list) { if (dispatch) dispatch(state.tr.setNodeMarkup(list.pos, type, list.node.attrs).scrollIntoView()); return true; }
    return wrapFlatList(type, state, dispatch);
  };
  return toggleMark(editorSchema.marks[name]);
}

const splitParagraphOrListItem = chainCommands(splitListItem(editorSchema.nodes.list_item), baseKeymap.Enter);
export const editorKeyBindings = {
  'Mod-b': editorCommand('bold'), 'Mod-i': editorCommand('italic'), 'Mod-u': editorCommand('underline'),
  'Mod-z': undo, 'Mod-Shift-z': redo, 'Mod-y': redo,
  Enter: splitParagraphOrListItem, 'Shift-Enter': splitParagraphOrListItem,
};

export function normalizePastedSlice(slice) {
  const nodes = [];
  slice.content.forEach(node => {
    if (!['bullet_list', 'ordered_list'].includes(node.type.name)) { nodes.push(node); return; }
    const items = [];
    node.forEach(item => {
      const paragraph = item.firstChild;
      let runs = [];
      const finish = () => { items.push(item.copy(Fragment.from(paragraph.copy(Fragment.fromArray(runs))))); runs = []; };
      paragraph.forEach(inline => {
        if (inline.type.name === 'hard_break') finish();
        else runs.push(inline);
      });
      finish();
    });
    nodes.push(node.copy(Fragment.fromArray(items)));
  });
  return new Slice(Fragment.fromArray(nodes), slice.openStart, slice.openEnd);
}

// Clipboard HTML is parsed only in an inert template. Rebuild permitted nodes
// without copying attributes, URLs or active/resource-bearing elements.
export function sanitizeClipboard(html, ownerDocument, { allowBlank = true } = {}) {
  if (html.length > 2_000_000) throw new Error('That paste is too large. Paste a smaller section.');
  const template = ownerDocument.createElement('template'); template.innerHTML = html;
  const clean = ownerDocument.createElement('div');
  const blocked = new Set('script style img picture iframe frame frameset object embed link meta base svg math video audio source track input form button textarea select template noscript canvas'.split(' '));
  const readableText = node => {
    if (node.nodeType === 3) return node.textContent;
    const text = [...node.childNodes].map(readableText).join('');
    return ['p', 'li', 'br'].includes(node.localName) ? ` ${text} ` : text;
  };
  let count = 0;
  const copy = (source, parent, depth = 0) => {
    if (++count > 32000 || depth > 100) throw new Error('That paste is too complex. Paste a smaller section.');
    if (source.nodeType === 3) { parent.append(ownerDocument.createTextNode(source.textContent)); return; }
    if (source.nodeType !== 1) return;
    const tag = source.localName.toLowerCase();
    if (blocked.has(tag)) return;
    if (tag === 'table') {
      for (const row of source.querySelectorAll('tr')) {
        const p = ownerDocument.createElement('p');
        for (const [index, cell] of [...row.children].filter(cell => ['td', 'th'].includes(cell.localName)).entries()) {
          if (index) p.append(ownerDocument.createTextNode(' | '));
          const cellText = ownerDocument.createElement('div');
          for (const child of cell.childNodes) copy(child, cellText, depth + 1);
          p.append(ownerDocument.createTextNode(readableText(cellText).replace(/\s+/g, ' ').trim()));
        }
        parent.append(p);
      }
      return;
    }
    if (tag === 'span' && source.hasAttribute('data-rich-blank')) {
      if (allowBlank) { const blank = ownerDocument.createElement('span'); blank.dataset.richBlank = 'true'; parent.append(blank); }
      return;
    }
    const tags = { b: 'strong', i: 'em', div: 'p', h1: 'p', h2: 'p', h3: 'p', h4: 'p', h5: 'p', h6: 'p', blockquote: 'p' };
    const safeTag = tags[tag] || tag;
    const allowed = ['p', 'strong', 'em', 'u', 'sup', 'sub', 'ul', 'ol', 'li', 'br'];
    let target = parent;
    if (allowed.includes(safeTag)) { target = ownerDocument.createElement(safeTag); parent.append(target); }
    // Word and browser copy often express supported marks as inline styles.
    const styles = source.style;
    const marks = [];
    if (styles.fontWeight === 'bold' || Number(styles.fontWeight) >= 600) marks.push('strong');
    if (styles.fontStyle === 'italic') marks.push('em');
    if (styles.textDecoration?.includes('underline') || styles.textDecorationLine?.includes('underline')) marks.push('u');
    if (styles.verticalAlign === 'super') marks.push('sup');
    else if (styles.verticalAlign === 'sub') marks.push('sub');
    for (const mark of marks) { const wrap = ownerDocument.createElement(mark); target.append(wrap); target = wrap; }
    for (const child of source.childNodes) copy(child, target, depth + 1);
  };
  for (const child of template.content.childNodes) copy(child, clean);
  // Lift nested items into their outer list in reading order, deepest first.
  for (const nested of [...clean.querySelectorAll('li ul, li ol')].reverse()) {
    const item = nested.closest('li'), list = item.parentElement;
    if (!['ul', 'ol'].includes(list?.localName)) continue;
    // Text following a nested list must follow the lifted items as well.
    const range = ownerDocument.createRange();
    range.setStartAfter(nested); range.setEnd(item, item.childNodes.length);
    const trailing = range.extractContents();
    let cursor = item;
    for (const child of [...nested.children]) { list.insertBefore(child, cursor.nextSibling); cursor = child; }
    nested.remove();
    if (trailing.textContent.trim() || trailing.querySelector('[data-rich-blank]')) {
      const tail = ownerDocument.createElement('li'); tail.append(trailing); list.insertBefore(tail, cursor.nextSibling);
    }
  }
  return clean;
}

const controls = [
  ['bold', 'Bold', 'bold'], ['italic', 'Italic', 'italic'], ['underline', 'Underline', 'underline'],
  ['superscript', 'Superscript', 'superscript'], ['subscript', 'Subscript', 'subscript'],
  ['bullet', 'Bulleted list', 'list'], ['ordered', 'Numbered list', 'list-ordered'], ['clear', 'Clear formatting', 'eraser'],
  ['blank', 'Insert blank', 'text-cursor-input'], ['undo', 'Undo', 'undo'], ['redo', 'Redo', 'redo'],
];

export function richToolbarMarkup(allowBlank) {
  return controls.filter(([name]) => name !== 'blank' || allowBlank).map(([name, label, iconName]) => `<button type="button" data-rich-command="${name}" aria-label="${label}" title="${label}" ${editorSchema.marks[name] || ['bullet', 'ordered'].includes(name) ? 'aria-pressed="false"' : ''}>${icon(iconName)}${name === 'blank' ? '<span>Blank</span>' : ''}</button>`).join('');
}

export function mountRichEditors(root, project, onChange, onError = () => {}) {
  const editors = [];
  for (const host of root.querySelectorAll('[data-rich-path]')) {
    const [kind, id, field] = host.dataset.richPath.split('.');
    const target = kind === 'q' ? project.paper.questions.find(q => q.id === id) : project.paper.questions.flatMap(q => q.parts).find(p => p.id === id);
    const allowBlank = host.dataset.allowBlank === 'true';
    const toolbar = host.querySelector('.rich-toolbar'), surface = host.querySelector('.rich-surface'), error = host.querySelector('.rich-error');
    const report = problem => { error.textContent = problem.message || problem; onError(problem); };
    toolbar.innerHTML = richToolbarMarkup(allowBlank);
    let view;
    const updateToolbar = () => {
      const state = view.state, { from, to, empty, $from } = state.selection;
      for (const button of toolbar.children) {
        const name = button.dataset.richCommand, mark = editorSchema.marks[name];
        if (mark) button.setAttribute('aria-pressed', String(empty ? Boolean(mark.isInSet(state.storedMarks || $from.marks())) : state.doc.rangeHasMark(from, to, mark)));
        else if (['bullet', 'ordered'].includes(name)) button.setAttribute('aria-pressed', String(selectedList(state)?.node.type.name === `${name === 'bullet' ? 'bullet' : 'ordered'}_list`));
        button.disabled = !editorCommand(name)(state);
      }
    };
    view = new EditorView(surface, {
      state: EditorState.create({ schema: editorSchema, doc: toEditorDoc(target[field], { allowBlank }), plugins: [
        history(), keymap(editorKeyBindings), keymap(baseKeymap),
      ] }),
      attributes: { role: 'textbox', 'aria-label': host.dataset.label, 'aria-multiline': 'true', 'aria-describedby': error.id, spellcheck: 'true' },
      dispatchTransaction(transaction) {
        try {
          const next = view.state.apply(transaction);
          const value = transaction.docChanged ? fromEditorDoc(next.doc, { allowBlank }) : null;
          view.updateState(next); updateToolbar(); error.textContent = '';
          if (value) onChange(host.dataset.richPath, value);
        } catch (problem) { view.updateState(view.state); report(problem); }
      },
      handlePaste(view, event) {
        try {
          const data = event.clipboardData;
          if (!data) return true;
          const html = data.getData('text/html');
          if (html) {
            const parsed = DOMParser.fromSchema(editorSchema).parseSlice(sanitizeClipboard(html, host.ownerDocument, { allowBlank }));
            view.dispatch(view.state.tr.replaceSelection(normalizePastedSlice(parsed)).scrollIntoView());
          }
          else {
            const text = data.getData('text/plain');
            const doc = toEditorDoc(text, { allowBlank });
            view.dispatch(view.state.tr.replaceSelection(doc.slice(0, doc.content.size)).scrollIntoView());
          }
        } catch (problem) { report(problem); }
        return true;
      },
      handleDOMEvents: { drop: (_view, event) => { event.preventDefault(); report('Paste text here. Use Attach a diagram for images.'); return true; } },
    });
    const pointer = event => { if (event.target.closest('button')) event.preventDefault(); };
    const click = event => {
      const button = event.target.closest('[data-rich-command]');
      if (!button || button.disabled) return;
      editorCommand(button.dataset.richCommand)(view.state, view.dispatch, view); view.focus();
    };
    toolbar.addEventListener('mousedown', pointer); toolbar.addEventListener('click', click);
    updateToolbar();
    editors.push(() => { toolbar.removeEventListener('mousedown', pointer); toolbar.removeEventListener('click', click); view.destroy(); });
  }
  return () => { for (const destroy of editors) destroy(); };
}
