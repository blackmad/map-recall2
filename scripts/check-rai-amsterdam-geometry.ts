import assert from 'node:assert/strict';
import * as T from 'three';
import {buildRaiAmsterdam} from './landmarks/rai-amsterdam-builder';
import footprints from './landmarks/rai-amsterdam-footprints.json';
import type {BuildingTools} from './landmarks/cultural-builders';
const group=new T.Group();let triangles=0;
const tools={add(g:T.BufferGeometry,c:string,x=0,y=0,z=0,angle=0){const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.FrontSide}));m.position.set(x,y,z);m.rotation.y=angle;m.userData.colour=c;group.add(m);triangles+=(g.index?.count??g.getAttribute('position').count)/3;}} as BuildingTools;
buildRaiAmsterdam(70.8,52.9,tools);group.updateMatrixWorld(true);
const bounds=new T.Box3().setFromObject(group),size=bounds.getSize(new T.Vector3());
assert(size.x>69&&size.x<76&&size.z>52&&size.z<60&&size.y>46&&size.y<48,'native scale');
assert(triangles<40000,'triangle budget');
for(const mesh of group.children as T.Mesh[]){const p=mesh.geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert(Number.isFinite(p.getX(i))&&Number.isFinite(p.getY(i))&&Number.isFinite(p.getZ(i)),'finite geometry')}
const rotation=new T.Matrix4().makeRotationY(-.0837);
function ray(x:number,y:number,z:number,dx:number,dy:number,dz:number){const o=new T.Vector3(x,y,z).applyMatrix4(rotation),d=new T.Vector3(dx,dy,dz).transformDirection(rotation);return new T.Raycaster(o,d,0,120).intersectObjects(group.children)}
// No solid floor-to-roof slab beneath the two raised hall cantilevers.
for(const x of[-30,10,20,30])assert.equal(ray(x,2,40,0,0,-1).length,0,`open public passage at ${x}`);
// Several fractions across the curved end facade and tower must expose glazing.
for(const x of[-31,-27,-19,-14,0,12,28])assert.equal(ray(x,12,40,0,0,-1)[0]?.object.userData.colour,'glass',`exposed hall end ${x}`);
for(const x of[-22,-18,-14])assert.equal(ray(x,34,40,0,0,-1)[0]?.object.userData.colour,'glass',`exposed tower end ${x}`);
// Fractions of the actual 52.8 m east office face catch buried outer/edge panes.
const fractions=[.007,.05,.125,.25,.375,.5,.625,.75,.875,.95,.993];
let eastGlassProbes=0,westSlotProbes=0;
for(const fraction of fractions)for(const y of[21.1,22.7,24.3,33.1,41.9,45.3]) {
  const z=-26.4+52.8*fraction;
  assert.equal(ray(5,y,z,-1,0,0)[0]?.object.userData.colour,'glass',`east office curtain wall fraction ${fraction} at ${y}`);
  eastGlassProbes++;
}
for(const fraction of fractions)for(const y of[22.37,31.97,41.57]) {
  const z=-22.99+45.98*fraction;
  assert.equal(ray(-45,y,z,1,0,0)[0]?.object.userData.colour,'glass',`west office slot fraction ${fraction} at ${y}`);
  westSlotProbes++;
}
for(const y of[24,30.4,40])assert.equal(ray(-45,y,0,1,0,0)[0]?.object.userData.colour,'concrete',`west office metal between strips ${y}`);
assert.equal(ray(-45,44.7,0,1,0,0)[0]?.object.userData.colour,'concrete','rounded west office shoulder remains metal');
assert(!group.children.some(m=>m.userData.colour==='stone'),'warm masonry palette must not own the silver ribbon');
// Actual first-hit top faces must face upward and stay supported by the native profile.
let upwardRoofProbes=0;
for(const x of[-32,-28,-21,-17,-12,0,20,32])for(const fraction of[.05,.5,.95]) {
  const hit=ray(x,60,-26.4+52.8*fraction,0,-1,0)[0];
  assert(hit&&hit.face&&hit.face.normal.y>.2,`upward exposed roof ${x}/${fraction}`);
  const y=hit.point.y;
  assert(x<-22.87?y<19:x>-7.90?y<19:y>43&&y<47,`roof supported by hall/tower section ${x}/${fraction}`);
  upwardRoofProbes++;
}
assert(ray(20,40,0,0,-1,0)[0]!.point.y<20,'low east hall must not acquire tower height');
// Independently project the admitted BAG/OSM rings. Tests compare built geometry
// to input coordinates, not a repeated authored box width/depth.
const inverse=rotation.clone().invert();
function sourceRing(coordinates:number[][]):T.Vector2[] {
  const [lon,lat]=footprints.anchor;
  return coordinates.slice(0,-1).map(([x,z])=>{
    const p=new T.Vector3((x-lon)*111320*Math.cos(lat*Math.PI/180),0,(lat-z)*111320).applyMatrix4(inverse);
    return new T.Vector2(p.x,p.z);
  });
}
const parent=sourceRing(footprints.geometry.coordinates[0]);
const groundPart=footprints.parts.find(p=>p.id==='w806950194')!;
const ground=sourceRing(groundPart.geometry.coordinates[0][0]);
const concoursePart=footprints.parts.find(p=>p.id==='w806950196')!;
const concourse=sourceRing(concoursePart.geometry.coordinates[0][0]);
function inside(p:T.Vector2,ring:T.Vector2[],tolerance=.002):boolean {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[j],b=ring[i],ab=b.clone().sub(a),t=Math.max(0,Math.min(1,p.clone().sub(a).dot(ab)/ab.lengthSq()));
    if(p.distanceTo(a.clone().addScaledVector(ab,t))<=tolerance)return true;
    if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }
  return inside;
}
let nativeBoundaryVertices=0;
const assemblyBounds:Record<string,T.Box3>={};
for(const mesh of group.children as T.Mesh[]) {
  const assembly=mesh.geometry.userData.raiAssembly;if(!assembly)continue;
  const ring=assembly.startsWith('native-ground')?ground:assembly.startsWith('native-concourse')?concourse:parent;
  const positions=mesh.geometry.getAttribute('position'),box=new T.Box3();
  for(let i=0;i<positions.count;i++) {
    const p=new T.Vector3().fromBufferAttribute(positions,i).applyMatrix4(inverse);
    assert(inside(new T.Vector2(p.x,p.z),ring),`${assembly} vertex outside its source footprint`);
    if(assembly==='native-end-glass'||assembly==='native-section-shell') {
      if(p.x>-7.90+.002)assert(p.y<=20.71,`${assembly} unsupported tall east-hall fin`);
      if(p.x<-22.87-.002)assert(p.y<=21.51,`${assembly} unsupported tall west-hall fin`);
    }
    if(assembly.startsWith('native-concourse'))assert(p.y>=concoursePart.properties.minHeight-.002&&p.y<=7.702,`${assembly} raised concourse height`);
    if(assembly.startsWith('native-ground'))assert(p.y>=-.002&&p.y<=groundPart.properties.height+.002,`${assembly} source height`);
    box.expandByPoint(p);nativeBoundaryVertices++;
  }
  assemblyBounds[assembly]=box;
}
for(const [assembly,ring] of [['native-slab-roof',parent],['native-ground-roof',ground]] as const) {
  const built=assemblyBounds[assembly];assert(built,`missing ${assembly}`);
  for(const axis of ['x','z'] as const) {
    const coords=ring.map(p=>axis==='x'?p.x:p.y);
    assert(Math.abs(built.min[axis]-Math.min(...coords))<.002,`${assembly} source minimum ${axis}`);
    assert(Math.abs(built.max[axis]-Math.max(...coords))<.002,`${assembly} source maximum ${axis}`);
  }
}
let nativeGroundFirstHits=0,nativeEndFirstHits=0;
for(let i=0;i<ground.length;i++) {
  const a=ground[i],b=ground[(i+1)%ground.length];
  if(a.distanceTo(b)<.5)continue;
  const direction=b.clone().sub(a).normalize(),out=new T.Vector2(-direction.y,direction.x);
  for(const fraction of[.17,.43,.83]) {
    const p=a.clone().lerp(b,fraction),o=p.clone().addScaledVector(out,3);
    const hits=ray(o.x,2,o.y,-out.x,0,-out.y);
    const first=hits[0];
    const hit=first?.object.userData.colour==='frame'?hits.find(h=>h.object.userData.colour==='glass'&&h.distance-first.distance<.15):first;
    assert(hit&&hit.object.userData.colour==='glass',`ground part first-hit glass edge ${i}/${fraction}`);
    const actual=hit.point.clone().applyMatrix4(inverse);
    assert(Math.hypot(actual.x-p.x,actual.z-p.y)<.015,`ground part first hit at surveyed perimeter ${i}/${fraction}`);

    nativeGroundFirstHits++;
  }
}
for(let i=0;i<parent.length;i++) {
  const a=parent[i],b=parent[(i+1)%parent.length];
  if(Math.abs(b.x-a.x)<Math.abs(b.y-a.y))continue;
  const direction=b.clone().sub(a).normalize(),out=new T.Vector2(-direction.y,direction.x);
  for(const fraction of[.19,.53,.81]) {
    const p=a.clone().lerp(b,fraction),o=p.clone().addScaledVector(out,3);
    const hits=ray(o.x,12,o.y,-out.x,0,-out.y);
    const first=hits[0];
    const hit=first?.object.userData.colour==='frame'?hits.find(h=>h.object.userData.colour==='glass'&&h.distance-first.distance<.2):first;
    assert(hit&&hit.object.userData.colour==='glass',`native ribbon end glass ${i}/${fraction}`);
    const actual=hit.point.clone().applyMatrix4(inverse);
    assert(Math.hypot(actual.x-p.x,actual.z-p.y)<.015,`ribbon end first hit at surveyed perimeter ${i}/${fraction}`);
    nativeEndFirstHits++;
  }
}
let nativeConcourseFirstHits=0,nativeOpenBaseProbes=0;
for(let i=0;i<concourse.length;i++) {
  const a=concourse[i],b=concourse[(i+1)%concourse.length];
  if(a.distanceTo(b)<.5)continue;
  const d=b.clone().sub(a).normalize(),out=new T.Vector2(-d.y,d.x);
  for(const fraction of[.19,.53,.81]) {
    const p=a.clone().lerp(b,fraction),o=p.clone().addScaledVector(out,3);
    const hits=ray(o.x,5.5,o.y,-out.x,0,-out.y);
    const first=hits[0];
    const hit=first?.object.userData.colour==='frame'?hits.find(h=>h.object.userData.colour==='glass'&&h.distance-first.distance<.15):first;
    assert(hit&&hit.object.geometry.userData.raiAssembly==='native-concourse-shell'&&hit.object.userData.colour==='glass',`raised concourse first-hit glass ${i}/${fraction}`);
    const actual=hit.point.clone().applyMatrix4(inverse);
    assert(Math.hypot(actual.x-p.x,actual.z-p.y)<.015,`raised concourse source perimeter ${i}/${fraction}`);
    nativeConcourseFirstHits++;
  }
}
// Ground circulation outside part194 remains open below part196's raised datum.
for(let x=-31;x<=31;x+=2)for(const z of[-20,-8,8,20]) {
  const p=new T.Vector2(x+.23,z+.17);
  if(!inside(p,parent,0)||inside(p,ground,.2))continue;
  assert(ray(p.x,3,p.y,0,-1,0).every(h=>h.object.userData.colour==='frame'),`public undercroft outside ground footprint ${p.x}/${p.y}`);
  nativeOpenBaseProbes++;
}
let nativeRoofProbes=0;
for(let x=-34;x<=34;x+=2)for(let z=-27;z<=27;z+=3) {
  const p=new T.Vector2(x+.29,z+.37),expected=inside(p,parent,0),hit=ray(p.x,60,p.y,0,-1,0)[0];
  if(expected) {
    assert(hit&&hit.face&&hit.face.normal.y>.2,`native footprint roof coverage ${p.x}/${p.y}`);
    nativeRoofProbes++;
  } else if(hit)assert(!hit.object.geometry.userData.raiAssembly||hit.object.geometry.userData.raiAssembly.startsWith('native-concourse'),`source shell overreach outside parent ${p.x}/${p.y}`);
}
console.log(JSON.stringify({nativeConcourseFirstHits,nativeOpenBaseProbes,nativeBoundaryVertices,nativeGroundFirstHits,nativeEndFirstHits,nativeRoofProbes,sourceParentBoundsXZ:[Math.min(...parent.map(p=>p.x)),Math.max(...parent.map(p=>p.x)),Math.min(...parent.map(p=>p.y)),Math.max(...parent.map(p=>p.y))],sourceGroundHeight:groundPart.properties.height,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},openGround:true,exposedGlass:true,eastGlassProbes,westSlotProbes,upwardRoofProbes}));
