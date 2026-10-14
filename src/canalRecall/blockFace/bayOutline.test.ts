/**
 * Bay outline in the BAG footprint, named regression Nassaukade 146 (pand 0363100012160704, face `nassau-145-152`): the
 * discovered front was the 1.61 m face of a canted erker; the chord over the bay is the 6.17 m facade.
 *   node --import tsx --test src/canalRecall/blockFace/bayOutline.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type {BuildingFacts} from '../buildingRecipe/facts.ts';
import {bayChord, chordOverBay, clipRing} from './bayOutline.ts';

const DIR = 'scripts/block-face/faces/nassau-145-152/pands/0363100012160704';
const raw: BuildingFacts = JSON.parse(fs.readFileSync(`${DIR}/facts-bay-outline.json`, 'utf8'));
const stored: BuildingFacts = JSON.parse(fs.readFileSync(`${DIR}/facts.json`, 'utf8'));

test('clipRing keeps the house side of a line and interpolates heights on cut edges', () => {
  const ring = [[0, 0, 10], [4, 0, 10], [4, 2, 20], [0, 2, 20]];
  const out = clipRing(ring, [0, 1], [0, 1]);
  assert.deepEqual(out.map(p => p.map(v => +v.toFixed(3))), [[0, 0, 10], [4, 0, 10], [4, 1, 15], [0, 1, 15]]);
});

test('Nassaukade 146: the chord runs over the bay from facade vertex to facade vertex', () => {
  assert.ok(raw.fronts[0].widthM < 1.7, 'the discovered front is the bay face');
  const {a, b} = bayChord(raw);
  assert.deepEqual(a.map(v => +v.toFixed(2)), [120038.54, 487272.89]);
  assert.deepEqual(b.map(v => +v.toFixed(2)), [120039.18, 487279.03]);
});

test('Nassaukade 146: footprint and roofs end at the chord, the front is the 6.17 m facade', () => {
  const f = chordOverBay(raw), fr = f.fronts[0], [a, b] = fr.endpointsRD, n = fr.outwardNormalRD;
  assert.ok(Math.abs(fr.widthM - 6.17) < 0.02, `width ${fr.widthM}`);
  const ahead = (q: number[]) => (q[0] - a[0]) * n[0] + (q[1] - a[1]) * n[1];
  for (const ring of [...f.bagFootprintRD, ...f.surveyFootprintPolygonsRD.flat(), ...f.roofsRD.flatMap(r => r.ringsRD)]) for (const q of ring) assert.ok(ahead(q) <= 0.021, `vertex ${q} stands ${ahead(q).toFixed(3)} m in front of the chord`);
  // The bay's 13 m roof strip is gone: on the chord the profile is the main house's front roof foot, on the neighbours'
  // cornice line (148: 14.9 m, 145: 15.0 m), not the bay top.
  assert.ok(fr.topProfile.length >= 30 && fr.eavesM > 14.5 && fr.eavesM < 15.5, `profile ${fr.topProfile.length} samples, eaves ${fr.eavesM}`);
  assert.deepEqual(fr.chainRD[0], a); assert.deepEqual(fr.chainRD.at(-1), b);
  assert.ok(fr.uncertainty.some(u => u.includes('bay outline')));
  // The committed face facts are exactly this rebuild (the intake applied it).
  assert.deepEqual(JSON.parse(JSON.stringify(f)), stored);
});
