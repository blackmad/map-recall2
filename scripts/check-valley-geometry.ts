import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {buildValley} from './landmarks/valley-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import source from './landmarks/valley-footprints.json';
const meshes:T.Mesh[]=[];const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);g.computeBoundingBox();const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.userData.colour=c;meshes.push(m)};const no=()=>{throw Error('unexpected primitive')};buildValley(0,0,{add,box:(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a),prism:no,gableRoof:no,hip:no,window:no,clock:no,sign:no});
const bounds=new T.Box3();for(const m of meshes){bounds.union(m.geometry.boundingBox!);const p=m.geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite));}
assert(bounds.max.y>=100&&bounds.max.y<102);assert(bounds.max.x-bounds.min.x>50&&bounds.max.x-bounds.min.x<58);assert(bounds.max.z-bounds.min.z>138&&bounds.max.z-bounds.min.z<143);
// First-hit glazing, sampled across the actual window face at multiple
// fractions; near ranges distinguish facade attachment from city occlusion.
const paneFailures:unknown[]=[];let paneSamples=0;for(const m of meshes.filter(m=>m.userData.colour==='glass'&&m.geometry.userData.facade)) {
 const p=m.geometry.getAttribute('position'),n=new T.Vector3(...m.geometry.userData.outward as [number,number,number]);const bb=m.geometry.boundingBox!,centre=bb.getCenter(new T.Vector3());const tangent=new T.Vector3(n.z,0,-n.x);const w=Math.max(...Array.from({length:p.count},(_,i)=>new T.Vector3(p.getX(i),p.getY(i),p.getZ(i)).sub(centre).dot(tangent)))*2;
 for(const f of [.17,.35,.65,.83])for(const yf of [.32,.68]) {
  const target=centre.clone().addScaledVector(tangent,(f-.5)*w);target.y=bb.min.y+(bb.max.y-bb.min.y)*yf;
  const ray=new T.Raycaster(target.clone().addScaledVector(n,.34),n.clone().negate(),0,.38);
  const candidates=meshes.filter(q=>q.geometry.boundingBox!.clone().expandByScalar(.4).containsPoint(target));const hit=ray.intersectObjects(candidates)[0];
  if(!(hit&&(hit.object===m||['frame','bronze'].includes(hit.object.userData.colour))))paneFailures.push({target:target.toArray(),role:m.geometry.userData.role,hit:hit?.object.userData.colour,hitRole:(hit?.object as T.Mesh)?.geometry.userData.role});paneSamples++;
 }
}
if(paneFailures.length){console.log(paneFailures.slice(0,15));throw Error(`${paneFailures.length} blocked pane fractions`);}

