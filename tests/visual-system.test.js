import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [rawCss, html] = await Promise.all([
  readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

const css = rawCss.replace(/\s+/g, '').toLowerCase();

test('Academic Evergreen semantic tokens use the approved values', () => {
  for (const declaration of [
    '--color-canvas:#f5f4ee',
    '--color-surface:#ffffff',
    '--color-outline-rail:#e4e9e1',
    '--color-preview-rail:#e8ece5',
    '--color-selection:#d4dfd1',
    '--color-ink:#183c34',
    '--color-primary:#24634f',
    '--color-primary-hover:#1d5543',
    '--color-border:#cbd5ca',
    '--color-border-soft:#d7ded5',
    '--color-focus:#b7793f',
    '--color-danger:#b84a3a',
    '--color-danger-soft:#f7e8e4'
  ]) {
    assert.ok(css.includes(declaration), declaration);
  }
});

test('application columns use their approved semantic surfaces', () => {
  assert.match(css, /\.outline\{[^}]*background:var\(--color-outline-rail\)/);
  assert.match(css, /\.editor-column\{[^}]*background:var\(--color-surface\)/);
  assert.match(css, /\.preview\{[^}]*background:var\(--color-preview-rail\)/);
});

test('icons and compact controls have the approved geometry', () => {
  assert.match(css, /\.icon\{[^}]*width:16px[^}]*height:16px[^}]*flex:00auto[^}]*display:block/);
  assert.match(css, /\.icon-button\{[^}]*display:inline-grid[^}]*place-items:center[^}]*min-width:32px[^}]*min-height:32px/);
  assert.match(css, /\.rich-toolbar\.icon\{[^}]*width:14px[^}]*height:14px/);
});

test('button states use semantic hover, selection, danger and focus colors', () => {
  assert.match(css, /\.primary:hover:not\(:disabled\)\{[^}]*background:var\(--color-primary-hover\)/);
  assert.match(css, /button:focus-visible[^}]*\{[^}]*outline:3pxsolidvar\(--color-focus\)/);
  assert.match(css, /\.danger:hover:not\(:disabled\)\{[^}]*background:var\(--color-danger-soft\)[^}]*color:var\(--color-danger\)/);
  assert.match(css, /\.rich-toolbarbutton\[aria-pressed=true\]\{[^}]*background:var\(--color-selection\)/);
});

test('labelled action buttons use one eight-pixel gap without sibling margins', () => {
  assert.match(css, /\.primary,\.secondary,\.danger,\.text-button\{[^}]*gap:8px/);
  assert.doesNotMatch(css, /button>\.icon\+span|button>\[data-icon\]\+span/);
});

test('generating preview motion is reduced-motion safe', () => {
  assert.match(css, /#generate:disabled\.icon\{[^}]*animation:[^}]*preview-refresh/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{[^}]*#generate:disabled\.icon\{[^}]*animation:none/);
});

test('mobile icon buttons expose a 36-pixel touch target', () => {
  assert.match(css, /@media\(max-width:620px\)\{[\s\S]*?\.icon-button(?:,|\{)[^}]*min-width:36px[^}]*min-height:36px/);
});

test('mobile preview primary control keeps its 40-pixel minimum', () => {
  const mobileCss = rawCss.match(/@media\(max-width:620px\)\{([\s\S]*?)\}\s*@media\(prefers-reduced-motion:reduce\)/)?.[1];

  assert.ok(mobileCss, 'mobile breakpoint');
  const primaryRules = [...mobileCss.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, selectors]) => selectors.includes('.preview-toolbar .primary'));

  assert.ok(primaryRules.some(([, , declarations]) => /min-height:\s*40px/.test(declarations)));
  for (const [, , declarations] of primaryRules) {
    assert.doesNotMatch(declarations, /min-height:\s*36px/);
  }
});

