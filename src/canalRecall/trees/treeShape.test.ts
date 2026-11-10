import assert from 'node:assert/strict';
import test from 'node:test';
import { measureCrown, onPlane, rowOfHeight, columnOfLateral, outlineOf, type ViewGeometry } from './silhouetteMeasure.ts';
import { gameSilhouette } from './gameSilhouette.ts';
import { heightClassRange, crownBase, treeShaper } from './treeShape.ts';
// @ts-expect-error Shared inventory typology is a browser JS module.
import { treeTypology, setTreeShaper } from '../../../public/canal-drive/da-costa-block/tree-typology.js';

const g: ViewGeometry = { width: 400, height: 400, fovDeg: 90, pitchDeg: 30, cameraHeight: 2.5, distance: 12 };

test('pixel rays land on the trunk plane where the inverse projection put them', () => {
  for (const [lat, h] of [[0, 2.5], [3, 10], [-4, 18]]) {
    const v = rowOfHeight(g, h), u = columnOfLateral(g, lat, v), p = onPlane(g, u, v)!;
    assert.ok(Math.abs(p[1] - h) < 0.05, `height ${p[1]} vs ${h}`);
    assert.ok(Math.abs(p[0] - lat) < 0.25, `lateral ${p[0]} vs ${lat}`);
  }
});

test('a synthetic ellipse crown measures back its width, top and base', () => {
  const mask = new Uint8Array(g.width * g.height);
  // Crown: ellipse centred 11 m up, 8 m wide, from 5 m to 17 m, drawn on the plane.
  for (let v = 0; v < g.height; v++) for (let u = 0; u < g.width; u++) {
    const p = onPlane(g, u, v); if (!p) continue;
    if ((p[0] / 4) ** 2 + ((p[1] - 11) / 6) ** 2 <= 1) mask[v * g.width + u] = 1;
  }
  const m = measureCrown(mask, g, { expectedHeight: 17 })!;
  assert.ok(Math.abs(m.top - 17) < 0.3, `top ${m.top}`);
  assert.ok(Math.abs(m.base - 5) < 0.3, `base ${m.base}`);
  assert.ok(Math.abs(m.width - 8) < 0.4, `width ${m.width}`);
  assert.ok(Math.abs(m.widestAt - 11) < 0.8, `widest ${m.widestAt}`);
  assert.equal(m.baseCensored, false);
  assert.equal(outlineOf(m.width, m.top - m.base, (m.widestAt - m.base) / (m.top - m.base)), 'ovoid');
});

test('a neighbour limit caps the width run and marks it', () => {
  const mask = new Uint8Array(g.width * g.height);
  for (let v = 0; v < g.height; v++) for (let u = 0; u < g.width; u++) { const p = onPlane(g, u, v); if (p && p[1] > 4 && p[1] < 15) mask[v * g.width + u] = 1; }
  const m = measureCrown(mask, g, { expectedHeight: 15, leftLimit: -3, rightLimit: 3 })!;
  assert.equal(m.widthCapped, true);
  assert.ok(m.width <= 6.5, `width ${m.width}`);
});

test('the game silhouette of one lobe is its ellipsoid', () => {
  const s = gameSilhouette({ height: 10, rotation: 0, lobes: [{ offset: [0, 7, 0], scale: [2, 3, 2] }] });
  assert.equal(s.top, 10); assert.equal(s.base, 4);
  assert.ok(Math.abs(s.width - 2 * 2 * 0.9) < 0.05, `width ${s.width}`);
});

test('height classes parse to ranges; the crown base follows the class, not a share of height', () => {
  assert.deepEqual(heightClassRange('c. 9 tot 12 m.'), [9, 12]);
  assert.deepEqual(heightClassRange('a. tot 6 m.'), [2, 6]);
  assert.deepEqual(heightClassRange('g. 24 m. en hoger'), [24, 32]);
  assert.equal(heightClassRange('p. Niet te beoordelen'), null);
  assert.ok(crownBase(27, 'g. 24 m. en hoger', 'x') <= 0.55 * 27);
});

test('?treeShape off is byte-identical; on keeps lobe count and fork-relevant axis, and jitters a row', () => {
  const tree = { id: 'ams-1', position: [0, 0], height: 27, heightClass: 'g. 24 m. en hoger', type: 'Boom niet vrij uitgroeiend', species: "Populus nigra 'Italica'" };
  const before = JSON.stringify(treeTypology(tree));
  setTreeShaper(treeShaper);
  const off = JSON.stringify(treeTypology(tree));
  assert.equal(off, before, 'registered but off: unchanged');
  (globalThis as Record<string, unknown>).__canalRecallTreeShape = true;
  try {
    for (const species of ["Populus nigra 'Italica'", "Populus canadensis 'Robusta'", 'Tilia europaea', 'Platanus hispanica']) {
      const a = treeTypology({ ...tree, species }), b = treeTypology({ ...tree, id: 'ams-2', species });
      (globalThis as Record<string, unknown>).__canalRecallTreeShape = false;
      const o = treeTypology({ ...tree, species });
      (globalThis as Record<string, unknown>).__canalRecallTreeShape = true;
      assert.equal(a.lobes.length, o.lobes.length);
      // Forks are drawn for lobes off the trunk axis (> 0.1 m): the shaper must not add any.
      const forks = (t: typeof a) => t.lobes.filter((l: { offset: number[] }) => Math.hypot(l.offset[0], l.offset[2]) > 0.1).length;
      // A corrected archetype brings its own lobes (Robusta: airy-oval, two forks); otherwise none are added.
      if (a.archetype === o.archetype) assert.equal(forks(a), forks(o), species);
      else assert.equal(a.archetype, 'airy-oval', species);
      assert.notEqual(JSON.stringify(a.lobes), JSON.stringify(b.lobes), 'two trees of one row differ');
      assert.ok(a.height >= 24 && a.height <= 32);
    }
  } finally { (globalThis as Record<string, unknown>).__canalRecallTreeShape = undefined; setTreeShaper(null); }
});

test('canopy width from a synthetic CHM: across the row for a row, mean diameter for a lone tree', async () => {
  const { measureCanopy } = await import('./silhouetteMeasure.ts');
  const n = 80, cell = 0.5, chm = new Float32Array(n * n);
  // A row of 10 m wide, 20 m tall crowns every 8 m along east: touching along the row, 10 m across.
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const e = (c + 0.5 - n / 2) * cell, nn = (n / 2 - r - 0.5) * cell;
    for (let k = -3; k <= 3; k++) { const d = Math.hypot(e - k * 8, nn); if (d < 5) chm[r * n + c] = Math.max(chm[r * n + c], 20 - d); }
  }
  const m = measureCanopy({ width: n, height: n, cell, chm }, [1, 0])!;
  assert.ok(Math.abs(m.top - 20) < 0.5, `top ${m.top}`);
  assert.ok(Math.abs(m.width - 10) <= 1, `across ${m.width}`);
  assert.ok(m.along > m.width, 'along the row the crowns run together');
});
