# Rich text and simple question types

Status: approved, implemented, and integration-verified on 2026-09-08. PDF and LibreOffice-rendered DOCX were checked; native Microsoft Word remains untested.

## Outcome

Teachers keep the existing paper → question → subquestion flow. Add focused formatting to shared instructions and question prompts, plus optional multiple-choice and True/False responses. Preserve browser-only operation, offline use, image arrangements, response tables, autosave, portable backups, and editable Word/print-ready PDF exports.

## Teacher-facing design

### Rich text

- Replace the shared-instructions and question-prompt text areas with a labelled rich-text field and a compact toolbar.
- Support bold, italic, underline, superscript, subscript, single-level bullets, single-level numbered lists, and clear formatting. Superscript and subscript are mutually exclusive. Numbering restarts at 1 for each separate list.
- Keep the school font, base size, colour, indentation, and page alignment fixed. Do not offer arbitrary fonts, colours, headings, links, or embedded media inside these fields.
- Keep images and tables in their existing dedicated controls. Table cells, word banks, and multiple-choice options stay plain text in this release.
- Provide Insert blank in the question-prompt toolbar. It inserts a fixed 3 cm answer line at the caret (or replaces the selection), remains a single unit during wrapping, and supports normal undo/delete. It is a writing space, not a hidden correct answer. There is no separate fill-in-the-blank type or blank-length control in this release.
- Preserve supported formatting on paste. Remove incompatible styles and active content; flatten nested lists to the supported single level. Pasted tables become readable plain text, and pasted images do not load or become attachments. Teachers use Attach a diagram for images.
- Formatting controls preserve the current text selection. Support keyboard navigation, visible focus, accessible names and pressed states, familiar bold/italic/underline shortcuts, and undo/redo. Autosave and preview updates must not replace the focused editing surface or interrupt composition input.

### Response type

Each subquestion has a Response type selector, defaulting to Written response. Existing subquestions migrate to that default.

| Type | Controls and printed response |
| --- | --- |
| Written response | Existing marks and answer-line count. Short and long answers are the same type. |
| Multiple choice | Four initially empty option fields, with 2–6 options allowed. Add, remove and move options using small controls. Print automatically assigned A–F labels, one option per line, with wrapped text aligned beneath its option text. |
| True / False | Fixed True and False labels, each with an empty response box. No option editing required. |

Marks stay visible for every type. Hide the answer-line setting for multiple choice and True/False; do not print written-response lines for those types. Keep the prompt, images, word banks and tables available.

Switching types preserves the prompt and all previously entered response settings. For example, changing away from multiple choice hides but does not discard its options; switching back restores them. Inactive response settings never print and do not block export. Explicit option removal remains an intentional content edit.

Blank prompts and unfinished options may be saved, backed up, and previewed. Export requires a non-empty prompt and, for multiple choice, 2–6 non-empty options. A blank token alone does not satisfy the prompt requirement. Options allow up to 300 characters each. No correct-answer selection, answer key, auto-grading, randomisation, image options, or multi-column choice layout is included.

## Content model and compatibility

- Introduce project format version 3. Continue importing versions 1 and 2 and upgrading existing local drafts without mutating the supplied original object.
- In version 3, shared `context` and subquestion `text` become structured rich-text documents instead of strings. Convert each legacy string into unformatted paragraphs, retaining line breaks. A shared plain-text accessor supports validation and any text-only consumers; do not maintain a separately editable duplicate string.
- A document contains paragraphs or single-level lists. Paragraph/list-item content contains text runs with allowlisted marks and, in prompts only, blank tokens. Store semantic data, not arbitrary HTML or CSS. Renderers and the editor consume the same validated document model.
- Preserve the existing 8,000-character limit per prompt/shared-instructions field, counting paragraph boundaries and blanks as characters. Also bound each document to 8,001 paragraph/list-item blocks and 16,000 inline nodes to prevent tiny-text, large-structure payloads without rejecting previously permitted newline-heavy legacy text. Remove redundant empty runs during normalisation. Bound list nesting to one level and reject malformed or unsupported document data on backup import.
- Add a validated response type (`written`, `multiple-choice`, or `true-false`) and an optional options array to each subquestion. Preserve inactive options and the existing answer-line count in drafts. Migration retains image layout, all diagrams/tables, question IDs for local drafts, and existing import-as-a-separate-draft behaviour.
- Keep current per-project size limits, save-failure handling and capacity rollback. Version 3 backups require the updated app; older builds must reject the unsupported version rather than silently lose formatting.
- Reject unsafe or malformed backup data without replacing current work. Convert clipboard content through an inert, allowlisted path; never execute pasted markup or fetch its external resources.

