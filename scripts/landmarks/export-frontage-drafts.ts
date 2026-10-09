/** Source-backed draft export for review before touching runtime manifests. */
import fs from 'node:fs';
import * as T from 'three';
import {Document,NodeIO} from '@gltf-transform/core';
import {KHRMaterialsUnlit} from '@gltf-transform/extensions';
import {weld,dedup,prune} from '@gltf-transform/functions';
import {buildKesbeke,buildKesbekeShop} from './kesbeke-builder';
import {buildWillemDeZwijgerFrontage} from './willem-de-zwijger-frontage-builder';
import type {BuildingTools} from './cultural-builders';
const palette={brick:'#9a5240',stone:'#cfc2a6',slate:'#4a525d',white:'#efe9db',gold:'#f4c400',glass:'#527787',dark:'#303b43',frame:'#9daaa8',red:'#ac624e',blue:'#3f5f9a',pink:'#be9295',bronze:'#3d5148',copper:'#43888b',green:'#718b58',ochre:'#9f825c',concrete:'#d4d5d0',greyBrick:'#7d7871'};
const output='artifacts/frontage-landmark-drafts';fs.mkdirSync(output,{recursive:true});
for(const [id,builder] of [['kesbeke',buildKesbeke],['kesbeke-shop',buildKesbekeShop],['beest-boulders',buildWillemDeZwijgerFrontage]] as const){
 const parts:{g:T.BufferGeometry;hex:string;unlit:boolean}[]=[];
 const add=(g:T.BufferGeometry,c:keyof typeof palette,x=0,y=0,z=0,angle=0)=>{g.rotateY(angle);g.translate(x,y,z);parts.push({g,hex:(id.startsWith('kesbeke')&&c==='brick'?'#8a7159':palette[c]),unlit:c==='gold'});};
 const decal=(g:T.BufferGeometry,hex:string)=>parts.push({g,hex,unlit:true});
 builder(1,1,{add} as BuildingTools,decal);
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(id),mesh=doc.createMesh(id),unlit=doc.createExtension(KHRMaterialsUnlit);doc.getRoot().setDefaultScene(scene);
 for(const key of new Set(parts.map(p=>`${p.hex}|${p.unlit}`))){
  const selected=parts.filter(p=>`${p.hex}|${p.unlit}`===key),geos=selected.map(p=>p.g.index?p.g.toNonIndexed():p.g),rgb=new T.Color(selected[0].hex);
  const material=doc.createMaterial(key).setBaseColorFactor([rgb.r,rgb.g,rgb.b,1]).setRoughnessFactor(.9).setMetallicFactor(0).setDoubleSided(true);
  if(selected[0].unlit)material.setExtension('KHR_materials_unlit',unlit.createUnlit());
  mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(Float32Array.from(geos.flatMap(g=>Array.from(g.getAttribute('position').array)))).setBuffer(buffer)).setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(Float32Array.from(geos.flatMap(g=>Array.from(g.getAttribute('normal').array)))).setBuffer(buffer)).setMaterial(material));
 }
 scene.addChild(doc.createNode(id).setMesh(mesh));await doc.transform(weld(),dedup(),prune());await new NodeIO().registerExtensions([KHRMaterialsUnlit]).write(`${output}/${id}.glb`,doc);
 console.log(JSON.stringify({id,bytes:fs.statSync(`${output}/${id}.glb`).size,triangles:doc.getRoot().listMeshes().flatMap(m=>m.listPrimitives()).reduce((s,p)=>s+p.getIndices()!.getCount()/3,0),scope:'Draft native-scale model only; gallery/game acceptance pending'}));
}
