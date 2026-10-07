import assert from 'node:assert/strict';
import * as T from 'three';
import {buildMonkAmsterdam} from './landmarks/monk-amsterdam-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import data from './landmarks/monk-amsterdam-footprints.json';
import spec from './landmarks/monk-amsterdam-spec.json';
const geometry:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);geometry.push(g)};
const unused=()=>{throw Error('unexpected primitive')};buildMonkAmsterdam(0,0,{add,box:unused,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused});
let triangles=0;const bounds=new T.Box3();const meshes=geometry.map(g=>{triangles+=(g.index?.count??g.getAttribute('position').count)/3;g.computeBoundingBox();bounds.union(g.boundingBox!);for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));return new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}))});
const hit=(x:number,y:number,z:number,d:T.Vector3)=>new T.Raycaster(new T.Vector3(x,y,z),d).intersectObjects(meshes)[0];
// Rays include the complete shared mass: panes must be in front of survey walls.
function facadeHit(ia:number,ib:number,dist:number,height:number){const a=new T.Vector2(...data.outline[0][ia] as [number,number]),b=new T.Vector2(...data.outline[0][ib] as [number,number]),t=b.sub(a).normalize(),n=new T.Vector2(-t.y,t.x),p=a.addScaledVector(t,dist).addScaledVector(n,10);return hit(p.x,height,p.y,new T.Vector3(-n.x,0,-n.y));}
for(const [ia,ib,bay]of[[19,20,2.5],[19,20,19.5],[19,20,31.5],[12,13,7.5],[12,13,17.5]]){const a=data.outline[0][ia],b=data.outline[0][ib],len=Math.hypot(b[0]-a[0],b[1]-a[1]);assert.equal(facadeHit(ia,ib,bay*len/Math.ceil(len/2.1),6.3)?.object.geometry.userData.palette,'glass','upper ribbon exposed before actual host walls');}
for(const d of[29.9,31.1])assert.equal(facadeHit(19,20,d,1.6)?.object.geometry.userData.palette,'glass','Monk double doorway exposed');
assert.equal(facadeHit(19,20,26,1.5)?.object.geometry.userData.palette,'frame','short roller shutter distinct from door');
// Newly observed flush rooflights must win first-hit rays over the complete body.
for(const light of data.currentRooflights.strips){const x=(light.a[0]+light.b[0])/2,z=(light.a[1]+light.b[1])/2,first=hit(x,30,z,new T.Vector3(0,-1,0));assert.equal(first?.object.geometry.userData.sourceLightId,light.id,'aerial-derived rooflight exposed on actual source roof');}
assert.equal(facadeHit(19,20,20,5.8)?.object.geometry.userData.palette,'dark','loading portal has raised opaque sill');
assert.equal(facadeHit(19,20,20,6.5)?.object.geometry.userData.palette,'glass','glazing above raised loading portal sill remains visible');
// Roof/wall source vertices share exact native coordinates after the seam repair.
const wallVertices=data.surveyWalls.flatMap(w=>w.rings.flat());let maxSourceSeam=0;
for(const roof of data.roofs)for(const p of roof.rings[0]){const nearest=Math.min(...wallVertices.map(q=>Math.hypot(q[0]-p[0],q[1]-p[1],q[2]-p[2])));maxSourceSeam=Math.max(maxSourceSeam,nearest);assert(nearest<.002,'roof boundary must match surveyed wall edges in one coordinate convention');}
// Quay, north entry forecourt and retained exterior lanes stay clear.
for(const [x,z]of[[-95,0],[85,55],[-35,-78],[10,-85]])assert.equal(hit(x,30,z,new T.Vector3(0,-1,0)),undefined,'exterior lane must remain open');
const roofMeshes=meshes.filter(m=>m.geometry.userData.assembly==='survey-roof');assert.equal(roofMeshes.length,data.roofs.length);
for(const mesh of roofMeshes){const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,p=g.getAttribute('position');for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2);assert(b.sub(a).cross(c.sub(a)).y>=-1e-5,'roof faces upward');}}
// Source-backed central high strip is real, not collapsed to generic hall height.
const strip=hit(0,30,23,new T.Vector3(0,-1,0));assert(strip&&strip.point.y>14.5&&strip.point.y<14.8,'photographed high strip roof retained');
assert.deepEqual(spec.suppressOsmIds,['w280838840','NL.IMBAG.Pand.0363100012136881']);assert.equal(spec.spatialSuppression,false);assert(triangles<40000);assert(bounds.max.y<15&&bounds.max.y>14.5);
console.log(JSON.stringify({id:spec.id,triangles,roofPatches:roofMeshes.length,currentRooflights:data.currentRooflights.strips.length,maxSourceSeam,surveyWalls:data.surveyWalls.length,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},status:'Fullhost geometry pass; gallery/live recognition and neighbor retention pending'}));
