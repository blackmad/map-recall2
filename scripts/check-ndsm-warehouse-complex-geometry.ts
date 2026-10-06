import assert from 'node:assert/strict';import * as T from 'three';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
import {buildNdsmWarehouseComplex,ndsmPaneProbes} from './landmarks/ndsm-warehouse-complex-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import spec from './landmarks/ndsm-warehouse-complex-spec.json';
import source from './landmarks/ndsm-warehouse-complex-footprints.json';
const geometries:T.BufferGeometry[]=[];const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,r=0)=>{g.userData.palette=c;g.rotateY(r);g.translate(x,y,z);geometries.push(g)};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,r=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,r);
const unused=()=>{throw Error('unexpected primitive')};buildNdsmWarehouseComplex(0,0,{add,box,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused});
const bounds=new T.Box3();let triangles=0;const meshes=geometries.map(g=>{g.computeBoundingBox();bounds.union(g.boundingBox!);triangles+=(g.index?.count??g.getAttribute('position').count)/3;for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));return new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));});
assert(triangles<40000);assert(bounds.max.y>23&&bounds.max.y<25);assert(bounds.max.x-bounds.min.x<206);assert(bounds.max.z-bounds.min.z<200);
const cast=(x:number,y:number,z:number,d:T.Vector3)=>new T.Raycaster(new T.Vector3(x,y,z),d).intersectObjects(meshes);
let visible=0,entry=0;const failures:unknown[]=[];
for(const p of ndsmPaneProbes){const a=new T.Vector2(p.a[0],p.a[2]),b=new T.Vector2(p.b[0],p.b[2]),n=new T.Vector2(...p.normal as [number,number]);for(const f of[.11,.37,.69,.91])for(const yf of[.23,.73]){const q=a.clone().lerp(b,f).addScaledVector(n,2),y=p.bottom+p.height*yf,hits=cast(q.x,y,q.y,new T.Vector3(-n.x,0,-n.y));const hit=hits[0];if(p.kind==='entry'){if(hit&&hit.distance<7.8)failures.push({kind:'entry',f,y,distance:hit.distance,role:hit.object.geometry.userData.role});else entry++;}else if(hit?.object.geometry.userData.role==='facade-glass')visible++;else if(hit?.object.geometry.userData.palette!=='frame')failures.push({kind:'pane',f,y,distance:hit?.distance,role:hit?.object.geometry.userData.role});}}
assert.deepEqual(failures,[],'fractional panes and physical entry must clear masonry');assert(visible>100&&entry>0);
for(const g of geometries.filter(g=>g.userData.role==='roof')){const n=g.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>.15,'all roof normals face up');}
for(const [x,z]of[[-130,0],[130,0],[0,-125],[0,125]])assert.equal(cast(x,35,z,new T.Vector3(0,-1,0))[0],undefined,'outside native Pand and independent neighbors stay open');
assert.equal(spec.spatialSuppression,false);assert.deepEqual(spec.suppressOsmIds,['w44824309','NL.IMBAG.Pand.0363100012062886']);assert.equal(spec.landmarkId,'extract_landmarks_1741957518');assert(!spec.suppressOsmIds.includes('NL.IMBAG.Pand.0363100012079735'));
// These fixed measured edge endpoints and photo-guided aperture zones are
// independent of ndsmPaneProbes. The former low-only meshes pass their own
// pane-centre checks but must fail here at source-supported upper heights.
const sourceEdges={
 south:[new T.Vector2(-29.25734037827351,57.2121753290412),new T.Vector2(24.74965966976015,99.36817535525188)],
 north:[new T.Vector2(102.31165974171017,.2761752947117202),new T.Vector2(-24.482340371221653,-98.90682475856738)],
 portal:[new T.Vector2(-73.39234041768941,22.74617531133117),new T.Vector2(-37.86034038604703,50.488175330567174)]
};
// Independent reconstruction from raw source rings; no builder interface/probe
// inventory is consumed. Collinear source edges may be split differently by the
// two regions, so test their overlap rather than matching endpoint pairs.
const surveyPlanes=new Map<number,(x:number,z:number)=>number>();
for(const roof of source.roofs){const vertices=roof.rings.flat(),center=vertices.reduce((s,p)=>s.map((v,i)=>v+p[i]),[0,0,0]).map(v=>v/vertices.length);let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of vertices){const x=p[0]-center[0],z=p[1]-center[1],y=p[2]-center[2];xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}const det=xx*zz-xz*xz,a=(xy*zz-zy*xz)/det,b=(zy*xx-xy*xz)/det;surveyPlanes.set(roof.index,(x,z)=>center[2]+a*(x-center[0])+b*(z-center[1]));}
const surveyEdges=source.roofs.flatMap(r=>r.rings.flatMap(ring=>ring.map((a,i)=>({id:r.index,a:a.slice(0,2),b:ring[(i+1)%ring.length].slice(0,2)}))));
const interfaces:{ids:number[];a:T.Vector2;b:T.Vector2;length:number;jump:number}[]=[];
for(let i=0;i<surveyEdges.length;i++){const e=surveyEdges[i],dx=e.b[0]-e.a[0],dz=e.b[1]-e.a[1],length=Math.hypot(dx,dz);if(length<.02)continue;const tx=dx/length,tz=dz/length;for(let j=i+1;j<surveyEdges.length;j++){const f=surveyEdges[j];if(e.id===f.id)continue;const c=f.a.map((v,k)=>v-e.a[k]),d=f.b.map((v,k)=>v-e.a[k]);if(Math.max(Math.abs(tx*c[1]-tz*c[0]),Math.abs(tx*d[1]-tz*d[0]))>.015)continue;const u=c[0]*tx+c[1]*tz,v=d[0]*tx+d[1]*tz,l=Math.max(0,Math.min(u,v)),r=Math.min(length,Math.max(u,v));if(r-l<.03)continue;const a=new T.Vector2(e.a[0]+l*tx,e.a[1]+l*tz),b=new T.Vector2(e.a[0]+r*tx,e.a[1]+r*tz),p=surveyPlanes.get(e.id)!,q=surveyPlanes.get(f.id)!;interfaces.push({ids:[e.id,f.id],a,b,length:r-l,jump:Math.max(Math.abs(p(a.x,a.y)-q(a.x,a.y)),Math.abs(p(b.x,b.y)-q(b.x,b.y)))});}}
assert.equal(interfaces.length,510,'complete native shared-edge inventory');
function sourceChecks(set:T.Mesh[],label:string){
 const colour=(hit:T.Intersection|undefined)=>hit?.object instanceof T.Mesh?(hit.object.geometry.userData.palette??hit.object.name):undefined;
 function ray(edge:keyof typeof sourceEdges,u:number,y:number,depth=2.8){const [a,b]=sourceEdges[edge],t=b.clone().sub(a).normalize(),n=new T.Vector2(-t.y,t.x),q=a.clone().addScaledVector(t,u).addScaledVector(n,2);return new T.Raycaster(new T.Vector3(q.x,y,q.y),new T.Vector3(-n.x,0,-n.y),0,depth).intersectObjects(set)[0];}
 let upperGlazing=0,lowWingMasonry=0,portalClearance=0,portalSupports=0,parkedBlueLeaves=0,officeBackdropGlass=0,officeBackdropCrown=0,officeEaveSupport=0;
 for(const zone of[
  {edge:'south' as const,spans:[[1.16,6.83],[17.15,22.82],[33.14,38.81]],heights:[8.2,9.6,10.8]},
  {edge:'north' as const,spans:[[32.25,38.51],[72.44,78.70],[112.63,118.89]],heights:[10.4,12.6,14.9]}
 ])for(const [l,r]of zone.spans)for(const f of[.11,.37,.69,.91])for(const y of zone.heights){const u=l+(r-l)*f,hit=ray(zone.edge,u,y),c=colour(hit);assert(c==='glass'||c==='frame',`${label}: ${zone.edge} source upper glazing u${u.toFixed(2)} y${y} first hit ${c}`);if(c==='glass')upperGlazing++;}
 assert(upperGlazing>=54,`${label}: upper source heights must predominantly hit glazing`);
 for(const zone of[{edge:'south' as const,span:[50,65]},{edge:'north' as const,span:[2,18]}])for(const f of[.19,.43,.77])for(const y of[7.5,8.1]){const u=zone.span[0]+(zone.span[1]-zone.span[0])*f,c=colour(ray(zone.edge,u,y));assert(c==='greyBrick'||c==='frame',`${label}: low wing must retain upper masonry ${zone.edge} u${u} y${y}: ${c}`);lowWingMasonry++;}
 // Architectural restoration account gives 10.5 m expedition doors including
 // main entry. Fixed rays near its head catch the former 7.2 m false lintel.
 for(const f of[.11,.37,.69,.91])for(const y of[.7,5.25,9.95,10.35]){const hit=ray('portal',22.55+(30.05-22.55)*f,y,7.8);assert.equal(hit,undefined,`${label}: main 10.5 m portal blocked f${f} y${y} by ${colour(hit)}`);portalClearance++;}
 for(const u of[22.55,30.05])for(const y of[2,7,10.2]){assert.equal(colour(ray('portal',u,y)),'frame',`${label}: portal jamb support missing u${u} y${y}`);portalSupports++;}
 for(const u of[19.5,21.2,31.0,32.9])for(const y of[1.9,7.4,10.1]){assert.equal(colour(ray('portal',u,y)),'blue',`${label}: parked blue leaf missing u${u} y${y}`);parkedBlueLeaves++;}
 // Fixed native inside-return chains and source-visible upper assemblies. These
 // do not consume builder pane records: the old open-sky office mesh must fail.
 for(const backdrop of[
  {id:'large',a:new T.Vector2(-92.6153404348,7.7781753022),b:new T.Vector2(-73.3923404177,22.7461753113),glass:[7.2,8.7,10.1],eave:[14.796,15.290]},
  {id:'small',a:new T.Vector2(-37.8603403860,50.4881753306),b:new T.Vector2(-29.2573403783,57.2121753290),glass:[9.55,10.15],eave:[15.254,15.254]}
 ])for(const f of[.11,.37,.69,.91]){
  const t=backdrop.b.clone().sub(backdrop.a).normalize(),n=new T.Vector2(-t.y,t.x),p=backdrop.a.clone().lerp(backdrop.b,f),q=p.clone().addScaledVector(n,5.8);
  const first=(y:number)=>new T.Raycaster(new T.Vector3(q.x,y,q.y),new T.Vector3(-n.x,0,-n.y),0,6.2).intersectObjects(set)[0];
  for(const y of backdrop.glass){const c=colour(first(y));assert(c==='glass'||c==='frame',`${label}: ${backdrop.id} office source glass strip f${f} y${y} first hit ${c}`);if(c==='glass')officeBackdropGlass++;}
  const eave=backdrop.eave[0]+f*(backdrop.eave[1]-backdrop.eave[0]);
  for(const y of[11.4,13.7,eave-.15]){const c=colour(first(y));assert(c==='greyBrick'||c==='frame',`${label}: ${backdrop.id} office missing backed crown f${f} y${y}: ${c}`);officeBackdropCrown++;}
  // A wall reaching a guessed height can pass horizontal rays while detached
  // from the roof. Look just inside the surveyed hall and require local support.
  const inside=p.clone().addScaledVector(n,-.4),roof=new T.Raycaster(new T.Vector3(inside.x,18,inside.y),new T.Vector3(0,-1,0),0,4.3).intersectObjects(set)[0];
  assert(roof&&Math.abs(roof.point.y-eave)<.20,`${label}: ${backdrop.id} office crown lacks native roof support f${f}: ${roof?.point.y} vs ${eave}`);officeEaveSupport++;
 }
 assert(officeBackdropGlass>=16,`${label}: source office bands must predominantly expose glass`);
 let roofInterfaceProbes=0,roofInterfaceSegments=0;
 for(const joint of interfaces){
  if(joint.jump<.2||joint.ids.join(',')==='512,544'||joint.ids.join(',')==='513,592')continue;
  let tested=false;
  for(const f of[.17,.53,.83]){
   const p=joint.a.clone().lerp(joint.b,f),h=joint.ids.map(id=>surveyPlanes.get(id)!(p.x,p.y));if(Math.abs(h[0]-h[1])<.15)continue;
   const t=joint.b.clone().sub(joint.a).normalize(),n=new T.Vector2(-t.y,t.x),side=h[0]<h[1]?-1:1,q=p.clone().addScaledVector(n,side*.04);
   for(const yf of[.35,.65]){const y=Math.min(...h)+Math.abs(h[0]-h[1])*yf,hit=new T.Raycaster(new T.Vector3(q.x,y,q.y),new T.Vector3(-side*n.x,0,-side*n.y),0,.09).intersectObjects(set)[0];assert(hit&&Math.abs(hit.distance-.04)<.025,`${label}: source roof interface ${joint.ids} f${f} y${y.toFixed(3)} missing native closure (${colour(hit)},distance${hit?.distance})`);roofInterfaceProbes++;tested=true;}
  }
  if(tested)roofInterfaceSegments++;
 }
 assert(roofInterfaceSegments>=360,`${label}: full source discontinuity coverage`);
 // Context-depth rays from the low east wing reproduce the independent visual
 // failure separately from local all-interface coverage.
 let easternContextProbes=0;
 for(const [a,b]of[[[32.338,56.863],[45.859,39.359]],[[45.859,39.359],[68.874,9.611]],[[72.408,5.695],[84.564,-9.837]]]){const p=new T.Vector2(...a as [number,number]).lerp(new T.Vector2(...b as [number,number]),.5),t=new T.Vector2(b[0]-a[0],b[1]-a[1]).normalize(),n=new T.Vector2(-t.y,t.x),q=p.clone().addScaledVector(n,4);for(const y of[10.5,12]){const hit=new T.Raycaster(new T.Vector3(q.x,y,q.y),new T.Vector3(-n.x,0,-n.y),0,6).intersectObjects(set)[0];assert(hit,`${label}: eastern low/high source context gap at ${a}->${b} y${y}`);easternContextProbes++;}}
 return {upperGlazing,lowWingMasonry,portalClearance,portalSupports,parkedBlueLeaves,officeBackdropGlass,officeBackdropCrown,officeEaveSupport,roofInterfaceSegments,roofInterfaceProbes,easternContextProbes};
}
const authoredSourceChecks=sourceChecks(meshes,'authored');
const decodedPath=process.argv[2];let decodedSourceChecks:ReturnType<typeof sourceChecks>|undefined;
if(decodedPath){
 await MeshoptDecoder.ready;
 const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(decodedPath),decoded:T.Mesh[]=[];
 for(const node of doc.getRoot().listNodes())for(const primitive of node.getMesh()?.listPrimitives()??[]){const pos=primitive.getAttribute('POSITION')!,g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(Array.from({length:pos.getCount()},(_,i)=>pos.getElement(i,[])).flat(),3));const indices=primitive.getIndices();if(indices)g.setIndex(Array.from(indices.getArray()!));g.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));g.computeVertexNormals();const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.name=primitive.getMaterial()!.getName();decoded.push(mesh);}
 decodedSourceChecks=sourceChecks(decoded,'decoded');
}
console.log(JSON.stringify({id:spec.id,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},roofPlanes:source.roofs.length,visiblePaneProbes:visible,openEntryProbes:entry,authoredSourceChecks,decodedPath:decodedPath??null,decodedSourceChecks,status:'CPU geometry passes; reference/render and game acceptance pending'}));
