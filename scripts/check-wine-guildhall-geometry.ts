import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {buildWineGuildhall} from './landmarks/wine-guildhall-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import source from './landmarks/wine-guildhall-footprints.json';
import spec from './landmarks/wine-guildhall-spec.json';
const gs:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.userData.palette=c;g.rotateY(a);g.translate(x,y,z);gs.push(g);};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const b:BuildingTools={add,box,prism:()=>{},gableRoof:()=>{},hip:()=>{},window:()=>{},clock:()=>{},sign:()=>{throw Error('No painted names');}};
buildWineGuildhall(0,0,b);
const material=new T.MeshBasicMaterial({side:T.DoubleSide}),meshes=gs.map(g=>new T.Mesh(g,material));let triangles=0;const bounds=new T.Box3();
for(const g of gs){for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));g.computeBoundingBox();bounds.union(g.boundingBox!);triangles+=(g.index?.count??g.getAttribute('position').count)/3;}
assert(triangles<40000);assert(bounds.min.y>=-.001);assert(bounds.max.y<12.5&&bounds.max.y>11.5);
const p=new T.Vector2(...source.localRing[0]),q=new T.Vector2(...source.localRing[9]),mid=p.clone().lerp(q,.5),u=q.clone().sub(p).normalize(),width=p.distanceTo(q),scale=width/18.548521629031217;
const chain=source.frontEdgeIndices.map(i=>new T.Vector2(...source.localRing[i]));
const frame=(x:number)=>{const real=x*scale,normal=new T.Vector2(-u.y,u.x);let point:T.Vector2|undefined,exposure=-Infinity;for(let i=0;i<chain.length-1;i++){const a=chain[i],c=chain[i+1],lo=a.clone().sub(mid).dot(u),hi=c.clone().sub(mid).dot(u);if(real<Math.min(lo,hi)-1e-9||real>Math.max(lo,hi)+1e-9)continue;const q=a.clone().lerp(c,(real-lo)/(hi-lo)),out=q.dot(normal);if(out>exposure){point=q;exposure=out;}}if(!point)throw Error('No source street segment');return{point,normal};};
const native=(x:number,y:number,z:number)=>{const f=frame(x);return new T.Vector3(f.point.x+f.normal.x*z,y,f.point.y+f.normal.y*z);};
const hit=(x:number,y:number,z:number)=>{const f=frame(x);return new T.Raycaster(native(x,y,z),new T.Vector3(-f.normal.x,0,-f.normal.y)).intersectObjects(meshes)[0];};
for(const x of [-7.5,-4.5,-1.5,1.5,4.5,7.5])assert.equal(hit(x+.12,5.58,6)?.object.geometry.userData.palette,'glass','Upper glazing must be first facade hit');
for(const x of [-7.6,-5.1,-2.6,.6,5,7.55])assert.equal(hit(x+.12,2.25,6)?.object.geometry.userData.palette,'glass','Ground sash glazing remains exposed');
for(const x of [-6.12,.5,6.12])assert.equal(hit(x+.12,8.4,6)?.object.geometry.userData.palette,'glass','Attic panes are not buried by roof or gable');
assert.equal(hit(2.62,1.35,6)?.object.geometry.userData.palette,'dark','Portal arch preserves dark door instead of buried relief');
// Reference portal has a bowed broken-segmental cornice. Probe the actual
// native rim surface: its middle must rise above the chord between side
// samples. Straight triangular wings fail this independent silhouette test.
const canopyRims=meshes.filter(m=>m.geometry.userData.feature==='portal-curved-rim');
assert.equal(canopyRims.length,2,'Both broken fronton curved wings retained');
let portalCurvatureProbes=0;
for(const side of [-1,1]){
 const heights=[.32,.62,.92].map(x=>{
  const h=new T.Raycaster(native(2.62+side*x,6,.56),new T.Vector3(0,-1,0)).intersectObjects(canopyRims)[0];
  assert(h,'Observed canopy rim supports its side silhouette');portalCurvatureProbes++;return h.point.y;
 });
 assert(heights[1]>(heights[0]+heights[2])/2+.045,'Portal wing silhouette bows above a straight triangular chord');
 assert(heights[0]>4.40&&heights[2]<4.20,'Broken fronton rises toward central cartouche');
}
assert.equal(gs.filter(g=>g.userData.feature==='portal-cartouche-scroll').length,4,'Observed cartouche edges retain bounded upper/lower scroll relief');
// Recover the exposed lower sash panes from independent rays, instead of
// repeating builder coordinates. The photographic assertion fixes the side
// counts and catches an otherwise valid but mirrored portal/window rhythm.
const exposedLowerPanes=new Set<T.Object3D>();
for(let x=-9;x<=9;x+=.06){const first=hit(x,2.25,6);if(first?.object.geometry.userData.palette==='glass')exposedLowerPanes.add(first.object);}
// Recover continuous opening intervals: source-jog subdivisions are separate
// meshes, but remain one photographed sash aperture.
const intervals=[...exposedLowerPanes].map(o=>{const p=(o as T.Mesh).geometry.getAttribute('position');let lo=Infinity,hi=-Infinity;for(let i=0;i<p.count;i++){const x=(p.getX(i)-mid.x)*u.x+(p.getZ(i)-mid.y)*u.y;lo=Math.min(lo,x);hi=Math.max(hi,x);}return{lo,hi};}).sort((a,b)=>a.lo-b.lo);
const merged:typeof intervals=[];for(const v of intervals){const prev=merged.at(-1);if(prev&&v.lo-prev.hi<.002)prev.hi=Math.max(prev.hi,v.hi);else merged.push({...v});}
const lowerCentres=merged.map(v=>(v.lo+v.hi)/2);
assert.equal(lowerCentres.length,6,'Photographed six exposed lower sash openings');
assert.equal(lowerCentres.filter(x=>x<2.62*scale).length,source.principalFront.lowerOpeningPattern.leftOfPortal,'Source front has four lower openings left of portal');
assert.equal(lowerCentres.filter(x=>x>2.62*scale).length,source.principalFront.lowerOpeningPattern.rightOfPortal,'Source front has two lower openings right of portal');
assert.equal(hit(-2.62,2.25,6)?.object.geometry.userData.palette,'glass','Previous left-half portal position is restored to sash glazing');
// Sample actual pane fractions, including source-jog subdivisions. The old
// centre-only rays missed lower-sash glazing buried across a frontage notch.
let fractionalPaneProbes=0;
for(const g of gs.filter(g=>g.userData.role==='principal-facade'&&g.userData.palette==='glass')){
 const p=g.getAttribute('position');let lo=Infinity,hi=-Infinity,yl=Infinity,yh=-Infinity;
 for(let i=0;i<p.count;i++){const x=(p.getX(i)-mid.x)*u.x+(p.getZ(i)-mid.y)*u.y;lo=Math.min(lo,x);hi=Math.max(hi,x);yl=Math.min(yl,p.getY(i));yh=Math.max(yh,p.getY(i));}
 for(const fx of [.04,.23,.77,.96])for(const fy of [.13,.37,.83]){
  const first=hit((lo+(hi-lo)*fx)/scale,yl+(yh-yl)*fy,3);
  assert(['glass','white','stone'].includes(first?.object.geometry.userData.palette),'Pane fractions expose glass or intentional pale sash members, never brick');fractionalPaneProbes++;
 }
}
const h=source.localHoles[0],centre=h.reduce((s,p)=>s.add(new T.Vector2(...p)),new T.Vector2()).multiplyScalar(1/h.length);
for(const y of [20,6,1])assert.equal(new T.Raycaster(new T.Vector3(centre.x,y,centre.y),new T.Vector3(0,-1,0)).intersectObjects(meshes).length,0,'Current BAG courtyard hole is open to sky/grade');
let maxResidual=0,roofProbes=0;
for(const g of gs.filter(g=>g.userData.role==='roof')){
 const p=g.getAttribute('position'),ix=g.index!,normals=g.getAttribute('normal');for(let i=0;i<normals.count;i++)assert(normals.getY(i)>0);
 let best=0,plane:T.Plane|undefined;for(let i=0;i<ix.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,ix.getX(i)),b=new T.Vector3().fromBufferAttribute(p,ix.getX(i+1)),c=new T.Vector3().fromBufferAttribute(p,ix.getX(i+2)),area=Math.abs(b.clone().sub(a).cross(c.clone().sub(a)).y);if(area>best){best=area;plane=new T.Plane().setFromCoplanarPoints(a,b,c);}}
 assert(plane&&best>1e-7);const height=(x:number,z:number)=>-(plane!.normal.x*x+plane!.normal.z*z+plane!.constant)/plane!.normal.y;
 for(const r of g.userData.sourceRings as number[][][])for(const v of r){const e=Math.abs(height(v[0],v[2])-v[1]);maxResidual=Math.max(maxResidual,e);assert(e<.01,'Every survey observation agrees with bounded fitted plane');}
 for(let i=0;i<ix.count;i+=3){const c=new T.Vector3();for(let j=0;j<3;j++)c.add(new T.Vector3().fromBufferAttribute(p,ix.getX(i+j)));c.multiplyScalar(1/3);const roof=meshes[gs.indexOf(g)],shell=meshes[gs.indexOf(g)-1];assert(new T.Raycaster(c.clone().add(new T.Vector3(0,.02,0)),new T.Vector3(0,-1,0)).intersectObject(roof).length>0);assert(new T.Raycaster(c.clone().add(new T.Vector3(0,-.02,0)),new T.Vector3(0,-1,0)).intersectObject(shell).length>0,'Roof bounded inside own support shell');roofProbes++;}
}
// Official neighboring Pand geometries independently constrain street relation.
// The former edge9→10 is backed by Koestraat8 and cannot be a facade.
const neighbours=source.retainedNeighbors.map(n=>{const raw=JSON.parse(fs.readFileSync(n.source,'utf8'));const f=raw.features?.[0]??raw;assert.equal(f.properties.identificatie,n.bagId,'Official neighboring parent identity');return f;});
const lngLat=(p:number[])=>new T.Vector2((p[0]-source.anchor[0])*111320*Math.cos(source.anchor[1]*Math.PI/180),-(p[1]-source.anchor[1])*110540);
const rings=neighbours.map(f=>f.geometry.coordinates[0].map(lngLat) as T.Vector2[]);
const inside=(p:T.Vector2,r:T.Vector2[])=>{let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
const adjacentMeshes=rings.map(r=>{const g=new T.ExtrudeGeometry(new T.Shape(r),{depth:20,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,20,0);g.userData.palette='retained-neighbor';return new T.Mesh(g,material);});
for(const x of [-7.5,-4.5,-1.5,1.5,4.5,7.5]){const f=frame(x+.12),all=new T.Raycaster(native(x+.12,5.58,3),new T.Vector3(-f.normal.x,0,-f.normal.y)).intersectObjects([...meshes,...adjacentMeshes]);assert.equal(all[0]?.object.geometry.userData.palette,'glass','Street sash remains first hit with retained official neighboring footprints');assert(rings.every(r=>!inside(f.point.clone().addScaledVector(f.normal,.2),r)),'Front detail stays outside adjoining Pand');const support=new T.Raycaster(native(x+.12,5.58,-.02),new T.Vector3(-f.normal.x,0,-f.normal.y)).intersectObjects(meshes)[0];assert.equal(support?.object.geometry.userData.palette,'brick','Actual source street plane backs upper sash');assert(support.distance<.2,'No floating facade far ahead of surveyed backing');}
for(const [x,y,palette] of [...[-7.6,-5.1,-2.6,.6,5,7.55].map(x=>[x+.12,2.25,'glass'] as const),...[-6.12,.5,6.12].map(x=>[x+.12,8.4,'glass'] as const),[2.62,1.35,'dark'] as const]){const f=frame(x),first=new T.Raycaster(native(x,y,3),new T.Vector3(-f.normal.x,0,-f.normal.y)).intersectObjects([...meshes,...adjacentMeshes])[0];assert.equal(first?.object.geometry.userData.palette,palette,'Lower/attic/door first-hit visible with all four official nearby neighbors retained');}
for(const x of [-7.6,-5.1,-2.6,.6,5,7.55]){const f=frame(x+.12),back=new T.Raycaster(native(x+.12,2.25,-.02),new T.Vector3(-f.normal.x,0,-f.normal.y)).intersectObjects(meshes.filter(m=>m.geometry.userData.role==='principal-backing'))[0];assert.equal(back?.object.geometry.userData.palette,'brick','Lower panes backed by actual northeast masonry');assert(back.distance<.2);}
// Independent footprint relation proves which side is actual Koestraat.
const rearA=new T.Vector2(...source.localRing[13]),rearB=new T.Vector2(...source.localRing[14]),rearU=rearB.clone().sub(rearA).normalize(),rearN=new T.Vector2(-rearU.y,rearU.x);
assert(inside(rearA.clone().lerp(rearB,.3).addScaledVector(rearN,.2),rings[2]),'Rear13→14 abuts official BAG8212; cannot be street front');
assert(rings.every(r=>!inside(mid.clone().addScaledVector(new T.Vector2(-u.y,u.x),3),r)),'Real three-metre street approach is outside all four official neighbors');
assert(inside(mid.clone().addScaledVector(new T.Vector2(-u.y,u.x),5),rings[3]),'Opposite BAG1634 confines actual Koestraat street gap');
let facadeNeighbourProbes=0;for(const g of gs.filter(g=>['principal-facade','principal-backing'].includes(g.userData.role))){const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const vertex=new T.Vector2(p.getX(i),p.getZ(i));assert(rings.every(r=>!inside(vertex,r)),`All facade assembly vertices disjoint: role${g.userData.role} palette${g.userData.palette} vertex${vertex.toArray()} neighbors${rings.map((r,i)=>inside(vertex,r)?neighbours[i].properties.identificatie:null)}`);facadeNeighbourProbes++;}}
const partyA=new T.Vector2(...source.localRing[9]),partyB=new T.Vector2(...source.localRing[10]),partyU=partyB.clone().sub(partyA).normalize(),partyN=new T.Vector2(-partyU.y,partyU.x);
for(const t of [.2,.5,.8]){const wall=partyA.clone().lerp(partyB,t),outside=wall.clone().addScaledVector(partyN,.3);assert(inside(outside,rings[0]),'Official Koestraat8 footprint establishes9→10 as party wall');const h=new T.Raycaster(new T.Vector3(outside.x,5.6,outside.y),new T.Vector3(-partyN.x,0,-partyN.y)).intersectObjects(meshes)[0];assert.equal(h?.object.geometry.userData.palette,'brick','Shared party wall remains undecorated');}
assert.equal(source.principalFront.edgeIndices[0],0);assert.equal(source.principalFront.edgeIndices.at(-1),9);assert(width>13.8&&width<13.9,'Actual northeast frontage is13.856m');
assert.equal(spec.landmarkId,'extract_landmarks_1958595244');assert.equal(spec.spatialSuppression,false);assert.deepEqual(spec.suppressOsmIds,[source.bagId]);
console.log(JSON.stringify({id:spec.id,triangles,bounds:bounds.getSize(new T.Vector3()).toArray(),maxResidual,roofProbes,portalCurvatureProbes,fractionalPaneProbes,exposedWindows:true,openCourtyard:true,facadeNeighbourProbes,streetFrontWidth:width}));
