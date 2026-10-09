import fs from 'node:fs/promises';
import * as T from 'three';
import type {BuildingTools} from '../landmarks/cultural-builders';
import {exportOrdinaryGeometry,type OrdinaryGeometryPart} from './export-ordinary-geometry';
import {buildLeids67,probes} from './leids67-builder';
import spec from './leids67-spec.json';
export function collect(){const parts:OrdinaryGeometryPart[]=[];buildLeids67(0,0,{add(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0){g.rotateY(a);g.translate(x,y,z);parts.push({g,c});}} as BuildingTools);return parts;}
export const palette={brick:'#654b3d',roof:'#666560',white:'#e3e5df',stone:'#d4d6ce',glass:'#627c85',dark:'#303b3e',grey:'#839393'};
if(process.argv[1]?.endsWith('leids67-export.ts')){const parts=collect(),result=await exportOrdinaryGeometry({id:spec.id,parts,palette,suppress:spec.suppress,meshopt:true});const out=process.env.ORDINARY_OUTPUT_ROOT??'artifacts/ordinary-buildings/leids67';await fs.mkdir(out,{recursive:true});await fs.writeFile(`${out}/${spec.digits}.glb`,result.bytes);await fs.writeFile(`${out}/export.json`,JSON.stringify({...result.report,sourceCommit:spec.sourceCommit,sourcePack:spec.sourcePack,limitations:spec.limitations},null,2)+'\n');await fs.writeFile(`${out}/opening-probes.json`,JSON.stringify(probes,null,2)+'\n');console.log(result.report);
 // Refresh an exact existing registration; exporting never admits a draft.
 const cataloguePath=(process.env.ORDINARY_DATA_ROOT??'public/canal-drive/ordinary-buildings-data')+'/catalogue.json';
 try{const catalogue=JSON.parse(await fs.readFile(cataloguePath,'utf8')),entry=catalogue.models.find((m:any)=>m.buildingId===spec.id);
  if(entry){if(entry.id!==`ordinary-${spec.digits}`)throw Error('Exact ordinary registration required');const changed=entry.hash!==result.report.sha256;Object.assign(entry,{hash:result.report.sha256,sha256:result.report.sha256,bytes:result.report.bytes,triangles:result.report.triangles,materials:result.report.materials,textures:0,bounds:result.report.bounds,height:result.report.bounds.max[1],sourceCommit:spec.sourceCommit});if(changed)entry.reviewState='Regenerated asset; source/gallery/native-game/performance review required before acceptance.';await fs.writeFile(cataloguePath,JSON.stringify(catalogue,null,2)+'\n');}
 }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
}
