import assert from 'node:assert/strict';
import * as T from 'three';
import {buildRaiEuropahal} from './landmarks/rai-europahal-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import source from './landmarks/rai-europahal-footprints.json';
import spec from './landmarks/rai-amsterdam-spec.json';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
const group=new T.Group();let triangles=0;
const tools={add(g:T.BufferGeometry,c:string){const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.FrontSide}));m.userData.colour=c;group.add(m);triangles+=(g.index?.count??g.getAttribute('position').count)/3;}} as BuildingTools;
const decodedPath=process.argv[2];
if(decodedPath){
 await MeshoptDecoder.ready;
 const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(decodedPath);
 for(const node of doc.getRoot().listNodes())for(const primitive of node.getMesh()?.listPrimitives()??[]){
  const g=new T.BufferGeometry(),p=primitive.getAttribute('POSITION')!;
  g.setAttribute('position',new T.Float32BufferAttribute(Array.from({length:p.getCount()},(_,i)=>p.getElement(i,[])).flat(),3));
  const indices=primitive.getIndices();if(indices)g.setIndex(Array.from(indices.getArray()!));
  g.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));g.computeVertexNormals();
  tools.add(g,primitive.getMaterial()!.getName() as Parameters<BuildingTools['add']>[1]);
 }
}else buildRaiEuropahal(1,1,tools);
group.updateMatrixWorld(true);
const rotation=new T.Matrix4().makeRotationY(source.rotationY);
function ray(x:number,y:number,z:number,dx:number,dy:number,dz:number){return new T.Raycaster(new T.Vector3(x,y,z).applyMatrix4(rotation),new T.Vector3(dx,dy,dz).transformDirection(rotation),0,500).intersectObjects(group.children)}
assert(triangles<(decodedPath?40000:15000),'bounded share of whole RAI40k budget');
const b=new T.Box3().setFromObject(group);assert(Math.abs(b.max.y-51)<.01,'Signaal documented51m');
for(const m of group.children as T.Mesh[]){const p=m.geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i)),'finite native mesh')}
// Rays cross the actual exported-style FrontSide geometry, exposing upper arch and lower hall panes.
for(const z of[-203,-194,-182,-170,-158,-146,-142])for(const y of[2,7])assert.equal(ray(20,y,z,-1,0,0)[0]?.object.userData.colour,'glass',`front glass ${z}/${y}`);
for(const z of[-191,-182,-170,-158,-153])assert.equal(ray(20,13,z,-1,0,0)[0]?.object.userData.colour,'glass',`arch glass ${z}`);
for(const x of[-178,-130,-80,-20]) {
 const h=ray(x,30,-173.25,0,-1,0)[0];assert(h,'upward barrel roof');assert(h.point.y>16.5&&h.point.y<17.5,'exterior crest bounded by operator internal height+skin');
}
// The two large BAG western outdoor notches must never become modeled parcel slabs.
for(const [x,z]of[[-205,-223],[-205,-115],[-160,-65],[-80,-15]])assert.equal(ray(x,60,z,0,-1,0).length,0,`native open space ${x}/${z}`);
// Native footprint partition has no missing or excess wing coverage.
assert(Math.abs(source.areaCheck.gap)<.01,'exact plan partition');
// This exact named, installed barrel is modeled. Adjacent ordinary bridges,
// chimney and independent southern parts are outside the replacement scope.
assert(spec.suppressOsmIds.includes('w461439852'),'installed Europahal barrel replacement alias');
assert.equal(spec.spatialSuppression,false,'no padded spatial suppression');
assert.equal(spec.landmarkId,'n2817982961','genuine main venue remains distinct from Theater');
for(const id of ['w807204799','w57860179','w1239596089','w1239596090','w807505354','w199414696'])
 assert(!spec.suppressOsmIds.includes(id),`retain unmodeled installed ordinary part ${id}`);
// Independent first-hit rays seek the previously absent western assemblies, away from frames.
for(const strip of source.westernRoofStrips) {
 assert(strip.outsideArea>0&&strip.parentCoverageFraction>.95,'honest surveyed BAG/source discrepancy');
 assert.equal(strip.constructionYear,1969,'Amstelhal is distinct1969 physical scope');
 assert.equal(strip.modeledRings[0].length,strip.originalLocalRing.length,'complete surveyed strip perimeter');
 assert.equal(strip.relationMembership.length,0,'no asserted OSM parent relation');
 for(const y of[2,8,13.1])assert.equal(ray(-295,y,strip.ridgeZ+.4,1,0,0)[0]?.object.userData.colour,'glass',`west strip ${strip.osmWay}/${y}`);
 for(const x of[-267.3,-252.1,-231.7])for(const fraction of[.22,.45,.72]) {
  const z=strip.zMin+(strip.zMax-strip.zMin)*fraction;
  const expected=12+3*(1-Math.abs(z-strip.ridgeZ)/((strip.zMax-strip.zMin)/2));
  const hit=ray(x,30,z,0,-1,0)[0];assert(hit,'western roof front-face hit');
  assert(Math.abs(hit.point.y-expected)<.15,`supported gable height ${strip.osmWay}`);
  assert((hit.face?.normal.y??0)>.5,'upward western roof winding');
 }
 // Exterior upper glass supports the actual ridge, rather than a hovering roof plate.
 const wall=ray(-295,14.6,strip.ridgeZ+.1,1,0,0)[0];assert.equal(wall?.object.userData.colour,'glass','western upper gable wall support');
}
for(const z of[-269,-218,-168,-115]){const hit=ray(-251,30,z,0,-1,0)[0];assert(hit&&Math.abs(hit.point.y-11.2)<.04,'flat hall fields retained')}
// Source-height hall envelopes replace the lower southhall2 parent without buried roof caps.
for(const [x,z]of[[-150,-99],[-73,-99],[-195,-110],[-27,-110]]) {
 const hit=ray(x,40,z,0,-1,0)[0];assert(hit,'named flat hall roof');
 assert(Math.abs(hit.point.y-12)<.13,'hall2/3 source12m height envelope');
 assert((hit.face?.normal.y??0)>.99,'named hall roof upward');
}
// Exact source-protruding ends are owned physical glazing, not whole-parcel padding.
for(const strip of source.westernRoofStrips) {
 const x=Math.min(...strip.originalLocalRing.map(p=>p[0]))+.2;
 const hit=ray(-295,5,strip.ridgeZ,1,0,0)[0];assert(hit,'complete Amstel projecting end');
 const native=hit.point.clone().applyMatrix4(rotation.clone().invert());
 assert(native.x<x+1.0,'first hit on actual surveyed projecting end');
}
assert(!spec.suppressOsmIds.includes('w807090334'),'retain partially owned compound outside geometry');
assert(source.scopeRepair.extraExactPartAreaOutsideBag<85,'bounded actual source geometry extension');
const report={decodedPath:decodedPath??null,triangles,bounds:{min:b.min.toArray(),max:b.max.toArray()},barrelGlazing:true,roofUpward:true,nativeOpenNotches:true,namedHall12mEnvelopes:2,westernGlazedGabledStrips:3,westernFlatHallFields:4,exactOutsideBagArea:source.scopeRepair.extraExactPartAreaOutsideBag,compoundInferenceIssueUnresolved:true,scope:source.scopeRepair.physicalScope,acceptance:'independent gallery/live current hash pending'};
console.log(JSON.stringify(report));
