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

test('alongRingPlacements centres a run on the nearest vertex and walks the edges left to right from outside', async () => {
  const {alongRingPlacements, ringFrame} = await import('./nearbar-kit');
  // a 10 x 10 square, native x east, z south
  const ring = [[0, 0], [10, 0], [10, 10], [0, 10]];
  const {ordered, at} = alongRingPlacements(ring, [10, 0], [2, 2, 2]);
  assert.equal(at.length, 3);
  // the middle item sits on the corner nearest (10, 0): t = 0 on the edge leaving it, or the end of the edge before it
  const mid = ringFrame(ordered, at[1].edge).f;
  const p = [mid.origin[0] + mid.tangent[0] * at[1].t, mid.origin[1] + mid.tangent[1] * at[1].t];
  assert.ok(Math.hypot(p[0] - 10, p[1] - 0) < 1e-9, `middle item at ${p}`);
  // items run 2 m apart along the perimeter
  const pos = at.map(a => { const f = ringFrame(ordered, a.edge).f; return [f.origin[0] + f.tangent[0] * a.t, f.origin[1] + f.tangent[1] * a.t]; });
  assert.ok(Math.abs(Math.hypot(pos[0][0] - pos[1][0], pos[0][1] - pos[1][1]) - 2) < 1e-9);
  assert.ok(Math.abs(Math.hypot(pos[2][0] - pos[1][0], pos[2][1] - pos[1][1]) - 2) < 1e-9);
});
