import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RIDING_PROMPT_CSS, RIDING_PROMPT_STYLE_ID, installRidingPromptStyles, ridingPromptStyleBlock,
} from './ridingPromptStyles.ts';

/** Just enough of a Document for the installer: elements by id, a head. */
function fakeDocument(existing: string | null) {
  const appended: Array<{ id: string; textContent: string }> = [];
  const doc = {
    getElementById: (id: string) => (existing === id || appended.some(el => el.id === id) ? {} : null),
    createElement: () => ({ id: '', textContent: '' }),
    head: { appendChild: (el: { id: string; textContent: string }) => { appended.push(el); } },
  };
  return { doc: doc as unknown as Document, appended };
}

test('without a stylesheet block the runtime injects the rules once', () => {
  const { doc, appended } = fakeDocument(null);
  installRidingPromptStyles(doc);
  installRidingPromptStyles(doc);
  assert.equal(appended.length, 1);
  assert.equal(appended[0].id, RIDING_PROMPT_STYLE_ID);
  assert.equal(appended[0].textContent, RIDING_PROMPT_CSS);
});

test('a page that carries the block is left alone', () => {
  const { doc, appended } = fakeDocument(RIDING_PROMPT_STYLE_ID);
  installRidingPromptStyles(doc);
  assert.equal(appended.length, 0);
});

test('the pasteable block uses the id the runtime checks', () => {
  const block = ridingPromptStyleBlock();
  assert.ok(block.startsWith(`<style id="${RIDING_PROMPT_STYLE_ID}">`));
  assert.ok(block.endsWith('</style>'));
  assert.ok(!RIDING_PROMPT_CSS.includes('</style'), 'the CSS cannot close the element it sits in');
});

test('a block in index.html, once pasted, matches the source', () => {
  const html = readFileSync(new URL('../../../public/canal-drive/index.html', import.meta.url), 'utf8');
  const match = html.match(new RegExp(`<style id="${RIDING_PROMPT_STYLE_ID}">([\\s\\S]*?)</style>`));
  if (!match) return; // not pasted yet: the runtime injects the same rules
  assert.equal(match[1], RIDING_PROMPT_CSS, 'index.html riding-prompt block drifted from ridingPromptStyles.ts');
});
