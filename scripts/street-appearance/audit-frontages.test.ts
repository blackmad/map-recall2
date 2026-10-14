import test from 'node:test';
// Re-recorded 2026-10-14 with bake-frontages.ts: 57a49cee retired the Jan Evertsen profile but left its street paths and tile 8412/5384 (re-keyed in 870a8bed) in the survey; every remaining cohort's frontages are byte-identical after the rebake.
// Re-recorded again the same day after fix-bag-ground-outliers.ts re-measured pands with a failed 3DBAG ground in tiles 8414/5383, 8414/5384, 8415/5384; profiles.json unchanged.
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
