import assert from 'node:assert/strict';
import * as T from 'three';
import {buildObaOosterdok} from './landmarks/oba-oosterdok-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import spec from './landmarks/oba-oosterdok-spec.json';
const group=new T.Group();let triangles=0,roofs=0;
const add:BuildingTools['add']=(geometry,c,x=0,y=0,z=0,angle=0)=> {
 geometry.rotateY(angle);geometry.translate(x,y,z);
 const p=geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert(Number.isFinite(p.getX(i)+p.getY(i)+p.getZ(i)));
 triangles+=(geometry.index?.count??p.count)/3;
 const normals=geometry.getAttribute('normal');
 if(Array.from({length:normals.count},(_,i)=>normals.getY(i)).every(v=>v>.9))roofs++;
 const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.FrontSide}));mesh.userData.colour=c;group.add(mesh);
};
const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
const unused=()=>{throw Error('Unexpected primitive');};
buildObaOosterdok(1,1,{add,box,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused});
group.updateMatrixWorld(true);const bounds=new T.Box3().setFromObject(group);
assert(bounds.min.x>-31&&bounds.max.x<25);assert(bounds.min.z>-49&&bounds.max.z<40);
assert(bounds.max.y>37&&bounds.max.y<37.5);assert(roofs>=10);assert(triangles<40000);
const ray=(origin:number[],direction:number[])=>new T.Raycaster(new T.Vector3(...origin as [number,number,number]),new T.Vector3(...direction as [number,number,number]).normalize()).intersectObject(group,true);
// Principal facade panes must be exposed before the opaque backing or cedar trim.
let hit=ray([.5,18,60],[0,0,-1])[0];assert(hit,'Front window absent');assert.equal(hit.object.userData.colour,'glass');assert(hit.point.z>26);
// The massive portal roof is thin and high; its southern projection has air beneath it.
hit=ray([3,60,33],[0,-1,0])[0];assert(hit);assert(hit.point.y>31&&hit.point.y<31.5);assert.equal(hit.object.userData.colour,'stone');
assert.equal(ray([3,29.8,34],[0,0,1]).length,0,'Stone slab fills open front portal');
// North service core has real37m height, while the rooftop restaurant remains lower.
hit=ray([1,60,-44],[0,-1,0])[0];assert(hit&&hit.point.y>=37);
hit=ray([2,60,10],[0,-1,0])[0];assert(hit&&hit.point.y>=33.9&&hit.point.y<=34.1);
// Conservatorium is east of this model, not swallowed by an enlarged block or BAG parent mask.
assert.equal(ray([32,60,-5],[0,-1,0]).length,0);
assert(!spec.suppressOsmIds.includes('w779659694'));assert(!spec.suppressOsmIds.includes('w779659696'));assert(!spec.suppressOsmIds.some(id=>id.includes('0363100012164964')));
assert.equal(spec.surveyed.northOffsetDegrees,0);assert.equal(spec.facingOffsetDegrees,0);
console.log(JSON.stringify({pass:true,triangles,upwardRoofPlanes:roofs,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},gpuAcceptance:'pending gallery/live scene, shared-parent fallback and neighbor retention review'}));
