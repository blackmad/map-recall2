import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {GL, letters, type Frame} from './nearbar-kit';

test('every glyph is 5 pixels wide and 7 rows (9 with a descender)', () => {
  for (const [ch, rows] of Object.entries(GL)) {
    assert.ok(rows.length === 7 || rows.length === 9, `${ch}: ${rows.length} rows`);
    for (const r of rows) assert.match(r, /^[01]{5}$/, `${ch}: ${r}`);
  }
});

test('the AkzoNobel wordmark has every glyph it needs and draws one solid per pixel run', () => {
  for (const ch of 'AkzoNobel') assert.ok(GL[ch], `missing glyph ${ch}`);
  let solids = 0;
  const b = {add: (_g: T.BufferGeometry) => { solids++; }} as unknown as BuildingTools;
  const f: Frame = {origin: [0, 0], tangent: [1, 0], n: [0, 1]};
  const runs = [...'AkzoNobel'].reduce((s, ch) => s + GL[ch].reduce((t, row) => t + (row.match(/1+/g)?.length ?? 0), 0), 0);
  const width = letters(b, f, 'AkzoNobel', 0, 0, 0, 0.2, 0.1, 'blue');
  assert.equal(solids, runs);
  assert.ok(Math.abs(width - (9 * 6 - 1) * 0.2) < 1e-9);
});

test('the XS4ALL sign and the kpn wordmark (kpn-teleport) have every glyph they need', () => {
  for (const ch of 'XS4ALLkpn') assert.ok(GL[ch], `missing glyph ${ch}`);
  assert.equal(GL.p.length, 9);
});
