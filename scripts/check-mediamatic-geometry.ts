import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { upwardRoofPlane } from './landmarks/house-geometry';

// Survey preparation only: this does not accept a facade or authorize suppression.
const scope = JSON.parse(readFileSync('scripts/landmarks/mediamatic-footprints.json', 'utf8'));
const spec = JSON.parse(readFileSync('scripts/landmarks/mediamatic-spec.json', 'utf8'));
const original = JSON.parse(gunzipSync(readFileSync(scope.source.installedTile)).toString());
const part = scope.parts[0];
const installed = original.features.find((f: any) => f.properties.id === part.id);
assert(installed, 'Exact current installed BAG parent must exist');
assert.deepEqual(part.geojson, installed.geometry, 'Do not replace native surveyed outline with a rectangle');
assert.deepEqual(spec.suppressOsmIds, [part.id]);
const [lon, lat] = scope.anchorLonLat;
const scaleX = 111320 * Math.cos(lat * Math.PI / 180);
const local = (point: number[]) => [(point[0] - lon) * scaleX, (lat - point[1]) * 111320];
for (let i = 0; i < part.localOuter.length; i++) {
  const expected = local(part.geojson.coordinates[0][i]);
  assert(Math.abs(part.localOuter[i][0] - expected[0]) < 0.00001);
  assert(Math.abs(part.localOuter[i][1] - expected[1]) < 0.00001);
}
const shape = new T.Shape(part.localOuter.map((p: number[]) => new T.Vector2(p[0], p[1])));
const mesh = new T.Mesh(upwardRoofPlane(shape), new T.MeshBasicMaterial());
mesh.updateMatrixWorld();
const hits = (point: number[]) => {
  const [x, z] = local(point);
  return new T.Raycaster(new T.Vector3(x, 20, z), new T.Vector3(0, -1, 0)).intersectObject(mesh);
};
assert(hits([4.9133, 52.3765]).length > 0, 'Survey support probe should hit native footprint');
for (const probe of scope.openSpaceProbes) assert.equal(hits(probe.lonLat).length, 0, probe.name);
for (const neighbor of scope.retainedNeighbors) {
  assert(!spec.suppressOsmIds.includes(neighbor.id), `Retain ${neighbor.id}`);
  const ring = neighbor.geometry.coordinates[0];
  const center = ring.slice(0, -1).reduce((sum: number[], p: number[]) => [sum[0] + p[0], sum[1] + p[1]], [0, 0]).map((v: number) => v / (ring.length - 1));
  assert.equal(hits(center).length, 0, `Neighbor center ${neighbor.id} must remain outside replacement`);
}

import {buildMediamatic} from './landmarks/mediamatic-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
const geometries:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);geometries.push(g)};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const unused=()=>{throw Error('Unexpected primitive')};
buildMediamatic(45.328,31.838,{add,box,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused});
const material=new T.MeshBasicMaterial({side:T.FrontSide}),meshes=geometries.map(g=>new T.Mesh(g,material));meshes.forEach(m=>m.updateMatrixWorld());
let triangles=0;const bounds=new T.Box3();
for(const g of geometries){const p=g.getAttribute('position');for(const value of p.array)assert(Number.isFinite(value),'finite vertex');g.computeBoundingBox();bounds.union(g.boundingBox!);triangles+=(g.index?.count??p.count)/3;
 if(g.userData.role==='roof')for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),q=new T.Vector3().fromBufferAttribute(p,i+1),r=new T.Vector3().fromBufferAttribute(p,i+2);assert(q.sub(a).cross(r.sub(a)).y>0,'greenhouse roof winds upward');}
}
const origin=[-5.898,-11.716],sin=.164,cos=Math.sqrt(1-sin*sin);
const uv=(u:number,y:number,v:number)=>new T.Vector3(origin[0]+cos*u+sin*v,y,origin[1]-sin*u+cos*v);
const ray=(u:number,y:number,v:number,du:number,dy:number,dv:number)=>new T.Raycaster(uv(u,y,v),new T.Vector3(cos*du+sin*dv,dy,-sin*du+cos*dv).normalize()).intersectObjects(meshes)[0];
for(const u of [1.5,3.6,5.7,8.2,10.3])for(const fraction of [-.3,0,.3])for(const y of[1.5,1.9,2.2])assert.equal(ray(u+fraction,y,-2,0,0,1)?.object.geometry.userData.palette,'dark','north low apertures expose glass/dark recess rather than brick');
for(const u of[.77,3.15,6.72,10.29])for(const y of[8.7,9.8]){const h=ray(u,y,-2,0,0,1);assert(h?.object.geometry.userData.palette==='glass'||h?.object.geometry.userData.role==='source-supported-lettering','north glazed added storey remains visible except its real sign');}
for(const u of[-13,-10,-6,-2])for(const y of[.7,1.7,2.7])assert.equal(ray(u+.23,y,-1,0,0,1)?.object.geometry.userData.palette,'glass','northwest greenhouse panes are exposed');

