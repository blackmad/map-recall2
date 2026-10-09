import assert from 'node:assert/strict';import * as T from 'three';import {huizeFrankendaelDraftGeometry} from './landmarks/huize-frankendael-draft-tools';import spec from './landmarks/huize-frankendael-spec.json';import source from './landmarks/huize-frankendael-footprints.json';
const gs=huizeFrankendaelDraftGeometry(),material=new T.MeshBasicMaterial({side:T.DoubleSide}),meshes=gs.map(g=>new T.Mesh(g,material));for(const m of meshes)m.updateMatrixWorld();const bounds=new T.Box3();let triangles=0;
for(const g of gs){const p=g.getAttribute('position');for(const v of p.array)assert(Number.isFinite(v));g.computeBoundingBox();bounds.union(g.boundingBox!);triangles+=(g.index?.count??p.count)/3;
 if(g.userData.role==='roof'){const ix=g.index;for(let i=0;i<(ix?.count??p.count);i+=3){const vs=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j));assert(vs[1].sub(vs[0]).cross(vs[2].sub(vs[0])).y>1e-9,'explicit roof upward');}}
}
const ray=(p:number[],d:number[])=>new T.Raycaster(new T.Vector3(...p),new T.Vector3(...d)).intersectObjects<T.Mesh>(meshes)[0];
// Fractional probes of every critical front and garden opening. Mullions are avoided.
for(const x of[-3.70,3.65])for(const [y,h,w]of[[.2,.92,1.88],[2,3.36,1.89],[6.89,2.89,1.89]])for(const u of[-.34,.34])for(const v of[.21,.73])assert.equal(ray([x+u*w,y+h*v,15],[0,0,-1])?.object.geometry.userData.palette,'glass','front panes exposed');
for(const x of[-4.14,4.10])for(const [y,h]of[[.16,.94],[2.01,3.31],[6.93,2.72]])for(const u of[-.34,.34])assert.equal(ray([x+u*2.20,y+h*.21,-15],[0,0,1])?.object.geometry.userData.palette,'glass','garden panes exposed');
for(const y of[2.02,6.94])assert.equal(ray([-.08+.23,y+.40,-16],[0,0,1])?.object.geometry.userData.palette,'glass','rear bay not buried');
for(const u of[-.34,.34])for(const v of[.21,.73])assert.equal(ray([-.02+u*1.61,6.98+v*2.78,15],[0,0,-1])?.object.geometry.userData.palette,'glass','central carved window panes remain exposed');
for(const side of[-1,1])for(const u of[-.34,.34])for(const v of[.21,.73])assert.equal(ray([side*22,11.93+v*1.17,.10+u*1.46],[-side,0,0])?.object.geometry.userData.palette,'glass','both side dormers visible');
for(const x of[-13.43,-8.96,8.89,13.39])assert.equal(ray([x+.12,6.12+.21+.37,15],[0,0,-1])?.object.geometry.userData.palette,'glass','wing dormers project past slope');
assert.equal(ray([.12,12.36,15],[0,0,-1])?.object.geometry.userData.palette,'glass','central dormer exposed');
for(const x of[-10,10])for(const z of[-.5,.5])assert.equal(ray([x,20,z],[0,-1,0])?.object.geometry.userData.role,'roof','wing roof owns top');
assert.equal(ray([1,20,0],[0,-1,0])?.object.geometry.userData.role,'roof','central truncated plateau');
assert.equal(ray([.5,20,-6.4],[0,-1,0])?.object.geometry.userData.role,'roof','rear projection flat attic');
for(const x of[-10,10])assert(!ray([x,9,-14],[0,0,1]),'wing rear boundary cannot become a pavilion-height wall');
// Forecourt, rear garden and adjacent sides must never become parcel-wide slabs.
for(const [x,z]of[[-12,-8],[12,-8],[-12,8],[12,8],[-18,0],[18,0]])assert(!ray([x,3,z],[0,-1,0]),'outside real footprint stays open');
assert(triangles<40000);assert(bounds.min.y>=-.001);assert(bounds.max.y<=16.7);assert(bounds.max.x-bounds.min.x<34);assert(bounds.max.z-bounds.min.z<15.8);
assert.equal(spec.landmarkId,'extract_landmarks_746892406');assert.equal(spec.spatialSuppression,false);for(const n of source.retainedNeighbors)for(const id of[n.id,n.bagId])assert(!spec.suppressOsmIds.includes(id));
assert(gs.filter(g=>g.userData.role==='roof-baluster').length>60,'pierced roof balustrade present');
console.log(JSON.stringify({id:spec.id,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},upwardRoof:true,firstHitGlazing:true,openSurroundings:true,scope:'CPU geometry only; gallery/live/route/pin/pointer pending'}));
// Decode the compressed draft too: large slate faces must still wind upward.
const fs=await import('node:fs');const draft='artifacts/huize-frankendael-draft/huize-frankendael.glb';
if(fs.existsSync(draft)){const {NodeIO}=await import('@gltf-transform/core'),{ALL_EXTENSIONS}=await import('@gltf-transform/extensions'),{MeshoptDecoder}=await import('meshoptimizer');await MeshoptDecoder.ready;const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(draft);assert.equal(doc.getRoot().listTextures().length,0);assert(fs.statSync(draft).size<500000);let slateFaces=0,smallIgnored=0;
 for(const mesh of doc.getRoot().listMeshes())for(const p of mesh.listPrimitives()){if(p.getMaterial()?.getName()!=='slate')continue;const pos=p.getAttribute('POSITION')!,ix=p.getIndices();for(let i=0;i<(ix?.getCount()??pos.getCount());i+=3){const vs=[0,1,2].map(j=>new T.Vector3(...pos.getElement(ix?ix.getScalar(i+j):i+j,[])));const n=vs[1].sub(vs[0]).cross(vs[2].sub(vs[0]));if(n.length()/2<.02){smallIgnored++;continue;}assert(n.y>0,'decoded slate roof faces remain upward');slateFaces++;}}
 assert(slateFaces>20);console.log(JSON.stringify({compressedDraft:true,largeSlateFacesUpward:slateFaces,smallChimneyConeFacesIgnored:smallIgnored}));}
