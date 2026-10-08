import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildFeatureChunk,ORIGIN,type Feature} from './threeBuildingFeatures.js';
import {compoundFeature as feature,compoundNeighbors as neighbors,compoundProfile as profile,compoundStreets as streets,compoundFront as front,compoundPlan as plan} from './compoundNativeFrontage.fixture.js';
import {bayLookFor} from './bayLook.js';
import {PROCEDURAL_RECIPE_LAYER_OFFSET} from './streetFacadeRendering.js';
import type {Chunk} from './threeBuildingMesh.js';
const looks=['photo','storybook','procedural'] as const;
function firstHit(chunk:Chunk,along:number,z:number){
 const p=new T.Vector3(front.x+front.ux*along,front.y+front.uy*along,z),normal=new T.Vector3(front.nx,front.ny,0);
 const geometry=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(chunk.positions,3));geometry.setIndex(new T.BufferAttribute(chunk.indices,1));
 const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));
 const hit=new T.Raycaster(p.clone().addScaledVector(normal,3),normal.clone().negate(),0,5).intersectObject(mesh)[0];
 const layer=hit?chunk.layers[chunk.indices[hit.faceIndex!*3]]:undefined;
 geometry.dispose();(mesh.material as T.Material).dispose();return{hit,layer};
}
test('native compound panes and recessed door remain visible and textured in ordinary and coarse wall LOD',()=>{
 assert.equal(feature.properties.constructionYear,1650,'1920 facade does not rewrite the official parent year');assert.ok(plan);
 for(const look of looks)for(const mode of ['walls','coarse'] as const){
  const chunk=buildFeatureChunk([feature],look,mode,streets,[profile]);
  const layers=bayLookFor(String(feature.properties.id),1650,Number(feature.properties.height),look==='procedural'?'photo':look,undefined,profile.recipes[0].recipe).layers;
  const offset=look==='procedural'?PROCEDURAL_RECIPE_LAYER_OFFSET:0;
  for(const w of plan.windows){const{hit,layer}=firstHit(chunk,w.left+w.width*.41,w.bottom+w.height*.39);assert.ok(hit,`${look}/${mode}/${w.part}`);assert.equal(layer,layers.upper+offset,`${look}/${mode}/${w.part}: buried glazing`);assert.ok(Math.abs(hit.distance-(3-w.out))<.003);}
  const{hit,layer}=firstHit(chunk,plan.access.axis,plan.access.bottom+.95);assert.ok(hit);assert.equal(layer,layers.door+offset,'source access has a textured door');assert.ok(hit.distance>3.30&&hit.distance<3.36,'ordinary parent/trim does not close the portico');
  assert.ok(Array.from(chunk.positions).every(Number.isFinite));
 }
});
test('incompatible compound layout preserves identical ordinary facade and extras arrays',()=>{
 const without={...profile,recipes:profile.recipes.map(p=>({...p,recipe:{...p.recipe,compoundFrontage:undefined}}))};
 const rejected={...profile,recipes:profile.recipes.map(p=>({...p,recipe:{...p.recipe,compoundFrontage:{...p.recipe.compoundFrontage!,mainWindowWidthM:2.8}}}))};
 for(const look of looks)for(const mode of ['walls','extras','coarse'] as const){
  const a=buildFeatureChunk([feature],look,mode,streets,[without]),b=buildFeatureChunk([feature],look,mode,streets,[rejected]);
  for(const key of ['positions','uvs','layers','tints','accents','indices'] as const)assert.deepEqual(b[key],a[key],`${look}/${mode}/${key}`);
 }
});
test('native ring reversal and collinear tessellation preserve source-directed main/shaft first hits',()=>{
 const raw=(feature.geometry as {coordinates:number[][][]}).coordinates[0],a=raw[0],b=raw[1],middle=[(a[0]+b[0])/2,(a[1]+b[1])/2];
 const split:Feature={...feature,geometry:{type:'Polygon',coordinates:[[a,middle,...raw.slice(1)]]}};
 const reversed:Feature={...feature,geometry:{type:'Polygon',coordinates:[[...raw].reverse()]}};
 for(const f of[split,reversed])for(const look of looks){
  const chunk=buildFeatureChunk([f],look,'walls',streets,[profile]);
  for(const w of plan.windows){const{hit}=firstHit(chunk,w.left+w.width*.41,w.bottom+w.height*.39);assert.ok(hit);assert.ok(Math.abs(hit.distance-(3-w.out))<.003,`${look}/${w.part}: polygon ordering moved source zones`);}
  assert.ok(firstHit(chunk,plan.access.axis,.95).hit!.distance>3.30);
 }
});
test('bounded compound candidate preserves transition and courtyard-heldout neighbors',()=>{
 const all=[feature,...neighbors];
 for(const look of looks)for(const mode of ['walls','extras','coarse'] as const){
  const before=buildFeatureChunk(all,look,mode,streets),after=buildFeatureChunk(all,look,mode,streets,[profile]);
  for(const neighbor of neighbors){
   const id=String(neighbor.properties.id),a=before.ranges.find(r=>r.id===id)!,b=after.ranges.find(r=>r.id===id)!;
   assert.equal(!!b,!!a,`${look}/${mode}/${id}: neighbor disappeared or acquired extras`);
   if(!a||!b){assert.equal(mode,'extras','ordinary neighbor walls must exist');continue;}
   assert.equal(b.count,a.count);
   for(const[key,stride]of [['positions',3],['uvs',2],['layers',1],['tints',4],['accents',4]] as const){
    assert.deepEqual(after[key].slice(b.start*stride,(b.start+b.count)*stride),before[key].slice(a.start*stride,(a.start+a.count)*stride),`${look}/${mode}/${id}/${key}`);
   }
  }
 }
});
