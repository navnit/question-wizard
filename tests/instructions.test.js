import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, parseProject } from '../src/project.js';
import { instructionSettings, instructionTexts } from '../src/instructions.js';

test('older papers retain their existing cover rules', () => {
  assert.equal(instructionTexts({}).length, 5);
  assert.equal(instructionTexts({})[0], 'Use HB pencils for writing.');
});
test('selected rules and custom lines survive a project backup', () => {
  const project = createProject();
  project.paper.instructions = { ...instructionSettings({}), writing: 'pen', calculator: 'allowed', custom: 'Show your working.\n\nUse a ruler.' };
  const restored = parseProject(JSON.stringify(project));
  assert.deepEqual(restored.paper.instructions, project.paper.instructions);
  const lines = instructionTexts(restored.paper);
  assert.ok(lines.includes('Use blue or black ink for writing.'));
  assert.ok(lines.includes('Calculators are allowed.'));
  assert.ok(!lines.includes('Use HB pencils for writing.'));
  assert.deepEqual(lines.slice(-2), ['Show your working.', 'Use a ruler.']);
});
test('malformed instruction settings cannot be imported', () => {
  const project = createProject();
  project.paper.instructions = { writing: 'anything', custom: 12 };
  assert.throws(() => parseProject(JSON.stringify(project)), /instructions/i);
});

test('the printed date year is saved independently from the academic year', () => {
  const project = createProject();
  project.paper.year = '2026-27';
  project.paper.dateYear = '2027';
  const restored = parseProject(JSON.stringify(project));
  assert.equal(restored.paper.dateYear, '2027');
  assert.equal(restored.paper.year, '2026-27');
});

test('blank answer space preference survives a backup', () => {
  const project = createProject();
  project.paper.questions[0].parts[0].showAnswerLines = false;
  const restored = parseProject(JSON.stringify(project));
  assert.equal(restored.paper.questions[0].parts[0].showAnswerLines, false);
  assert.equal(restored.paper.questions[0].parts[0].lines, 2);
});
