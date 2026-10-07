import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import maplibregl from 'maplibre-gl';
import {placementFor,type SignatureModelSpec} from '../src/canalRecall/landmarks/signaturePlacement';
import {buildCentraleMarkthal} from './landmarks/centrale-markthal-builder';
import source from './landmarks/centrale-markthal-footprints.json';
import spec from './landmarks/centrale-markthal-spec.json';
import type {BuildingTools} from './landmarks/cultural-builders';
const group=new T.Group();const panes:T.Mesh[]=[],roofs:T.Mesh[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.userData.colour=c;group.add(m);if(c==='glass')panes.push(m);if(g.userData.role?.includes('roof'))roofs.push(m);};
const unused=()=>{throw new Error('Unexpected lettering/shared detail');};
const tools:BuildingTools={add,box:(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a),prism:unused,hip:unused,gableRoof:unused,window:unused,clock:unused,sign:unused};
buildCentraleMarkthal(spec.footprint.widthMetres,spec.footprint.lengthMetres,tools);group.updateMatrixWorld(true);
let triangles=0;for(const m of group.children as T.Mesh[]){const p=m.geometry.getAttribute('position');assert.ok([...p.array].every(Number.isFinite));triangles+=(m.geometry.index?.count??p.count)/3;}
const bounds=new T.Box3().setFromObject(group);assert.ok(triangles<40000);assert.ok(bounds.max.y>28&&bounds.max.y<28.6);assert.ok(bounds.max.z-bounds.min.z<132);assert.ok(bounds.max.x-bounds.min.x<77);
for(const m of roofs){const n=m.geometry.getAttribute('normal');for(let i=0;i<n.count;i++)assert.ok(n.getY(i)>.01,'every explicit roof faces upward');}
assert.equal(spec.spatialSuppression,false);assert.ok(spec.suppressOsmIds.includes('NL.IMBAG.Pand.'+source.building.properties.identificatie));assert.ok(!source.neighborsToRetain.some(id=>spec.suppressOsmIds.includes(id)));
// Current installed building:part owns the high hall independently of its named BAG parent.
// The original parent aliases alone leave the coarse hall visible over the GLB.
for(const part of source.installedBuildingParts){
 assert.ok(spec.suppressOsmIds.includes(part.id),'every source-proven installed hall part is suppressed');
 assert.equal(part.parentBagId,source.building.properties.identificatie);
 assert.equal(part.tags['building:part'],'yes');
 const ring=source.building.geometry.coordinates[0];
 const inside=(x:number,y:number)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
 // Current OSM coordinates round to 1e-7 degrees; the surveyed BAG boundary
 // differs by at most 4.8 cm. Permit 15 cm on that boundary, never a wider mask.
 const kx=111320*Math.cos(source.anchor[1]*Math.PI/180),ky=111320;
 const boundaryDistance=(p:number[])=>{let best=Infinity;for(let i=1;i<ring.length;i++){const a=ring[i-1],b=ring[i],dx=(b[0]-a[0])*kx,dy=(b[1]-a[1])*ky,x=(p[0]-a[0])*kx,y=(p[1]-a[1])*ky,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,(x*dx+y*dy)/d)):0;best=Math.min(best,Math.hypot(x-t*dx,y-t*dy));}return best;};
 for(const p of part.geometry.coordinates[0])assert.ok(inside(p[0],p[1])||boundaryDistance(p)<=.15,'exact part stays inside surveyed parent or its source rounding boundary');

}
const failures:any[]=[],stairSamples:any[]=[],contextOcclusions:any[]=[],exteriorContextOcclusions:any[]=[];for(const pane of panes){if(pane.geometry.userData.role==='roof-skylight')continue;const box=new T.Box3().setFromObject(pane),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());const n=pane.geometry.userData.outwardNormal?new T.Vector3(...pane.geometry.userData.outwardNormal):size.x<size.z?new T.Vector3(Math.sign(center.x),0,0):new T.Vector3(0,0,Math.sign(center.z));const tangent=new T.Vector3(n.z,0,-n.x);
 const stair=pane.geometry.userData.role==='stair-bay-glazing';
 // Photo-backed vertical relationship: the uninterrupted four-storey window
 // ends shortly above the portico canopy, well below the loading-wing roof.
 // This broad interval checks that omitted lower storeys cannot regress while
 // deliberately avoiding an unsupported claim of centimetre survey precision.
 if(stair)assert.ok(box.min.y>3.89&&box.min.y<5,'stair glazing descends to just above the portico canopy');
 // Sample across the lower, middle and upper bay at three lateral positions.
 // Pane-interior points avoid the modeled mullions; a clear upper pane cannot
 // conceal an office wall covering most of the same tall glazed assembly.
 // Use fractions of each actual face: fixed metre offsets can fall outside
 // narrow returns or miss masonry covering the ends of wider panes.
 const points=stair?[...([.13,.37,.61,.87].map(h=>box.min.y+size.y*h)),4.65,6].flatMap(y=>[.16,.5,.84].map(t=>{const a=pane.geometry.getAttribute('position');return new T.Vector3(a.getX(0),y,a.getZ(0)).lerp(new T.Vector3(a.getX(1),y,a.getZ(1)),t)})):[center.clone().add(new T.Vector3(0,.19,0)).addScaledVector(tangent,.19)];
 for(const initial of points){
  // A two-metre origin enters the adjacent annex across a measured <1m gap.
  // Keep that contextual occlusion as evidence, while testing immediate exposure
  // from the actual space in front of the pane. Do not delete the annex.
  let p=initial.clone();const reach=stair?.05:2;
  const cast=(point:T.Vector3)=>new T.Raycaster(point.clone().addScaledVector(n,reach),n.clone().negate(),0,reach+.15).intersectObject(group,true)[0];
  let hit=cast(p);let mullionOffset=0;
  if(stair&&hit?.object.userData.colour==='frame'){
   // A source window includes real ladder bars. Inspect adjacent glass interior
   // rather than misreporting a deliberately modeled bar as buried glazing.
   for(const dy of [.09,-.09,.15,-.15]){const candidate=initial.clone().add(new T.Vector3(0,dy,0));if(candidate.y<=box.min.y+.04||candidate.y>=box.max.y-.04)continue;const next=cast(candidate);if(next?.object===pane){p=candidate;hit=next;mullionOffset=dy;break;}}
  }
  const backing=stair?new T.Raycaster(p.clone().addScaledVector(n,-.01),n.clone().negate(),0,.16).intersectObject(group,true)[0]:undefined;
  if(stair){const structure=new T.Raycaster(p.clone().addScaledVector(n,-.01),n.clone().negate(),0,.4).intersectObject(group,true).find(h=>h.object.userData.colour==='ochre');assert.ok(structure,'photo-matched projecting pane has close masonry backing');}
  const far=new T.Raycaster(p.clone().addScaledVector(n,2),n.clone().negate(),0,2.5).intersectObject(group,true)[0];
  // The local and two-metre origins can both sit inside the retained BAG
  // shell. Record a second contextual ray whose origin is guaranteed outside
  // the complete mesh bounds. This exposes enclosing shells that a short ray
  // misses. A face-normal ray remains a diagnostic, not a street-camera review.
  if(stair){const exteriorReach=bounds.getSize(new T.Vector3()).length()+1;
   const origin=p.clone().addScaledVector(n,exteriorReach);
   assert.ok(!bounds.containsPoint(origin),'contextual origin is outside all mesh bounds');
   const exteriorHit=new T.Raycaster(origin,n.clone().negate(),0,exteriorReach+.15).intersectObject(group,true)[0];
   if(exteriorHit?.object!==pane)exteriorContextOcclusions.push({point:p.toArray(),origin:origin.toArray(),hit:exteriorHit?.object.userData.colour,role:exteriorHit?.object.geometry.userData.role,distance:exteriorHit?.distance});
  }
  const record={point:p.toArray(),normal:n.toArray(),originDistance:reach,mullionOffset,lowerStorey:stair&&p.y<7.8,structuralBacking:stair?backing?.object.geometry.userData.role:undefined,visible:hit?.object===pane,hit:hit?.object.userData.colour,role:hit?.object.geometry.userData.role,distance:hit?.distance};
  if(stair){stairSamples.push(record);if(far?.object!==pane)contextOcclusions.push({point:p.toArray(),originDistance:2,hit:far?.object.userData.colour,role:far?.object.geometry.userData.role,distance:far?.distance});}if(!record.visible)failures.push(record);
 }
}
// Full-context camera rays use the geo-matched municipal stations, with all
// genuine source neighbors installed. Their vertical camera height is an
// approximate2.5m street-view datum, explicitly separate from municipal Z.
const context=new T.Group();context.add(group);
for(const neighbor of source.neighbors){const sh=new T.Shape();neighbor.localRing.forEach(([x,z],i)=>i?sh.lineTo(x,z):sh.moveTo(x,z));sh.closePath();const g=new T.ExtrudeGeometry(sh,{depth:neighbor.height,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,neighbor.height,0);const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.userData.role='retained-neighbor';m.userData.id=neighbor.id;context.add(m)}
context.updateMatrixWorld(true);
const sourceCameraFailures:any[]=[],sourceCameraSamples:any[]=[];
for(const pane of panes.filter(p=>p.geometry.userData.role==='stair-bay-glazing')){
 const a=pane.geometry.getAttribute('position'),side=a.getX(0)<0?'west':'east';
 const camera=side==='west'?new T.Vector3(-55.60592289330406,2.5,54.2016389082022):new T.Vector3(43.13793685528684,2.5,54.234833086409516);
 for(const y of[4.65,6,10,14,17])for(const t of[.16,.5,.84]){
  const point=new T.Vector3(a.getX(0),y,a.getZ(0)).lerp(new T.Vector3(a.getX(1),y,a.getZ(1)),t);
  let selected=point,hit:any;
  let adjustment:any;
  const position0=new T.Vector3(a.getX(0),y,a.getZ(0)),position1=new T.Vector3(a.getX(1),y,a.getZ(1));
  search:for(const dt of[0,.08,-.08,.16,-.16])for(const dy of[0,.09,-.09,.15,-.15]){const fraction=t+dt;if(fraction<.08||fraction>.92)continue;const p=position0.clone().lerp(position1,fraction).add(new T.Vector3(0,dy,0));const direction=p.clone().sub(camera);const next=new T.Raycaster(camera,direction.clone().normalize(),0,direction.length()+.1).intersectObject(context,true)[0];selected=p;hit=next;adjustment={dt,dy};if(next?.object===pane)break search;if(next?.object.userData.colour!=='frame')break search;}
  const record={side,camera:camera.toArray(),point:selected.toArray(),visible:hit?.object===pane,adjustment,hit:hit?.object.userData.colour,role:hit?.object.geometry.userData.role??hit?.object.userData.role,id:hit?.object.userData.id};sourceCameraSamples.push(record);if(!record.visible)sourceCameraFailures.push(record);
 }
}
const evidenceDirectory=process.env.MARKTHAL_CHECK_OUTPUT_DIR??'artifacts/centrale-markthal-review';
mkdirSync(evidenceDirectory,{recursive:true});
writeFileSync(join(evidenceDirectory,'firsthit-after-audit.json'),JSON.stringify({status:failures.length?'held-local-exposure':'local-exposure-pass-context-unverified',triangles,stairSamples,contextOcclusions,exteriorContextOcclusions,sourceCameraSamples,sourceCameraFailures,failures},null,2)+'\n');
for(const [x,z]of source.openSpaceProbes)assert.equal(new T.Raycaster(new T.Vector3(x,35,z),new T.Vector3(0,-1,0),0,36).intersectObject(group,true).length,0,'surveyed exterior remains open');
// Probe the loading roof interior, clear of the overhanging office cornice at x=-34.
for(const [x,z,max]of [[-34,-60,8],[32,-60,8],[-34.5,0,9],[33,0,9]]){const hit=new T.Raycaster(new T.Vector3(x,35,z),new T.Vector3(0,-1,0),0,36).intersectObject(group,true)[0];assert.ok(hit&&hit.point.y<max,`loading/annex roofs remain low at ${x},${z}: hit ${hit?.point.y} ${hit?.object.geometry.userData.role}`);assert.ok(hit.object.geometry.userData.role?.includes('roof'),'explicit roofs own exposed tops');}
// Independent source roof296 and stair309 share a front boundary. Verify
// each side of that actual boundary, rather than encoding the repaired shape.
const loadingSource=source.loadingRoofSurvey.localRings[0];
const stairSource=source.stairBaySurvey['309'].localRings[0];
for(const p of loadingSource.slice(0,2))assert.ok(stairSource.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<.001),'loading/stair roof boundary is shared in source');
// Do not confuse these AHN fitted roof fragments with the photographed
// complete stairhouse. Preserve their shared-contour evidence independently;
// the geo-matched window is now reconstructed from the actual facade instead.
for(const [x,z]of [[33.5,48],[-35,48]]){
 const hit=new T.Raycaster(new T.Vector3(x,35,z),new T.Vector3(0,-1,0),0,36).intersectObject(group,true)[0];
 assert.ok(hit&&hit.point.y<8,'source-supported low loading zone remains present');
}
// Independent review found the outer stair face too narrow. Photos show
// about4.1 facade/front-light widths; preserve a bounded broad face while
// the native316/310 annex roof interiors remain genuinely low.
for(const pane of panes.filter(p=>p.geometry.userData.role==='stair-bay-glazing')){
 const normal=pane.geometry.userData.outwardNormal;if(Math.abs(normal[0])<.99)continue;
 const side=new T.Box3().setFromObject(pane).getCenter(new T.Vector3()).x<0?-1:1;
 const screen=(group.children as T.Mesh[]).find(m=>m.geometry.userData.role==='photo-matched-stair-facade-screen'&&new T.Box3().setFromObject(m).getCenter(new T.Vector3()).x*side>0)!;
 const face=new T.Box3().setFromObject(screen),glass=new T.Box3().setFromObject(pane);
 const ratio=(face.max.z-face.min.z)/(glass.max.z-glass.min.z);
 assert.ok(ratio>3.7&&ratio<4.6,'stair street face follows observed broad facade/window proportion');
 assert.ok(face.max.x-face.min.x<.5,'photo-guided upper facade remains a thin wall, not an invented raised annex');
}
for(const [x,z]of [[-34.5,61.5],[33,61.5]]){
 const hit=new T.Raycaster(new T.Vector3(x,35,z),new T.Vector3(0,-1,0),0,36).intersectObject(group,true)[0];
 assert.ok(hit&&hit.point.y>14.8&&hit.point.y<15.7,'survey316/310 annex interior remains low beneath the bounded high facade');
 assert.equal(hit.object.geometry.userData.role,'front-annex-roof','low surveyed annex retains roof ownership');
}
// Broad roof pitches must descend outward and remain supported by hall eaves.
for(const z of[-40,0,40]){const heights=[-26.8,-.78,25.2].map(x=>new T.Raycaster(new T.Vector3(x,35,z),new T.Vector3(0,-1,0),0,36).intersectObject(group,true)[0]?.point.y);assert.ok(heights.every(x=>x!==undefined));assert.ok(heights[1]!>heights[0]!+9&&heights[1]!>heights[2]!+9);assert.ok(heights[0]!>17.4&&heights[2]!>17.4);}
// Match source BAG world vertices through the actual renderer matrix order.
// Comparing only source-to-local arithmetic missed the former double yaw.
const ring=source.building.geometry.coordinates[0];
function runtimeMatrix(northOffsetDegrees:number){
 const placement=placementFor({...spec,surveyed:{...spec.surveyed,northOffsetDegrees}} as SignatureModelSpec,{min:bounds.min.toArray(),max:bounds.max.toArray()});
 return new T.Matrix4().makeScale(1,-1,1)
  .multiply(new T.Matrix4().makeRotationZ((90-placement.modelRotationDegrees)*Math.PI/180))
  .multiply(new T.Matrix4().makeRotationX(Math.PI/2));
}
const runtime=runtimeMatrix(spec.surveyed.northOffsetDegrees),former=runtimeMatrix(source.surveyTransform.rotationDegrees);
const mercatorAnchor=maplibregl.MercatorCoordinate.fromLngLat({lng:source.anchor[0],lat:source.anchor[1]}),mercatorUnits=mercatorAnchor.meterInMercatorCoordinateUnits();
function mercatorFit(lng:number,lat:number,actual:T.Vector3){
 const bag=maplibregl.MercatorCoordinate.fromLngLat({lng,lat});
 return {expectedMercator:[bag.x,bag.y],runtimeMercator:[mercatorAnchor.x+actual.x*mercatorUnits,mercatorAnchor.y+actual.y*mercatorUnits],errorMetres:Math.hypot((bag.x-mercatorAnchor.x)/mercatorUnits-actual.x,(bag.y-mercatorAnchor.y)/mercatorUnits-actual.y)};
}
const vertexWorldSamples=ring.map(([lng,lat],i)=>{
 const east=(lng-source.anchor[0])*111320*Math.cos(source.anchor[1]*Math.PI/180),south=-(lat-source.anchor[1])*111320;
 const local=new T.Vector3(source.localFootprint[i][0],0,source.localFootprint[i][1]);
 const actual=local.clone().applyMatrix4(runtime),before=local.clone().applyMatrix4(former);
 const errorMetres=Math.hypot(actual.x-east,actual.y-south),formerErrorMetres=Math.hypot(before.x-east,before.y-south);
 assert.ok(errorMetres<.03,`runtime matrix fits original BAG vertex${i}: ${errorMetres}m`);
 const mercator=mercatorFit(lng,lat,actual);
 // The original metre approximation uses111320m/degree; MapLibre's spherical
 // projection has a slightly different datum. Keep this bounded scale error
 // visible instead of presenting millimetre local rounding as exact map fit.
 assert.ok(mercator.errorMetres<.12,`native MapLibre BAG corner${i} fits within source projection precision`);
 return {index:i,bag:[lng,lat],local:local.toArray(),expectedEastSouth:[east,south],runtimeEastSouth:[actual.x,actual.y],errorMetres,formerErrorMetres,mercator};
});
// Optional exact compressed-export proof: find each original ground vertex in
// decoded mesh space, then map it to independent BAG world coordinates.
const decodedPath=process.argv[2];let decodedVertexWorldSamples:unknown[]|undefined;
if(decodedPath){
 await MeshoptDecoder.ready;
 const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(decodedPath);
 const ground:T.Vector3[]=[];
 for(const node of doc.getRoot().listNodes())for(const primitive of node.getMesh()?.listPrimitives()??[]){
  const p=primitive.getAttribute('POSITION')!,matrix=new T.Matrix4().fromArray(node.getWorldMatrix());
  for(let i=0;i<p.getCount();i++){const v=new T.Vector3(...p.getElement(i,[]) as [number,number,number]).applyMatrix4(matrix);if(Math.abs(v.y)<.03)ground.push(v);}
 }
 assert.ok(ground.length,'decoded native ground vertices exist');
 decodedVertexWorldSamples=vertexWorldSamples.map(sample=>{
  const local=new T.Vector3(...sample.local as [number,number,number]);
  const decoded=ground.reduce((best,v)=>v.distanceTo(local)<best.distanceTo(local)?v:best,ground[0]);
  const localErrorMetres=decoded.distanceTo(local),actual=decoded.clone().applyMatrix4(runtime);
  const errorMetres=Math.hypot(actual.x-sample.expectedEastSouth[0],actual.y-sample.expectedEastSouth[1]);
  assert.ok(localErrorMetres<.03,'decoded exported ground corner preserves source geometry');
  assert.ok(errorMetres<.04,`decoded vertex${sample.index} fits original BAG world: ${errorMetres}m`);
  const mercator=mercatorFit(sample.bag[0],sample.bag[1],actual);
  assert.ok(mercator.errorMetres<.12,'decoded ground corners match native MapLibre projection within source precision');
  return {index:sample.index,decodedLocal:decoded.toArray(),localErrorMetres,runtimeEastSouth:[actual.x,actual.y],errorMetres,mercator};
 });
}
writeFileSync(join(evidenceDirectory,'native-fit-proof.json'),JSON.stringify({status:'runtime-world-BAG-fit-pass-visual-held',rendererMatrix:'scale(1,-1,1) * rotZ(90-placement.modelRotationDegrees) * rotX(pi/2)',northOffsetDegrees:spec.surveyed.northOffsetDegrees,sourceToLocalDegrees:source.surveyTransform.rotationDegrees,formerMaxVertexErrorMetres:Math.max(...vertexWorldSamples.map(s=>s.formerErrorMetres)),maxVertexErrorMetres:Math.max(...vertexWorldSamples.map(s=>s.errorMetres)),vertexWorldSamples,decodedPath:decodedPath??null,decodedVertexWorldSamples,neighborsToRetain:source.neighborsToRetain,suppression:spec.suppressOsmIds,acceptance:'Physical vertex-fit evidence; final gallery/live reference acceptance remains required.'},null,2)+'\n');
console.log(JSON.stringify({status:failures.length?'HELD: immediate facade intersection':'Local geometry exposure verified; contextual facade visibility and gallery/live acceptance HELD',triangles,panes:panes.length,roofs:roofs.length,bounds:[bounds.min.toArray(),bounds.max.toArray()]}));
assert.deepEqual(failures,[],'facade glazing must be first-hit visible, not buried in a parent wall');

assert.deepEqual(sourceCameraFailures.filter(s=>s.hit!=='frame'),[],'photo-visible stair assembly must not be blocked by masonry or neighbors from geo-matched source camera');
