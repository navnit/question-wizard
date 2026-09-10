import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun, Footer,
  Packer, WidthType, TableLayoutType, BorderStyle, HeightRule, LineRuleType,
  AlignmentType, PageNumber, TabStopType, SectionType, VerticalAlign, Tab,
} from 'docx';
import { CHECKBOX_SIZE, checkboxPng } from './answer-checkbox.js';
import { PAGE, PAD } from './layout.js';
import { footerText } from './paper.js';
import { PAPER_GRAY } from './templates.js';

const twips = value => Math.round(value * 20);
const width = value => ({ size: twips(value), type: WidthType.DXA });
const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
const grayBorder = { style: BorderStyle.SINGLE, size: 4, color: PAPER_GRAY };
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const borders = value => ({ top: value, bottom: value, left: value, right: value, insideHorizontal: value, insideVertical: value });
const edgeBorders = ({ top = none, bottom = none, left = none, right = none } = {}) => ({ top, bottom, left, right });
const font = () => 'Liberation Sans';

function p(lines = [''], { size = 11.5, bold = false, color, leading = 16, after = 0, align = 'left', before = 0, ...other } = {}) {
  return new Paragraph({
    children: lines.map((text, index) => new TextRun({ text, font: font(), bold, color, size: size * 2, ...(index ? { break: 1 } : {}) })),
    spacing: { before: twips(before), after: twips(after), line: twips(leading), lineRule: LineRuleType.EXACT },
    alignment: align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT,
    widowControl: false, ...other,
  });
}
const spacer = height => p([''], { size: 1, leading: height });
function imageParagraph(assets, name, w, h, after = 0, align = AlignmentType.CENTER) {
  return new Paragraph({
    children: [new ImageRun({ type: assets[name][0] === 255 ? 'jpg' : 'png', data: assets[name], transformation: { width: w * 4 / 3, height: h * 4 / 3 } })],
    alignment: align,
    spacing: { before: 0, after: twips(after), line: twips(h + 2), lineRule: LineRuleType.AT_LEAST },
  });
}
function cell(children, w, { padding = PAD, bordered = true, cellBorders, ...other } = {}) {
  return new TableCell({ children, width: width(w), margins: { top: twips(padding), bottom: twips(padding), left: twips(padding), right: twips(padding) }, borders: cellBorders || borders(bordered ? border : none), verticalAlign: VerticalAlign.TOP, ...other });
}
function table(rows, widths, bordered = true) {
  const tableBorders = typeof bordered === 'object' ? bordered : borders(bordered ? border : none);
  return new Table({ rows, width: width(widths.reduce((a, b) => a + b, 0)), columnWidths: widths.map(twips), layout: TableLayoutType.FIXED, borders: tableBorders, indent: { size: 0, type: WidthType.DXA } });
}

function richParagraph(node) {
  return node.lines.map((line, index) => {
    const children = [], tabStops = [];
    let cursor = line.runs[0]?.x ?? node.indent;
    const left = cursor;
    const tabTo = (position, blank = false) => {
      tabStops.push({ type: TabStopType.LEFT, position: twips(position), ...(blank ? { leader: 'underscore' } : {}) });
      children.push(new TextRun({ children: [new Tab()], font: font(), size: 23, ...(blank ? { underline: {} } : {}) }));
    };
    for (const run of line.runs) {
      if (run.x > cursor + 0.001) tabTo(run.x);
      if (run.type === 'blank') tabTo(run.x + run.width, true);
      else if (run.type === 'checkbox') children.push(new ImageRun({
        type: 'png', data: checkboxPng,
        transformation: { width: CHECKBOX_SIZE * 4 / 3, height: CHECKBOX_SIZE * 4 / 3 },
        altText: { title: 'Square checkbox', description: 'Square checkbox', name: 'Square checkbox' },
      }));
      else children.push(new TextRun({
        text: run.text, font: font(), size: run.size * 2,
        bold: run.bold, italics: run.italic,
        ...(run.marks.includes('underline') ? { underline: {} } : {}),
        // Native baseline positioning avoids Word applying a second automatic
        // script-size reduction to our already measured smaller font size.
        ...(run.offset ? { position: `${-run.offset}pt` } : {}),
      }));
      cursor = run.x + run.width;
    }
    if (!children.length) children.push(new TextRun({ text: '', font: font(), size: 23 }));
    return new Paragraph({
      children, tabStops, indent: { left: twips(left) },
      spacing: { before: 0, after: index === node.lines.length - 1 ? twips(node.after) : 0, line: twips(line.height), lineRule: LineRuleType.EXACT },
      widowControl: false,
    });
  });
}

