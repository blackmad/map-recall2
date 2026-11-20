import test from 'node:test';
import assert from 'node:assert/strict';
import { badness, bandOf, evidenceClass, exposedStreetWalls, formOf, isWrongPeriod, planAspect, rawPayoff, ringEdges, ringOf, routeOf, type XY } from './core.ts';

test('bands and rings', () => {
  assert.equal(bandOf(299), null);
  assert.equal(bandOf(300), '300-1k');
  assert.equal(bandOf(2499), '1k-2.5k');
  assert.equal(bandOf(2500), '2.5k+');
  assert.equal(ringOf(2999), 'core');
  assert.equal(ringOf(4000), 'outer');
  assert.equal(ringOf(5001), null);
});

test('badness orders the paths and adds plain share and wrong period', () => {
  const bare = badness({ kind: 'bare', plainFromAir: 1, wrongPeriod: false });
  const kit = badness({ kind: 'plain-kit', plainFromAir: 1, wrongPeriod: false });
  const gen = badness({ kind: 'generic', plainFromAir: 0, wrongPeriod: false });
  const genPlain = badness({ kind: 'generic', plainFromAir: 1, wrongPeriod: false });
  const genWrong = badness({ kind: 'generic', plainFromAir: 1, wrongPeriod: true });
  assert.ok(bare > kit && kit > genPlain && genPlain > gen);
  assert.equal(genWrong, 0.9);
  assert.equal(badness({ kind: 'large-blank-side', plainFromAir: 0, wrongPeriod: false, blankSideShare: 0.5 }), 0.375);
});

test('wrong period: register year vs drawn style, near pairs and towers forgiven', () => {
  assert.equal(isWrongPeriod('modern-priorBrickRed', 1928), true);
  assert.equal(isWrongPeriod('postwar-priorModernGrey', 1990), false);
  assert.equal(isWrongPeriod('school-priorBrickDark', 1926), false);
  assert.equal(isWrongPeriod('tower', 1890), false);
  assert.equal(isWrongPeriod('c19', null), false);
});

test('exposed street wall: party walls and back walls do not count', () => {
  // 20 x 10 m block, a neighbour against its east wall, a road 8 m south of it.
  const me: XY[] = [[0, 0], [20, 0], [20, 10], [0, 10], [0, 0]];
  const east: XY[] = [[20, 0], [30, 0], [30, 10], [20, 10], [20, 0]];
  const road: [XY, XY] = [[-50, -8], [70, -8]];
  const r = exposedStreetWalls(me, [east], [road]);
  assert.equal(r.exposedM, 50); // south 20 + north 20 + west 10; east is a party wall
  assert.equal(r.streetM, 20); // only the south wall faces the road
  assert.equal(ringEdges(me).length, 4);
});

test('plan aspect and form', () => {
  assert.equal(planAspect([[0, 0], [60, 0], [60, 12], [0, 12], [0, 0]]), 5);
  assert.equal(formOf(40, 800, 2, 0), 'tower');
  assert.equal(formOf(7, 3000, 1.5, 0), 'hall');
  assert.equal(formOf(15, 900, 5, 0), 'slab');
  assert.equal(formOf(15, 900, 1.5, 1), 'courtyard-block');
});

test('evidence classes and payoff', () => {
  assert.equal(evidenceClass(null), 'none');
  assert.equal(evidenceClass({ obliquityDeg: 20, blocked: false }), 'straight');
  assert.equal(evidenceClass({ obliquityDeg: 45, blocked: false }), 'oblique');
  assert.equal(evidenceClass({ obliquityDeg: 10, blocked: true }), 'blocked');
  assert.equal(rawPayoff(1_000_000, 20, 0.5), 10);
  assert.equal(rawPayoff(1_000_000, 80, 1), 40); // height capped at 40 m
});

test('routes', () => {
  const base = { named: false, landmark: false, areaM2: 800, heightM: 15, use: 'office', inDesignUnit: false, terraced: false, year: 1965, clusterSize: 3 };
  assert.equal(routeOf(base), 'large-recipe');
  assert.equal(routeOf({ ...base, clusterSize: 12 }), 'kit-fix');
  assert.equal(routeOf({ ...base, named: true, clusterSize: 12 }), 'landmark');
  assert.equal(routeOf({ ...base, use: 'housing', inDesignUnit: true, clusterSize: 12 }), 'design-units');
  assert.equal(routeOf({ ...base, areaM2: 3000, heightM: 35 }), 'landmark');
});

test('address from BAG units', async () => {
  const { formatAddress } = await import('./core.ts');
  assert.equal(formatAddress([]), null);
  assert.equal(formatAddress([{ street: 'Kinkerstraat', nr: 54 }, { street: 'Kinkerstraat', nr: 32 }, { street: 'Bilderdijkstraat', nr: 1 }]), 'Kinkerstraat 32-54 (+1 street)');
  assert.equal(formatAddress([{ street: 'Spui', nr: 25 }]), 'Spui 25');
});

test('use from BAG units by floor area, OSM tag fallback', async () => {
  const { useOf, clusterKey } = await import('./core.ts');
  assert.equal(useOf([{ use: 'woonfunctie', m2: 60 }, { use: 'woonfunctie', m2: 60 }, { use: 'winkelfunctie', m2: 100 }]), 'housing');
  assert.equal(useOf([{ use: 'kantoorfunctie', m2: 900 }, { use: 'woonfunctie', m2: 80 }]), 'office');
  assert.equal(useOf([{ use: 'kantoorfunctie', m2: 400 }, { use: 'onderwijsfunctie', m2: 300 }, { use: 'woonfunctie', m2: 200 }]), 'mixed');
  assert.equal(useOf([], 'school'), 'school');
  assert.equal(useOf([]), 'no-units');
  assert.equal(clusterKey({ era: '1965-1984', use: 'office', form: 'slab', heightM: 30, kind: 'generic' }), '1965-1984 · office · slab · high · generic');
});
