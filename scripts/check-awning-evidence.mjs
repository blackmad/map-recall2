import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {sourceBoundAwning,mayRenderReviewedAwning,awningEvidenceSummary} from '../public/canal-drive/da-costa-block/awning-evidence.js';
const data=JSON.parse(await fs.readFile('public/data/da-costa-block/neighbourhood.json'));
const awnings=data.records.filter(r=>r.awningEvidence);assert.equal(awnings.length,10);
for(const r of awnings){
  const a=sourceBoundAwning(r);assert.ok(a);
  assert.equal(mayRenderReviewedAwning(r),false,'machine observation is not human approval');
  const reviewed={...r,review:{placement:'accepted',targetId:r.id},effectiveProposal:{...r.effectiveProposal,awning:'yes'}};
  assert.equal(mayRenderReviewedAwning(reviewed),a.presence==='yes'&&a.fabricAwningPresence==='yes'&&a.kind==='fabric'&&a.observedDeployment==='deployed');
  const stale=structuredClone(reviewed);stale.awningEvidence.images[0].sha256='stale';assert.equal(sourceBoundAwning(stale),null);assert.equal(mayRenderReviewedAwning(stale),false);
  assert.equal(mayRenderReviewedAwning({...reviewed,review:{placement:'accepted',targetId:'other-wall'}}),false,'source deployment cannot transfer across placement correction');
  assert.equal(mayRenderReviewedAwning({...reviewed,awningEvidence:null}),false,'presence label alone cannot deploy an invented canopy');
  assert.equal(mayRenderReviewedAwning({...reviewed,awningEvidence:{...r.awningEvidence,derivationKey:'old'}}),false);
  assert.equal(mayRenderReviewedAwning({...reviewed,effectiveProposal:{...r.effectiveProposal,awning:'no'}}),false);
  for(const deployment of ['unknown','retracted','mixed','not-applicable'])assert.equal(mayRenderReviewedAwning({...reviewed,review:{...reviewed.review,awningKind:'fabric',awningDeployment:deployment}}),false,'explicit human non-deployment beats machine proposal');
  assert.equal(mayRenderReviewedAwning({...reviewed,awningEvidence:null,review:{...reviewed.review,awningKind:'fabric',awningDeployment:'deployed'}}),true,'explicit same-wall human construction/deployment needs no machine agreement');
  assert.equal(mayRenderReviewedAwning({...reviewed,review:{...reviewed.review,awningKind:'rigid',awningDeployment:'deployed'}}),false);
  assert.equal(mayRenderReviewedAwning({...reviewed,review:{...reviewed.review,targetId:'other-wall',awningKind:'fabric',awningDeployment:'deployed'}}),false);
}
const chai=awnings.find(r=>r.effectiveProposal.visibleSignText==='Chai kitchen');
assert.equal(sourceBoundAwning(chai).observedDeployment,'retracted');assert.match(awningEvidenceSummary(chai),/Installation does not imply deployed fabric/);
const iwka=awnings.find(r=>r.effectiveProposal.visibleSignText==='IWKA');assert.equal(sourceBoundAwning(iwka).kind,'rigid-canopy');assert.equal(iwka.effectiveProposal.awning,'no');
assert.equal(awnings.filter(r=>sourceBoundAwning(r).observedDeployment==='deployed').length,2);
console.log('Passed: 10 source-bound awning states; only two deployed-fabric observations, separate human gate, retracted/rigid/unknown and moved/stale-source protection. No reviews written.');
