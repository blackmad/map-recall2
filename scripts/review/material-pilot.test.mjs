import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {selectPilot} from './prepare-material-pilot.mjs';
import {scorePilot} from './evaluate-material-pilot.mjs';
const assignments=JSON.parse(await fs.readFile(new URL('../../public/data/wall-materials/assignments.json',import.meta.url)));
test('frozen cohort keeps the full render gate in development and entire evaluation street disjoint',()=>{
 const rows=selectPilot(assignments.entries,assignments.gate),dev=rows.filter(e=>e.split==='development'),held=rows.filter(e=>e.split==='evaluation');
 assert.equal(dev.length,40);assert.equal(held.length,20);
 assert(assignments.gate.every(i=>dev.some(e=>e.index===i)));
 for(const field of ['buildingId','sourceSha256','street'])assert(held.every(e=>!dev.some(d=>d[field]===e[field])));
 assert.deepEqual(selectPilot([...assignments.entries].reverse(),assignments.gate).map(e=>e.buildingId).sort(),rows.map(e=>e.buildingId).sort());
});
test('duplicate owner/image and changed held-out membership fail closed',()=>{
 assert.throws(()=>selectPilot([...assignments.entries,assignments.entries[0]],assignments.gate),/Duplicate/);
 assert.throws(()=>selectPilot(assignments.entries.filter(e=>e.street!=='Lauriergracht'),assignments.gate),/Evaluation/);
});
const experiment={model:'fixture',modelDigest:'fixture'},experimentHash=createHash('sha256').update(JSON.stringify(experiment)).digest('hex');
const row=(id,unknown=false)=>({index:id,buildingId:String(id),observationId:`wall-${id}`,sourceSha256:`sha-${id}`,split:'evaluation',reference:{requiresAbstention:unknown,materialFamily:unknown?'unknown':'brick',colourFamilies:['brown']}});
const selection={acceptance:{materialAgreementOnKnown:.95,falseAcceptOnUnknown:0,minimumKnownCoverage:.8},entries:[row(0),row(1,true)]};
const receipt=(id,label={materialFamily:'brick',colourFamily:'brown',visibility:'clear',abstain:false})=>({buildingId:String(id),elevationId:`wall-${id}`,sourceSha256:`sha-${id}`,status:'ok',schema:{valid:true},label});
const report=receipts=>({experiment,experimentHash,receipts});
test('known-class success cannot hide confident answers on unknown references',()=>{
 const s=scorePilot(selection,report([receipt(0),receipt(1)])).summary;
 assert.equal(s.materialAgreement,1);assert.equal(s.answersOnUnresolvedReferences,1);assert.equal(s.gate,'fail');
});
test('abstention is rewarded on unknowns but missing knowns cannot pass',()=>{
 const abstain={materialFamily:'unknown',colourFamily:'unknown',visibility:'occluded',abstain:true};
 assert.equal(scorePilot(selection,report([receipt(0),receipt(1,abstain)])).summary.gate,'pass-diagnostic-only');
 const s=scorePilot(selection,report([receipt(1,abstain)])).summary;
 assert.equal(s.missingOrInvalid,1);assert.equal(s.knownCoverage,0);assert.equal(s.gate,'fail');
});
test('invalid schema, stale sources, duplicate receipts and modified experiment are rejected',()=>{
 const invalid=receipt(0,{materialFamily:'brick',colourFamily:'brown',visibility:'occluded',abstain:false});
 assert.equal(scorePilot(selection,report([invalid])).summary.missingOrInvalid,2);
 assert.throws(()=>scorePilot(selection,report([{...receipt(0),sourceSha256:'stale'}])),/source mismatch/);
 assert.throws(()=>scorePilot(selection,report([receipt(0),receipt(0)])),/Duplicate/);
 assert.throws(()=>scorePilot(selection,{...report([]),experiment:{model:'changed'}}),/Changed experiment/);
});
