import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {ShapeUtils,Vector2} from 'three';
import {inferPrincipalFrontReturn, type FrontReturnOptions} from './front-return.ts';
import type {CanalHouseRecipe,CanalhousePoint} from '../../src/canalRecall/canalhouseRecipes.ts';
type Roof=CanalHouseRecipe['roof']['value'][number];
type Point=CanalhousePoint;
const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const height=(r:Roof,p:Point)=>r.plane.heightM+p[0]*r.plane.slopeX+p[1]*r.plane.slopeZ;
const triangles=(roofs:Roof[])=>roofs.flatMap(r=>{const v=[r.polygon.outer,...r.polygon.holes].flat();return ShapeUtils.triangulateShape(r.polygon.outer.map(p=>new Vector2(...p)),r.polygon.holes.map(h=>h.map(p=>new Vector2(...p)))).map(t=>({r,t:t.map(i=>v[i])}));});
const inside=(p:Point,t:Point[])=>{const d=t.map((a,i)=>cross(a,t[(i+1)%3],p));return d.every(v=>v>=-1e-9)||d.every(v=>v<=1e-9);};
const options:FrontReturnOptions={principalFront:[[0,0],[6,0]],inwardNormal:[0,1],bodyHeightM:10,transitionDepthM:3,slopeInward:1.5,confidence:.25};
const source:Roof[]=[{polygon:{outer:[[0,0],[0,8],[6,8],[6,0]],holes:[[[2,1],[4,1],[4,4],[2,4]]]},plane:{heightM:13,slopeX:0,slopeZ:0}}];

test('finite lower envelope retains exact occupied area, empty courtyard and source vertices outside strip',()=>{
 const before=JSON.stringify(source),result=inferPrincipalFrontReturn(source,options);
 assert.equal(JSON.stringify(source),before);
 assert.equal(result.provenance.sourceAreaM2,42);
 assert.ok(Math.abs(result.provenance.resultAreaM2-42)<1e-9);
 const output=triangles(result.roofs);
 let changed=0,samples=0;
 for(let x=.067;x<6;x+=.113)for(let z=.049332;z<8;z+=.137){
  const p:Point=[x,z],hits=output.filter(q=>inside(p,q.t));
  if(x>2&&x<4&&z>1&&z<4){assert.equal(hits.length,0,'courtyard must remain open');continue;}
  assert.equal(hits.length,1,`gap/overlap at ${p}`);
  const expected=z<=3?Math.min(13,10+1.5*z):13;
  assert.ok(Math.abs(height(hits[0].r,p)-expected)<1e-8);
  if(expected<13)changed++;samples++;
 }
 assert.ok(changed>300&&samples>2000);
 for(const p of source[0].polygon.outer.filter(p=>p[1]>3)){
  const hits=result.roofs.filter(r=>r.polygon.outer.some(v=>v.every((n,i)=>Math.abs(n-p[i])<1e-9)));
  assert.ok(hits.length>0);assert.ok(hits.every(r=>height(r,p)===13));
 }
 assert.ok(result.roofs.every(r=>{const ring=r.polygon.outer;return ring.reduce((s,a,i)=>s+cross([0,0],a,ring[(i+1)%ring.length]),0)<0;}));
});

test('unchanged polygons/holes remain identical and inferred parts never raise low source roof',()=>{
 const low={...structuredClone(source[0]),plane:{heightM:9,slopeX:0,slopeZ:0}};
 assert.deepEqual(inferPrincipalFrontReturn([low],options).roofs,[low]);
 assert.equal(inferPrincipalFrontReturn([low],options).provenance.affectedSourcePlaneIndices.length,0);
});

test('bounds, reversed inward direction and discontinuous transition are rejected',()=>{
 assert.throws(()=>inferPrincipalFrontReturn(source,{...options,inwardNormal:[0,-1]}),/orientation/);
 assert.throws(()=>inferPrincipalFrontReturn(source,{...options,inwardNormal:[1,0]}),/perpendicular/);
 assert.throws(()=>inferPrincipalFrontReturn(source,{...options,transitionDepthM:7}),/bounds/);
 assert.throws(()=>inferPrincipalFrontReturn(source,{...options,transitionDepthM:1}),/continuous source join/);
 assert.throws(()=>inferPrincipalFrontReturn(source,{...options,slopeInward:NaN}),/Non-finite/);
 assert.throws(()=>inferPrincipalFrontReturn(source,{...options,sourceSurfaceIds:[]}),/ownership/);
 assert.throws(()=>inferPrincipalFrontReturn(source,{...options,principalFront:[[0,0],[3,0]]}),/beyond/);
});

