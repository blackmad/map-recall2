import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {canalhouseRoofJunctions} from './canalhouseRoofJunctions.ts';
import {surveyRecipe} from '../../scripts/canalhouse-recipes/survey-recipe.ts';
import type {CanalHouseRecipe,CanalhousePoint} from './canalhouseRecipes.ts';
type Roof=CanalHouseRecipe['roof']['value'][number];
const roof=(points:CanalhousePoint[],heightM:number):Roof=>({polygon:{outer:points,holes:[]},plane:{heightM,slopeX:0,slopeZ:0}});
const height=(r:Roof,p:CanalhousePoint)=>r.plane.heightM+r.plane.slopeX*p[0]+r.plane.slopeZ*p[1];
test('semantic surfaces vote once and excluded genuine volume steps remain untouched',()=>{
 const a=roof([[0,0],[2,0],[2,2]],10),b=roof([[0,0],[2,2],[0,2]],14),low=roof([[0,2],[2,2],[2,4]],3);
 const roofs=[a,b,low],snapshot=JSON.stringify(roofs);
 const joined=canalhouseRoofJunctions(roofs,['a','b','annex'],{surfaceIds:['a','b'],maxAdjustmentM:2});
 assert.equal(height(joined[0],[0,0]),12);assert.equal(height(joined[1],[0,0]),12);
 assert.equal(joined[2],low);assert.deepEqual(joined.map(r=>r.polygon),roofs.map(r=>r.polygon));assert.equal(JSON.stringify(roofs),snapshot);
 const repeated=canalhouseRoofJunctions([a,a,a,b,low],['a','a','a','b','annex'],{surfaceIds:['a','b'],maxAdjustmentM:2});
 assert.equal(height(repeated[0],[0,0]),12);assert.equal(height(repeated[3],[0,0]),12);
});
test('unsafe adjustment, missing source selection and un-noded T junctions fail explicitly',()=>{
 const a=roof([[0,0],[2,0],[0,2]],10),b=roof([[2,0],[2,2],[0,2]],14);
 assert.throws(()=>canalhouseRoofJunctions([a,b],['a','b'],{surfaceIds:['a','b'],maxAdjustmentM:1}),/adjustment bound/);
 assert.throws(()=>canalhouseRoofJunctions([a,b],['a','b'],{surfaceIds:['foreign'],maxAdjustmentM:2}),/selection/);
 const t=roof([[1,0],[1,-1],[2,0]],10);
 assert.throws(()=>canalhouseRoofJunctions([a,t],['a','t'],{surfaceIds:['a','t'],maxAdjustmentM:1}),/noded/);
});
test('actual120 preserves every native plan domain and low rear while closing selected junctions',()=>{
 const survey=JSON.parse(fs.readFileSync('docs/references/canalhouse-recipes/bloemgracht-120-survey.json','utf8'));
 const admission=JSON.parse(fs.readFileSync('docs/references/canalhouse-recipes/bloemgracht-120-source-admission.json','utf8'));
 const native=surveyRecipe(survey,admission.native.surveyFootprintPolygonsRD,admission.principalFront.orientedLeftToRightAsSeenFromCanal);
 const ids=[38,39,40,41,42].map(i=>'NL.IMBAG.Pand.0363100012168077-0:lod22:roof:'+i);
 assert.throws(()=>canalhouseRoofJunctions(native.roof,native.roofOwners,{surfaceIds:ids,maxAdjustmentM:1.1}),/adjustment bound/);
 const joined=canalhouseRoofJunctions(native.roof,native.roofOwners,{surfaceIds:ids,maxAdjustmentM:1.2}),nodes=new Map<string,number[]>();
 for(const [i,r] of joined.entries()){
  assert.deepEqual(r.polygon,native.roof[i].polygon);
  if(!ids.includes(native.roofOwners[i])){assert.equal(r,native.roof[i]);continue;}
  for(const p of r.polygon.outer){const k=p.join(','),h=height(r,p);nodes.set(k,[...(nodes.get(k)??[]),h]);assert(Math.abs(h-height(native.roof[i],p))<=1.2+1e-8);}
 }
 for(const values of nodes.values())assert(Math.max(...values)-Math.min(...values)<1e-7);
});