function contentNodes(nodes, assets) {
  return nodes.flatMap(node => {
    if (node.type === 'paragraph') return [p(node.lines, node)];
    if (node.type === 'rich-paragraph') return richParagraph(node);
    if (node.type === 'image') return [imageParagraph(assets, node.name, node.width, node.imageHeight, node.after)];
    if (node.type === 'image-row') return [
      table([new TableRow({
        cantSplit: true, height: { value: twips(node.height - node.after), rule: HeightRule.EXACT },
        children: node.widths.map((w, index) => {
          const image = index === 1 ? null : node.images[index / 2];
          return cell([image ? imageParagraph(assets, image.name, image.width, image.height) : spacer(1)], w, { padding: 0, bordered: false });
        }),
      })], node.widths, false), spacer(node.after),
    ];
    if (node.type === 'answers') return Array.from({ length: node.count }, (_, i) => p([''], {
      leading: node.leading, size: 1, after: i === node.count - 1 ? node.after : 0,
      ...(node.visible !== false ? { border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: '000000', space: 3 }, between: { style: BorderStyle.DOTTED, size: 4, color: '000000', space: 3 } } } : {}),
    }));
    if (node.type === 'table') return [
      table(node.rows.map(row => new TableRow({
        cantSplit: true, height: { value: twips(row.height), rule: HeightRule.EXACT },
        children: row.cells.map((lines, i) => cell([p(lines, { size: 11, bold: row.bold, leading: 15 })], node.widths[i], { padding: 5, ...(row.bold ? { shading: { fill: PAPER_GRAY } } : {}) })),
      })), node.widths), spacer(node.after + 1),
    ];
    throw new Error(`Unsupported document content: ${node.type}`);
  });
}

function cover(paper, assets, plan) {
  return [
    table([new TableRow({ children: [
      cell([imageParagraph(assets, 'school', 110, 50, 0, AlignmentType.LEFT)], 200, { padding: 0, bordered: false }),
      cell([imageParagraph(assets, 'cambridge', 180, 37, 0, AlignmentType.RIGHT)], PAGE.body - 200, { padding: 0, bordered: false }),
    ] })], [200, PAGE.body - 200], false),
    spacer(18), p([paper.title], { size: 15, bold: true, align: 'center', leading: 22, after: 12 }),
    p([paper.subject], { size: 13, bold: true, align: 'center', leading: 20 }),
    p([paper.level], { size: 12, bold: true, align: 'center', leading: 20, after: 6 }),
    p([paper.sample ? 'SAMPLE PAPER' : ''], { size: 8, align: 'center', leading: 12, after: 16 }),
    table([new TableRow({ height: { value: twips(32), rule: HeightRule.EXACT }, children: [
      cell([p(['NAME:'], { bold: true })], 58, { padding: 7, bordered: false }), cell([p()], PAGE.body - 58),
    ] })], [58, PAGE.body - 58], false),
    spacer(17), p([`DATE:             /             / ${paper.dateYear ?? paper.year.slice(0, 4)}`], { bold: true, after: 12 }),
    p([], { children: [new TextRun({ children: [`Paper ${paper.paper}`, new Tab(), 'Signature of the Invigilator'], font: font(), bold: true, size: 23 })], tabStops: [{ type: TabStopType.RIGHT, position: twips(PAGE.body) }], before: 10, after: 16, border: { top: { ...border, space: 12 } } }),
    p([`Duration: ${paper.duration}`], { bold: true, after: 12 }),
    p(['Instructions:'], { bold: true, leading: 18, after: 12, border: { top: { ...border, space: 12 } } }),
    ...plan.coverInstructions.map(node => p(node.lines.map((line, index) => `${index ? '   ' : '•  '}${line}`), { size: node.size, leading: node.leading, after: node.after })),
    ...(plan.instructionPages.length ? [p(['Instructions continue on the next page.'], { size: 10.5, bold: true, leading: 14, after: 4 })] : []),
    spacer(14), p(['Information:'], { bold: true, leading: 18, after: 12 }),
    ...['Answer all questions in the space provided.', 'The marks for each question are shown in brackets [ ].', 'At the end, fasten all your work securely together.'].map(s => p([`•  ${s}`], { size: 10.5, leading: 14, after: 6 })),
    spacer(10),
    table([
      new TableRow({ children: ['MAXIMUM MARKS', 'MARKS SCORED', "SUBJECT TEACHER'S SIGN"].map(t => cell([p([t], { size: 9, bold: true, align: 'center', leading: 14 })], PAGE.body / 3, { padding: 5, shading: { fill: PAPER_GRAY } })) }),
      new TableRow({ height: { value: twips(28), rule: HeightRule.EXACT }, children: [String(paper.targetMarks), '', ''].map(t => cell([p([t], { bold: true, align: 'center' })], PAGE.body / 3, { padding: 5 })) }),
    ], [PAGE.body / 3, PAGE.body / 3, PAGE.body / 3]),
    spacer(1),
  ];
}

