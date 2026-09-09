export const WRITING_RULES = { none: '', pencil: 'Use HB pencils for writing.', pen: 'Use blue or black ink for writing.', blue: 'Use blue ink for writing.', black: 'Use black ink for writing.' };
export const CALCULATOR_RULES = { none: '', allowed: 'Calculators are allowed.', prohibited: 'Calculators are not allowed.', scientific: 'Non-programmable scientific calculators are allowed.' };
export const COMMON_RULES = {
  nameDate: 'Fill in the boxes at the top of this page with your name and date.',
  diagrams: 'You may use a soft pencil for diagrams, graphs or rough working.',
  noAttachments: 'Do not use staples, paper clips or highlighters.',
  noCorrection: 'Do not use whitener, correction fluid or correction tape.',
  showWorking: 'Show all your working.',
  ruler: 'Use a ruler for straight lines and diagrams.',
};
export function instructionSettings(paper) {
  return paper.instructions ?? { writing: 'pencil', calculator: 'none', nameDate: true, diagrams: true, noAttachments: true, noCorrection: true, showWorking: false, ruler: false, custom: '' };
}
export function parseInstructions(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.hasOwn(WRITING_RULES, value.writing) || !Object.hasOwn(CALCULATOR_RULES, value.calculator) || typeof value.custom !== 'string' || value.custom.length > 1200 || Object.keys(COMMON_RULES).some(key => typeof value[key] !== 'boolean')) throw new Error('The project has invalid instructions. Your current draft has not been changed.');
  return Object.fromEntries(['writing', 'calculator', ...Object.keys(COMMON_RULES), 'custom'].map(key => [key, value[key]]));
}
export function instructionTexts(paper) {
  const settings = parseInstructions(instructionSettings(paper));
  return [WRITING_RULES[settings.writing], CALCULATOR_RULES[settings.calculator], ...Object.entries(COMMON_RULES).filter(([key]) => settings[key]).map(([, text]) => text), ...settings.custom.split(/\r?\n/).map(line => line.trim())].filter(Boolean);
}