test('mobile compact preview and rich-text controls expose 36-pixel touch targets', () => {
  const mobileCss = rawCss.match(/@media\(max-width:620px\)\{([\s\S]*?)\}\s*@media\(prefers-reduced-motion:reduce\)/)?.[1];

  assert.ok(mobileCss, 'mobile breakpoint');
  for (const [selector, pattern] of [
    ['.preview-controls button', /\.preview-controls\s+button(?:\s*,|\s*\{)[^}]*min-width:\s*36px[^}]*min-height:\s*36px/],
    ['.exports button', /\.exports\s+button(?:\s*,|\s*\{)[^}]*min-width:\s*36px[^}]*min-height:\s*36px/],
    ['.rich-toolbar button', /\.rich-toolbar\s+button(?:\s*,|\s*\{)[^}]*min-width:\s*36px[^}]*min-height:\s*36px/]
  ]) {
    assert.match(mobileCss, pattern, selector);
  }
});

test('theme metadata uses Academic Evergreen ink', () => {
  assert.match(html, /<meta name="theme-color" content="#183C34" \/>/);
  assert.match(html, /fill='%23183C34'/);
});

test('preview hint styling cannot recolor primary label or icon descendants', () => {
  assert.doesNotMatch(css, /\.preview-toolbarspan\{/);
  assert.match(css, /\.preview-toolbar>div>span\{[^}]*color:var\(--color-muted\)/);
});

test('all compact actionable families have mobile touch targets', () => {
  const mobileCss = rawCss.match(/@media\(max-width:620px\)\{([\s\S]*?)\}\s*@media\(prefers-reduced-motion:reduce\)/)?.[1];
  const rules = [...mobileCss.matchAll(/([^{}]+)\{([^}]*)\}/g)];
  for (const selector of ['.icon-button', '.text-button', '.question-actions button', '.part-actions button', '.table-buttons button', '.image-settings .secondary', '.choice-actions button', '.add-question', '.preview-controls button', '.exports button', '.rich-toolbar button']) {
    assert.ok(rules.some(([, selectors, declarations]) => selectors.split(',').map(s => s.trim()).includes(selector) && /min-width:36px!important/.test(declarations) && /min-height:36px!important/.test(declarations)), selector);
  }
});

test('labelled upload and blank buttons align their icon and text in one row', () => {
  assert.match(css, /\.upload-area,\.rich-toolbarbutton\[data-rich-command="blank"\]\{display:inline-flex;align-items:center;justify-content:center;gap:8px/);
  assert.match(css, /\.upload-area\{[^}]*width:100%/);
});

test('shared primary padding fits its icon inside the approved 41-pixel height', () => {
  assert.match(css, /\.primary\{[^}]*padding:10px16px;[^}]*line-height:18px/);
});

test('permanent content deletion uses danger text while attachment removal stays ghost', async () => {
  const source = await readFile(new URL('../src/views.js', import.meta.url), 'utf8');
  for (const action of ['delete-project', 'delete-question', 'delete-part', 'option-remove', 'remove-bank', 'remove-table', 'table-remove-row', 'table-remove-column']) {
    const markup = source.match(new RegExp(`button\\('${action}',[^\\n]+?\\),?`))?.[0];
    assert.ok(markup?.includes('delete-text'), action);
  }
  const attachment = source.match(/button\('remove-image',[^\n]+?\)/)?.[0];
  assert.match(attachment, /class="text-button"/);
  assert.doesNotMatch(attachment, /delete-text|danger/);
});

test('template choices are responsive and expose a checked state', () => {
  assert.match(css, /\.template-options\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.template-option:has\(input:checked\)\{[^}]*border-color:var\(--color-primary\)/);
  assert.match(css, /@media\(max-width:620px\)\{[\s\S]*?\.template-options\{[^}]*grid-template-columns:1fr/);
  assert.match(css, /@media\(max-width:620px\)\{[\s\S]*?\.template-option\{[^}]*min-height:36px/);
});

// Supporting copy must remain readable on every surface used by the editor.
test('supporting text meets normal-text contrast on the app surfaces', () => {
  const color = name => css.match(new RegExp(`--color-${name}:(#[0-9a-f]{6})`))[1];
  const luminance = hex => {
    const [r, g, b] = hex.slice(1).match(/../g).map(channel => {
      const value = parseInt(channel, 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const foreground of ['muted', 'support']) {
    for (const background of ['surface', 'canvas', 'outline-rail', 'preview-rail', 'selection']) {
      const values = [color(foreground), color(background)].map(luminance).sort((a, b) => b - a);
      const ratio = (values[0] + 0.05) / (values[1] + 0.05);
      assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(2)}:1`);
    }
  }
});
