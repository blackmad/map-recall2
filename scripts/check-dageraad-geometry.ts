import assert from 'node:assert/strict';
import * as T from 'three';
import { buildDageraad } from './landmarks/dageraad-builder';
import data from './landmarks/dageraad-footprints.json';
import spec from './landmarks/dageraad-spec.json';
const root=new T.Group();let triangles=0;
const add=(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0)=>{
 const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.name=c;m.position.set(x,y,z);m.rotation.y=a;root.add(m);triangles+=(g.index?.count??g.getAttribute('position').count)/3;
 if(c==='slate'){const n=g.getAttribute('normal');for(let i=0;i<n.count;i++)assert.ok(n.getY(i)>.98||n.getX(i)**2+n.getY(i)**2+n.getZ(i)**2<1e-9,'explicit nondegenerate roof faces upward');}
};
const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:string,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
buildDageraad('dageraad',1,1,{add,box} as any);root.updateMatrixWorld(true);
const bounds=new T.Box3().setFromObject(root);assert.ok(bounds.max.y>21.7&&bounds.max.y<22,'only narrow crown reaches above21.34m tower');
assert.ok(bounds.getSize(new T.Vector3()).x<17&&bounds.getSize(new T.Vector3()).z<17,'native small corner parent, not entire estate');
assert.ok(triangles<40000);assert.equal(spec.suppressOsmIds.length,1);assert.equal(spec.suppressOsmIds[0],data.parent.properties.rdf_seealso.replace('http://bag.basisregistraties.overheid.nl/bag/id/pand/','NL.IMBAG.Pand.'));
const tx=.678,tz=.735,nx=.735,nz=-.678,cx=4.558,cz=-2.474;
const ring=data.ring.map(p=>[(p[0]-cx)*tx+(p[1]-cz)*tz,(p[0]-cx)*nx+(p[1]-cz)*nz]);
function front(u:number){const hits:number[]=[];for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length];if(Math.abs(p[0]-q[0])>1e-6&&u>=Math.min(p[0],q[0])&&u<=Math.max(p[0],q[0]))hits.push(p[1]+(q[1]-p[1])*(u-p[0])/(q[0]-p[0]));}return Math.max(...hits);}
for(const side of [-1,1])for(const y of [5.38,8.72,12.45]){
 const u=side*2.50+.13,v=front(side*2.50)+3,origin=new T.Vector3(cx+u*tx+v*nx,y+.37,cz+u*tz+v*nz);
 const hits=new T.Raycaster(origin,new T.Vector3(-nx,0,-nz)).intersectObject(root,true);assert.equal(hits[0]?.object.name,'glass','actual first-hit narrow window is exposed');
}
// These exposed caps and depth retreats failed with the former enclosing17.56m main prism.
for(const [u,v,expected] of [[2.0,.90,8.35],[2.2,.50,12.02],[2.5,.35,15.03]])for(const side of [-1,1]){
 const point=new T.Vector3(cx+side*u*tx+v*nx,30,cz+side*u*tz+v*nz);
 const hits=new T.Raycaster(point,new T.Vector3(0,-1,0)).intersectObject(root,true);
 assert.ok(hits.length&&Math.abs(hits[0].point.y-expected)<.15,`rounded tier top${expected}m must be exposed from above`);
}
for(const side of [-1,1]){
 const u=side*2.50,v=3;const levels=[7,11.5,14.5].map(y=>{
  const origin=new T.Vector3(cx+u*tx+v*nx,y,cz+u*tz+v*nz);
  const hit=new T.Raycaster(origin,new T.Vector3(-nx,0,-nz)).intersectObject(root,true)[0];
  assert.equal(hit?.object.name,'ochre','round itself owns the first facade hit');
  return (hit.point.x-cx)*nx+(hit.point.z-cz)*nz;
 });
 assert.ok(levels[0]-levels[1]>.14&&levels[1]-levels[2]>.14,'stacked cylindrical facade visibly recedes twice');
}
for(const p of [[17,0],[0,-17],[-13,-10]])assert.equal(new T.Raycaster(new T.Vector3(p[0],30,p[1]),new T.Vector3(0,-1,0)).intersectObject(root,true).length,0,'adjacent streets/court beyond exact parent remain open');
console.log(`Dageraad geometry passed: ${triangles} triangles; native corner bounds, exposed rod windows and rounded tier caps/depth retreats, upward roofs, open surroundings, exact parent only.`);
