# Rich Text and Question Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add supported rich text and simple response types without changing the paper-writing flow or losing existing papers.

**Architecture:** A validated semantic document is the source of truth. A focused rich editor adapts to that document; shared measured styled lines drive PDF and native Word. Existing latest-only preview and autosave remain in place.

**Tech Stack:** Vanilla JavaScript, Vite, ProseMirror (locally bundled editing/history/commands), PDF-lib, docx, Node tests, Playwright.

**Spec:** docs/superpowers/specs/2026-09-07-rich-text-question-types-design.md

## Global Constraints

- Browser-only and offline; no runtime CDN or backend.
- Project version 3, import versions 1 and 2; no data loss on conversion or type changes.
- Rich prompts/shared instructions; plain table cells, word banks, and options.
- 8,000 characters, 8,001 blocks and 16,000 inline nodes per document; one-level lists.
- Bold, italic, underline, mutually exclusive superscript/subscript, bullets, numbering, clear formatting; prompt-only fixed 3 cm blank.
- Written response, multiple choice (2–6 options, default four, 300 characters each), True/False.
- No answer key, equations, cloud services or school-template redesign.
- This folder is not a Git repository. Do not initialize Git or attempt commits/worktrees. Preserve plan/review records as files.

## Shared interfaces

Use a flat semantic block list with explicit list grouping, easy to validate and adapt to ProseMirror:

```js
const doc = { type: 'doc', blocks: [
  { type: 'paragraph', content: [{ type: 'text', text: 'Describe ', marks: [] }, { type: 'text', text: 'why', marks: ['bold'] }] },
  { type: 'bullet', group: 'list-1', content: [{ type: 'text', text: 'First', marks: [] }] },
  { type: 'ordered', group: 'list-2', content: [{ type: 'blank' }] },
] };
```

Marks: `bold`, `italic`, `underline`, `superscript`, `subscript`. List group IDs are bounded strings, not global IDs; consecutive items of the same kind/group form one list. Blank is legal only in prompts.

`normalizeRich(value, {allowBlank = true} = {})` accepts legacy strings or validated documents, returns a new canonical document, throws on malformed/oversized input. `plainText(value, {blanks = ''} = {})` returns text with newline-separated blocks and configurable blank representation. `richBlocks(value)` normalizes then returns blocks. `responseType(part)` defaults absent types to `written`.

### Task 1: Validated content model and response settings

**Files:** create src/rich-text.js, tests/rich-text.test.js; modify src/content.js, src/project.js, src/paper.js and affected migration tests.

**Consumes:** existing project/import/capacity code. **Produces:** shared interfaces above, v3 factories/migration/import, `responseType(part)` exported from content.js.

- [ ] Write failing tests: legacy conversion preserves line breaks and source object; styled runs/blank/list groups round-trip; unsafe nodes/marks/nesting rejected; character/node limits enforced; blank-only prompt invalid; inactive choices ignored by export validation; active empty choices rejected.

```js
assert.equal(plainText(normalizeRich('A\nB')), 'A\nB');
assert.throws(() => normalizeRich({type:'doc',blocks:[{type:'script',content:[]}]}));
assert.equal(parseProject(backupProject(project, assets)).version, 3);
```

- [ ] Run `node --test tests/rich-text.test.js` and record missing-feature failures.
- [ ] Implement pure normalization with own-field allowlisting, bounded arrays, canonical marks, redundant empty-run removal and merging adjacent equal-style runs. Count block boundaries/blanks. Reject simultaneous sub/superscript. Migrate legacy strings non-mutatingly; ensure fixtures modified with plain strings can still be normalized at trusted factory/backup boundaries. Imports of v3 reject string documents while versions 1/2 require strings.
- [ ] Set v3 factories/backup/migration; import response enum and 0–6 bounded option strings (incomplete drafts allowed). Validate 2–6 nonempty active MCQ choices and real prompt text; preserve inactive fields.
- [ ] Update tests whose expectations intentionally move from strings/version2 to documents/version3; keep original legacy fixtures explicitly version1/2. Run model/migration tests. Document any temporary export incompatibility pending Task 2, not as completion of whole app.

### Task 2: Styled layout and both exports

