import assert from 'node:assert/strict';
import * as T from 'three';
import {buildConservatorium} from './landmarks/conservatorium-builder';
import source from './landmarks/conservatorium-footprints.json';
import spec from './landmarks/conservatorium-spec.json';
const triangles:{c:string,p:T.Vector3[],primary?:boolean}[]=[];
const add=(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);const f=g.index?g.toNonIndexed():g,p=f.getAttribute('position');for(let i=0;i<p.count;i+=3)triangles.push({c,primary:g.userData.conservatoriumPrimaryRoof===true,p:[0,1,2].map(j=>new T.Vector3(p.getX(i+j),p.getY(i+j),p.getZ(i+j)))});};
const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:string,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
buildConservatorium(68,70,{add,box} as any);
assert.ok(triangles.length<40000,'asset triangle budget');assert.ok(triangles.every(t=>t.p.every(p=>[p.x,p.y,p.z].every(Number.isFinite))),'finite native geometry');
const points=triangles.flatMap(t=>t.p);const bounds=new T.Box3().setFromPoints(points);assert.ok(bounds.max.y<40&&bounds.max.y>37,'thin turret remains a recognisable spire rather than whole body height');assert.ok(bounds.max.x-bounds.min.x<75&&bounds.max.z-bounds.min.z<75,'native surveyed dimensions');
const ray=new T.Ray(),hit=new T.Vector3();
const hits=(origin:T.Vector3,direction:T.Vector3)=>{ray.set(origin,direction);return triangles.flatMap(t=>{const h=ray.intersectTriangle(...t.p as [T.Vector3,T.Vector3,T.Vector3],false,hit);return h?[{c:t.c,d:origin.distanceTo(h),y:h.y}]:[]}).sort((a,b)=>a.d-b.d)};
assert.equal(hits(new T.Vector3(0,40,30),new T.Vector3(0,-1,0)).length,0,'rear court remains open');
const court=hits(new T.Vector3(0,16,0),new T.Vector3(0,-1,0));assert.equal(court.length,0,'glass atrium has no opaque volume beneath its roof');
const front=hits(new T.Vector3(-1.5,7,-40),new T.Vector3(0,0,1));assert.equal(front[0]?.c,'glass','central entrance glass physically exposed first');
const side=hits(new T.Vector3(-50,6.2,-.4),new T.Vector3(1,0,0));assert.equal(side[0]?.c,'glass','Potter street glazing first-hit visible');
const roofTriangles=triangles.filter(t=>t.c==='slate'&&t.p.every(p=>p.y>15)&&t.p.some(p=>Math.abs(p.x+31)>2));const downs=roofTriangles.filter(t=>t.p[1].clone().sub(t.p[0]).cross(t.p[2].clone().sub(t.p[0])).y<-.001);assert.equal(downs.length,0,'roof surfaces face upward; conical turret underside excluded');
// Primary roof support is evaluated against the independent BAG footprints,
// including their courtyard indentation, rather than only normal winding.
const aa=source.authorHeadingDegrees*Math.PI/180,[lng,lat]=source.anchor;
const footprints=source.parents.map(f=>f.geometry.coordinates[0].map(([x,y])=>{const e=(x-lng)*111320*Math.cos(lat*Math.PI/180),n=(y-lat)*110540;return[e*Math.sin(aa)+n*Math.cos(aa),e*Math.cos(aa)-n*Math.sin(aa)]}));
const inside=(x:number,z:number,r:number[][])=>{let result=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;};
const primary=triangles.filter(t=>t.primary);
assert.ok(primary.length>0,'primary roof assemblies observed');
for(const t of primary){const c=t.p.reduce((s,p)=>s.add(p),new T.Vector3()).multiplyScalar(1/3);assert.ok(footprints.some(r=>inside(c.x,c.z,r)),'every primary roof triangle is supported inside an exact BAG parent');assert.ok(t.p.every(p=>p.y<=30.401),'survey equipment/fitted fragments cannot exceed the coherent main roof assemblies');}
const roofHeight=(x:number,z:number)=>hits(new T.Vector3(x,50,z),new T.Vector3(0,-1,0)).find(h=>h.c==='slate')?.y;
for(const [x,z,lo,hi] of [[10,-16.5,27.2,27.4],[-26.1,0,27.2,27.4],[-26.75,18.5,21.4,21.6],[23.45,25,25.8,26.1],[-1.9,-16.5,30.3,30.5]]){const y=roofHeight(x,z);assert.ok(y!==undefined&&y>=lo&&y<=hi,`supported ridge at${x},${z}: ${y}`);}
for(const n of source.retainedNeighbours){assert.equal(n.properties.status,'Pand in gebruik','unrealised BAG outlines cannot be retained built-neighbor evidence');assert.equal(n.runtimeEvidence.present,true);assert.equal(n.runtimeEvidence.hidden,false);assert.equal(n.runtimeEvidence.drawable,true);assert.ok(!spec.suppressOsmIds.includes(n.bagId),'current neighbor never suppressed');}
assert.equal(spec.spatialSuppression,false);assert.equal(spec.suppressOsmIds.length,2,'only two exact confirmed parents');assert.equal(source.parents.length,2,'VBO official parent relation retained');
console.log('Conservatorium',triangles.length,'triangles; native bounds',bounds.min.toArray(),bounds.max.toArray(),'; front/side first-hit glass, roof normals and courts pass.');
