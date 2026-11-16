// Shop props kit (lane shop-goods-20261116): stated costs, footprints, determinism and per-bay variety.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bakfiets, barberStation, bike, bucketTier, bucketTierCost, counter, crate, plant, PROP_COST, rail, washBasin } from './props.js';
import { insideProps, outsideProps, SHOP_PROPS } from './layout.js';
import { goodsTileRect } from './variety.js';

test('shop props: each builder costs what PROP_COST states', () => {
  assert.equal(bike('#1a1a1a').length, PROP_COST.bike);
  assert.equal(bike('#1a1a1a', true).length, PROP_COST.bike);
  assert.equal(bakfiets('#8a6a44').length, PROP_COST.bakfiets);
  assert.equal(rail(2).length, PROP_COST.rail);
  assert.equal(crate('apples').length, PROP_COST.crate);
  assert.equal(crate('apples', false).length, PROP_COST.crateNoCard);
  assert.equal(plant('#3d6b35').length, PROP_COST.plant);
  assert.equal(plant('#3d6b35', '#a0522d', true).length, PROP_COST.plantTall);
  assert.equal(barberStation('#7a1f2b').length, PROP_COST.barberStation);
  assert.equal(washBasin().length, PROP_COST.washBasin);
  assert.equal(counter(1.1, '#e8e4dc').length, PROP_COST.counter);
  for (const w of [0.6, 1.2]) assert.equal(bucketTier(w, 's').length, bucketTierCost(w));
});

test('shop props: a bike is a real bike: two wheels a wheelbase apart, a frame between, a bar across', () => {
  const t = bike('#9c2a26'), xs = t.flatMap(q => q.p.map(p => p[0])), ys = t.flatMap(q => q.p.map(p => p[1])), zs = t.flatMap(q => q.p.map(p => p[2]));
  assert.ok(Math.max(...xs) - Math.min(...xs) > 1.6 && Math.max(...xs) - Math.min(...xs) < 1.8, 'about 1.74 m long');
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.5, 'the handlebar stands across');
  assert.ok(Math.min(...zs) < 0.03 && Math.max(...zs) > 0.95 && Math.max(...zs) < 1.1, 'tyres on the ground, bar about 1 m up');
  assert.ok(t.some(q => q.hex === '#9c2a26'), 'the frame in its colour');
});

test('shop props: placement is deterministic, stays in its runs and slots, and varies per bay', () => {
  const runs: Array<[number, number]> = [[0.4, 4.0], [5.2, 6.2]];
  for (const [tpl, spec] of Object.entries(SHOP_PROPS)) {
    const a = outsideProps(spec, runs, 'pand-1'), b = outsideProps(spec, runs, 'pand-1');
    assert.deepEqual(a, b, `${tpl}: stable`);
    for (const t of a) for (const [x, y, z] of t.p) {
      assert.ok(x >= 0.3 && x <= 6.3 && !(x > 4.05 && x < 5.15), `${tpl}: outside prop at ${x}`);
      assert.ok(y >= -0.05 && y <= 1.2 && z >= -0.15, `${tpl}: outside slot y ${y} z ${z}`);
    }
    if (!spec.inside) continue;
    const bays = [0, 1, 2].map(bay => JSON.stringify(insideProps(spec, 0.2, 3.0, 'pand-1', bay)));
    assert.ok(new Set(bays).size === 3, `${tpl}: three bays, three arrangements`);
    assert.equal(JSON.stringify(insideProps(spec, 0.2, 3.0, 'pand-1', 1)), bays[1]);
  }
});

test('per-window variety: goods tiles show seeded stretches of the cell, inside it, never one picture repeated', () => {
  const rect = [0.1, 0.2, 0.4, 0.7] as const, seen = new Set<string>();
  for (let bay = 0; bay < 3; bay++) for (let t = 0; t < 4; t++) {
    const [a, c, b, d] = goodsTileRect(rect, 'pand-7', bay, t);
    for (const u of [a, b]) assert.ok(u >= 0.1 - 1e-9 && u <= 0.4 + 1e-9);
    for (const v of [c, d]) assert.ok(v >= 0.2 - 1e-9 && v <= 0.7 + 1e-9);
    assert.ok(Math.abs(b - a) >= 0.3 * 0.78 - 1e-9 && d - c >= 0.5 * 0.94 - 1e-9);
    seen.add([a, b, c, d].map(x => x.toFixed(4)).join());
  }
  assert.equal(seen.size, 12);
});
