# SDD ledger — plan: docs/superpowers/plans/2026-09-08-academic-evergreen-icons.md

Baseline: rich-text Task 3 passed 61/61 tests before visual implementation. No Git repository, so commits/worktree/diff packaging are unavailable; use scoped files, reports and screenshots instead.

| Check | Producer / consumer | Result |
| --- | --- | --- |
| Task 1 internal | icon map, renderer tests and migrated markup | One trusted local SVG source; action semantics remain unchanged |
| Task 2 internal | semantic tokens, rail surfaces and control geometry | Exact approved values and existing breakpoints agree |
| Task 3 internal | build, browser interaction and screenshot comparison | Verification uses the accepted refined companion reference |
| Tasks 1/2 | `.icon` / `.icon-button` markup → component styling | Class names, 16 px default and compact variants match |
| Tasks 1/3 | migrated controls → browser accessibility and action flow | Labels, aria-labels, titles and data-action values remain testable |
| Tasks 2/3 | colour tokens → desktop/mobile fidelity checks | Rails, editor and paper surfaces have explicit comparison points |

Ruling: use a small project-local SVG map instead of an external icon package — this keeps the offline bundle focused and avoids shipping an entire catalogue — if the map's geometry is wrong, individual icons may need optical correction during visual QA.

Task 1: minor (deferred to Task 2): labelled flex buttons combine a shared gap with an icon sibling margin; consolidate spacing in the component geometry pass.
Task 1: fix round 1/5 (2 addressed, 0 open; no Git SHA) — icon lookup now rejects inherited names and the fixed-blank action retains a visible label.
Task 1: complete (no Git SHA; focused 17/17, full suite 72/72, production/offline build, scoped re-review clean).
Task 2: fix round 1/5 (1 addressed, 1 new open; no Git SHA) — compact mobile controls reached 36px, but the grouped rule reduced the primary preview button below its 40px contract.
Task 2: fix round 2/5 (1 addressed, 0 open; no Git SHA) — primary preview remains 40px; compact preview/export/rich controls remain 36px.
Task 2: complete (no Git SHA; visual 10/10, visual+icons 18/18, full suite 82/82, production build, scoped re-review clean).
Task 3: complete (no Git SHA; focused 27/27, full suite 82/82, production build, desktop Playwright interaction/fidelity QA, screenshot evidence and task review clean).
Task 3: scope note — mobile rendered visual QA intentionally excluded by the user's 2026-09-08 update; responsive rules remain unit-tested.

Final review fix wave: complete (no Git SHA; all 3 Important and 3 Minor findings addressed together). Scoped preview hint colour prevents child label/icon leakage; Undo/Redo now use single return arrows; all compact action families have mobile 36px selector coverage; upload/Blank labels share an aligned 8px gap; destructive content actions use danger text while attachment removal stays ghost; primary geometry measures 41/41/40px on desktop.
Final review verification: new regressions RED 18 passed / 6 failed; focused icons/visual/rich tests GREEN 33/33; full suite 88/88; production build succeeds (216 modules, 12 offline files, version 718001b1c59c). The existing bundle-size advisory remains.
Final desktop evidence: 1440×1100 Playwright using isolated temporary Chrome context; Browser plugin not available. Core preview/export/format/reorder flow plus backup, question add/copy/delete/cancel, image attach/replace/remove, response table add, library create/copy/delete/cancel and invalid-import error all pass. Actual primary child label/icon/slot/stroke are white; normal contrast 7.06:1 and hover 8.63:1. Zero console/page errors, failed requests, external requests or desktop overflow.
Final paper evidence: all 6 PDF pages retain text, positions and page sizes; all 32 DOCX word entries retain content, styling, images and fonts after normalizing expected per-export font keys. Desktop reference and final screenshots inspected. Evidence: /private/tmp/question-evergreen-final-qa/desktop-results.json and export-comparison.json. Full report: /private/tmp/question-evergreen-final-fix-report.md. Mobile rendered QA intentionally not run.
