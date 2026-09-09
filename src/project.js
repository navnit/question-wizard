import { parseInstructions } from './instructions.js';
import { samplePaper } from './paper.js';
import { normalizeRich } from './rich-text.js';
import { questionImages, partTables, modernizeProject, responseType } from './content.js';
import { DEFAULT_TEMPLATE_ID, isTemplateId } from './templates.js';

export const FORMAT = 'question-wizard';
export const VERSION = 4;
export const MAX_PROJECT_BYTES = 40 * 1024 * 1024;
const capacityError = () => new Error('This paper would exceed the 40 MB project limit. Use smaller diagrams or split it into separate papers.');
export const id = () => crypto.randomUUID();
export const newPart = () => ({ id: id(), text: normalizeRich(''), marks: 1, lines: 2, responseType: 'written' });
export const newQuestion = () => ({ id: id(), title: '', context: normalizeRich('', { allowBlank: false }), parts: [newPart()] });
export function createProject(example = false, now = new Date()) {
  // Use the device's local date: the academic year rolls over on June 1.
  const startYear = now.getFullYear() - (now.getMonth() < 5 ? 1 : 0);
  const academicYear = `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
  const paper = example ? samplePaper() : {
    title: 'Term 1 Assessment', subject: 'SCIENCE', level: 'CA-3', year: academicYear,
    term: 'TA-1', kind: 'QP', paper: 1, duration: '1 h 30 min', targetMarks: 40, template: DEFAULT_TEMPLATE_ID,
    sample: false, questions: [newQuestion()],
  };
  paper.year = academicYear;
  paper.dateYear = String(now.getFullYear());
  paper.questions.forEach(q => { q.id ||= id(); q.parts.forEach(p => { p.id ||= id(); }); });
  return { format: FORMAT, version: VERSION, id: id(), updatedAt: new Date().toISOString(), paper, images: {} };
}
export function duplicateProject(project) {
  const copy = structuredClone(project);
  copy.id = id(); copy.paper.title = `${copy.paper.title.slice(0, 38)} (copy)`;
  copy.paper.sample = false; copy.updatedAt = new Date().toISOString();
  return copy;
}
export function imageBytes(dataUrl) {
  return Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
}
export function dataUrl(bytes, type = 'image/png') {
  let text = '';
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:${type};base64,${btoa(text)}`;
}
export function prepareDraft(project) {
  const names = new Set(project.paper.questions.flatMap(questionImages).map(image => image.name));
  const copy = { ...project, images: Object.fromEntries(Object.entries(project.images).filter(([key]) => names.has(key))) };
  // Leave room for the bundled diagram when it has not yet been embedded.
  const reserved = names.has('skeleton') && !copy.images.skeleton ? 1024 * 1024 : 0;
  if (new TextEncoder().encode(JSON.stringify(copy)).length + reserved > MAX_PROJECT_BYTES) throw capacityError();
  return copy;
}
export function backupProject(project, assets) {
  const copy = modernizeProject(prepareDraft(project));
  copy.version = VERSION;
  const names = new Set(copy.paper.questions.flatMap(questionImages).map(image => image.name));
  copy.images = Object.fromEntries(Object.entries(copy.images).filter(([key]) => names.has(key)));
  if (names.has('skeleton') && !copy.images.skeleton) copy.images.skeleton = { name: 'Skeleton diagram.png', type: 'image/png', dataUrl: dataUrl(assets.skeleton) };
  const text = JSON.stringify(copy);
  if (new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) throw capacityError();
  return text;
}

