# Academic Evergreen Visual System and Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Academic Evergreen palette with darker side panels and replace improvised text glyphs with a coherent, accessible icon system without changing the question-paper workflow or generated documents.

**Architecture:** A small local icon module owns the approved SVG vocabulary and accessible markup. Existing view functions consume that module while semantic CSS tokens control the complete application chrome. UI actions, storage, preview generation and export behavior remain unchanged.

**Tech Stack:** Vanilla JavaScript, Vite, local inline SVG, CSS custom properties, Node tests, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-08-academic-evergreen-icons-design.md`

## Global Constraints

- Preserve the current library and three-column outline/editor/preview information architecture.
- Preserve all action names, event routing, saved-project behavior and PDF/DOCX output.
- Use `#E4E9E1` for the outline rail, `#E8ECE5` for the preview rail and `#FFFFFF` for the editor and paper.
- Use semantic custom properties for application colours; component rules must not introduce competing green or sage literals.
- Use one local outline icon family with `currentColor`, round caps/joins and a `1.75px` visual stroke.
- Keep visible labels on primary, export and destructive actions. Limit icon-only controls to familiar compact actions with an `aria-label` and pointer tooltip.
- Do not bundle a full icon catalogue, load an icon CDN, add a backend, add a theme switcher or alter the school paper design.
- This folder is not a Git repository. Do not initialize Git or attempt commits/worktrees. Preserve implementation and review records as files.

---

### Task 1: Local icon vocabulary and semantic action markup

**Files:**
- Create: `src/icons.js`
- Create: `tests/icons.test.js`
- Modify: `index.html`
- Modify: `src/views.js`
- Modify: `src/rich-editor.js`
- Modify: `src/main.js`

**Interfaces:**
- Produces: `icon(name, { className = '', title = '' } = {}) -> string`, returning one trusted inline SVG with `aria-hidden="true"` unless a title is explicitly supplied.
- Produces: `mountIcons(root = document) -> void`, replacing static `[data-icon]` slots in `index.html` with approved SVG markup.
- Consumes: existing `button(action, label, other)` rendering and all unchanged `data-action` values.

- [ ] **Step 1: Write failing icon-contract tests**

Create `tests/icons.test.js` with assertions equivalent to:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { icon, ICON_NAMES } from '../src/icons.js';

test('approved icons render local accessible currentColor SVG', () => {
  for (const name of ICON_NAMES) {
    const html = icon(name);
    assert.match(html, /^<svg /);
    assert.match(html, /stroke="currentColor"/);
    assert.match(html, /stroke-width="1\.75"/);
    assert.match(html, /aria-hidden="true"/);
    assert.doesNotMatch(html, /https?:|href=|<img/i);
  }
});

test('unknown icon names fail rather than silently drawing the wrong symbol', () => {
  assert.throws(() => icon('not-an-action'), /Unknown icon/);
});

test('action surfaces no longer use arrow, multiply or list text glyphs', async () => {
  const source = (await Promise.all(['../index.html', '../src/views.js', '../src/rich-editor.js'].map(path => readFile(new URL(path, import.meta.url), 'utf8')))).join('\n');
  assert.doesNotMatch(source, />\s*(?:←|→|↑|↓|×|↗|↶|↷|▤|◉|• List|1\. List|＋ Blank)\s*</);
});
```

- [ ] **Step 2: Run the focused test and confirm the missing module/glyph failure**

Run: `node --test tests/icons.test.js`  
Expected: FAIL because `src/icons.js` does not exist and the current views still contain text glyphs.

- [ ] **Step 3: Implement the curated icon module**

Create a frozen icon map containing only these keys:

```js
export const ICON_NAMES = Object.freeze([
  'archive', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-up',
  'bold', 'check-circle', 'chevron-left', 'chevron-right', 'copy',
  'eraser', 'file-down', 'file-text', 'hard-drive', 'image-off',
  'info', 'italic', 'list', 'list-ordered', 'plus', 'redo',
  'refresh', 'subscript', 'superscript', 'text-cursor-input',
  'trash', 'triangle-alert', 'underline', 'undo', 'x'
]);
```

Each entry supplies production-quality SVG child markup in a `24 × 24` view box. Render with this fixed shell:

```js
export function icon(name, { className = '', title = '' } = {}) {
  const children = ICON_PATHS[name];
  if (!children) throw new Error(`Unknown icon: ${name}`);
  const accessibility = title
    ? `role="img" aria-label="${escapeAttribute(title)}"`
    : 'aria-hidden="true" focusable="false"';
  return `<svg class="icon${className ? ` ${escapeAttribute(className)}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" ${accessibility}>${children}</svg>`;
}
```

`mountIcons` must replace only known `[data-icon]` slots and must not fetch resources or accept arbitrary SVG/HTML.

- [ ] **Step 4: Migrate static and generated action markup**

Use the exact action mapping from the approved spec. Extend the view helper without changing existing action attributes:

```js
const button = (action, label, other = '', iconName = '') =>
  `<button type="button" data-action="${action}" ${other}>${iconName ? icon(iconName) : ''}<span>${label}</span></button>`;

