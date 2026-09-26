/** Read-only regression: old opinions must reject mutated packets, keys and hashes. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {assertFrozenInput,readFrozenJson,REVIEW_INPUT_PINS,expandedGroundStreetPacket} from './da-costa-block/review-input-pins.mjs';
const root='.cache/da-costa-neighbourhood/';
const cases=[
  ['street sample','self-review-2026-09-09/sample-sources.json',REVIEW_INPUT_PINS.streetSample,'sources'],
  ['roof packets','self-review-2026-09-09/roof-sources.json',REVIEW_INPUT_PINS.roofPackets,'images'],
  ['expanded aerial','aerial-expanded-2026-09-09/aerial.json',REVIEW_INPUT_PINS.expandedAerial,null],
];
let rejected=0;
for(const [name,file,pin,imagesKey] of cases){
  const source=await readFrozenJson(root+file,pin);
  const bytes=await fs.readFile(root+file);assertFrozenInput(name,bytes,pin);
  assertFrozenInput(name+' unchanged serialization',JSON.stringify(source,null,2),pin);
  const mutations=[
    x=>{x.records.reverse();},
    x=>{x.records[0].derivationKey='changed-reviewed-key';},
    x=>{if(imagesKey)x.records[0][imagesKey][0].sha256='0'.repeat(64);else x.records[0].sha256='0'.repeat(64);},
  ];
  for(const mutate of mutations){const copy=structuredClone(source);mutate(copy);assert.throws(()=>assertFrozenInput(name,JSON.stringify(copy,null,2),pin),/Frozen reviewed input changed/);rejected++;}
  if(imagesKey){const copy=structuredClone(source);const originals=copy.records[0].panoramas||copy.records[0].originalPanoramas;originals[0].sha256='0'.repeat(64);assert.throws(()=>assertFrozenInput(name,JSON.stringify(copy,null,2),pin),/Frozen reviewed input changed/);rejected++;}
}
const manifest=JSON.parse(await fs.readFile(root+'manifest.json'));
const packet=expandedGroundStreetPacket(manifest);assertFrozenInput('ground subset',packet,REVIEW_INPUT_PINS.expandedGroundStreet);
for(const mutate of [x=>x.reverse(),x=>{x[0].derivationKey='new-key';},x=>{x[0].images.full.sha256='0'.repeat(64);},x=>{x[0].images.ground.panoramaSha256='0'.repeat(64);}]){
  const copy=structuredClone(packet);mutate(copy);assert.throws(()=>assertFrozenInput('ground subset',copy,REVIEW_INPUT_PINS.expandedGroundStreet),/Frozen reviewed input changed/);rejected++;
}
// Unrelated frontages changing cannot silently change either selected input;
// their absence from the minimal subset also avoids needless opinion rebinding.
const unrelated=structuredClone(manifest);const other=unrelated.records.find(r=>!packet.some(p=>p.id===r.id));other.derivationKey='unrelated-change';assertFrozenInput('ground subset',expandedGroundStreetPacket(unrelated),REVIEW_INPUT_PINS.expandedGroundStreet);
// Every producer must use the immutable guard before it constructs any opinion.
for(const file of ['record-self-review-sample.mjs','record-self-review-roofs.mjs','record-expanded-aerial-review.mjs','record-expanded-ground-review.mjs']){
  const script=await fs.readFile('scripts/da-costa-block/'+file,'utf8');assert.match(script,/review-input-pins\.mjs/);assert.match(script,/readFrozenJson\(/);assert.ok(script.indexOf('readFrozenJson(')<script.indexOf('const records='));
}
console.log(JSON.stringify({passed:true,mutatedInputsRejected:rejected,guardedOpinionProducers:4,humanOrActiveWrites:0}));
