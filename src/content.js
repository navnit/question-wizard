import { normalizeRich } from './rich-text.js';
import { DEFAULT_TEMPLATE_ID } from './templates.js';

// Read old single-content drafts without losing their original data.
export const questionImages = question => question.images ?? (question.image ? [question.image] : []);
export const partTables = part => part.tables ?? (part.table ? [part.table] : []);
export function responseType(part) {
  const value = part?.responseType === undefined ? 'written' : part.responseType;
  if (!['written', 'multiple-choice', 'true-false'].includes(value)) throw new Error('Invalid response type.');
  return value;
}
export function modernizeProject(project) {
  const copy = structuredClone(project);
  copy.version = 4;
  copy.paper.template ??= DEFAULT_TEMPLATE_ID;
  for (const question of copy.paper.questions) {
    question.context = normalizeRich(question.context, { allowBlank: false });
    question.tables ??= [];
    question.imageLayout ??= 'vertical';
    question.images = questionImages(question); delete question.image;
    for (const part of question.parts) {
      part.text = normalizeRich(part.text);
      part.responseType = responseType(part);
      part.tables = partTables(part); delete part.table;
    }
  }
  return copy;
}