const iconButton = (action, iconName, ariaLabel, other = '') =>
  `<button type="button" class="icon-button" data-action="${action}" aria-label="${escape(ariaLabel)}" title="${escape(ariaLabel)}" ${other}>${icon(iconName)}</button>`;
```

Required mappings:

```text
Update preview -> refresh
Download PDF / Download Word -> file-down
Download project backup -> archive
All papers -> arrow-left
Previous / next preview page -> chevron-left / chevron-right
Add actions -> plus
Make a copy / duplicate question -> copy
Delete -> trash
Remove attachment -> image-off or x
Move controls -> arrow-up / arrow-down
Saved on this device -> check-circle
Saved for offline use -> hard-drive
Paper details/template -> file-text
```

In `rich-editor.js`, replace toolbar text with `bold`, `italic`, `underline`, `superscript`, `subscript`, `list`, `list-ordered`, `eraser`, `text-cursor-input`, `undo` and `redo`. Keep the existing button titles, `aria-pressed`, keyboard commands and behavior.

Use static `<span data-icon="…" aria-hidden="true"></span>` slots in `index.html`, then call `mountIcons(document)` during initialization. Do not duplicate SVG paths in HTML.

- [ ] **Step 5: Run focused and existing editor tests**

Run: `node --test tests/icons.test.js tests/rich-editor.test.js`  
Expected: all tests PASS; toolbar and action labels remain present for accessibility.

- [ ] **Step 6: Record Task 1 evidence**

Write the files changed, focused command and exact pass count to this plan's progress ledger. Do not create a Git commit.

---

### Task 2: Semantic Academic Evergreen colour and component system

**Files:**
- Create: `tests/visual-system.test.js`
- Modify: `src/styles.css`
- Modify: `index.html`

**Interfaces:**
- Consumes: `.icon`, `.icon-button`, `.primary`, `.secondary`, `.danger`, `.text-button` and the existing shell classes.
- Produces: the exact semantic colour variables from the approved spec and consistent icon/button sizing across desktop and mobile.

- [ ] **Step 1: Write failing visual-token tests**

Create `tests/visual-system.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const css = (await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')).replace(/\s+/g, '').toLowerCase();

test('Academic Evergreen semantic tokens use the approved values', () => {
  for (const declaration of [
    '--color-canvas:#f5f4ee', '--color-surface:#ffffff',
    '--color-outline-rail:#e4e9e1', '--color-preview-rail:#e8ece5',
    '--color-selection:#d4dfd1', '--color-ink:#183c34',
    '--color-primary:#24634f', '--color-primary-hover:#1d5543',
    '--color-support:#6f875f', '--color-muted:#66756c',
    '--color-border:#cbd5ca', '--color-border-soft:#d7ded5',
    '--color-focus:#b7793f', '--color-danger:#b84a3a',
    '--color-danger-soft:#f7e8e4'
  ]) assert.ok(css.includes(declaration), declaration);
});

test('the editor, outline and preview use their semantic surfaces', () => {
  assert.match(css, /\.outline\{[^}]*background:var\(--color-outline-rail\)/);
  assert.match(css, /\.editor-column\{[^}]*background:var\(--color-surface\)/);
  assert.match(css, /\.preview\{[^}]*background:var\(--color-preview-rail\)/);
});

test('icons and compact controls have the approved geometry', () => {
  assert.match(css, /\.icon\{[^}]*width:16px[^}]*height:16px/);
  assert.match(css, /\.icon-button\{[^}]*min-width:32px[^}]*min-height:32px/);
});
```

- [ ] **Step 2: Run the visual test and confirm token failures**

Run: `node --test tests/visual-system.test.js`  
Expected: FAIL because the selected tokens and rail backgrounds are not yet defined.

- [ ] **Step 3: Replace the root palette with semantic tokens**

Define the exact approved variables:

```css
:root {
  --color-canvas:#f5f4ee;
  --color-surface:#fff;
  --color-outline-rail:#e4e9e1;
  --color-preview-rail:#e8ece5;
  --color-selection:#d4dfd1;
  --color-ink:#183c34;
  --color-primary:#24634f;
  --color-primary-hover:#1d5543;
  --color-support:#6f875f;
  --color-muted:#66756c;
  --color-border:#cbd5ca;
  --color-border-soft:#d7ded5;
  --color-focus:#b7793f;
  --color-danger:#b84a3a;
  --color-danger-soft:#f7e8e4;
}
```

Replace application-chrome green, sage, border, muted and danger literals with these tokens. Preserve black/gray values used inside the generated paper canvas or PDF rendering. Update `<meta name="theme-color">` and the favicon fill to `#183C34`.

- [ ] **Step 4: Apply darker rail surfaces and shared button geometry**

