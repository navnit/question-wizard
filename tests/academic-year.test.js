import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, duplicateProject, parseProject } from '../src/project.js';

for (const [date, expected] of [
  [new Date(2026, 4, 31, 23, 59), '2025-26'],
  [new Date(2026, 5, 1), '2026-27'],
  [new Date(2027, 0, 1), '2026-27'],
  [new Date(2027, 4, 31), '2026-27'],
  [new Date(2099, 5, 1), '2099-00'],
]) test(`new papers use ${expected} on ${date.toDateString()}`, () => {
  for (const example of [false, true]) {
    const project = createProject(example, date);
    assert.equal(project.paper.year, expected);
    assert.equal(project.paper.dateYear, String(date.getFullYear()));
  }
});

test('copies and restored papers keep a manually chosen academic year', () => {
  const project = createProject(false, new Date(2026, 5, 1));
  project.paper.year = '2024-25';
  assert.equal(duplicateProject(project).paper.year, '2024-25');
  assert.equal(parseProject(JSON.stringify(project)).paper.year, '2024-25');
});
