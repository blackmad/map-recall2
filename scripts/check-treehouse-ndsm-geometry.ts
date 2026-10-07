import assert from 'node:assert/strict';
import * as T from 'three';
import {buildTreehouseNdsm} from './landmarks/treehouse-ndsm-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import spec from './landmarks/treehouse-ndsm-spec.json';
import source from './landmarks/treehouse-ndsm-footprints.json';
const geometry:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);geometry.push(g)};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const unused=()=>{throw Error('unexpected primitive')};buildTreehouseNdsm(0,0,{add,box,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused});
let triangles=0;const bounds=new T.Box3();const meshes=geometry.map(g=>{triangles+=(g.index?.count??g.getAttribute('position').count)/3;g.computeBoundingBox();bounds.union(g.boundingBox!);for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));return new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}))});
const ray=(x:number,y:number,z:number,d:T.Vector3)=>new T.Raycaster(new T.Vector3(x,y,z),d).intersectObjects(meshes)[0];
assert(triangles<40000);assert(bounds.max.y<9.8&&bounds.max.y>8.5);assert(bounds.max.x-bounds.min.x<65);assert(bounds.max.z-bounds.min.z<57);
for(const id of['2476','2479','2480']){const part=source.buildings.find(b=>b.id.endsWith(id))!,r=part.outline[0].map(p=>new T.Vector2(p[0],p[1]));const candidates=r.map((a,i)=>{const b=r[(i+1)%r.length],d=b.clone().sub(a),normal=new T.Vector2(-d.y,d.x).normalize();return{a,b,d,normal};}).filter(e=>e.normal.y<-.5&&e.d.length()>6);assert(candidates.length);const e=candidates[0],point=e.a.clone().lerp(e.b,id==='2476'?.42:id==='2479'?.35:.52).addScaledVector(e.normal,4);const h=ray(point.x,4.7,point.y,new T.Vector3(-e.normal.x,0,-e.normal.y));assert(h);assert.equal(h.object.geometry.userData.palette,'glass','photographed north upperstudio windows firsthit');
 const wall=ray(point.x,3.82,point.y,new T.Vector3(-e.normal.x,0,-e.normal.y));assert(wall,'north wall below upper glazing exposed');
 assert.equal(wall.object.geometry.userData.role,'studio-wall','material probe reaches actual wall, not trim or detached detail');
 assert.equal(wall.object.geometry.userData.pandId,part.id,'material belongs to exact photographed cabin');
 assert.equal(wall.object.geometry.userData.palette,id==='2476'?'gold':id==='2479'?'frame':'red','source-calibrated north cabin material');
}
for(const [x,z]of[[0,0],[8,0],[0,4],[0,15],[-35,0],[35,0]])assert.equal(ray(x,20,z,new T.Vector3(0,-1,0)),undefined,'studio alleys/courtyard and neighbors stayopen');
for(const g of geometry.filter(g=>g.userData.role==='roof')){const n=g.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>.7,'pitched roof planes allfaceup');}
assert.equal(spec.spatialSuppression,false);assert.equal(spec.suppressOsmIds.length,32);assert(!spec.suppressOsmIds.includes('NL.IMBAG.Pand.0363100012241285'),'neighborPllekretained');
console.log(JSON.stringify({id:spec.id,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},status:'CPU passes; gallery/live visual acceptance pending'}));
