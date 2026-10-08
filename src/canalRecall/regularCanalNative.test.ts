import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildFeatureChunk,ORIGIN,type Feature} from './threeBuildingFeatures.js';
import {regularSamples,regularProfiles,regularControls as neighbors,regularStreets as streets} from './regularCanalNative.fixture.js';
import {bayLookFor} from './bayLook.js';
import {PROCEDURAL_RECIPE_LAYER_OFFSET} from './streetFacadeRendering.js';
import type {Chunk} from './threeBuildingMesh.js';
import surveyed85 from './fixtures/regular85SurveyEnvelope.json';
import {buildTransportedEnvelopeChunk} from './surveyedEnvelopeTransport.js';
const looks=['photo','storybook','cartoon','procedural'] as const;
for(const {address,feature,front,plan,profile} of regularSamples){
function firstHit(chunk:Chunk|Chunk[],along:number,z:number):{hit:any;layer:number|undefined}{
 if(Array.isArray(chunk))return chunk.map(c=>firstHit(c,along,z)).filter(r=>r.hit).sort((a,b)=>a.hit.distance-b.hit.distance)[0]??{hit:undefined,layer:undefined};
 const p=new T.Vector3(front.x+front.ux*along,front.y+front.uy*along,z),normal=new T.Vector3(front.nx,front.ny,0);
 const geometry=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(chunk.positions,3));geometry.setIndex(new T.BufferAttribute(chunk.indices,1));
 const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));
 const hit=new T.Raycaster(p.clone().addScaledVector(normal,3),normal.clone().negate(),0,5).intersectObject(mesh)[0];
 const layer=hit?chunk.layers[chunk.indices[hit.faceIndex!*3]]:undefined;
 geometry.dispose();(mesh.material as T.Material).dispose();return{hit,layer};
}
if(address===85)test('official85 envelope retains original metadata, visible body openings and sourced roof crest through worker transport',()=>{
 const saved=JSON.stringify(feature.properties);
 for(const look of looks)for(const mode of ['walls','coarse']as const){
  const result=buildTransportedEnvelopeChunk([feature],{look,mode,profiles:[profile],streets,surveyedEnvelopeData:[surveyed85]as any},'2026-10-06T23:59:59Z');
  assert.deepEqual(result.boundParentIds,[String(feature.properties.id)]);
  assert.equal(JSON.stringify(feature.properties),saved);assert.equal(feature.properties.height,16.23);assert.equal(feature.properties.constructionYear,1746);
  const roofMax=Math.max(...Array.from(result.chunk.positions).filter((_,i)=>i%3===2));assert(roofMax>18.08&&roofMax<18.10,'source crest is separate from aggregate wall height');
  for(const w of plan.windows){const h=firstHit(result.chunk,w.left+w.width*.41,w.bottom+w.height*.39);assert(h.hit);assert(Math.abs(h.hit.distance-(3-w.out))<.003,'surveyed body does not bury glass');}
  const invalid=structuredClone(surveyed85);invalid.source.quality.rmseM=2.47;
  const fallback=buildTransportedEnvelopeChunk([feature],{look,mode,profiles:[profile],streets,surveyedEnvelopeData:[invalid]as any},'2026-10-06T23:59:59Z');
  assert.deepEqual(fallback.boundParentIds,[]);const stock=buildFeatureChunk([feature],look,mode,streets,[profile]);
  for(const key of ['positions','uvs','layers','tints','accents','indices']as const)assert.deepEqual(fallback.chunk[key],stock[key]);
 }
});
test(`${address} native regular panes and recessed door remain visible and textured in ordinary and coarse wall LOD`,()=>{
 assert.equal(feature.properties.constructionYear,address===85?1746:null,'native factual year retained');assert.equal(plan.axes.length,3);assert.equal(profile.recipes[0].recipe.regularCanalFrontage!.upperRows.length,address===85?3:4);assert.ok(plan);
 for(const look of looks)for(const mode of ['walls','coarse'] as const){
  const wall=buildFeatureChunk([feature],look,mode,streets,[profile]);
  const chunk=mode==='walls'?[wall,buildFeatureChunk([feature],look,'extras',streets,[profile])]:wall;
  const layers=bayLookFor(String(feature.properties.id),address===85?1746:null,Number(feature.properties.height),look==='procedural'?'photo':look,undefined,profile.recipes[0].recipe).layers;
  const offset=look==='procedural'?PROCEDURAL_RECIPE_LAYER_OFFSET:0;
  for(const w of plan.windows){const{hit,layer}=firstHit(chunk,w.left+w.width*.41,w.bottom+w.height*.39);assert.ok(hit,`${look}/${mode}/${w.part}`);assert.equal(layer,layers.upper+offset,`${look}/${mode}/${w.part}: buried glazing`);assert.ok(Math.abs(hit.distance-(3-w.out))<.003);}
  const{hit,layer}=firstHit(chunk,plan.access.axis,plan.access.bottom+.95);assert.ok(hit);assert.equal(layer,layers.door+offset,'source access has a textured door');assert.ok(Math.abs(hit.distance-(3-plan.access.out-(address===85?.020:.008)))<.003,'ordinary parent does not close raised access');
  const lower=firstHit(chunk,plan.lowerAccess.axis,plan.lowerAccess.bottom+.85);assert.equal(lower.layer,layers.door+offset);assert.ok(Math.abs(lower.hit!.distance-(3-plan.lowerAccess.out-(address===85?.020:.008)))<.003,'basement access remains open and textured');
  assert.ok(Array.from(wall.positions).every(Number.isFinite));
 }
});
test(`${address} incompatible regular layout preserves identical ordinary facade and extras arrays`,()=>{
 const without={...profile,recipes:profile.recipes.map(p=>({...p,recipe:{...p.recipe,regularCanalFrontage:undefined}}))};
 const rejected={...profile,recipes:profile.recipes.map(p=>({...p,recipe:{...p.recipe,regularCanalFrontage:{...p.recipe.regularCanalFrontage!,ground:{...p.recipe.regularCanalFrontage!.ground,widthM:2.6}}}}))};
 for(const look of looks)for(const mode of ['walls','extras','coarse'] as const){
  const a=buildFeatureChunk([feature],look,mode,streets,[without]),b=buildFeatureChunk([feature],look,mode,streets,[rejected]);
  for(const key of ['positions','uvs','layers','tints','accents','indices'] as const)assert.deepEqual(b[key],a[key],`${look}/${mode}/${key}`);
 }
});
test(`${address} native ring reversal and collinear tessellation preserve source-directed regular first hits`,()=>{
 const rings=(feature.geometry as {coordinates:number[][][]}).coordinates,raw=rings[0],edge=address===85?0:raw.length-2,a=raw[edge],b=raw[edge+1],middle=[(a[0]+b[0])/2,(a[1]+b[1])/2];
 const split:Feature={...feature,geometry:{type:'Polygon',coordinates:[[...raw.slice(0,edge+1),middle,...raw.slice(edge+1)],...rings.slice(1)]}};
 const reversed:Feature={...feature,geometry:{type:'Polygon',coordinates:rings.map(r=>[...r].reverse())}};
 for(const f of[split,reversed])for(const look of looks){
  const chunk=['walls','extras'].map(mode=>buildFeatureChunk([f],look,mode as 'walls'|'extras',streets,[profile]));
  for(const w of plan.windows){const{hit}=firstHit(chunk,w.left+w.width*.41,w.bottom+w.height*.39);assert.ok(hit);assert.ok(Math.abs(hit.distance-(3-w.out))<.003,`${look}/${w.part}: polygon ordering moved source zones`);}
  assert.ok(Math.abs(firstHit(chunk,plan.access.axis,plan.access.bottom+.85).hit!.distance-(3-plan.access.out-(address===85?.020:.008)))<.003);
 }
});
test(`${address} bounded regular candidate preserves transition and courtyard-heldout neighbors`,()=>{
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

}

test('native99 courtyard opening remains unchanged under body candidate',()=>{
 const sample=regularSamples.find(s=>s.address===99)!,rings=(sample.feature.geometry as {coordinates:number[][][]}).coordinates;
 assert.equal(rings.length,2);
 const hole=rings[1].slice(0,-1),lng=hole.reduce((n,p)=>n+p[0],0)/hole.length,lat=hole.reduce((n,p)=>n+p[1],0)/hole.length;
 const x=(lng-ORIGIN.lng)*111320*Math.cos(ORIGIN.lat*Math.PI/180),y=(lat-ORIGIN.lat)*110540;
 function hit(chunk:Chunk){const g=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(chunk.positions,3));g.setIndex(new T.BufferAttribute(chunk.indices,1));const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));const ray=new T.Raycaster(new T.Vector3(x,y,40),new T.Vector3(0,0,-1),0,45);const result=ray.intersectObject(m).map(h=>({distance:h.distance,layer:chunk.layers[chunk.indices[h.faceIndex!*3]]}));g.dispose();(m.material as T.Material).dispose();return result;}
 for(const look of looks)for(const mode of ['walls','extras','coarse'] as const){const before=buildFeatureChunk([sample.feature],look,mode,streets),after=buildFeatureChunk([sample.feature],look,mode,streets,regularProfiles);assert.deepEqual(hit(after),hit(before),`${look}/${mode}: native courtyard cap changed`);}
});
