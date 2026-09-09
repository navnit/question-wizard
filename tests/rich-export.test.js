import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { exportPdf } from '../src/pdf-export.js';
import { exportDocx } from '../src/docx-export.js';
import { createProject } from '../src/project.js';
import JSZip from 'jszip';
import { layoutPaper, TEXT_WIDTH } from '../src/layout.js';
import { samplePaper } from '../src/paper.js';
import { PDFDocument, PDFName, decodePDFRawStream } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const assets = Object.fromEntries(await Promise.all(Object.entries({regular:'LiberationSans-Regular.ttf',bold:'LiberationSans-Bold.ttf',italic:'LiberationSans-Italic.ttf',boldItalic:'LiberationSans-BoldItalic.ttf',school:'school-logo.jpg',cambridge:'cambridge-logo.png',skeleton:'skeleton.png'}).map(async ([key, file]) => [key, new Uint8Array(await readFile(`public/assets/${file}`))])));
const run = (text, marks = []) => ({ type: 'text', text, marks });
const document = content => ({ type: 'doc', blocks: [{ type: 'paragraph', content }] });
const textOfXml = xml => [...xml.matchAll(/<w:t(?:\s[^>]*)?>(.*?)<\/w:t>/g)].map(match => match[1]).join('');
async function pdfOperators(bytes) {
  const pdf = await PDFDocument.load(bytes);
  return Buffer.from(decodePDFRawStream(pdf.getPage(1).node.Contents().lookup(0)).decode()).toString();
}
function fixture() {
  const paper = createProject().paper; paper.targetMarks = 1;
  paper.questions[0].context = document([]);
  paper.questions[0].parts[0].text = document([run('Explain '), run('why', ['bold', 'italic', 'underline']), run(' H'), run('2', ['subscript']), run('O and x'), run('2', ['superscript']), run(' matter.')]);
  return paper;
}
async function xmlFor(paper) {
  const result = await exportPdf(paper, assets);
  const blob = await exportDocx(paper, result.plan, assets);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  return { result, xml: await zip.file('word/document.xml').async('string'), fontXml: await zip.file('word/fontTable.xml').async('string') };
}
test('rich prompt exports native formatting and aligns marks at its explicit prompt offset', async () => {
  const {result, xml, fontXml} = await xmlFor(fixture());
  assert.equal(result.plan.pages[0].rows[0].promptOffset, 0);
  assert.match(xml, /<w:i(?:\s|\/|>)/);
  assert.match(xml, /<w:u(?:\s|\/|>)/);
  assert.match(xml, /(?:subscript|w:position w:val="-)/);
  assert.match(xml, /(?:superscript|w:position w:val="[1-9])/);
  assert.ok(result.bytes.length > 1000);
  for (const face of ['Regular', 'Bold', 'Italic', 'BoldItalic']) assert.match(fontXml, new RegExp(`<w:embed${face} `));
  const pdf = await PDFDocument.load(result.bytes);
  const page = pdf.getPage(1);
  const operators = Buffer.from(decodePDFRawStream(page.node.Contents().lookup(0)).decode()).toString();
  assert.ok((operators.match(/ Tf/g) || []).length >= 10, 'styled runs are drawn separately');
  const fonts = page.node.Resources().lookup(PDFName.of('Font'));
  const fontNames = fonts.entries().map(([, value]) => pdf.context.lookup(value).get(PDFName.of('BaseFont')).toString());
  assert.ok(fontNames.some(name => name.includes('BoldItalic')), 'PDF embeds and uses the real bold-italic face');
  const textTask = getDocument({data:result.bytes.slice(),useSystemFonts:false});
  const textPdf = await textTask.promise;
  const content = await (await textPdf.getPage(2)).getTextContent();
  const why = content.items.find(item => item.str === 'why');
  assert.ok(why);
  const digits = content.items.filter(item => item.str === '2');
  assert.ok(digits.some(item => item.transform[5] > why.transform[5]));
  assert.ok(digits.some(item => item.transform[5] < why.transform[5]));
  await textTask.destroy();
});
test('multiple-choice prints ordered options but not written answer lines or inactive answers', async () => {
  const paper = fixture(), part = paper.questions[0].parts[0];
  part.responseType = 'multiple-choice'; part.options = ['Sunlight', 'Moonlight', 'Sound', 'Heat']; part.lines = 12;
  const {result, xml} = await xmlFor(paper);
  assert.equal(result.plan.pages[0].rows[0].nodes.some(n => n.type === 'answers'), false);
  assert.ok(xml.indexOf('Sunlight') < xml.indexOf('Moonlight'));
  assert.ok(xml.indexOf('Moonlight') < xml.indexOf('Sound'));
  assert.match(xml, /Heat/);
  part.responseType = 'true-false';
  const tf = await xmlFor(paper);
  assert.match(tf.xml, /True/); assert.match(tf.xml, /False/); assert.doesNotMatch(tf.xml, /Sunlight/);
});
test('blank tokens and list groups survive both exports without flattening the rich document', async () => {
  const paper = fixture();
  paper.questions[0].parts[0].text = {type:'doc',blocks:[
    {type:'paragraph',content:[run('Water is '),{type:'blank'},run('.') ]},
    {type:'ordered',group:'one',content:[run('First observation')]},
    {type:'ordered',group:'one',content:[run('Second observation')]},
    {type:'paragraph',content:[run('Now consider:')]},
    {type:'ordered',group:'two',content:[run('New first observation')]},
  ]};
  const before = structuredClone(paper);
  const {xml, result} = await xmlFor(paper);
  assert.match(textOfXml(xml), /First observation/); assert.match(textOfXml(xml), /Second observation/); assert.match(textOfXml(xml), /New first observation/);
  assert.deepEqual(paper, before);
  const nodes = result.plan.pages[0].rows[0].nodes.filter(n => n.type === 'rich-paragraph');
  assert.deepEqual(nodes.filter(n => n.listMarker).map(n => n.listMarker), ['1.', '2.', '1.']);
  const blank = nodes.flatMap(n => n.lines.flatMap(l => l.runs)).find(r => r.type === 'blank');
  assert.ok(Math.abs(blank.width - 85.03937) < 0.001);
  assert.match(xml, /w:pos="\d+"/);
  assert.match(xml, /w:leader="underscore"/);
  const operators = await pdfOperators(result.bytes);
  const segments = [...operators.matchAll(/([-\d.]+) ([-\d.]+) m\s+([-\d.]+) ([-\d.]+) l/g)];
  assert.ok(segments.some(([,x1,y1,x2,y2]) => Math.abs(Number(x2)-Number(x1)-85.03937) < 0.001 && y1 === y2), 'PDF draws a physical 3cm horizontal blank');
});

test('words spanning marks stay together, spaces survive, and scripts reserve line geometry', () => {
  const paper = fixture(), part = paper.questions[0].parts[0];
  // 20pt label, 10pt letters: 37 letters plus a space leave room for only half of "foobar".
  part.text = document([run('x'.repeat(37) + ' '), run('foo', ['bold']), run('bar', ['italic']), run(' next '), run('2', ['superscript']), run('3', ['subscript'])]);
  const row = layoutPaper(paper, (s, size) => s.length * size / 1.15).pages[0].rows[0];
  const node = row.nodes[0];
  assert.equal(node.type, 'rich-paragraph');
  assert.equal(node.lines[0].runs.filter(r => r.role !== 'label').map(r => r.text || '').join(''), 'x'.repeat(37));
  assert.match(node.lines[1].runs.map(r => r.text || '').join(''), /^foobar next /);
  const scripts = node.lines[1].runs.filter(r => r.marks?.some(m => m.endsWith('script')));
  assert.ok(scripts.some(r => r.offset < 0)); assert.ok(scripts.some(r => r.offset > 0));
  for (const line of node.lines) for (const r of line.runs) {
    assert.ok(line.baseline + r.offset - r.size >= -0.001);
    assert.ok(line.baseline + r.offset + r.size * 0.25 <= line.height + 0.001);
  }
});

test('response labels hang under their option text and marks ignore responses, banks, and tables', async () => {
  const paper = fixture(), question = paper.questions[0], part = question.parts[0];
  question.context = document([run('Read these instructions.', ['bold'])]);
  question.images = [{name:'skeleton',width:100,height:100}];
  part.text = {type:'doc',blocks:[{type:'bullet',group:'prompt',content:[run('Choose the correct description.')]}]};
  part.responseType = 'multiple-choice'; part.options = ['This is a long option that should wrap beneath its own text. '.repeat(4), 'Short option'];
  part.bank = ['a word']; part.tables = [{rows:[['Response']],header:false}];
  const { result, xml } = await xmlFor(paper);
  const row = result.plan.pages[0].rows[0];
  assert.equal(row.promptOffset, 132);
  const options = row.nodes.filter(n => n.role === 'option');
  assert.equal(options.length, 2); assert.ok(options[0].lines.length > 1);
  const firstText = options[0].lines[0].runs.find(r => r.role !== 'label');
  assert.equal(options[0].lines[1].runs[0].x, firstText.x);
  const text = textOfXml(xml);
  assert.ok(text.indexOf('Choose the correct description.') < text.indexOf('Short option'));
  assert.ok(text.indexOf('Short option') < text.indexOf('a word'));
  assert.match(xml, /w:left="\d+"/);
  part.responseType = 'true-false';
  const tf = await xmlFor(paper);
  assert.equal(tf.result.plan.pages[0].rows[0].promptOffset, 132);
  const boxes = tf.result.plan.pages[0].rows[0].nodes.flatMap(n => n.type === 'rich-paragraph' ? n.lines.flatMap(l => l.runs) : []).filter(r => r.type === 'checkbox');
  assert.equal(boxes.length, 2);
  assert.match(tf.xml, /□/);
  part.responseType = 'written'; part.lines = 0;
  const written = await exportPdf(paper, assets);
  const tfPaths = ((await pdfOperators(tf.result.bytes)).match(/\nh\n/g) || []).length;
  const writtenPaths = ((await pdfOperators(written.bytes)).match(/\nh\n/g) || []).length;
  assert.equal(tfPaths, writtenPaths + 2, 'PDF draws both empty response boxes');
});

test('continuation marks align after the continuation label and rich prompt labels appear once', async () => {
  const result = await exportPdf(samplePaper(true), assets);
  const row = result.plan.pages.flatMap(page => page.rows).find(row => row.nodes[0].type === 'paragraph' && row.nodes[0].lines[0].includes('continued'));
  assert.ok(row);
  assert.equal(row.promptOffset, 27);
  const labels = row.nodes.flatMap(node => node.type === 'rich-paragraph' ? node.lines.flatMap(line => line.runs.filter(run => run.role === 'label' && run.text === `(${row.part})`)) : []);
  assert.equal(labels.length, 1);
});

test('real styled font measurements and atomic blanks remain within the text column', async () => {
  const paper = fixture(), part = paper.questions[0].parts[0];
  part.text = document([run('Wavy italic '),run('AVAVAV italic text ',['italic']),run('bold italic text ',['bold','italic']),run('and '),{type:'blank'},run(' end '),{type:'blank'},run('.')]);
  const { result } = await xmlFor(paper);
  for (const line of result.plan.pages[0].rows[0].nodes[0].lines) for (const run of line.runs) {
    assert.ok(run.x + run.width <= TEXT_WIDTH + 0.001);
    if (run.type === 'text') assert.equal(run.width, result.measure(run.text, run.size, run.bold, run.italic));
  }
  part.text = document([run('word'.repeat(50), ['bold']),run('word'.repeat(50), ['italic'])]);
  await assert.rejects(exportPdf(paper, assets), /word is too wide/);
});

test('an empty rich document still previews its subquestion label', async () => {
  const paper = fixture();
  paper.questions[0].parts[0].text = {type:'doc',blocks:[]};
  const result = await exportPdf(paper, assets, {draft:true});
  const row = result.plan.pages[0].rows[0];
  assert.equal(row.nodes[0].type, 'rich-paragraph');
  assert.equal(row.nodes[0].lines[0].runs[0].text, '(a)');
});

test('Word starts prompt labels at the margin before advancing to the text and blank tabs', async () => {
  const paper = fixture();
  paper.questions[0].parts[0].text = document([run('Write here '),{type:'blank'},run('.')]);
  const {xml} = await xmlFor(paper);
  const prompt = xml.match(/<w:p>[\s\S]*?<\/w:p>/g).find(p => p.includes('>(a)</w:t>'));
  assert.match(prompt, /<w:ind w:left="0"\/>/);
  const tabs = prompt.match(/<w:tab w:val="left"[^>]*\/>/g);
  assert.equal(tabs.length, 2);
  assert.doesNotMatch(tabs[0], /w:leader/);
  assert.match(tabs[1], /w:leader="underscore"/);
  assert.ok(Number(tabs[1].match(/w:pos="(\d+)"/)[1]) > Number(tabs[0].match(/w:pos="(\d+)"/)[1]));
});

test('custom exam rules appear in PDF and Word with wrapped cover text', async () => {
  const paper = fixture();
  paper.instructions = { writing: 'pen', calculator: 'allowed', nameDate: true, diagrams: false, noAttachments: false, noCorrection: false, showWorking: true, ruler: false, custom: 'Write the question number beside each answer and check that you have included all the required units before handing in your paper.' };
  const { result, xml } = await xmlFor(paper);
  const pdf = await getDocument({ data: result.bytes.slice(), useSystemFonts: true }).promise;
  const content = await (await pdf.getPage(1)).getTextContent();
  const text = content.items.map(item => item.str).join(' ');
  for (const expected of ['Use blue or black ink for writing.', 'Calculators are allowed.', 'Show all your working.']) {
    assert.ok(text.includes(expected));
    assert.ok(textOfXml(xml).includes(expected));
  }
  assert.ok(!text.includes('Use HB pencils'));
  assert.ok(!textOfXml(xml).includes('Use HB pencils'));
  assert.ok(result.plan.coverInstructions.at(-1).lines.length > 1);
  assert.ok(text.includes('handing in your paper.'));
  await pdf.cleanup();
});
test('long exam instructions continue onto another page in PDF and Word', async () => {
  const paper = fixture();
  paper.instructions = { writing: 'pen', calculator: 'allowed', nameDate: true, diagrams: true, noAttachments: true, noCorrection: true, showWorking: true, ruler: true, custom: 'Long additional instructions. '.repeat(30) };
  const { result, xml } = await xmlFor(paper);
  assert.ok(result.plan.instructionPages.length > 0);
  assert.equal(result.plan.pageCount, result.plan.pages.length + result.plan.instructionPages.length + 1);
  const pdf = await getDocument({ data: result.bytes.slice(), useSystemFonts: true }).promise;
  assert.equal(pdf.numPages, result.plan.pageCount);
  const text = (await (await pdf.getPage(2)).getTextContent()).items.map(item => item.str).join(' ');
  assert.ok(text.includes('Instructions (continued)'));
  assert.ok(text.includes('Long additional instructions.'));
  assert.ok(textOfXml(xml).includes('Instructions (continued)'));
  assert.equal(textOfXml(xml).replace(/\s+/g, ' ').split('Long additional instructions.').length - 1, 30);
  await pdf.cleanup();
});

test('PDF and Word print the chosen date year independently from the academic year', async () => {
  const paper = fixture();
  paper.year = '2026-27';
  paper.dateYear = '2031';
  const { result, xml } = await xmlFor(paper);
  const pdf = await getDocument({ data: result.bytes.slice(), useSystemFonts: true }).promise;
  const text = (await (await pdf.getPage(1)).getTextContent()).items.map(item => item.str).join(' ');
  assert.match(text, /DATE:\s*\/\s*\/\s*2031/);
  assert.match(textOfXml(xml), /DATE:\s*\/\s*\/\s*2031/);
  assert.ok(text.includes('2026-27'));
  await pdf.cleanup();
});

test('primary data tables export in PDF and Word before subquestions in all templates', async () => {
  for (const template of ['classic', 'ledger', 'cards']) {
    const paper = fixture(); paper.template = template;
    paper.questions[0].tables = [{ rows: [['Material', 'Mass'], ['Copper', '25 g']], header: true }];
    const { result, xml } = await xmlFor(paper);
    const text = textOfXml(xml);
    assert.ok(text.indexOf('Copper') >= 0 && text.indexOf('Copper') < text.indexOf('Explain'));
    const task = getDocument({ data: result.bytes.slice(), useSystemFonts: false });
    const pdf = await task.promise;
    const items = (await (await pdf.getPage(2)).getTextContent()).items.map(item => item.str).join(' ');
    assert.match(items, /Copper/);
    assert.match(items, /25 g/);
    assert.ok(items.indexOf('Copper') < items.indexOf('Explain'));
    await task.destroy();
  }
});
