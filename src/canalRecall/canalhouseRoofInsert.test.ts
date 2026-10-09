import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {surveyRecipe} from '../../scripts/canalhouse-recipes/survey-recipe.ts';
import {canalhouseRaisedFlatRoofInserts} from './canalhouseRoofInsert.ts';
import {canalhouseSymmetricRoof} from './canalhouseSymmetricRoof.ts';
import type {CanalHouseRecipe,CanalhousePoint} from './canalhouseRecipes.ts';
type Roof=CanalHouseRecipe['roof']['value'][number];
const a=(r:Roof)=>Math.abs(r.polygon.outer.reduce((s,p,i)=>{const q=r.polygon.outer[(i+1)%r.polygon.outer.length];return s+p[0]*q[1]-q[0]*p[1]},0))/2;
const r=(outer:CanalhousePoint[],heightM=4):Roof=>({polygon:{outer,holes:[]},plane:{heightM,slopeX:0,slopeZ:0}});
const basis={origin:[0,0] as CanalhousePoint,u:[1,0] as CanalhousePoint,back:[0,1] as CanalhousePoint};
test('flat-topped side insert raises a pitched roof without notching its ridge or changing native coverage',()=>{
 const native=[r([[0,0],[4,0],[4,8]]),r([[0,0],[4,8],[0,8]])],front={a:[0,0] as CanalhousePoint,b:[4,0] as CanalhousePoint,normal:[0,-1] as CanalhousePoint};
 const selection={template:'symmetric-gable' as const,surfaceIds:['main'],eavesM:10,ridgeM:14};
 const base=canalhouseSymmetricRoof(native,['main','main'],front,selection),before=JSON.stringify(base);
 const built=canalhouseRaisedFlatRoofInserts(base,basis,[{id:'side-insert',leftM:.2,widthM:2,nearM:1,depthM:5,topM:12.5}]);
 assert.equal(JSON.stringify(base),before);assert.ok(Math.abs(built.reduce((s,r)=>s+a(r),0)-32)<1e-8);
 assert.ok(built.some(r=>r.plane.slopeX===0&&r.plane.heightM===12.5));
 for(const roof of built)for(const p of roof.polygon.outer){
  const actual=roof.plane.heightM+p[0]*roof.plane.slopeX+p[1]*roof.plane.slopeZ,original=10+Math.min(p[0],4-p[0])*2;
  assert.ok(actual>=original-1e-8);assert.ok(actual<=14+1e-8);
 }
 assert.ok(built.some(r=>r.polygon.outer.some(p=>Math.abs(p[0]-2)<1e-8)&&r.plane.slopeX!==0));
 const integrated=canalhouseSymmetricRoof(native,['main','main'],front,{...selection,raisedFlatInserts:[{id:'side-insert',leftM:.2,widthM:2,nearM:1,depthM:5,topM:12.5}]});assert.deepEqual(integrated,built);
});
test('same-height flat partitions are not duplicated and an insert cannot be used to excavate',()=>{
 const roofs=[r([[0,0],[2,0],[0,2]],12),r([[2,0],[2,2],[0,2]],10)];
 const built=canalhouseRaisedFlatRoofInserts(roofs,basis,[{id:'flat',leftM:0,widthM:2,nearM:0,depthM:2,topM:12}]);assert.ok(Math.abs(built.reduce((s,r)=>s+a(r),0)-4)<1e-8);
 assert.throws(()=>canalhouseRaisedFlatRoofInserts(roofs,basis,[{id:'low',leftM:0,widthM:2,nearM:0,depthM:2,topM:8}]),/does not raise/);
});
test('actual120 insert preserves native plan coverage and every excluded rear volume',()=>{
 const read=(name:string)=>JSON.parse(fs.readFileSync(`docs/references/canalhouse-recipes/${name}`,'utf8'));
 const admission=read('bloemgracht-120-source-admission.json'),survey=read('bloemgracht-120-survey.json'),input=read('bloemgracht-120-roof-insert-candidate-input-20261007.json');
 const native=surveyRecipe(survey,admission.native.surveyFootprintPolygonsRD,admission.principalFront.orientedLeftToRightAsSeenFromCanal);
 const result=canalhouseSymmetricRoof(native.roof,native.roofOwners,native.front,input.roofAssembly);
 assert.ok(Math.abs(result.reduce((s,r)=>s+a(r),0)-native.roof.reduce((s,r)=>s+a(r),0))<1e-7);
 const excluded=native.roof.filter((r,i)=>!input.roofAssembly.surfaceIds.includes(native.roofOwners[i]));
 assert.ok(excluded.length>0);assert.ok(excluded.every(r=>result.includes(r)));
});