// Bars must physically clear the glass faces, not disappear in a blue slab.
const greenhouseFrameProbes:Array<[number,number,number,number,number,number]>=[];
for(let k=0;k<=14;k++)greenhouseFrameProbes.push([-15.05+(14.97*k/14),1.7,-1,0,0,1]);
for(const y of[1.20,2.42])for(const u of[-13.4,-8.7,-3.4])greenhouseFrameProbes.push([u,y,-1,0,0,1]);
for(const v of[17.98,21.93])assert.equal(ray(-2,6.82,v,1,0,0)?.object.geometry.userData.palette,'ochre','western brick lettering pier has no continuing white window lintel');
for(const probe of greenhouseFrameProbes)assert.equal(ray(...probe)?.object.geometry.userData.palette,'frame','greenhouse grid frame is exposed before glass');
const portRing=[[17.45,2.16],[23.19,2.07],[23.25,23.89],[17.46,24.31],[15.96,5.35],[15.7,5.06]];
for(let i=0;i<portRing.length;i++){
 const a=portRing[i],q=portRing[(i+1)%portRing.length],du=q[0]-a[0],dv=q[1]-a[1],len=Math.hypot(du,dv);if(len<2)continue;const n=[dv/len,-du/len],panes=Math.max(2,Math.floor(len/1.8));
 for(let k=0;k<panes;k++)for(const f of[.25,.5,.75])for(const y of[1.2,2.5,4.0,5.1]){
  const t=(k+f)/panes;const h=ray(a[0]+du*t+n[0]*.195,y,a[1]+dv*t+n[1]*.195,-n[0],0,-n[1]);assert.equal(h?.object.geometry.userData.palette,'glass',`portakabin actual edge ${i}, pane ${k}, fraction ${f}, height ${y}`);
 }
}
for(const probe of scope.openSpaceProbes){const [x,z]=local(probe.lonLat);assert.equal(new T.Raycaster(new T.Vector3(x,.5,z),new T.Vector3(0,1,0)).intersectObjects(meshes).length,0,probe.name);}
for(const p of [[6,11],[20,11]])assert.equal(ray(p[0],20,p[1],0,-1,0)?.object.geometry.userData.palette,'slate','dark membrane owns office roof top without pale cap');
for(const u of [-12,-6,-1])assert(Math.abs(ray(u,20,1.6,0,-1,0)?.point.y!-4.02)<.08,'greenhouse roof owns its ridge height');
assert(triangles<40000);assert(bounds.max.y<11);assert(bounds.min.y>=0);assert(bounds.max.x-bounds.min.x<47);assert(bounds.max.z-bounds.min.z<34);
assert.equal(spec.spatialSuppression,false);assert.equal(spec.landmarkId,'extract_landmarks_32851647');
console.log(JSON.stringify({id:'mediamatic',triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},exactScope:true,retainedNeighbors:scope.retainedNeighbors.length,openApron:true,firstHitGlazing:true,roofWinding:true,visualAcceptance:false}));

