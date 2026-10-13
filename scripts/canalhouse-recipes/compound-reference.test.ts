import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {assembleReference} from './assemble-reference.ts';
import {assembleCompoundReference} from './compound-reference.ts';
import {compileCanalHouseRecipe} from '../../src/canalRecall/canalhouseRecipes.ts';

const path='docs/references/canalhouse-recipes/herengracht-473-475-compound-input.json';
test('two sourced fronts retain one exact native owner, roof and independent masonry palettes',async()=>{
 const input=JSON.parse(await fs.readFile(path,'utf8'));
 const first=await assembleReference(JSON.parse(await fs.readFile(input.facades[0],'utf8')));
 const result=await assembleCompoundReference(input,assembleReference),r=result.entry.recipe;
 assert.deepEqual(r.footprint,first.entry.recipe.footprint);assert.deepEqual(r.roof,first.entry.recipe.roof);
 assert.deepEqual(result.entry.suppressOsmIds,first.entry.suppressOsmIds);
 assert.equal(r.elevations.length,2);
 assert.equal(new Set(r.elevations.flatMap(e=>e.openings.value.map(o=>o.id))).size,r.elevations.reduce((n,e)=>n+e.openings.value.length,0));
 const compiled=compileCanalHouseRecipe(r),single=compileCanalHouseRecipe(first.entry.recipe);
 for(const prefix of ['shell/','roof/'])assert.equal(compiled.group.children.filter(c=>c.name.startsWith(prefix)).length,single.group.children.filter(c=>c.name.startsWith(prefix)).length);
 for(const elevation of r.elevations){
  const facade=compiled.group.getObjectByName(`elevation/${elevation.id}`)!;
  const wall=facade.children.find(c=>c.userData.surface==='wall') as any;
  assert.equal('#'+wall.material.color.getHexString(),elevation.palette!.value.wall);
 }
});
test('compound refuses duplicate frontage coverage and different physical owners',async()=>{
 const input=JSON.parse(await fs.readFile(path,'utf8'));
 await assert.rejects(()=>assembleCompoundReference({...input,facades:[input.facades[0],input.facades[0]]},assembleReference),/ranges overlap/);
 await assert.rejects(()=>assembleCompoundReference({...input,facades:[input.facades[0],'docs/references/canalhouse-recipes/herengracht-477-recipe-input.json']},assembleReference),/one physical Pand/);
});
