# Academic Evergreen Visual System and Icons

**Status:** Implemented and verified  
**Verification scope:** Final review fixes and expanded production desktop flow verified at 1440 × 1100 on 2026-09-08: 88/88 automated tests, build, actual primary child colours, backup/add/copy/delete/cancel, hover/error states and unchanged PDF/DOCX content. Evidence: `/private/tmp/question-evergreen-final-fix-report.md`. Mobile rendered visual QA was intentionally not run per the user's updated scope; compact actionable families retain unit-tested touch targets.  
**Date:** 2026-09-08  
**Visual reference:** `.superpowers/brainstorm/90456-1788845370/content/academic-evergreen-sidepanels.html`  
**Related feature plan:** `docs/superpowers/plans/2026-09-07-rich-text-question-types.md`

## Goal

Polish Question Wizard into a coherent, calm school-authoring tool by replacing improvised text glyphs with a consistent icon language and applying the selected Academic Evergreen palette. Preserve the existing information architecture, editor workflow, paper format, preview output and offline-only behavior.

## Scope

This change covers the application chrome: header, library, outline, editor controls, rich-text toolbar, preview rail, export controls, statuses, dialogs and responsive states.

It does not redesign the generated question paper, change school logos or templates, alter editor behavior, add features, add a backend, or change export content.

## Selected Direction

The selected direction is **Academic Evergreen** with visibly darker side panels:

- The centre editor remains white for concentration.
- The outline rail uses the darker sage `#E4E9E1`.
- The preview rail uses the slightly lighter sage `#E8ECE5`.
- The paper canvas remains pure white, increasing separation from the preview rail.
- The shell retains the existing three-column desktop layout and current responsive stacking order.

The darker rails frame the authoring area without turning the interface into a dark or high-density dashboard.

## Colour Tokens

All application colours must be expressed through semantic custom properties rather than component-specific hex values.

| Token | Value | Use |
| --- | --- | --- |
| `--color-canvas` | `#F5F4EE` | Application and library background |
| `--color-surface` | `#FFFFFF` | Header, editor, cards, fields and dialogs |
| `--color-outline-rail` | `#E4E9E1` | Paper outline side panel |
| `--color-preview-rail` | `#E8ECE5` | Preview side panel |
| `--color-selection` | `#D4DFD1` | Selected outline rows and pressed controls |
| `--color-ink` | `#183C34` | Primary text and strong icons |
| `--color-primary` | `#24634F` | Primary actions and active controls |
| `--color-primary-hover` | `#1D5543` | Primary hover state |
| `--color-support` | `#6F875F` | Positive/local status accents |
| `--color-muted` | `#66756C` | Secondary text |
| `--color-border` | `#CBD5CA` | Controls and structural borders |
| `--color-border-soft` | `#D7DED5` | Low-emphasis dividers |
| `--color-focus` | `#B7793F` | Keyboard focus ring |
| `--color-danger` | `#B84A3A` | Destructive action text or fill |
| `--color-danger-soft` | `#F7E8E4` | Destructive hover/background treatment |

Pure white is intentional for the editor and rendered paper. No gradients, translucent colour washes, decorative glows or theme-dependent paper tint are introduced.

## Button Hierarchy

Buttons use four shared variants:

1. **Primary:** evergreen fill, white text, one leading icon. Reserved for the main next action in a region, including `Update preview` and `Start writing questions`.
2. **Secondary:** white surface, visible border, evergreen text. Used for `Download PDF`, `Download Word`, image replacement and similar reversible actions.
3. **Ghost/text:** transparent background with evergreen text and a leading icon when the action benefits from recognition. Used for navigation, backup, duplicate and low-emphasis additions.
4. **Danger:** brick text on a transparent or soft-danger surface; filled danger is reserved for the confirmation dialog's final destructive action.

Primary controls are 40–41 px high. Compact toolbar and preview controls are at least 36 px. Icon-only controls are at least 32 px on desktop and 36 px on touch layouts. Icons are 16 px by default, 14 px in compact toolbars, and never substitute for a necessary text label.

## Icon Language

Use one local, tree-shaken outline icon family with round caps and joins, `1.75px` visual stroke, `currentColor`, and consistent optical sizing. The implementation may use individually imported Lucide icons or a small local icon module containing only the approved icons. It must not bundle an entire icon catalogue.

Important actions retain visible labels. Icon-only controls are limited to familiar compact controls such as previous/next, reorder, undo/redo and close. Every icon-only button has an `aria-label`; a tooltip or `title` supplies the same meaning for pointer users. Decorative icons use `aria-hidden="true"`.

