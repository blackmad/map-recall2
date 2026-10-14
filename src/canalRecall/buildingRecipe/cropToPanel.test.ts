import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exposedWalls} from '../../../scripts/pand-reference/select.ts';
import {pointInRing} from '../../../scripts/pand-reference/core.ts';
import {bestCropForPanel, cropFrame, matchCropToPanel, type CropWall, type PanelPlan, type Xy} from './cropToPanel.ts';

// An L footprint (RD metres), given clockwise on purpose: exposedWalls makes it counter-clockwise first.
const L = [[0, 0], [0, 20], [10, 20], [10, 8], [30, 8], [30, 0], [0, 0]].map(([x, y]) => ({x: 1000 + x, y: 2000 + y}));
const anchor: Xy = [1000, 2000];

/** A panel lying exactly on a footprint edge (local frame: x east, z south; r = viewer's right). */
function panelOn(a: Xy, b: Xy, index = 0, shiftM = 0, flip = false): PanelPlan {
  const {t, n, len} = cropFrame(a, b), s = flip ? -1 : 1;
  const start: Xy = flip ? b : a;
  return {index, o: [start[0] - anchor[0] + n[0] * shiftM, 0, -(start[1] - anchor[1] + n[1] * shiftM)], r: [s * t[0], 0, -s * t[1]], n: [s * n[0], 0, -s * n[1]], uMin: 0, uMax: len};
}
const crop = (a: Xy, b: Xy, tag = 'w01'): CropWall => ({tag, file: `${tag}.jpg`, a, b, normal: cropFrame(a, b).n, ppm: 50, widthPx: 100, heightPx: 100, wallHeightM: 10, baseZ: 0});

test('exposedWalls on an L footprint: normals point outward and a -> b runs to the viewer\'s right', () => {
  const walls = exposedWalls({id: 'x', ring: L, height: 10}, []);
  assert.equal(walls.length, 6);
  for (const w of walls) {
    const out = {x: w.mid.x + w.nx, y: w.mid.y + w.ny}, inside = {x: w.mid.x - w.nx, y: w.mid.y - w.ny};
    assert.equal(pointInRing(out, L), false, `outward ${JSON.stringify(w.mid)}`);
    assert.equal(pointInRing(inside, L), true, `inward ${JSON.stringify(w.mid)}`);
    // facing the wall from outside (looking along -n), the viewer's right is (-ny, nx); the crop's x runs a -> b
    const {t} = cropFrame([w.a.x, w.a.y], [w.b.x, w.b.y]);
    assert.ok(Math.abs(t[0] - -w.ny) < 1e-9 && Math.abs(t[1] - w.nx) < 1e-9);
  }
  // the south wall (y = 2000, x 1000..1030) faces south and runs west -> east for a viewer standing south of it
  const south = walls.find(w => Math.abs(w.mid.y - 2000) < 1e-6)!;
  assert.ok(south.ny < -0.99 && south.b.x > south.a.x);
});

test('matchCropToPanel: exact panel matches with increasing along, opposite face, offset and angle are refused', () => {
  const walls = exposedWalls({id: 'x', ring: L, height: 10}, []);
  const south = walls.find(w => Math.abs(w.mid.y - 2000) < 1e-6)!, a: Xy = [south.a.x, south.a.y], b: Xy = [south.b.x, south.b.y];
  const m = matchCropToPanel(crop(a, b), panelOn(a, b), anchor);
  assert.equal(m.relation, 'match');
  assert.ok(Math.abs(m.alongAtUMin) < 1e-6 && Math.abs(m.alongAtUMax - 30) < 1e-6, JSON.stringify(m));
  assert.equal(matchCropToPanel(crop(a, b), panelOn(a, b, 0, 0, true), anchor).relation, 'facing');
  assert.equal(matchCropToPanel(crop(a, b), panelOn(a, b, 0, 0.7), anchor).relation, 'offset');
  assert.equal(matchCropToPanel(crop(a, b), panelOn(a, b, 0, 0.4), anchor).relation, 'match');
  const tilted = panelOn(a, [b[0], b[1] + 3]);
  assert.equal(matchCropToPanel(crop(a, b), tilted, anchor).relation, 'angle');
  // a panel on half of the wall: overlap 100 % of the panel, along 15..30
  const half = matchCropToPanel(crop(a, b), panelOn([a[0] + 15, a[1]], b), anchor);
  assert.equal(half.relation, 'match'); assert.ok(Math.abs(half.alongAtUMin - 15) < 1e-6);
  // a crop of a third of the panel: overlap 33 % < 60 %
  assert.equal(matchCropToPanel(crop(a, [a[0] + 10, a[1]]), panelOn(a, b), anchor).relation, 'overlap');
  // the east wall's crop does not match the south panel; bestCropForPanel picks the south crop
  const east = walls.find(w => Math.abs(w.mid.x - 1030) < 1e-6)!;
  const best = bestCropForPanel([crop([east.a.x, east.a.y], [east.b.x, east.b.y], 'east'), crop(a, b, 'south')], panelOn(a, b), anchor);
  assert.equal(best?.crop.tag, 'south');
});
