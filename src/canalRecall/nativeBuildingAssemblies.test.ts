import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildFeatureChunk, type Feature } from './threeBuildingFeatures.js';
import { ExtraSink, buildingWallExtras, extraUsage, type ExtraContext } from './facadeExtras.js';
import type { StreetAppearanceProfile } from './streetAppearance.js';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/historicCorner.json',import.meta.url),'utf8')) as {
 targetId:string; features:Feature[]; streets:number[]; profiles:StreetAppearanceProfile[];
};
function nativeReplay(rotation:number){
 const features=structuredClone(fixture.features), native=features.find(f=>f.properties.id===fixture.targetId)!;
 const geometry=native.geometry as {coordinates:number[][][]};
 const ring=geometry.coordinates[0].slice(0,-1), offset=rotation%ring.length;
 const rotated=[...ring.slice(offset),...ring.slice(0,offset)];geometry.coordinates[0]=[...rotated,rotated[0]];
 const contexts:ExtraContext[]=[], records:Array<{context:ExtraContext;used:readonly string[]}>=[];
 const previous=extraUsage.record;
 try{
  extraUsage.record=(context,used)=>{if(context.id===fixture.targetId){contexts.push(context);records.push({context,used});}};
  const chunk=buildFeatureChunk(features,'photo','extras',Float32Array.from(fixture.streets),fixture.profiles);
  return{features,chunk,contexts,records};
 }finally{extraUsage.record=previous;}
}

test('native tall corner emits its defining stack despite a long unprofiled street wall and rotated ring starts',()=>{
 for(const rotation of [0,2,4,6]){
  const {chunk,contexts,records}=nativeReplay(rotation), native=chunk.ranges.find(r=>r.id===fixture.targetId)!;
  assert.ok(native,'genuine native identity retained');assert.ok(native.count/3<=230,'whole building remains within230 triangles');
  const assembly=records.find(r=>r.used.includes('historic-balcony-stack'));
  assert.ok(assembly,`ring start${rotation}: source-supported balcony assembly reaches runtime geometry`);
  assert.ok(Math.abs(assembly.context.f.len-5.513280226203876)<1e-6,'eligible actual frontage, not clipped chamfer');
  assert.equal(assembly.context.openings!.upper.axes.length,1);
  assert.ok(contexts.some(c=>!c.recipe&&c.streetSide&&c.f.len>14),'the competing long street facade remains present');
  const previous=extraUsage.record;extraUsage.record=null;
  try{
   const sink=new ExtraSink(230);buildingWallExtras(contexts,sink);
   assert.equal(sink.tris.filter(t=>t.hex==='#b9b5ac').length,30,'three complete thin floors survive the full native building budget');
   assert.ok(sink.tris.length<=230);
  }finally{extraUsage.record=previous;}
 }
});

test('native defining assembly gets its complete levels before optional facades for every context ordering',()=>{
 const {features,contexts}=nativeReplay(0), previous=extraUsage.record;
 try{
  for(const ordered of [contexts,[...contexts].reverse(),[...contexts].sort((a,b)=>b.f.len-a.f.len)]){
   const sink=new ExtraSink(230), spent:Array<{c:ExtraContext;tris:number;used:readonly string[]}>=[];
   extraUsage.record=(c,used,triangles)=>{spent.push({c,tris:triangles,used});};
   buildingWallExtras(ordered,sink);
   assert.equal(spent[0].used[0],'historic-balcony-stack','defining recipe is prioritized across facade order');
   assert.equal(sink.tris.filter(t=>t.hex==='#b9b5ac').length,30);
   assert.ok(sink.tris.length<=230);
   for(const entry of spent)assert.ok(entry.tris<=(entry.c.streetSide?180:30),'existing per-wall limit survives ordering');
  }
  let coarseCalls=0;extraUsage.record=()=>{coarseCalls++;};
  buildFeatureChunk(features,'photo','coarse',Float32Array.from(fixture.streets),fixture.profiles);
  assert.equal(coarseCalls,0,'coarse profiles keep cheap window rhythm without relief');
 }finally{extraUsage.record=previous;}
});
