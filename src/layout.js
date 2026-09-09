import { instructionTexts } from './instructions.js';
import { footerText } from './paper.js';
import { questionImages, partTables, responseType } from './content.js';
import { plainText } from './rich-text.js';
import { richParagraphs, responseNodes } from './rich-layout.js';
import { DEFAULT_TEMPLATE_ID, templateFor } from './templates.js';

export const PAGE = { width: 595.28, height: 841.89, left: 36, top: 36, bottom: 786, body: 523.28 };
export const COLUMN = { number: 26, content: 465.28, marks: 32 };
export const PAD = 7;
export const TEXT_WIDTH = COLUMN.content - PAD * 2 - 2;
const IMAGE_GAP = 12;
export function layoutMetrics(paper) {
  const template = templateFor(paper.template || DEFAULT_TEMPLATE_ID);
  return {
    template,
    columns: template.columns,
    pad: template.pad,
    textWidth: template.columns.content - template.pad * 2 - 2,
  };
}
export function diagramWidthLimit(question, templateId = DEFAULT_TEMPLATE_ID) {
  const { textWidth } = layoutMetrics({ template: templateId });
  return question.imageLayout === 'horizontal' ? (textWidth - IMAGE_GAP) / 2 : Math.min(440, textWidth);
}
export function printedDiagram(image, question, templateId = DEFAULT_TEMPLATE_ID) {
  const scale = Math.min(1, diagramWidthLimit(question, templateId) / image.width);
  return { ...image, width: image.width * scale, height: image.height * scale };
}

function imageNodes(question, metrics) {
  const images = questionImages(question);
  if (question.imageLayout !== 'horizontal') return images.map(image => {
    const fitted = printedDiagram(image, question, metrics.template.id);
    return { type: 'image', ...fitted, after: 8, height: fitted.height + 10, imageHeight: fitted.height };
  });
  const column = diagramWidthLimit(question, metrics.template.id), nodes = [];
  for (let i = 0; i < images.length; i += 2) {
    const pair = images.slice(i, i + 2).map((image, index) => {
      const fitted = printedDiagram(image, question, metrics.template.id);
      return { ...fitted, x: index * (column + IMAGE_GAP) + (column - fitted.width) / 2 };
    });
    nodes.push({ type: 'image-row', images: pair, widths: [column, IMAGE_GAP, column], after: 8, height: Math.max(...pair.map(image => image.height)) + 10 });
  }
  return nodes;
}

export function wrapText(text, maxWidth, measure, size = 11.5, bold = false) {
  const result = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (measure(word, size, bold) > maxWidth) {
        throw new Error('A word is too wide for the paper. Add spaces or shorten it.');
      }
      const candidate = line ? `${line} ${word}` : word;
      if (line && measure(candidate, size, bold) > maxWidth) {
        result.push(line);
        line = word;
      } else line = candidate;
    }
    result.push(line);
  }
  return result;
}

export function paragraph(text, measure, { width = TEXT_WIDTH, size = 11.5, bold = false, after = 6, align = 'left', leading = 16 } = {}) {
  const lines = wrapText(text, width, measure, size, bold);
  return { type: 'paragraph', lines, size, bold, align, leading, after, height: lines.length * leading + after };
}

function tableNode(table, measure, textWidth) {
  const proportions = table.proportions || table.rows[0].map(() => 1 / table.rows[0].length);
  const widths = proportions.map(p => p * (textWidth - 2));
  const rows = table.rows.map((cells, ri) => {
    const content = cells.map((text, ci) => wrapText(text, widths[ci] - 12, measure, 11, table.header && ri === 0));
    const height = Math.max(27, ...content.map(lines => lines.length * 15 + 10));
    return { cells: content, height, bold: Boolean(table.header && ri === 0) };
  });
  return { type: 'table', rows, widths, after: 8, height: rows.reduce((s, r) => s + r.height, 0) + 9 };
}

function makeRows(question, qi, measure, metrics) {
  const { template, textWidth, columns, pad } = metrics;
  const introduction = plainText(question.context).trim() ? richParagraphs(question.context, measure, { width: textWidth, role: 'context' }) : [];
  introduction.push(...imageNodes(question, metrics));
  return question.parts.map((part, pi) => {
    const nodes = pi === 0 ? [...introduction] : [];
    const before = pi === 0 ? 0 : template.partGap;
    const promptOffset = before + nodes.reduce((sum, node) => sum + node.height, 0);
    nodes.push(...richParagraphs(part.text, measure, { width: textWidth, prefix: `(${String.fromCharCode(97 + pi)})` }));
    const type = responseType(part);
    nodes.push(...responseNodes(part, type, measure, textWidth));
    if (part.bank?.length) nodes.push(tableNode({ rows: [[part.bank.join('   •   ')]], header: true }, measure, textWidth));
    for (const table of partTables(part)) nodes.push(tableNode(table, measure, textWidth));
    if (type === 'written' && part.lines) nodes.push({ type: 'answers', visible: part.showAnswerLines !== false, count: part.lines, leading: template.answerLeading, after: 2, height: part.lines * template.answerLeading + 2 });
    return {
      question: qi + 1, part: String.fromCharCode(97 + pi), first: pi === 0,
      marks: part.marks,
      markSize: Math.min(11, Math.floor((columns.marks - 12) / measure(`[${part.marks}]`, 1, false) * 2) / 2),
      nodes, before, promptOffset, height: before + nodes.reduce((s, n) => s + n.height, 0) + pad * 2,
    };
  });
}

