# Paper Template System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add three switchable paper templates with shared pagination, monochrome generated chrome, double-spaced answer lines, and matching PDF/Word output.

**Architecture:** Store one validated template ID on each paper and resolve it through a small immutable registry. Keep content measurement and pagination shared, add question-fragment metadata to the page plan, and let the PDF and Word adapters translate that semantic plan into template-specific native drawing/table primitives.

**Tech Stack:** Browser JavaScript ES modules, Vite, Node test runner, pdf-lib with fontkit, docx, pdfjs-dist, IndexedDB, Playwright, LibreOffice document verification.

**Spec:** `docs/superpowers/specs/2026-09-09-paper-template-system-design.md`

## Global Constraints

- Template IDs are exactly `classic`, `ledger`, and `cards`; `classic` is the default.
- Project backup format advances to version 4; versions 1, 2, and 3 import as `classic`.
- Generated template text, lines, borders, and fills use only black, white, and `#D9D9D9`.
- Supplied logos and teacher-attached diagrams retain their original colours.
- Marks always use brackets, such as `[2]`.
- No horizontal divider appears between subquestions.
- Consecutive subquestions receive 10 points of additional separation.
- Answer guides use 30-point leading.
- Template C uses square-cornered cards with one `QUESTION N` header and no left question-number rail.
- Question names remain editor-only and are never printed.
- A single subquestion remains unsplittable.
- Add no runtime dependency.
- This workspace currently has no `.git` metadata. Do not initialize a repository. Run each commit step only if repository metadata is restored; otherwise record the task as a local checkpoint.

## File Responsibility Map

- `src/templates.js`: immutable template IDs, labels, palette, geometry, and lookup/validation.
- `src/project.js` and `src/content.js`: version 4 persistence and legacy normalization.
- `src/views.js`, `src/main.js`, and `src/styles.css`: accessible selector, template switching, and responsive visual thumbnails.
- `src/layout.js`: template-aware text widths, 10-point part gaps, 30-point answer leading, and page-fragment metadata.
- `src/pdf-export.js`: template-specific page/question chrome around shared content nodes.
- `src/docx-export.js`: native editable Word fragment tables and per-edge borders.
- `tests/templates.test.js`: registry, selector, layout, and persistence contracts.
- `tests/template-export.test.js`: PDF operator/text and Word XML contracts for all templates.
- Existing tests: regression coverage for project migration, layout, rich content, images, preview scheduling, and visual-system CSS.
- `work/verify-editor.mjs` and `work/verify_editor_documents.py`: rendered browser and document parity verification.
- `README.md`, `package.json`, and `package-lock.json`: feature documentation and version compatibility.

---

### Task 1: Template Registry and Version 4 Persistence

**Files:**
- Create: `src/templates.js`
- Create: `tests/templates.test.js`
- Modify: `src/project.js:1-136`
- Modify: `src/content.js:1-25`
- Modify: `src/paper.js:6-52`
- Modify: `tests/project.test.js:34-85`
- Modify: `tests/rich-text.test.js:139-190`
- Modify: `tests/multiple-content.test.js:39-55`

**Interfaces:**
- Produces: `PAPER_GRAY: 'D9D9D9'`, `DEFAULT_TEMPLATE_ID: 'classic'`, `PAPER_TEMPLATES: readonly Template[]`, `isTemplateId(value): boolean`, and `templateFor(value): Template`.
- `Template` contains `{ id, label, mode, columns, pad, partGap, answerLeading, fragmentHeaderHeight }`.
- `columns` contains numeric `{ number, content, marks }` values whose sum is `523.28` points.
- Later tasks consume `templateFor(paper.template)` and `PAPER_TEMPLATES`.

- [x] **Step 1: Write failing registry and persistence tests**

