/**
 * Rivierenbuurt (Plan Zuid, Rijnbuurt-Oost 1934) auto-place evidence: the BAG outline's erker (frontBump) and its facade
 * chord, the `bagBay` criterion and side, and door pairs across types (`doorsPairAcross`).
 *   node --import tsx --test src/canalRecall/blockFace/rivierenbuurt.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {chordOverFrontBump, frontBump, BUMP_MIN_DEPTH_M} from './bayOutline.ts';
import {decidePand, fillPairs, rowCoherence, rowExposure, scoreType, type Decision, type MatchableType, type PandEvidence, type StripEvidence} from './autoPlace.ts';
import {defaultTypeLoader} from './typeLibrary.ts';
import type {StripPalette} from './stripPalette.ts';

const FACE = 'scripts/block-face/faces/boterdiep-36-66/pands';
// Discovered BAG facts (the bay rebuild keeps them in facts-bay-outline.json); 065337 is a flat front.
const discovered = (id: string): BuildingFacts => {
  const kept = `${FACE}/0363100012${id}/facts-bay-outline.json`;
  return JSON.parse(fs.readFileSync(fs.existsSync(kept) ? kept : `${FACE}/0363100012${id}/facts.json`, 'utf8'));
};
const flat = defaultTypeLoader('rijn-1934-flat-three') as MatchableType, erker = defaultTypeLoader('rijn-1934-erker-pair') as MatchableType;

test('frontBump: an erker that runs into the party wall (Eemsstraat 30, 111889) is measured on the rear facade line', () => {
  const f30: BuildingFacts = JSON.parse(fs.readFileSync('scripts/block-face/faces/eems-6-78/pands/0363100012111889/facts-bay-outline.json', 'utf8'));
  const b = frontBump(f30.fronts[0])!;
  assert.ok(b?.lineRD, 'the discovered front ends on the bay side, so the facade line comes from the chain');
  assert.ok(b.centre > 0.8 && b.centre < 0.9, `centre ${b.centre}`);
  assert.ok(b.depthM > 0.6 && b.depthM < 0.7, `depth ${b.depthM}`);
  const next = chordOverFrontBump(f30)!;
  const [a, z] = next.fronts[0].endpointsRD;
  // The chord ends on the party corner the neighbour's front (121394, Eemsstraat 28) starts from.
  assert.ok(Math.hypot(z[0] - 122389.0195, z[1] - 483920.5932) < 0.01, `end ${z}`);
  assert.ok(Math.hypot(a[0] - 122390.3445, a[1] - 483914.6423) < 0.01, `start ${a}`);
  assert.ok(Math.abs(next.fronts[0].widthM - 6.1) < 0.05, `width ${next.fronts[0].widthM}`);
  // No spike along the facade line: no vertex where the ring turns straight back.
  for (const ring of [next.bagFootprintRD[0], ...next.surveyFootprintPolygonsRD.map(p => p[0]), ...next.roofsRD.map(r => r.ringsRD[0])]) {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[(i + ring.length - 1) % ring.length], v = ring[i], q = ring[(i + 1) % ring.length];
      const e1 = [v[0] - p[0], v[1] - p[1]], e2 = [q[0] - v[0], q[1] - v[1]];
      assert.ok(!(Math.abs(e1[0] * e2[1] - e1[1] * e2[0]) < 1e-3 && e1[0] * e2[0] + e1[1] * e2[1] < 0), `spike at ${v}`);
    }
  }
  // A front with its ends on the facade line keeps the old measure (no lineRD).
  assert.equal(frontBump(discovered('142115').fronts[0])!.lineRD, undefined);
});

test('frontBump: Boterdiepstraat erkers in the BAG outline, flat fronts straight', () => {
  // 142115 (Boterdiepstraat 40): the erker on the left of the 6.1 m front, 0.67 m deep.
  const b = frontBump(discovered('142115').fronts[0])!;
  assert.ok(b, 'bay found');
  assert.ok(b.depthM > BUMP_MIN_DEPTH_M && b.depthM < 0.9, `depth ${b.depthM}`);
  assert.ok(b.toM - b.fromM > 1.5 && b.toM - b.fromM < 2.0, `along ${b.fromM}-${b.toM}`);
  assert.ok(b.centre > 0.25 && b.centre < 0.35, `centre ${b.centre}`);
  // 139791 (42): the mirror image, on the right.
  assert.ok(frontBump(discovered('139791').fronts[0])!.centre > 0.65);
  assert.equal(frontBump(discovered('065337').fronts[0]), null);
});

test('chordOverFrontBump: the front on the facade line, no near-duplicate outline vertices (Boterdiepstraat 40)', () => {
  const before = discovered('142115'), after = chordOverFrontBump(before)!;
  assert.equal(frontBump(after.fronts[0]), null);
  assert.deepEqual(after.fronts[0].endpointsRD, before.fronts[0].endpointsRD);
  // The clip put its cut point 0.2 mm from BAG's own vertex on the facade line; a duplicate folds the roof prism.
  for (const ring of [...after.roofsRD.flatMap(r => [r.vertices, ...r.ringsRD]), ...after.bagFootprintRD])
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i], q = ring[(i + ring.length - 1) % ring.length];
      assert.ok(Math.hypot(p[0] - q[0], p[1] - q[1]) >= 0.01, `consecutive vertices ${JSON.stringify(q)} ${JSON.stringify(p)}`);
    }
  assert.equal(chordOverFrontBump(discovered('065337')), null);
});

const palette: StripPalette = {wall: '#7a6a5f', accent: '#e0e0e0', frame: '#efeee8', band: null, cornice: '#e4e1d8', fascia: '#333333', shares: {wall: 0.8, accent: 0.05, glass: 0.15}, stucco: false, bandRunsM: [], wallHsl: null} as unknown as StripPalette;
const strip: StripEvidence = {date: '2020-01-07', px: [0, 244], palette, wall: '#7a6a5f', skyline: null, voidShare: 0, foliageShare: 0, columns: null, doorSide: null, accentSide: null} as unknown as StripEvidence;
const pand = (o: Partial<PandEvidence>): PandEvidence => ({pandId: '0363100012142115', address: 'Boterdiepstraat 40', builtYear: 1934, widthM: 6.1, eavesM: 12.45, roofMaxM: 12.56, storeys3dbag: 4, groundUses: ['woonfunctie'], osm: [], strip, ...o});

test('bagBay: the BAG erker picks the erker type and its side; a straight outline the flat type', () => {
  const bay = frontBump(discovered('142115').fronts[0]);
  assert.ok(scoreType(erker, pand({bagBay: bay})).score > scoreType(flat, pand({bagBay: bay})).score);
  assert.ok(scoreType(flat, pand({bagBay: null})).score > scoreType(erker, pand({bagBay: null})).score);
  // Eemsstraat's near-central erkers (centre 0.43) are outside this type's side-erker offset.
  assert.equal(scoreType(erker, pand({bagBay: {fromM: 1.8, toM: 3.5, depthM: 0.65, centre: 0.43}})).criteria.find(c => c.key === 'bag-bay')!.score, 0);
  // Unread (an intake without the bay evidence) is no criterion at all.
  assert.equal(scoreType(erker, pand({})).criteria.find(c => c.key === 'bag-bay'), undefined);
  const d = decidePand([erker], pand({bagBay: bay}), 'boterdiep-142115', '2020-01-07');
  assert.equal(d.kind, 'placed');
  // Authored with the erker on the right; BAG puts it on the left: mirrored, whatever the strip read.
  assert.equal(d.kind === 'placed' && d.house.type!.mirror, true);
  const right = decidePand([erker], pand({pandId: '0363100012139791', bagBay: frontBump(discovered('139791').fronts[0])}), 'boterdiep-139791', '2020-01-07');
  assert.equal(right.kind === 'placed' && right.house.type!.mirror, undefined);
});

test('doorsPairAcross: a flat front with an unread door meets the door of the erker house (Boterdiepstraat 36-42)', () => {
  // 139791 erker right (door left), 142115 erker left (door right), 096263 and 149435 flat, doors unread.
  const ds: Decision[] = [
    decidePand([erker], pand({pandId: '0363100012139791', bagBay: frontBump(discovered('139791').fronts[0])}), 'b-139791', 'd'),
    decidePand([erker], pand({pandId: '0363100012142115', bagBay: frontBump(discovered('142115').fronts[0])}), 'b-142115', 'd'),
    decidePand([flat], pand({pandId: '0363100012096263', bagBay: null}), 'b-096263', 'd'),
    decidePand([flat], pand({pandId: '0363100012149435', bagBay: null}), 'b-149435', 'd'),
  ];
  assert.ok(ds.every(d => d.kind === 'placed'));
  assert.equal(fillPairs(ds, [erker, flat]), 2);
  const mirrored = ds.map(d => d.kind === 'placed' && !!d.house.type!.mirror);
  // The photo (2020-01-07): doors at 42's left, 40's right | 38's left, 36's right.
  assert.deepEqual(mirrored, [false, true, false, true]);
  // Without the key the flat pands only pair with their own type: nothing to pair with here but each other (both unread).
  const plain = {...flat, match: {...flat.match!, doorsPairAcross: undefined}} as MatchableType;
  const ds2: Decision[] = [ds[0], ds[1], decidePand([plain], pand({pandId: '0363100012096263', bagBay: null}), 'b-096263', 'd'), decidePand([plain], pand({pandId: '0363100012149435', bagBay: null}), 'b-149435', 'd')];
  assert.equal(fillPairs(ds2, [erker, plain]), 0);
});

test('rowExposure: one trim gain for the row (Hoendiepstraat 5-35: 1.26-1.36 under the white attic, 0.82-0.88 where it is hidden)', () => {
  const raw = '#4d4038', scaled = (g: number) => '#' + [0x4d, 0x40, 0x38].map(v => Math.round(v * g).toString(16).padStart(2, '0')).join('');
  const evs = [1.36, 1.31, 0.82, 1.34, 0.88].map((g, k) => pand({pandId: `03631000120784${10 + k}`, strip: {...strip, palette: {...strip.palette, wall: raw, stucco: false}, wall: scaled(g)}}));
  const painted = pand({pandId: '0363100012078499', strip: {...strip, palette: {...strip.palette, wall: '#e0dcd4', stucco: true}, wall: '#f0ece4'}});
  const gain = rowExposure([...evs, painted])!;
  assert.ok(gain.every(g => Math.abs(g - 1.31) < 0.02), `gain ${gain}`);
  assert.equal(new Set(evs.map(e => e.strip!.wall)).size, 1, 'one brick, one wall colour');
  assert.equal(evs[2].strip!.wallOwnGain, scaled(0.82));
  assert.equal(painted.strip!.wall, '#f0ece4', 'a painted front keeps its own reading');
  assert.equal(rowExposure(evs.slice(0, 3)), null, 'fewer than four pands: unchanged');
});

test('rowCoherence: a lone pand between two houses of one type takes theirs (Boterdiepstraat 23A-27)', () => {
  const ribbon = defaultTypeLoader('rijn-1934-erker-ribbon') as MatchableType, attic = defaultTypeLoader('rijn-1934-erker-white-attic') as MatchableType;
  const types = [flat, erker, ribbon, attic];
  // BAG puts 25's erker at 0.75 of the front, its neighbours' at 0.65: 25 lands on the white-attic type.
  const at = (id: string, address: string, centre: number) => pand({pandId: `0363100012${id}`, address, builtYear: 1933, bagBay: {fromM: 3.4, toM: 4.9, depthM: 0.7, centre}});
  const evs = [at('147270', 'Boterdiepstraat 23A', 0.65), at('117854', 'Boterdiepstraat 25', 0.75), at('071875', 'Boterdiepstraat 27', 0.65)];
  const ds: Decision[] = evs.map(ev => decidePand(types, ev, `boterdiep-${ev.pandId.slice(-6)}`, '2020-01-07'));
  assert.deepEqual(ds.map(d => d.kind === 'placed' ? d.typeId : null), ['rijn-1934-erker-ribbon', 'rijn-1934-erker-white-attic', 'rijn-1934-erker-ribbon']);
  assert.deepEqual(rowCoherence(ds, types, evs, '2020-01-07'), ['0363100012117854']);
  const mid = ds[1];
  assert.ok(mid.kind === 'placed' && mid.typeId === 'rijn-1934-erker-ribbon' && !mid.house.type!.mirror);
  assert.ok(mid.kind === 'placed' && mid.notes.some(n => /^row coherence: between two rijn-1934-erker-ribbon houses, was rijn-1934-erker-white-attic( \(mirrored\))? \(BAG bay centre 0.75\)/.test(n)));
  // A pand already of its neighbours' type: nothing changes.
  assert.deepEqual(rowCoherence(ds, types, evs, '2020-01-07'), []);
});

test('rowCoherence: BAG erkers are never dropped between flat fronts; a missed one follows the four-house rhythm (Eemsstraat 30 / 22)', () => {
  const end = defaultTypeLoader('rijn-1934-erker-end') as MatchableType, types = [flat, end];
  const bay = (centre: number) => ({fromM: 4.1, toM: 5.8, depthM: 0.65, centre});
  // Boterdiepstraat 48: an erker pand between two flat fronts keeps its erker.
  const evs1 = [pand({pandId: '0363100012086703', bagBay: null}), pand({pandId: '0363100012067390', bagBay: bay(0.85)}), pand({pandId: '0363100012065337', bagBay: null})];
  const ds1: Decision[] = evs1.map(ev => decidePand(types, ev, `b-${ev.pandId.slice(-6)}`, '2023-01-03'));
  assert.equal(ds1[1].kind === 'placed' && ds1[1].typeId, 'rijn-1934-erker-end');
  assert.deepEqual(rowCoherence(ds1, types, evs1, '2023-01-03'), []);
  // Eemsstraat 30 (BAG erker at the party wall) and 22, four houses along, which BAG draws flat: 22 follows 30.
  const evs2 = Array.from({length: 8}, (_, k) => pand({pandId: `03631000121119${80 + k}`, bagBay: k === 3 ? bay(0.85) : null}));
  const ds2: Decision[] = evs2.map(ev => decidePand(types, ev, `e-${ev.pandId.slice(-6)}`, '2023-01-03'));
  assert.deepEqual(ds2.map(d => d.kind === 'placed' ? d.typeId.replace('rijn-1934-', '') : null), ['flat-three', 'flat-three', 'flat-three', 'erker-end', 'flat-three', 'flat-three', 'flat-three', 'flat-three']);
  assert.deepEqual(rowCoherence(ds2, types, evs2, '2023-01-03'), ['0363100012111987']);
  assert.ok(ds2[7].kind === 'placed' && ds2[7].typeId === 'rijn-1934-erker-end' && ds2[7].notes.some(n => /^row coherence: the row repeats every four houses: 111983 \(BAG erker\)/.test(n)));
  // A BAG erker off its row's place moves only on a confirmed rhythm (Hoendiepstraat 8: 16 and 24 agree), never on a
  // single house at the end of the face.
  const att = defaultTypeLoader('rijn-1934-erker-white-attic') as MatchableType, types4 = [flat, erker, att];
  const left = (c: number) => ({fromM: 1.1, toM: 2.9, depthM: 0.7, centre: c});
  const evs4 = Array.from({length: 9}, (_, k) => pand({pandId: `03631000121083${50 + k}`, bagBay: k % 4 === 0 ? left(k === 8 ? 0.253 : 0.31) : null}));
  const ds4: Decision[] = evs4.map(ev => decidePand(types4, ev, `h-${ev.pandId.slice(-6)}`, '2023-01-03'));
  assert.deepEqual([0, 4, 8].map(k => ds4[k].kind === 'placed' && ds4[k].typeId), ['rijn-1934-erker-pair', 'rijn-1934-erker-pair', 'rijn-1934-erker-white-attic']);
  assert.ok(rowCoherence(ds4, types4, evs4, '2023-01-03').includes('0363100012108358'));
  assert.ok(ds4[8].kind === 'placed' && ds4[8].typeId === 'rijn-1934-erker-pair' && ds4[8].house.type!.mirror === true);
  assert.ok(ds4[0].kind === 'placed' && ds4[0].typeId === 'rijn-1934-erker-pair');
  const ds5: Decision[] = evs4.slice(4).map(ev => decidePand(types4, ev, `h-${ev.pandId.slice(-6)}`, '2023-01-03'));
  assert.ok(!rowCoherence(ds5, types4, evs4.slice(4), '2023-01-03').includes('0363100012108358'), 'one unconfirmed anchor');
  // Unread BAG bays (an intake without the bay evidence) are no anchors and nothing to correct.
  const evs3 = evs2.map(ev => ({...ev, bagBay: undefined}));
  const ds3: Decision[] = evs3.map(ev => decidePand(types, ev, `e-${ev.pandId.slice(-6)}`, '2023-01-03'));
  assert.deepEqual(rowCoherence(ds3, types, evs3, '2023-01-03'), []);
});
