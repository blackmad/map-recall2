import assert from 'node:assert/strict';
import test from 'node:test';
import { placeRoadShields, sampleScreenLine, type ShieldAnchor } from './roadShieldPlacement';

const W = 1512, H = 982;
/** A road across the screen at height y, sampled every 40 px, as the adapter samples it. */
const road = (ref: string, y: number, x0 = 0, x1 = W): ShieldAnchor[] =>
  sampleScreenLine([{ x: x0, y }, { x: x1, y }], 40).map(p => ({ ref, ...p }));
const count = (placed: ShieldAnchor[]) => placed.reduce<Record<string, number>>((o, a) => { o[a.ref] = (o[a.ref] ?? 0) + 1; return o; }, {});

test('one shield per ref along a stretch, nearest the centre (the Sloterdijk A10 / A5 / S101 shot)', () => {
  // A10 and A5 concurrent on one road, both carriageways and several way pieces (duplicated anchors); S101 crossing.
  const anchors = [
    ...road('A10', 400), ...road('A10', 412), ...road('A10', 400, 300, 900),
    ...road('A5', 401), ...road('A5', 411),
    ...sampleScreenLine([{ x: 1100, y: 0 }, { x: 1180, y: H }], 40).map(p => ({ ref: 'S101', ...p })),
  ];
  const placed = placeRoadShields(anchors, [], { width: W, height: H });
  assert.deepEqual(count(placed), { A10: 1, A5: 1, S101: 1 });
  const a10 = placed.find(a => a.ref === 'A10')!;
  assert.ok(Math.abs(a10.x - W / 2) <= 40, `A10 near the centre: ${a10.x}`);
  const a5 = placed.find(a => a.ref === 'A5')!;
  assert.ok(Math.hypot(a5.x - a10.x, a5.y - a10.y) >= 44, 'concurrent refs sit apart, not on top of each other');
});

test('a ref keeps the minimum spacing; two stretches far apart each get one', () => {
  const wide = 3000;
  const placed = placeRoadShields(road('S100', 300, 0, wide), [], { width: wide, height: H });
  assert.ok(placed.length >= 2 && placed.length <= 3, String(placed.length));
  for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) {
    assert.ok(Math.hypot(placed[i].x - placed[j].x, placed[i].y - placed[j].y) >= 1000);
  }
  // Two separate stretches of the ring more than 1000 px apart: one each.
  const two = placeRoadShields([...road('S100', 60, 0, 200), ...road('S100', 940, 1300, W)], [], { width: W, height: H });
  assert.equal(two.length, 2);
  // At 600 px the centre one and one at each side (756 ± 600).
  const tight = placeRoadShields(road('S100', 300), [], { width: W, height: H, minSpacingPx: 600 });
  assert.equal(tight.length, 3);
});

test('hysteresis: last plan\'s shield stays put while it is on screen and on its road', () => {
  const first = placeRoadShields(road('A10', 400), [], { width: W, height: H });
  assert.equal(first.length, 1);
  // Pan 300 px left: the old shield moves with the ground to x - 300; the centre now has a nearer anchor.
  const panned = road('A10', 400).map(a => ({ ...a, x: a.x - 300 })).concat(road('A10', 400, W - 300, W));
  const prev = first.map(a => ({ ...a, x: a.x - 300 }));
  const next = placeRoadShields(panned, prev, { width: W, height: H });
  assert.equal(next.length, 1);
  assert.equal(next[0], prev[0], 'kept, not re-chosen at the new centre');
  // Without the previous winner it would have jumped to the centre.
  const fresh = placeRoadShields(panned, [], { width: W, height: H });
  assert.ok(Math.abs(fresh[0].x - W / 2) <= 40);
});

test('a kept shield goes when it leaves the screen or its road', () => {
  const prev = [{ ref: 'A10', x: 10, y: 400 }];
  const next = placeRoadShields(road('A10', 400), prev, { width: W, height: H });
  assert.equal(next.length, 1);
  assert.notEqual(next[0], prev[0]);
  const offRoad = [{ ref: 'A10', x: W / 2, y: 700 }];
  const n2 = placeRoadShields(road('A10', 400), offRoad, { width: W, height: H });
  assert.equal(n2.length, 1);
  assert.equal(n2[0].y, 400);
});

test('nothing on screen, nothing placed; deterministic for equal input', () => {
  assert.deepEqual(placeRoadShields(road('A10', -50), [], { width: W, height: H }), []);
  const a = placeRoadShields([...road('A10', 400), ...road('A5', 400)], [], { width: W, height: H });
  const b = placeRoadShields([...road('A5', 400), ...road('A10', 400)], [], { width: W, height: H });
  assert.deepEqual(a.map(s => [s.ref, s.x, s.y]), b.map(s => [s.ref, s.x, s.y]));
});

test('sampleScreenLine keeps the step across vertices and includes both ends', () => {
  const pts = sampleScreenLine([{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 50 }], 40);
  assert.deepEqual(pts.map(p => [Math.round(p.x), Math.round(p.y)]), [[0, 0], [30, 10], [30, 50], [30, 50]]);
});
