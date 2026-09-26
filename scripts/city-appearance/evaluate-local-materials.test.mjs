import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { evaluateLocalMaterials, runEvaluation } from './evaluate-local-materials.mjs';

const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
const digest='sha256:'+'b'.repeat(64),experimentHash='c'.repeat(64);
const experiment={experimentHash,experiment:{model:'qwen3.5:9b',modelDigest:digest,imageSize:768}};
const source=(id,imagePath)=>({buildingId:id,elevationId:`${id}:e:1`,imageKind:'full',sha256:sha(id),path:imagePath});
const label=(materialFamily,colourFamily,visibility='clear')=>({materialFamily,colourFamily,visibility});
const predict=(materialFamily,colourFamily,visibility='clear',abstain=false)=>({materialFamily,colourFamily,visibility,abstain});
const receipt=(s,p,status='ok',latency=100,load=10)=>({key:sha(s.buildingId+status),experimentHash,modelDigest:digest,status,
  binding:{buildingId:s.buildingId,elevationId:s.elevationId,imageKind:s.imageKind,sourceSha256:s.sha256},
  label:p,schema:{valid:status==='ok'},clientLatencyMs:latency,server:{loadDurationMs:load}});
const entries=[
  {source:source('a','a.jpg'),label:label('brick','red')},
  {source:source('b','b.jpg'),label:label('render','cream')},
  {source:source('c','c.jpg'),label:label('unknown','unknown','occluded')},
  {source:source('d','d.jpg'),label:label('brick','brown')},
  {source:source('e','e.jpg'),label:label('brick','buff')},
];
const reference={version:1,sourceIdentityUnverified:true,reviewer:'model-reference',entries};
assert.throws(()=>evaluateLocalMaterials({...reference,status:'withdrawn'},[],experiment),/Withdrawn visual reference/);
const receipts=[
  receipt(entries[0].source,predict('brick','red'), 'ok',100,20),
  receipt(entries[1].source,predict('unknown','unknown','partial',true),'ok',200,1500),
  receipt(entries[2].source,predict('brick','brown'),'ok',300,5),
  receipt(entries[3].source,predict('brick','brown'),'invalid-schema',400,5),
];
const result=evaluateLocalMaterials(reference,receipts,experiment);
assert.deepEqual(result.counts,{missing:1,error:0,invalid:1,modelAbstain:1,accepted:2});
assert.equal(result.agreement.jointAmongAcceptedOnKnown.precision,1);
assert.equal(result.agreement.falseAcceptReferenceUnknown,1);
assert.equal(result.speed.clientLatencyMs.count,3,'invalid and missing samples must not enter speed statistics');
assert.equal(result.speed.coldLoadAtLeast1000Ms.count,1);
assert.equal(result.confusion.material.unknown.brick,1);
assert.equal(result.confusion.colour.cream.abstain,1);
assert.equal(result.gate.status,'incomplete');
assert.throws(()=>evaluateLocalMaterials(reference,[...receipts,receipts[0]],experiment),/Ambiguous duplicate/);
assert.throws(()=>evaluateLocalMaterials(reference,[{...receipts[0],modelDigest:'d'.repeat(64)}],experiment),/wrong-model/);
const passing=evaluateLocalMaterials({...reference,entries:entries.slice(0,3)},[
  receipts[0],receipt(entries[1].source,predict('render','cream')),
  receipt(entries[2].source,predict('unknown','unknown','occluded',true)),
],experiment);
assert.equal(passing.gate.status,'pass');assert.equal(passing.agreement.modelAcceptance.knownReferenceRate,1);

const root=await fs.mkdtemp(path.join(os.tmpdir(),'local-material-eval-'));
try {
  const image=path.join(root,'a.jpg');await fs.writeFile(image,'a');
  const ref={version:1,sourceIdentityUnverified:true,reviewer:'test',entries:[{source:{...source('a',image),sha256:sha('a')},label:label('brick','red')}]};
  const referenceFile=path.join(root,'reference.json'),benchmark=path.join(root,'benchmark');
  await fs.mkdir(path.join(benchmark,'receipts'),{recursive:true});await fs.writeFile(referenceFile,JSON.stringify(ref));
  await fs.writeFile(path.join(benchmark,'report.json'),JSON.stringify(experiment));
  await fs.writeFile(path.join(benchmark,'receipts',`${receipts[0].key}.json`),JSON.stringify(receipts[0]));
  await fs.writeFile(referenceFile,JSON.stringify({...ref,status:'withdrawn'}));
  await assert.rejects(runEvaluation([`--reference=${referenceFile}`,`--benchmark=${benchmark}`]),/Withdrawn visual reference/);
  await fs.writeFile(referenceFile,JSON.stringify(ref));
  const output=await runEvaluation([`--reference=${referenceFile}`,`--benchmark=${benchmark}`]);
  assert.equal(output.gate.status,'pass');assert.equal(JSON.parse(await fs.readFile(output.output)).referenceSha256,sha(await fs.readFile(referenceFile)));
  await fs.writeFile(image,'changed');await assert.rejects(runEvaluation([`--reference=${referenceFile}`,`--benchmark=${benchmark}`]),/Reference image changed/);
  console.log('Local material evaluator: exact binding, abstentions, confusion, speed and gate passed');
} finally { await fs.rm(root,{recursive:true,force:true}); }
