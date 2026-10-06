import assert from 'node:assert/strict';
import * as T from 'three';
import {buildKeithHaringMural,haringLocalPoint} from './landmarks/keith-haring-mural-builder';
import spec from './landmarks/keith-haring-mural-spec.json';
import source from './landmarks/keith-haring-mural-footprints.json';
import type {BuildingTools} from './landmarks/cultural-builders';
const group=new T.Group();let triangles=0;
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,angle=0)=>{
  const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.name=c;mesh.rotation.y=angle;mesh.position.set(x,y,z);group.add(mesh);
  triangles+=(g.index?.count??g.getAttribute('position').count)/3;
};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
buildKeithHaringMural(0,0,{add,box} as BuildingTools);group.updateMatrixWorld(true);
const bounds=new T.Box3().setFromObject(group);
assert(bounds.min.toArray().every(Number.isFinite)&&bounds.max.toArray().every(Number.isFinite));
assert(bounds.max.y<=24.5&&bounds.max.y>=24.3,'Equipment maximum belongs only to lift towers');
assert(triangles<40000);
assert.deepEqual(spec.suppressOsmIds,['NL.IMBAG.Pand.0363100012201630']);
assert(!spec.suppressOsmIds.includes(source.neighborRetentionIds[0]));
const a=haringLocalPoint(...source.ring[0] as [number,number]);
const q=haringLocalPoint(...source.ring[1] as [number,number]);
const t=q.clone().sub(a).normalize(),outward=new T.Vector2(-t.y,t.x),centre=a.clone().lerp(q,.5);
assert(outward.x<-.9,'Mural faces west across the water, not east/Markthal');
const white=group.children.filter(m=>m.name==='white') as T.Mesh[];
const ray=new T.Raycaster();let samples=0;
for(const mesh of white.filter((_,i)=>i%5===0)) {
 const p=mesh.geometry.getAttribute('position');const v=new T.Vector3();for(let j=0;j<3;j++)v.add(new T.Vector3(p.getX(j),p.getY(j),p.getZ(j)));v.multiplyScalar(1/3);
 const origin=v.clone().add(new T.Vector3(outward.x*3,0,outward.y*3));
 ray.set(origin,new T.Vector3(-outward.x,0,-outward.y));
 const hit=ray.intersectObjects(group.children,false)[0];
 assert(hit?.object.name==='white','Main wall must not bury mural ribbons');samples++;
 const normal=mesh.geometry.getAttribute('normal');assert(normal.getX(0)*outward.x+normal.getZ(0)*outward.y>.99,'Paint normals must face outward');
 const along=new T.Vector2(v.x,v.z).sub(centre).dot(t);assert(Math.abs(along)<a.distanceTo(q)/2,'Paint must remain within the15m surveyed wall');
 const dist=new T.Vector2(v.x,v.z).sub(centre).dot(outward);
 assert(Math.abs(dist-.075)<.005,'Mural is mounted on exact surveyed west wall');
}
assert(samples>10);
const nw=haringLocalPoint(...source.ring[39] as [number,number]),ne=haringLocalPoint(...source.ring[38] as [number,number]);
const nt=ne.clone().sub(nw).normalize(),nn=new T.Vector2(nt.y,-nt.x);
assert(nn.y<-.9,'Grey scar must occupy actual north facade');
for(const u of [.25,.5,.75]) {
 const p=nw.clone().lerp(ne,u);
 ray.set(new T.Vector3(p.x+nn.x*3,6,p.y+nn.y*3),new T.Vector3(-nn.x,0,-nn.y));
 assert.equal(ray.intersectObjects(group.children,false)[0]?.object.name,'greyBrick','North grey panel must be the exposed first-hit surface');
}

const vertexCount=white.reduce((n,m)=>n+m.geometry.getAttribute('position').count,0);
console.log(JSON.stringify({triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},muralFirstHitSamples:samples,muralVertices:vertexCount,northPanelFirstHitSamples:3,textures:0}));
