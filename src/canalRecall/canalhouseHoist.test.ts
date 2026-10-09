import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {canalhouseHoistGeometry,type CanalhouseHoist} from './canalhouseHoist.ts';
import {assembleReference} from '../../scripts/canalhouse-recipes/assemble-reference.ts';
import {compileCanalHouseRecipe} from './canalhouseRecipes.ts';

test('hoist beam preserves its physical cross section on horizontal and sloping axes',()=>{
 const beam:CanalhouseHoist={id:'beam',centerM:2,heightM:12,widthM:.14,beamHeightM:.18,projectionM:1.4,setbackM:.2,surface:'door'};
 for(const rise of [0,.6,-.6]){
  const geometry=canalhouseHoistGeometry({...beam,endRiseM:rise},4),position=geometry.getAttribute('position'),axis=new T.Vector3(0,rise,1.6).normalize(),start=new T.Vector3(2,12,-.2);
  const points=Array.from({length:position.count},(_,i)=>new T.Vector3().fromBufferAttribute(position,i));
  const lengths=points.map(p=>p.clone().sub(start).dot(axis));
  assert(Math.abs(Math.min(...lengths))<1e-5);assert(Math.abs(Math.max(...lengths)-Math.hypot(1.6,rise))<1e-5);
  assert(Math.abs(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))-.14)<1e-5);
  assert.equal(geometry.index!.count/3,12);
  geometry.dispose();
 }
 for(const patch of [{projectionM:0},{projectionM:4},{centerM:0},{endRiseM:4},{surface:'roof'},{heightM:NaN}])assert.throws(()=>canalhouseHoistGeometry({...beam,...patch} as CanalhouseHoist,4),/Invalid observed hoist/);
});

test('two actual recipes share the beam while all prior roof, opening and footprint inputs stay intact',async()=>{
 for(const number of [102,176]){
  const input=JSON.parse(await fs.readFile(`docs/references/canalhouse-recipes/bloemgracht-${number}-recipe-input.json`,'utf8'));
  const withBeam=await assembleReference(input),without=structuredClone(input);delete without.hoists;
  const baseline=await assembleReference(without),recipe=structuredClone(withBeam.entry.recipe);delete recipe.elevations[0].hoists;
  assert.deepEqual(recipe,baseline.entry.recipe);
  assert.equal(withBeam.stats.triangles,baseline.stats.triangles+12);
  const compiled=compileCanalHouseRecipe(withBeam.entry.recipe),meshes:T.Mesh[]=[];compiled.group.traverse(o=>{if(o instanceof T.Mesh&&o.name.startsWith('hoist/'))meshes.push(o);});
  assert.equal(meshes.length,1);assert.equal(meshes[0].userData.pandId,recipe.house.pandId);
  if(number===176){
   const head=withBeam.entry.recipe.elevations[0].dormers!.value[0];
   meshes[0].geometry.computeBoundingBox();
   assert(meshes[0].geometry.boundingBox!.min.y>=head.bottomM+head.heightM,'Source176 beam mounts above the attic glazing/head');
   const low=structuredClone(input);low.hoists[0].height=1.105;
   const failed=compileCanalHouseRecipe((await assembleReference(low)).entry.recipe);let lowBeam:T.Mesh|undefined;
   failed.group.traverse(o=>{if(o instanceof T.Mesh&&o.name.startsWith('hoist/'))lowBeam=o;});lowBeam!.geometry.computeBoundingBox();
   assert(lowBeam!.geometry.boundingBox!.min.y<head.bottomM+head.heightM,'Retain the rejected glazing-level mount as regression evidence');
  }
  input.hoists.push(structuredClone(input.hoists[0]));await assert.rejects(()=>assembleReference(input),/Duplicate observed hoist/);
 }
});