// Optional actual compressed-export checks: material FrontSide is deliberate.
// Supplying a GLB path catches quantization and winding hidden by previews.
if(process.argv[2]){
 const {NodeIO}=await import('@gltf-transform/core'),{ALL_EXTENSIONS}=await import('@gltf-transform/extensions'),{MeshoptDecoder}=await import('meshoptimizer');await MeshoptDecoder.ready;
 const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(process.argv[2]);assert.equal(doc.getRoot().listTextures().length,0);
 const decoded:T.Mesh[]=[];let roofFaces=0,decodedTriangles=0;
 for(const node of doc.getRoot().listNodes())for(const prim of node.getMesh()?.listPrimitives()??[]){
  const accessor=prim.getAttribute('POSITION')!,index=prim.getIndices(),matrix=new T.Matrix4().fromArray(node.getWorldMatrix());const positions:number[]=[];
  for(let i=0;i<accessor.getCount();i++)positions.push(...new T.Vector3(...accessor.getElement(i,[])).applyMatrix4(matrix).toArray());
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));if(index)g.setIndex(Array.from(index.getArray()!));g.computeVertexNormals();
  const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.FrontSide}));mesh.name=prim.getMaterial()?.getName()??'';decoded.push(mesh);
  const p=g.getAttribute('position'),ix=g.getIndex();for(let i=0;i<(ix?.count??p.count);i+=3){decodedTriangles++;const ps=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+k):i+k)),n=ps[1].clone().sub(ps[0]).cross(ps[2].clone().sub(ps[0]));
   if(mesh.name==='slate'){assert(n.y>0,'compressed flat membrane roof winds upward');}
   if(mesh.name==='glass'&&ps.every(v=>v.y>=3.03&&v.y<=4.05)&&n.length()>1e-6){const ny=n.clone().normalize().y;if(Math.abs(ny)>.2&&Math.abs(ny)<.999){assert(ny>0,'compressed greenhouse sloping roof winds upward');roofFaces++;}}
  }
 }
 decoded.forEach(m=>m.updateMatrixWorld());
 const first=(u:number,y:number,v:number,du:number,dy:number,dv:number)=>new T.Raycaster(uv(u,y,v),new T.Vector3(cos*du+sin*dv,dy,-sin*du+cos*dv).normalize()).intersectObjects(decoded)[0];
 for(const u of[1.5,3.6,5.7,8.2,10.3])for(const f of[-.3,0,.3])for(const y of[1.5,1.9,2.2])assert.equal(first(u+f,y,-2,0,0,1)?.object.name,'dark','compressed north ground panes first hit');
 for(const u of[-13,-10,-6,-2])for(const y of[.7,1.7,2.7])assert.equal(first(u+.23,y,-1,0,0,1)?.object.name,'glass','compressed greenhouse glazing first hit');
 for(const v of[17.98,21.93])assert.equal(first(-2,6.82,v,1,0,0)?.object.name,'ochre','compressed western sign pier has no window lintel');
 for(const probe of greenhouseFrameProbes)assert.equal(first(...probe)?.object.name,'frame','compressed greenhouse grid is first-hit exposed');
 for(let i=0;i<portRing.length;i++){const a=portRing[i],q=portRing[(i+1)%portRing.length],du=q[0]-a[0],dv=q[1]-a[1],len=Math.hypot(du,dv);if(len<2)continue;const n=[dv/len,-du/len],panes=Math.max(2,Math.floor(len/1.8));for(let k=0;k<panes;k++)for(const f of[.25,.5,.75])for(const y of[1.2,2.5,4.0,5.1]){const t=(k+f)/panes;assert.equal(first(a[0]+du*t+n[0]*.195,y,a[1]+dv*t+n[1]*.195,-n[0],0,-n[1])?.object.name,'glass',`compressed port pane ${i}/${k}/${f}/${y}`);}}
 for(const p of[[6,11],[20,11]])assert.equal(first(p[0],20,p[1],0,-1,0)?.object.name,'slate','compressed office roof membrane owns top');
 for(const u of[-12,-6,-1])assert(Math.abs(first(u,20,1.6,0,-1,0)?.point.y!-4.02)<.08,'compressed greenhouse ridge is supported at known eave/crest');
 for(const probe of scope.openSpaceProbes){const [x,z]=local(probe.lonLat);assert.equal(new T.Raycaster(new T.Vector3(x,.5,z),new T.Vector3(0,1,0)).intersectObjects(decoded).length,0,probe.name);}
 assert(roofFaces>10);assert(decodedTriangles<40000);console.log(JSON.stringify({compressedPath:process.argv[2],decodedTriangles,roofFaces,frontSideGlazing:true,openApron:true}));
}
