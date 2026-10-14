/**
 * Recipe facts on the trusted ground (bag3dCityJson.ts `pandGroundNap`), named regression Nassaukade 63X
 * (NL.IMBAG.Pand.0363100012124441): 3DBAG's ground −9.67 NAP under a +5.9 roof stood the box 15.6 m tall in the
 * Singelgracht. Its nearest ordinary neighbour (0363100012207164) must come out byte-identical.
 *   node --import tsx --test src/canalRecall/buildingRecipe/groundTrust.test.ts
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildFacts, regroundFacts, trustFactsGround, type CityJsonItem} from './facts.ts';
import {sharedTerrain} from '../../../scripts/lib/terrainField.ts';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/bag3d-nassaukade-63x.json', import.meta.url), 'utf8')) as {outlier: CityJsonItem; ordinary: CityJsonItem};
const meta = {threeDBag: 'fixture', fetchedAt: '2026-10-14', streets: 'none'};
const facts = (item: CityJsonItem, terrain: boolean) => buildFacts(Object.keys(item.feature.CityObjects)[0].slice(-16), item, [], [], () => [0, 0], meta, {walls: true, terrainAt: terrain ? sharedTerrain() : undefined});

test('buildFacts: Nassaukade 63X measures its heights from the terrain, not the failed −9.67 NAP', () => {
  const raw = facts(fixture.outlier, false), trusted = facts(fixture.outlier, true);
  assert.ok(Math.abs(raw.heights.dak70pM - 15.57) < 0.01, `raw ${raw.heights.dak70pM}`);
  assert.ok(Math.abs(trusted.heights.groundNAP - 0.47) < 0.01, `ground ${trusted.heights.groundNAP}`);
  assert.ok(Math.abs(trusted.heights.dak70pM - 5.42) < 0.01, `height ${trusted.heights.dak70pM}`);
  assert.equal(trusted.heights.groundSource, 'terrain');
  assert.equal(trusted.attributes.b3_h_maaiveld, raw.attributes.b3_h_maaiveld, 'attributes stay as 3DBAG publishes them');
  // LoD2.2 walls are measured from the same ground: their tops sit at the roof, not 10 m higher.
  assert.ok(Math.max(...trusted.wallsRD!.map(w => w.topM)) < 6, `wall top ${Math.max(...trusted.wallsRD!.map(w => w.topM))}`);
});

test('buildFacts: an ordinary pand is identical with and without the terrain', () => {
  assert.deepEqual(facts(fixture.ordinary, true), facts(fixture.ordinary, false));
});

test('trustFactsGround: a facts.json built before the rule is re-measured to what buildFacts now writes; idempotent', () => {
  const terrainAt = sharedTerrain();
  const old = facts(fixture.outlier, false), now = facts(fixture.outlier, true), fixed = trustFactsGround(old, terrainAt);
  const close = (a: unknown, b: unknown): boolean => typeof a === 'number' ? Math.abs(a - (b as number)) < 1e-9
    : Array.isArray(a) ? a.length === (b as unknown[]).length && a.every((x, i) => close(x, (b as unknown[])[i]))
    : a && typeof a === 'object' ? Object.keys(a).length === Object.keys(b as object).length && Object.entries(a).every(([k, v]) => close(v, (b as Record<string, unknown>)[k])) : a === b;
  assert.ok(close(fixed, now), 'same heights, fronts and walls as a fresh build');
  assert.equal(trustFactsGround(fixed, terrainAt), fixed, 'already trusted: the same object');
  const ordinary = facts(fixture.ordinary, false);
  assert.equal(trustFactsGround(ordinary, terrainAt), ordinary, 'ordinary: the same object');
  assert.equal(trustFactsGround(old), old, 'no terrain field: unchanged');
});

test('regroundFacts: every ground-relative height moves, absolute NAP geometry stays', () => {
  const f = {...facts(fixture.outlier, false), measuredEavesM: {a: 15}, canopyM: {a: {bottomM: 3, joinLeft: false, joinRight: true}}};
  const g = regroundFacts(f, f.heights.groundNAP + 2);
  assert.equal(g.heights.roofMaxM, f.heights.roofMaxM - 2);
  assert.equal(g.measuredEavesM!.a, 13);
  assert.equal(g.canopyM!.a.bottomM, 1);
  assert.equal(g.wallsRD![0].topM, f.wallsRD![0].topM - 2);
  assert.deepEqual(g.roofsRD, f.roofsRD);
  assert.equal(g.heights.groundSource, undefined);
});
