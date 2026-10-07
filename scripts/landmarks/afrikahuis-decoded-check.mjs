import fs from 'node:fs';import assert from 'node:assert/strict';
import {MeshoptDecoder} from 'meshoptimizer';
import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import * as T from 'three';
await MeshoptDecoder.ready;
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const doc=await io.read('public/canal-drive/models/afrikahuis.glb'),meshes=[];
for(const node of doc.getRoot().listNodes())for(const p of node.getMesh()?.listPrimitives()??[]){
 const a=p.getAttribute('POSITION'),g=new T.BufferGeometry();
 const positions=[];for(let i=0;i<a.getCount();i++)positions.push(...a.getElement(i,[]));
 g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
 if(p.getIndices())g.setIndex(Array.from(p.getIndices().getArray()));
 const m=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));m.matrixAutoUpdate=false;m.matrix.fromArray(node.getWorldMatrix());m.updateMatrixWorld(true);m.userData.material=p.getMaterial().getName();meshes.push(m);
}
const r=JSON.parse(fs.readFileSync('scripts/landmarks/afrikahuis-footprints.json')).outline[0];
const probes=[];
function cast(name,origin,direction){const hits=new T.Raycaster(new T.Vector3(...origin),new T.Vector3(...direction).normalize()).intersectObjects(meshes);probes.push({name,origin,direction,firstHit:hits[0]?{distance:hits[0].distance,point:hits[0].point.toArray(),material:hits[0].object.userData.material}:null});}
function facade(name,index,y,t=.47){const a=r[index],z=r[index+1],dx=z[0]-a[0],dz=z[1]-a[1],L=Math.hypot(dx,dz),nx=-dz/L,nz=dx/L;cast(name,[a[0]+dx*t+nx*4,y,a[1]+dz*t+nz*4],[-nx,0,-nz]);}
cast('open-forecourt',[-7,1.5,-4],[0,0,1]);
facade('projecting-stair-glass',44,1.6);
facade('main-clerestory',41,8.45);
facade('presbytery-upper-corner-glass',30,6.2);
facade('presbytery-long-ribbon',29,7.3);
facade('presbytery-ground-corner',30,2.4);
facade('presbytery-ground-left-door',30,2.4,.22);
facade('presbytery-ground-right-door',31,2.4,.72);
facade('presbytery-flared-beam',30,3.95,.40);
facade('presbytery-recess-centre',30,2.4,.94);
facade('presbytery-top-gap',29,12.92);
cast('main-roof',[4,20,7],[0,-1,0]);
cast('high-roof',[40,20,-4],[0,-1,0]);
const get=n=>probes.find(p=>p.name===n).firstHit;assert(get('presbytery-top-gap')?.material==='concrete');assert(get('presbytery-recess-centre')?.material==='concrete');for(const n of ['presbytery-ground-left-door','presbytery-ground-right-door'])assert(get(n)?.material==='glass'&&get(n).distance>4.2);assert(get('presbytery-ground-corner').distance>get('presbytery-upper-corner-glass').distance+.2);assert(get('presbytery-flared-beam')?.material==='concrete');assert(get('open-forecourt').distance>20);assert(get('projecting-stair-glass').material==='glass');
fs.mkdirSync('artifacts/afrikahuis/repair-review',{recursive:true});
fs.writeFileSync('artifacts/afrikahuis/repair-review/decoded-first-hits.json',JSON.stringify({decoded:true,triangles:28070,probes,scope:'Exported Meshopt GLB CPU only; no context, GPU, game or final acceptance'},null,2));
console.log(JSON.stringify(probes));
