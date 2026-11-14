// Window grids on overlapping boxes (wallGrid.ts; feedback a4013653 / 10ada6d9, the Pontsteiger chequer).
//   node --import tsx --test src/canalRecall/landmarks/wallGrid.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {type GridBox, type Pane, boxAabb, gridAabb, planWallGrids} from './wallGrid';

/** The loops grid() ran before wallGrid.ts, verbatim. */
function legacy(g: GridBox): Pane[] {
  const {x, y, z, width, height, depth, step} = g, out: Pane[] = [];
  for (let v = y + 1.2; v < y + height - 1.3; v += 3.4) {
    for (let u = -width / 2 + 1.5; u < width / 2 - 1; u += step) for (const s of [-1, 1]) out.push({x: x + u, y: v, z: z + s * (depth / 2 + .05), w: step * .6, h: 1.9, d: .12});
    for (let u = -depth / 2 + 1.5; u < depth / 2 - 1; u += step) for (const s of [-1, 1]) out.push({x: x + s * (width / 2 + .05), y: v, z: z + u, w: .12, h: 1.9, d: step * .6});
  }
  return out;
}

const inside = (p: Pane, g: GridBox, eps = 0.01) => {
  const b = gridAabb(g), cx = p.x, cz = p.z, cy = p.y + p.h / 2;
  return cx > b.x0 - eps && cx < b.x1 + eps && cz > b.z0 - eps && cz < b.z1 + eps && cy > b.y0 && cy < b.y1;
};

test('a lone box, and boxes that do not touch, keep exactly the panes and order grid() always drew', () => {
  const a: GridBox = {x: 0, y: 0, z: 0, width: 40, height: 31, depth: 30, step: 5};
  const b: GridBox = {x: 60, y: 7, z: 10, width: 12.3, height: 21, depth: 8.7, step: 3.7};
  assert.deepEqual(planWallGrids([a], []), [legacy(a)]);
  assert.deepEqual(planWallGrids([a, b], [boxAabb(0, 31, 0, 40, 4, 30)]), [legacy(a), legacy(b)]);
});

test('named regression (Pontsteiger 2026-11-14): coplanar leg and skybridge share one grid, no chequer, no doubled column', () => {
  // The pre-2026-11-14 Pontsteiger: w 89.26, d 87.18; legs, front bar and bridge as grid() boxes.
  const w = 89.26, d = 87.18, leg = w * .19, span = w * .96, rear = -d * .29;
  const grids: GridBox[] = [];
  for (const x of [-span / 2 + leg / 2, span / 2 - leg / 2]) {
    grids.push({x, y: 7, z: 0, width: leg, height: 21, depth: d * .95, step: 3.7});
    grids.push({x, y: 28, z: rear, width: leg, height: 61, depth: d * .31, step: 3.7});
  }
  grids.push({x: 0, y: 7, z: d * .38, width: span, height: 21, depth: d * .18, step: 3.7});
  grids.push({x: 0, y: 61, z: rear, width: span, height: 28, depth: d * .31, step: 3.7});
  const plan = planWallGrids(grids, []);
  const all = plan.flat();
  // No two panes on one wall plane overlap (a chequer is two phases overlapping).
  const key = (p: Pane) => (p.d < p.w ? `z${p.z.toFixed(2)}` : `x${p.x.toFixed(2)}`);
  const byPlane = new Map<string, Pane[]>();
  for (const p of all) byPlane.set(key(p), [...(byPlane.get(key(p)) ?? []), p]);
  for (const [k, ps] of byPlane) for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i], b = ps[j], along = k[0] === 'z' ? [a.x, a.w, b.x, b.w] : [a.z, a.d, b.z, b.d];
    const ou = Math.min(along[0] + along[1] / 2, along[2] + along[3] / 2) - Math.max(along[0] - along[1] / 2, along[2] - along[3] / 2);
    const ov = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    assert.ok(!(ou > 1e-6 && ov > 1e-6), `overlapping panes on ${k} at ${a.x.toFixed(2)},${a.y.toFixed(2)} and ${b.x.toFixed(2)},${b.y.toFixed(2)}`);
  }
  // Both legs' and the bridge's back face: one row phase across the shared plane (rows 3.4 m apart from one foot).
  const back = all.filter(p => p.d < p.w && Math.abs(p.z - (rear - d * .155 - .05)) < .01);
  const ys = [...new Set(back.map(p => +p.y.toFixed(6)))].sort((a, b) => a - b);
  for (const y of ys) assert.ok(Math.abs(((y - ys[0]) / 3.4) - Math.round((y - ys[0]) / 3.4)) < 1e-6, `row ${y} off the shared phase`);
  const xs = [...new Set(back.map(p => +p.x.toFixed(6)))].sort((a, b) => a - b);
  for (const x of xs) assert.ok(Math.abs(((x - xs[0]) / 3.7) - Math.round((x - xs[0]) / 3.7)) < 1e-6, `column ${x} off the shared phase`);
  // The legs' inner side faces where the bridge wraps them, and the bar's front behind the legs, are not glazed.
  const bridge = grids[5];
  for (const p of plan[1].concat(plan[3])) assert.ok(!(p.d > p.w && p.y > bridge.y && Math.abs(Math.abs(p.x) - (span / 2 - leg)) < .1), 'leg side face glazed inside the bridge');
  const barFront = d * .38 + d * .09 + .05;
  for (const p of plan[4]) if (Math.abs(p.z - barFront) < .01) assert.ok(Math.abs(p.x) < span / 2 - leg, `bar pane at x ${p.x.toFixed(2)} behind a leg`);
  // A pane belongs to one box face: none floats in mid-air off its own box.
  plan.forEach((ps, i) => ps.forEach(p => assert.ok(inside(p, grids[i], .2), `pane off box ${i}`)));
});

test('a box in front of a face drops the panes it hides; a thin band across them does not', () => {
  const g: GridBox = {x: 0, y: 0, z: 0, width: 20, height: 10, depth: 10, step: 4};
  const lobby = boxAabb(0, 0, 5.4, 20, 3.5, 2); // glass entrance box standing 0.4 m proud of the front
  const front = (ps: Pane[]) => ps.filter(p => p.d < p.w && p.z > 0);
  const kept = front(planWallGrids([g], [lobby])[0]);
  assert.ok(kept.length > 0 && kept.every(p => p.y > 3), 'row behind the lobby dropped, upper rows kept');
  const band = boxAabb(0, 4.8, 5.1, 20, .26, .26);
  assert.equal(front(planWallGrids([g], [band])[0]).length, front(legacy(g)).length);
  // A box well behind the face (inside the body) hides nothing.
  assert.deepEqual(planWallGrids([g], [boxAabb(0, 0, 0, 10, 16, 6)]), [legacy(g)]);
});

test('a face buried inside another grid box is not glazed', () => {
  const big: GridBox = {x: 0, y: 0, z: 0, width: 40, height: 15, depth: 20, step: 5};
  const wing: GridBox = {x: 15, y: 0, z: 12, width: 8, height: 12, depth: 10, step: 4}; // its back half is inside big
  const [, wingPanes] = planWallGrids([big, wing], []);
  assert.ok(wingPanes.every(p => !(p.d < p.w && p.z < 10)), 'wing back face is inside the big box');
  assert.ok(wingPanes.every(p => !(p.d > p.w && p.z < 10 - .5)), 'wing side panes stop at the big box front');
});
