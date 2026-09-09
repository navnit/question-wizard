import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { icon, ICON_NAMES, mountIcons } from '../src/icons.js';

const EXPECTED_ICON_NAMES = [
  'archive', 'arrow-down', 'arrow-left', 'arrow-right', 'arrow-up',
  'bold', 'check-circle', 'chevron-left', 'chevron-right', 'copy',
  'eraser', 'file-down', 'file-text', 'hard-drive', 'image', 'image-off',
  'info', 'italic', 'list', 'list-ordered', 'plus', 'redo',
  'refresh', 'subscript', 'superscript', 'text-cursor-input',
  'trash', 'triangle-alert', 'underline', 'undo', 'x',
];

test('approved icons render local accessible currentColor SVG', () => {
  assert.deepEqual(ICON_NAMES, EXPECTED_ICON_NAMES);
  assert.equal(Object.isFrozen(ICON_NAMES), true);
  for (const name of ICON_NAMES) {
    const html = icon(name);
    assert.match(html, /^<svg /);
    assert.match(html, /viewBox="0 0 24 24"/);
    assert.match(html, /fill="none"/);
    assert.match(html, /stroke="currentColor"/);
    assert.match(html, /stroke-width="1\.75"/);
    assert.match(html, /stroke-linecap="round"/);
    assert.match(html, /stroke-linejoin="round"/);
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /focusable="false"/);
    assert.doesNotMatch(html, /https?:|href=|<img/i);
  }
});

test('titled icons are labelled images and escape supplied attributes', () => {
  const html = icon('info', { className: 'detail&quot; onload=&quot;bad', title: 'More & "details"' });
  assert.match(html, /class="icon detail&amp;quot; onload=&amp;quot;bad"/);
  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="More &amp; &quot;details&quot;"/);
  assert.doesNotMatch(html, /aria-hidden/);
});

test('unknown icon names fail rather than silently drawing the wrong symbol', () => {
  assert.throws(() => icon('not-an-action'), /Unknown icon/);
});

test('undo and redo are single mirrored return arrows, not repeat or swap loops', () => {
  for (const [name, head, curve] of [
    ['undo', 'M9 14 4 9l5-5', 'M4 9h10a6 6 0 0 1 0 12h-2'],
    ['redo', 'm15 14 5-5-5-5', 'M20 9H10a6 6 0 0 0 0 12h2'],
  ]) {
    const paths = [...icon(name).matchAll(/<path d="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(paths, [head, curve], `${name}: one arrowhead and one returning stem`);
    assert.equal(paths.join('').match(/[Mm]/g).length, 2, 'no second opposing arrow');
  }
});

test('inherited object names are rejected as unknown icons', () => {
  for (const name of ['toString', 'constructor', '__proto__']) {
    assert.throws(() => icon(name), /Unknown icon/);
  }
});

test('mountIcons hydrates known slots and leaves unknown slots untouched', () => {
  const known = { dataset: { icon: 'copy' }, innerHTML: '' };
  const unknown = { dataset: { icon: 'not-an-action' }, innerHTML: 'keep me' };
  mountIcons({ querySelectorAll: selector => {
    assert.equal(selector, '[data-icon]');
    return [known, unknown];
  } });
  assert.match(known.innerHTML, /^<svg /);
  assert.equal(unknown.innerHTML, 'keep me');
});

test('action surfaces no longer use improvised arrow, multiply or list glyphs', async () => {
  const paths = ['../index.html', '../src/views.js', '../src/rich-editor.js'];
  const source = (await Promise.all(paths.map(path => readFile(new URL(path, import.meta.url), 'utf8')))).join('\n');
  assert.doesNotMatch(source, />\s*(?:←|→|↑|↓|×|↗|↶|↷|▤|◉|• List|1\. List|＋ Blank)\s*</);
});

test('static icons use local slots and icon-only preview controls are labelled and titled', async () => {
  const source = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(source, /data-icon="refresh"/);
  assert.doesNotMatch(source, /<svg\b/i);
  for (const id of ['previous', 'next']) {
    const button = source.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`))?.[0] || '';
    assert.match(button, /class="icon-button"/);
    assert.match(button, /aria-label="[^"]+"/);
    assert.match(button, /title="[^"]+"/);
  }
});

test('initialization hydrates static icon slots', async () => {
  const source = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(source, /mountIcons\(document\)/);
});
