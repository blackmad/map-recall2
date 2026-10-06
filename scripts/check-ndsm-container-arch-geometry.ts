import assert from 'node:assert/strict';
import * as T from 'three';
import {buildNdsmContainerArch} from './landmarks/ndsm-container-arch-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import spec from './landmarks/ndsm-container-arch-spec.json';
const geometries:T.BufferGeometry[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);g.userData.palette=c;geometries.push(g)};
const unused=()=>{throw Error('Unexpected primitive')};
const b:BuildingTools={add,box:unused,prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused};
buildNdsmContainerArch(18.452,6.48,b);
const material=new T.MeshBasicMaterial({side:T.DoubleSide}),meshes=geometries.map(g=>new T.Mesh(g,material)),bounds=new T.Box3();let triangles=0;
for(const g of geometries){for(const n of g.getAttribute('position').array)assert(Number.isFinite(n));g.computeBoundingBox();bounds.union(g.boundingBox!);triangles+=(g.index?.count??g.getAttribute('position').count)/3;}
const cast=(p:T.Vector3,d:T.Vector3)=>new T.Raycaster(p,d).intersectObjects(meshes);
assert.equal(geometries.filter(g=>g.userData.role==='container-volume').length,9);
assert(bounds.min.y>=-.08&&bounds.min.y<=0,'base contacts pavement');
assert(bounds.max.y>10&&bounds.max.y<11.3,'frontal photo height ratio respected');
assert(bounds.max.x-bounds.min.x>18.4&&bounds.max.x-bounds.min.x<18.7,'mapped span respected without model scaling');
assert(bounds.max.z-bounds.min.z>6.48&&bounds.max.z-bounds.min.z<6.7);
assert(triangles<40000);
// Actual traversable centre: horizontal sightlines across both sides at rider heights.
for(const x of[-5,-2,0,2,5])for(const y of[.3,1.6,2.8,4])for(const side of[-1,1])assert.equal(cast(new T.Vector3(x,y,side*7),new T.Vector3(0,0,-side)).length,0,`passage remains open x${x}/y${y}`);
// Crown is a true deep container, with exposed principal and reverse face details.
for(const side of[-1,1]){const hits=cast(new T.Vector3(.4,9.15,side*7),new T.Vector3(0,0,-side));assert(hits.length>0);assert(Math.abs(hits[0].point.z)>3.24,'first painted detail clears parent box');}
// Wedge probes test empty space between real rotated boxes/metal members, not constants.
const volumeMeshes=meshes.filter(m=>m.geometry.userData.role==='container-volume');let openJointSamples=0;
for(let i=0;i<8;i++){const a=(i+.5)*Math.PI/8;let clear=0;for(const r of[7.3,7.8,8.3,8.8,9.1]){const p=new T.Vector3(r*Math.cos(a),1.22+r*Math.sin(a),7);const d=new T.Vector3(0,0,-1);assert.equal(new T.Raycaster(p,d).intersectObjects(volumeMeshes).length,0,'no opaque wedge infill');if(cast(p,d).length===0)clear++;}assert(clear>=2,`joint${i} keeps visibly open gaps around narrow braces`);openJointSamples+=clear;}
assert.equal(geometries.filter(g=>g.userData.role==='wedge-spacer').length,32);
// Repair the source-recognition failure: upper broad surfaces are plain turquoise,
// with no invented magenta motif repeated from supported lower panels.
for(const i of[2,3,4,5,6])assert.equal(geometries.filter(g=>g.userData.container===i&&['artwork-ribbon-outer','base-closed-loop','artwork-accent','artwork-loop'].includes(g.userData.role)).length,0,'source-photo upper panel stays plain');
for(const i of[0,8])assert(geometries.some(g=>g.userData.container===i&&g.userData.role==='base-closed-loop'),'supported lowest broad panel retains closed magenta loop');
for(const i of[1,7])assert(geometries.some(g=>g.userData.container===i&&g.userData.role==='artwork-loop'),'bounded lower figure panel survives');
// Outer turquoise panels and artwork remain physically visible on the long sides.
for(const i of[0,1,4,7,8]){const a=i*Math.PI/8,p=new T.Vector3((8.006+3)*Math.cos(a),1.22+(8.006+3)*Math.sin(a),.37),d=new T.Vector3(-Math.cos(a),-Math.sin(a),0);const first=cast(p,d)[0];assert(first);assert(['blue','pink','gold','ochre','frame'].includes(first.object.geometry.userData.palette));const radius=Math.hypot(first.point.x,first.point.y-1.22);assert(radius>9.23,'long painted panel is outside the dark parent box');}
assert.equal(spec.spatialSuppression,false);assert.deepEqual(spec.suppressOsmIds,['w1304785589']);assert(!spec.suppressOsmIds.includes('w44824309'));assert(!spec.suppressOsmIds.includes('w717827611'));
console.log(JSON.stringify({id:spec.id,triangles,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},containers:9,openJointSamples,openPassage:true,sourceCommit:'6921162',acceptance:'geometry only; root gallery/game review pending'}));
for(const g of geometries)g.dispose();material.dispose();
