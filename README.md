# Question Wizard

A browser-only school question-paper editor. Teachers write the questions; the app handles the cover, numbering, marks columns, answer space, page breaks, and editable Word / print-ready PDF exports. There is no application backend, account system, document API, or external runtime dependency.

Open the published app at [navnit.github.io/question-wizard](https://navnit.github.io/question-wizard/).

## Run locally

```sh
npm install
npm run build
npm run preview -- --port 4174
```

Open http://127.0.0.1:4174/. This server serves static app files only; questions, drafts, and document generation stay in the browser. `npm run dev` is available for development but does not install the offline worker.

## Teacher workflow

1. Choose **Create paper**, or open the editable Science sample.
2. Enter the title, subject, class, academic year, term, duration, and maximum marks.
3. Choose **Classic school** (the default), **Modern ledger**, or **Question cards** under Paper details. You can switch at any time without changing the paper's content. Then add questions and subquestions, format shared instructions and prompts, choose a response type, and set marks. Written responses use answer lines; multiple choice uses 2–6 ordered options; True / False prints two empty choices. You can also attach multiple PNG/JPEG diagrams, word banks, and multiple response tables. Questions, diagrams, options, and tables can be reordered; questions can also be copied.
4. The paper preview updates automatically as you edit, including during diagram resizing. A slider brings its question's page into view and shows printed dimensions in centimetres. On smaller screens, the active slider also has an inline paper view beneath it. Incomplete papers have a draft preview, but downloads stay disabled until validation passes and the latest frame is ready. **Update preview** remains available for a manual refresh.
5. Download **PDF** for printing or **Word** for further editing.
6. Download a **project backup** (`.qw.json`) regularly. Use **Open project backup** to restore it as a separate draft, without replacing existing papers.

Question names are only for organizing the outline and are not printed. Shared instructions, diagrams in their listed order, prompts, tables, and answer areas are printed. New papers do not print the optional sample label. Word generation happens when its download is requested, so dragging does not repeatedly build Word files.

### Rich prompts and response types

- Shared instructions and question prompts support bold, italic, underline, superscript, subscript, one-level bulleted and numbered lists, clear formatting, and undo/redo. Superscript and subscript are mutually exclusive. Common bold/italic/underline keyboard shortcuts work in the editor.
- **Insert blank** is available for question prompts only. It inserts one fixed 3 cm writing line at the caret and remains a single unit when the paper wraps.
- Pasting retains supported text formatting, flattens nested lists to one level, and turns pasted tables into readable plain-text rows. Links, external images, scripts, and other active content are discarded. Attach diagrams with the dedicated image control instead.
- **Written response** prints the configured answer lines. **Multiple choice** starts with four options and supports 2–6 options of up to 300 characters each. **True / False** prints empty boxes for both choices. Switching type preserves inactive options and written-line settings but does not print or validate them until that type is active.
- Incomplete prompts and choices can still be saved, previewed, and backed up. Downloads require real prompt text, balanced marks, and 2–6 completed options for every active multiple-choice part.

Use **Image arrangement** within a question to choose **Vertical — stacked** or **Horizontal — two per row**. Horizontal images read left to right, then down, with a consistent gap and top alignment; an odd final image stays in the left column. Oversized diagrams fit proportionally within their column. The size sliders and centimetre labels reflect printed size. Switching back to vertical restores the preferred larger dimensions unless you resized the image. The actual paper preview updates on layout changes, including an inline view on phones. The arrangement is saved in drafts and backups and used by both PDF and editable Word exports. Earlier drafts default to vertical; response tables are unaffected. Open arrangement-enabled backups in this app version or newer, as older builds do not understand the layout setting.

## Local drafts, backups, and offline use

- Drafts and uploaded images autosave to IndexedDB in this browser. The save indicator reports completion or failure. Reloading a tab restores its last open draft.
- Drafts are specific to the browser profile and site address (including the port). They do not synchronize between computers or browser tabs. Avoid editing the same draft in multiple tabs simultaneously.
- Clearing site data, removing the browser profile, or browser storage eviction can remove drafts. Private browsing may not retain them. Project backups are the portable, independent copy; keep them somewhere safe.
- Backups include the referenced diagrams, including the built-in sample diagram. Imports are validated as data; they cannot load external images or execute HTML/scripts. Invalid files do not overwrite existing work. Incomplete papers can still be backed up.
- New backups use format version 4, which stores the selected template together with semantic rich text and response settings. The app still opens version 1, 2, and 3 backups and earlier local drafts; those papers use Classic school by default, and legacy prompt strings and single diagrams/tables are converted without modifying the supplied file. Version 4 backups require Question Wizard 0.4.0 or newer; older builds reject them rather than silently dropping template or content settings.
- Projects have a 40 MB portable-file limit. A change that would exceed it is rejected while keeping the preceding draft intact. Removed or replaced diagrams that are no longer referenced are discarded from the draft. Use smaller diagrams or split very large papers.
- Wait for **Saved for offline use** before disconnecting. The first visit downloads the app, fonts, images, and export libraries; later reloads and fresh exports can work offline. Clearing site data also removes the offline installation.
- The published GitHub Pages version uses HTTPS. Localhost is also supported.

## Formatting scope and limits

All three templates use A4 pages, the supplied school/Cambridge logos, a cover with standard instructions, continuation labels, and a footer. Classic school uses familiar question/content/marks rails. Modern ledger uses a black question-number block and an open content area. Question cards uses one square-cornered card and a gray `QUESTION N` header per question, without a redundant left number rail. Across every template, marks appear in brackets, subquestions have extra breathing room without horizontal divider lines, and answer guides use 30-point leading (approximately double text spacing). Generated paper chrome uses black, white, and one gray (`#D9D9D9`); supplied logos and teacher-attached diagrams retain their original colours so the printer can handle grayscale conversion. Question names remain editor-only. The representative Science example is not a verbatim transcription of a supplied paper.

This version supports English text and characters available in the embedded Liberation Sans font, the focused rich-text controls above, three response types, and PNG/JPEG diagrams up to 5 MB. Unsupported glyphs and text that cannot fit produce an export warning. Equations, arbitrary fonts/colours/headings/links, nested lists, rich table cells or options, answer keys, auto-grading, randomised choices, a reusable question bank, collaborative editing, and cloud sync are not included.

Each rich field permits up to 8,000 characters, counting paragraph boundaries and inserted blanks, with structural limits of 8,001 blocks and 16,000 inline nodes. The editor also permits up to 100 questions, 26 subquestions per question, 12 diagrams per question, 12 tables per subquestion, 25 answer lines per written part, and tables of up to 12 rows by 5 columns. A single subquestion (including its introduction, diagrams, tables, and answer area) must fit on a page. Oversized content produces a live warning and blocks downloads; split it into smaller questions/subquestions or reduce image/answer space. A valid marks total is required for export.

PDF is the print reference. DOCX contains native editable text, tables, images, and an embedded font; the templates do not depend on floating text boxes or shapes. Both use a shared measured page plan, with explicit Word sections and unsplittable question rows. Word processors can still lay out text differently, particularly after editing the exported file. Native Microsoft Word on teachers' computers has not been tested. Do not assume pixel-identical DOCX/PDF output; review exports before school use.

Font licensing is included in `public/assets/LICENSE_LIBERATION`.

## Verification

```sh
npm test
npm run build
```

Unit tests cover the three templates, bracketed marks, shared spacing, question fragments, generated print colours, native PDF/DOCX output without subquestion dividers, rich-text normalization and limits, pagination, content/marks preservation, page overflow, portable backups, legacy migration, safe imports, and latest-only live preview scheduling.

`work/verify-editor.mjs` exercises the rendered editor in isolated Chrome: template switching and persistence, PDF/Word downloads for all three templates, creation, diagrams, word banks, response tables, validation, stale-export blocking, autosave/reload, backup/import, offline use, and mobile overflow. It uses this workstation's bundled Playwright and installed Chrome and expects the preview server on port 4174. Artifacts are written to `work/editor-verification/`.

`work/verify_editor_documents.py` compares each template PDF with its DOCX file converted to PDF by LibreOffice. It checks page counts, per-page text and bracketed marks, bounds, gray shading, removed part dividers, embedded fonts/media, and native Word content. LibreOffice is a compatibility check, not a substitute for native Word testing.

## Main modules

- `src/main.js`, `src/views.js`: editor/library workflow and safe form rendering.
- `src/project.js`, `src/storage.js`: versioned project files, image portability, and IndexedDB drafts.
- `src/templates.js`, `src/layout.js`: template definitions, font-measured shared pagination, spacing, and overflow checks.
- `src/pdf-export.js`, `src/docx-export.js`: local document generation.
- `src/preview.js`: local PDF.js canvas preview.
- `src/live-preview.js`, `src/content.js`: latest-only rendering queue and legacy/multiple-content compatibility.
- `scripts/create-sw.mjs`: production static-file offline cache.
