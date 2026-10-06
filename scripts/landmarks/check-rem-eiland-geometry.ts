import assert from 'node:assert/strict';
import * as T from 'three';
import catalogue from '../../src/canalRecall/landmarks/manualCatalogue.json';
import type {BuildingTools} from './cultural-builders';
import {buildRemEiland} from './rem-eiland-builder';

const spec=catalogue.find(s=>s.id==='rem-eiland')!;
const w=spec.footprint!.lengthMetres,d=spec.footprint!.widthMetres;
const group=new T.Group();
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{
 const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.FrontSide}));
 mesh.name=c;mesh.position.set(x,y,z);mesh.rotation.y=a;group.add(mesh);
};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
buildRemEiland(w,d,{add,box,sign:()=>{}} as BuildingTools);
group.updateMatrixWorld(true);
let triangles=0;
for(const mesh of group.children as T.Mesh[]){
 const p=mesh.geometry.getAttribute('position');
 for(let i=0;i<p.count;i++)assert(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));
 triangles+=(mesh.geometry.index?.count??p.count)/3;
}
assert(triangles<40000);
const ray=(x:number,y:number,z:number,direction:T.Vector3,far=50)=>new T.Raycaster(new T.Vector3(x,y,z),direction,0,far).intersectObjects(group.children);
const down=new T.Vector3(0,-1,0),width=w*.95,depth=d*.93;
const marking=ray(-width*.1,22,0,down)[0];
assert.equal(marking.object.name,'white','helipad crossbar must be visible from above');
const markingBounds=new T.Box3().setFromObject(marking.object);
assert(markingBounds.max.y-markingBounds.min.y<.05,'helipad marking must lie flat');
for(const x of [-width*.1-.9,-width*.1+.9]){
 const stroke=ray(x,22,1,down)[0];
 assert.equal(stroke.object.name,'white','both H uprights must lie on the helipad');
 assert(Math.abs(stroke.point.y-marking.point.y)<.01);
}
// Sample walking surfaces along every flight, not just the presence of boxes.
// A descending/missing tread or buried upper flight breaks this route.
const nearX=(width+1)/2+.9,farX=nearX+1.6,z0=-depth*.36,z1=depth*.36;
for(const [x,start,end,low,high] of [
 [nearX,z0,z1,1,5],[farX,z1,z0,5,9],[nearX,z0,z1,9,13],
 [farX,z1,z0,13,16.55],[nearX,z0,z1,16.55,20.1],
]){
 let previous=low;
 for(let i=2;i<=8;i++){
  const t=i/10,expected=low+(high-low)*t;
  const hit=ray(x,expected+.5,start+(end-start)*t,down,1)[0];
  assert(hit,'missing stair walking surface');
  assert.equal(hit.object.name,'frame');
  assert(hit.point.y>=previous,'stair route must ascend continuously');
  assert(Math.abs(hit.point.y-expected)<.25,'stair tread rise too large');
  previous=hit.point.y;
 }
}
// Joins must touch exposed deck perimeter rather than disappear into red walls.
for(const [x,y,z] of [[width*.465,13,z1],[width*.445,20.1,z1]]){
 const hit=ray(x,y+.3,z,down,.5)[0];
 assert(hit,'landing must meet an exposed deck surface');
 assert.notEqual(hit.object.name,'red','deck landing must not enter the opaque wall shell');
 assert(Math.abs(hit.point.y-y)<.01);
}
// Raised source-supported bridge: walking surface must join the first landing
// without a 1 m vertical barrier; do not infer water/shore ground from this datum.
const approachX=nearX-1.4;
for(const [x,z] of [[-width*.4,0],[0,0],[approachX-.8,0],[approachX,-.8],[approachX,z0-.4],[approachX+.8,z0-.65],[nearX,z0-.65]]){
 const hit=ray(x,1.3,z,down,.5)[0];
 assert(hit,'missing raised footbridge/landing surface');
 assert(Math.abs(hit.point.y-1)<.01,'footbridge must meet initial stair landing');
}
// Body-height rays seek obstructing braces, rails or first-flight tread boxes.
for(const [x,z,direction,far] of [
 [0,0,new T.Vector3(1,0,0),approachX],
 [approachX,0,new T.Vector3(0,0,-1),-z0+.65],
 [approachX,z0-.65,new T.Vector3(1,0,0),nearX-approachX],
] as [number,number,T.Vector3,number][])
 assert.equal(ray(x,1.7,z,direction,far).length,0,'raised approach must remain free of crossing rails or braces');
assert.equal(ray(width*.46,20.6,z1+.5,new T.Vector3(1,0,0),2).length,0,'roof railing must leave access opening beside the last tread');
assert.equal(ray(0,7,0,new T.Vector3(0,-1,0),6).length,0,'platform undercroft must remain open');
console.log(JSON.stringify({triangles,bounds:new T.Box3().setFromObject(group),checks:['finite geometry','flat first-hit H strokes','continuous exposed stair walking surfaces','exposed lower/roof deck landing joins','raised bridge/initial landing joins and body-height clearance','roof access railing gap','open undercroft']}));
