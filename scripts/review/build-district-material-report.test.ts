import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {loadWorkerArtifacts,manualBindingMatches,workerBindingMatches} from './build-district-material-report.ts';

const hash=(value:string)=>createHash('sha256').update(value).digest('hex');

test('missing worker state leaves the gallery usable before inference starts',async()=>{
 const result=await loadWorkerArtifacts(path.join(os.tmpdir(),`missing-worker-${process.pid}.json`));
 assert.deepEqual(result,{jobs:[],errors:[]});
});

test('only complete jobs with intact benchmark and colour reports enter the gallery',async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'district-gallery-'));
 try{
  const benchmarkText=JSON.stringify({receipts:[],experimentHash:hash('experiment')});
  const colourText=JSON.stringify({kind:'source-photo-wall-colour-diagnostic',rows:[]});
  const benchmarkFile=path.join(directory,'benchmark.json'),colourFile=path.join(directory,'colours.json');
  await fs.writeFile(benchmarkFile,benchmarkText);await fs.writeFile(colourFile,colourText);
  const row={key:'complete',status:'complete',job:{manifest:path.join(directory,'manifest.json'),manifestSha256:hash('manifest')},
   outputs:{benchmark:{path:benchmarkFile,sha256:hash(benchmarkText)},wallColours:{path:colourFile,sha256:hash(colourText)}}};
  const stateFile=path.join(directory,'progress.json');
  await fs.writeFile(stateFile,JSON.stringify({version:2,jobs:{complete:row,running:{...row,status:'running'}}}));
  assert.equal((await loadWorkerArtifacts(stateFile)).jobs.length,1);
  await fs.writeFile(colourFile,colourText+' ');
  const invalid=await loadWorkerArtifacts(stateFile);
  assert.equal(invalid.jobs.length,0);
  assert.match(invalid.errors[0].error,/hash mismatch/);
 }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('source rows must match both the exact manifest path and SHA',()=>{
 const manifest='/tmp/area/evidence/manifest.json',manifestSha256=hash('manifest');
 const job={manifest,manifestSha256};
 const row={sourceManifestPath:manifest,sourceManifestSha256:manifestSha256};
 assert.equal(workerBindingMatches(job,row,manifest,manifestSha256),true);
 assert.equal(workerBindingMatches(job,{...row,sourceManifestSha256:hash('changed')},manifest,manifestSha256),false);
 assert.equal(workerBindingMatches(job,row,'/tmp/other/evidence/manifest.json',manifestSha256),false);
});

test('baseline reference receipt binds to current reference JSON and exact crop identity',()=>{
 const sourcePath='/tmp/area/evidence/images/crop.jpg',manifest='/tmp/area/evidence/manifest.json';
 const referencePath='/tmp/review/reference.json',referenceSha256=hash('current reference');
 const referenceEntry={source:{path:sourcePath,buildingId:'building',elevationId:'building:e:1',sha256:hash('crop')}};
 const binding={imageKind:'full',imagePath:sourcePath,sourceManifestPath:referencePath,
  sourceManifestSha256:referenceSha256,buildingId:'building',elevationId:'building:e:1',sourceSha256:hash('crop')};
 const matches=(candidate:any,entry:any=referenceEntry)=>manualBindingMatches(candidate,sourcePath,manifest,hash('manifest'),
  referencePath,referenceSha256,entry);
 assert.equal(matches(binding),true);
 assert.equal(matches({...binding,sourceManifestSha256:hash('old reference')}),false);
 assert.equal(matches({...binding,imagePath:'/tmp/other/crop.jpg'}),false);
 assert.equal(matches({...binding,sourceSha256:hash('other crop')}),false);
 assert.equal(matches(binding,{source:{...referenceEntry.source,elevationId:'other:e:1'}}),false);
 assert.equal(matches({...binding,sourceManifestPath:manifest,sourceManifestSha256:hash('manifest')}),true);
});