// Assembly checks reach from the outer facade opening to actual recessed
// broad glazing, and see supported projecting slabs from beneath.
const recessed=meshes.filter(m=>m.geometry.userData.role==='recess');const cantilevers=meshes.filter(m=>m.geometry.userData.role==='cantilever-slab');assert(recessed.length>12,'Insufficient deep source-observed balcony groups');assert(cantilevers.length>6,'Missing substantial projecting stone slab groups');
let cavitySamples=0;for(const m of recessed){const n=new T.Vector3(...m.geometry.userData.outward as [number,number,number]),bb=m.geometry.boundingBox!,target=bb.getCenter(new T.Vector3());target.y=bb.min.y+(bb.max.y-bb.min.y)*.72;const ray=new T.Raycaster(target.clone().addScaledVector(n,m.geometry.userData.recessDepth+.45),n.clone().negate(),0,m.geometry.userData.recessDepth+.5),hit=ray.intersectObjects(meshes)[0];assert(hit&&(hit.object===m||hit.object.userData.colour==='bronze'),`Recess not actually open: ${target.toArray()} hit ${hit?.object.userData.colour}`);cavitySamples++;}
let undercutSamples=0;for(const m of cantilevers){const bb=m.geometry.boundingBox!,target=bb.getCenter(new T.Vector3()),n=new T.Vector3(...m.geometry.userData.outward as [number,number,number]);target.addScaledVector(n,m.geometry.userData.projectionDepth*.28);const ray=new T.Raycaster(new T.Vector3(target.x,bb.min.y-.40,target.z),new T.Vector3(0,1,0),0,.45);const hit=ray.intersectObjects(meshes)[0];assert(hit?.object===m,`Cantilever underside buried by ${hit?.object.userData.colour} at ${target.toArray()}`);undercutSamples++;}
const treads=meshes.filter(m=>m.geometry.userData.role==='public-stair-tread');assert(treads.length===120);let walkSamples=0;for(const m of treads){const bb=m.geometry.boundingBox!,p=bb.getCenter(new T.Vector3());const hit=new T.Raycaster(new T.Vector3(p.x,27,p.z),new T.Vector3(0,-1,0)).intersectObjects(meshes)[0];assert(hit&&['public-stair-tread','public-stair-landing'].includes((hit.object as T.Mesh).geometry.userData.role),`Public stair buried at ${p.toArray()}, top=${hit?.point.y}`);assert(Math.abs(hit.point.y-m.geometry.userData.walkTop)<.025,`Public landing buries tread at ${p.toArray()}: top ${hit.point.y}, expected ${m.geometry.userData.walkTop}`);walkSamples++;}const landscape=meshes.filter(m=>m.geometry.userData.role==='public-planted-parapet');assert(landscape.reduce((sum,m)=>{const size=m.geometry.boundingBox!.getSize(new T.Vector3());return sum+size.x*size.y*size.z},0)>35,'Insufficient substantial planted parapet beds');
// Vertical tread-support rays miss glass barriers at body height. Independently
// exercise longitudinal and transverse passage, including tread seams and
// landing turns, across the source-recorded pedestrian width. Only use actual
// geometry intersections; decoded meshes need no authored semantic metadata.
function pedestrianClearance(objects:T.Mesh[],label:string){
 const failures:unknown[]=[];let samples=0;
 for(const m of objects)if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();
 function passage(a:T.Vector3,q:T.Vector3,station:string){
  const delta=q.clone().sub(a),length=delta.length(),box=new T.Box3().setFromPoints([a,q]).expandByScalar(.005);
  const candidates=objects.filter(m=>m.geometry.boundingBox!.intersectsBox(box));
  const hit=new T.Raycaster(a,delta.normalize(),.002,length-.002).intersectObjects(candidates)[0];
  if(hit)failures.push({station,from:a.toArray(),to:q.toArray(),hit:hit.point.toArray(),role:(hit.object as T.Mesh).geometry.userData.role});samples++;
 }
 const width=source.publicApproach.width,steps=source.publicApproach.treadsPerFlight;
 for(const [i,m]of treads.entries()){
  const f=Math.floor(i/steps),a=source.publicApproach.path[f],q=source.publicApproach.path[f+1],dx=q[0]-a[0],dz=q[1]-a[1],run=Math.hypot(dx,dz),tx=dx/run,tz=dz/run;
  const centre=m.geometry.boundingBox!.getCenter(new T.Vector3()),top=m.geometry.boundingBox!.max.y,pos=m.geometry.getAttribute('position');
  const halfRun=Math.max(...Array.from({length:pos.count},(_,j)=>(pos.getX(j)-centre.x)*tx+(pos.getZ(j)-centre.z)*tz));
  for(const h of [.35,.75,1.2,1.8]){
   centre.y=top+h;
   for(const w of [-.4,-.2,0,.2,.4]){
    const c=centre.clone().add(new T.Vector3(-tz*width*w,0,tx*width*w)),v=new T.Vector3(tx,0,tz).multiplyScalar(halfRun*.97);
    passage(c.clone().sub(v),c.clone().add(v),`flight${f}/tread${i%steps}/height${h}/width${w}`);
   }
   for(const dt of [-.65,0,.65]){
    const c=centre.clone().add(new T.Vector3(tx*halfRun*dt,0,tz*halfRun*dt)),v=new T.Vector3(-tz,0,tx).multiplyScalar(width*.46);
    passage(c.clone().sub(v),c.clone().add(v),`flight${f}/tread${i%steps}/height${h}/across${dt}`);
   }
  }
 }
 // Traverse actual junctions at body height: final tread to turn centre,
 // turn centre to next flight, and across the street entry cap.
 for(let f=0;f<source.publicApproach.path.length-1;f++){
  const a=source.publicApproach.path[f],q=source.publicApproach.path[f+1],run=Math.hypot(q[0]-a[0],q[1]-a[1]),tx=(q[0]-a[0])/run,tz=(q[1]-a[1])/run;
  const first=treads[f*steps].geometry.boundingBox!.getCenter(new T.Vector3()),last=treads[(f+1)*steps-1].geometry.boundingBox!.getCenter(new T.Vector3());
  for(const h of [.35,.75,1.2,1.8])for(const w of [-.4,-.2,0,.2,.4]){
   const off=new T.Vector3(-tz*width*w,0,tx*width*w),end=new T.Vector3(q[0],q[2]+h,q[1]).add(off),from=last.clone().add(off);from.y=end.y;
   passage(from,end,`junction${f}/incoming/height${h}/width${w}`);
   const start=new T.Vector3(a[0],treads[f*steps].geometry.boundingBox!.max.y+h,a[1]).add(off),to=first.clone().add(off);to.y=start.y;
   if(f===0)start.add(new T.Vector3(-tx*.15,0,-tz*.15));
   passage(start,to,`junction${f}/outgoing/height${h}/width${w}`);
  }
 }
 // Derive true landing chords from the built top triangles; do not assume
 // rectangular platforms or lift a ray above an obstruction to make it pass.
 for(const [i,m]of meshes.filter(m=>m.geometry.userData.role==='public-stair-landing'&&m.geometry.boundingBox!.min.y>0).entries()){
  const pos=m.geometry.getAttribute('position'),top=m.geometry.boundingBox!.max.y;
  const points=Array.from({length:pos.count},(_,j)=>[pos.getX(j),pos.getZ(j)]),unique=points.filter((p,j)=>points.findIndex(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<.001)===j);
  const centre=unique.reduce((c,p)=>[c[0]+p[0]/unique.length,c[1]+p[1]/unique.length],[0,0]);
  const polygon=unique.sort((a,q)=>Math.atan2(a[1]-centre[1],a[0]-centre[0])-Math.atan2(q[1]-centre[1],q[0]-centre[0]));
  for(const axis of [0,1])for(const fraction of [.20,.35,.5,.65,.8]){
   const across=1-axis,values=polygon.map(p=>p[across]),v=Math.min(...values)+(Math.max(...values)-Math.min(...values))*fraction,hits:number[]=[];
   for(let j=0;j<polygon.length;j++){const p=polygon[j],q=polygon[(j+1)%polygon.length];if((p[across]<=v&&q[across]>v)||(q[across]<=v&&p[across]>v))hits.push(p[axis]+(q[axis]-p[axis])*(v-p[across])/(q[across]-p[across]));}
   assert(hits.length===2,'Landing chord absent');hits.sort((a,q)=>a-q);
   for(const h of [.35,.75,1.2,1.8]){
    const a=new T.Vector3(axis?v:hits[0]+.02,top+h,axis?hits[0]+.02:v),q=new T.Vector3(axis?v:hits[1]-.02,top+h,axis?hits[1]-.02:v);
    passage(a,q,`landing${i}/height${h}/axis${axis}/fraction${fraction}`);
   }
  }
 }
 console.log(JSON.stringify({pedestrianClearance:{label,samples,failures:failures.length,firstFailures:failures.slice(0,4),roles:failures.reduce((counts:any,f:any)=>{const role=f.role??'unmarked';counts[role]=(counts[role]??0)+1;return counts;},{})}},null,2));
 assert.equal(failures.length,0,`${label}: horizontal pedestrian corridor obstructed`);return samples;
}
function treadWidthSupport(objects:T.Mesh[],label:string){
 let samples=0;for(const [i,m]of treads.entries()){
  const f=Math.floor(i/source.publicApproach.treadsPerFlight),a=source.publicApproach.path[f],q=source.publicApproach.path[f+1],run=Math.hypot(q[0]-a[0],q[1]-a[1]),tx=(q[0]-a[0])/run,tz=(q[1]-a[1])/run,c=m.geometry.boundingBox!.getCenter(new T.Vector3());
  for(const fraction of [-.4,-.2,0,.2,.4]){
   const x=c.x-tz*source.publicApproach.width*fraction,z=c.z+tx*source.publicApproach.width*fraction;
   const hit=new T.Raycaster(new T.Vector3(x,27,z),new T.Vector3(0,-1,0)).intersectObjects(objects)[0];
   assert(hit&&Math.abs(hit.point.y-m.geometry.userData.walkTop)<.025,`${label}: tread ${i} width${fraction} buried/missing at ${x},${z}, top=${hit?.point.y}`);samples++;
  }
 }
 return samples;
}
const treadWidthSamples=treadWidthSupport(meshes,'authored');
const pedestrianSamples=pedestrianClearance(meshes,'authored');
// Missing source-visible lights must fail too. These probes are selected
// from actual survey-contour faces, independently of which panes were built.
// The prior model excluded all stone facets shorter than4.5m, creating the
// visibly blank multi-floor shafts. Sample source-face fractions at the
// inhabited mid-height, retaining source-group totals and the short-facet
// cohort. Stone at individual fractions is expected between real windows.
const sourceCoverage:Record<string,{faces:number,samples:number,open:number,shortFaces:number,shortSamples:number,shortOpen:number}>= {};
const boundary=source.localFootprint[0][0];
const distance=(p:number[],a:number[],q:number[])=>{const dx=q[0]-a[0],dz=q[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz);};
// Source inventory starts at the inhabited valley level. External curtain
// wall edges and sub1.55m contour remnants are outside this bounded cohort.
for(const [layer,l]of source.layers.entries())for(const polygon of l.polygons)for(const [ri,r]of polygon.entries())for(let i=0;i<r.length;i++){
 const a=r[i],q=r[(i+1)%r.length],dx=q[0]-a[0],dz=q[1]-a[1],len=Math.hypot(dx,dz),mx=(a[0]+q[0])/2,mz=(a[1]+q[1])/2;
 if(layer<5||len<1.55||Math.min(...boundary.map((a,i)=>distance([mx,mz],a,boundary[(i+1)%boundary.length])))<1.05)continue;
 const area=r.reduce((sum,p,j)=>{const q=r[(j+1)%r.length];return sum+p[0]*q[1]-q[0]*p[1];},0),sign=(area>0?1:-1)*(ri>0?-1:1);
 const face={a,q,len,sourceGroup:mz < -25 ? 'north-rocky' : mz > 23 ? 'south-rocky' : 'middle-rocky',outward:[sign*dz/len,0,-sign*dx/len]};
 const n=new T.Vector3(...face.outward as [number,number,number]);
 const stats=sourceCoverage[face.sourceGroup]??={faces:0,samples:0,open:0,shortFaces:0,shortSamples:0,shortOpen:0};stats.faces++;
 const short=face.len<4.5;if(short)stats.shortFaces++;
 for(const f of [.20,.35,.5,.65,.80]){
  const target=new T.Vector3(face.a[0]+(face.q[0]-face.a[0])*f,l.base+(l.top-l.base)*.55,face.a[1]+(face.q[1]-face.a[1])*f);
  const origin=target.clone().addScaledVector(n,2.8),end=target.clone().addScaledVector(n,-1.7);
  const rayBox=new T.Box3().setFromPoints([origin,end]).expandByScalar(.02);
  const candidates=meshes.filter(q=>q.geometry.boundingBox!.intersectsBox(rayBox));
  const hit=new T.Raycaster(origin,n.clone().negate(),0,4.5).intersectObjects(candidates)[0];
  const opening=!!hit&&['glass','bronze','frame'].includes(hit.object.userData.colour);
  stats.samples++;stats.open+=Number(opening);if(short){stats.shortSamples++;stats.shortOpen+=Number(opening);}
 }
}
console.log({sourceCoverage});
for(const [group,c]of Object.entries(sourceCoverage)){
 assert(c.faces>30&&c.shortFaces>15,`Missing observed ${group} coverage cohort`);
 assert(c.open/c.samples>.55,`${group} frontage reads predominantly blank: ${c.open}/${c.samples}`);
 assert(c.shortOpen/c.shortSamples>.50,`${group} formerly excluded corner faces remain blank: ${c.shortOpen}/${c.shortSamples}`);
}
const authoredTriangles=meshes.reduce((s,m)=>s+(m.geometry.index?.count??m.geometry.getAttribute('position').count)/3,0);assert(authoredTriangles<40000);console.log({authoredTriangles,paneSamples,cavitySamples,undercutSamples,walkSamples,treadWidthSamples,pedestrianSamples,sourceCoverage,scope:'source-backed repair geometry; exported mesh and visual acceptance pending'});
if(process.argv.includes('--draft'))process.exit(0);

