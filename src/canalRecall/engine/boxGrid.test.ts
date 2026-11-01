import assert from 'node:assert/strict';
import test from 'node:test';
import { BoxGrid, type Box } from './boxGrid';

test('BoxGrid.at: the linear scan\'s answer in the same order, for random boxes, edge points and oversize boxes', () => {
  let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const items: { id: number; box: Box | null }[] = [];
  for (let i = 0; i < 3000; i++) {
    const x = 4.85 + rnd() * 0.1, y = 52.34 + rnd() * 0.06, w = rnd() < 0.01 ? 0.05 : rnd() * 0.002, h = rnd() * 0.0015;
    items.push({ id: i, box: rnd() < 0.02 ? null : [x, y, x + w, y + h] });
  }
  const boxOf = (t: { box: Box | null }) => t.box;
  const grid = new BoxGrid(items, boxOf);
  const scan = (lng: number, lat: number) => items.filter(t => t.box && lng >= t.box[0] && lng <= t.box[2] && lat >= t.box[1] && lat <= t.box[3]);
  const points: [number, number][] = [];
  for (let i = 0; i < 4000; i++) points.push([4.85 + rnd() * 0.1, 52.34 + rnd() * 0.06]);
  for (const t of items.slice(0, 300)) if (t.box) points.push([t.box[0], t.box[1]], [t.box[2], t.box[3]], [t.box[0], t.box[3]]);
  let hits = 0;
  for (const [lng, lat] of points) {
    const want = scan(lng, lat).map(t => t.id), got = grid.at(lng, lat, items).map(t => t.id);
    assert.deepEqual(got, want, `${lng},${lat}`);
    hits += want.length;
  }
  assert.ok(hits > 1000, 'the points hit boxes');
});
