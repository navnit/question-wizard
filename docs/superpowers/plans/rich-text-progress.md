# SDD ledger — plan: docs/superpowers/plans/2026-09-07-rich-text-question-types.md

Baseline: 35 tests passed on 2026-09-07. No Git repository, so commits/worktree/diff packaging are unavailable; use scoped files and reports instead. No user drafts touched by test browsers.

| Check | Producer / consumer | Result |
| --- | --- | --- |
| Task 1 internal | Model tests and normalization/import | Same semantic block/mark model; legacy strings only at migration/trusted boundaries |
| Task 2 internal | Styled measured nodes and exporters | Same widths/fonts/offsets required; explicit prompt offset avoids prefix dependence |
| Task 3 internal | Editor adapters and event wiring | Semantic doc change callbacks; structural lifecycle only |
| Task 4 internal | End-to-end checks and docs | All approved surfaces covered |
| Tasks 1/2 | rich-text helpers → rich-layout/PDF/Word | normalizeRich/plainText/richBlocks names fixed |
| Tasks 1/3 | model → editor/schema | Flat groups mapped to standard editor lists; allowBlank context restriction |
| Tasks 2/3 | main/views → export via current state | No DOM/HTML export; both consume document model |
| Tasks 1/4 | v3 → migration/backup QA | v1/v2 retained; v3 fails safely in older builds |
| Tasks 2/4 | exports → document QA | Real PDF and LibreOffice-rendered Word |
| Tasks 3/4 | UI → browser QA | Isolated contexts preserve user papers |

Task 1: complete (no Git SHA; focused model 20/20 plus migration 4/4; spec and quality approved).
Task 1: minor follow-up resolved in Task 4: sparse outer block arrays are now rejected, with a focused regression test.
Task 2: complete (no Git SHA; 54/54 tests, standard/stress 6/9 pages, actual PDF/LibreOffice Word checked; spec and quality review clean).
Task 3: fix round 1/5 (1 addressed, 0 open; no Git SHA) — list schema, Enter/Shift-Enter behavior and serialization now agree; editor 7/7 and full suite 61/61.
Task 3: complete (no Git SHA; 61/61 tests, production build, desktop/mobile browser QA, spec and quality review clean after fix round 1).
Task 4: complete (no Git SHA; browser integration at 1440×1100 and 390×844, offline PDF/DOCX exports, LibreOffice document comparison, full tests/build/Graphify, README/spec status, and independent final review).
Final review: fix wave 1 (1 addressed, 0 open; no Git SHA) — pasted list breaks now become matching visible, stored and reloaded list items with marks preserved.
Final review: complete (63/63 final tests; actual bullet/numbered HTML paste browser regression; scoped re-review clean; native Microsoft Word remains untested).

Preparation: installed seven ProseMirror packages locally (11 total dependency additions); npm audit reported 0 vulnerabilities. Copied matching licensed italic/bold-italic fonts from the installed PDF.js font bundle. Tooling scripts lack executable permission and Git is absent, so task-brief is run through bash with explicit temporary paths.

Ruling: list group identifiers allow 1–100 characters — a bounded internal identifier needs no teacher-facing control — changing this later may require accepting longer imported identifiers.
