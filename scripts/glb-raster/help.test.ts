import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HELP as VIEWS_HELP } from './views.ts';
import { HELP as AGREEMENT_HELP } from './agreement.ts';

test('docs/house-line.md §8 carries the glb:views and glb:agreement HELP texts verbatim', () => {
  const doc = fs.readFileSync('docs/house-line.md', 'utf8');
  assert.ok(doc.includes(VIEWS_HELP), 'scripts/glb-raster/views.ts HELP');
  assert.ok(doc.includes(AGREEMENT_HELP), 'scripts/glb-raster/agreement.ts HELP');
});
