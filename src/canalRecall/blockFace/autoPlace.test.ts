/**
 * Buurt auto-placement (blockFace/autoPlace.ts, stripSkyline.ts, stripLikeness.ts, buurtFaces.ts) and the Bellamybuurt
 * type library. Named regressions:
 *  - Hasebroekstraat 2 (158343, 16.7 m corner block) is vetoed by every type's frontage fit;
 *  - Hasebroekstraat 52-54 (161640, 157313: the 1904 balcony front with a 1915 BAG year) match no type (held);
 *  - Bellamystraat 18-20 (127784, 091626: 6.0 m, 1916) do not take the tile-bay type without a one-sided white bay;
 *  - 3DBAG bouwlagen 5 on the 4-storey Hasebroekstraat rows is not drawn as a fifth storey;
 *  - the pilot's five false positives on real strip crops (fixtures/strip-structure): Jan Hanzenstraat 49-51, Ten
 *    Katestraat 29-31 and Bellamystraat 18-20 (balcony fronts) and Van Effenstraat 7D are held, Hasebroekstraat 69 is
 *    green-tile with its point gable.
 *   node --import tsx --test src/canalRecall/blockFace/autoPlace.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';
import {accentSideOf, AUTO_PLACE, baysFor, crownFor, decidePand, fillPairs, groundUse, placedRuns, placementGate, runIntent, scoreType, type Decision, type MatchableType, type PandEvidence, type StripEvidence} from './autoPlace.ts';
import {measureSkyline} from './stripSkyline.ts';
import {measureStripStructure, type StripStructure} from './stripStructure.ts';
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

test('green-tile vs tile-bay by the exposure-normalised bay width, not the accent share (Van Effenstraat 9 read 0.48)', () => {
  const all = ['bellamy-1915-green-tile', 'bellamy-1915-tile-bay'].map(id => defaultTypeLoader(id) as MatchableType);
  const st = (bayWidthM: number, bayCentre: number | null): StripStructure => ({wallLab: [50, 8, 15], spread: 50, bayWidthM, bayCentre, openAxes: [], slabs: [], balconies: false, balconyWhy: 'none'});
  const ev = (accentShare: number, structure: StripStructure) => pand({builtYear: 1915, widthM: 6.4, eavesM: 12.9, strip: strip({columns: 3, accentShare, accentSide: null, structure})});
  // An overexposed green-tile front (accent share 0.48) without a bay is green-tile; a 2.1 m bay on a dark strip is tile-bay.
  const green = decidePand(all, ev(0.48, st(1.0, null)), 'x', '2024-12-11');
  assert.equal(green.kind === 'placed' && green.typeId, 'bellamy-1915-green-tile');
  const bay = decidePand(all, ev(0, st(2.15, 0.3)), 'x', '2024-12-11');
  assert.equal(bay.kind === 'placed' && bay.typeId, 'bellamy-1915-tile-bay');
  // The bay's side mirrors the type (drawn right): a bay on the left mirrors it, whatever the accent pixels say.
  assert.equal(bay.kind === 'placed' && bay.house.type!.mirror, true);
  assert.equal(accentSideOf(strip({accentSide: 'right', structure: st(2.15, 0.3)})), 'left');
  assert.equal(accentSideOf(strip({accentSide: 'right', structure: st(1.0, null)})), 'right');
});

test('balconies veto the balcony-free types; a crown rule alternative', () => {
  const green = defaultTypeLoader('bellamy-1915-green-tile') as MatchableType;
  const balc: StripStructure = {wallLab: [50, 8, 15], spread: 50, bayWidthM: 0, bayCentre: null, openAxes: [{widthM: 0.9, centre: 0.2, light: 0.16}], slabs: [], balconies: true, balconyWhy: 'dark open axis'};
  const ev = pand({builtYear: 1915, widthM: 5.9, eavesM: 12.9, strip: strip({columns: 3, structure: balc})});
  assert.match(scoreType(green, ev).veto.join(), /balconies/);
  // Hasebroekstraat 69: the gable over the pair, its shoulder read as the eaves (rise 1.63 m, 2.67 m wide, top 1.0 m).
  assert.equal(crownFor(green, {eavesM: 14.25, eavesRow: 169, confidence: 1, crown: {widthM: 2.67, riseM: 1.63, topWidthM: 1, centre: 0.27}}).name, 'point-gable');
  // Hasebroekstraat 98: two dormers (1.27 m, rise 1.5 m) stay dormers.
  assert.equal(crownFor(green, {eavesM: 13, eavesRow: 0, confidence: 1, crown: {widthM: 1.27, riseM: 1.5, topWidthM: 0.3, centre: 0.88}}).name, 'dormers');
});

/**
 * Named regressions on real strips: body bands of the 2026-10-16 intake strips (fixtures/strip-structure, cut by
 * scripts/block-face/auto-place.ts' span frames; index.json carries the facts auto-place read). The five rows the pilot
 * placed with a wrong type that still passed the likeness gate, and controls of every Bellamy type:
 *  - Jan Hanzenstraat 49-51 (balcony fronts, green-tile before): held;
 *  - Ten Katestraat 29-31 (balcony fronts, green-tile / two-axis before): held;
 *  - Bellamystraat 18-20 (balcony fronts with neck gables, green-tile before): held;
 *  - Hasebroekstraat 69 (pair + single with green tiles and a gable over the pair: the green-tile design; the pilot drew
 *    it with dormers): green-tile with the point gable;
 *  - Van Effenstraat 7D (a 7.3 m green-tile-like front, tile-bay before on an accent share of 0.49): held; 9 stays green-tile.
 */