Set `.outline` to `var(--color-outline-rail)`, `.preview` to `var(--color-preview-rail)`, and `.editor-column`, header, fields, cards, dialogs and the paper canvas to `var(--color-surface)` where they are application UI.

Implement:

```css
.icon{width:16px;height:16px;flex:0 0 auto;display:block}
.icon-button{display:inline-grid;place-items:center;min-width:32px;min-height:32px;padding:0}
.primary,.secondary,.danger,.text-button{gap:8px}
.rich-toolbar .icon{width:14px;height:14px}
```

Keep primary controls at 40–41 px, compact controls at least 32 px and touch-layout icon controls at least 36 px. Use the amber focus token, semantic hover/pressed surfaces, shared disabled opacity and reduced-motion-safe preview rotation.

- [ ] **Step 5: Check mobile rules and remove competing chrome colours**

At the 940 px and 620 px breakpoints, retain the two approved side-panel backgrounds, keep the editor white, allow toolbar and export controls to wrap, and prevent horizontal document overflow. Preserve the paper canvas as white.

Search the stylesheet for old UI palette literals. Each remaining literal must be either a neutral paper-preview value, a shadow alpha, or documented in the task report with its role.

- [ ] **Step 6: Run token, icon and complete Node tests**

Run: `node --test tests/visual-system.test.js tests/icons.test.js`  
Expected: all focused tests PASS.

Run: `npm test`  
Expected: the complete suite passes without new warnings or failures.

- [ ] **Step 7: Record Task 2 evidence**

Write the exact focused/full pass counts and remaining intentional literals to the progress ledger. Do not create a Git commit.

---

### Task 3: Production build, visual fidelity and interaction QA

**Files:**
- Modify if required by discovered regressions: `src/icons.js`, `src/views.js`, `src/rich-editor.js`, `src/main.js`, `src/styles.css`, `index.html`
- Temporary QA only: `/private/tmp/question-evergreen-qa/`
- Update status: `docs/superpowers/specs/2026-09-08-academic-evergreen-icons-design.md`

**Interfaces:**
- Consumes: completed icon and colour system from Tasks 1–2.
- Produces: browser evidence that the accepted visual reference and core action flow match on desktop/mobile without changing paper output.

- [ ] **Step 1: Build production output**

Run: `npm run build`  
Expected: Vite and offline-cache generation complete successfully. Record any pre-existing size warning separately from failures.

- [ ] **Step 2: Capture the accepted reference**

Capture the selected companion screen at its natural desktop width to `/private/tmp/question-evergreen-qa/reference.png` from:

```text
http://localhost:60986/?key=d8d1fc50bec0243ccf9d10f3fe4b926f60b879cab2195296c57ff79f81878761
```

Use the refined panel inside that screen as the reference, not the rejected lighter comparison.

- [ ] **Step 3: Verify the production app at desktop and mobile sizes**

The flow under test is: app loads → open or add a sample paper → update preview → navigate preview pages → download PDF and Word → navigate to a rich question → activate formatting and reorder controls → return to library.

Use Browser/IAB when available; otherwise record `Browser plugin not available` and use Playwright. Check desktop at 1440×1100 only, per the user's 2026-09-08 scope update. Capture implementation screenshots under `/private/tmp/question-evergreen-qa/`. Responsive rules stay unit-tested, but mobile rendered visual QA is an intentional remaining risk.

- [ ] **Step 4: Check browser health and accessibility states**

Verify:

```text
correct Question Wizard title and URL
meaningful content, no framework overlay
zero relevant console errors
zero external icon or font requests
visible keyboard focus
pressed rich-text formatting state
disabled exports before current preview, enabled after current preview
all icon-only buttons have aria-label and title
no horizontal document overflow at 390 px
```

- [ ] **Step 5: Compare reference and implementation directly**

Use image inspection on both `/private/tmp/question-evergreen-qa/reference.png` and the final desktop screenshot. Record at least these comparison points in the task report:

```text
outline rail darkness
preview rail darkness and white paper separation
white editor surface
primary/secondary action hierarchy
icon metaphor and 1.75 px stroke character
type hierarchy and control sizing
desktop density and mobile wrapping
```

Fix every material mismatch and rerun the affected focused test plus the browser check.

- [ ] **Step 6: Confirm paper output is unchanged**

Generate the same sample paper before and after the visual change or use the existing deterministic export tests. Confirm page count, text layout and paper canvas content remain unchanged; the theme must affect application chrome only.

- [ ] **Step 7: Mark the visual specification implemented**

Change the spec status to `Implemented and verified` only after all checks pass. Record the build, test counts, screenshots, interaction flow and any intentional deviations in the task report and progress ledger.

- [ ] **Step 8: Complete independent task and whole-change reviews**

Give reviewers the spec, plan, scoped changed files, test report and screenshot paths. Fix all Critical or Important findings with focused regression coverage and re-review before completion.