// Backups are data, not HTML or executable templates. Copy known fields only.
export function parseProject(text) {
  if (new TextEncoder().encode(text).length > MAX_PROJECT_BYTES) throw capacityError();
  let value;
  try { value = JSON.parse(text); } catch { throw new Error('This is not a valid Question Wizard project file.'); }
  if (value?.format !== FORMAT || ![1, 2, 3, VERSION].includes(value.version)) throw new Error('Use a Question Wizard version 1, 2, 3 or 4 project backup (.qw.json).');
  const fail = field => { throw new Error(`The project has invalid ${field}. Your current draft has not been changed.`); };
  const string = (s, max, field) => typeof s === 'string' && s.length <= max ? s : fail(field);
  const number = (n, min, max, field) => Number.isFinite(n) && n >= min && n <= max ? n : fail(field);
  const integer = (n, min, max, field) => Number.isInteger(n) ? number(n, min, max, field) : fail(field);
  const rich = (input, field, allowBlank) => {
    if (value.version >= 3 ? typeof input === 'string' : typeof input !== 'string') fail(field);
    try { return normalizeRich(input, { allowBlank }); } catch { return fail(field); }
  };
  const p = value.paper;
  if (!p || !Array.isArray(p.questions) || p.questions.length > 100) fail('questions');
  const paper = {};
  for (const [key, max] of Object.entries({ title: 45, subject: 30, level: 12, year: 9, term: 10, duration: 25 })) paper[key] = string(p[key], max, key);
  paper.template = value.version < VERSION ? DEFAULT_TEMPLATE_ID : isTemplateId(p.template) ? p.template : fail('paper template');
  paper.kind = ['QP', 'RP'].includes(p.kind) ? p.kind : fail('paper type');
  paper.paper = integer(p.paper, 1, 2, 'paper number');
  paper.targetMarks = integer(p.targetMarks, 0, 1000, 'maximum marks');
  paper.sample = p.sample === true;
  if (p.dateYear !== undefined) paper.dateYear = string(p.dateYear, 4, 'date year');
  if (p.instructions !== undefined) paper.instructions = parseInstructions(p.instructions);
  paper.questions = p.questions.map(q => {
    if (!q || !Array.isArray(q.parts) || q.parts.length > 26) fail('subquestions');
    const question = { id: id(), title: string(q.title, 100, 'question title'), context: rich(q.context, 'question context', false), parts: [] };
    question.imageLayout = q.imageLayout === undefined ? 'vertical' : ['vertical', 'horizontal'].includes(q.imageLayout) ? q.imageLayout : fail('image layout');
    if (q.images !== undefined && (!Array.isArray(q.images) || q.images.length > 12)) fail('diagrams');
    const diagrams = questionImages(q).map(image => ({
      name: string(image?.name, 100, 'image reference'),
      width: number(image?.width, 20, 440, 'image width'), height: number(image?.height, 10, 600, 'image height'),
    }));
    question.images = diagrams;
    question.parts = q.parts.map(part => {
      if (!part) fail('subquestion');
      let type;
      try { type = responseType(part); } catch { fail('response type'); }
      const result = { id: id(), text: rich(part.text, 'prompt', true), marks: integer(part.marks, 0, 1000, 'marks'), lines: integer(part.lines, 0, 25, 'answer lines'), responseType: type };
      if (part.showAnswerLines !== undefined) {
        if (typeof part.showAnswerLines !== 'boolean') fail('answer line visibility');
        result.showAnswerLines = part.showAnswerLines;
      }
      if (part.options !== undefined) {
        if (!Array.isArray(part.options) || part.options.length > 6) fail('options');
        result.options = part.options.map(option => string(option, 300, 'option'));
      }
      if (part.bank) {
        // Preserve unfinished drafts; printable word-bank limits are checked
        // separately before export, not while restoring a teacher's work.
        if (!Array.isArray(part.bank) || part.bank.length > 3600) fail('word bank');
        result.bank = part.bank.map(s => string(s, 3600, 'word bank'));
      }
      if (part.tables !== undefined && (!Array.isArray(part.tables) || part.tables.length > 12)) fail('response tables');
      const tables = partTables(part).map(table => {
        if (!table) fail('response table');
        if (!Array.isArray(table.rows) || !table.rows.length || table.rows.length > 12 || !Array.isArray(table.rows[0])) fail('response table');
        const columns = table.rows[0].length;
        if (columns < 1 || columns > 5 || table.rows.some(r => !Array.isArray(r) || r.length !== columns)) fail('response table');
        const parsed = { rows: table.rows.map(row => row.map(s => string(s, 300, 'table cell'))), header: table.header === true };
        if (table.proportions) {
          if (!Array.isArray(table.proportions) || table.proportions.length !== columns || table.proportions.some(n => !Number.isFinite(n) || n < 0.1) || Math.abs(table.proportions.reduce((s, n) => s + n, 0) - 1) > 0.001) fail('table column widths');
          parsed.proportions = [...table.proportions];
        }
        return parsed;
      });
      result.tables = tables;
      return result;
    });
    return question;
  });
  const images = {};
  if (!value.images || typeof value.images !== 'object' || Array.isArray(value.images)) fail('images');
  for (const name of new Set(paper.questions.flatMap(questionImages).map(image => image.name))) {
    if (!Object.hasOwn(value.images, name)) {
      if (name === 'skeleton') continue;
      fail('missing image');
    }
    const image = value.images[name];
    if (!image || !['image/png', 'image/jpeg'].includes(image.type) || typeof image.dataUrl !== 'string' || image.dataUrl.length > 7 * 1024 * 1024 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(image.dataUrl) || !image.dataUrl.startsWith(`data:${image.type};`)) fail('image data');
    const bytes = imageBytes(image.dataUrl);
    const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const jpg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    if (!(image.type === 'image/png' ? png : jpg)) fail('image format');
    // Restrict keys to generated image names; never accept prototype properties.
    if (name !== 'skeleton' && !/^img-[a-zA-Z0-9-]+$/.test(name)) fail('image name');
    images[name] = { name: string(image.name, 200, 'image filename'), type: image.type, dataUrl: image.dataUrl };
  }
  return { format: FORMAT, version: VERSION, id: id(), updatedAt: new Date().toISOString(), paper, images };
}
