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
import {decidePand, fillPairs, scoreType, type Decision, type MatchableType, type PandEvidence, type StripEvidence} from './autoPlace.ts';
import {defaultTypeLoader} from './typeLibrary.ts';
import type {StripPalette} from './stripPalette.ts';

const FACE = 'scripts/block-face/faces/boterdiep-36-66/pands';
// Discovered BAG facts (the bay rebuild keeps them in facts-bay-outline.json); 065337 is a flat front.
const discovered = (id: string): BuildingFacts => {
  const kept = `${FACE}/0363100012${id}/facts-bay-outline.json`;
  return JSON.parse(fs.readFileSync(fs.existsSync(kept) ? kept : `${FACE}/0363100012${id}/facts.json`, 'utf8'));
};
const flat = defaultTypeLoader('rijn-1934-flat-three') as MatchableType, erker = defaultTypeLoader('rijn-1934-erker-pair') as MatchableType;

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
