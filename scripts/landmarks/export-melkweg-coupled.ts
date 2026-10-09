import * as T from 'three';
import fs from 'node:fs';
import {Document,NodeIO} from '@gltf-transform/core';
import {dedup,weld,prune,meshopt} from '@gltf-transform/functions';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';
import {buildMelkweg} from './melkweg-builder';
import {buildRabozaalCompanion} from './rabozaal-companion-builder';
import {buildIndustrialTheaterLandmark} from './industrial-theater-builders';
import {buildIndustrialTheaterCoupledLandmark} from './stadsschouwburg-coupled-builder';
import {legacyTools} from './melkweg-coupled-legacy-tools';
import industrialSpecs from './industrial-theater-specs.json';
import fontData from './melkweg-coupled-helvetiker-font.json';
import melk from './melkweg-spec.json';import rabo from './rabozaal-companion-spec.json';
import type {BuildingTools} from './cultural-builders';
await MeshoptEncoder.ready;await MeshoptDecoder.ready;
const theater=industrialSpecs.find(s=>s.id==='stadsschouwburg')!,palette={...melk.materialOverrides,brick:'#9a5240',stone:'#cfc2a6',slate:'#4a525d',glass:'#527787',frame:'#9daaa8',gold:'#d9b24c'};
const historic=(builder:typeof buildIndustrialTheaterLandmark)=>(_w:number,_d:number,b:BuildingTools)=>builder('stadsschouwburg',theater.footprint.lengthMetres,theater.footprint.widthMetres,b);
for(const [spec,build]of [[melk,buildMelkweg],[rabo,buildRabozaalCompanion],[{...theater,id:'stadsschouwburg-coupled',materialOverrides:palette},historic(buildIndustrialTheaterCoupledLandmark)],[{...theater,id:'stadsschouwburg-legacy-before',materialOverrides:palette},historic(buildIndustrialTheaterLandmark)]]as const){
 const doc=new Document(),buf=doc.createBuffer(),scene=doc.createScene(spec.id),mesh=doc.createMesh(spec.id);doc.getRoot().setDefaultScene(scene);const groups=new Map<string,T.BufferGeometry[]>();let triangles=0;
 const add:BuildingTools['add']=(g,c,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);triangles+=(g.index?.count??g.getAttribute('position').count)/3;const key=c+(g.userData.role==='explicit-roof'?'|roof':'');const list=groups.get(key)??[];list.push(g.index?g.toNonIndexed():g);groups.set(key,list)};const unused=()=>{throw Error('unused')};build(0,0,spec.id.startsWith('stadsschouwburg')?legacyTools(add):{add,box:unused,prism:unused,hip:unused,gableRoof:unused,window:unused,clock:unused,sign:unused});
 for(const[key,gs]of groups){const c=key.split('|')[0];const hex=spec.materialOverrides[c as keyof typeof spec.materialOverrides],color=new T.Color(hex),mat=doc.createMaterial(c).setBaseColorFactor([color.r,color.g,color.b,1]).setMetallicFactor(0).setRoughnessFactor(.9).setDoubleSided(true);mesh.addPrimitive(doc.createPrimitive().setExtras(key.endsWith('|roof')?{role:'explicit-roof'}:{}).setAttribute('POSITION',doc.createAccessor().setType('VEC3').setArray(Float32Array.from(gs.flatMap(g=>Array.from(g.getAttribute('position').array)))).setBuffer(buf)).setAttribute('NORMAL',doc.createAccessor().setType('VEC3').setArray(Float32Array.from(gs.flatMap(g=>Array.from(g.getAttribute('normal').array)))).setBuffer(buf)).setMaterial(mat));}
 if(spec.id==='stadsschouwburg-coupled')scene.setExtras({fontFamily:'Helvetiker, approximate current sign match',fontCopyright:fontData.original_font_information.copyright,fontLicenseNotice:fontData.original_font_information.license_description});
 scene.addChild(doc.createNode(spec.id).setMesh(mesh));await doc.transform(weld(),dedup(),prune(),meshopt({encoder:MeshoptEncoder,level:'medium'}));fs.mkdirSync('artifacts/landmark-next-batch',{recursive:true});const path=`artifacts/landmark-next-batch/${spec.id}.glb`;await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder}).write(path,doc);const bytes=fs.statSync(path).size;
 const decoded=await new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder}).read(path);if(decoded.getRoot().listMaterials().some(m=>m.getMetallicFactor()!==0))throw Error('Metal material');console.log({id:spec.id,triangles,bytes,metal:0});if(triangles>40000||bytes>500000)throw Error('budget exceeded');
}