export function layoutPaper(paper, measure) {
  const metrics = layoutMetrics(paper);
  const { template, columns } = metrics;
  for (const [label, value, size, bold, width] of [
    ['Paper title', paper.title, 15, true, PAGE.body],
    ['Subject', paper.subject, 13, true, PAGE.body],
    ['Class / CA', paper.level, 12, true, PAGE.body],
    ['Duration', `Duration: ${paper.duration}`, 12, true, PAGE.body],
    ['Page heading', `${paper.subject}  ·  ${paper.level}  ·  Paper ${paper.paper}`, 9, true, PAGE.body],
    ['Footer', footerText(paper), 8, false, PAGE.body - 50],
  ]) {
    if (measure(value, size, bold) > width) throw new Error(`${label} is too wide for the school template. Shorten the text and update the preview.`);
  }
  const pages = [];
  const top = PAGE.top + 34;
  const capacity = PAGE.bottom - top;
  let page;
  const nextPage = () => { page = { rows: [], fragments: [], used: 0, top }; pages.push(page); };
  nextPage();
  for (const [qi, question] of paper.questions.entries()) {
    const rows = makeRows(question, qi, measure, metrics);
    // Pack complete subquestions rather than moving a whole question to a fresh page.
    let fragment = null;
    for (const row of rows) {
      const headerHeight = fragment ? 0 : template.fragmentHeaderHeight;
      if (row.height + headerHeight > capacity) throw new Error(`Question ${row.question}(${row.part}) is too tall for one page. Reduce its image or answer space, or split the subquestion.`);
      if (page.used + row.height + headerHeight > capacity) { nextPage(); fragment = null; }
      const continued = !row.first && !fragment;
      if (continued) {
        if (template.mode !== 'cards') {
          const note = paragraph(`Question ${row.question} continued`, measure, { width: metrics.textWidth, size: 9, bold: true, leading: 12, after: 5 });
          row.nodes.unshift(note);
          row.promptOffset += note.height;
          row.height += note.height;
          if (row.height > capacity) throw new Error(`Question ${row.question}(${row.part}) needs less answer space to fit its continuation label.`);
        }
      }
      if (!fragment) {
        fragment = { question: row.question, continued, y: top + page.used, height: 0, headerHeight: template.fragmentHeaderHeight, rows: [] };
        page.fragments.push(fragment);
        page.used += template.fragmentHeaderHeight;
      }
      row.number = template.mode === 'cards' ? '' : row.first || continued ? `${row.question}` : '';
      row.numberSize = columns.number ? Math.min(11.5, Math.floor((columns.number - 8) / measure(String(row.question), 1, true) * 2) / 2) : 0;
      row.y = top + page.used;
      if (fragment.rows.length) fragment.rows.at(-1).fragmentEnd = false;
      row.fragmentStart = fragment.rows.length === 0;
      row.fragmentEnd = true;
      page.rows.push(row);
      fragment.rows.push(row);
      page.used += row.height;
      fragment.height = top + page.used - fragment.y;
    }
  }
  const instructions = instructionTexts(paper).map(text => paragraph(text, measure, { width: 490, size: 10.5, leading: 14, after: 4 }));
  const overflow = instructions.reduce((height, node) => height + node.height, 0) > 206;
  const coverInstructions = [], instructionPages = [];
  let used = 0, continuing = false;
  for (const node of instructions) {
    if (!continuing && used + node.height <= (overflow ? 184 : 206)) {
      coverInstructions.push(node);
      used += node.height;
      continue;
    }
    continuing = true;
    let page = instructionPages.at(-1);
    if (!page || page.used + node.height > 700) {
      page = { nodes: [], used: 0 };
      instructionPages.push(page);
    }
    page.nodes.push(node);
    page.used += node.height;
  }
  const instructionHeight = coverInstructions.reduce((sum, node) => sum + node.height, 0);
  const informationY = 416 + instructionHeight + (instructionPages.length ? 22 : 0) + 14;
  const cover = { instructionsY: 416, informationY, marksY: informationY + 98 };
  return { cover, coverInstructions, instructionPages, pages, pageCount: pages.length + instructionPages.length + 1, totalMarks: paper.targetMarks, template: template.id, metrics };
}