Add these contracts to `tests/templates.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PAPER_GRAY, PAPER_TEMPLATES, DEFAULT_TEMPLATE_ID, isTemplateId, templateFor,
} from '../src/templates.js';
import { createProject, duplicateProject, backupProject, parseProject, VERSION } from '../src/project.js';

test('the template registry exposes three stable layouts and one generated gray', () => {
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

test('new, duplicate, and version 4 backup projects preserve the template', () => {
  const project = createProject();
  assert.equal(VERSION, 4);
  assert.equal(project.paper.template, 'classic');
  project.paper.template = 'cards';
  assert.equal(duplicateProject(project).paper.template, 'cards');
  const restored = parseProject(backupProject(project, {}));
  assert.equal(restored.version, 4);
  assert.equal(restored.paper.template, 'cards');
});

test('legacy projects default to classic and version 4 rejects unknown templates', () => {
  const project = createProject();
  for (const version of [1, 2, 3]) {
    const legacy = structuredClone(project);
    legacy.version = version;
    delete legacy.paper.template;
    if (version < 3) {
      for (const question of legacy.paper.questions) {
        question.context = '';
        for (const part of question.parts) part.text = '';
      }
    }
    assert.equal(parseProject(JSON.stringify(legacy)).paper.template, 'classic');
  }
  project.paper.template = 'neon';
  assert.throws(() => parseProject(JSON.stringify(project)), /paper template/);
});
```

Update existing version assertions to expect version 4 while preserving version 3 rich-document input rules.

- [x] **Step 2: Run the focused tests and verify failure**

Run:

```bash
node --test tests/templates.test.js tests/project.test.js tests/rich-text.test.js tests/multiple-content.test.js
```

Expected: FAIL because `src/templates.js` does not exist and `VERSION` remains 3.

- [x] **Step 3: Implement the immutable registry**

Create `src/templates.js` with these exact public names and values:

```js
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
```

- [x] **Step 4: Add version 4 defaults and safe migration**

In `src/project.js`, set `VERSION = 4`, give both new papers and `samplePaper()` a `template: DEFAULT_TEMPLATE_ID`, accept backup versions `[1, 2, 3, VERSION]`, and copy the known field with:

```js
paper.template = value.version < VERSION
  ? DEFAULT_TEMPLATE_ID
  : isTemplateId(p.template) ? p.template : fail('paper template');
```

Update the rich-content version boundary so versions 3 and 4 both require semantic document objects while versions 1 and 2 require legacy plain strings:

```js
   if (value.version >= 3 ? typeof input === 'string' : typeof input !== 'string') fail(field);
```

Update the import error to say “version 1, 2, 3 or 4”. In `modernizeProject`, set `copy.version = 4` and set `copy.paper.template ??= DEFAULT_TEMPLATE_ID`. Preserve the selected template when it already exists. Update the version-focused existing tests without weakening their rich-text assertions.

- [x] **Step 5: Run focused tests and the full project suite**

Run:

```bash
node --test tests/templates.test.js tests/project.test.js tests/rich-text.test.js tests/multiple-content.test.js
npm test
```

Expected: both commands PASS.

- [x] **Step 6: Commit or record the persistence checkpoint**

If Git metadata is available:

```bash
git add src/templates.js src/project.js src/content.js src/paper.js tests/templates.test.js tests/project.test.js tests/rich-text.test.js tests/multiple-content.test.js
git commit -m "feat: add paper template registry and persistence"
```

Otherwise record: `Task 1 complete; registry and version 4 persistence tests pass.`

---

### Task 2: Accessible Template Selector and Live Switching

**Files:**
- Modify: `src/views.js:1-47`
- Modify: `src/main.js:265-314`
- Modify: `src/styles.css:9-20`
- Modify: `tests/templates.test.js`
- Modify: `tests/visual-system.test.js:1-129`

**Interfaces:**
- Consumes: `PAPER_TEMPLATES` and `DEFAULT_TEMPLATE_ID` from `src/templates.js`.
- Produces: one radio group named `paper-template` with inputs using `data-path="paper.template"`.
- Produces: `.template-picker`, `.template-option`, `.template-miniature`, and per-mode miniature classes used by CSS and browser verification.

- [x] **Step 1: Write failing selector markup and CSS tests**

Append to `tests/templates.test.js`:

```js
import { coverView } from '../src/views.js';

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
```

Append to `tests/visual-system.test.js` assertions for a three-column desktop selector, a one-column mobile selector, a visible checked state, and a minimum 36-pixel mobile target:

