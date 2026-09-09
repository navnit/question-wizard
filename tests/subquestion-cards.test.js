import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, newPart } from '../src/project.js';
import { normalizeRich } from '../src/rich-text.js';
import { questionView, outlineView } from '../src/views.js';
function fixture() {
  const project = createProject(), q = project.paper.questions[0];
  q.parts.push(newPart()); q.parts[0].text = normalizeRich('Explain <why> plants need light.');
  q.parts[0].marks = 3;
  return { project, q };
}
test('subquestions expose accessible collapse controls and safe prompt summaries', () => {
  const { project, q } = fixture(), html = questionView(project, q);
  assert.match(html, /data-action="toggle-part"[^>]*aria-expanded="true"/);
  assert.match(html, /data-action="toggle-part"[^>]*aria-expanded="false"/);
  assert.match(html, /Explain &lt;why&gt; plants need light\./);
  assert.match(html, /Written response · 3 marks/);
  assert.match(html, /<fieldset class="answer-settings"><legend>Answer settings<\/legend>/);
  assert.match(html, /aria-controls="part-body-/);
});
test('explicit expansion supports all closed or several open without changing paper data', () => {
  const { project, q } = fixture(), before = structuredClone(project);
  const closed = questionView(project, q, new Set());
  assert.equal((closed.match(/aria-expanded="false"/g) || []).length, 2);
  const open = questionView(project, q, new Set(q.parts.map(p => p.id)));
  assert.equal((open.match(/aria-expanded="true"/g) || []).length, 2);
  assert.deepEqual(project, before);
});
test('subquestion validation warnings target the part that needs attention', () => {
  const { project, q } = fixture();
  const html = outlineView(project, q.id);
  assert.match(html, new RegExp(`data-action="part-warning"[^>]*data-question="${q.id}"[^>]*data-id="${q.parts[1].id}"`));
});
