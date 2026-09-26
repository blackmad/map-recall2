/**
 * Named regression for the vertical geometry of the reviewed roofs.
 *
 * Why this exists: the 21 Sep 25-case review grouped case-01/05 as "roof shape
 * too high/asymmetric" and case-19/27 as "missing roof". Rendering and
 * measuring the four reviewed owners shows three separate, source-measured
 * defects rather than one:
 *
 * 1. The v2 release subtracted NAP ground directly from the owner's scene-local
 *    `up` axis (`NAP - 0.65 m`, per `wallVerticalExtent` / `wallTopNAP`). That
 *    made every published roof height 0.65 m too low. The v3 compiler converts
 *    `up` into NAP first and requires a versioned study-roof regeneration. On
 *    the exact 7,395-building source block pinned by the current release, this
 *    changes selected roof components on 682 buildings.
 * 2. `case-01` Rozengracht 158 has a near-flat 3DBAG roof (relief 0.14 m, below
 *    `SOURCE_ROOF_MIN_RELIEF_M` 0.25), so the whole roof is withheld and the
 *    render is a flat cap. That is a data limitation: the source gable is not in
 *    3DBAG.
 * 3. `case-05` Lauriergracht 67/69 has a source vertex 2.38 m above its own BAG
 *    ridge (`.cache/reconstruction-loop-20260921/pass-3-report.md`), which is the
 *    "roof too high into the sky" spike. It sits inside the 3 m overshoot gate,
 *    so the policy keeps it.
 *
 * This pins the measured facts so the roof lane cannot regress silently and so
 * a future regeneration can assert the corrected behaviour. It does not change
 * any published data. Run: npx tsx scripts/review/check-reviewed-roof-vertical.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  selectCompatibleSourceRoof,
  sourceRoofUpAboveGroundNAP,
  SOURCE_ROOF_SCENE_TO_NAP_OFFSET_M,
  SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M,
  SOURCE_ROOF_MIN_EAVE_RATIO,
  SOURCE_ROOF_MIN_RELIEF_M,
} from '../../src/canalRecall/cityAppearanceRoofs.ts';

const LEGACY_DATUM = 'legacy-block-NAP-minus-0.65m';
const SCENE_TO_NAP_OFFSET_M = SOURCE_ROOF_SCENE_TO_NAP_OFFSET_M;

const data = JSON.parse(fs.readFileSync('public/data/facade-repair-preview/cases.json', 'utf8'));
const caseById = (id: string) => {
  const entry = data.cases.find((item: any) => item.caseId === id);
  assert.ok(entry, `${id} missing from the review packet`);
  return entry;
};
const near = (actual: number, expected: number, tolerance: number, label: string) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`,
  );

interface RoofFacts {
  groundNAP: number;
  height: number;
  sceneEave: number;
  sceneRidge: number;
  selectedSceneEave: number;
  relief: number;
  overshootAboveBagRidge: number;
  publishedEaves: number | null;
  selectedComponents: number;
}

function factsFor(caseId: string): RoofFacts {
  const owner = caseById(caseId).owner;
  assert.equal(
    owner.geometry.frame.heightDatum,
    LEGACY_DATUM,
    `${caseId} is expected to sit in the legacy block datum`,
  );
  const building = owner.geometry.building;
  const roofSurfaces = (building.surfaces ?? []).filter((s: any) => s.type === 'roof');
  const components = roofSurfaces.map((s: any) =>
    s.rings.flat().map((p: any) => p[1]),
  );
  const ups = components.flat();
  const sceneEave = Math.min(...ups);
  const sceneRidge = Math.max(...ups);
  // Replicate the v3 gates on the converted values, so the selected eave (not
  // the global roof eave) is what this check pins.
  const selected = components
    .map((component: number[]) => {
      const eaves = sourceRoofUpAboveGroundNAP(Math.min(...component), building.groundNAP);
      const ridge = sourceRoofUpAboveGroundNAP(Math.max(...component), building.groundNAP);
      return { eaves, ridge, rawEave: Math.min(...component) };
    })
    .filter(
      (component: any) =>
        component.eaves >= building.height * SOURCE_ROOF_MIN_EAVE_RATIO &&
        component.ridge <= building.height + SOURCE_ROOF_MAX_RIDGE_OVERSHOOT_M &&
        component.ridge > component.eaves + SOURCE_ROOF_MIN_RELIEF_M,
    );
  const selection = selectCompatibleSourceRoof(building);
  return {
    groundNAP: building.groundNAP,
    height: building.height,
    sceneEave,
    sceneRidge,
    selectedSceneEave: selected.length ? Math.min(...selected.map((c: any) => c.rawEave)) : NaN,
    relief: sceneRidge - sceneEave,
    overshootAboveBagRidge: sceneRidge + SCENE_TO_NAP_OFFSET_M - (building.groundNAP + building.height),
    publishedEaves: selection?.eaves ?? null,
    selectedComponents: selection?.surfaces.length ?? 0,
  };
}

// --- 1. The scene-to-NAP correction is systematic and measurable ----------
for (const caseId of ['case-01', 'case-05', 'case-19', 'case-27']) {
  const facts = factsFor(caseId);
  if (facts.publishedEaves === null) continue;
  // Published eaves first convert scene-local `up` to NAP, then subtract NAP
  // ground. Pin the selected value and the explicit 0.65 m correction.
  near(
    facts.publishedEaves,
    facts.selectedSceneEave + SCENE_TO_NAP_OFFSET_M - facts.groundNAP,
    0.01,
    `${caseId} published eave uses corrected NAP datum`,
  );
  near(
    facts.publishedEaves - (facts.selectedSceneEave - facts.groundNAP),
    SCENE_TO_NAP_OFFSET_M,
    0.01,
    `${caseId} publication raises eave by the scene-to-NAP offset`,
  );
}

// --- 2. case-01 has no 3DBAG roof relief, so the roof is withheld ---------
{
  const facts = factsFor('case-01');
  near(facts.relief, 0.14, 0.02, 'case-01 source roof relief (near-flat 3DBAG surface)');
  assert.ok(
    facts.relief < SOURCE_ROOF_MIN_RELIEF_M,
    'case-01 relief must stay below the minimum-relief gate so the withholding is explained',
  );
  // If case-01 ever gains a roof the near-flat source surface changed; re-review
  // the gable rather than trusting this check.
  assert.equal(facts.publishedEaves, null, 'case-01 has no compatible source roof');
}

// --- 3. case-05 carries a vertex well above its own BAG ridge -------------
{
  const facts = factsFor('case-05');
  near(facts.overshootAboveBagRidge, 2.38, 0.05, 'case-05 roof overshoot above the BAG ridge');
  assert.ok(
    facts.overshootAboveBagRidge > 2,
    'case-05 "roof too high into the sky" is a real source overshoot, not a display error',
  );
  assert.ok((facts.publishedEaves ?? 0) > 0, 'case-05 still publishes a compatible source roof');
  assert.equal(facts.selectedComponents, 6, 'case-05 selected roof-component count changed');
}

// --- 4. case-19 / case-27 publish roofs, and pin their measured eaves -----
{
  const nineteen = factsFor('case-19');
  near(nineteen.publishedEaves ?? NaN, 14.77, 0.02, 'case-19 corrected published eave');
  near(nineteen.overshootAboveBagRidge, 0.41, 0.03, 'case-19 overshoot above BAG ridge');
  const twentySeven = factsFor('case-27');
  near(twentySeven.publishedEaves ?? NaN, 11.45, 0.05, 'case-27 corrected published eave');
  near(twentySeven.overshootAboveBagRidge, 0.16, 0.03, 'case-27 overshoot above BAG ridge');
}

console.log(
  'Reviewed roof vertical regression passed: v3 converts scene-local roof heights to NAP before ground-relative publication; case-01 is withheld for 0.14 m relief; case-05 overshoots its BAG ridge by 2.38 m; case-19/27 corrected heights pinned.',
);