```js
test('template choices are responsive and expose a checked state', () => {
  assert.match(css, /\.template-options\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.template-option:has\(input:checked\)\{[^}]*border-color:var\(--color-primary\)/);
  assert.match(css, /@media\(max-width:620px\)\{[\s\S]*?\.template-options\{[^}]*grid-template-columns:1fr/);
});
```

- [x] **Step 2: Run selector tests and verify failure**

Run:

```bash
node --test tests/templates.test.js tests/visual-system.test.js
```

Expected: FAIL because the selector markup and styles are absent.

- [x] **Step 3: Render the selector from registry data**

Import `PAPER_TEMPLATES` in `src/views.js` and replace the static template note with a `fieldset`. Each label contains a native radio, a decorative miniature, the registry label, and `Default` only for `classic`:

```js
function templatePicker(selected) {
  return `<fieldset class="template-picker"><legend>Choose a template</legend><p>You can switch at any time. Your content stays unchanged.</p><div class="template-options">${PAPER_TEMPLATES.map(template => `
    <label class="template-option">
      <input class="sr-only" type="radio" name="paper-template" data-path="paper.template" value="${template.id}" ${selected === template.id ? 'checked' : ''} />
      <span class="template-miniature ${template.mode}" aria-hidden="true"><i></i><b></b></span>
      <span><strong>${template.label}</strong>${template.id === 'classic' ? '<small>Default</small>' : ''}</span>
    </label>`).join('')}</div><small>The selected template is saved with this paper and its project backup.</small></fieldset>`;
}
```

Place `templatePicker(p.template)` before the “Start writing questions” button.

- [x] **Step 4: Route radio changes through the structural update path**

In the `kind === 'paper'` branch of `src/main.js`, handle the template before the generic assignment:

```js
if (key === 'template') {
  current.paper.template = value;
  if (changed(true)) $('editor').querySelector(`[name="paper-template"][value="${value}"]`).focus();
  return;
}
```

This re-renders the checked state, invalidates both downloads through `dirty()`, autosaves, and queues a fresh preview.

- [x] **Step 5: Add responsive selector styles**

Use existing Academic Evergreen interface tokens for the editor control. Keep the printed miniature itself restricted to `#111`, `#fff`, and `#d9d9d9`. At `max-width: 620px`, stack the choices and keep each label at least 36 pixels tall. Do not change the application's existing green interface palette.

- [x] **Step 6: Run selector and full regression tests**

Run:

```bash
node --test tests/templates.test.js tests/visual-system.test.js
npm test
```

Expected: both commands PASS.

- [x] **Step 7: Commit or record the selector checkpoint**

If Git metadata is available:

```bash
git add src/views.js src/main.js src/styles.css tests/templates.test.js tests/visual-system.test.js
git commit -m "feat: add accessible paper template selector"
```

Otherwise record: `Task 2 complete; selector and responsive CSS tests pass.`

---

### Task 3: Template-Aware Pagination and Question Fragments

**Files:**
- Modify: `src/layout.js:1-127`
- Modify: `src/views.js:48-100`
- Modify: `src/main.js:283-299`
- Modify: `tests/layout.test.js:1-65`
- Modify: `tests/image-layout.test.js`
- Modify: `tests/rich-export.test.js:94-170`
- Modify: `tests/templates.test.js`

**Interfaces:**
- Consumes: `templateFor(paper.template)`.
- Produces: `layoutMetrics(paper): { template, columns, pad, textWidth }`.
- Produces: `diagramWidthLimit(question, templateId)` and `printedDiagram(image, question, templateId)`; omitting `templateId` keeps `classic` compatibility.
- Produces: `page.fragments`, where each fragment is `{ question, continued, y, height, headerHeight, rows }`.
- Each row keeps existing fields and adds numeric `before`, boolean `fragmentStart`, and boolean `fragmentEnd`.

- [x] **Step 1: Write failing spacing and fragment tests**

Add to `tests/layout.test.js`:

