import fs from 'node:fs/promises';import * as T from 'three';import type{BuildingTools}from '../landmarks/cultural-builders';import{exportOrdinaryGeometry}from './export-ordinary-geometry';import{buildKeizers575,probes}from './keizers575-builder';import spec from './keizers575-spec.json';
export const palette={brick:'#805d52',insetBrick:'#694c45',stone:'#bcb9a7',relief:'#aaa795',white:'#e9ece4',glass:'#4a626b',roof:'#656c70',slate:'#505962',iron:'#303b3a',dark:'#293331',copper:'#648578'};
const parts:{g:T.BufferGeometry;c:string}[]=[],tools={add(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0){g.rotateY(a);g.translate(x,y,z);parts.push({g,c});}}as BuildingTools;buildKeizers575(0,0,tools,!process.argv.includes('--support-baseline'),!process.argv.includes('--native-profile-baseline'));const result=await exportOrdinaryGeometry({id:spec.id,parts,palette,suppress:spec.suppress,meshopt:true});const out=process.env.ORDINARY_OUTPUT_ROOT??'artifacts/ordinary-buildings/keizers575';await fs.mkdir(out,{recursive:true});await fs.writeFile(out+'/0363100012176752.glb',result.bytes);await fs.writeFile(out+'/export-report.json',JSON.stringify({...result.report,probes:probes.length,sourceCommit:spec.sourceCommit,unresolvedRoofCoverage:spec.unresolvedRoofCoverage},null,2)+'\n');console.log(JSON.stringify(result.report));

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
