# Paper Template System Design

## Summary

Question Wizard will support three selectable paper templates while preserving one shared content model, pagination engine, live preview, PDF export, and editable Word export. The existing school layout remains the default. Two new monochrome layouts provide modern alternatives without changing a teacher's question content.

All generated template text, lines, borders, and fills use exactly three tones: black, white, and one light gray (`#D9D9D9`). Supplied logos and teacher-attached diagrams retain their original colours; printer settings control whether those images print in colour or grayscale. The templates use bracketed marks, omit horizontal dividers between subquestions, and space answer lines at 30 points, approximately double the normal text line spacing.

## Goals

- Keep the current school template as the default.
- Add two modern, clean alternatives.
- Let teachers switch templates from Paper details at any time.
- Preserve question content when the template changes.
- Keep live preview, PDF, and Word output structurally consistent.
- Preserve existing backup files and local drafts.

## Non-goals

- User-defined templates, colors, fonts, spacing, or page geometry.
- Different content or marks for each template.
- Printing the editor-only question name.
- Pixel-identical PDF and Word rendering beyond the existing compatibility expectations.
- Floating Word shapes or text boxes to imitate rounded card corners.

## Template Set

### A. Classic school (`classic`)

This is the cleaned-up version of the current default. Each question uses a left number column, a central content area, and a right marks column. The question fragment has an outer border and continuous vertical column rules, but no horizontal borders between its subquestions.

### B. Modern ledger (`ledger`)

This layout uses a compact black question-number block on the left, an open central content area, and bracketed marks aligned at the right edge. A black heading rule and light-gray secondary rules provide structure. There are no boxes around individual subquestions.

### C. Question cards (`cards`)

Each question uses one rectangular card with square corners. The card has a light-gray header labeled `QUESTION N`, a black outer border, and an open body. It has no separate left question-number column. The editor's question name remains private to the outline and is not printed.

Square corners are intentional. Native Word tables do not reliably support rounded borders, while floating shapes would weaken editability and pagination. A rectangular card keeps PDF and Word structurally aligned.

## Shared Print Rules

- Generated template text, lines, borders, and fills are limited to black, white, and `#D9D9D9`.
- Supplied logos and teacher-attached diagrams retain their original colours. The printer controls colour or grayscale output for those images.
- Marks are always rendered in brackets, such as `[2]`.
- Subquestions are separated by whitespace rather than horizontal table lines.
- Consecutive subquestions receive 10 points of additional separation outside their measured content.
- Answer guides use 30-point leading. The line count continues to mean the number of writable guide lines.
- Existing text size, rich-text behavior, diagrams, word banks, response tables, multiple-choice options, and True/False controls remain supported.
- A single subquestion remains unsplittable and must fit on one page.

## Selection Interface

Paper details will contain a `Choose a template` radio group with three compact visual choices. Each choice shows a miniature black, white, and gray preview plus the template name. `Classic school` is labeled as the default.

Selecting a template will:

1. Update `paper.template` immediately.
2. Preserve all existing questions and paper metadata.
3. Trigger the normal autosave path.
4. Request a fresh live preview using the current revision safeguards.
5. Invalidate any previously generated export so downloads cannot use a stale template.

The selector will use native, keyboard-accessible radio semantics even if its visual presentation resembles selectable cards.

## Data Model and Compatibility

The paper model gains one field:

```js
paper.template = 'classic' | 'ledger' | 'cards'
```

New papers and the built-in sample use `classic`. Duplicating a project preserves its selected template.

The project backup format will advance from version 3 to version 4. Version 4 parsing accepts only the three known template IDs. Version 1, 2, and 3 backups and older local drafts are modernized to `classic`. Imports with an unknown version or invalid template ID continue to fail safely without replacing the open draft.

## Template Registry

A new `src/templates.js` module will own the stable template IDs, user-facing labels, shared palette, layout metrics, and template-specific rendering flags. It will expose a small validated interface rather than allowing exporters to inspect arbitrary styling data.

Each registry entry will define:

- template ID and label;
- page/body column geometry;
- content padding and inter-subquestion spacing;
- question-fragment treatment;
- question-number placement;
- marks placement;
- header and continuation treatment;
- allowed black, white, and gray roles.

The registry will not contain document-library objects. PDF and Word adapters will translate the same semantic template description into their native primitives.

## Layout and Pagination

`layoutPaper` remains the single measurement and pagination source. It will accept the paper's validated template definition and emit the same semantic content nodes used today plus template-aware question-fragment metadata.

