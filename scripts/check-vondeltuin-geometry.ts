import *as T from 'three';import assert from 'node:assert/strict';import{buildVondeltuin}from './landmarks/vondeltuin-builder';import source from './landmarks/vondeltuin-footprints.json';import type{BuildingTools}from './landmarks/cultural-builders';const group=new T.Group();const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.FrontSide}));m.name=c;m.position.set(x,y,z);m.rotation.y=a;group.add(m);};const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);buildVondeltuin(13,16,{add,box}as BuildingTools);group.updateMatrixWorld(true);let tris=0;for(const m of group.children as T.Mesh[]){const p=m.geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));tris+=(m.geometry.index?.count??p.count)/3;}const bounds=new T.Box3().setFromObject(group);assert(bounds.max.y>6.5&&bounds.max.y<7);assert(tris<40000);const ray=(p:T.Vector3,d:T.Vector3)=>new T.Raycaster(p,d,0,40).intersectObjects(group.children);assert.equal(ray(new T.Vector3(0,2,22),new T.Vector3(1,0,0)).length,0,'southern hut space blocked');const hits=ray(new T.Vector3(-2,10,0),new T.Vector3(0,-1,0));assert(hits[0]&&hits[0].point.y>4,'survey roof winding');const [lng0,lat0]=source.anchor;const ring=source.bag.geometry.coordinates[0].slice(0,-1).map(([lng,lat])=>new T.Vector2((lng-lng0)*111320*Math.cos(lat0*Math.PI/180),-(lat-lat0)*110540));const sign=Math.sign(ring.reduce((v,p,i)=>{const q=ring[(i+1)%ring.length];return v+p.x*q.y-q.x*p.y;},0));let glassProbes=0;for(let i=0;i<ring.length;i++){const a=ring[i],q=ring[(i+1)%ring.length],d=q.clone().sub(a),len=d.length();if(len<5)continue;const m=a.clone().lerp(q,.37),n=new T.Vector2(d.y,-d.x).normalize().multiplyScalar(sign),h=ray(new T.Vector3(m.x+n.x*10,1.55,m.y+n.y*10),new T.Vector3(-n.x,0,-n.y));assert(h[0]?.object.name==='glass','perimeter glazing buried/backfacing');glassProbes++;}assert(glassProbes>=3);console.log(JSON.stringify({triangles:tris,glazingFirstHitProbes:glassProbes,checks:['finite native bounds','source roof upward first hit','exposed perimeter glazing','southern hut open'],bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}}));

// Every solar-bank corner must sit over its owning roof within mount clearance.
// This detects a global-axis tilt and panels that extend outside the roof.
const solar=(group.children as T.Mesh[]).find(m=>m.name==='slate');assert(solar,'solar bank missing');
const solarVertices=solar.geometry.getAttribute('position');const roofMeshes=group.children.filter(m=>m!==solar);
let solarSupportProbes=0;for(let i=0;i<solarVertices.count;i++){
 const p=new T.Vector3().fromBufferAttribute(solarVertices,i).applyMatrix4(solar.matrixWorld);
 const hit=new T.Raycaster(p.clone().add(new T.Vector3(0,.02,0)),new T.Vector3(0,-1,0),0,.3).intersectObjects(roofMeshes)[0];
 assert(hit&&hit.object.name==='ochre','solar corner has no close underlying roof');
 assert(p.y-hit.point.y>=-.001&&p.y-hit.point.y<.2,'solar corner buried or tilted away from roof');solarSupportProbes++;
}
console.log(JSON.stringify({solarSupportProbes,check:'all solar corners close to owning roof'}));

// Independent source-selected transition chains: the upper glazed gable
// and its shingle-clad side return must be the first exterior hit above the
// lower roof. Perimeter glazing probes cannot detect these internal gaps.
const roofRings=source.roofPlanes.map(p=>p.rings[0]);
const transitionEdges=[
 {upper:2,a:7,b:8,lower:0,c:2,d:1,material:'glass'},
 {upper:2,a:8,b:0,lower:1,c:4,d:3,material:'glass'},
 {upper:3,a:1,b:2,lower:1,c:3,d:2,material:'glass'},
 {upper:3,a:2,b:3,lower:1,c:2,d:1,material:'ochre'},
 {upper:3,a:3,b:4,lower:1,c:1,d:0,material:'ochre'},
];
let roofStepFirstHitProbes=0;
for(const e of transitionEdges){
 const upper=roofRings[e.upper],a=new T.Vector3(...upper[e.a] as[number,number,number]),q=new T.Vector3(...upper[e.b] as[number,number,number]);
 const c=new T.Vector3(...roofRings[e.lower][e.c] as[number,number,number]),d=new T.Vector3(...roofRings[e.lower][e.d] as[number,number,number]);
 const winding=Math.sign(upper.reduce((sum,p,i)=>{const t=upper[(i+1)%upper.length];return sum+p[0]*t[2]-t[0]*p[2];},0));
 const normal=new T.Vector3(q.z-a.z,0,a.x-q.x).normalize().multiplyScalar(winding);
 for(const fraction of [.25,.5,.75]){
  const p=a.clone().lerp(q,fraction).lerp(c.clone().lerp(d,fraction),.5);
  const hit=new T.Raycaster(p.clone().addScaledVector(normal,.35),normal.clone().negate(),0,.36).intersectObjects(group.children)[0];
  assert(hit&&hit.object.name===e.material,'roof step closure missing, buried or backfacing');
  assert(Math.abs(hit.distance-.35)<.002,'roof step first hit does not meet surveyed transition');roofStepFirstHitProbes++;
 }
}
console.log(JSON.stringify({roofStepFirstHitProbes,check:'closed upper gable and side return first hits above lower roof'}));
