// Shop props kit (lane shop-goods-20261116): stated costs, footprints, determinism and per-bay variety.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bakfiets, barberStation, bike, BIKE_HEXES, bikeHex, bikeRack, bucketTier, bucketTierCost, counter, crate, omafiets, OMAFIETS_SIZE, plant, PROP_COST, rail, washBasin } from './props.js';
import { insideProps, outsideProps, SHOP_PROPS } from './layout.js';
import { goodsTileRect } from './variety.js';

test('shop props: each builder costs what PROP_COST states', () => {
  assert.equal(omafiets('#161616').length, PROP_COST.omafiets);
  assert.equal(omafiets('#161616', 'window').length, PROP_COST.omafietsWindow);
  assert.equal(bikeRack().length, PROP_COST.bikeRack);
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

test('shop props (lane shop-bikes): the baked omafiets is a city bike within its budget, its frame in the stated colour', () => {
  // The pavement LOD 150-300 tris (the player's 18,188-tri omafiets simplified), the window LOD under half of it.
  assert.ok(PROP_COST.omafiets >= 150 && PROP_COST.omafiets <= 300, `${PROP_COST.omafiets}`);
  assert.ok(PROP_COST.omafietsWindow <= PROP_COST.omafiets / 2, `${PROP_COST.omafietsWindow}`);
  for (const lod of ['shop', 'window'] as const) {
    const t = omafiets('#6b1e2a', lod), xs = t.flatMap(q => q.p.map(p => p[0])), zs = t.flatMap(q => q.p.map(p => p[2]));
    assert.ok(Math.max(...xs) - Math.min(...xs) > 1.8 && Math.max(...xs) - Math.min(...xs) < 2.15, `${lod}: about 2 m long`);
    assert.ok(Math.min(...zs) > -0.01 && Math.min(...zs) < 0.02 && Math.max(...zs) > 1.0 && Math.max(...zs) < 1.3, `${lod}: on the ground, bars about 1.15 m up`);
    assert.ok(Math.abs((Math.max(...xs) + Math.min(...xs)) / 2) < 0.02, `${lod}: origin mid-bike`);
    assert.ok(t.filter(q => q.hex === '#6b1e2a').length > 15, `${lod}: the frame in its colour`);
    // Culled to the street side: no face looks away from the street (+y).
    assert.ok(t.every(q => q.n[1] >= -0.21), `${lod}: street-side faces only`);
  }
  assert.equal(OMAFIETS_SIZE.lengthM > 1.8 && OMAFIETS_SIZE.widthM > 0.5, true);
  // The palette: black most often, then navy, green, cream, burgundy; a pastel now and then.
  const picks = Array.from({ length: 1000 }, (_, i) => bikeHex((i + 0.5) / 1000)), n = (h: string) => picks.filter(p => p === h).length;
  assert.ok(n('#161616') > 300 && n('#161616') < 380 && new Set(picks).size === BIKE_HEXES.length);
});

test('shop props (lane shop-bikes): a bike shop spreads its bikes evenly over the whole frontage, varied, with hoops', () => {
  for (const seed of ['pand-1', 'pand-2', 'gallery-bike']) {
    const runs: Array<[number, number]> = [[0.4, 4.0], [5.2, 8.6]];
    const t = outsideProps(SHOP_PROPS.bike, runs, seed);
    // Each pavement bike has 2 x 12 x 2 = 48 tyre triangles.
    const per = PROP_COST.omafiets, bikes = Math.round(t.filter(q => q.hex === '#141414').length / 48);
    // 3.6 m run: (3.6 - 2.06) / 0.65 + 1 = 3 bikes; 3.4 m: 3; 6 in all, within the cap of 8.
    assert.equal(bikes, 6, seed);
    const frames = new Set(t.map(q => q.hex).filter(h => (BIKE_HEXES as readonly string[]).includes(h)));
    assert.ok(frames.size >= 2, `${seed}: ${[...frames]}`);
    // Bikes reach both ends of each run (spread, not clumped), and stay out of the gap.
    for (const [r0, r1] of runs) {
      const xs = t.flatMap(q => q.p.map(p => p[0])).filter(x => x >= r0 - 0.1 && x <= r1 + 0.1);
      assert.ok(Math.min(...xs) < r0 + 0.1 && Math.max(...xs) > r1 - 0.1, `${seed}: ${Math.min(...xs)}..${Math.max(...xs)} over ${r0}..${r1}`);
    }
    assert.ok(t.every(q => q.p.every(p => p[0] < 4.05 || p[0] > 5.15)));
    assert.ok(t.length <= 6 * per + 4 * PROP_COST.bikeRack && t.some(q => q.hex === '#8d9396'), `${seed}: ${t.length} tris and hoops`);
  }
  // The cap: a 20 m frontage draws 8 bikes, shared over its runs, still reaching every run's ends.
  const long = outsideProps(SHOP_PROPS.bike, [[0, 9], [10, 20]], 'pand-9');
  assert.equal(Math.round(long.filter(q => q.hex === '#141414').length / 48), 8);
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