```js
for (const template of ['classic', 'ledger', 'cards']) test(`${template} uses shared answer and subquestion spacing`, () => {
  const paper = samplePaper();
  paper.template = template;
  const plan = layoutPaper(paper, measure);
  const rows = plan.pages.flatMap(page => page.rows);
  assert.equal(rows.find(row => !row.first).before, 10);
  const answers = rows.flatMap(row => row.nodes).find(node => node.type === 'answers');
  assert.equal(answers.leading, 30);
  assert.equal(answers.height, answers.count * 30 + 2);
});

test('page plans expose complete question fragments and card headers', () => {
  const paper = samplePaper(true);
  paper.template = 'cards';
  const plan = layoutPaper(paper, measure);
  const fragments = plan.pages.flatMap(page => page.fragments);
  assert.ok(fragments.some(fragment => fragment.continued));
  for (const page of plan.pages) {
    assert.equal(page.fragments.flatMap(fragment => fragment.rows).length, page.rows.length);
    for (const fragment of page.fragments) {
      assert.equal(fragment.headerHeight, 26);
      assert.equal(fragment.rows[0].fragmentStart, true);
      assert.equal(fragment.rows.at(-1).fragmentEnd, true);
      assert.ok(fragment.y + fragment.height <= PAGE.bottom + 0.01);
    }
  }
});
```

Add an image-layout assertion that `diagramWidthLimit(question, 'cards')` uses the Cards content width and remains no wider than its measured text area.

- [x] **Step 2: Run layout tests and verify failure**

Run:

```bash
node --test tests/layout.test.js tests/image-layout.test.js tests/rich-export.test.js tests/templates.test.js
```

Expected: FAIL because answer leading is 21, rows have no `before`, and pages have no `fragments`.

- [x] **Step 3: Derive geometry from the selected template**

In `src/layout.js`, keep `PAGE` unchanged and retain `COLUMN`, `PAD`, and `TEXT_WIDTH` as Classic compatibility exports. Add:

```js
export function layoutMetrics(paper) {
  const template = templateFor(paper.template || DEFAULT_TEMPLATE_ID);
  return {
    template,
    columns: template.columns,
    pad: template.pad,
    textWidth: template.columns.content - template.pad * 2 - 2,
  };
}
```

Pass the selected template through `makeRows`, `imageNodes`, `tableNode`, `responseNodes`, `diagramWidthLimit`, and `printedDiagram`. Update `questionView`, `diagramView`, `imageDimensions`, and the diagram-resize handler to pass `project.paper.template`.

- [x] **Step 4: Add measured part gaps and 30-point answer leading**

For every non-first part, set `row.before = template.partGap`; first rows use zero. Add `before` to `row.height` and `row.promptOffset`, and make both exporters place a native spacer before the row's content. Change answer nodes to:

```js
{
  type: 'answers',
  count: part.lines,
  leading: template.answerLeading,
  after: 2,
  height: part.lines * template.answerLeading + 2,
}
```

- [x] **Step 5: Build page fragments during pagination**

When the first row of a question enters a page—or a later row enters a new page—start one fragment. Reserve `template.fragmentHeaderHeight` before the first row for Cards. Add each row to both `page.rows` and the active fragment's `rows`; set fragment bounds after its last row. Cards use an empty `row.number`; Classic and Ledger retain the question number at fragment starts. Non-Card continuations keep a measured `Question N continued` content paragraph. Cards express continuation only through the fragment header label `QUESTION N CONTINUED`.

- [x] **Step 6: Preserve overflow guarantees**

Check `fragmentHeaderHeight + row.height` against page capacity before placing a row. Keep the current question/subquestion overflow messages. Verify that every row and fragment ends at or above `PAGE.bottom` and that page count includes the cover.

- [x] **Step 7: Run focused and full tests**

Run:

```bash
node --test tests/layout.test.js tests/image-layout.test.js tests/rich-export.test.js tests/templates.test.js
npm test
```

Expected: both commands PASS; existing rich labels, marks offsets, images, and overflow checks remain intact.

- [x] **Step 8: Commit or record the layout checkpoint**

If Git metadata is available:

```bash
git add src/layout.js src/views.js src/main.js tests/layout.test.js tests/image-layout.test.js tests/rich-export.test.js tests/templates.test.js
git commit -m "feat: add template-aware paper pagination"
```

Otherwise record: `Task 3 complete; template geometry and fragment pagination tests pass.`

---

### Task 4: PDF Template Rendering

**Files:**
- Create: `tests/template-export.test.js`
- Modify: `src/pdf-export.js:1-133`
- Modify: `tests/export.test.js:1-19`
- Modify: `tests/rich-export.test.js`

