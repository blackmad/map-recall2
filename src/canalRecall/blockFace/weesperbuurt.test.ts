/**
 * Weesperbuurt / Sarphatistrook library (scripts/block-face/types/weesperbuurt): measured evidence on every type, and
 * `match.columnsUnscored` (the strip's window-column count is no evidence where a wide two-light window and a narrow
 * one read 3-6 columns per house). Absent = scored, byte-identical.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync, readFileSync} from 'node:fs';
import {defaultTypeLoader} from './typeLibrary.ts';
import {frontEavesFor, scoreType, type MatchableType} from './autoPlace.ts';

test('the Weesperbuurt library loads and its types carry measured evidence', () => {
  const dir = new URL('../../../scripts/block-face/types/weesperbuurt/', import.meta.url);
  const types = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
  assert.ok(types.length >= 1);
  for (const t of types) assert.ok(t.evidence?.length, `${t.id}: evidence`);
});

test('columnsUnscored drops the columns criterion', () => {
  const t = defaultTypeLoader('sarphati-1910-arched-tower-pair') as MatchableType;
  assert.equal(t.match!.columnsUnscored, true);
  const strip = {wall: '#8a5a42', wallRaw: '#8a5a42', skyline: null, skyBound: null, stucco: false, bands: 0, columns: 6, frontClass: 'columns', doorSide: null, accentSide: null, accentShare: 0.1, structure: null, voidShare: 0.1, foliageShare: 0.1, palette: {stucco: false, shares: {accent: 0.1}}} as never;
  const ev = {pandId: 'p', address: 'a', builtYear: 1910, widthM: 6.5, eavesM: 14.4, roofMaxM: 17.3, storeys3dbag: 5, groundUses: [], osm: [], strip} as never;
  const off = scoreType(t, ev).criteria.some(c => c.key === 'columns');
  const on = scoreType({...t, match: {...t.match!, columnsUnscored: undefined}} as MatchableType, ev).criteria.some(c => c.key === 'columns');
  assert.ok(on, 'the same evidence with the flag removed scores columns');
  assert.ok(!off);
});

test('frontEavesFixed draws the house at the line even where the skyline reads within tolerance', () => {
  const t = defaultTypeLoader('sarphati-1910-arched-tower-pair') as MatchableType;
  assert.equal(t.match!.frontEavesFixed, true);
  const sky = {eavesM: 15.2, eavesRow: 400, confidence: 1, crown: null};
  const ev = {pandId: 'p', address: 'a', builtYear: 1910, widthM: 6.5, eavesM: 14.4, roofMaxM: 17.3, storeys3dbag: 5, groundUses: [], osm: [], strip: {skyline: sky}} as never;
  assert.deepEqual(frontEavesFor(t, ev), {eavesM: 14.4, source: 'type'});
  const loose = {...t, match: {...t.match!, frontEavesFixed: undefined}} as MatchableType;
  assert.deepEqual(frontEavesFor(loose, ev), {eavesM: 15.2, source: 'skyline'});
});

test('a staged face pand compiles from the face-planned facts: Sarphatistraat 169 keeps its flat front roof', async () => {
  // scripts/house-specs/face-facts.ts: the recipe route (house:publish step 3, resolved.ts) took the face's raw facts.json, whose
  // 3DBAG roof stood 3.9 m over the 14.3 m cornice; the face plan has roof source `front`, form flat, and the measured eaves.
  const {preparedFaceFacts, facesListing} = await import('../../../scripts/house-specs/face-facts.ts');
  const p = preparedFaceFacts('0363100012170677');
  assert.ok(p, 'listed by a face intent');
  assert.equal(p.face, 'sarphati-163-213-r1');
  assert.deepEqual((p.facts as any).roofSource?.forms, {front0: 'flat'});
  assert.ok(p.facts.measuredEavesM?.front0 && Math.abs(p.facts.measuredEavesM.front0 - 14.34) < 0.05);
  const roofTop = Math.max(...p.facts.roofsRD.flatMap(r => r.vertices.map(v => v[2])));
  assert.ok(roofTop - p.facts.heights.groundNAP < 15, `roof top ${roofTop} over ground ${p.facts.heights.groundNAP}`);
  // A pand on no face intent: null, and the caller falls back to blockFaceFactsFor / facts.ts (unchanged).
  assert.deepEqual(facesListing('0363100099999999'), []);
  assert.equal(preparedFaceFacts('0363100099999999'), null);
});
