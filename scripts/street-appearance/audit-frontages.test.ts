import test from 'node:test';
// Re-recorded 2026-10-14 with bake-frontages.ts: 57a49cee retired the Jan Evertsen profile but left its street paths and tile 8412/5384 (re-keyed in 870a8bed) in the survey; every remaining cohort's frontages are byte-identical after the rebake.
// Re-recorded again the same day after fix-bag-ground-outliers.ts re-measured pands with a failed 3DBAG ground in tiles 8414/5383, 8414/5384, 8415/5384; profiles.json unchanged.
// Re-recorded again 2026-10-14 after the terrain rule's reach test (bag3dCityJson.ts GROUND_REACH_M) restored split-level pands in tiles 8414/5383 and 8415/5384; frontages and profiles.json unchanged, only the tile hashes.
// Re-recorded 2026-10-28 after the facade touch LOD (#92, threeBuilding* sources) and landmark installs (signature-landmarks.json) changed admission inputs; frontages byte-identical, only the four input hashes moved.
// Re-recorded 2026-10-29 after #94 (generic stair-glass removed from facadeExtras.ts; Beurs and Bijenkorf in signature-landmarks.json); frontages byte-identical, only input hashes moved.
// Re-recorded 2026-10-29 after #95 (four Noord landmarks rebuilt; one halo feature now under a landmark footprint, features 360 -> 359); every cohort byte-identical.
// Re-recorded 2026-10-29 after #99 (Stationsplein paviljoens added, Beurs and Centraal rebuilt in signature-landmarks.json); frontages byte-identical, only input hashes moved.
// Re-recorded 2026-10-29 after #100 follow-up (threeBuildingsBrowser.ts span/tile draw ranges); frontages byte-identical, only input hashes moved.
import assert from 'node:assert/strict';
import { auditFrontages } from './audit-frontages.ts';
import { assessStreetAppearanceSourceAdmission } from './survey-admission.ts';
test('installed baked street cohorts reproduce from current surveyed inputs and survive streamed subsets',async()=>{
 const audit=await auditFrontages();
 assert.ok(audit.features>0&&audit.maskedRuns>0,'audit must replay actual installed geometry');
 assert.ok(audit.profiles.length>0&&audit.profiles.every(profile=>profile.reproduces),'all profile cohorts must reproduce');
 assert.deepEqual(audit.splitPaletteChanges,[],'streaming must preserve admitted building palette');
 assert.deepEqual(audit.localStreetMaskChanges,[],'compact street geometry must preserve full source visibility');
 const admission=assessStreetAppearanceSourceAdmission(audit);
 assert.equal(admission.readyForVisualReview,true,admission.failures.join('; '));
});