**Interfaces:**
- Consumes: `page.fragments`, row `before`, `layoutMetrics(paper)`, `templateFor(paper.template)`, and `PAPER_GRAY`.
- Produces: one PDF with unchanged cover images and shared content nodes plus template-specific question chrome.
- Produces: PDF drawing operators using only black, white, and `217 / 255` gray for generated chrome.

- [x] **Step 1: Write failing PDF template tests**

Create `tests/template-export.test.js` with the existing font/image fixture pattern from `tests/rich-export.test.js`. Generate a two-part paper for every template, extract page 2 text with pdfjs-dist, and decode the page content operators with pdf-lib. Assert:

```js
for (const id of ['classic', 'ledger', 'cards']) test(`${id} PDF uses brackets and retains content`, async () => {
  const paper = fixture(id);
  const result = await exportPdf(paper, assets);
  const text = await pageText(result.bytes, 2);
  assert.match(text, /\[1\]/);
  assert.match(text, /\[2\]/);
  assert.match(text, /First prompt/);
  assert.match(text, /Second prompt/);
});

test('cards PDF prints one question header and no editor-only name', async () => {
  const paper = fixture('cards');
  paper.questions[0].title = 'Private outline label';
  const result = await exportPdf(paper, assets);
  const text = await pageText(result.bytes, 2);
  assert.match(text, /QUESTION 1/);
  assert.doesNotMatch(text, /Private outline label/);
});
```

Also parse full-width horizontal line segments and assert that no segment appears at an internal row boundary; inspect `rg`/`RG` colour operators and allow only `0 0 0` and `0.85098 0.85098 0.85098` for generated vector chrome.

- [x] **Step 2: Run the PDF tests and verify failure**

Run:

```bash
node --test tests/template-export.test.js tests/export.test.js tests/rich-export.test.js
```

Expected: FAIL because all templates still use the same per-row rectangle and Cards has no header.

- [x] **Step 3: Centralize black and gray PDF primitives**

Import `PAPER_GRAY`, `templateFor`, and `layoutMetrics`. Replace the old boolean-fill rectangle with explicit colours:

```js
const black = rgb(0, 0, 0);
const gray = rgb(217 / 255, 217 / 255, 217 / 255);
const rect = (x, y, width, height, { border = black, fill } = {}) => page.drawRectangle({
  x, y: PAGE.height - y - height, width, height,
  borderColor: border, borderWidth: 0.6,
  ...(fill ? { color: fill } : {}),
});
```

Use `gray` for cover/table header fills and answer guide lines. Keep school, Cambridge, and teacher image bytes unchanged.

- [x] **Step 4: Draw fragment chrome once per question fragment**

Before drawing row content, iterate `planned.fragments`:

- Classic: draw one outer rectangle for the full fragment plus continuous number/content and content/marks vertical rules. Draw no internal horizontal rule.
- Ledger: draw one black top rule and one gray bottom rule; draw a 22-point black square number block at the fragment start. Keep right-side marks bracketed.
- Cards: draw one square-cornered outer rectangle; draw a 26-point `#D9D9D9` header; draw `QUESTION N` or `QUESTION N CONTINUED` in black; draw no left number rail.

Then render each row's shared nodes at `row.y + pad + row.before`. Use the selected template's column geometry for number, content, and marks positions.

- [x] **Step 5: Keep generated marks and content behaviour shared**

Retain the shared rich-text, diagrams, options, True/False, word bank, and response-table loops. Always draw marks with:

```js
text(`[${row.marks}]`, marksX + 6, row.y + pad + row.promptOffset, row.markSize);
```

Do not draw `question.title` in any template.

- [x] **Step 6: Run PDF tests and the full suite**

Run:

```bash
node --test tests/template-export.test.js tests/export.test.js tests/rich-export.test.js
npm test
```

Expected: both commands PASS, including the no-internal-divider and palette checks.

- [x] **Step 7: Commit or record the PDF checkpoint**

If Git metadata is available:

```bash
git add src/pdf-export.js tests/template-export.test.js tests/export.test.js tests/rich-export.test.js
git commit -m "feat: render three PDF paper templates"
```

