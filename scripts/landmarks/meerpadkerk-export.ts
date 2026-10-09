import fs from 'node:fs';import * as T from 'three';
import {Document,NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';import {weld,dedup,prune,meshopt} from '@gltf-transform/functions';import {MeshoptEncoder} from 'meshoptimizer';
import type {BuildingTools} from './cultural-builders';import {buildMeerpadkerk} from './meerpadkerk-builder';import spec from './meerpadkerk-spec.json';
export function collectMeerpadkerk(){
 const parts:{g:T.BufferGeometry,c:string}[]=[];const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);parts.push({g,c});};const box:BuildingTools['box']=(x,y,z,w,h,d,c,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
 const probes=buildMeerpadkerk(1,1,{add,box} as BuildingTools);return {parts,probes};
}
if(import.meta.url===`file://${process.argv[1]}`){
 await MeshoptEncoder.ready;const {parts}=collectMeerpadkerk();const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('meerpadkerk'),mesh=doc.createMesh('meerpadkerk');doc.getRoot().setDefaultScene(scene);
 const colours={white:'#eeeade',dark:'#253731',glass:'#839390',frame:'#b7b4a5',slate:'#645e55',concrete:'#9b9e94'};
 for(const c of new Set(parts.map(p=>p.c))){const geos=parts.filter(p=>p.c===c).map(p=>p.g.index?p.g.toNonIndexed():p.g),rgb=new T.Color(colours[c as keyof typeof colours]);mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(Float32Array.from(geos.flatMap(g=>Array.from(g.getAttribute('position').array)))).setBuffer(buffer)).setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(Float32Array.from(geos.flatMap(g=>Array.from(g.getAttribute('normal').array)))).setBuffer(buffer)).setMaterial(doc.createMaterial(c).setBaseColorFactor([rgb.r,rgb.g,rgb.b,1]).setRoughnessFactor(.9).setMetallicFactor(0).setDoubleSided(true)));}
 scene.addChild(doc.createNode('meerpadkerk').setMesh(mesh));await doc.transform(weld(),dedup(),prune(),meshopt({encoder:MeshoptEncoder,level:'medium'}));fs.mkdirSync('artifacts/meerpadkerk-draft',{recursive:true});await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder}).write('artifacts/meerpadkerk-draft/meerpadkerk.glb',doc);
 const triangles=doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((s,p)=>s+p.getIndices()!.getCount()/3,0),bytes=fs.statSync('artifacts/meerpadkerk-draft/meerpadkerk.glb').size;console.log(JSON.stringify({triangles,bytes,spec:spec.id}));if(triangles>=40000||bytes>=500000)throw Error('budget exceeded');
}
