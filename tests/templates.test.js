import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAPER_GRAY, PAPER_TEMPLATES, DEFAULT_TEMPLATE_ID, isTemplateId, templateFor,
} from '../src/templates.js';
import { createProject, duplicateProject, backupProject, parseProject, VERSION } from '../src/project.js';
import { coverView } from '../src/views.js';
import { plainText } from '../src/rich-text.js';

function asLegacy(project, version) {
  const copy = structuredClone(project);
  copy.version = version;
  delete copy.paper.template;
  if (version < 3) {
    for (const question of copy.paper.questions) {
      question.context = plainText(question.context);
      for (const part of question.parts) part.text = plainText(part.text);
    }
  }
  return copy;
}

test('template lookup exposes three printable layouts with shared spacing rules', () => {
  assert.equal(PAPER_GRAY, 'D9D9D9');
  assert.equal(DEFAULT_TEMPLATE_ID, 'classic');
  assert.deepEqual(PAPER_TEMPLATES.map(template => template.id), ['classic', 'ledger', 'cards']);
  for (const template of PAPER_TEMPLATES) {
    assert.equal(template.partGap, 10);
    assert.equal(template.answerLeading, 30);
    assert.ok(Math.abs(Object.values(template.columns).reduce((sum, value) => sum + value, 0) - 523.28) < 0.001);
  }
  assert.equal(templateFor('cards').mode, 'cards');
  assert.equal(isTemplateId('unknown'), false);
  assert.throws(() => templateFor('unknown'), /Unknown paper template/);
});

test('new, duplicate, and version 4 backup projects preserve the selected template', () => {
  const project = createProject();
  assert.equal(VERSION, 4);
  assert.equal(project.paper.template, 'classic');
  project.paper.template = 'cards';
  assert.equal(duplicateProject(project).paper.template, 'cards');
  const restored = parseProject(backupProject(project, {}));
  assert.equal(restored.version, 4);
  assert.equal(restored.paper.template, 'cards');
});

test('versions 1 to 3 default to classic while version 4 rejects unknown templates', () => {
  const project = createProject();
  for (const version of [1, 2, 3]) {
    assert.equal(parseProject(JSON.stringify(asLegacy(project, version))).paper.template, 'classic');
  }
  project.paper.template = 'neon';
  assert.throws(() => parseProject(JSON.stringify(project)), /paper template/);
});

test('paper details renders one accessible radio for every template', () => {
  const paper = createProject().paper;
  const html = coverView(paper);
  assert.match(html, /<fieldset class="template-picker"/);
  assert.match(html, /<legend>Choose a template<\/legend>/);
  for (const id of ['classic', 'ledger', 'cards']) {
    assert.match(html, new RegExp(`type="radio"[^>]+name="paper-template"[^>]+value="${id}"`));
  }
  assert.match(html, /value="classic"[^>]+checked/);
});
