import test from 'node:test';
import assert from 'node:assert/strict';
import { assessStreetAppearanceSourceAdmission, type StreetAppearanceSourceAudit } from './survey-admission.ts';
const passing:StreetAppearanceSourceAudit={surveyRevisionMatches:true,admissionRecorded:true,sourceMismatches:[],admissionMismatches:[],localStreetMaskChanges:[],splitPaletteChanges:[],splitExtraFronts:[],profiles:[{id:'street',reproduces:true,missingAtRuntime:[]}]};
test('source admission is a bounded prerequisite for visual review',()=>assert.deepEqual(assessStreetAppearanceSourceAdmission(passing),{readyForVisualReview:true,failures:[]}));
test('outdated geometry, facts, source ownership and renderer revisions fail publication admission',()=>{
 for(const failing of [{surveyRevisionMatches:false},{admissionRecorded:false},{sourceMismatches:['geometry.gz']},{sourceMismatches:['facts.gz']},{admissionMismatches:['compiler.ts']},{admissionMismatches:['models.json']}])assert.equal(assessStreetAppearanceSourceAdmission({...passing,...failing}).readyForVisualReview,false);
});
test('street geometry truncation, phantom cohorts and unstable streaming fail admission',()=>{
 for(const failing of [{localStreetMaskChanges:['front']},{splitPaletteChanges:[{id:'front'}]},{splitExtraFronts:['new-front']},{profiles:[{id:'street',reproduces:false,missingAtRuntime:[]}]},{profiles:[{id:'street',reproduces:true,missingAtRuntime:['back-front']}]}])assert.equal(assessStreetAppearanceSourceAdmission({...passing,...failing}).readyForVisualReview,false);
});