Otherwise record: `Task 4 complete; all PDF template tests pass.`

---

### Task 5: Editable Word Template Rendering

**Files:**
- Modify: `src/docx-export.js:1-170`
- Modify: `tests/template-export.test.js`
- Modify: `tests/rich-export.test.js`

**Interfaces:**
- Consumes: the same page fragments and template geometry as the PDF exporter.
- Produces: native Word tables/paragraphs with no floating shapes or text boxes.
- Produces: `D9D9D9` shading, `000000` black borders/text, and no internal horizontal subquestion borders.

- [x] **Step 1: Write failing Word XML tests**

Extend `tests/template-export.test.js` with a helper that runs `exportPdf`, passes its plan to `exportDocx`, opens the blob with JSZip, and returns `word/document.xml`. Assert:

```js
for (const id of ['classic', 'ledger', 'cards']) test(`${id} Word output keeps marks and removes part dividers`, async () => {
  const xml = await documentXml(fixture(id));
  assert.match(xml, />\[1\]<\/w:t>/);
  assert.match(xml, />\[2\]<\/w:t>/);
  assert.match(xml, /w:insideH w:val="(?:nil|none)"/);
});

test('cards Word output uses one gray native header and no private title', async () => {
  const paper = fixture('cards');
  paper.questions[0].title = 'Private outline label';
  const xml = await documentXml(paper);
  assert.match(xml, /w:fill="D9D9D9"/);
  assert.match(xml, />QUESTION 1<\/w:t>/);
  assert.doesNotMatch(xml, /Private outline label/);
  assert.doesNotMatch(xml, /wps:|v:shape|w:txbxContent/);
});
```

Add an answer-line assertion for exact `w:line="600"` twips and gray bottom borders, proving 30-point leading and the one-gray rule.

- [x] **Step 2: Run Word tests and verify failure**

Run:

```bash
node --test tests/template-export.test.js tests/rich-export.test.js
```

Expected: FAIL because the current exporter creates one fully bordered row per subquestion and uses `F5F5F5` shading.

- [x] **Step 3: Add per-edge border helpers**

Define `blackBorder`, `grayBorder`, and `noBorder`. Build cell borders explicitly from fragment position instead of applying `borders(border)` to every cell. First rows receive top edges, last rows receive bottom edges, outer cells receive left/right edges, and adjacent subquestion rows receive no top/bottom edges.

Use the selected template's column widths and `row.before` spacer. Change answer-guide paragraph borders to `D9D9D9` while retaining their native dotted style.

- [x] **Step 4: Emit one native table per page fragment**

Replace the single page-wide question table with `page.fragments.flatMap(fragment => fragmentTable(fragment, template, assets))`.

- Classic fragment tables use three columns and continuous vertical borders.
- Ledger fragment tables use three columns, a black-shaded number cell only at the fragment start, no content box, and a gray bottom rule.
- Cards fragment tables use two body columns—content and marks—and begin with a spanning header cell using `columnSpan: 2`, `shading: { fill: PAPER_GRAY }`, and the text `QUESTION N` or `QUESTION N CONTINUED`. They do not emit a zero-width or empty left number cell.

Insert a small borderless spacer between fragments, not between subquestions.

- [x] **Step 5: Replace every generated fill with the single gray**

Change cover score-table and response-table header shading from `F5F5F5` to `D9D9D9`. Keep embedded logo and diagram media unchanged. Ensure no other generated `w:fill` value is introduced.

- [x] **Step 6: Run Word tests and the full suite**

Run:

```bash
node --test tests/template-export.test.js tests/rich-export.test.js
npm test
```

Expected: both commands PASS; native rich content, embedded fonts, images, `cantSplit`, bracketed marks, and page planning remain intact.

- [x] **Step 7: Commit or record the Word checkpoint**

If Git metadata is available:

```bash
git add src/docx-export.js tests/template-export.test.js tests/rich-export.test.js
git commit -m "feat: render editable Word paper templates"
```

Otherwise record: `Task 5 complete; all Word template XML tests pass.`

---

### Task 6: Browser Verification, Document Parity, and Documentation

