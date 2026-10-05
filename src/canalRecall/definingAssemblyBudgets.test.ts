import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildFeatureChunk, type Feature } from './threeBuildingFeatures.js';
import { ExtraSink, buildingWallExtras, wallExtras, extraUsage, DEFINING_BUILDING_CEILING, type ExtraContext } from './facadeExtras.js';
import type { StreetAppearanceProfile } from './streetAppearance.js';
const fixture=JSON.parse(readFileSync(new URL('./fixtures/modernCorner.json',import.meta.url),'utf8')) as {targetId:string;features:Feature[];streets:number[];profiles:StreetAppearanceProfile[]};
function nativeContexts(){
 const contexts:ExtraContext[]=[], records:Array<{c:ExtraContext;used:readonly string[];triangles:number}>=[],previous=extraUsage.record;
 try{
  extraUsage.record=(c,used,triangles)=>{if(c.id===fixture.targetId){contexts.push(c);records.push({c,used,triangles});}};
  const chunk=buildFeatureChunk(fixture.features,'photo','extras',Float32Array.from(fixture.streets),fixture.profiles);
  return {contexts,records,chunk};
 }finally{extraUsage.record=previous;}
}

test('actual native modern corner receives both supported street stacks before optional dressing',()=>{
 const {contexts,records,chunk}=nativeContexts();
 const stacks=records.filter(r=>r.c.recipe?.facadeAssembly==='stacked-open-balcony');
 assert.equal(stacks.length,2,'native building has two positively supported street faces');
 assert.ok(stacks.some(r=>r.c.f.len>9&&r.c.f.len<10));assert.ok(stacks.some(r=>r.c.f.len>23&&r.c.f.len<24));
 assert.deepEqual(stacks.map(r=>r.triangles),[170,170]);
 for(const r of stacks)assert.deepEqual(r.used,['glass-balconies'],'three complete levels per face without optional ornaments');
 assert.ok(records.filter(r=>!stacks.includes(r)).every(r=>r.triangles===0),'added allowance never buys rear decorations');
 const native=chunk.ranges.find(r=>r.id===fixture.targetId)!;
 assert.equal(chunk.quadCount,0,'extras mode must not emit clipped wall rectangles');
 assert.equal(native.count/3,340);assert.equal(new Set(records.map(r=>r.c.wallKey)).size,contexts.length,'one callback per actual face');
 const previous=extraUsage.record;
 try{
  for(const order of [contexts,[...contexts].reverse(),[...contexts].sort((a,b)=>b.f.len-a.f.len)]){
   const sink=new ExtraSink(230),usage:Array<{c:ExtraContext;used:readonly string[];triangles:number}>=[];
   extraUsage.record=(c,used,triangles)=>usage.push({c,used,triangles});
   buildingWallExtras(order,sink);
   assert.equal(sink.tris.length,340);assert.equal(sink.budget,230,'optional roof extras retain the original caller allowance');assert.equal(sink.room(),0);
   assert.equal(sink.tris.filter(t=>t.hex==='#b9b5ac').length,60,'six complete thin floors across two faces');
   assert.equal(usage.length,contexts.length);
   for(const r of usage)assert.ok(r.triangles<=(r.c.streetSide?180:30));
   assert.ok(usage.filter(r=>r.triangles>0).every(r=>r.used.length===1&&r.used[0]==='glass-balconies'));
  }
 }finally{extraUsage.record=previous;}
});

test('extended ceiling is defining-only, complete-level atomic, and never expands a small explicit caller budget',()=>{
 const {contexts}=nativeContexts(), defining=contexts.find(c=>c.recipe?.facadeAssembly==='stacked-open-balcony')!;
 const previous=extraUsage.record;
 try{
  const repeated=Array.from({length:4},(_,i)=>({...defining,wallKey:`eligible-face-${i}`}));
  const sink=new ExtraSink(230),used:number[]=[];
  extraUsage.record=(_c,_used,triangles)=>used.push(triangles);
  buildingWallExtras(repeated,sink);
  assert.equal(DEFINING_BUILDING_CEILING,540);assert.equal(sink.tris.length,510);
  assert.deepEqual(used,[170,170,170,0],'ceiling never leaves a structural band or partial deck on fourth face');
  assert.ok(sink.tris.length<=DEFINING_BUILDING_CEILING);
  for(const budget of [0,20,55,56,180]){
   const limited=new ExtraSink(budget);extraUsage.record=null;buildingWallExtras(repeated.slice(0,2),limited);
   assert.ok(limited.tris.length<=budget);assert.equal(limited.budget,budget);
   const floors=limited.tris.filter(t=>t.hex==='#b9b5ac').length;
   assert.ok(floors===0||floors===30,'small budgets never leave partial stack levels or a dangling structural band');
  }
  const generic=new ExtraSink(540);buildingWallExtras(contexts.map(c=>({...c,recipe:undefined})),generic);
  assert.ok(generic.tris.length<=230,'raising caller budget cannot unlock optional random ornament allowance');
  const standalone=new ExtraSink(230);const result=wallExtras(defining,standalone);
  assert.equal(standalone.tris.length,170);assert.deepEqual(result,['glass-balconies'],'standalone wall API keeps its existing behavior');
 }finally{extraUsage.record=previous;}
});

test('subdividing a straight native facade cannot invent another defining balcony stack',()=>{
 const features=structuredClone(fixture.features),native=features.find(f=>f.properties.id===fixture.targetId)!;
 const geometry=native.geometry as {coordinates:number[][][]}, ring=geometry.coordinates[0];
 const kx=111320*Math.cos(52.37*Math.PI/180);
 const lengths=ring.slice(0,-1).map((a,i)=>Math.hypot((ring[i+1][0]-a[0])*kx,(ring[i+1][1]-a[1])*110540));
 const edge=lengths.findIndex(n=>n>23&&n<24);assert.ok(edge>=0,'actual long source-supported native frontage');
 const a=ring[edge],b=ring[edge+1];ring.splice(edge+1,0,[(a[0]+b[0])/2,(a[1]+b[1])/2]);
 const previous=extraUsage.record, records:Array<{c:ExtraContext;used:readonly string[];triangles:number}>=[];
 try{
  extraUsage.record=(c,used,triangles)=>{if(c.id===fixture.targetId)records.push({c,used,triangles});};
  const chunk=buildFeatureChunk(features,'photo','extras',Float32Array.from(fixture.streets),fixture.profiles);
  const stacks=records.filter(r=>r.used.includes('glass-balconies'));
  assert.equal(stacks.length,2,'one assembly per geometric source frontage, independent of polygon tessellation');
  assert.equal(chunk.ranges.find(r=>r.id===fixture.targetId)!.count/3,340);
 }finally{extraUsage.record=previous;}
});
