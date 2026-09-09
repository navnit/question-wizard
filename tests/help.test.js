import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowHelp, dismissHelp } from '../src/help.js';

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('first visit shows help, and dismissal survives another visit', () => {
  const device = storage();
  assert.equal(shouldShowHelp(device), true);
  dismissHelp(device);
  assert.equal(shouldShowHelp(device), false);
  assert.equal(shouldShowHelp(storage()), true);
});

test('unavailable storage does not prevent opening or dismissing help', () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(shouldShowHelp(blocked), true);
  assert.doesNotThrow(() => dismissHelp(blocked));
});

test('Help starts at the relevant screen and full replay starts at the beginning', async () => {
  const { helpStartStep } = await import('../src/help.js');
  assert.equal(helpStartStep('library'), 0);
  assert.equal(helpStartStep('details'), 1);
  assert.equal(helpStartStep('question'), 2);
  assert.equal(helpStartStep('question', true), 0);
  assert.equal(helpStartStep('unknown'), 0);
});

test('unrecognized screen names always fall back to the opening step', async () => {
  const { helpStartStep } = await import('../src/help.js');
  for (const screen of ['constructor', 'toString', '__proto__', undefined]) {
    assert.equal(helpStartStep(screen), 0);
  }
});