**Files:**
- Modify: `work/verify-editor.mjs:31-127`
- Modify: `work/verify_editor_documents.py:9-45`
- Modify: `README.md:1-89`
- Modify: `package.json:1-22`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: the completed selector, preview, PDF, Word, and version 4 backup flow.
- Produces: three representative PDF/DOCX pairs named `template-classic`, `template-ledger`, and `template-cards` plus browser/document reports.
- Produces: Question Wizard application version `0.4.0` documentation.

- [x] **Step 1: Extend browser verification for template switching**

After creating valid content in `work/verify-editor.mjs`, return to Paper details and run this flow for each template:

```js
for (const template of ['classic', 'ledger', 'cards']) {
  await page.getByRole('radio', { name: new RegExp(template === 'classic' ? 'Classic school' : template === 'ledger' ? 'Modern ledger' : 'Question cards') }).check();
  await saved();
  await generate();
  await download('pdf', `template-${template}.pdf`);
  await download('docx', `template-${template}.docx`);
}
```

After generating one template, switch to another and assert both download buttons disable before the new preview commits. Reload and assert the last selected radio remains checked. At 390 × 844, assert the selector does not cause horizontal overflow.

- [x] **Step 2: Update document parity verification**

In `work/verify_editor_documents.py`, iterate `template-classic`, `template-ledger`, and `template-cards`. Compare PDF and LibreOffice-rendered Word files for:

- equal per-file page count;
- equal tokenized text on each page;
- identical bracketed marks per page;
- no page-bound overflow;
- `QUESTION 1` in Cards and absence of the private question name;
- native `cantSplit`, `D9D9D9` shading, embedded fonts, and unchanged media members.

Store actual page counts in `document-results.json` rather than assuming two pages.

- [x] **Step 3: Update user documentation and package version**

Update `README.md` to describe the three templates, the selector, the shared print rules, original-colour logos/diagrams, version 4 backups, and legacy version 1–3 migration. State that version 4 backups require Question Wizard 0.4.0 or newer.

Update package metadata without creating a Git tag:

```bash
npm version 0.4.0 --no-git-tag-version
```

- [x] **Step 4: Run unit tests and production build**

Run:

```bash
npm test
npm run build
```

Expected: all tests PASS and Vite plus offline-worker generation complete without errors.

- [x] **Step 5: Run rendered browser verification**

Start the production preview:

```bash
npm run preview -- --port 4174
```

In another terminal run:

```bash
node work/verify-editor.mjs
```

Expected: `work/editor-verification/results.json` reports template switching, persistence, stale-export blocking, offline behavior, and mobile overflow checks as passing with no browser errors or external requests.

- [x] **Step 6: Convert Word files and run document verification**

Run:

```bash
mkdir -p work/editor-verification/word-rendered
/Applications/LibreOffice.app/Contents/MacOS/soffice --headless --convert-to pdf --outdir work/editor-verification/word-rendered work/editor-verification/template-classic.docx work/editor-verification/template-ledger.docx work/editor-verification/template-cards.docx
python3 work/verify_editor_documents.py
```

Expected: three Word-rendered PDFs are created and `document-results.json` reports text, marks, bounds, native content, and media checks as passing for every template.

- [x] **Step 7: Inspect representative pages**

Render or open page 2 from each generated PDF and Word-rendered PDF. Confirm visually:

- no horizontal line between subquestions;
- approximately double-spaced answer guides;
- bracketed marks;
- Classic vertical rails;
- Ledger black number block;
- Cards square border, single-gray header, `QUESTION N`, and no redundant left number;
- original-colour logos and diagrams remain embedded.

- [x] **Step 8: Commit or record the final checkpoint**

If Git metadata is available:

```bash
git add README.md package.json package-lock.json work/verify-editor.mjs work/verify_editor_documents.py
git commit -m "docs: verify and document paper templates"
```

Otherwise record: `Task 6 complete; unit, build, browser, and document verification all pass.`

---

## Completion Gate

Do not report completion until all of the following are true:

- `npm test` passes.
- `npm run build` passes.
- All three browser-generated template PDF/DOCX pairs exist.
- Browser verification reports no errors, external requests, or mobile overflow.
- LibreOffice document verification passes for all three templates.
- Representative PDF and Word-rendered pages have been visually inspected.
- README and package metadata describe version 4 backups and application version 0.4.0.
