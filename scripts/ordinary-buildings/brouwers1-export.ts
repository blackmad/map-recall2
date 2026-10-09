import fs from 'node:fs/promises';import * as T from 'three';import type {BuildingTools} from '../landmarks/cultural-builders';
import {exportOrdinaryGeometry,type OrdinaryGeometryPart} from './export-ordinary-geometry';
import {buildBrouwers1,probes,reports} from './brouwers1-builder';import spec from './brouwers1-spec.json';
const parts:OrdinaryGeometryPart[]=[];buildBrouwers1(0,0,{add(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0){g.rotateY(a);g.translate(x,y,z);parts.push({g,c});}} as BuildingTools);
const palette={brick:'#4c403b',warehouseBrick:'#97725a',white:'#e0ded2',stone:'#a59f8e',glass:'#45616a',frame:'#343b37',door:'#28312e',iron:'#313330',roof:'#62625c',tile:'#686a65',chamber:'#435650',reveal:'#b2b3a9',joint:'#888377'};
const result=await exportOrdinaryGeometry({id:spec.id,parts,palette,suppress:spec.suppress,meshopt:true});const out=process.env.ORDINARY_OUTPUT_ROOT??'artifacts/ordinary-buildings/brouwers1';await fs.mkdir(out,{recursive:true});await fs.writeFile(`${out}/${spec.digits}.glb`,result.bytes);await fs.writeFile(`${out}/export.json`,JSON.stringify({...result.report,sourceCommit:spec.sourceCommit,sourcePack:spec.sourcePack,coverage:spec.coverage,unresolvedRoofCoverage:spec.unresolvedRoofCoverage,acceptance:'Author draft; no visual/game acceptance'},null,2)+'\n');await fs.writeFile(`${out}/opening-probes.json`,JSON.stringify(probes,null,2));await fs.writeFile(`${out}/native-envelope.json`,JSON.stringify(reports,null,2));console.log(JSON.stringify(result.report));

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
