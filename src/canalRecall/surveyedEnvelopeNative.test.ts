import envelopeFixture from './fixtures/compoundSurveyEnvelope.json';
import installedFootprintFixture from './fixtures/compoundInstalledFootprint.json';
const fixtureReviewClock='2026-10-06T23:59:59Z';
import {test} from'node:test';import assert from'node:assert/strict';import * as T from'three';
import {adaptSurveyedBuildingEnvelope}from'./surveyedBuildingEnvelope.ts';import{bindSurveyedEnvelopeToMesh,type SurveyedMeshBinding}from'./surveyedEnvelopeMeshBinding.ts';
import{buildFeatureChunk,ORIGIN,type Feature}from'./threeBuildingFeatures.ts';import type{Chunk}from'./threeBuildingMesh.ts';
import{compoundSourceFeature as feature,compoundSourceRecipe as recipe,compoundSourceFixture,compoundSourceFront as front}from'./compoundSourceCandidate.fixture.ts';
import{compoundProfile,compoundStreets as streets,compoundNeighbors as neighbors}from'./compoundNativeFrontage.fixture.ts';import{planCompoundFrontage}from'./compoundFrontageLayout.ts';import{bayLookFor}from'./bayLook.ts';import{PROCEDURAL_RECIPE_LAYER_OFFSET}from'./streetFacadeRendering.ts';
const candidate=JSON.parse(JSON.stringify(envelopeFixture)),nativeId=String(feature.properties.id),profile={...compoundProfile,recipes:compoundProfile.recipes.map(r=>({...r,recipe}))};
function bindingFor(f:Feature=feature){const plan=adaptSurveyedBuildingEnvelope(candidate,{nativeParentId:nativeId,footprint:feature.geometry as any,...candidate.nativeMetadata,now:fixtureReviewClock});assert(plan);const binding=bindSurveyedEnvelopeToMesh(plan,f.geometry as any,ORIGIN);assert(binding);return binding;}
const binding=bindingFor(),map=new Map([[nativeId,binding]]),top=Math.min(...binding.edges[0].segments.flatMap(s=>[s.z0,s.z1])),plan=planCompoundFrontage({lengthM:front.lengthM,baseM:0,topM:top,recipe:compoundSourceFixture});assert(plan);
const looks=['photo','storybook','procedural']as const,modes=['walls','coarse']as const;
function build(f:Feature=feature,look:typeof looks[number]='photo',mode:typeof modes[number]='walls',bindings:ReadonlyMap<string,SurveyedMeshBinding>=map,extra:Feature[]=[]){return buildFeatureChunk([f,...extra],look,mode,streets,[profile],[],[],bindings);}
function ray(chunk:Chunk,start:T.Vector3,direction:T.Vector3){const geometry=new T.BufferGeometry().setAttribute('position',new T.BufferAttribute(chunk.positions,3));geometry.setIndex(new T.BufferAttribute(chunk.indices,1));const material=new T.MeshBasicMaterial({side:T.DoubleSide}),mesh=new T.Mesh(geometry,material),hits=new T.Raycaster(start,direction,0,100).intersectObject(mesh);const result=hits.map(hit=>({distance:hit.distance,point:hit.point,layer:chunk.layers[chunk.indices[hit.faceIndex!*3]],face:hit.faceIndex!}));geometry.dispose();material.dispose();return result;}
function frontHit(chunk:Chunk,along:number,z:number){const p=new T.Vector3(front.x+front.ux*along,front.y+front.uy*along,z),n=new T.Vector3(front.nx,front.ny,0);return ray(chunk,p.addScaledVector(n,3),n.negate())[0];}
function sameChunk(a:Chunk,b:Chunk){for(const k of['positions','uvs','layers','tints','accents','indices']as const)assert.deepEqual(a[k],b[k],k);assert.deepEqual(a.ranges,b.ranges);}
test('surveyed native street eave retains source main/shaft glazing and true textured access first hits in all looks and coarse',()=>{
 for(const look of looks)for(const mode of modes){const chunk=build(feature,look,mode),active=bayLookFor(nativeId,1650,22.99,look==='procedural'?'photo':look,undefined,recipe).layers,offset=look==='procedural'?PROCEDURAL_RECIPE_LAYER_OFFSET:0;
  for(const w of plan!.windows){const hit=frontHit(chunk,w.left+w.width*.41,w.bottom+w.height*.39);assert(hit,`${look}/${mode}/${w.part}`);assert.equal(hit.layer,active.upper+offset);assert(Math.abs(hit.distance-(3-w.out))<.004,`${look}/${mode}/${w.part}: buried pane`);}
  const door=frontHit(chunk,plan!.access.axis,plan!.access.bottom+.95);assert(door);assert.equal(door.layer,active.door+offset);assert(Math.abs(door.distance-(3-plan!.access.out))<.004,'true recessed access is not buried');assert.equal(feature.properties.height,22.99);assert.equal(feature.properties.constructionYear,1650);assert(Array.from(chunk.positions).every(Number.isFinite));
 }
});
test('source body bounds follow each native edge and roof is never replaced by a phantom aggregate flat cap',()=>{
 for(const look of looks)for(const mode of modes){const chunk=build(feature,look,mode);for(const edge of binding.edges){for(const t of[.17,.43,.77]){const z=edge.topAt(t)!;const p=new T.Vector3(edge.start[0]+(edge.end[0]-edge.start[0])*t,edge.start[1]+(edge.end[1]-edge.start[1])*t,z),dx=edge.end[0]-edge.start[0],dy=edge.end[1]-edge.start[1],n=new T.Vector3(dy,-dx,0).normalize();const below=ray(chunk,p.clone().addScaledVector(n,1).add(new T.Vector3(0,0,-.015)),n.clone().negate()).find(h=>Math.abs(h.distance-1)<.004);assert(below,`${look}/${mode}/edge${edge.nativeEdgeIndex}: unclosed source eave`);assert(Math.abs(below.distance-1)<.004,`${look}/${mode}/edge${edge.nativeEdgeIndex}: eave moved distance=${below.distance} height=${z}`);}}
  let phantom=0;for(let i=0;i<chunk.indices.length;i+=3){const pts=Array.from(chunk.indices.slice(i,i+3),k=>Array.from(chunk.positions.slice(k*3,k*3+3)));if(pts.every(p=>Math.abs(p[2]-22.99)<.0001)){const area=Math.abs((pts[1][0]-pts[0][0])*(pts[2][1]-pts[0][1])-(pts[1][1]-pts[0][1])*(pts[2][0]-pts[0][0]));if(area>.001)phantom++;}}assert.equal(phantom,0);assert(Math.max(...Array.from(chunk.positions).filter((_,i)=>i%3===2))>25.5,'true local crest remains roof-only above aggregate height');
 }
});
test('absent, parent/geometry/origin mismatch and incomplete bindings preserve byte-identical stock fallback',()=>{
 for(const look of looks)for(const mode of modes){const baseline=build(feature,look,mode,new Map());for(const rejected of[{...binding,nativeParentId:'neighbor'},{...binding,installedFootprintFingerprint:'wrong'},{...binding,meshOrigin:{lng:0,lat:0}},{...binding,edges:binding.edges.slice(1)}])sameChunk(build(feature,look,mode,new Map([[nativeId,rejected]])),baseline);sameChunk(buildFeatureChunk([feature],look,mode,streets,[profile]),baseline);}
});
test('ring reversal uses actual source edge tops and unaffected neighbors retain identical vertex data',()=>{
 const raw=(feature.geometry as any).coordinates[0],reversed:Feature={...feature,geometry:{type:'Polygon',coordinates:[[...raw].reverse()]}};for(const look of looks)for(const mode of modes){const flipped=build(reversed,look,mode,new Map([[nativeId,bindingFor(reversed)]]));for(const w of plan!.windows)assert(Math.abs(frontHit(flipped,w.left+w.width*.41,w.bottom+w.height*.39).distance-(3-w.out))<.004);
  const before=build(feature,look,mode,new Map(),neighbors),after=build(feature,look,mode,map,neighbors);for(const neighbor of neighbors){const id=String(neighbor.properties.id),a=before.ranges.find(r=>r.id===id),b=after.ranges.find(r=>r.id===id);assert(a&&b);assert.equal(a.count,b.count);for(const[k,stride]of[['positions',3],['uvs',2],['layers',1],['tints',4],['accents',4]]as const)assert.deepEqual(after[k].slice(b.start*stride,(b.start+b.count)*stride),before[k].slice(a.start*stride,(a.start+a.count)*stride),`${look}/${mode}/${id}/${k}`);}
 }
});
/** The installed rounding proof does not establish watertight roof attachment.
 * Measure the nearest surveyed roof boundary/plane to the unchanged native
 * wall-top sample; keep XY gap and vertical mismatch separate. */
