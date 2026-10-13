/** Isolated draft export: no shared catalogue/manifest mutations. */
import fs from 'node:fs';
import * as T from 'three';
import {Document,NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {weld,dedup,prune,meshopt} from '@gltf-transform/functions';
import {MeshoptEncoder} from 'meshoptimizer';
import {buildMountainNetwork} from './mountain-network-builder';
import type {BuildingTools} from './cultural-builders';
await MeshoptEncoder.ready;
const palette={stone:'#cfc2a6',slate:'#4a525d',white:'#efe9db',frame:'#9daaa8',concrete:'#d4d5d0',glass:'#7597a4'},parts:{g:T.BufferGeometry,c:string}[]=[];
const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);parts.push({g,c})};const unused=()=>{throw Error('unexpected primitive')};buildMountainNetwork(0,0,{add,box:(x,y,z,w,h,d,c)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z),prism:unused,gableRoof:unused,hip:unused,window:unused,clock:unused,sign:unused});
const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(),mesh=doc.createMesh('mountain-network');doc.getRoot().setDefaultScene(scene);
for(const[c,hex]of Object.entries(palette)){const geometries=parts.filter(p=>p.c===c).map(p=>p.g.index?p.g.toNonIndexed():p.g);if(!geometries.length)continue;const positions=Float32Array.from(geometries.flatMap(g=>Array.from(g.getAttribute('position').array))),normals=Float32Array.from(geometries.flatMap(g=>Array.from(g.getAttribute('normal').array))),rgb=new T.Color(hex);mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer)).setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer)).setMaterial(doc.createMaterial(c).setBaseColorFactor([rgb.r,rgb.g,rgb.b,1]).setRoughnessFactor(.9).setMetallicFactor(0).setDoubleSided(true)))}
scene.addChild(doc.createNode('mountain-network').setMesh(mesh));await doc.transform(weld(),dedup(),prune(),meshopt({encoder:MeshoptEncoder,level:'medium'}));fs.mkdirSync('artifacts/landmark-next-batch',{recursive:true});const path='artifacts/landmark-next-batch/mountain-network.glb';await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder}).write(path,doc);console.log({path,bytes:fs.statSync(path).size});
