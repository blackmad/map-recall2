import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as T from 'three';
import {compileCanalHouseRecipe} from '../../src/canalRecall/canalhouseRecipes.ts';
test('513 bay glazing remains exposed on front and returns inside the actual compound native owner',async()=>{
 const pack=JSON.parse(await fs.readFile('docs/references/canalhouse-recipes/rough-chunk-recipes.json','utf8'));
 const recipe=pack.entries.find((e:any)=>e.recipe.id==='herengracht-507-509').recipe;
 const elevation=recipe.elevations.find((e:any)=>e.glazedBays?.value.length);
 assert.ok(elevation);
 const built=compileCanalHouseRecipe(recipe);built.group.updateMatrixWorld(true);
 const facade=built.group.getObjectByName(`elevation/${elevation.id}`)!;
 for(const bay of elevation.glazedBays.value){
  const inset=(bay.widthM-bay.frontWidthM)/2,points=[[0,0],[inset,bay.depthM],[bay.widthM-inset,bay.depthM],[bay.widthM,0]];
  for(let i=0;i<3;i++){
   const a=points[i],b=points[i+1],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz),normal=new T.Vector3(-dz/length,0,dx/length);
   const origin=new T.Vector3((bay.leftM??0)+a[0]+dx*.42,(bay.bottomM??0)+bay.lowerPanelM+(bay.heightM-bay.lowerPanelM-bay.upperPanelM)*.57,(bay.outwardM??.015)+a[1]+dz*.42).addScaledVector(normal,.2).applyMatrix4(facade.matrixWorld);
   const direction=normal.clone().negate().transformDirection(facade.matrixWorld);
   const hit=new T.Raycaster(origin,direction).intersectObject(built.group,true)[0];
   assert.equal(hit?.object.userData.surface,'glass',`${bay.id} face${i} glazing must be first hit`);
   assert.equal(hit.object.userData.component,'glazedBay');
  }
 }
});