export function roofPerimeterAudit(candidateBinding:SurveyedMeshBinding=binding){
 const nearest=(x:number,y:number,z:number)=>{
  const target=new T.Vector3(x,y,z),closest=new T.Vector3(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),triangle=new T.Triangle(a,b,c);let best={distance:Infinity,dz:Infinity,total:Infinity};
  for(const roof of candidateBinding.roofTriangles){a.fromArray(roof.p[0]);b.fromArray(roof.p[1]);c.fromArray(roof.p[2]);triangle.closestPointToPoint(target,closest);const total=target.distanceTo(closest);if(total<best.total)best={distance:Math.hypot(closest.x-x,closest.y-y),dz:Math.abs(closest.z-z),total};}return best;
 };
 return candidateBinding.edges.map(edge=>({nativeEdgeIndex:edge.nativeEdgeIndex,samples:[...new Set([.05,.17,.43,.77,.95,...edge.segments.flatMap(s=>[s.t0,s.t1,...[.25,.5,.75].map(f=>s.t0+(s.t1-s.t0)*f)])])].map(t=>({t,...nearest(edge.start[0]+(edge.end[0]-edge.start[0])*t,edge.start[1]+(edge.end[1]-edge.start[1])*t,edge.topAt(t)!)}))}));
}
test('surveyed roof perimeter joins exact native wall upper boundaries without rounding gaps',()=>{
 const audit=roofPerimeterAudit(),maxXY=Math.max(...audit.flatMap(e=>e.samples.map(s=>s.distance))),maxZ=Math.max(...audit.flatMap(e=>e.samples.map(s=>s.dz)));
 assert(maxXY<.003&&maxZ<.003,`Roof ownership unresolved: maxXY=${maxXY.toFixed(6)}m maxZ=${maxZ.toFixed(6)}m; per-edge=${JSON.stringify(audit.map(e=>({edge:e.nativeEdgeIndex,xy:Math.max(...e.samples.map(s=>s.distance)),z:Math.max(...e.samples.map(s=>s.dz))})))}`);
});
