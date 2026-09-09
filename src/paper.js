import { normalizeRich, plainText } from './rich-text.js';
import { responseType } from './content.js';
import { DEFAULT_TEMPLATE_ID } from './templates.js';

const part = (text, marks, lines = 0, extra = {}) => ({ text, marks, lines, ...extra });

// A representative export fixture, not a transcription of an entire original paper.
export function samplePaper(stress = false) {
  const paper = {
    title: 'Term 1 Assessment', subject: 'SCIENCE', level: 'CA-3',
    year: '2026-27', term: 'TA-1', kind: 'QP', paper: 2,
    duration: '1 h 30 min', targetMarks: 40, sample: true, template: DEFAULT_TEMPLATE_ID,
    questions: [
      {
        title: 'The human skeleton',
        context: 'The diagram shows a simplified human skeleton. Some of the bones are labelled A to F.',
        image: { name: 'skeleton', width: 174, height: 191 },
        parts: [
          part('Use words from the box to label the diagram. Write your answers in the table below.', 6, 0, {
            bank: ['lower leg bone', 'spine', 'skull', 'upper arm bone', 'ribcage', 'thighbone'],
            table: { rows: [['A', ''], ['B', ''], ['C', ''], ['D', ''], ['E', ''], ['F', '']], proportions: [0.12, 0.88] },
          }),
          part('Give one important function of the human skeleton.', 1, 1),
          part('A model skeleton in a classroom is made of plastic. Give one way this model is different from a real skeleton.', 1, 2),
        ],
      },
      {
        title: 'Light and reflection',
        context: 'Carol uses a torch, a straight tube and a bent tube to investigate how light travels.',
        parts: [
          part('Carol looks through the straight tube towards the torch. Describe what she sees and explain her observation.', 2, 3),
          part('Carol looks through the bent tube instead. Explain why she cannot see the torch directly through it.', 2, 3),
          part('Describe two things Carol should keep the same to make her comparison fair.', 2, 3),
        ],
      },
      {
        title: 'Conductors and insulators',
        context: 'Ahmed uses a simple circuit to test six materials: copper wire, a wooden ruler, a plastic spoon, an iron nail, a rubber band and a paperclip.',
        parts: [
          part('Write each material in the correct column.', 3, 0, {
            table: { rows: [['Conductors', 'Insulators'], ['', ''], ['', ''], ['', '']], header: true },
          }),
          part('Explain how Ahmed can tell that a material conducts electricity. Name one variable he should keep the same.', 2, 3),
          part('Give one safety precaution Ahmed should take.', 1, 2),
        ],
      },
      {
        title: 'Planning a scientific investigation',
        context: 'A group of learners wants to investigate how the length of a shadow changes during the day. They use a stick, a ruler and a clock.',
        parts: [
          part('Write a question the learners could investigate. Make a prediction and give a reason for it.', 4, stress ? 15 : 6),
          part('Describe a method the learners could follow. Include the measurements they should make and when they should make them.', 4, stress ? 15 : 6),
          part('Identify two things they should keep the same. Explain why each is important for a fair comparison.', 4, stress ? 15 : 6),
          part('Explain how the learners could make their results more reliable and how they could record them clearly.', 4, stress ? 15 : 6),
          part('Describe the pattern you would expect in the results. Explain how the learners could decide whether their results support their prediction.', 4, stress ? 15 : 6),
        ],
      },
    ],
  };
  for (const question of paper.questions) {
    question.context = normalizeRich(question.context, { allowBlank: false });
    for (const item of question.parts) {
      item.text = normalizeRich(item.text);
      item.responseType = 'written';
    }
  }
  return paper;
}

export function validatePaper(paper) {
  const errors = [];
  for (const [key, label, max] of [['title', 'Paper title', 45], ['subject', 'Subject', 30], ['level', 'Class / CA', 12], ['term', 'Term code', 10], ['duration', 'Duration', 25]]) {
    if (!paper[key]?.trim()) errors.push(`${label} is required.`);
    else if (paper[key].length > max) errors.push(`${label} must be ${max} characters or fewer.`);
  }
  if (!/^\d{4}-\d{2}$/.test(paper.year)) errors.push('Use an academic year such as 2026-27.');
  if (!Number.isInteger(paper.targetMarks) || paper.targetMarks < 1 || paper.targetMarks > 1000) errors.push('Maximum marks must be between 1 and 1000.');
  if (!paper.questions.length) errors.push('Add at least one question.');
  for (const [qi, q] of paper.questions.entries()) {
    if (!q.parts.length) errors.push(`Question ${qi + 1} needs a subquestion.`);
    for (const [pi, p] of q.parts.entries()) {
      if (!plainText(p.text, { blanks: '' }).trim()) errors.push(`Question ${qi + 1}(${String.fromCharCode(97 + pi)}) needs a prompt.`);
      if (!Number.isInteger(p.marks) || p.marks < 0) errors.push(`Question ${qi + 1} has invalid marks.`);
      if (!Number.isInteger(p.lines) || p.lines < 0) errors.push(`Question ${qi + 1} has invalid answer space.`);
      if (p.bank && (p.bank.length > 30 || p.bank.some(s => s.length > 120))) errors.push(`Question ${qi + 1}: use at most 30 words of up to 120 characters in the word bank.`);
      let type;
      try { type = responseType(p); } catch { errors.push(`Question ${qi + 1} has an invalid response type.`); }
      if (type === 'multiple-choice' && (!Array.isArray(p.options) || p.options.length < 2 || p.options.length > 6 || p.options.some(option => typeof option !== 'string' || !option.trim() || option.length > 300))) {
        errors.push(`Question ${qi + 1}(${String.fromCharCode(97 + pi)}) needs 2 to 6 non-empty options of up to 300 characters.`);
      }
    }
  }
  const total = paper.questions.reduce((s, q) => s + q.parts.reduce((t, p) => t + p.marks, 0), 0);
  if (total !== paper.targetMarks) errors.push(`Question marks total ${total}; the paper requires ${paper.targetMarks}.`);
  return { total, errors };
}

export const footerText = p => `${p.year} / ${p.level} / ${p.term} / ${p.subject} / ${p.kind} / Paper ${p.paper}`;
