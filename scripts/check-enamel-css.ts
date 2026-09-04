/**
 * Fail if published enamel CSS drifted from hudTheme / chrome source.
 * Run after edits to hudTheme.ts or enamel-chrome.css (or via check:canal).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { enamelCssVariables } from '../src/canalRecall/hudTheme.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokens = readFileSync(path.join(root, 'src/theme/enamel-tokens.css'), 'utf8');
const canal = readFileSync(path.join(root, 'public/canal-drive/css/enamel.css'), 'utf8');
const chrome = readFileSync(path.join(root, 'src/theme/enamel-chrome.css'), 'utf8');
const vars = enamelCssVariables();

for (const [key, value] of Object.entries(vars)) {
  assert.match(tokens, new RegExp(`${key}:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  assert.match(canal, new RegExp(`${key}:\\s*${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
}
assert.ok(canal.includes('.enamel-plaque'), 'canal enamel.css must include plaque chrome');
assert.ok(canal.includes(chrome.trim().slice(0, 40)), 'canal enamel.css must embed enamel-chrome.css');
assert.match(
  readFileSync(path.join(root, 'public/canal-drive/index.html'), 'utf8'),
  /href="css\/enamel\.css"/,
  'Canal index.html must link the shared enamel sheet',
);

process.stdout.write(`enamel CSS in sync (${Object.keys(vars).length} tokens)\n`);
