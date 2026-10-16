/**
 * Buurt auto-placement (blockFace/autoPlace.ts, stripSkyline.ts, stripLikeness.ts, buurtFaces.ts) and the Bellamybuurt
 * type library. Named regressions:
 *  - Hasebroekstraat 2 (158343, 16.7 m corner block) is vetoed by every type's frontage fit;
 *  - Hasebroekstraat 52-54 (161640, 157313: the 1904 balcony front with a 1915 BAG year) match no type (held);
 *  - Bellamystraat 18-20 (127784, 091626: 6.0 m, 1916) do not take the tile-bay type without a one-sided white bay;
 *  - 3DBAG bouwlagen 5 on the 4-storey Hasebroekstraat rows is not drawn as a fifth storey.
 *   node --import tsx --test src/canalRecall/blockFace/autoPlace.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AUTO_PLACE, baysFor, crownFor, decidePand, fillPairs, groundUse, placedRuns, placementGate, runIntent, scoreType, type Decision, type MatchableType, type PandEvidence, type StripEvidence} from './autoPlace.ts';
import {measureSkyline} from './stripSkyline.ts';
import {bestNcc, gradient, type Gray} from './stripLikeness.ts';
import {pointInPolygon, proposeFaces, streetPrefix, type BuurtPand} from './buurtFaces.ts';
import {defaultTypeLoader} from './typeLibrary.ts';
import {validateBlockFace} from './intent.ts';
import type {StripPalette} from './stripPalette.ts';

const BELLAMY = ['bellamy-1904-balcony-axis', 'bellamy-1915-tile-bay', 'bellamy-1916-two-axis'];
const types = BELLAMY.map(id => defaultTypeLoader(id) as MatchableType);
const palette = (o: Partial<StripPalette> = {}): StripPalette => ({wall: '#4a4140', accent: '#e0e0e0', frame: '#e0e0e0', band: null, cornice: '#dddddd', fascia: '#333333', shares: {wall: 0.8, accent: 0.05, glass: 0.15}, stucco: false, bandRunsM: [], wallHsl: null, pixels: 1000, ...o});
const strip = (o: Partial<StripEvidence> = {}): StripEvidence => ({date: '2022-01-04', px: [0, 220], palette: palette(), wall: '#3e3836', skyline: null, voidShare: 0, foliageShare: 0, columns: 3, doorSide: 'left', accentSide: null, ...o});
const pand = (o: Partial<PandEvidence> = {}): PandEvidence => ({pandId: '0363100012160178', address: 'Hasebroekstraat 36', builtYear: 1904, widthM: 5.5, eavesM: 13.2, roofMaxM: 16.5, storeys3dbag: 5, groundUses: ['woonfunctie'], osm: [], strip: strip(), ...o});

test('library: the Bellamy types load with match rules and evidence', () => {
  for (const t of types) {
    assert.ok(t, 'type loads');
    assert.ok(t.match?.years, `${t.id}: match.years`);
    assert.equal((t as unknown as {district: string}).district, 'bellamy');
    assert.ok(t.evidence.length);
  }
});

test('scoring: year and frontage veto, strip evidence scores', () => {
  const balcony = types[0];
  assert.equal(scoreType(balcony, pand()).score, 1);
  assert.match(scoreType(balcony, pand({builtYear: 1915})).veto.join(), /built 1915/);
  // Hasebroekstraat 2 (158343): a 16.7 m corner block fits no row type.
  for (const t of types) assert.ok(scoreType(t, pand({widthM: 16.71})).veto.length, t.id);
  // Columns: 2 measured against the balcony type's 3 bays costs, a stucco wall vetoes nothing but scores 0.
  assert.ok(scoreType(balcony, pand({strip: strip({columns: 5})})).score < 1);
  assert.ok(scoreType(balcony, pand({strip: strip({palette: palette({stucco: true})})})).score < 0.8);
  assert.equal(baysFor(balcony, 5.5), 3);
});

test('regression: Hasebroekstraat 52-54 (1904 front, BAG 1915, 5.4-5.6 m) and Bellamystraat 18-20 are held, not misplaced', () => {
  for (const ev of [pand({pandId: '0363100012161640', builtYear: 1915, widthM: 5.57}), pand({pandId: '0363100012157313', builtYear: 1915, widthM: 5.41})]) {
    const d = decidePand(types, ev, 'x', '2024-12-11');
    assert.equal(d.kind, 'held');
  }
  // 6.0 m, 1916, no one-sided white bay: the tile-bay type needs its accent side.
  const d = decidePand(types, pand({pandId: '0363100012127784', builtYear: 1916, widthM: 6.03, strip: strip({columns: 3, accentSide: null})}), 'x', '2024-12-11');
  assert.equal(d.kind, 'held');
});

test('placement: storeys stay the type\'s (3DBAG bouwlagen counts the attic), door side picks the ground, measured brick', () => {
  const d = decidePand(types, pand({strip: strip({doorSide: 'right'})}), 'hasebroek-160178', '2022-01-04');
  assert.equal(d.kind, 'placed');
  if (d.kind !== 'placed') return;
  assert.equal(d.house.type!.storeys, undefined);
  assert.equal(d.house.type!.ground, 'door-right');
  assert.equal(d.house.type!.measuredPalette?.brick, '#3e3836');
  assert.equal(d.house.groundFloor.use, 'residential');
});

test('placement: a one-sided white bay mirrors the tile-bay type; a trading ground gets a shopfront from BAG/OSM', () => {
  const ev = pand({pandId: '0363100012086016', address: 'Hasebroekstraat 68', builtYear: 1915, widthM: 6.46, eavesM: 12.3, strip: strip({columns: 2, accentSide: 'left'})});
  const d = decidePand(types, ev, 'x', '2024-12-11');
  assert.equal(d.kind === 'placed' && d.typeId, 'bellamy-1915-tile-bay');
  assert.equal(d.kind === 'placed' && d.house.type!.mirror, true);
  const shop = decidePand(types, pand({groundUses: ['winkelfunctie'], osm: [{type: 'node', id: 1, name: 'Bakker', category: 'shop=bakery'}]}), 'x', '2022-01-04');
  assert.ok(shop.kind === 'placed' && typeof shop.house.type!.ground === 'object' && 'shopfront' in shop.house.type!.ground);
  assert.equal(groundUse(pand({groundUses: ['winkelfunctie']}), '2022-01-04').agreement, 'bag-only');
});

test('evidence holds: no strip, a mostly grey strip', () => {
  assert.equal(decidePand(types, pand({strip: undefined}), 'x', 'd').kind, 'held');
  const d = decidePand(types, pand({strip: strip({voidShare: AUTO_PLACE.maxVoid + 0.1})}), 'x', 'd');
  assert.equal(d.kind === 'held' && d.stage, 'evidence');
});

test('crowns by skyline: narrow top = neck with hoist, wide top = box dormer, none, unread keeps the default', () => {
  const t = types[0];
  assert.equal(crownFor(t, {eavesM: 13, eavesRow: 0, confidence: 0.9, crown: {widthM: 2, riseM: 2.2, topWidthM: 0.7, centre: 0.5}}).name, 'neck-hoist');
  assert.equal(crownFor(t, {eavesM: 13, eavesRow: 0, confidence: 0.9, crown: {widthM: 2.2, riseM: 2.3, topWidthM: 1.8, centre: 0.5}}).name, 'box-dormer');
  assert.equal(crownFor(t, {eavesM: 13, eavesRow: 0, confidence: 0.9, crown: null}).name, 'none');
  assert.equal(crownFor(t, {eavesM: 13, eavesRow: 0, confidence: 0.2, crown: null}).name, 'neck-hoist');
});

test('runs: held pands split the face; a lone placed pand is held; door pairs fill by alternation', () => {
  const place = (id: string) => decidePand(types, pand({pandId: `03631000121600${id.charCodeAt(0) - 87}`.slice(0, 16)}), `hb-${id}`, '2022-01-04');
  const held: Decision = {kind: 'held', pandId: 'h', address: 'h', stage: 'match', reason: 'x'};
  const {runs, orphans} = placedRuns([place('a'), place('b'), held, place('c'), held, place('d'), place('e'), place('f')]);
  assert.deepEqual(runs.map(r => r.length), [2, 3]);
  assert.equal(orphans.length, 1);
  const pair: MatchableType = {...types[1], match: {...types[1].match!, mirrorForAccent: undefined, mirrorForDoor: 'left'}};
  const ev = (id: string, door: 'left' | 'right' | null) => pand({pandId: id, builtYear: 1915, widthM: 6.46, eavesM: 12.3, strip: strip({columns: 2, doorSide: door})});
  const ds = [decidePand([pair], ev('p1', 'right'), 'p1', 'd'), decidePand([pair], ev('p2', null), 'p2', 'd')];
  assert.equal(fillPairs(ds, [pair]), 1);
  assert.equal(ds[0].kind === 'placed' && ds[0].house.type!.mirror, true);
  assert.equal(ds[1].kind === 'placed' && ds[1].house.type!.mirror, undefined);
  // A run's intent validates (rhythm from the type, shop ground for trading pands).
  const run = runs[1];
  const intent = runIntent({id: 'test-run', street: 'Hasebroekstraat', stripDate: '2022-01-04', stripImage: 'x.jpg', types: BELLAMY, run, note: 'test'});
  assert.deepEqual(intent.types, ['bellamy-1904-balcony-axis']);
  validateBlockFace(JSON.parse(JSON.stringify(intent)), run.map(p => p.pandId));
});

test('gate: under the NCC floor holds, no score is no evidence', () => {
  assert.equal(placementGate({ncc: 0.3, abstain: null}).gate, 'pass');
  assert.equal(placementGate({ncc: 0.1, abstain: null}).gate, 'hold');
  assert.equal(placementGate({ncc: null, abstain: 'usable 20 %'}).gate, 'no-evidence');
});

test('stripLikeness: identical structure scores 1 at the right shift, a blank model scores nothing', () => {
  const W = 60, H = 80, img = (dx: number): Gray => {
    const data = new Float32Array(W * H), mask = new Uint8Array(W * H).fill(1);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) data[j * W + i] = ((i - dx) % 20 < 8 && j % 25 < 15) ? 40 : 160;
    return {data, mask, width: W, height: H};
  };
  const r = bestNcc(gradient(img(3)), gradient(img(0)), 5);
  assert.ok(r.ncc > 0.99, String(r.ncc));
  assert.equal(r.dx, 3);
  const flat: Gray = {data: new Float32Array(W * H).fill(100), mask: new Uint8Array(W * H).fill(1), width: W, height: H};
  assert.ok(bestNcc(gradient(img(0)), gradient(flat), 3).ncc <= 0);
});

test('stripSkyline: eaves on the cornice, a narrow crown over it', () => {
  const W = 100, H = 400, ppm = 20, rgb = new Uint8Array(W * H * 3).fill(235);
  const solid = (x: number, top: number) => { for (let y = top; y < H; y++) rgb.set([90, 60, 50], (y * W + x) * 3); };
  for (let x = 0; x < W; x++) solid(x, x >= 45 && x < 60 ? H - 15 * ppm : H - 13 * ppm);
  const s = measureSkyline({rgb, width: W, height: H, x0: 0, x1: W, pixelsPerMetre: ppm})!;
  assert.equal(s.eavesM, 13);
  assert.ok(s.crown && Math.abs(s.crown.riseM - 2) < 0.06 && Math.abs(s.crown.widthM - 0.75) < 0.06, JSON.stringify(s.crown));
  assert.equal(s.confidence, 1);
});

test('buurt faces: parity sides joined by party walls, prefixes', () => {
  assert.equal(streetPrefix('Jan Pieter Heijestraat'), 'heije');
  assert.equal(streetPrefix('Bellamyplein'), 'bellamyplein');
  assert.ok(pointInPolygon([1, 1], [[0, 0], [2, 0], [2, 2], [0, 2]]));
  const box = (x: number): BuurtPand => ({pandId: `p${x}`, street: 'S', numbers: [x * 2 + 1], otherStreets: {}, side: 'odd', builtYear: 1904, storeys3dbag: 4, units: 4, groundUses: [], frontWidthM: 5, normal: [0, -1], frontMidRD: [x * 5 + 2.5, 0],
    rings: [[[x * 5, 0], [x * 5, 10], [x * 5 + 5, 10], [x * 5 + 5, 0], [x * 5, 0]]]});
  const faces = proposeFaces([box(0), box(1), box(2), box(4)]);
  assert.deepEqual(faces.map(f => f.members.length).sort(), [1, 3]);
});

test('regression: Hasebroekstraat 1-37 (16.5 m eaves) is the 1904 row type drawn with 5 storeys; 4-36 (13.2 m) with 4', () => {
  const odd = decidePand(types, pand({pandId: '0363100012165485', address: 'Hasebroekstraat 1', eavesM: 16.64}), 'x', '2022-01-04');
  assert.equal(odd.kind === 'placed' && odd.house.type!.storeys, 5);
  const even = decidePand(types, pand({eavesM: 13.2}), 'x', '2022-01-04');
  assert.equal(even.kind === 'placed' && even.house.type!.storeys, undefined);
});
