import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {ShapeUtils,Vector2} from 'three';
import {reconcileHerengracht423Survey} from './frontage-423.ts';
const load=(name:string)=>JSON.parse(fs.readFileSync(new URL(`../../docs/references/canalhouse-recipes/${name}.json`,import.meta.url),'utf8'));
const source=load('herengracht-423-survey');
const house=load('pilot-inventory').houses.find((h:any)=>h.id==='herengracht-423');
const cross=(a:number[],b:number[],p:number[])=>((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
const insideTriangle=(p:number[],t:number[][])=>{const values=t.map((a,i)=>cross(a,t[(i+1)%3],p));return values.every(v=>v>=-1e-8)||values.every(v=>v<=1e-8)};
test('423 exact BAG reconciliation covers the native footprint without borrowing neighbors',()=>{
 const before=JSON.stringify(source),houseBefore=JSON.stringify(house),{survey,provenance}=reconcileHerengracht423Survey(source,house);
 assert.equal(JSON.stringify(source),before);assert.equal(JSON.stringify(house),houseBefore);
 assert.ok(Math.abs(provenance.frontWidthM-4.941118339)<1e-6);
 assert.ok(Math.abs(provenance.projectedRoofAreaM2-provenance.footprintAreaM2)<1e-7);
 assert.equal(survey.roofsRD.length,source.roofsRD.length);
 const footprint=survey.surveyFootprintPolygonsRD[0][0],anchor=footprint[0];
 const triangles=(rings:number[][][])=>{const v=rings.flat();return ShapeUtils.triangulateShape(rings[0].map(p=>new Vector2(p[0]-anchor[0],p[1]-anchor[1])),rings.slice(1).map(r=>r.map(p=>new Vector2(p[0]-anchor[0],p[1]-anchor[1])))).map(t=>t.map(i=>v[i]));};
 const roofTriangles=survey.roofsRD.flatMap((r:any)=>triangles(r.ringsRD)),footprintTriangles=triangles([footprint]);
 const xMin=Math.min(...footprint.map((p:number[])=>p[0])),xMax=Math.max(...footprint.map((p:number[])=>p[0]));
 const yMin=Math.min(...footprint.map((p:number[])=>p[1])),yMax=Math.max(...footprint.map((p:number[])=>p[1]));
 let samples=0;
 for(let x=xMin+.037;x<xMax;x+=.13)for(let y=yMin+.051;y<yMax;y+=.13){
  const p=[x,y],inside=footprintTriangles.some(t=>insideTriangle(p,t)),count=roofTriangles.filter(t=>insideTriangle(p,t)).length;
  assert.equal(count,inside?1:0,`Roof overlap/gap/outside footprint at ${p}`);samples++;
 }
 assert.ok(samples>5000);
 assert.ok(provenance.boundaryChanges.every(c=>c.horizontalDistanceM<=.1));
 assert.ok(provenance.boundaryChanges.some(c=>c.kind.includes('rear-right')));
 const roof38=survey.roofsRD.find((r:any)=>r.surfaceId.endsWith(':38'));
 for(const corner of provenance.frontRightContinuationCornersRD)assert.ok(roof38.vertices.some((p:number[])=>p.every((v,i)=>Math.abs(v-corner[i])<1e-8)));
 assert.equal(survey.attributes.b3_h_maaiveld,source.attributes.b3_h_maaiveld);
 assert.deepEqual(survey.semanticSurfacesRD,source.semanticSurfacesRD);
 assert.equal(provenance.corniceEvidence.status.startsWith('absolute metric cornice remains unresolved'),true);
});
test('423 reconciliation rejects different identities and changed source planes',()=>{
 assert.throws(()=>reconcileHerengracht423Survey(source,{...house,bagId:'different'}),/identity/);
 const changed=structuredClone(source);changed.roofsRD.find((r:any)=>r.surfaceId.endsWith(':38')).vertices[0][2]+=1;
 assert.throws(()=>reconcileHerengracht423Survey(changed,house),/plane changed/);
});
test('opt-in front return partitions the lower envelope and preserves rear/source geometry',()=>{
 const before=JSON.stringify(source),base=reconcileHerengracht423Survey(source,house),candidate=reconcileHerengracht423Survey(source,house,{inferFrontReturn:true});
 assert.equal(JSON.stringify(source),before);
 assert.equal(base.provenance.frontReturn.enabled,false);
 const proposal=candidate.provenance.frontReturn;
 assert.equal(proposal.enabled,true);if(!proposal.enabled)return;
 assert.equal(proposal.confidence,.25);
 assert.ok(Math.abs(candidate.provenance.projectedRoofAreaM2-base.provenance.footprintAreaM2)<1e-7);
 for(const n of [36,37,39])assert.deepEqual(candidate.survey.roofsRD.find((r:any)=>r.surfaceId.endsWith(`:${n}`)),base.survey.roofsRD.find((r:any)=>r.surfaceId.endsWith(`:${n}`)));
 const [a,b]=proposal.principalFrontlineRD,dx=b[0]-a[0],dy=b[1]-a[1],width=Math.hypot(dx,dy);
 const hip=(p:number[])=>proposal.frontHeightNAP+proposal.slopeInward*((p[0]-a[0])*(-dy)+(p[1]-a[1])*dx)/width;
 const triangles=(roofs:any[])=>roofs.flatMap(r=>{const v=r.ringsRD.flat(),o=v[0];return ShapeUtils.triangulateShape(r.ringsRD[0].map((p:number[])=>new Vector2(p[0]-o[0],p[1]-o[1])),r.ringsRD.slice(1).map((ring:number[][])=>ring.map(p=>new Vector2(p[0]-o[0],p[1]-o[1])))).map(t=>({points:t.map(i=>v[i]),id:r.reconciliation.sourceSurfaceId??r.surfaceId}));});
 const original=triangles(base.survey.roofsRD).filter(t=>Math.abs(cross(...t.points as [number[],number[],number[]]))>1e-8),corrected=triangles(candidate.survey.roofsRD).filter(t=>Math.abs(cross(...t.points as [number[],number[],number[]]))>1e-8);
 const height=(p:number[],t:number[][])=>{const [a,b,c]=t,den=cross(a,b,c),u=cross(a,p,c)/den,v=cross(a,b,p)/den;return a[2]+u*(b[2]-a[2])+v*(c[2]-a[2]);};
 let lowered=0;
 for(const {points:t,id} of original){
  // Interior samples avoid partition boundaries and independently check that
  // the exact source/hip envelope agrees with the newly split polygon planes.
  for(const weights of [[.23,.31,.46],[.47,.19,.34],[.11,.61,.28]]){
   const p=[0,1].map(i=>t.reduce((sum,v,k)=>sum+weights[k]*v[i],0)),hits=corrected.filter(r=>insideTriangle(p,r.points));
   assert.equal(hits.length,1,`Split gap/overlap at ${p}`);
   const sourceHeight=height(p,t),expected=proposal.affectedSourceSurfaceIds.includes(id)?Math.min(sourceHeight,hip(p)):sourceHeight;
   assert.ok(Math.abs(height(p,hits[0].points)-expected)<1e-7);
   if(expected<sourceHeight-1e-6)lowered++;
  }
 }
 assert.ok(lowered>10);
 assert.ok(candidate.survey.roofsRD.some((r:any)=>r.vertices.some((p:number[])=>p.every((v,i)=>Math.abs(v-proposal.preservedInteriorRidgeRD[i])<1e-7))));
 assert.deepEqual(candidate.survey.semanticSurfacesRD,source.semanticSurfacesRD);
});
