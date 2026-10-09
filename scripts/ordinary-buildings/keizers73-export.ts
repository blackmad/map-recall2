import fs from 'node:fs/promises';import * as T from 'three';import type{BuildingTools}from '../landmarks/cultural-builders';import{exportOrdinaryGeometry}from './export-ordinary-geometry';import{buildKeizers73,probes}from './keizers73-builder';import spec from './keizers73-spec.json';
export const palette={brick:'#695049',stone:'#b9b9ad',relief:'#aaa99c',white:'#e7e8df',glass:'#425962',roof:'#626769',iron:'#303634',dark:'#39332b'};
const parts:{g:T.BufferGeometry;c:string}[]=[],tools={add(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0){g.rotateY(a);g.translate(x,y,z);parts.push({g,c});}}as BuildingTools;buildKeizers73(0,0,tools);const result=await exportOrdinaryGeometry({id:spec.id,parts,palette,suppress:spec.suppress,meshopt:true});const out=process.env.ORDINARY_OUTPUT_ROOT??'artifacts/ordinary-buildings/keizers73';await fs.mkdir(out,{recursive:true});await fs.writeFile(out+'/0363100012169218.glb',result.bytes);await fs.writeFile(out+'/export-report.json',JSON.stringify({...result.report,sourceCommit:spec.sourceCommit,probes:probes.length,unresolvedRoofCoverage:spec.unresolvedRoofCoverage},null,2)+'\n');await fs.writeFile(out+'/probes.json',JSON.stringify(probes,null,2)+'\n');console.log(JSON.stringify(result.report));

// Refresh only an existing exact registration; generation never admits a draft.
const cataloguePath=(process.env.ORDINARY_DATA_ROOT??'public/canal-drive/ordinary-buildings-data')+'/catalogue.json';
try {
 const catalogue=JSON.parse(await fs.readFile(cataloguePath,'utf8'));
 const entry=catalogue.models.find((m:any)=>m.buildingId===spec.id);
 if(entry){
  if(entry.id!==`ordinary-${spec.digits}`)throw Error('Exact ordinary registration required');
  const changed=entry.hash!==result.report.sha256;
  Object.assign(entry,{hash:result.report.sha256,sha256:result.report.sha256,bytes:result.report.bytes,triangles:result.report.triangles,materials:result.report.materials,textures:0,bounds:result.report.bounds,height:result.report.bounds.max[1]});
  if(changed)entry.reviewState='Regenerated asset; source/gallery/native-game/performance acceptance required.';
  await fs.writeFile(cataloguePath,JSON.stringify(catalogue,null,2)+'\n');
 }
}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
