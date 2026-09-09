const MARKS = ['bold', 'italic', 'underline', 'superscript', 'subscript'];
const MARK_SET = new Set(MARKS);
const BLOCK_TYPES = new Set(['paragraph', 'bullet', 'ordered']);

export const MAX_RICH_CHARACTERS = 8000;
export const MAX_RICH_BLOCKS = 8001;
export const MAX_RICH_INLINE_NODES = 16000;
export const MAX_LIST_GROUP_CHARACTERS = 100;

const fail = detail => { throw new Error(`Invalid rich-text ${detail}.`); };

function record(value, fields, detail) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(detail);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== 'string' || !fields.includes(key) || descriptors[key].get || descriptors[key].set) fail(detail);
  }
  return value;
}

function required(value, key, detail) {
  if (!Object.hasOwn(value, key)) fail(detail);
  return value[key];
}

function canonicalMarks(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MARKS.length || value.some(mark => typeof mark !== 'string' || !MARK_SET.has(mark))) fail('mark');
  const marks = MARKS.filter(mark => value.includes(mark));
  if (marks.includes('superscript') && marks.includes('subscript')) fail('superscript and subscript marks');
  return marks;
}

function normalizeInline(node, allowBlank) {
  record(node, ['type', 'text', 'marks'], 'inline node');
  const type = required(node, 'type', 'inline node');
  if (type === 'blank') {
    if (Object.hasOwn(node, 'text') || Object.hasOwn(node, 'marks')) fail('inline node');
    if (!allowBlank) fail('blank');
    return { type: 'blank' };
  }
  if (type !== 'text' || typeof required(node, 'text', 'inline node') !== 'string') fail('inline node');
  return { type: 'text', text: node.text, marks: canonicalMarks(node.marks) };
}

function sameMarks(left, right) {
  return left.length === right.length && left.every((mark, index) => mark === right[index]);
}

function normalizeBlock(block, allowBlank) {
  record(block, ['type', 'group', 'content'], 'block');
  const type = required(block, 'type', 'block');
  if (!BLOCK_TYPES.has(required(block, 'type', 'block'))) fail('block');
  if (type === 'paragraph' && Object.hasOwn(block, 'group')) fail('block');
  if (!Array.isArray(required(block, 'content', 'block'))) fail('block content');

  const result = { type, content: [] };
  if (type !== 'paragraph') {
    const group = required(block, 'group', 'list group');
    if (typeof group !== 'string' || !group.length || group.length > MAX_LIST_GROUP_CHARACTERS) fail('list group');
    result.group = group;
  }

  for (const input of block.content) {
    const node = normalizeInline(input, allowBlank);
    if (node.type === 'text' && !node.text.length) continue;
    const previous = result.content.at(-1);
    if (node.type === 'text' && previous?.type === 'text' && sameMarks(previous.marks, node.marks)) previous.text += node.text;
    else result.content.push(node);
  }
  return result;
}

function legacyDocument(value) {
  return {
    type: 'doc',
    blocks: value.split('\n').map(line => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line, marks: [] }] : [],
    })),
  };
}

export function normalizeRich(value, { allowBlank = true } = {}) {
  if (typeof allowBlank !== 'boolean') fail('options');
  if (typeof value === 'string') {
    if (value.length > MAX_RICH_CHARACTERS) fail('document: use 8,000 characters or fewer');
    return legacyDocument(value);
  }

  record(value, ['type', 'blocks'], 'document');
  if (required(value, 'type', 'document') !== 'doc' || !Array.isArray(required(value, 'blocks', 'document'))) fail('document');
  if (value.blocks.length > MAX_RICH_BLOCKS) fail('document: use 8,001 blocks or fewer');
  for (let index = 0; index < value.blocks.length; index++) if (!Object.hasOwn(value.blocks, index)) fail('block');

  let nodeCount = 0;
  let characterCount = Math.max(0, value.blocks.length - 1);
  const blocks = value.blocks.map(block => {
    if (block && Array.isArray(block.content)) {
      nodeCount += block.content.length;
      if (nodeCount > MAX_RICH_INLINE_NODES) fail('document: use 16,000 inline nodes or fewer');
    }
    const normalized = normalizeBlock(block, allowBlank);
    for (const node of normalized.content) characterCount += node.type === 'blank' ? 1 : node.text.length;
    if (characterCount > MAX_RICH_CHARACTERS) fail('document: use 8,000 characters or fewer');
    return normalized;
  });
  if (characterCount > MAX_RICH_CHARACTERS) fail('document: use 8,000 characters or fewer');
  return { type: 'doc', blocks };
}

export function richBlocks(value) {
  return normalizeRich(value).blocks;
}

export function plainText(value, { blanks = '' } = {}) {
  if (typeof blanks !== 'string') fail('blank representation');
  return normalizeRich(value).blocks.map(block => block.content.map(node => node.type === 'blank' ? blanks : node.text).join('')).join('\n');
}