### Action mapping

| Current treatment | New icon and label |
| --- | --- |
| `Update preview ↗` | `RefreshCw` + `Update preview` |
| `PDF ↓` | `FileDown` + `Download PDF` |
| `Word ↓` | `FileDown` + `Download Word` |
| `Download project backup ↓` | `Archive` + `Download project backup` |
| `← All papers` | `ArrowLeft` + `All papers` |
| Preview `←` / `→` | `ChevronLeft` / `ChevronRight`, icon-only |
| `+ Add question`, option, table or row | `Plus` + existing label |
| `Make a copy` | `Copy` + `Make a copy` |
| Delete actions | `Trash2` + visible label where space permits |
| Remove a non-destructive attachment | `X` or `ImageOff` + visible `Remove` label |
| Move up/down | `ArrowUp` / `ArrowDown`, icon-only with item-specific `aria-label` |
| Local save complete | `CircleCheck` + `Saved on this device` |
| Offline availability | `HardDrive` + `Saved for offline use` |
| Paper details glyph | `FileText` |

### Rich-text toolbar mapping

Use `Bold`, `Italic`, `Underline`, `Superscript`, `Subscript`, `List`, `ListOrdered`, `Eraser`, `Undo2`, `Redo2`, and a labelled `TextCursorInput` action for inserting the fixed blank. Pressed formatting states keep `aria-pressed` and gain the selected sage background. Toolbars remain keyboard operable and wrap without horizontal page overflow.

## Status and Feedback

- Status is never communicated by colour alone; pair colour with an icon and text.
- Preview generation shows a rotating `RefreshCw` icon only while work is actually running. Motion stops under `prefers-reduced-motion`.
- Export buttons remain disabled until the current revision is ready; disabled icons and text share the same opacity.
- Notices retain plain-language text and use `CircleCheck`, `Info`, or `TriangleAlert` only when the message type is meaningful.
- Destructive controls use danger colour only for destructive actions, not ordinary removal or navigation.

## Component and File Boundaries

- Add a focused icon renderer/module so views do not embed ad-hoc SVG strings throughout templates.
- Keep action names and event handling unchanged; this is a presentation change, not a command-system rewrite.
- Convert existing CSS literals to semantic tokens in `src/styles.css` and apply the two distinct side-rail backgrounds.
- Update `index.html` and `src/views.js` to use the shared icon/button markup.
- If individually imported icons require a package, keep them locally bundled and confirm the production app makes no icon/CDN requests.
- Do not couple icon rendering to paper/PDF/DOCX export modules.

## Responsive Behaviour

- Desktop keeps the existing outline/editor/preview columns.
- At the current two-column breakpoint, the outline stays `--color-outline-rail`; the stacked preview keeps `--color-preview-rail`.
- On phones, the horizontal outline region retains the darker sage background and the editor remains white.
- Export labels may shorten only if the full meaning remains available through `aria-label`; the preferred mobile labels remain `PDF` and `Word` with `FileDown` icons.
- No button, toolbar or status row may cause horizontal document overflow at 390 px.

## Accessibility

- Retain the 3 px amber focus ring with at least 3 px offset where space allows.
- Preserve visible labels for ambiguous or high-impact actions.
- Maintain button text/icon contrast in normal, hover, pressed, disabled and danger states.
- Do not encode PDF versus Word through colour alone; labels provide the distinction.
- Respect reduced motion and existing keyboard interaction contracts.

## Verification

1. Run all automated tests and the production build.
2. Verify the library, cover editor, rich question editor, image/table controls, confirmation dialog and preview/export toolbar.
3. Inspect desktop at 1440×1100 or the accepted concept size. Rendered mobile visual QA is intentionally excluded by the user's 2026-09-08 scope update; responsive rules remain unit-tested but visually unverified.
4. Exercise update preview, page navigation, PDF/Word download, backup, add, reorder, duplicate and delete/confirm actions.
5. Confirm focus, hover, pressed, disabled and error states.
6. Confirm there are no console errors, external icon/font requests, framework overlays, clipped labels or horizontal overflow.
7. Compare the final browser screenshots directly with the selected visual reference, including colour tokens, panel contrast, typography, button hierarchy, icon metaphor, stroke weight and alignment.
8. Confirm the generated paper preview and downloaded paper styling are unchanged.

## Intentional Non-Goals

- No dark mode or theme switcher.
- No new navigation, panels, cards, badges or decorative illustrations.
- No paper-template colour changes.
- No icon-only conversion for primary, export or destructive actions.
- No animation beyond short state feedback.
