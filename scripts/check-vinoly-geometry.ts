import assert from 'node:assert/strict';
import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import sources from './landmarks/vinoly-footprints.json';
import {buildVinoly} from './landmarks/vinoly-builder';
const path=process.argv[2]??'public/canal-drive/models/vinoly.glb';
await MeshoptDecoder.ready;
const group=new T.Group();let triangles=0;
if(path==='--authored'){
 const add=(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.name=c;group.add(m);triangles+=(g.index?.count??g.getAttribute('position').count)/3};
 const unused=()=>{throw Error('unexpected primitive')};
 buildVinoly(0,0,{add,box:(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a),prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused});
}else{
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(path);
for(const node of doc.getRoot().listNodes()){const native=node.getMesh();if(!native)continue;const matrix=new T.Matrix4().fromArray(node.getWorldMatrix());for(const p of native.listPrimitives()){
 const g=new T.BufferGeometry(),position=p.getAttribute('POSITION')!;g.setAttribute('position',new T.Float32BufferAttribute(Array.from({length:position.getCount()},(_,i)=>position.getElement(i,[])).flat(),3));g.applyMatrix4(matrix);
 const normal=p.getAttribute('NORMAL');if(normal)g.setAttribute('normal',new T.BufferAttribute(normal.getArray()!,3));
 g.setIndex(new T.BufferAttribute(p.getIndices()!.getArray()!,1));triangles+=g.index!.count/3;
 for(const x of position.getArray()!)assert(Number.isFinite(x),'finite decoded positions');
 const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.name=p.getMaterial()!.getName();group.add(mesh);
}}
}
group.updateMatrixWorld(true);assert(triangles<40000,`budget:${triangles}`);
const bounds=new T.Box3().setFromObject(group);assert(Math.abs(bounds.max.y-94.05)<.12,'small supported plant is below95.13NAP maximum');assert(bounds.min.y>=-.03,'ground rebase');assert(bounds.max.x-bounds.min.x<100,'native scale');
const first=(x:number,y:number,z:number,nx:number,nz:number)=>new T.Raycaster(new T.Vector3(x+nx*5,y,z+nz*5),new T.Vector3(-nx,0,-nz),0,10).intersectObjects(group.children)[0];let panes=0,voids=0;
for(const part of sources.parts){if(part.properties.osmId==='w754894011')continue;const ring=part.localRing,tower=part.properties.osmId!=='w754894014',upper=part.properties.osmId==='w754894013',base=upper?62.2:0,top=upper?90.95:tower?62.2:26.19;
 const area=ring.reduce((s,p,i)=>s+p[0]*ring[(i+1)%ring.length][1]-ring[(i+1)%ring.length][0]*p[1],0);
 for(let edge=0;edge<ring.length;edge++){
 if(!tower&&edge===0)continue;const a=ring[edge],q=ring[(edge+1)%ring.length],dx=q[0]-a[0],dz=q[1]-a[1],len=Math.hypot(dx,dz);if(len<8)continue;
 const nx=(area>0?dz:-dz)/len,nz=(area>0?-dx:dx)/len,count=Math.ceil(len/1.36),j=Math.floor(count*.47),t=(j+.5)/count,x=a[0]+dx*t,z=a[1]+dz*t;
 // Actual exported near-pane fractions, offset away from mullion centres.
 for(const k of [Math.floor(count*.15),Math.floor(count*.30),Math.floor(count*.80)]){const f=(k+.5)/count,hit=first(a[0]+dx*f,tower?(upper?base+1.15:(edge===2?30.15:15.15)):2.15,a[1]+dz*f,nx,nz);assert(hit&&hit.object.name==='glass',`exposed lower pane ${part.properties.osmId}/${edge}/${k} -> ${hit?.object.name}`);panes++}
 const flight=sources.staircaseTrace.chains.flatMap(c=>c.segments).find(s=>s.part===part.properties.osmId&&s.edge===edge);
 if(tower&&flight){const f=flight.reverse?1-t:t,margin=Math.min(.45,1.90/len),progress=Math.max(0,Math.min(1,(f-margin)/(1-2*margin))),y=flight.start+(flight.end-flight.start)*progress+1.78;if(y>=top-.15)continue;const hit=first(x,y,z,nx,nz);assert(hit&&hit.distance>6.8&&hit.object.name==='dark',`recess firsthit ${part.properties.osmId}/${edge}: ${hit?.object.name}/${hit?.distance}`);voids++}
 }
}
// Test actual decoded stair-floor support across the ordered flights. These downward
// rays must hit concrete near the intended height, rather than a hidden prism or roof.
let stairSupportRays=0,joinedLandings=0,landingSupportRays=0;
for(const chain of sources.staircaseTrace.chains){
 let previous:{point:T.Vector3,height:number,nx:number,nz:number}|undefined;
 for(const segment of chain.segments){
  assert(segment.end>=segment.start,'ordered flight must never descend');
  const ring=sources.parts.find(p=>p.properties.osmId===segment.part)!.localRing;
  const a=ring[segment.edge],q=ring[(segment.edge+1)%ring.length],dx=q[0]-a[0],dz=q[1]-a[1],len=Math.hypot(dx,dz);
  const area=ring.reduce((sum,p,i)=>sum+p[0]*ring[(i+1)%ring.length][1]-ring[(i+1)%ring.length][0]*p[1],0),nx=(area>0?dz:-dz)/len,nz=(area>0?-dx:dx)/len;
  const start=segment.reverse?q:a,end=segment.reverse?a:q;
  if(previous){assert(previous.point.distanceTo(new T.Vector3(start[0],previous.height,start[1]))<.05,'successive flights share native corner');assert(Math.abs(previous.height-segment.start)<.03,'successive flights share landing elevation');joinedLandings++;
   const corner=new T.Vector3(start[0]-(previous.nx+nx)*.4,segment.start+.5,start[1]-(previous.nz+nz)*.4);
   const landing=new T.Raycaster(corner,new T.Vector3(0,-1,0),0,.9).intersectObjects(group.children)[0];
   assert(landing&&landing.object.name==='concrete'&&Math.abs(landing.point.y-segment.start)<.38,`decoded corner landing ${segment.part}/${segment.edge}: ${landing?.object.name}/${landing?.point.y}`);landingSupportRays++;
  }
  for(const f of [.10,.28,.50,.72,.90]){
   const t=segment.reverse?1-f:f,margin=Math.min(.45,1.90/len),progress=Math.max(0,Math.min(1,(f-margin)/(1-2*margin))),y=segment.start+(segment.end-segment.start)*progress;
   const x=a[0]+dx*t-nx*.95,z=a[1]+dz*t-nz*.95;
   const hit=new T.Raycaster(new T.Vector3(x,y+.5,z),new T.Vector3(0,-1,0),0,.9).intersectObjects(group.children)[0];
   assert(hit&&hit.object.name==='concrete'&&Math.abs(hit.point.y-y)<.38,`decoded stair support ${chain.id}/${segment.part}/${segment.edge}/${f}: ${hit?.object.name}/${hit?.point.y}`);stairSupportRays++;
  }
  previous={point:new T.Vector3(end[0],segment.end,end[1]),height:segment.end,nx,nz};
 }
}
assert(joinedLandings>=8,'podium, middle and upper landings tested');
// Keep the unresolved same-height terrace transit visible in the check result.
const unresolvedTerraceTransit=sources.staircaseTrace.unresolvedTransit.description;
// Exported top normals: decoding/compression must not reverse horizontal roofs.
let roofFaces=0;const topRing=sources.parts.find(p=>p.properties.osmId==='w754894013')!.localRing,plantX=topRing.reduce((s,p)=>s+p[0],0)/4,plantZ=topRing.reduce((s,p)=>s+p[1],0)/4;
for(const m of group.children as T.Mesh[]){if(m.name!=='slate')continue;const p=m.geometry.getAttribute('position'),idx=m.geometry.index!;
for(let i=0;i<idx.count;i+=3){const v=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,idx.getX(i+j)));if(v.every(q=>Math.abs(q.y-90.95)<.03)){const n=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));if(n.y<0&&v.every(q=>Math.abs(q.x-plantX)<8.03&&Math.abs(q.z-plantZ)<4.03))continue;assert(n.y>0,'upward main roof winding');roofFaces++}}}
assert(roofFaces>0);console.log({path,triangles,panes,voids,stairSupportRays,joinedLandings,landingSupportRays,unresolvedTerraceTransit,roofFaces,bounds:[bounds.min.toArray(),bounds.max.toArray()],scope:`${path==='--authored'?'authored':'decoded'} geometry only; gallery/live-game, entrance route/pin/card and neighbors pending`});
