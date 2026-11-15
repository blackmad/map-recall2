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

test('diamondLatticeRows: symmetric nested diamonds, not one X', async () => {
  const {diamondLatticeRows} = await import('./nearbar-kit');
  const p = diamondLatticeRows(13, 17);
  assert.equal(p.length, 17);
  for (const r of p) { assert.equal(r.length, 13); assert.equal(r, [...r].reverse().join(''), 'left-right symmetric'); }
  // the centre cell is the tile centre (distance 0): on; its 4-neighbours (distance 1): off; distance 3: on
  assert.equal(p[8][6], '1'); assert.equal(p[8][7], '0'); assert.equal(p[8][9], '1'); assert.equal(p[5][6], '1');
  // a lattice has many separate runs per row, an X glyph at most two
  assert.ok(p.filter(r => (r.match(/1+/g)?.length ?? 0) > 2).length >= 5);
});

test('patternPanel draws the ground slab plus one solid per run', async () => {
  const {patternPanel} = await import('./nearbar-kit');
  let solids = 0;
  const b = {add: () => { solids++; }} as unknown as BuildingTools;
  const f: Frame = {origin: [0, 0], tangent: [1, 0], n: [0, 1]};
  const n = patternPanel(b, f, 0, 0, 2, 2, ['101', '010'], 'white', 'red');
  assert.equal(n, 3); assert.equal(solids, 4);
});

test('domePanes: one UV 0..1 pane per cell, every face facing out of the sphere', async () => {
  const {domePanes} = await import('./pool-kit');
  const Rs = 20, cy = -5, g = domePanes([3, 4], Rs, cy, 0.9, 12, 4);
  const pos = g.getAttribute('position'), uv = g.getAttribute('uv');
  // triangles: apex row 12, other rows 2 x 12 x 3
  assert.equal(pos.count / 3, 12 + 2 * 12 * 3);
  for (let i = 0; i < pos.count; i += 3) {
    const a = new T.Vector3().fromBufferAttribute(pos, i), b2 = new T.Vector3().fromBufferAttribute(pos, i + 1), c = new T.Vector3().fromBufferAttribute(pos, i + 2);
    const n = new T.Vector3().subVectors(b2, a).cross(new T.Vector3().subVectors(c, a));
    const centre = new T.Vector3().add(a).add(b2).add(c).divideScalar(3).sub(new T.Vector3(3, cy, 4));
    assert.ok(n.dot(centre) > 0, `triangle ${i / 3} faces inward`);
  }
  for (let i = 0; i < uv.count; i++) { assert.ok(uv.getX(i) >= 0 && uv.getX(i) <= 1 && uv.getY(i) >= 0 && uv.getY(i) <= 1); }
});

test('solarRows: rows inside the field, a pitch apart, along the asked axis', async () => {
  const {solarRows} = await import('./pool-kit');
  const rows = solarRows([[0, 0], [10, 0], [10, 6], [0, 6]], {depth: 1, pitch: 2, inset: 0.5});
  assert.equal(rows.length, 2); // v 1.01 and 3.01; 5.01 + 0.5 is past the inset edge 5.5
  for (const r of rows) { assert.ok(Math.abs(r.p0[1] - r.p1[1]) < 1e-9); assert.ok(r.p0[0] >= 0.49 && r.p1[0] <= 9.51); }
  assert.ok(Math.abs(rows[1].p0[1] - rows[0].p0[1] - 2) < 1e-9);
  const zr = solarRows([[0, 0], [4, 0], [4, 10], [0, 10]], {along: 'z', depth: 1, pitch: 1.5});
  for (const r of zr) assert.ok(Math.abs(r.p0[0] - r.p1[0]) < 1e-9);
  // an L-shaped field splits a scanline into two rows
  const L = solarRows([[0, 0], [10, 0], [10, 3], [6, 3], [6, 6], [4, 6], [4, 3], [0, 3]].reverse(), {depth: 0.5, pitch: 1, minRun: 1});
  assert.ok(L.some(r => r.p0[0] >= 3.9 && r.p1[0] <= 6.1));
});

test('solarField: grounded closed wedges on the roof, none where there is no roof', async () => {
  const {solarField} = await import('./pool-kit');
  const geoms: T.BufferGeometry[] = [];
  const b = {add: (g: T.BufferGeometry) => { geoms.push(g); }} as unknown as BuildingTools;
  const n = solarField(b, [[0, 0], [10, 0], [10, 6], [0, 6]], (x) => (x < 20 ? 8 : null), 'dark', {depth: 1, pitch: 2});
  assert.equal(n, geoms.length); assert.ok(n >= 2);
  for (const g of geoms) { g.computeBoundingBox(); assert.ok(Math.abs(g.boundingBox!.min.y - 7.95) < 1e-6); assert.ok(g.boundingBox!.max.y > 8.2); }
  const geoms2: T.BufferGeometry[] = [];
  assert.equal(solarField({add: (g: T.BufferGeometry) => geoms2.push(g)} as unknown as BuildingTools, [[0, 0], [10, 0], [10, 6], [0, 6]], () => null, 'dark'), 0);
});

test('solarRows angleDeg: rows parallel to a turned field', async () => {
  const {solarRows} = await import('./pool-kit');
  const a = (30 * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  // a 10 x 4 rectangle turned 30 deg clockwise in plan (x toward z)
  const sq = [[0, 0], [10, 0], [10, 4], [0, 4]].map(([x, z]) => [x * c - z * s, x * s + z * c]);
  const rows = solarRows(sq, {angleDeg: 30, depth: 1, pitch: 1.5});
  assert.ok(rows.length >= 2);
  for (const r of rows) { const d = Math.atan2(r.p1[1] - r.p0[1], r.p1[0] - r.p0[0]); assert.ok(Math.abs(Math.abs(Math.sin(d - a))) < 1e-6, `row at ${d}`); assert.ok(Math.hypot(r.p1[0] - r.p0[0], r.p1[1] - r.p0[1]) > 9); }
});