**Files:** create src/rich-layout.js and tests/rich-export.test.js; modify src/layout.js, src/pdf-export.js, src/docx-export.js, src/assets.js; add licensed italic font assets.

**Consumes:** normalized document/response helpers. **Produces:** styled paragraph nodes with measured lines/runs, explicit row `promptOffset`, type-specific responses; legacy plain samples keep 6/9 pages.

- [ ] Write failing tests against real PDF/DOCX: mixed marks retained, word split across marks stays one wrapping unit, blanks measure 3cm, list markers restart for distinct groups, MCQ wrapping uses hanging indent, True/False shows both empty choices, inactive written lines omitted, promptOffset includes context/images only.

```js
const result = await exportPdf(paper, assets);
assert.equal(result.plan.pages[0].rows[0].promptOffset, 0);
assert.ok(result.bytes.length > 1000);
```

- [ ] Run new tests and record failures. Bundle local regular/bold/italic/bold-italic fonts with licensing; root can prepare dependency assets outside implementer-owned files.
- [ ] Implement tokenization across style boundaries: words are indivisible until whitespace; measure each constituent run in its real font/size; preserve spaces between runs. Make blank an atomic 85.03937pt run. Script runs reserve ascent/descent; use explicit per-run offsets.
- [ ] Keep plain legacy layout spacing and sample page counts. Number/list markers use hanging indentation; prefix subquestion label only once. Set `promptOffset` before prompt construction, update both mark renderers instead of scanning strings. Add options after prompt, then banks/tables and written-only lines.
- [ ] Render PDF runs/underlines/blanks/boxes, Word native runs/paragraphs with the same line boundaries and styling. Use fonts with correct metadata and native style flags. Verify actual DOCX XML and PDF text/operators, then entire Node suite.

### Task 3: Rich editor and response controls

**Files:** create src/rich-editor.js and tests/rich-editor.test.js; modify src/views.js, src/main.js, src/styles.css, package.json/package-lock.json.

**Consumes:** shared rich document helpers, unchanged preview/draft writer. **Produces:** `mountRichEditors(root, project, onChange, onError)` returning cleanup; semantic document change callbacks with data-path and value. Rich hosts carry `data-rich-path`, label and `data-allow-blank`.

- [ ] Add failing editor-adapter tests and a temporary Playwright flow proving toolbar selection, paste sanitization, response switching and saved semantic values.
- [ ] Use bundled ProseMirror model/state/view/commands/history/keymap/schema-list. Map semantic flat list groups to standard lists and back; allow one nesting level at stored boundary. Parse clipboard HTML with an inert template and rebuild only allowlisted elements, stripping resource-bearing/active elements before handing to the editor parser. Tables become text rows, nested lists flatten. Block external drop/media insertion.
- [ ] Add compact accessible toolbar with selected-state feedback and undo/redo. Preserve selection on pointer toolbar actions; keyboard controls focus editor when applied. Formatting or composing must not rerender active editor on each input. Reject over-limit changes with explanation and preserve preceding draft.
- [ ] Mount/destroy editors only on structural navigation. onChange writes the normalized document then invokes existing changed(); keep no detached editors on library navigation. Add response selector, default four choice fields on first selection, add/remove/reorder and hidden written lines while preserving inactive settings.
- [ ] Verify rich edits, option edits, blank insertion, type switch retention, current-revision previews/download gating and narrow-screen controls. Test paste and composition with no external requests. Run Node suite and build.

### Task 4: Integration QA and documentation

**Files:** README.md, package version and spec status; persistent unit regressions where needed. Temporary QA artifacts stay under /private/tmp.

- [x] Exercise app on http://127.0.0.1:4174/ at 1440×1100 and 390×844: legacy import → rich prompt/toolbar/paste → MCQ choices → True/False → written with blank → images/tables → backup/reload/import → offline edits and exports.
- [x] Inspect both exported formats (LibreOffice rendering for Word), text/font styles, page counts, bounds, blank/checkbox visibility, choice ordering, and screenshots. Record native Word not tested.
- [x] Run `npm test`, `npm run build`, `graphify update .`. Confirm console health, no blank page/error overlay, no overflow or external runtime requests.
- [x] Complete independent final review, fix actionable findings with regression tests, update README with new controls, v3 compatibility and limitations. Report completed behavior and remaining risks, without claiming native Word fidelity.
