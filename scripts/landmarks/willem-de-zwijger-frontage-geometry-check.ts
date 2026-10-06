import assert from 'node:assert/strict';
import * as T from 'three';
import {buildWillemDeZwijgerFrontage} from './willem-de-zwijger-frontage-builder';
import {frontageSignGeometry,frontageRingSector} from './willem-de-zwijger-frontage-signs';
import type {BuildingTools} from './cultural-builders';
import data from './willem-de-zwijger-frontage-footprints.json';

const geometries:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);geometries.push(g);};
const unused=()=>{throw Error('Unexpected generic primitive');};
buildWillemDeZwijgerFrontage(0,0,{add,box:unused,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused});
const bounds=new T.Box3();let triangles=0;
const meshes=geometries.map(g=>{
  triangles+=(g.index?.count??g.getAttribute('position').count)/3;
  for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));
  g.computeBoundingBox();bounds.union(g.boundingBox!);
  const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.userData=g.userData;return m;
});
const axes=data.nativeAxes;
function position(x:number,y:number,z:number){return new T.Vector3(x*axes.xEast+z*axes.zEast,y,x*axes.xSouth+z*axes.zSouth);}
function ray(y:number,z:number){return new T.Raycaster(position(-28,y,z),position(1,0,0).normalize()).intersectObjects(meshes)[0];}
assert(triangles<40000);assert(bounds.min.y>=-.001);assert(bounds.max.y>26&&bounds.max.y<28);
// Fractional tests target actual exposed glass, avoiding the explicit frame.
for(const z of[6,18,41])for(const t of[.15,.35,.65,.85])
  assert.equal(ray(1.5,z-.595+1.19*t)?.object.userData.palette,'glass','masonry doors exposed across their actual leaf');
for(const z of[30,52])for(const y of[3.5,4.9,6.8])for(const t of[.15,.35,.65,.85])
  assert.equal(ray(y,z-.595+1.19*t)?.object.userData.palette,'glass','tall glazed aperture not buried by corrugation');
const wingStart=70.3755,pitch=(169.7433-wingStart)/19;
for(const bay of[1,3,6,15])for(const y of[5.0,6.5])for(const t of[.13,.27,.40,.60,.73,.87])
  assert.equal(ray(y,wingStart+bay*pitch+.27+(pitch-.54)*t)?.object.userData.palette,'glass','lower-wing flat/recessed glazing must survive first hit across the actual face');
for(const z of[62,67])assert.equal(ray(2.5,z)?.object.userData.palette,'dark','source industrial garage leaves stay opaque');
for(const [x,z]of[[-27,25],[26,110],[0,-5],[0,229]])
  assert.equal(new T.Raycaster(position(x,40,z),new T.Vector3(0,-1,0)).intersectObjects(meshes)[0],undefined,'outside host stays open');
// A source-supported flat logo must have paint-like thickness, not raised hoops.
const sector=frontageRingSector(1.8,2.5,0,Math.PI);sector.computeBoundingBox();
assert.equal(sector.boundingBox!.max.z-sector.boundingBox!.min.z,0);
const lettering=frontageSignGeometry('BEEST BOULDERS',.55,8.5);lettering.computeBoundingBox();
assert(lettering.boundingBox!.max.x-lettering.boundingBox!.min.x<=8.501);
assert(lettering.boundingBox!.max.y-lettering.boundingBox!.min.y<=.551);
assert.equal(lettering.boundingBox!.min.z,lettering.boundingBox!.max.z);
assert(meshes.some(m=>m.userData.role==='source-supported-vector-sign'));
console.log(JSON.stringify({triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},status:'CPU geometry passes; current-sign placement and gallery/live acceptance pending'}));
