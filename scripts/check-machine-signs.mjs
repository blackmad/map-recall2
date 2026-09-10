import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {machineSignCandidate} from '../public/canal-drive/da-costa-block/machine-signs.js';
const image={file:'wall.jpg',sha256:'image-digest',panoramaSha256:'original-digest'};
const record={id:'wall',derivationKey:'current',renderBuildingId:'building',images:{full:image},visualReview:{origin:'agent-visual-review',derivationKey:'current',buildingMatch:'yes',appearanceEligible:true,cropQuality:'usable',images:[image],fieldEligibility:{shopfront:true,visibleSignText:true}},effectiveProposal:{wholeUsable:'yes',shopfront:'yes',visibleSignText:'Literal shop text'},proposalSources:{visibleSignText:'agent-visual-review'}};
assert.equal(machineSignCandidate(record).eligible,true);
for(const patch of [
  {visualReview:null},
  {visualReview:{...record.visualReview,origin:'human-review'}},
  {visualReview:{...record.visualReview,appearanceEligible:false}},
  {visualReview:{...record.visualReview,buildingMatch:'unknown'}},
  {visualReview:{...record.visualReview,cropQuality:'unusable'}},
  {visualReview:{...record.visualReview,derivationKey:'old'}},
  {visualReview:{...record.visualReview,images:[]}},
  {visualReview:{...record.visualReview,images:[{...image,sha256:'other'}]}},
  {visualReview:{...record.visualReview,images:[{...image,panoramaSha256:'other-original'}]}},
  {visualReview:{...record.visualReview,fieldEligibility:{shopfront:true,visibleSignText:false}}},
  {visualReview:{...record.visualReview,fieldEligibility:{shopfront:false,visibleSignText:true}}},
  {effectiveProposal:{...record.effectiveProposal,shopfront:'unknown'}},
  {effectiveProposal:{...record.effectiveProposal,wholeUsable:'no'}},
  {effectiveProposal:{...record.effectiveProposal,visibleSignText:''}},
  {effectiveProposal:{...record.effectiveProposal,visibleSignText:'x'.repeat(97)}},
  {proposalSources:{visibleSignText:'baseline'}},
  ...['rejected','uncertain','crop-repair'].map(placement=>({review:{placement}})),
])assert.equal(machineSignCandidate({...record,...patch}).eligible,false,JSON.stringify(patch));
assert.equal(machineSignCandidate(record,[{buildingId:'building'}]).reason,'authored-building');
assert.equal(machineSignCandidate({...record,effectiveProposal:{...record.effectiveProposal,visibleSignText:'slijterij STERK'}},[{buildingId:'elsewhere',sign:'STERK'}]).reason,'authored-business');
assert.equal(machineSignCandidate({...record,effectiveProposal:{...record.effectiveProposal,visibleSignText:'Sterkman'}},[{buildingId:'elsewhere',sign:'STERK'}]).eligible,true,'business matching uses complete words');
const data=JSON.parse(await fs.readFile('public/data/da-costa-block/neighbourhood.json'));
const block=JSON.parse(await fs.readFile('public/data/da-costa-block/block.json'));
// Public projection must retain compact source bindings even when no sign is eligible.
// Otherwise a publisher field trim silently turns the entire strict preview off.
for(const r of data.records.filter(r=>r.visualReview)){
  assert.equal(r.visualReview.derivationKey,r.derivationKey,'published review must retain its derivation binding: '+r.id);
  assert.ok(Array.isArray(r.visualReview.images)&&r.visualReview.images.length>0,'published review must retain referenced image hashes: '+r.id);
  const sources=[...Object.values(r.images),r.images.aerial?.context].filter(Boolean);
  for(const image of r.visualReview.images)assert.ok(sources.some(source=>source.file===image.file&&source.sha256===image.sha256&&(!image.panoramaSha256||image.panoramaSha256===source.panoramaSha256)),'published review source binding must remain resolvable: '+r.id);
}
const candidates=data.records.map(r=>({...machineSignCandidate(r,block.anchors),address:r.address}));
const eligible=candidates.filter(r=>r.eligible);
assert.ok(eligible.some(r=>r.text==='IJscuypje; ICE CREAM'));
assert.equal(eligible.some(r=>/sterk|scooter/i.test(r.text)),false,'existing authored businesses are not duplicated');
await fs.writeFile('.cache/da-costa-neighbourhood/machine-sign-candidates.json',JSON.stringify({eligible,candidates},null,2)+'\n');
console.log(JSON.stringify(eligible,null,2));
console.log('Passed: source/derivation/original-image binding, per-field direct-agent gates, withheld placement, literal bounded text and authored landmark deduplication.');