function fragmentTable(fragment, template, assets) {
  const { columns, pad, mode } = template;
  const noInside = { ...borders(none), insideHorizontal: none, insideVertical: mode === 'classic' ? border : none };
  const bodyRows = fragment.rows.map((row, index) => {
    const first = index === 0, last = index === fragment.rows.length - 1;
    const top = first ? mode === 'ledger' ? border : mode === 'classic' ? border : none : none;
    const bottom = last ? mode === 'ledger' ? grayBorder : border : none;
    const content = [...(row.before ? [spacer(row.before)] : []), ...contentNodes(row.nodes, assets)];
    const marks = [p([`[${row.marks}]`], { size: row.markSize, before: row.promptOffset })];

    if (mode === 'cards') return new TableRow({
      cantSplit: true, height: { value: twips(row.height), rule: HeightRule.ATLEAST },
      children: [
        cell(content, columns.content, { padding: pad, cellBorders: edgeBorders({ left: border, bottom }) }),
        cell(marks, columns.marks, { padding: 6, cellBorders: edgeBorders({ right: border, bottom }) }),
      ],
    });

    const numberChildren = mode === 'ledger' && first ? [
      table([new TableRow({
        cantSplit: true, height: { value: twips(22), rule: HeightRule.EXACT },
        children: [cell([p([row.number], { bold: true, size: 10, color: 'FFFFFF', align: 'center', leading: 14 })], 22, {
          padding: 2, shading: { fill: '000000' }, cellBorders: borders(none), verticalAlign: VerticalAlign.CENTER,
        })],
      })], [22], borders(none)), spacer(1),
    ] : [
      ...(mode === 'classic' && row.before ? [spacer(row.before)] : []),
      p([row.number], { bold: true, size: row.numberSize }),
    ];
    return new TableRow({
      cantSplit: true, height: { value: twips(row.height), rule: HeightRule.ATLEAST },
      children: [
        cell(numberChildren, columns.number, {
          padding: mode === 'ledger' ? 5 : pad,
          cellBorders: edgeBorders({ top, bottom, left: mode === 'classic' ? border : none, right: mode === 'classic' ? border : none }),
        }),
        cell(content, columns.content, {
          padding: pad,
          cellBorders: edgeBorders({ top, bottom, right: mode === 'classic' ? border : none }),
        }),
        cell(marks, columns.marks, {
          padding: 6,
          cellBorders: edgeBorders({ top, bottom, right: mode === 'classic' ? border : none }),
        }),
      ],
    });
  });

  if (mode === 'cards') {
    const label = `QUESTION ${fragment.question}${fragment.continued ? ' CONTINUED' : ''}`;
    const header = new TableRow({
      cantSplit: true, height: { value: twips(fragment.headerHeight), rule: HeightRule.EXACT },
      children: [cell([p([label], { size: 9, bold: true, leading: 14 })], PAGE.body, {
        padding: 6, columnSpan: 2, shading: { fill: PAPER_GRAY }, cellBorders: borders(border),
      })],
    });
    return table([header, ...bodyRows], [columns.content, columns.marks], noInside);
  }
  return table(bodyRows, [columns.number, columns.content, columns.marks], noInside);
}