test('427 candidate retains rear partition, original survey and exact area with source-plane envelope',()=>{
 const load=(name:string)=>JSON.parse(fs.readFileSync(new URL(`../../docs/references/canalhouse-recipes/${name}.json`,import.meta.url),'utf8'));
 const originalSurvey=load('herengracht-427-survey'),surveyBefore=JSON.stringify(originalSurvey);
 const entry=load('recipes').entries.find((e:any)=>e.recipe.id==='herengracht-427'),recipe:CanalHouseRecipe=entry.recipe;
 const before=JSON.stringify(recipe),front=recipe.elevations[0],outer=recipe.footprint.value[front.polygonIndex].outer;
 // Reconstruct planes from immutable original survey triangles. The generated
 // recipe can already contain this repair and is not the source fixture.
 const native:Roof[]=[],sourceSurfaceIds:string[]=[];
 const local=(p:number[]):Point=>[p[0]-entry.anchorRD[0],entry.anchorRD[1]-p[1]];
 for(const surface of originalSurvey.roofsRD){
  const rings:number[][][]=surface.ringsRD??[surface.vertices],vertices=rings.flat();
  const mapped=rings.map(r=>r.map(p=>new Vector2(...local(p))));
  for(const indices of ShapeUtils.triangulateShape(mapped[0],mapped.slice(1))){
   const points=indices.map(i=>local(vertices[i])),heights=indices.map(i=>vertices[i][2]-originalSurvey.attributes.b3_h_maaiveld);
   const [p,q,v]=points,den=cross(p,q,v);
   if(Math.abs(den)<1e-9)continue;
   const slopeX=((heights[1]-heights[0])*(v[1]-p[1])-(heights[2]-heights[0])*(q[1]-p[1]))/den;
   const slopeZ=((q[0]-p[0])*(heights[2]-heights[0])-(v[0]-p[0])*(heights[1]-heights[0]))/den;
   if(den>0)points.reverse();
   native.push({polygon:{outer:points,holes:[]},plane:{heightM:heights[0]-p[0]*slopeX-p[1]*slopeZ,slopeX,slopeZ}});
   sourceSurfaceIds.push(surface.surfaceId);
  }
 }
 const nativeBefore=JSON.stringify(native);
 const a=outer[front.edgeIndex],b=outer[front.endEdgeIndex!],dx=b[0]-a[0],dz=b[1]-a[1],width=Math.hypot(dx,dz);
 const opt:FrontReturnOptions={principalFront:[a,b],inwardNormal:[dz/width,-dx/width],bodyHeightM:14.53697612430032,transitionDepthM:3,slopeInward:1.25,frontageToleranceM:.3,confidence:.25,sourceSurfaceIds};
 const out=inferPrincipalFrontReturn(native,opt);
 assert.equal(JSON.stringify(native),nativeBefore);
 assert.equal(JSON.stringify(recipe),before);assert.equal(JSON.stringify(originalSurvey),surveyBefore);
 assert.ok(Math.abs(out.provenance.sourceAreaM2-106.20375350011675)<1e-7);
 assert.ok(Math.abs(out.provenance.sourceAreaM2-out.provenance.resultAreaM2)<1e-7);
 assert.ok(out.provenance.affectedSourcePlaneIndices.length>0);
 assert.deepEqual(out.provenance.affectedSourceSurfaceIds,['NL.IMBAG.Pand.0363100012177599-0:lod22:roof:28','NL.IMBAG.Pand.0363100012177599-0:lod22:roof:29']);
 const depth=(p:Point)=>(p[0]-a[0])*opt.inwardNormal[0]+(p[1]-a[1])*opt.inwardNormal[1];
 const output=triangles(out.roofs);
 for(const [i,r] of native.entries())if(!out.provenance.affectedSourcePlaneIndices.includes(i))assert.deepEqual(out.roofs[out.provenance.parts.findIndex(p=>p.sourcePlaneIndex===i)],r);
 let lowered=0;
 for(const {r,t} of triangles(native))for(const weights of [[.23,.31,.46],[.47,.19,.34],[.11,.61,.28]]){
  const p:Point=[0,1].map(i=>t.reduce((s,v,k)=>s+weights[k]*v[i],0)) as Point;
  const hits=output.filter(q=>inside(p,q.t));assert.equal(hits.length,1);
  const expected=depth(p)<3?Math.min(height(r,p),opt.bodyHeightM+1.25*depth(p)):height(r,p);
  assert.ok(Math.abs(height(hits[0].r,p)-expected)<1e-7);if(expected<height(r,p)-1e-7)lowered++;
 }
 assert.ok(lowered>0);
 for(const r of native)for(const p of r.polygon.outer.filter(p=>depth(p)>3)){
  assert.ok(out.roofs.some(s=>s.polygon.outer.some(v=>v.every((n,i)=>Math.abs(n-p[i])<1e-8))&&Math.abs(height(s,p)-height(r,p))<1e-7));
 }
 const repeated=inferPrincipalFrontReturn(out.roofs,{...opt,sourceSurfaceIds:undefined});
 assert.deepEqual(repeated.roofs,out.roofs);assert.deepEqual(repeated.provenance.affectedSourcePlaneIndices,[]);
 const generatedRepeated=inferPrincipalFrontReturn(recipe.roof.value,{...opt,sourceSurfaceIds:undefined});
 assert.deepEqual(generatedRepeated.provenance.affectedSourcePlaneIndices,[]);
 assert.deepEqual(generatedRepeated.roofs,recipe.roof.value);
});
