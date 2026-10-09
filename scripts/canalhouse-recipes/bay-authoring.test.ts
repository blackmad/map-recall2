import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {expandBaySets,type ReferenceBaySet} from './bay-authoring.ts';
import {assembleReference} from './assemble-reference.ts';

test('regular source axes preserve three actual expanded house recipes and compiled geometry statistics',async()=>{
 for(const number of [118,120,122]){
  const input=JSON.parse(await fs.readFile(`docs/references/canalhouse-recipes/bloemgracht-${number}-recipe-input.json`,'utf8'));
  const explicit=structuredClone(input);
  explicit.baySets.axes=[{id:'axis0',left:.06,width:.22},{id:'axis1',left:.39,width:.22},{id:'axis2',left:.72,width:.22}];
  input.baySets.axes={template:'regular',ids:['axis0','axis1','axis2'],left:.06,width:.22,step:.33};
  const [a,b]=await Promise.all([assembleReference(input),assembleReference(explicit)]);
  assert.deepEqual(a.entry.recipe,b.entry.recipe);
  assert.deepEqual(a.stats,b.stats);
 }
});

test('regular axes reject unsupported identities, overlap and facade overflow; explicit uneven axes stay exact',()=>{
 const valid:ReferenceBaySet={template:'regular',ids:['left','middle','right'],left:.06,width:.22,step:.33};
 for(const patch of [{ids:['left','left']},{ids:[]},{ids:Array.from({length:17},(_,i)=>`axis${i}`)},{step:.1},{left:.5},{width:NaN},{template:'automatic'}])assert.throws(()=>expandBaySets({axes:{...valid,...patch} as ReferenceBaySet}),/Invalid regular bay/);
 const uneven=[{id:'entry',left:.02,width:.11},{id:'window',left:.31,width:.26}];
 assert.deepEqual(expandBaySets({axes:uneven}).axes,uneven);
 assert.notEqual(expandBaySets({axes:uneven}).axes,uneven);
});
