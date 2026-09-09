import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { PAGE, paragraph, layoutPaper } from './layout.js';
import { footerText, validatePaper } from './paper.js';
import { questionImages } from './content.js';

const black = rgb(0, 0, 0);
const white = rgb(1, 1, 1);
const gray = rgb(217 / 255, 217 / 255, 217 / 255);
export async function exportPdf(paper, assets, { draft = false } = {}) {
  const validation = validatePaper(paper);
  if (!draft && validation.errors.length) throw new Error(validation.errors.join(' '));
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`${paper.title} - ${paper.subject}`);
  doc.setAuthor('Question Wizard');
  const fonts = Object.fromEntries(await Promise.all(['regular', 'bold', 'italic', 'boldItalic'].filter(key => assets[key]).map(async key => [key, await doc.embedFont(assets[key], { subset: true })])));
  const images = { school: await doc.embedJpg(assets.school), cambridge: await doc.embedPng(assets.cambridge) };
  for (const name of new Set(paper.questions.flatMap(questionImages).map(image => image.name))) {
    const bytes = assets[name];
    if (!bytes) throw new Error('A question diagram is missing. Attach it again.');
    try { images[name] = bytes[0] === 255 ? await doc.embedJpg(bytes) : await doc.embedPng(bytes); }
    catch { throw new Error('A diagram could not be read. Attach a valid PNG or JPEG image.'); }
  }
  const supported = Object.fromEntries(Object.entries(fonts).map(([key, font]) => [key, new Set(font.getCharacterSet())]));
  const fontKey = (bold, italic) => italic ? bold ? 'boldItalic' : 'italic' : bold ? 'bold' : 'regular';
  const measure = (text, size, bold, italic = false) => {
    const key = fontKey(bold, italic);
    if (!fonts[key]) throw new Error('A paper font is missing. Reconnect to finish downloading the app.');
    for (const character of text) {
      if (!supported[key].has(character.codePointAt(0))) throw new Error(`The paper font does not support “${character}”. Use supported English text, or include that content in a diagram.`);
    }
    return fonts[key].widthOfTextAtSize(text, size);
  };
  const plan = layoutPaper(paper, measure);
  let page;
  const text = (value, x, y, size = 11.5, bold = false, color = black) => page.drawText(value, { x, y: PAGE.height - y - size, size, font: fonts[bold ? 'bold' : 'regular'], color });
  const centered = (value, y, size = 11.5, bold = false) => text(value, (PAGE.width - measure(value, size, bold)) / 2, y, size, bold);
  const line = (x1, y1, x2, y2, thickness = 0.6, color = black) => page.drawLine({ start: { x: x1, y: PAGE.height - y1 }, end: { x: x2, y: PAGE.height - y2 }, thickness, color });
  const rect = (x, y, width, height, { border = black, fill } = {}) => page.drawRectangle({ x, y: PAGE.height - y - height, width, height, borderColor: border, borderWidth: 0.6, ...(fill ? { color: fill } : {}) });
  const image = (name, x, y, width, height) => page.drawImage(images[name], { x, y: PAGE.height - y - height, width, height });
  const drawParagraph = (node, x, y, width) => {
    node.lines.forEach((value, i) => text(value, node.align === 'center' ? x + (width - measure(value, node.size, node.bold)) / 2 : x, y + i * node.leading, node.size, node.bold));
  };
  const drawRichParagraph = (node, x, y) => {
    for (const measured of node.lines) for (const run of measured.runs) {
      const baseline = y + measured.y + measured.baseline + run.offset;
      if (run.type === 'blank') line(x + run.x, baseline + 1.5, x + run.x + run.width, baseline + 1.5);
      else if (run.type === 'checkbox') rect(x + run.x + 0.5, baseline - 8.5, run.width - 1, 8.5);
      else {
        page.drawText(run.text, { x: x + run.x, y: PAGE.height - baseline, size: run.size, font: fonts[fontKey(run.bold, run.italic)], color: black });
        if (run.marks.includes('underline')) line(x + run.x, baseline + 1.5, x + run.x + run.width, baseline + 1.5, 0.5);
      }
    }
  };
  const footer = (index) => {
    text(footerText(paper), PAGE.left, 810, 8);
    const label = `${index} / ${plan.pageCount}`;
    text(label, PAGE.width - PAGE.left - measure(label, 8, false), 810, 8);
  };
  page = doc.addPage([PAGE.width, PAGE.height]);
  image('school', 36, 22, 110, 50);
  image('cambridge', 379, 31, 180, 37);
  centered(paper.title, 106, 15, true);
  centered(paper.subject, 142, 13, true);
  centered(paper.level, 164, 12, true);
  if (paper.sample) centered('SAMPLE PAPER', 187, 8);
  text('NAME:', 36, 224, 12, true); rect(94, 214, 465, 32);
  text(`DATE:             /             / ${paper.year.slice(0, 4)}`, 36, 271, 12, true);
  line(36, 310, 559, 310, 1);
  text(`Paper ${paper.paper}`, 36, 330, 12, true);
  text('Signature of the Invigilator', 363, 330, 11.5, true);
  text(`Duration: ${paper.duration}`, 36, 372, 12, true);
  line(36, 410, 559, 410, 1);
  text('Instructions:', 44, 438, 12, true);
  const instructions = [
    'Use HB pencils for writing.',
    'Fill in the boxes at the top of this page with your name and date.',
    'You may use a soft pencil for diagrams, graphs or rough working.',
    'Do not use staples, paper clips or highlighters.',
    'Do not use whitener, correction fluid or correction tape.',
  ];
  instructions.forEach((value, i) => text(`•  ${value}`, 49, 466 + i * 25, 10.5));
  text('Information:', 44, 613, 12, true);
  ['Answer all questions in the space provided.', 'The marks for each question are shown in brackets [ ].', 'At the end, fasten all your work securely together.'].forEach((value, i) => text(`•  ${value}`, 49, 642 + i * 25, 10.5));
  const widths = [174.43, 174.43, 174.42]; let sx = 36;
  ['MAXIMUM MARKS', 'MARKS SCORED', "SUBJECT TEACHER'S SIGN"].forEach((value, i) => {
    rect(sx, 728, widths[i], 23, { fill: gray }); text(value, sx + (widths[i] - measure(value, 9, true)) / 2, 734, 9, true);
    rect(sx, 751, widths[i], 28);
    if (!i) text(String(paper.targetMarks), sx + 80, 756, 12, true);
    sx += widths[i];
  });
  footer(1);
  for (const [index, planned] of plan.pages.entries()) {
    page = doc.addPage([PAGE.width, PAGE.height]);
    const { template, columns, pad } = plan.metrics;
    text(`${paper.subject}  ·  ${paper.level}  ·  Paper ${paper.paper}`, PAGE.left, PAGE.top, 9, true);
    line(PAGE.left, PAGE.top + 21, PAGE.width - PAGE.left, PAGE.top + 21);
    for (const fragment of planned.fragments) {
      const x = PAGE.left, y = fragment.y;
      if (template.mode === 'classic') {
        rect(x, y, PAGE.body, fragment.height);
        line(x + columns.number, y, x + columns.number, y + fragment.height);
        line(x + columns.number + columns.content, y, x + columns.number + columns.content, y + fragment.height);
      } else if (template.mode === 'ledger') {
        line(x, y, x + PAGE.body, y, 1.2, black);
        line(x, y + fragment.height, x + PAGE.body, y + fragment.height, 0.8, gray);
        rect(x + 5, y + 5, 22, 22, { fill: black });
        const number = String(fragment.question);
        text(number, x + 16 - measure(number, 10, true) / 2, y + 10, 10, true, white);
      } else {
        rect(x, y, PAGE.body, fragment.height);
        rect(x, y, PAGE.body, fragment.headerHeight, { fill: gray });
        text(`QUESTION ${fragment.question}${fragment.continued ? ' CONTINUED' : ''}`, x + pad, y + 7, 9, true);
      }
    }
    for (const row of planned.rows) {
      const x = PAGE.left; const y = row.y;
      if (template.mode === 'classic' && row.number) text(row.number, x + 4, y + pad + row.before, row.numberSize, true);
      const marksX = x + columns.number + columns.content;
      text(`[${row.marks}]`, marksX + 6, y + pad + row.promptOffset, row.markSize);
      let cursor = y + pad + row.before;
      const contentX = x + columns.number + pad;
      const width = columns.content - pad * 2;
      for (const node of row.nodes) {
        if (node.type === 'paragraph') drawParagraph(node, contentX, cursor, width);
        if (node.type === 'rich-paragraph') drawRichParagraph(node, contentX, cursor);
        if (node.type === 'image') image(node.name, contentX + (width - node.width) / 2, cursor, node.width, node.imageHeight);
        if (node.type === 'image-row') for (const diagram of node.images) image(diagram.name, contentX + diagram.x, cursor, diagram.width, diagram.height);
        if (node.type === 'answers') for (let i = 0; i < node.count; i++) {
          page.drawLine({ start: { x: contentX, y: PAGE.height - cursor - (i + 1) * node.leading + 5 }, end: { x: contentX + width - 2, y: PAGE.height - cursor - (i + 1) * node.leading + 5 }, thickness: 0.5, color: gray, dashArray: [1, 2] });
        }
        if (node.type === 'table') {
          let ty = cursor;
          for (const tr of node.rows) {
            let tx = contentX;
            for (const [ci, lines] of tr.cells.entries()) {
              rect(tx, ty, node.widths[ci], tr.height, tr.bold ? { fill: gray } : {});
              lines.forEach((value, li) => text(value, tx + 6, ty + 5 + li * 15, 11, tr.bold));
              tx += node.widths[ci];
            }
            ty += tr.height;
          }
        }
        cursor += node.height;
      }
    }
    if (index === plan.pages.length - 1) centered('END OF PAPER', Math.min(PAGE.bottom + 5, planned.top + planned.used + 12), 10, true);
    footer(index + 2);
  }
  return { bytes: await doc.save(), plan, measure };
}
