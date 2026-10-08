import fs from 'node:fs/promises';
import * as T from 'three';
import type {BuildingTools} from '../landmarks/cultural-builders';
import {buildPrinsen485,openingProbes} from './prinsen485-builder';
import {exportOrdinaryGeometry} from './export-ordinary-geometry';
import spec from './prinsen485-spec.json';
const started=performance.now(),parts:{g:T.BufferGeometry;c:string}[]=[];
const b={add(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0){g.rotateY(a);g.translate(x,y,z);parts.push({g,c});}} as BuildingTools;
buildPrinsen485(0,0,b);
const {bytes,report}=await exportOrdinaryGeometry({id:spec.id,suppress:spec.suppress,parts,palette:{brick:'#655550',slate:'#393c3b',dark:'#252e2e',white:'#e1e0d4',glass:'#55757a'}});
const out=process.env.ORDINARY_OUTPUT_ROOT??'artifacts/ordinary-buildings/prinsen485',evidence=process.env.ORDINARY_REPORT_ROOT??out;await fs.mkdir(out,{recursive:true});await fs.mkdir(evidence,{recursive:true});await fs.writeFile(`${out}/${spec.digits}.glb`,bytes);
await fs.writeFile(`${evidence}/export.json`,JSON.stringify({...report,sourceCommit:spec.sourceCommit,sourceRoot:spec.sourceRoot,acceptance:spec.acceptance,exportMs:performance.now()-started},null,2)+'\n');await fs.writeFile(`${evidence}/opening-probes.json`,JSON.stringify(openingProbes,null,2)+'\n');await fs.writeFile(`${evidence}/runtime-entry.json`,JSON.stringify({buildingId:spec.id,id:`ordinary-${spec.digits}`,url:`/models/ordinary-buildings/${spec.digits}.glb`,anchor:spec.anchor,scale:1,bearing:0,...report,id:`ordinary-${spec.digits}`,sourceCommit:spec.sourceCommit},null,2)+'\n');console.log(JSON.stringify(report));

// Root integration refreshes only the exact registered native ordinary identity.
const registrationRoot=process.env.ORDINARY_DATA_ROOT??'public/canal-drive/ordinary-buildings-data';
const registration=JSON.parse(await fs.readFile(`${registrationRoot}/catalogue.json`,'utf8'));
const registered=registration.models.find((m:{buildingId:string})=>m.buildingId===spec.id);
if(!registered||registered.id!==`ordinary-${spec.digits}`)throw Error('Exact native ordinary identity required');
Object.assign(registered,{hash:report.sha256,bytes:report.bytes,triangles:report.triangles,materials:report.materials,bounds:report.bounds,height:report.bounds.max[1],sourceCommit:spec.sourceCommit});
await fs.writeFile(`${registrationRoot}/catalogue.json`,JSON.stringify(registration,null,2)+'\n');
