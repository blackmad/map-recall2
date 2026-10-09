import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {canalhouseAtticFront,type CanalhouseAtticFront} from './canalhouseAtticFront.ts';

const front=(width:number):CanalhouseAtticFront=>({id:'attic',template:'arched-center-with-side-lights',widthM:width,bottomM:9,sideTopM:10,depthM:.04,surface:'trim',
 center:{leftM:width*.4,widthM:width*.2,bottomM:9.2,heightM:1.2,headRiseM:.3,frame:{trimWidthM:.05,verticalBars:[.5]}},
 sideLights:{bays:[{id:'left',leftM:width*.05,widthM:width*.2},{id:'right',leftM:width*.75,widthM:width*.2}],bottomM:9.3,heightM:.4,frame:{trimWidthM:.04}}});
test('attic assembly scales its field and apertures across widths without modifying shared frames',()=>{
 for(const width of [5,8]){
  const input=front(width),before=structuredClone(input),built=canalhouseAtticFront(input);
  assert.equal(built.blocks[0].widthM,width);assert.equal(built.openings.length,3);
  assert.equal(built.openings[0].head,'segmental');assert.equal(built.openings[0].headRiseM,.3);
  built.openings[0].verticalBars!.push(.25);assert.deepEqual(input,before);
 }
});
test('attic assembly refuses conflicting shapes, duplicate identities and overlapping side lights',()=>{
 const conflict=front(6);conflict.center.frame.head='oval';assert.throws(()=>canalhouseAtticFront(conflict),/center/);
 const duplicate=front(6);duplicate.sideLights.bays[0].id='center';assert.throws(()=>canalhouseAtticFront(duplicate),/side light/);
 const overlap=front(6);overlap.sideLights.bays[0].leftM=2.5;assert.throws(()=>canalhouseAtticFront(overlap),/overlap/);
 const outside=front(6);outside.sideLights.heightM=2;assert.throws(()=>canalhouseAtticFront(outside),/side light/);
});
test('real upper-pane checks detect the earlier whole-width cornice burial on both transferred houses',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'canal-attic-probe-'));
 const original='docs/references/canalhouse-recipes/bloemgracht-six-attic-front-recipes-20261007.json';
 const run=(input:string)=>spawnSync(process.execPath,['--import','tsx','scripts/canalhouse-recipes/check-opening-visibility.mts',`--input=${input}`,'--houses=bloemgracht-118,bloemgracht-122','--openings=attic-front/center','--upper-panes'],{encoding:'utf8'});
 try{
  const current=run(original);assert.equal(current.status,0,current.stderr+current.stdout);assert.equal(JSON.parse(current.stdout).checks,8);
  const book=JSON.parse(await fs.readFile(original,'utf8'));
  for(const entry of book.entries)if(['bloemgracht-118','bloemgracht-122'].includes(entry.recipe.id))for(const elevation of entry.recipe.elevations)if(elevation.cornice)delete elevation.cornice.value.spans;
  const failed=path.join(dir,'buried.json');await fs.writeFile(failed,JSON.stringify(book));
  const regression=run(failed);assert.equal(regression.status,1,regression.stderr+regression.stdout);
  const result=JSON.parse(regression.stdout);assert.ok(result.failures.length>=4);
  assert.ok(result.failures.every((p:any)=>p.firstName.startsWith('cornice/')));
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
