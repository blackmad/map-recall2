/**
 * Haarlemmerbuurt belt specs (lane belt-haarlemmer, #356): the pinned faults of batch 1.
 *   node --import tsx --test src/canalRecall/houseSpec/beltHaarlemmer.test.ts
 *
 *  - Haarlemmerdijk 131 (0363100012173479) drew white: the register says stucco (monument-text, palette/wallMaterial), the spec stated only
 *    palette/brick, so the stronger-than-nothing register finish won and the generic path draws stucco as white plaster. The spec now states the
 *    painted-brick finish the photo shows (dark olive-brown), which outranks the register.
 *  - Haarlemmerdijk 131 held for `open-edges`: three step-wall edges (5.2 m) 4-6 cm apart at the rear party wall; `roof.stepWeld` closes them.
 *  - Haarlemmerdijk 133A (0363100012173480) had no crown: the pinned gable foot 9.2 m sat under the photo's shoulders (10.0 m) and the neck
 *    crown stood a column wide; the photo's bell crown reaches 12.3 m.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {trustFactsGround, type BuildingFacts} from '../buildingRecipe/facts.ts';
import {sharedTerrain} from '../../../scripts/lib/terrainField.ts';
import {compileBuilding} from '../buildingRecipe/compile.ts';
import {fitIntent} from '../buildingRecipe/fit.ts';
import {topology, type Tri} from '../buildingRecipe/gates.ts';
import {canalhouseGroupToGlb} from '../../../scripts/canalhouse-recipes/export-glb.ts';
import {decodeTriangles, slotFor} from '../../../scripts/building-recipes/compile.ts';
import {withFrontRoof} from '../buildingRecipe/houseFrontRoof.ts';
import {emptySpec, type HouseSpec} from './spec.ts';
import {resolveSpecs} from './resolve.ts';
import {toRecipe} from './toRecipe.ts';
import {specView} from './view.ts';

const read = <X>(p: string) => JSON.parse(fs.readFileSync(p, 'utf8')) as X;
const spec = (id: string) => read<HouseSpec>(`scripts/house-specs/specs/${id}.json`);
/** facts.ts output (building-recipes/facts.ts --pand) of the pand, as the recipe route's compile reads it. */
const facts = (id: string) => trustFactsGround(read<BuildingFacts>(`src/canalRecall/houseSpec/fixtures/belt-haarlemmer-${id}-facts.json`), sharedTerrain()); // as compileHouse reads them
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return (0.2126 * (n >> 16) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; };

test('131: the register finish stucco does not turn the dark front white', () => {
  const register = emptySpec('0363100012173479', 'Haarlemmerdijk 131');
  register.design = {palette: {wallMaterial: 'stucco'}};
  register.provenance['palette/wallMaterial'] = {source: 'monument-text', confidence: 0.8, ref: 'rce:register', at: null};
  const resolved = resolveSpecs([register, spec('0363100012173479')]);
  assert.equal(resolved.design.palette?.wallMaterial, 'painted-brick');
  const view = specView(resolved);
  assert.equal(view.wallMaterial, 'painted-brick');
  assert.ok(lum(view.wallHex!) < 0.35, `wall ${view.wallHex} stays dark`);
});

/** The gate's own triangles: the compiled group exported to GLB and decoded back (scripts/building-recipes/compile.ts `compileHouse`). */
const gateTriangles = async (intent: ReturnType<typeof toRecipe> & object, f: BuildingFacts): Promise<Tri[]> => {
  const built = compileBuilding(structuredClone(intent), f), glb = await canalhouseGroupToGlb(intent.id, built.group, {metreUvs: true, slotFor: slotFor(intent)});
  return decodeTriangles(glb.bytes);
};

test('131: roof.stepWeld closes the rear step walls (open-edges gate 5.2 m -> within 2 m), absent it changes nothing', async () => {
  const intent = toRecipe(spec('0363100012173479'))!;
  assert.equal(intent.roof.stepWeld, true);
  const without = structuredClone(intent); delete without.roof.stepWeld;
  // The open-edges gate (gates.ts) allows 2 m of genuine open edge.
  const before = topology(await gateTriangles(without, facts('0363100012173479'))), after = topology(await gateTriangles(intent, facts('0363100012173479')));
  assert.equal(before.openEdges, 3, 'the BAG rear jog leaves three open step-wall edges without the weld');
  assert.ok(before.openEdgeLengthM > 5 && after.openEdgeLengthM <= 2, `open edge ${before.openEdgeLengthM.toFixed(2)} m -> ${after.openEdgeLengthM.toFixed(2)} m`);
});

test('133A: the bell crown reaches the photographed 12.3 m over shoulders at 10.0 m', () => {
  const intent = toRecipe(spec('0363100012173480'))!, f = facts('0363100012173480');
  assert.equal(intent.fronts[0].gable, 'bell');
  const fit = fitIntent(intent, withFrontRoof(intent, f)).report.fronts[0];
  assert.equal(fit.eavesM, 10);
  assert.ok(Math.abs((fit.crownTopM ?? 0) - 12.3) <= 0.2, `crown top ${fit.crownTopM}`);
});
