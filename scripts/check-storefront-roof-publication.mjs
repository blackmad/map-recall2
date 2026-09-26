import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {matchingVisualReview} from './da-costa-block/visual-review.mjs';
const root='.cache/da-costa-neighbourhood',data=JSON.parse(await fs.readFile('public/data/da-costa-block/neighbourhood.json'));
const roof=JSON.parse(await fs.readFile(root+'/self-review-2026-09-09/storefront-roof-findings.json')).records,ground=JSON.parse(await fs.readFile(root+'/blind-storefront-2026-09-09/findings.json'));
for(const row of roof){
  const r=data.records.find(r=>r.id===row.id),g=ground.find(r=>r.id===row.id);
  assert.ok(matchingVisualReview([row],r,r.images.aerial));assert.ok(r.visualReview.sourceReviewCount>=2);
  for(const key of ['roofShape','facadeTop'])assert.equal(r.effectiveProposal[key],row.proposal[key]);
  for(const key of ['shopfront','awning','visibleSignText'])assert.equal(r.effectiveProposal[key],g.proposal[key],'Roof publication leaves independent ground finding unchanged');
  assert.equal(r.review,null,'Machine findings must not create human review');
}
assert.equal(roof.filter(r=>r.fieldEligibility.roofShape).length,4);
console.log('Passed: six frozen roof packets merge into active evidence; four roof shapes, two facade tops, unchanged ground fields and no human labels.');
