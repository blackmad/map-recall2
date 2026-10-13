import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {assembleReference} from './assemble-reference.ts';
import {compileCanalHouseRecipe} from '../../src/canalRecall/canalhouseRecipes.ts';

test('opening-linked shallow rails remain visible without closing the window or changing native geometry',async()=>{
 const input=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/herengracht-479-recipe-input.json','utf8'));
 const base=await assembleReference(input),e=base.entry.recipe.elevations[0];
 const o=e.openings.value.find(o=>o.kind==='window'&&o.heightM>1.2)!;
 input.balconies=[{id:'observed-sill',openingId:o.id,heightM:.6,depthM:.18,barWidthM:.025,posts:4}];
 const result=await assembleReference(input);
 assert.deepEqual(result.entry.recipe.footprint,base.entry.recipe.footprint);assert.deepEqual(result.entry.recipe.roof,base.entry.recipe.roof);
 const built=compileCanalHouseRecipe(result.entry.recipe);built.group.updateMatrixWorld(true);
 const facade=built.group.getObjectByName('elevation/principal')!;
 const hit=(y:number)=>{
  const origin=new T.Vector3(o.leftM+o.widthM*.42,y,2).applyMatrix4(facade.matrixWorld);
  const direction=new T.Vector3(0,0,-1).transformDirection(facade.matrixWorld);
  return new T.Raycaster(origin,direction).intersectObject(built.group,true)[0].object;
 };
 assert.match(hit(o.bottomM+.6-.0125).name,/balcony\/observed-sill\/top/);
 assert.equal(hit(o.bottomM+o.heightM*.83).userData.surface,'glass');
 input.balconies[0].openingId='absent';
 await assert.rejects(()=>assembleReference(input),/supported window/);
 input.balconies[0].openingId=o.id;input.balconies[0].depthM=1;
 await assert.rejects(()=>assembleReference(input),/rail dimensions/);
});

test('projecting balcony exposes its platform and supports while retaining visible upper glass',async()=>{
 const input=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/herengracht-495-recipe-input.json','utf8'));
 const result=await assembleReference(input),e=result.entry.recipe.elevations[0];
 const rail=input.balconies[0],o=e.openings.value.find(o=>o.id===rail.openingId)!;
 const built=compileCanalHouseRecipe(result.entry.recipe);built.group.updateMatrixWorld(true);
 const facade=built.group.getObjectByName('elevation/principal')!;
 const hit=(x:number,y:number)=>{
  const origin=new T.Vector3(x,y,2).applyMatrix4(facade.matrixWorld);
  const direction=new T.Vector3(0,0,-1).transformDirection(facade.matrixWorld);
  return new T.Raycaster(origin,direction).intersectObject(built.group,true)[0].object;
 };
 const center=o.leftM+o.widthM*.42,left=o.leftM+(o.widthM-rail.projection.widthM)/2;
 assert.match(hit(center,o.bottomM-.08).name,/balcony\/central-marble-balcony\/platform/);
 assert.match(hit(left+.1,o.bottomM-.4).name,/balcony\/central-marble-balcony\/support/);
 assert.match(hit(center,o.bottomM+.635).name,/balcony\/central-marble-balcony\/top/);
 assert.equal(hit(center,o.bottomM+o.heightM*.83).userData.surface,'glass');
 const without=structuredClone(input);delete without.balconies;
 const baseline=await assembleReference(without);
 assert.deepEqual(result.entry.recipe.footprint,baseline.entry.recipe.footprint);
 assert.deepEqual(result.entry.recipe.roof,baseline.entry.recipe.roof);
 rail.projection.widthM=o.widthM+3;
 await assert.rejects(()=>assembleReference(input),/projecting balcony platform/);
});
