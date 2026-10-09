import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {canalhouseEntranceCheeks,type CanalhouseEntranceCheeks} from './canalhouseEntranceCheeks.ts';
import {assembleReference} from '../../scripts/canalhouse-recipes/assemble-reference.ts';

test('solid cheek variants preserve ground contact, top heights and clear stair width',()=>{
 const flight={leftM:1,widthM:1.2,riseM:1.5,runM:2,backM:.3},spec:CanalhouseEntranceCheeks={heightM:.8,streetHeightM:.4,thicknessM:.08,sides:['left','right'],surface:'door'};
 for(const coverLanding of [false,true])for(const sides of [['left'],['right'],['left','right']] as ('left'|'right')[][]){
  for(const panel of canalhouseEntranceCheeks(flight,{...spec,coverLanding,sides},4)){
   panel.geometry.computeBoundingBox();const b=panel.geometry.boundingBox!;
   assert(Math.abs(b.min.y)<1e-6);assert(Math.abs(b.max.y-2.3)<1e-6);
   assert(Math.abs(b.min.z-(coverLanding ? .015 : .3))<1e-6);assert(Math.abs(b.max.z-2.3)<1e-6);
   assert(panel.side==='left'?b.max.x<=1+1e-6:b.min.x>=2.2-1e-6);
   assert.equal(panel.geometry.getAttribute('position').count/3,12);panel.geometry.dispose();
  }
 }
 for(const patch of [{heightM:0},{streetHeightM:NaN},{sides:['right','right']},{surface:'glass'}])assert.throws(()=>canalhouseEntranceCheeks(flight,{...spec,...patch} as CanalhouseEntranceCheeks,4),/cheek/);
});

test('actual104 adds two side panels and refuses thickness that covers basement glass',async()=>{
 const input=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/bloemgracht-104-recipe-input.json','utf8')),result=await assembleReference(input),without=structuredClone(input);delete without.entrance.cheeks;
 const baseline=await assembleReference(without),recipe=structuredClone(result.entry.recipe);delete recipe.elevations[0].entrance!.value.cheeks;
 assert.deepEqual(recipe,baseline.entry.recipe);assert.equal(result.stats.triangles,baseline.stats.triangles+24);
 const wide=structuredClone(input);wide.entrance.cheeks.thicknessM=.2;await assert.rejects(()=>assembleReference(wide),/blocks an opening pane/);
});