const FIX = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/strip-structure');
interface FixturePand { pandId: string; address: string; truth: string; file: string; pixelsPerMetre: number; bottomM: number; eavesRead: number; stripDate: string;
  facts: {builtYear: number; widthM: number; eavesM: number; roofMaxM: number; storeys3dbag: number | null};
  strip: {wall: string | null; skyline: StripEvidence['skyline']; columns: number | null; doorSide: 'left' | 'right' | null; accentSide: 'left' | 'right' | null; accentShare: number; stucco: boolean; bands: number} }
const fixtures: FixturePand[] = JSON.parse(readFileSync(path.join(FIX, 'index.json'), 'utf8')).pands;
async function fixtureStructure(f: FixturePand) {
  const {data, info} = await sharp(path.join(FIX, f.file)).removeAlpha().raw().toBuffer({resolveWithObject: true});
  // The fixture is the body band; pad the rows under it (to the ground line) with the strip's grey placeholder.
  const pad = Math.round(f.bottomM * f.pixelsPerMetre), rgb = new Uint8Array(info.width * (info.height + pad) * 3).fill(128);
  rgb.set(data, 0);
  return measureStripStructure({rgb, width: info.width, height: info.height + pad, x0: 0, x1: info.width, pixelsPerMetre: f.pixelsPerMetre, eavesM: f.eavesRead});
}
async function fixtureEvidence(f: FixturePand): Promise<PandEvidence> {
  const structure = await fixtureStructure(f);
  return {pandId: f.pandId, address: f.address, builtYear: f.facts.builtYear, widthM: f.facts.widthM, eavesM: f.facts.eavesM, roofMaxM: f.facts.roofMaxM, storeys3dbag: f.facts.storeys3dbag, groundUses: ['woonfunctie'], osm: [],
    strip: strip({date: f.stripDate, palette: palette({stucco: f.strip.stucco, bandRunsM: Array.from({length: f.strip.bands}, (_, k) => [k, k + 0.1] as [number, number])}), wall: f.strip.wall, skyline: f.strip.skyline, columns: f.strip.columns, doorSide: f.strip.doorSide, accentSide: f.strip.accentSide, accentShare: f.strip.accentShare, structure})};
}
const bellamyAll = ['bellamy-1895-plain-three-axis', 'bellamy-1904-balcony-axis', 'bellamy-1915-green-tile', 'bellamy-1915-tile-bay', 'bellamy-1916-two-axis', 'bellamy-1937-flat-row'].map(id => defaultTypeLoader(id) as MatchableType);
const byAddress = (a: string) => { const f = fixtures.find(x => x.address === a); assert.ok(f, a); return f!; };

test('stripStructure on real strips: balconies on the balcony fronts only, the bay on the tile-bay fronts only', async () => {
  for (const f of fixtures) {
    const s = (await fixtureStructure(f))!;
    assert.ok(s, f.address);
    assert.equal(s.balconies, f.truth === 'balcony', `${f.address}: ${s.balconyWhy}`);
    if (f.truth === 'tile-bay') assert.ok(s.bayWidthM >= 1.9, `${f.address}: bay ${s.bayWidthM}`);
    else assert.ok(s.bayWidthM <= 1.3 || f.truth === 'balcony', `${f.address}: bay ${s.bayWidthM}`);
  }
});

test('regression: the five false positives of the pilot are held or take the right type', async () => {
  const decide = async (a: string) => decidePand(bellamyAll, await fixtureEvidence(byAddress(a)), 'x', '2024-12-11');
  for (const a of ['Jan Hanzenstraat 49', 'Jan Hanzenstraat 51', 'Ten Katestraat 29', 'Ten Katestraat 31', 'Bellamystraat 18', 'Bellamystraat 20', 'Van Effenstraat 7D']) {
    const d = await decide(a);
    assert.equal(d.kind, 'held', `${a}: ${d.kind === 'placed' ? d.typeId : ''}`);
  }
  const h69 = await decide('Hasebroekstraat 69');
  assert.equal(h69.kind === 'placed' && h69.typeId, 'bellamy-1915-green-tile');
  assert.equal(h69.kind === 'placed' && h69.house.type!.crown, 'point-gable');
  const e9 = await decide('Van Effenstraat 9');
  assert.equal(e9.kind === 'placed' && e9.typeId, 'bellamy-1915-green-tile');
  // Controls keep their types.
  for (const [a, t] of [['Hasebroekstraat 94', 'bellamy-1915-green-tile'], ['Hasebroekstraat 90', 'bellamy-1915-green-tile'], ['Hasebroekstraat 60', 'bellamy-1915-tile-bay'], ['Hasebroekstraat 65', 'bellamy-1915-tile-bay'], ['Bellamystraat 24', 'bellamy-1916-two-axis'], ['Ten Katestraat 17', 'bellamy-1937-flat-row']]) {
    const d = await decide(a);
    assert.equal(d.kind === 'placed' && d.typeId, t, `${a}: ${d.kind === 'held' ? d.reason : d.typeId}`);
  }
});

test('regression: Hasebroekstraat 1-37 (16.5 m eaves) is the 1904 row type drawn with 5 storeys; 4-36 (13.2 m) with 4', () => {
  const odd = decidePand(types, pand({pandId: '0363100012165485', address: 'Hasebroekstraat 1', eavesM: 16.64}), 'x', '2022-01-04');
  assert.equal(odd.kind === 'placed' && odd.house.type!.storeys, 5);
  const even = decidePand(types, pand({eavesM: 13.2}), 'x', '2022-01-04');
  assert.equal(even.kind === 'placed' && even.house.type!.storeys, undefined);
});
