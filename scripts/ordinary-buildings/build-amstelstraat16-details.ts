import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import * as T from 'three';
import {Document,NodeIO} from '@gltf-transform/core';
import {weld,prune,dedup} from '@gltf-transform/functions';
import type {BuildingTools} from '../landmarks/cultural-builders';
import {buildAmstelstraat16,openingProbes} from './amstelstraat16-builder';
import spec from './amstelstraat16-spec.json';
const dataRoot=process.env.ORDINARY_DATA_ROOT??'public/canal-drive/ordinary-buildings-data';
export const outputRoot=process.env.ORDINARY_OUTPUT_ROOT??'public/canal-drive/models/ordinary-buildings';
const reportRoot=process.env.ORDINARY_REPORT_ROOT??'artifacts/ordinary-buildings/amstelstraat16';
const catalogue=JSON.parse(await fs.readFile(`${dataRoot}/catalogue.json`,'utf8'));
const recipe=JSON.parse(await fs.readFile(`${dataRoot}/recipes.json`,'utf8')).recipes.find((r:{id:string})=>r.id===spec.id);
const entry=catalogue.models.find((m:{buildingId:string})=>m.buildingId===spec.id);
if(!recipe||!entry||recipe.digits!==spec.digits||entry.id!==`ordinary-${spec.digits}`)throw Error('Exact Amstel identity guard');
if(entry.hash==='40103a485cf91a26ac92811831e439ee7f0c9c01b97d0763e171e12a0f62954f')throw Error('Regenerate base before applying Amstel stage twice');
await fs.mkdir(reportRoot,{recursive:true});
export const palette={brick:'#805049',slate:'#525a60',concrete:'#a5afb4',white:'#dbe4df',glass:'#547b87',frame:'#485b60',dark:'#3b4345'};
await fs.mkdir(outputRoot,{recursive:true});
const parts:{g:T.BufferGeometry;c:string}[]=[];
const tools={add(g:T.BufferGeometry,c:string,x=0,y=0,z=0,angle=0){g.rotateY(angle);g.translate(x,y,z);parts.push({g,c});}} as BuildingTools;
buildAmstelstraat16(0,0,tools);
const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(spec.digits),mesh=doc.createMesh(spec.digits);doc.getRoot().setDefaultScene(scene);scene.addChild(doc.createNode(spec.digits).setMesh(mesh));
// Existing ordinary conventions: exact indexed opaque triangles with vertex
// colors for physical assemblies. Three materials, no atlas/photo textures.
for(const [group,filter] of [['masonry',(c:string)=>c==='brick'],['glass',(c:string)=>c==='glass'],['physical',(c:string)=>!['brick','glass'].includes(c)]] as const){
 const positions:number[]=[],normals:number[]=[],colors:number[]=[];
 for(const part of parts.filter(p=>filter(p.c))){const flat=part.g.index?part.g.toNonIndexed():part.g,p=flat.getAttribute('position'),n=flat.getAttribute('normal'),rgb=new T.Color(palette[part.c as keyof typeof palette]);positions.push(...p.array);normals.push(...n.array);for(let i=0;i<p.count;i++)colors.push(...rgb.toArray());}
 const m=doc.createMaterial(group).setBaseColorFactor([1,1,1,1]).setMetallicFactor(0).setRoughnessFactor(group==='glass'?.45:group==='masonry'?.94:.95).setDoubleSided(false);
 const accessor=(array:Float32Array)=>doc.createAccessor().setType('VEC3').setArray(array).setBuffer(buffer);
 mesh.addPrimitive(doc.createPrimitive().setMaterial(m).setAttribute('POSITION',accessor(new Float32Array(positions))).setAttribute('NORMAL',accessor(new Float32Array(normals))).setAttribute('COLOR_0',accessor(new Float32Array(colors))));
}
await doc.transform(weld(),dedup(),prune());
const bytes=await new NodeIO().writeBinary(doc),hash=crypto.createHash('sha256').update(bytes).digest('hex');
if(bytes.length>=500000||doc.getRoot().listMaterials().length>3)throw Error('Strict ordinary model budget');
await fs.writeFile(`${outputRoot}/${spec.digits}.glb`,bytes);
await fs.writeFile(`${reportRoot}/opening-probes.json`,JSON.stringify(openingProbes,null,2)+'\n');
const all:number[]=mesh.listPrimitives().flatMap(p=>Array.from(p.getAttribute('POSITION')!.getArray()! as Float32Array)),bounds={min:[0,1,2].map(j=>Math.min(...all.filter((_v,i)=>i%3===j))),max:[0,1,2].map(j=>Math.max(...all.filter((_v,i)=>i%3===j)))};
const report={id:spec.id,bytes:bytes.length,sha256:hash,materials:doc.getRoot().listMaterials().length,textures:doc.getRoot().listTextures().length,triangles:mesh.listPrimitives().reduce((s,p)=>s+(p.getIndices()?.getCount()??p.getAttribute('POSITION')!.getCount())/3,0),bounds,scale:1,suppress:spec.suppress,scope:'Draft asset only. Independent/gallery/live/performance acceptance pending.'};
await fs.writeFile(`${reportRoot}/export.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));

Object.assign(entry,{hash,bytes:bytes.length,triangles:report.triangles,materials:report.materials,bounds,height:bounds.max[1],sourceCommit:recipe.sourceCommit});
await fs.writeFile(`${dataRoot}/catalogue.json`,JSON.stringify(catalogue,null,2)+'\n');
