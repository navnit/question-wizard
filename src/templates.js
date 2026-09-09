export const PAPER_GRAY = 'D9D9D9';
export const DEFAULT_TEMPLATE_ID = 'classic';

const definitions = [
  { id: 'classic', label: 'Classic school', mode: 'classic', columns: { number: 26, content: 465.28, marks: 32 }, pad: 7, partGap: 10, answerLeading: 30, fragmentHeaderHeight: 0 },
  { id: 'ledger', label: 'Modern ledger', mode: 'ledger', columns: { number: 32, content: 453.28, marks: 38 }, pad: 7, partGap: 10, answerLeading: 30, fragmentHeaderHeight: 0 },
  { id: 'cards', label: 'Question cards', mode: 'cards', columns: { number: 0, content: 485.28, marks: 38 }, pad: 9, partGap: 10, answerLeading: 30, fragmentHeaderHeight: 26 },
];

export const PAPER_TEMPLATES = Object.freeze(definitions.map(template => Object.freeze({
  ...template,
  columns: Object.freeze({ ...template.columns }),
})));

const byId = new Map(PAPER_TEMPLATES.map(template => [template.id, template]));

export const isTemplateId = value => byId.has(value);

export function templateFor(value) {
  const template = byId.get(value);
  if (!template) throw new Error('Unknown paper template.');
  return template;
}
