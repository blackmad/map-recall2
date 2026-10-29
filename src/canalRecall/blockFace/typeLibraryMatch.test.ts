/**
 * Type libraries grown for the unattended batch installer (#113): every library type that auto-place can choose has a
 * valid `match` block, the Oud-West library has match blocks at all (before #113 only authored intents could use it),
 * and each type written from the failure clusters of the #103 batch reports wins its own exemplar pands on facts alone
 * (BAG year, frontage, 3DBAG eaves) against the rest of its library, without a veto.
 *   node --import tsx --test src/canalRecall/blockFace/typeLibraryMatch.test.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {TYPE_LIBRARY_DIR} from './typeLibrary.ts';
import {typeProblems} from './houseType.ts';
import {scoreType, type MatchableType, type PandEvidence} from './autoPlace.ts';

const library = (district: string): MatchableType[] => fs.readdirSync(path.join(TYPE_LIBRARY_DIR, district)).filter(f => f.endsWith('.json')).sort()
  .map(f => JSON.parse(fs.readFileSync(path.join(TYPE_LIBRARY_DIR, district, f), 'utf8')));
const facts = (face: string, pand: string, street: string) => {
  const dir = path.join('scripts/block-face/faces', face, 'pands'), id = fs.readdirSync(dir).find(d => d.endsWith(pand))!;
  const f = JSON.parse(fs.readFileSync(path.join(dir, id, 'facts.json'), 'utf8')), fr = f.fronts.find((x: any) => x.street === street) ?? f.fronts[0];
  return {pandId: id, address: `${street} (${pand})`, builtYear: f.heights.builtYear, widthM: +fr.widthM.toFixed(2), eavesM: fr.eavesM, roofMaxM: f.heights.roofMaxM, storeys3dbag: f.heights.storeys ?? null, groundUses: ['woonfunctie'], osm: []} satisfies PandEvidence;
};

const DISTRICTS = ['de-pijp', 'helmersbuurt', 'oud-west', 'jordaan'];

test('every type of the grown libraries validates and has a sane match block', () => {
  for (const d of DISTRICTS) for (const t of library(d)) {
    assert.deepEqual(typeProblems(t), [], `${d}/${t.id}`);
    const m = t.match;
    assert.ok(m, `${d}/${t.id} has no match block`);
    assert.ok(m.years[0] <= m.years[1], `${t.id} years`);
    if (m.frontSkylineM !== undefined) assert.ok(m.frontEavesM !== undefined && m.frontSkylineM > m.frontEavesM, `${t.id}: frontSkylineM needs a lower frontEavesM`);
    for (const r of m.baysByWidth ?? []) assert.ok(r.bays >= 1 && r.maxWidthM > 0, `${t.id} baysByWidth`);
  }
});

// Exemplar pands the cluster types were measured on (their `evidence`): each must be placeable by facts alone.
const EXEMPLARS: [district: string, type: string, face: string, pand: string, street: string][] = [
  ['de-pijp', 'pijp-1879-five-low', 'stalpert-38-70', '164659', 'Daniël Stalpertstraat'],
  ['de-pijp', 'pijp-1879-five-low', 'saenredam-1-37', '236169', 'Saenredamstraat'],
  ['de-pijp', 'pijp-1889-five-storey-banded', 'steen-91-149', '236199', 'Eerste Jan Steenstraat'],
  ['de-pijp', 'pijp-1889-five-storey-banded', 'heijden-2-40', '158445', 'Tweede Jan van der Heijdenstraat'],
  ['de-pijp', 'pijp-1884-bracketed-hood', 'flinck-265-287', '164793', 'Govert Flinckstraat'],
  ['helmersbuurt', 'helmers-1890-five-wall-dormer', 'helmers-79-97', '152281', 'Tweede Helmersstraat'],
  ['helmersbuurt', 'helmers-1889-balconette-pediment', 'toussaint-9-27', '162495', 'Bosboom Toussaintstraat'],
];

test('the cluster types are not vetoed on their own exemplars, and a type of the wrong era is', () => {
  for (const [d, id, face, pand, street] of EXEMPLARS) {
    const types = library(d), t = types.find(x => x.id === id)!, ev = facts(face, pand, street);
    assert.ok(t, `${d}/${id} missing`);
    assert.deepEqual(scoreType(t, ev).veto, [], `${id} on ${face}/${pand}`);
  }
  const pijp = library('de-pijp'), ev = facts('steen-91-149', '236199', 'Eerste Jan Steenstraat');
  assert.match(scoreType(pijp.find(t => t.id === 'pijp-1879-five-low')!, ev).veto.join(), /built 18(89|90)/);
});

test('Oud-West: every library type now has a match block (only authored intents could use it before #113)', () => {
  const ow = library('oud-west');
  assert.ok(ow.length >= 14);
  for (const t of ow) assert.ok(t.match && t.match.note, t.id);
  const infill = ow.find(t => t.id === 'kinker-1985-infill')!;
  assert.deepEqual(scoreType(infill, facts('kinker-112-116', '164444', 'Kinkerstraat')).veto.length > 0, true, 'an 1880s-1890s pand is not 1980s infill');
});
