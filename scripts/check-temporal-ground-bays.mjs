/** Read-only interval/provenance regression, including fail-closed frozen inputs. */
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {assertFrozenInput,readFrozenJson} from './da-costa-block/review-input-pins.mjs';
const root='.cache/da-costa-ground-bays-temporal-2026-09-09',pin='38d12eaa4fa5e0d36dbd0daeb8d94364093ae1b5f864e85f918355771451830d';
const source=await readFrozenJson(root+'/manifest.json',pin),findings=JSON.parse(await fs.readFile(root+'/findings.json'));
const previous=JSON.parse(await fs.readFile('.cache/da-costa-ground-bays/manifest.json'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(findings.reviewedPacketSha256,pin);assert.equal(source.summary.downloads,0);assert.equal(source.summary.costUsd,0);assert.equal(source.records.length,5);
let imageChecks=0;
for(const r of source.records){
  const prior=previous.records.find(p=>p.id===r.id),finding=findings.records.find(f=>f.id===r.id);assert.ok(prior&&finding);
  assert.deepEqual(r.interval,prior.interval);assert.deepEqual(r.wall,prior.wall);assert.equal(r.parentIntervalDerivationKey,prior.derivationKey);assert.equal(r.parentDerivationKey,prior.parentDerivationKey);
  assert.ok(r.alternatives.length<=3);assert.equal(new Set(r.alternatives.map(a=>a.date.slice(0,4))).size,r.alternatives.length);
  assert.equal(finding.appearanceEligible,false);assert.equal(finding.localProposal.shopfront,'unknown');assert.equal(finding.localFieldEligibility.shopfront,false);
  for(const a of r.alternatives){
    assert.equal(a.visibility.geometryEligible,true);assert.equal(sha(await fs.readFile(a.panoramaFile)),a.panoramaSha256);
    assert.deepEqual(a.crops.ground.plane.start,r.wall.start);assert.deepEqual(a.crops.ground.plane.end,r.wall.end);
    for(const im of Object.values(a.crops)){assert.equal(sha(await fs.readFile(root+'/images/'+im.file)),im.sha256);imageChecks++;}
    const c=a.crops.originalContext.sourcePixelCrop;assert.ok(c.left>=0&&c.top>=0&&c.left+c.width<=a.sourceDimensions[0]&&c.top+c.height<=a.sourceDimensions[1]);
  }
}
assert.equal(findings.records.filter(r=>r.localFieldEligibility.entrancePresent).length,2);
assertFrozenInput('unchanged temporal packet',JSON.stringify(source,null,2),pin);
for(const mutate of [x=>{x.records[0].interval.startM+=.1;},x=>{x.records[0].parentDerivationKey='changed';},x=>{x.records[0].alternatives[0].crops.ground.sha256='0'.repeat(64);},x=>{x.records[0].alternatives[0].panoramaSha256='0'.repeat(64);}]){const altered=structuredClone(source);mutate(altered);assert.throws(()=>assertFrozenInput('temporal packet',JSON.stringify(altered,null,2),pin),/Frozen reviewed input changed/);}
console.log(JSON.stringify({passed:true,intervals:5,alternatives:15,cropHashesChecked:imageChecks,frozenMutationsRejected:4,wholeWallPromotions:0,downloads:0}));
