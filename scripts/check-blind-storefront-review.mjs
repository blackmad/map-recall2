import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {matchingVisualReview,applyVisualProposal} from './da-costa-block/visual-review.mjs';
const root='.cache/da-costa-neighbourhood/blind-storefront-2026-09-09/';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const packetBytes=await fs.readFile(root+'frozen-packets.json'),decisionBytes=await fs.readFile(root+'frozen-blind-decisions.json');
assert.equal(sha(packetBytes),'3df76f6433d094c4fa71a99111776895d429c77d958f0a6adf27259578a89615');
assert.equal(sha(decisionBytes),'fb174ea28cf46b5d5003fd054582b3d116bfd3f1de19d6ef485e92c47e711c50');
const packets=JSON.parse(packetBytes).packets,findings=JSON.parse(await fs.readFile(root+'findings.json'));
const manifest=JSON.parse(await fs.readFile('.cache/da-costa-neighbourhood/manifest.json'));
const mapping=JSON.parse(await fs.readFile(root+'sealed-baseline-mapping.json'));
assert.equal(findings.length,10);assert.equal(new Set(findings.map(r=>r.buildingId)).size,10);
for(const row of findings){
  const p=packets.find(p=>p.number===row.blindNumber),record=manifest.records.find(r=>r.id===row.id);
  assert.equal(row.humanReviewed,false);assert.equal(row.metricEligible,false);assert.equal(row.needsReview,true);
  assert.equal(row.packetSha256,sha(packetBytes));assert.equal(row.decisionsSha256,sha(decisionBytes));
  assert.deepEqual(row.images,p.images.map(({frozenFile,...m})=>m));
  for(const m of p.images){assert.equal(sha(await fs.readFile(root+m.frozenFile)),m.sha256);assert.ok(m.date);}
  assert.ok(matchingVisualReview([row],record));
  assert.equal(matchingVisualReview([row],{...record,derivationKey:'stale'}),null);
  const corrupt=structuredClone(row);corrupt.images[0].sha256='changed';assert.equal(matchingVisualReview([corrupt],record),null);
  const effective=applyVisualProposal(mapping.find(m=>m.id===row.id).baseline,row);
  assert.equal(effective.proposal.shopfront,row.proposal.shopfront);
  assert.equal(effective.proposal.awning,row.proposal.awning);
  assert.equal(effective.proposal.roofShape,'unknown'); // Street appearance does not establish roof volume.
}
const awnings=JSON.parse(await fs.readFile(root+'awning-observations-v1.json'));
assert.match(awnings.stage,/post-freeze/);assert.equal(awnings.sourceDecisionsSha256,sha(decisionBytes));
assert.equal(awnings.records.length,10);
for(const r of awnings.records){
  assert.ok(matchingVisualReview([r],manifest.records.find(m=>m.id===r.id)));
  const a=r.awningObservation;
  assert.equal(a.renderDeployedFabricEligible,a.kind==='fabric'&&a.observedDeployment==='deployed');
  if(a.kind==='rigid-canopy'){assert.equal(a.fabricAwningPresence,'no');assert.equal(a.fixed,true);}
  assert.equal(r.humanReviewed,false);
}
assert.deepEqual(awnings.records.filter(r=>r.awningObservation.renderDeployedFabricEligible).map(r=>r.blindNumber),['04','09']);
assert.equal(awnings.records.find(r=>r.blindNumber==='07').awningObservation.observedDeployment,'retracted');
console.log('PASS: 10 unique current source-bound findings; 40 frozen image hashes; stale derivation/pixel rejection; field abstentions survive integration; awning type/deployment sidecar; no human labels.');