// Independent street-valley probe in the space north of the middle tower;
// the podium has a planted public roof, not a full-height opaque site slab.
// The previous [-3,-26] roof probe is now in the 0.7m clearance beside
// the carved stairs, rather than on a roof. Probe the source-recorded upper
// public landing and require both its actual support and the open tower gap.
const [valleyX,valleyZ,valleyY]=source.publicApproach.path.at(-1)!;
const valley=new T.Raycaster(new T.Vector3(valleyX,110,valleyZ),new T.Vector3(0,-1,0));const hit=valley.intersectObjects(meshes)[0];assert(hit&&Math.abs(hit.point.y-valleyY)<.15&&['public-stair-landing','public-stair-tread'].includes((hit.object as T.Mesh).geometry.userData.role),`Public valley landing missing/blocked: ${hit?.point.y}`);
const heights:number[]=[];for(const z of [-59,-4,57]){const hits=new T.Raycaster(new T.Vector3(z===-4?-16:13,120,z),new T.Vector3(0,-1,0)).intersectObjects(meshes);if(hits[0])heights.push(hits[0].point.y)}assert(heights.length===3&&Math.max(...heights)-Math.min(...heights)>20,'Lost unequal tower mixture');
// Decoded export budget and actual top winding, after compression.
await MeshoptDecoder.ready;const file=process.env.VALLEY_GLB_PATH??'public/canal-drive/models/valley.glb',doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(file);let triangles=0,downwardRoofs=0;
for(const mesh of doc.getRoot().listMeshes())for(const p of mesh.listPrimitives()){const pos=p.getAttribute('POSITION')!,ix=p.getIndices();triangles+=(ix?.getCount()??pos.getCount())/3;if(p.getMaterial()?.getName()!=='stone')continue;for(let i=0;i<(ix?.getCount()??pos.getCount());i+=3){const v=[0,1,2].map(k=>new T.Vector3(...pos.getElement(ix?ix.getScalar(i+k):i+k,[]) as [number,number,number]));const cross=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));if(cross.y<-.01&&v.every(q=>Math.abs(q.y-v[0].y)<.04)&&v[0].y>.1)downwardRoofs++;}}
// Independently decode the current GLB and verify the same actual public
// landing in compressed geometry, preventing authored-only probe success.
const decodedMeshes:T.Mesh[]=[];for(const node of doc.getRoot().listNodes()){const mesh=node.getMesh();if(!mesh)continue;for(const prim of mesh.listPrimitives()){const pos=prim.getAttribute('POSITION')!,g=new T.BufferGeometry(),points:number[]=[];for(let i=0;i<pos.getCount();i++)points.push(...pos.getElement(i,[]));g.setAttribute('position',new T.Float32BufferAttribute(points,3));const ix=prim.getIndices();if(ix)g.setIndex(Array.from(ix.getArray()!));g.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));g.computeVertexNormals();decodedMeshes.push(new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide})));}}
const decodedPedestrianSamples=pedestrianClearance(decodedMeshes,'decoded');
const decodedTreadWidthSamples=treadWidthSupport(decodedMeshes,'decoded');
const decodedLanding=valley.intersectObjects(decodedMeshes)[0];assert(decodedLanding&&Math.abs(decodedLanding.point.y-valleyY)<.15&&decodedLanding.face!.normal.y>.98,'Decoded public valley landing missing, blocked or downward-facing');
// Open-top shells retain supported bottom floors. Downward faces are floor
// undersides; the separately generated explicit roof planes must face up.
for(const m of meshes.filter(m=>m.geometry.userData.role==='explicit-roof')){const n=m.geometry.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>.99,'Downward explicit roof');}
assert.equal(triangles,authoredTriangles,'Export is stale or differs from the reviewed authored geometry');assert(triangles<40000);assert(fs.statSync(file).size<500000);console.log({triangles,bytes:fs.statSync(file).size,paneSamples,valleyHeight:hit.point.y,decodedValleyHeight:decodedLanding.point.y,towerProbeHeights:heights,decodedFloorUndersides:downwardRoofs,cavitySamples,undercutSamples,walkSamples,pedestrianSamples,decodedPedestrianSamples,treadWidthSamples,decodedTreadWidthSamples,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}});
