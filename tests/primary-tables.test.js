import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, backupProject, parseProject } from '../src/project.js';
import { modernizeProject } from '../src/content.js';
import { layoutPaper } from '../src/layout.js';
const table = { rows: [['Material', 'Mass'], ['Copper', '25 g']], header: true };
test('primary data tables survive backup and restore independently of response tables', () => {
  const project = createProject();
  project.paper.questions[0].tables = [structuredClone(table)];
  const copy = parseProject(backupProject(project, {}));
  assert.deepEqual(copy.paper.questions[0].tables, [table]);
  assert.equal(copy.paper.questions[0].parts[0].lines, 2);
});
test('old drafts receive empty primary tables without mutating the source', () => {
  const project = createProject(); delete project.paper.questions[0].tables;
  assert.deepEqual(modernizeProject(project).paper.questions[0].tables, []);
  assert.equal(project.paper.questions[0].tables, undefined);
});
test('invalid primary table backups are rejected', () => {
  for (const tables of [null, {}, Array(13).fill(table), [{ rows: [] }], [{ rows: [['a'], ['b', 'c']] }], [{ rows: [['x'.repeat(301)]] }]]) {
    const project = createProject(); project.paper.questions[0].tables = tables;
    assert.throws(() => parseProject(JSON.stringify(project)), /table/);
  }
});
test('primary tables appear after diagrams and before the first prompt in every template', () => {
  for (const template of ['classic', 'ledger', 'cards']) {
    const paper = createProject().paper; paper.template = template;
    const q = paper.questions[0]; q.tables = [structuredClone(table)];
    q.images = [{ name: 'skeleton', width: 30, height: 30 }];
    const row = layoutPaper(paper, (s, size) => s.length * size * 0.45).pages[0].rows[0];
    assert.deepEqual(row.nodes.slice(0, 3).map(n => n.type), ['image', 'table', 'rich-paragraph']);
    assert.equal(row.promptOffset, row.nodes[0].height + row.nodes[1].height);
  }
});