export async function exportDocx(paper, plan, assets) {
  const sectionProps = { type: SectionType.NEXT_PAGE, page: {
    size: { width: twips(PAGE.width), height: twips(PAGE.height) },
    margin: { top: twips(PAGE.top), bottom: twips(PAGE.height - PAGE.bottom - 10), left: twips(PAGE.left), right: twips(PAGE.left), footer: twips(20), header: 0 },
  } };
  const footer = () => new Footer({ children: [new Paragraph({
    children: [new TextRun({ text: footerText(paper), font: font(false), size: 16 }), new TextRun({ text: '\t', size: 16 }), new TextRun({ children: [PageNumber.CURRENT, ` / ${plan.pageCount}`], font: font(false), size: 16 })],
    tabStops: [{ type: TabStopType.RIGHT, position: twips(PAGE.body) }], spacing: { before: 0, after: 0 },
  })] });
  const sections = [{ properties: sectionProps, footers: { default: footer() }, children: cover(paper, assets, plan) }];
  for (const continued of plan.instructionPages) {
    sections.push({ properties: sectionProps, footers: { default: footer() }, children: [
      p(['Instructions (continued)'], { size: 12, bold: true, leading: 18, after: 16 }),
      ...continued.nodes.map(node => p(node.lines.map((line, index) => `${index ? '   ' : '•  '}${line}`), { size: node.size, leading: node.leading, after: node.after })),
    ] });
  }
  for (const [index, page] of plan.pages.entries()) {
    sections.push({ properties: sectionProps, footers: { default: footer() }, children: [
      p([`${paper.subject}  ·  ${paper.level}  ·  Paper ${paper.paper}`], { size: 9, bold: true, leading: 16, after: 18 }),
      ...page.fragments.flatMap((fragment, fragmentIndex) => [
        fragmentTable(fragment, plan.metrics.template, assets),
        ...(fragmentIndex < page.fragments.length - 1 ? [spacer(6)] : []),
      ]),
      ...(index === plan.pages.length - 1 ? [p(['END OF PAPER'], { size: 10, bold: true, align: 'center', leading: 16, before: 8 })] : [spacer(1)]),
    ] });
  }
  const doc = new Document({
    creator: 'Question Wizard', title: paper.title,
    fonts: ['regular', 'bold', 'italic', 'boldItalic'].filter(key => assets[key]).map(key => ({ name: 'Liberation Sans', data: assets[key] })),
    styles: { default: { document: { run: { font: font(false), size: 23 }, paragraph: { spacing: { before: 0, after: 0 } } } } },
    sections,
  });
  // docx currently labels every embedded face as embedRegular. Override only
  // its font table, retaining the library's font obfuscation and relationships.
  const faces = ['regular', 'bold', 'italic', 'boldItalic'].filter(key => assets[key]);
  const relationships = doc.FontTable.fontOptionsWithKey.map(({ fontKey }, index) => {
    const face = faces[index][0].toUpperCase() + faces[index].slice(1);
    return `<w:embed${face} r:id="rId${index + 1}" w:fontKey="{${fontKey}}"/>`;
  }).join('');
  const fontTable = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:fonts xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:font w:name="Liberation Sans"><w:family w:val="swiss"/><w:pitch w:val="variable"/>${relationships}</w:font></w:fonts>`;
  return Packer.toBlob(doc, false, [{ path: 'word/fontTable.xml', data: fontTable }]);
}
