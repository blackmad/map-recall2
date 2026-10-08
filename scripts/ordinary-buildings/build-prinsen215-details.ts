import fs from 'node:fs/promises';
import * as T from 'three';
import type {BuildingTools} from '../landmarks/cultural-builders';
import {exportOrdinaryGeometry} from './export-ordinary-geometry';
import {buildPrinsen215,openingProbes,openingInventory} from './prinsen215-builder';
import spec from './prinsen215-spec.json';
const root=process.env.ORDINARY_REPORT_ROOT??'artifacts/ordinary-buildings/prinsen215';
const output=process.env.ORDINARY_OUTPUT_ROOT??'public/canal-drive/models/ordinary-buildings';
await fs.mkdir(root,{recursive:true});await fs.mkdir(output,{recursive:true});
const parts:{g:T.BufferGeometry;c:string}[]=[],palette={brick:'#54463b',slate:'#515653',white:'#e1e1cc',glass:'#4e6970',frame:'#303c37',dark:'#28312c',red:'#a94e43',redDark:'#823e34',mailbox:'#aca58a'};
const tools={add(g:T.BufferGeometry,c:string,x=0,y=0,z=0,angle=0){g.rotateY(angle);g.translate(x,y,z);parts.push({g,c});}} as BuildingTools;
buildPrinsen215(0,0,tools);
const {bytes,report}=await exportOrdinaryGeometry({id:spec.id,parts,palette,suppress:spec.suppress});
await fs.writeFile(`${output}/${spec.digits}.glb`,bytes);
await fs.writeFile(`${root}/export.json`,JSON.stringify({...report,exportedAt:new Date().toISOString()},null,2)+'\n');
await fs.writeFile(`${root}/opening-probes.json`,JSON.stringify(openingProbes,null,2)+'\n');
await fs.writeFile(`${root}/critical-source-inventory.json`,JSON.stringify({...openingInventory,sources:['2025-01972 native edge0 fullfront','2024-00557 leaf-off fullfront','RCE4288+4289'],centralOpenRedShutterPairs:8,upperBlackGuardRails:16,ground215BlackOpenPlankShutters:2,ground215WhiteGlazedDoubleDoor:1,ground217BlackClosedDoubleDoors:1,ground217OuterRightArchedBlackEntry:1,thinPointedGables:2,hoists:2,highRearSurveyedRoofsPreserved:true,noNativeHolesOrNotches:true,scope:'Draft only; dimensions photo-guided. Source/browser/independent/live/performance gates pending.'},null,2)+'\n');
await fs.writeFile(`${root}/runtime-entry.json`,JSON.stringify({id:`ordinary-${spec.digits}`,buildingId:spec.id,label:spec.label,url:`/models/ordinary-buildings/${spec.digits}.glb`,anchor:spec.anchor,bearing:0,scale:1,suppress:spec.suppress,hash:report.sha256,bytes:report.bytes,triangles:report.triangles,materials:report.materials,bounds:report.bounds,height:report.bounds.max[1],sourceCommit:spec.sourceCommit},null,2)+'\n');
console.log(JSON.stringify(report));

// Root integration refreshes only the exact registered native ordinary identity.
const registrationRoot=process.env.ORDINARY_DATA_ROOT??'public/canal-drive/ordinary-buildings-data';
const registration=JSON.parse(await fs.readFile(`${registrationRoot}/catalogue.json`,'utf8'));
const registered=registration.models.find((m:{buildingId:string})=>m.buildingId===spec.id);
if(!registered||registered.id!==`ordinary-${spec.digits}`)throw Error('Exact native ordinary identity required');
Object.assign(registered,{hash:report.sha256,bytes:report.bytes,triangles:report.triangles,materials:report.materials,bounds:report.bounds,height:report.bounds.max[1],sourceCommit:spec.sourceCommit});
await fs.writeFile(`${registrationRoot}/catalogue.json`,JSON.stringify(registration,null,2)+'\n');
