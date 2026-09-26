/**
 * Named regression for the ground-floor retail lane on the real reviewed crops.
 *
 * Why this exists: the 21 Sep user review grouped cases 02/11/29 as
 * "missing storefront/business window" and cases 05/09/21 as "missing door".
 * Feeding the real extracted ground features through `assembleStorefront` shows
 * the systematic cause: the ground band tested the feature *centre*, so a tall
 * ground door or shop window whose centre sat above 60% of the crop was dropped
 * and the whole storefront returned null. This check pins the measured
 * assemblies on the reviewed features so a future band change is caught.
 *
 * case-21 stays a documented residual: its Fietsenmaker display windows are
 * portrait (taller than wide) and the lane deliberately requires landscape
 * display glazing, so it still returns null here; its doors are rendered by the
 * general observed-door path, not this lane.
 *
 * case-09 was the "missing door" case whose candidate was blank because no
 * published wall surface covered its registered frontage. That is now delivered
 * by the registered-frontage fallback (see
 * `scripts/review/check-reviewed-frontage-fallback.ts`), so this lane no longer
 * treats it as a retail blocker.
 *
 * Run: npx tsx scripts/review/check-retail-ground-assembly.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assembleStorefront } from '../../src/canalRecall/facade/storefrontAssembly.ts';
import { retailPatchesFromSource } from '../../src/canalRecall/facade/retailPatches.ts';

const data = JSON.parse(fs.readFileSync('public/data/facade-repair-preview/cases.json', 'utf8'));
const caseById = (id: string) => {
  const entry = data.cases.find((item: any) => item.caseId === id);
  assert.ok(entry, `${id} missing from the review packet`);
  return entry;
};

// Storefront fronts recovered by the band fix: entrance + landscape display
// glazing; 02/11 additionally carry the literal fascia sign.
const storefronts: Record<string, { entrance: string; sign: string | null }> = {
  'case-02': { entrance: 'ground:door-01', sign: 'BAGELS & BEANS BAGELS, COFFEE & HAPPINESS' },
  'case-05': { entrance: 'ground:door-1', sign: null },
  'case-11': { entrance: 'ground:door-1', sign: 'Sunny Bites' },
  'case-29': { entrance: 'ground:door-main', sign: 'DORUS' },
};
for (const [caseId, expected] of Object.entries(storefronts)) {
  const ground = caseById(caseId).shapeFeatures?.ground;
  assert.ok(ground, `${caseId} must carry ground shape features`);
  const assembly = assembleStorefront(ground.features);
  assert.ok(assembly, `${caseId} must assemble a storefront after the band fix`);
  assert.equal(assembly.entrance?.id, expected.entrance, `${caseId} entrance changed`);
  assert.ok(assembly.displayWindows.length > 0, `${caseId} must keep display glazing`);
  assert.equal(assembly.signText, expected.sign, `${caseId} fascia sign text changed`);
  const compiled = retailPatchesFromSource(
    { features: ground.features, imageDimensions: { width: ground.width, height: ground.height } },
    { widthM: 6, heightM: 8 },
  );
  assert.ok(compiled, `${caseId} must compile retail patches`);
  assert.ok(compiled.hasEntrance && compiled.hasDisplayWindow, `${caseId} retail summary regressed`);
}

// Residual: portrait display glazing keeps case-21 out of the retail lane.
{
  const ground = caseById('case-21').shapeFeatures?.ground;
  assert.ok(ground, 'case-21 must carry ground shape features');
  assert.equal(assembleStorefront(ground.features), null, 'case-21 portrait-display residual changed');
  const portrait = ground.features.filter(
    (f: any) => f.kind === 'window' && f.bounds[2] - f.bounds[0] <= f.bounds[3] - f.bounds[1],
  );
  assert.ok(portrait.length > 0, 'case-21 is expected to expose portrait display windows');
}

// case-09's frontage fallback is pinned in check-reviewed-frontage-fallback.ts;
// it is deliberately not re-asserted here to keep this lane about the band fix.

console.log(
  `Retail ground assembly regression passed: ${Object.keys(storefronts).length} reviewed storefronts assemble; case-21 portrait-display residual pinned.`,
);
