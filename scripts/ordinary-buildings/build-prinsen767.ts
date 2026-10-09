import fs from 'node:fs/promises';
import * as T from 'three';
import type {BuildingTools} from '../landmarks/cultural-builders';
import {exportOrdinaryGeometry, type OrdinaryGeometryPart} from './export-ordinary-geometry';
import {buildPrinsen767,probes} from './prinsen767-builder';
import spec from './prinsen767-spec.json';
const parts:OrdinaryGeometryPart[]=[];
buildPrinsen767(0,0,{add(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0){g.rotateY(a);g.translate(x,y,z);parts.push({g,c});}} as BuildingTools);
const palette={brick:'#8a5c42',stone:'#ded2b9',white:'#deded5',glass:'#657b7a',frame:'#34413c',iron:'#39433d',joint:'#9a9281',roof:'#64686a',slate:'#535755',awning:'#9a3831',gold:'#8d783b',streetTile:'#756457',redTile:'#8b4d3d',whiteRoof:'#9d9b8d',centralRoof:'#797169',court:'#9b9a8c',solar:'#4b5a66'};
const result=await exportOrdinaryGeometry({id:spec.id,parts,palette,suppress:spec.suppress,meshopt:true});
const out=process.env.ORDINARY_OUTPUT_ROOT??'artifacts/ordinary-buildings/prinsen767';await fs.mkdir(out,{recursive:true});
await fs.writeFile(`${out}/${spec.digits}.glb`,result.bytes);
await fs.writeFile(`${out}/export.json`,JSON.stringify({...result.report,sourceCommit:spec.sourceCommit,sourcePack:spec.sourcePack,unresolvedRoofCoverage:spec.unresolvedRoofCoverage,acceptance:'Author draft: roof-material/lettering/independent/gallery/live/performance checks pending'},null,2)+'\n');
await fs.writeFile(`${out}/opening-probes.json`,JSON.stringify(probes,null,2)+'\n');
console.log(JSON.stringify(result.report));

// Refresh an existing exact registration after regeneration. A draft does not
// admit itself into the catalogue or carry old acceptance onto changed bytes.
const cataloguePath=(process.env.ORDINARY_DATA_ROOT??'public/canal-drive/ordinary-buildings-data')+'/catalogue.json';
try{const catalogue=JSON.parse(await fs.readFile(cataloguePath,'utf8')),entry=catalogue.models.find((m:any)=>m.buildingId===spec.id);
 if(entry){if(entry.id!==`ordinary-${spec.digits}`)throw Error('Exact ordinary registration required');const changed=entry.hash!==result.report.sha256;Object.assign(entry,{hash:result.report.sha256,sha256:result.report.sha256,bytes:result.report.bytes,triangles:result.report.triangles,materials:result.report.materials,textures:0,bounds:result.report.bounds,height:result.report.bounds.max[1],sourceCommit:spec.sourceCommit});if(changed)entry.reviewState='Regenerated asset; source/gallery/native-game/performance review required before acceptance.';await fs.writeFile(cataloguePath,JSON.stringify(catalogue,null,2)+'\n');}
}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
