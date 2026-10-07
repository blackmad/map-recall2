import assert from 'node:assert/strict';import * as T from 'three';
import {buildNesRozentheaterLandmark} from './landmarks/nes-rozentheater-builders';import type {BuildingTools} from './landmarks/cultural-builders';
import fs from 'node:fs';import {Document,NodeIO} from '@gltf-transform/core';
const palette={brick:'#9a5240',stone:'#cfc2a6',slate:'#4a525d',white:'#efe9db',gold:'#d9b24c',glass:'#527787',dark:'#303b43',frame:'#9daaa8',red:'#ac624e'};
const group=new T.Group(),gs:T.BufferGeometry[]=[];
const add=(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);g.userData.palette=c;g.computeBoundingBox();gs.push(g);const material=new T.MeshBasicMaterial({color:palette[c as keyof typeof palette],side:T.DoubleSide});group.add(new T.Mesh(g,material));};
const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:string,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
buildNesRozentheaterLandmark('boom-chicago',0,0,{add,box} as BuildingTools);group.updateMatrixWorld(true);
let triangles=0;for(const g of gs){triangles+=(g.index?.count??g.getAttribute('position').count)/3;for(const v of g.getAttribute('position').array)assert(Number.isFinite(v));}
assert(triangles<40000);
const roofs=gs.filter(g=>['boom-foyer-barrel','boom-tower-hip'].includes(g.userData.role));for(const g of roofs){const n=g.getAttribute('normal');for(let i=0;i<n.count;i++)assert(n.getY(i)>0,`front roof upward normals ${g.userData.role} ${n.getY(i)}`);assert(g.boundingBox!.min.z>=18.49,'short front roof, not an invented10m barrel');assert(g.boundingBox!.max.y<=12.56);}
const ray=(x:number,y:number,z:number,d:T.Vector3)=>new T.Raycaster(new T.Vector3(x,y,z),d).intersectObjects(group.children);
assert(ray(-7,20,-15,new T.Vector3(0,-1,0))[0].point.y<3.3,'low rear annex preserved');
assert(ray(1.4,20,0,new T.Vector3(0,-1,0))[0].point.y>14,'current long hall ridge preserved');
const panes=group.children.filter(m=>(m as T.Mesh).geometry.userData.role==='boom-stained-pane');assert.equal(panes.length,6);
for(const mesh of panes){const p=(mesh as T.Mesh).geometry.boundingBox!,center=p.getCenter(new T.Vector3());for(const f of[-.4,0,.4]){const eye=center.clone();eye.x+=f;eye.z+=.8;const first=ray(eye.x,eye.y,eye.z,new T.Vector3(0,0,-1))[0];assert.equal((first.object as T.Mesh).geometry.userData.role,'boom-stained-pane','pane visible across actual face');}}
for(const g of gs.filter(g=>g.userData.role==='boom-real-sign')){const b=g.boundingBox!;assert(b.min.y>=4.04&&b.max.y<=4.59);assert((b.max.x<1.085&&b.min.x>-1.465)||(b.min.x>3.6&&b.max.x<6.4),'sign fits its separate physical panel');}
if(process.argv.includes('--export')){const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene();for(const mesh of group.children as T.Mesh[]){const g=mesh.geometry,positions=g.getAttribute('position'),idx=g.index,mat=doc.createMaterial().setBaseColorFactor([...(mesh.material as T.MeshBasicMaterial).color.toArray(),1]);const p=doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(new Float32Array(positions.array)).setBuffer(buffer)).setMaterial(mat);if(idx)p.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx.array)).setBuffer(buffer));scene.addChild(doc.createNode().setMesh(doc.createMesh().addPrimitive(p)));}fs.mkdirSync('artifacts/landmarks/boom-chicago/draft',{recursive:true});await new NodeIO().write('artifacts/landmarks/boom-chicago/draft/boom-chicago.glb',doc);}
console.log(JSON.stringify({id:'boom-chicago',triangles,panes:panes.length,checks:['upward short barrel/hip roofs','low annex','current hall ridge','six exposed panes','separate vector sign envelopes'],acceptance:'CPU only; native game/root review pending'}));
