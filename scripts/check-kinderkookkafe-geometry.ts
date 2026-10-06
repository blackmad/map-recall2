import * as T from 'three';
import assert from 'node:assert/strict';
import {buildKinderkookkafe} from './landmarks/kinderkookkafe-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import source from './landmarks/kinderkookkafe-footprints.json';
const group=new T.Group();
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,angle=0)=>{const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.FrontSide}));m.name=c;m.position.set(x,y,z);m.rotation.y=angle;group.add(m);};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
buildKinderkookkafe(23,27,{add,box} as BuildingTools);group.updateMatrixWorld(true);
let triangles=0;for(const m of group.children as T.Mesh[]){const p=m.geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));triangles+=(m.geometry.index?.count??p.count)/3;}
assert(triangles<40000);const bounds=new T.Box3().setFromObject(group);assert(bounds.max.y>7&&bounds.max.y<9);assert(bounds.max.x-bounds.min.x<25);assert(bounds.max.z-bounds.min.z<29);
const ray=(p:T.Vector3,d:T.Vector3)=>new T.Raycaster(p,d,0,60).intersectObjects(group.children);
let roofs=0,glazing=0;for(const part of source.parts){for(const roof of part.roofs){const r=roof.rings[0],centre=r.reduce((p,q)=>p.add(new T.Vector3(...q as [number,number,number])),new T.Vector3()).multiplyScalar(1/r.length);const hit=ray(new T.Vector3(centre.x,20,centre.z),new T.Vector3(0,-1,0))[0];assert(hit,'roof missing/downward');assert(hit.point.y>2,'wall cap shadows roof');roofs++;}}
const part=source.parts[0],ring=part.ring.map(p=>new T.Vector2(...p as [number,number])),sign=Math.sign(ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p.x*q.y-q.x*p.y},0));
// Fractional probes cross the actual conservatory long glazed face, away from deliberate posts.
const a=ring[3],q=ring[4],d=q.clone().sub(a),n=new T.Vector2(d.y,-d.x).normalize().multiplyScalar(sign);
for(const fraction of [.13,.37,.63,.87])for(const y of [.7,1.5]){const p=a.clone().lerp(q,fraction),hit=ray(new T.Vector3(p.x+n.x*4,y,p.y+n.y*4),new T.Vector3(-n.x,0,-n.y))[0];assert.equal(hit?.object.name,'glass','conservatory glazing buried');glazing++;}
// Check the photographed eastern approach against actual rendered door surfaces.
// Northern cafe stays north; the opposite western ends must retain plain masonry.
for(const [partIndex,start,end,material]of [[0,9,1,'glass'],[1,3,0,'green']]as const){
 const points=source.parts[partIndex].ring,a=new T.Vector2(...points[start] as [number,number]),q=new T.Vector2(...points[end] as [number,number]);
 const direction=q.clone().sub(a),normal=new T.Vector2(-direction.y,direction.x).normalize(),middle=a.clone().lerp(q,.5);
 for(const y of [.8,1.8]){
  const hit=ray(new T.Vector3(middle.x+normal.x*4,y,middle.y+normal.y*4),new T.Vector3(-normal.x,0,-normal.y))[0];
  assert.equal(hit?.object.name,material,'source-facing entrance is buried or on the wrong gable');
 }
}
assert.equal(ray(new T.Vector3(-18,1,16),new T.Vector3(0,1,0)).length,0,'unmodeled forecourt filled');
console.log(JSON.stringify({triangles,bounds:{min:bounds.min,max:bounds.max},roofs,glazing,status:'native geometry pass; gallery/live pending'}));
