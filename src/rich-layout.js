import { CHECKBOX_SIZE } from './answer-checkbox.js';
import { richBlocks } from './rich-text.js';

export const BLANK_WIDTH = 85.0393700787;
const SIZE = 11.5;
const LEADING = 22;
const textRun = (text, marks = []) => ({ type: 'text', text, marks });

function measuredRun(run, measure) {
  const marks = run.marks || [];
  const script = marks.includes('superscript') || marks.includes('subscript');
  const size = run.type === 'checkbox' ? CHECKBOX_SIZE : script ? 8.5 : SIZE;
  const bold = marks.includes('bold'), italic = marks.includes('italic');
  return {
    ...run, marks, size, bold, italic,
    offset: marks.includes('superscript') ? -4 : marks.includes('subscript') ? 3 : 0,
    width: run.type === 'blank' ? BLANK_WIDTH : run.type === 'checkbox' ? CHECKBOX_SIZE : measure(run.text, size, bold, italic),
  };
}

// Whitespace, not style boundaries, separates words. Each word retains its
// constituent measured runs, so bold/italic transitions can never split it.
function tokensFor(content, measure) {
  const tokens = [];
  for (const inline of content) {
    if (inline.type !== 'text') {
      tokens.push({ kind: inline.type, runs: [measuredRun(inline, measure)] });
      continue;
    }
    for (const text of inline.text.match(/\s+|\S+/g) || []) {
      const kind = /^\s/.test(text) ? 'space' : 'word';
      const run = measuredRun({ ...inline, text: kind === 'space' ? text.replace(/\s/g, ' ') : text }, measure);
      const previous = tokens.at(-1);
      if (previous?.kind === kind) previous.runs.push(run);
      else tokens.push({ kind, runs: [run] });
    }
  }
  return tokens.map(token => ({ ...token, width: token.runs.reduce((sum, run) => sum + run.width, 0) }));
}

function styledParagraph(content, measure, { width, indent = 0, labels = [], after = 0, role, listMarker } = {}) {
  const lines = [];
  let runs = [], cursor = indent, pending = [], hasContent = false;
  const finishLine = () => {
    let lineRuns = lines.length ? runs : [...labels, ...runs];
    // The 12pt square is taller than the roughly 8pt capital letters.
    // Lift the text 2pt so both visual centres coincide in PDF and Word.
    if (lineRuns.some(run => run.type === 'checkbox')) {
      lineRuns = lineRuns.map(run => run.type === 'text' ? { ...run, offset: run.offset - 2 } : run);
    }
    const baseline = Math.max(SIZE, ...lineRuns.map(run => run.size - run.offset));
    const descent = Math.max(SIZE * 0.25, ...lineRuns.map(run => run.size * 0.25 + run.offset));
    const height = Math.max(LEADING, Math.ceil((baseline + descent) * 2) / 2);
    lines.push({ runs: lineRuns, baseline, height, width: cursor, y: lines.reduce((sum, line) => sum + line.height, 0) });
    runs = []; cursor = indent; pending = []; hasContent = false;
  };
  const append = list => {
    for (const run of list) { runs.push({ ...run, x: cursor }); cursor += run.width; }
  };
  for (const token of tokensFor(content, measure)) {
    if (token.kind === 'space') { if (hasContent) pending.push(...token.runs); continue; }
    if (token.width > width - indent + 0.001) throw new Error('A word is too wide for the paper. Add spaces or shorten it.');
    const spaceWidth = pending.reduce((sum, run) => sum + run.width, 0);
    if (hasContent && cursor + spaceWidth + token.width > width + 0.001) finishLine();
    else append(pending);
    pending = [];
    append(token.runs); hasContent = true;
  }
  finishLine();
  return { type: 'rich-paragraph', role, listMarker, indent, lines, after, height: lines.reduce((sum, line) => sum + line.height, 0) + after };
}

export function richParagraphs(value, measure, { width, prefix = '', role = 'prompt' } = {}) {
  const blocks = richBlocks(value);
  if (!blocks.length) blocks.push({ type: 'paragraph', content: [] });
  const prefixIndent = prefix ? measure(`${prefix} `, SIZE, false, false) : 0;
  let previous, ordinal = 0;
  return blocks.map((block, index) => {
    const isList = block.type !== 'paragraph';
    ordinal = isList && previous?.type === block.type && previous?.group === block.group ? ordinal + 1 : 1;
    previous = block;
    const listMarker = isList ? block.type === 'bullet' ? '•' : `${ordinal}.` : undefined;
    const listIndent = listMarker ? Math.max(18, measure(`${listMarker} `, SIZE, false, false)) : 0;
    const labels = [];
    if (!index && prefix) labels.push({ ...measuredRun(textRun(prefix), measure), role: 'label', x: 0 });
    if (listMarker) labels.push({ ...measuredRun(textRun(listMarker), measure), role: 'label', x: prefixIndent });
    return styledParagraph(block.content, measure, {
      width, indent: prefixIndent + listIndent, labels, role, listMarker,
      // Legacy newline paragraphs shared one final gap. Preserve that geometry.
      after: index === blocks.length - 1 ? 6 : 0,
    });
  });
}

export function responseNodes(part, type, measure, width) {
  if (type === 'multiple-choice') return (part.options || []).map((option, index) => styledParagraph([textRun(option)], measure, {
    width, indent: part.showCheckboxes === true ? CHECKBOX_SIZE + 6 + 18 : 18, role: 'option', after: 6,
    labels: [
      ...(part.showCheckboxes === true ? [{ ...measuredRun({ type: 'checkbox', text: '□' }, measure), role: 'label', x: 0 }] : []),
      { ...measuredRun(textRun(`${String.fromCharCode(65 + index)}.`), measure), role: 'label', x: part.showCheckboxes === true ? CHECKBOX_SIZE + 6 : 0 },
    ],
  }));
  if (type === 'true-false') return [styledParagraph([
    { type: 'checkbox', text: '□' }, textRun(' True     '), { type: 'checkbox', text: '□' }, textRun(' False'),
  ], measure, { width, role: 'true-false', after: 6 })];
  return [];
}
