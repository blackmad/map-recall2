import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPrismGrid, buildPrismIndex, pickPrism, pickPrismGrid, prismCandidates, rayPrism } from './prismPick.ts';

const origin = { lng: 4.9, lat: 52.37 };
const kx = 111_320 * Math.cos(origin.lat * Math.PI / 180), ky = 110_540;
/** A square footprint `size` metres across, centred `cx`, `cy` metres from the origin. */
const square = (id: string, cx: number, cy: number, size: number, height: number, minHeight = 0) => {
  const h = size / 2;
  const ring = [[cx - h, cy - h], [cx + h, cy - h], [cx + h, cy + h], [cx - h, cy + h], [cx - h, cy - h]]
    .map(([x, y]) => [origin.lng + x / kx, origin.lat + y / ky]);
  return { geometry: { type: 'Polygon', coordinates: [ring] }, properties: { id, height, minHeight } };
};

test('a horizontal ray hits the nearer wall of the nearer building', () => {
  const index = buildPrismIndex([square('far', 100, 0, 10, 20), square('near', 50, 0, 10, 20)], origin);
  const hit = pickPrism(index, [0, 0, 5], [1, 0, 0]);
  assert.equal(hit?.entry.id, 'near');
  assert.ok(Math.abs(hit!.t - 45) < 0.01, String(hit?.t));
});

test('a ray over a low building reaches the tower behind it', () => {
  const index = buildPrismIndex([square('low', 50, 0, 10, 10), square('tower', 100, 0, 20, 80)], origin);
  assert.equal(pickPrism(index, [0, 0, 30], [1, 0, 0])?.entry.id, 'tower');
});

test('a downward ray hits the roof cap; a ray past the footprint misses', () => {
  const [entry] = buildPrismIndex([square('roof', 0, 0, 10, 12)], origin);
  const t = rayPrism([0, 0, 100], [0, 0, -1], entry);
  assert.ok(t != null && Math.abs(t - 88) < 1e-6);
  assert.equal(rayPrism([20, 0, 100], [0, 0, -1], entry), null);
});

test('a floating part (minHeight) is missed underneath and hit at its height', () => {
  const [entry] = buildPrismIndex([square('part', 50, 0, 10, 99, 83)], origin);
  assert.equal(rayPrism([0, 0, 40], [1, 0, 0], entry), null);
  assert.ok(rayPrism([0, 0, 90], [1, 0, 0], entry) != null);
  assert.ok(rayPrism([0, 0, 130], [1, 0, 0], entry, 45) != null, 'lift raises the prism');
});

test('skip passes over a hidden building to the one behind', () => {
  const index = buildPrismIndex([square('hidden', 50, 0, 10, 20), square('behind', 80, 0, 10, 20)], origin);
  assert.equal(pickPrism(index, [0, 0, 5], [1, 0, 0], () => 0, id => id === 'hidden')?.entry.id, 'behind');
});

let seed = 99;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };

/** A chunk-like block: `n` buildings (squares and L shapes, some floating parts, some on a shared grid edge). */
function block(n: number) {
  const features = [];
  for (let i = 0; i < n; i++) {
    const cx = Math.round(rnd() * 500 - 250), cy = Math.round(rnd() * 500 - 250);
    if (i % 5 === 0) {
      // An L: a polygon with a notch, so walls and caps differ from the box.
      const s = 8 + rnd() * 20;
      const ring = [[0, 0], [s, 0], [s, s / 2], [s / 2, s / 2], [s / 2, s], [0, s], [0, 0]]
        .map(([x, y]) => [origin.lng + (cx + x) / kx, origin.lat + (cy + y) / ky]);
      features.push({ geometry: { type: 'Polygon', coordinates: [ring] }, properties: { id: `l${i}`, height: 5 + rnd() * 30 } });
    } else features.push(square(`b${i}`, cx, cy, 4 + rnd() * 30, 4 + rnd() * 40, i % 7 === 0 ? 10 + rnd() * 10 : 0));
  }
  // Duplicates: two prisms with the same box, so ties are decided by index order.
  features.push(square('dup-a', 32, 32, 16, 20), square('dup-b', 32, 32, 16, 20));
  return buildPrismIndex(features, origin);
}

test('the grid finds exactly what pickPrism finds (entry and t), with lifts and skips', () => {
  const index = block(600);
  for (const cell of [8, 32, 100]) {
    const grid = buildPrismGrid(index, cell);
    const lifts = new Map(index.map(e => [e.id, rnd() < 0.3 ? rnd() * 7 - 2 : 0]));
    const liftOf = (id: string) => lifts.get(id) ?? 0;
    const skip = (id: string) => id.endsWith('3');
    let hits = 0;
    for (let i = 0; i < 4000; i++) {
      const kind = i % 6;
      let o: [number, number, number], d: [number, number, number];
      if (kind === 0) { o = [rnd() * 800 - 400, rnd() * 800 - 400, 300]; d = [rnd() - 0.5, rnd() - 0.5, -1]; } // aerial
      else if (kind === 1) { o = [rnd() * 600 - 300, rnd() * 600 - 300, 1.6 + rnd() * 10]; d = [rnd() - 0.5, rnd() - 0.5, (rnd() - 0.6) * 0.1]; } // chase, grazing
      else if (kind === 2) { o = [rnd() * 600 - 300, rnd() * 600 - 300, 200]; d = [0, 0, -1]; } // vertical
      else if (kind === 3) { o = [-400, Math.round(rnd() * 500 - 250), 5]; d = [1, 0, 0]; } // axis-aligned, on cell rows
      else if (kind === 4) { o = [Math.round(rnd() * 500 - 250), -400, 5 + rnd() * 20]; d = [0, 1, 0.01]; }
      else { o = [rnd() * 2000 - 1000, rnd() * 2000 - 1000, rnd() * 600 - 100]; d = [rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]; } // anywhere
      const len = Math.hypot(...d); d = [d[0] / len, d[1] / len, d[2] / len];
      const a = pickPrism(index, o, d, liftOf, skip), b = pickPrismGrid(grid, o, d, liftOf, skip, -2, 5);
      assert.equal(b?.entry.id, a?.entry.id, `cell ${cell} ray ${i}`);
      assert.equal(b?.t, a?.t, `cell ${cell} ray ${i}`);
      if (a) hits++;
    }
    assert.ok(hits > 800, `enough hits to mean something (${hits})`);
  }
  // Ties go to the earlier entry, as in pickPrism.
  const grid = buildPrismGrid(index, 32);
  assert.equal(pickPrismGrid(grid, [32, 32, 100], [0, 0, -1])?.entry.id, 'dup-a');
});

test('a steep ray reads a handful of cells, not the chunk', () => {
  const index = block(600);
  const grid = buildPrismGrid(index, 32);
  const n = prismCandidates(grid, [0, 0, 300], [0.3, 0.2, -0.93]).length;
  assert.ok(n < index.length / 10, `${n} candidates of ${index.length}`);
  assert.equal(prismCandidates(grid, [0, 0, 300], [0, 0, 1]).length, 0, 'a ray up and away meets nothing');
});
