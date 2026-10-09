import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {acknowledgedFlightHit,acknowledgedRailHit} from './opening-occlusion.ts';

test('an acknowledged source flight cannot excuse a roof, wall or another flight',()=>{
 assert(acknowledgedFlightHit('entrance/approach/rightFlight',['rightFlight']));
 for(const name of [null,'roof/step-wall','shell/wall','entrance/approach/rightFlightOther','entrance/approach/leftFlight'])assert.equal(acknowledgedFlightHit(name,['rightFlight']),false);
});
test('an observed rail cannot excuse a roof, wall or another guard',()=>{
 assert(acknowledgedRailHit('balcony/source-guard/top',['source-guard']));
 for(const name of [null,'shell/wall','roof/step-wall','balcony/source-guard-other/top','balcony/other/top'])assert.equal(acknowledgedRailHit(name,['source-guard']),false);
});
test('actual sourced guards retain blocked evidence and require exposed panes; absence of source flag fails',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'canalhouse-rail-occlusion-'));
 try{
  const book=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/bloemgracht-six-shared-repair-recipes-20261007.json','utf8'));
  const file=path.join(dir,'book.json'),report=path.join(dir,'report.json');
  const run=async()=>{await fs.writeFile(file,JSON.stringify(book));return spawnSync(process.execPath,['--import','tsx','scripts/canalhouse-recipes/check-opening-visibility.mts','--input='+file,'--houses=bloemgracht-118','--output='+report],{encoding:'utf8'});};
  const actual=await run();assert.equal(actual.status,0,actual.stderr);
  const result=JSON.parse(await fs.readFile(report,'utf8'));
  for(const axis of [0,1,2]){
   const id=`main/lower/axis${axis}`,primary=result.checks.find((c:any)=>c.id===id);
   assert.equal(primary.passed,false);assert.equal(primary.sourceAcknowledgedOcclusion,true);
   assert(result.checks.filter((c:any)=>c.id.startsWith(id+'/exposed-')).some((c:any)=>c.passed&&c.surface==='glass'));
  }
  for(const rail of book.entries.find((e:any)=>e.recipe.id==='bloemgracht-118').recipe.elevations[0].balconies.value)delete rail.occludesOpening;
  assert.equal((await run()).status,1);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('partial sourced occlusion requires exposed glazing and wholly hidden apertures still fail',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'canalhouse-occlusion-'));
 try{
  const pack=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/bloemgracht-174-recipes.json','utf8'));
  const file=path.join(dir,'pack.json'),report=path.join(dir,'report.json');
  const run=async()=>{await fs.writeFile(file,JSON.stringify(pack));return spawnSync(process.execPath,['--import','tsx','scripts/canalhouse-recipes/check-opening-visibility.mts','--input='+file,'--houses=bloemgracht-174','--output='+report],{encoding:'utf8'});};
  const actual=await run();assert.equal(actual.status,0,actual.stderr);
  const result=JSON.parse(await fs.readFile(report,'utf8'));
  assert.equal(result.status,'first-hit-checks-pass-with-source-occlusions');
  assert(result.checks.some((c:any)=>c.id==='middleBasementWindow'&&!c.passed&&c.sourceAcknowledgedOcclusion));
  assert(result.checks.filter((c:any)=>c.id.startsWith('middleBasementWindow/exposed-')).every((c:any)=>c.passed&&c.surface==='glass'));
  const opening=pack.entries[0].recipe.elevations[0].openings.value.find((o:any)=>o.id==='middleBasementWindow');
  opening.bottomM=.1;opening.heightM=.25;
  const hidden=await run();assert.equal(hidden.status,1,hidden.stderr);
  const failed=JSON.parse(await fs.readFile(report,'utf8'));assert.equal(failed.status,'first-hit-checks-failed');
  assert(failed.checks.some((c:any)=>c.id==='middleBasementWindow'&&!c.passed&&!c.sourceAcknowledgedOcclusion));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