## Editor and export integration

Separate rich-document normalisation/validation, editing interactions, and styled text measurement into focused modules. Integrate them into the existing views, state, validation, assets, and export modules; do not make the editor DOM or raw HTML the persistence format.

The shared page plan must measure styled text runs, not approximate them as plain text. Bundle licensed matching regular, bold, italic, and bold-italic font faces locally and precache them for offline use. Superscript/subscript use smaller runs with explicit baseline offsets; measure their true widths and reserve enough line height. Underlines and blank tokens must remain visible across exports. Wrap at real word boundaries without dropping spaces between differently formatted runs.

Keep list markers and MCQ labels distinct from the existing question/subquestion numbering, with hanging indentation for continuation lines. Record the prompt position explicitly in the row plan so marks remain aligned with the prompt even when it begins with a list or styled content; do not locate the prompt by searching plain-text prefixes.

Content order is shared instructions, arranged diagrams, subquestion prompt, type-specific responses, optional word bank, response tables, and written answer lines (written type only). Preserve the existing rule that a subquestion and its attached content must fit a page. Oversize content produces a clear warning and disables export; it must never clip silently.

PDF draws the measured styled runs, list/choice labels, blanks, and response boxes. Word uses native text runs, editable paragraphs, and existing native image/table structures with equivalent styling and layout. PDF remains the print reference; native Word can vary slightly.

All edits continue through the latest-only preview queue and coalesced draft writer. Keep the last committed preview visible during updates, and permit downloads only when the newest revision is valid and rendered. New editor/font dependencies, if used, must be bundled locally with no runtime CDN or service requirement.

## Acceptance and verification

1. Existing version 1/2 papers and the standard/stress samples retain their content, marks, images, tables, and pagination after migration.
2. Bold/italic combinations, underline, superscript/subscript, lists and blanks survive editing, undo/redo, save/reload, copy, backup/import, PDF and Word export.
3. A word spanning multiple styled runs wraps correctly; long text, lists, blank tokens and scripts do not overlap borders, marks, or neighbouring lines.
4. Multiple-choice labels update after add/remove/reorder; long options wrap correctly. Switching response types never discards content or prints inactive responses. True/False prints empty response boxes, not an answer.
5. Incomplete drafts remain recoverable and previewable; invalid or oversized active content blocks downloads with a useful message.
6. Pasted Word-style content keeps supported formatting while hostile markup, external URLs, malformed imports, excessive nesting, and excessive node counts remain inert or are rejected safely.
7. Test selection preservation, toolbar use, typing/composition, undo/redo, keyboard operation, live preview and no horizontal overflow on desktop and phone-sized screens.
8. Verify offline reload, editing and both exports after the updated app is cached. Confirm no external runtime requests.
9. Run automated regression tests and the production build. Inspect exported PDFs and Word documents rendered through LibreOffice for content, font styles, page counts and bounds; report that native Microsoft Word is still a separate compatibility check.

## Deliberately deferred

Full equations, rich table cells/options, nested lists, matching-question builders, answer keys, scoring/grading, arbitrary document styling, collaborative editing and cloud services. No changes to school-template calibration are part of this work.
