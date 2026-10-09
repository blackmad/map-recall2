import crypto from 'node:crypto';
import * as T from 'three';
import {Document, NodeIO} from '@gltf-transform/core';
import {dedup, prune, weld} from '@gltf-transform/functions';
import {ALL_EXTENSIONS, EXTMeshoptCompression} from '@gltf-transform/extensions';
import {MeshoptEncoder,MeshoptDecoder} from 'meshoptimizer';

export interface OrdinaryGeometryPart {g:T.BufferGeometry;c:string}
export interface OrdinaryMaterialGroup {name:string;colours?:string[];roughness:number}
export interface OrdinaryExportOptions {
 id:string;
 parts:OrdinaryGeometryPart[];
 palette:Record<string,string>;
 suppress:string[];
 groups?:OrdinaryMaterialGroup[];
 /** Existing runtime supports meshopt; opt-in preserves prior asset bytes. */
 meshopt?:boolean;
}
/** Shared original flat-colour export only. Callers own researched geometry,
 * source provenance, registration and actual visual/game acceptance. */
export async function exportOrdinaryGeometry(options:OrdinaryExportOptions){
 const {id,parts,palette,suppress}=options;
 if(!/^NL\.IMBAG\.Pand\.\d{16}$/.test(id)||!suppress.includes(id))throw Error('Exact native identity and suppression required');
 const name=id.split('.').at(-1)!;
 const groups=options.groups??[
  {name:'masonry',colours:['brick'],roughness:.94},
  {name:'glass',colours:['glass'],roughness:.45},
  {name:'physical',roughness:.95},
 ];
 if(groups.length>3||new Set(groups.map(g=>g.name)).size!==groups.length)throw Error('At most three distinct material groups');
 const selected=new Set<string>();
 for(const group of groups)for(const colour of group.colours??[]){if(selected.has(colour))throw Error(`Repeated colour group ${colour}`);selected.add(colour);}
 if(groups.filter(g=>!g.colours).length>1)throw Error('Only one remaining-colours group allowed');
 const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene(name),mesh=doc.createMesh(name);
 doc.getRoot().setDefaultScene(scene);scene.addChild(doc.createNode(name).setMesh(mesh));
 const assigned=new Set<OrdinaryGeometryPart>();
 for(const group of groups){
  const positions:number[]=[],normals:number[]=[],colours:number[]=[];
  for(const part of parts){
   if(!(group.colours?group.colours.includes(part.c):!selected.has(part.c)))continue;
   if(!palette[part.c])throw Error(`Missing palette colour ${part.c}`);
   assigned.add(part);
   const flat=part.g.index?part.g.toNonIndexed():part.g,p=flat.getAttribute('position'),n=flat.getAttribute('normal');
   if(!p||!n||p.itemSize!==3||n.itemSize!==3||p.count!==n.count||p.count%3)throw Error('Complete triangle positions and normals required');
   const rgb=new T.Color(palette[part.c]);
   for(let i=0;i<p.count;i++){
    const xyz=[p.getX(i),p.getY(i),p.getZ(i)],normal=[n.getX(i),n.getY(i),n.getZ(i)];
    if(!xyz.every(Number.isFinite)||!normal.every(Number.isFinite))throw Error('Non-finite original geometry');
    positions.push(...xyz);normals.push(...normal);colours.push(...rgb.toArray());
   }
  }
  if(!positions.length)continue;
  const material=doc.createMaterial(group.name).setBaseColorFactor([1,1,1,1]).setMetallicFactor(0).setRoughnessFactor(group.roughness).setDoubleSided(false);
  const attribute=(values:number[])=>doc.createAccessor().setType('VEC3').setArray(new Float32Array(values)).setBuffer(buffer);
  mesh.addPrimitive(doc.createPrimitive().setMaterial(material).setAttribute('POSITION',attribute(positions)).setAttribute('NORMAL',attribute(normals)).setAttribute('COLOR_0',attribute(colours)));
 }
 if(!parts.length||assigned.size!==new Set(parts).size)throw Error('Every original geometry part must belong to a material group');
 await doc.transform(weld(),dedup(),prune());
 const io=new NodeIO();
 if(options.meshopt){await MeshoptEncoder.ready;doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({method:EXTMeshoptCompression.EncoderMethod.QUANTIZE});io.registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder});}
 const bytes=await io.writeBinary(doc),sha256=crypto.createHash('sha256').update(bytes).digest('hex');
 if(bytes.length>=500000||doc.getRoot().listMaterials().length>3)throw Error(`Strict ordinary geometry budget: ${bytes.length} bytes`);
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];let triangles=0;
 for(const primitive of mesh.listPrimitives()){
  const position=primitive.getAttribute('POSITION')!;
  triangles+=(primitive.getIndices()?.getCount()??position.getCount())/3;
  for(let i=0;i<position.getCount();i++)for(let j=0;j<3;j++){const value=position.getArray()![i*3+j];min[j]=Math.min(min[j],value);max[j]=Math.max(max[j],value);}
 }
 return {bytes,report:{id,bytes:bytes.length,sha256,materials:doc.getRoot().listMaterials().length,textures:doc.getRoot().listTextures().length,triangles,bounds:{min,max},scale:1,suppress,scope:'Draft asset only. Independent/gallery/live/performance acceptance pending.'}};
}
