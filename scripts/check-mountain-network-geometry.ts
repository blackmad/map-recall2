import assert from 'node:assert/strict';
import * as T from 'three';
import {buildMountainNetwork} from './landmarks/mountain-network-builder';
import type {BuildingTools} from './landmarks/cultural-builders';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptDecoder} from 'meshoptimizer';
const meshes:T.Mesh[]=[];const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.userData.colour=c;meshes.push(mesh);};const no=()=>{throw Error('unexpected primitive')};buildMountainNetwork(0,0,{add,box:no,window:no,clock:no,sign:no,prism:no,gableRoof:no,hip:no});
let triangles=0;const bounds=new T.Box3();for(const m of meshes){const p=m.geometry.getAttribute('position');for(let i=0;i<p.count;i++)assert([p.getX(i),p.getY(i),p.getZ(i)].every(Number.isFinite));m.geometry.computeBoundingBox();bounds.union(m.geometry.boundingBox!);triangles+=(m.geometry.index?.count??p.count)/3;}
assert(bounds.max.y<45&&bounds.max.y>40);assert(bounds.max.z-bounds.min.z>200);assert(triangles<40000);
const glass=meshes.filter(m=>m.userData.colour==='glass');assert(glass.length>100);
// Source now requires two portals and a retained substantial central support.
for(const x of[-11,-4]){const ray=new T.Raycaster(new T.Vector3(x,3,-95),new T.Vector3(0,0,1),0,25);assert.equal(ray.intersectObjects(meshes).length,0,`Northern portal blocked at ${x}`);}
const pierRay=new T.Raycaster(new T.Vector3(-7,3,-95),new T.Vector3(0,0,1),0,25);assert(pierRay.intersectObjects(meshes).length>0,'Separating passage pier absent');

let panes=0;for(const m of glass){const p=m.geometry.getAttribute('position'),n=m.geometry.getAttribute('normal'),centre=new T.Vector3();for(let i=0;i<p.count;i++)centre.add(new T.Vector3(p.getX(i),p.getY(i),p.getZ(i)));centre.divideScalar(p.count);const normal=new T.Vector3(n.getX(0),n.getY(0),n.getZ(0)).normalize();for(const frac of [.2,.35,.65,.8]){const a=new T.Vector3(p.getX(0),p.getY(0),p.getZ(0)),b=new T.Vector3(p.getX(1),p.getY(1),p.getZ(1));const target=a.lerp(b,frac);target.y=centre.y;const r=new T.Raycaster(target.clone().addScaledVector(normal,.5),normal.clone().negate(),0,.55);const hit=r.intersectObjects(meshes)[0];assert(hit?.object===m,`Pane obscured at ${target.toArray()} fraction ${frac}: ${hit?.object.userData.colour}`);panes++;}}
console.log({triangles,panes,passage:'clear',bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}});

// Decode the installed/exported asset independently: upper-hall checks must
// fail for the old low ribbon, even though its own pane-centre probes pass.
const path=process.argv[2]??'public/canal-drive/models/mountain-network.glb';
await MeshoptDecoder.ready;
const doc=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(path);
const decoded:T.Mesh[]=[];
for(const node of doc.getRoot().listNodes())for(const primitive of node.getMesh()?.listPrimitives()??[]){
 const position=primitive.getAttribute('POSITION')!,g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(Array.from({length:position.getCount()},(_,i)=>position.getElement(i,[])).flat(),3));
 const indices=primitive.getIndices();if(indices)g.setIndex(Array.from(indices.getArray()!));
 g.applyMatrix4(new T.Matrix4().fromArray(node.getWorldMatrix()));g.computeVertexNormals();
 const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.name=primitive.getMaterial()!.getName();decoded.push(mesh);
}
function faceHit(a:T.Vector2,b:T.Vector2,fraction:number,y:number){const direction=b.clone().sub(a).normalize(),normal=new T.Vector2(-direction.y,direction.x),point=a.clone().lerp(b,fraction);return new T.Raycaster(new T.Vector3(point.x+normal.x*2,y,point.y+normal.y*2),new T.Vector3(-normal.x,0,-normal.y),0,2.6).intersectObjects(decoded)[0];}
let decodedHallPanes=0;
for(const[a,b]of[
 [new T.Vector2(3.971,-29.94),new T.Vector2(.153,-16.055)],
 [new T.Vector2(.153,-16.055),new T.Vector2(.153,-16.055).addScaledVector(new T.Vector2(-9.037,34.188).normalize(),6)],
])for(const fraction of[.04,.17,.32,.46,.58,.71,.83,.96])for(const y of[.7,4.4,7.8]){
 const hit=faceHit(a,b,fraction,y);assert.equal(hit?.object.name,'glass',`Decoded tall hall fraction${fraction} y${y}: ${hit?.object.name}`);decodedHallPanes++;
}
// The adjacent low hall must remain opaque at the upper pane heights.
for(const fraction of[.2,.5,.8]){const hit=faceHit(new T.Vector2(4.133,-38.11),new T.Vector2(2.282,-31.15),fraction,5.2);assert.equal(hit?.object.name,'stone','Low masonry hall was replaced by tall glass');}
// Source-derived broad low hall: upper masonry must not acquire apartment
// tiers below the8.83m housing soffit; projecting residential bands above
// that level remain separate assemblies. Lower frontage keeps exposed glazing.
// Sample both native
// segments independently of the builder's pane layout and across heights.
let decodedLowHallSamples=0;
for(const[a,b]of[
 [new T.Vector2(8.038,-52.797),new T.Vector2(4.133,-38.11)],
 [new T.Vector2(4.133,-38.11),new T.Vector2(2.282,-31.15)],
])for(const fraction of[.13,.29,.47,.63,.87]){
 for(const y of[3.9,7.0,8.0]){const hit=faceHit(a,b,fraction,y);assert.equal(hit?.object.name,'stone',`Low hall upper masonry fraction${fraction} y${y}: ${hit?.object.name}`);decodedLowHallSamples++;}
 const hit=faceHit(a,b,fraction,1.4);assert.equal(hit?.object.name,'glass',`Low hall ground glazing fraction${fraction}: ${hit?.object.name}`);decodedLowHallSamples++;
}
// Both mouths need reciprocal full-depth geometry rays at several heights.
// These remain geometry evidence; aligned source/gallery/game review is required.
let decodedPortalRays=0;
for(const x of[-12.7,-11,-8.7,-5.7,-4,-2.3])for(const y of[1,3,6])for(const sign of[-1,1]){
 const ray=new T.Raycaster(new T.Vector3(x,y,sign===1?-95:-60),new T.Vector3(0,0,sign),0,35);
 assert.equal(ray.intersectObjects(decoded).length,0,`Decoded full-depth portal blocked at x${x} y${y} direction${sign}`);decodedPortalRays++;
}
console.log({path,decodedHallPanes,decodedLowHallSamples,decodedPortalRays,scope:'Decoded geometry only; visual acceptance and aligned passage views pending'});
