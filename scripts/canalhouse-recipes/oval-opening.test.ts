import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {assembleReference} from './assemble-reference.ts';
import {compileCanalHouseRecipe} from '../../src/canalRecall/canalhouseRecipes.ts';

test('oval attic template exposes glass and a hollow rim, leaving its corners as masonry',async()=>{
 const input=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/herengracht-505-recipe-input.json','utf8'));
 const assembled=await assembleReference(input),e=assembled.entry.recipe.elevations[0];
 const o=e.openings.value.find(o=>o.id==='clock-oval-attic')!;
 assert.equal(o.head,'oval');
 const built=compileCanalHouseRecipe(assembled.entry.recipe);built.group.updateMatrixWorld(true);
 const facade=built.group.getObjectByName('elevation/principal')!;
 const hit=(x:number,y:number)=>{
  const origin=new T.Vector3(o.leftM+x,o.bottomM+y,2).applyMatrix4(facade.matrixWorld);
  const direction=new T.Vector3(0,0,-1).transformDirection(facade.matrixWorld);
  return new T.Raycaster(origin,direction).intersectObject(built.group,true)[0].object;
 };
 assert.equal(hit(o.widthM/2,o.heightM/2).userData.surface,'glass');
 assert.match(hit(o.widthM/2,o.heightM-o.trimWidthM/2).name,/clock-oval-attic\/frame/);
 assert.equal(hit(.01,.01).userData.surface,'wall');
 const without=structuredClone(input);without.openings=without.openings.filter((o:any)=>o.id!=='clock-oval-attic');
 const baseline=await assembleReference(without);
 assert.deepEqual(assembled.entry.recipe.footprint,baseline.entry.recipe.footprint);
 assert.deepEqual(assembled.entry.recipe.roof,baseline.entry.recipe.roof);
 input.frameSets.oval.overrides={headRiseM:.1};
 await assert.rejects(()=>assembleReference(input),/Oval window/);
});

test('projected masonry retains all four oval corners without burying glazing',async()=>{
 const input=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/herengracht-505-recipe-input.json','utf8'));
 input.bands.push({id:'oval-surround',left:.4,width:.2,bottom:1.14,height:.06,depthM:.12,surface:'stone'});
 const result=await assembleReference(input),o=result.entry.recipe.elevations[0].openings.value.find(o=>o.id==='clock-oval-attic')!;
 const built=compileCanalHouseRecipe(result.entry.recipe);built.group.updateMatrixWorld(true);
 const facade=built.group.getObjectByName('elevation/principal')!;
 const hit=(x:number,y:number)=>{
  const origin=new T.Vector3(o.leftM+x,o.bottomM+y,2).applyMatrix4(facade.matrixWorld);
  return new T.Raycaster(origin,new T.Vector3(0,0,-1).transformDirection(facade.matrixWorld)).intersectObject(built.group,true)[0].object;
 };
 assert.equal(hit(o.widthM/2,o.heightM/2).userData.surface,'glass');
 for(const x of [.01,o.widthM-.01])for(const y of [.01,o.heightM-.01])assert.equal(hit(x,y).userData.surface,'stone');
});

test('optional oval divisions are clipped at both sides of the curved pane',async()=>{
 const input=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/herengracht-505-recipe-input.json','utf8'));
 input.frameSets.oval.overrides={verticalBars:[.3,.7],horizontalBars:[.35,.65],mullionWidthM:.012};
 const result=await assembleReference(input),o=result.entry.recipe.elevations[0].openings.value.find(o=>o.id==='clock-oval-attic')!;
 const built=compileCanalHouseRecipe(result.entry.recipe);
 const bars:T.Mesh[]=[];built.group.traverse(object=>{if(object.name==='opening/clock-oval-attic/bar')bars.push(object as T.Mesh);});
 assert.equal(bars.length,4);
 for(const mesh of bars){
  const p=mesh.geometry.getAttribute('position');
  for(let i=0;i<p.count;i++){
   const x=(p.getX(i)-o.leftM-o.widthM/2)/(o.widthM/2-o.trimWidthM);
   const y=(p.getY(i)-o.bottomM-o.heightM/2)/(o.heightM/2-o.trimWidthM);
   assert.ok(x*x+y*y<=1.00001,'Bar must remain inside ellipse');
  }
 }
});