Rows will record whether they begin or end a question fragment on the current page. Exporters use these boundaries to avoid internal horizontal lines while still drawing a complete frame around each page fragment. When a question continues on a new page, the new fragment begins with `Question N continued` and reopens the appropriate frame, ledger structure, or card header.

Template geometry participates in measurement before pagination. Changing templates can therefore change page count, but cannot clip content or reuse a plan measured for another template. The existing latest-only preview queue and export revision checks prevent stale output after a switch.

## PDF Rendering

The PDF exporter will keep one shared content renderer for rich paragraphs, images, answer lines, response tables, and response controls. Template-specific question chrome will be rendered around those nodes:

- Classic draws an outer question-fragment border and continuous vertical number/marks rules.
- Ledger draws the black number block, heading rule, and right-aligned bracketed marks.
- Cards draws a square outer card border and one `#D9D9D9` header containing `QUESTION N`.

No template may introduce another generated colour. Content tables retain black or gray structural rules, while supplied logos and teacher-attached diagrams retain their original image colours. The printer, not Question Wizard, controls whether those images are printed in colour or grayscale.

## Word Rendering

The Word exporter will continue to use native editable paragraphs and tables. It will apply per-cell borders so adjacent subquestion rows have no horizontal separators while question-fragment boundaries retain their outer borders.

Classic and Cards will be represented by fixed-layout Word tables. Ledger will use a narrow number cell, open content cell, and marks cell with only the required outer and heading rules. The Cards header uses native cell shading set to `D9D9D9`. No floating shapes or text boxes will be used.

Row height remains `ATLEAST` where content may expand, and `cantSplit` continues to protect individual subquestions.

## Validation and Failure Behavior

- Missing template IDs are normalized to `classic` only for legacy drafts and backups.
- Unknown template IDs in version 4 project files are rejected as invalid project data.
- Layout overflow errors retain their current question/subquestion references.
- A template switch that makes a subquestion too tall produces the existing live warning and blocks downloads until the content fits.
- Export failures do not overwrite a previously displayed preview with partial output.
- Template thumbnails are static interface markup and do not load external resources.

## Testing

Unit tests will cover:

- registry validation and default selection;
- creation, duplication, saving, and restoring of each template ID;
- migration of versions 1–3 to `classic`;
- rejection of invalid version 4 template IDs;
- removal of internal subquestion dividers in PDF and Word structures;
- bracketed marks in all templates;
- 30-point answer-line leading;
- page-fragment boundaries and continuation headers for each template;
- stable content and total marks across template switches;
- overflow behavior when a larger-spaced template changes pagination;
- the strict black, white, and `D9D9D9` palette for generated text, lines, borders, and fills;
- preservation of original colours in supplied logos and teacher-attached diagrams;
- live preview invalidation and latest-only rendering after rapid template changes.

Browser verification will exercise keyboard and pointer selection, autosave/reload, switching with existing content, stale-download blocking, desktop/mobile selector layout, and successful PDF/Word downloads for all three templates. Document verification will compare page counts, text, marks, bounds, and editable native content between PDF and LibreOffice-rendered Word output.

## Files Expected to Change

- `src/templates.js`: template registry and validation.
- `src/project.js`: version 4 model, defaults, migration, parsing, and backup behavior.
- `src/views.js`: accessible visual template selector.
- `src/main.js`: template selection change handling through the existing save/preview flow.
- `src/layout.js`: template-aware metrics, spacing, and page-fragment metadata.
- `src/pdf-export.js`: template-specific question chrome using shared content nodes.
- `src/docx-export.js`: matching native Word structures and border rules.
- `src/styles.css`: selector presentation and responsive behavior.
- Tests and verification scripts covering persistence, layout, export, and browser behavior.
- `README.md`: template choices, backup compatibility, and print rules.

## Acceptance Criteria

- Teachers can switch among Classic school, Modern ledger, and Question cards without changing paper content.
- Classic school is the default for new and legacy papers.
- Preview, PDF, and Word visibly use the selected template.
- No horizontal divider appears between subquestions.
- All generated marks use brackets.
- Answer lines use 30-point spacing.
- Template C uses one square-cornered card per question with one `QUESTION N` header and no redundant left number.
- Generated template text, lines, borders, and fills use only black, white, and `#D9D9D9`.
- Supplied logos and teacher-attached diagrams preserve their original colours.
- Existing supported content types and pagination safety remain intact.
- Automated tests and representative browser/document verification pass.
