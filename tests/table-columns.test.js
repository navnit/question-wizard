import test from 'node:test';
import assert from 'node:assert/strict';
import { columnWidths, resizeColumns } from '../src/table-columns.js';
import { createProject, backupProject, parseProject } from '../src/project.js';
import { layoutPaper } from '../src/layout.js';
test('resizing changes only adjacent columns and preserves total width', () => {
 const table = { rows: [['a','b','c']], proportions: [0.2,0.3,0.5] };
 assert.deepEqual(resizeColumns(table, 0, 0.35), [0.35,0.15,0.5]);
 assert.deepEqual(table.proportions, [0.2,0.3,0.5]);
 assert.deepEqual(columnWidths({rows:[['a','b']]}), [0.5,0.5]);
});
test('columns cannot shrink below ten percent', () => {
 const table={rows:[['a','b','c']],proportions:[0.2,0.3,0.5]};
 assert.deepEqual(resizeColumns(table,0,0),[0.1,0.4,0.5]);
 assert.deepEqual(resizeColumns(table,0,1),[0.4,0.1,0.5]);
});
test('custom primary and response widths survive backup and reach every print template', () => {
 const project=createProject(),q=project.paper.questions[0];
 const table={rows:[['a','b']],proportions:[0.3,0.7],header:true};q.tables=[table];q.parts[0].tables=[structuredClone(table)];
 const restored=parseProject(backupProject(project,{}));
 assert.deepEqual(restored.paper.questions[0].tables[0].proportions,[0.3,0.7]);
 assert.deepEqual(restored.paper.questions[0].parts[0].tables[0].proportions,[0.3,0.7]);
 for(const template of ['classic','ledger','cards']){restored.paper.template=template;const nodes=layoutPaper(restored.paper,(s,size)=>s.length*size*.45).pages[0].rows[0].nodes.filter(n=>n.type==='table');assert.equal(nodes.length,2);for(const node of nodes)assert.ok(Math.abs(node.widths[0]/node.widths[1]-3/7)<1e-9);}
});
