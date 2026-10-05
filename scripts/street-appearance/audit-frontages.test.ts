import test from 'node:test';
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
