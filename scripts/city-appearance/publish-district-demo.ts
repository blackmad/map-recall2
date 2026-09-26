/** Merge acquired districts into one immutable evaluation release and validate before activation. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadDistrictConfig} from './district-config.mjs';
import {completeRun,publishAreaGeometryDemo} from './publish-area-geometry-demo.js';
import {mergeDistrictBlocks} from './merge-district-blocks.js';
import {sha256} from './compile-block-tiles.js';
import {rdToLngLat} from '../../src/canalRecall/facade/rdNew.js';
import {surfaceMatches} from '../../public/canal-drive/da-costa-block/evidence.js';
const read=async(file:string)=>JSON.parse(await fs.readFile(file,'utf8'));
const flag=(name:string)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.slice(name.length+3);
import {routingBindingDisposition} from './routing-result-bindings.mjs';
import {validateDistrictRelease} from './validate-district-release.mjs';
export {validateDistrictRelease};
export async function publishDistrictDemo(){
  const district=await loadDistrictConfig(flag('district-config')??'scripts/city-appearance/districts/da-costa-jordaan-v1.json');
  const boundarySnapshot=district.boundarySource.snapshotFile?await read(district.boundarySource.snapshotFile):null;
  const entries=[] as any[];
  for(const entry of district.areas){const run=await completeRun(entry.id),block=await read(run.state.jobs.compile.output.blockPath);if(block.areaConfigHash!==entry.configHash)throw Error(`Stale district block ${entry.id}`);entries.push({...entry,run,block,boundaryPolygons:boundarySnapshot?.features.filter((f:any)=>entry.boundary?.sourceFeatureIds?.includes(f.properties.identificatie)).map((f:any)=>f.geometry.coordinates)});}
  const block=mergeDistrictBlocks(entries,district),bytes=Buffer.from(JSON.stringify(block)),hash=sha256(bytes),root=path.resolve('.cache/city-appearance/districts',district.id,hash);await fs.mkdir(root,{recursive:true});
  const blockPath=path.join(root,'block.json');await fs.writeFile(blockPath,bytes);
  const bbox=[Math.min(...entries.map(e=>e.area.bbox[0])),Math.min(...entries.map(e=>e.area.bbox[1])),Math.max(...entries.map(e=>e.area.bbox[2])),Math.max(...entries.map(e=>e.area.bbox[3]))];
  const area={id:district.id,configHash:district.configHash,bbox,origin:rdToLngLat(block.origin)};
  const run={name:hash,state:{jobs:Object.fromEntries(['compile','inventory','tiles','context-tiles'].map(id=>[id,{status:'complete',inputKey:sha256(JSON.stringify(entries.map(e=>e.run.state.jobs[id].inputKey))),outputKey:sha256(JSON.stringify(entries.map(e=>e.run.state.jobs[id].outputKey))),completedAt:entries.map(e=>e.run.state.jobs[id].completedAt).sort().at(-1),output:{blockPath}}]))}};
  const evidence:any[]=[],evidenceHashes:any[]=[],isolatedArtifacts:any[]=[],evidenceFiles=new Map<string,string>();
  // Reuse source-bound outputs across acquisition versions. A record only survives
  // if the merged geometry contains its BAG ID and a matching physical wall.
  const areasRoot='.cache/city-appearance/areas';
  for(const areaId of (await fs.readdir(areasRoot)).sort()){
    const auditRoot=path.join(areasRoot,areaId,'panorama-audit');let selections:string[];try{selections=await fs.readdir(auditRoot);}catch(e:any){if(e.code==='ENOENT')continue;throw e;}
    for(const selection of selections.sort()){
      const dir=path.join(auditRoot,selection);let preflight:any,manifest:any;
      try{preflight=await read(path.join(dir,'automated-preflight.json'));manifest=await read(path.join(dir,'evidence/manifest.json'));}catch(e:any){if(e.code==='ENOENT')continue;throw e;}
      const manifestBytes=await fs.readFile(path.join(dir,'evidence/manifest.json'));if(sha256(manifestBytes)!==preflight.manifestSha256){isolatedArtifacts.push({areaId,selection,reason:'stale-preflight-manifest'});continue;}
      const proposals=new Map();let folders:string[];try{folders=await fs.readdir(path.join(dir,'routing-inputs'));}catch(e:any){if(e.code==='ENOENT')continue;throw e;}
      for(const folder of folders.sort()){
        const inputRoot=path.join(dir,'routing-inputs',folder);let results:any,inputs:any;
        try{results=await read(path.join(inputRoot,'machine-routing/results.json'));inputs=await read(path.join(inputRoot,'manifest.json'));}catch(e:any){if(e.code==='ENOENT')continue;isolatedArtifacts.push({areaId,selection,inputSetHash:folder,reason:'unreadable-routing-artifact'});continue;}
        evidenceHashes.push({areaId,selection,inputSetHash:results.inputSetHash,sha256:sha256(JSON.stringify(results))});
        for(const r of results.results){
          if(r.status!=='ok')continue;
          const record=manifest.records.find((item:any)=>item.id===r.id),reason=routingBindingDisposition(record,r,inputs,results,preflight.manifestSha256);
          if(reason!=='bound'){isolatedArtifacts.push({areaId,selection,id:r.id,reason});continue;}
          const input=inputs.items.find((item:any)=>item.id===r.id);let valid=true;
          for(const image of Object.values(input.images) as any[])try{if(sha256(await fs.readFile(path.join(inputRoot,'images',image.file)))!==image.sha256)valid=false;}catch{valid=false;}
          if(!valid){isolatedArtifacts.push({areaId,selection,id:r.id,reason:'corrupt-compact-crop'});continue;}
          proposals.set(r.id,r.proposal);
        }
      }
      for(const record of manifest.records){const building=block.buildings.find((b:any)=>b.id===record.buildingId);if(!building)continue;const p:any=proposals.get(record.id);if(!p)continue;
        const translate=(v:number[])=>[manifest.origin.x+v[0]-block.origin.x,block.origin.y-manifest.origin.y+v[1]];
        const result={...record,localStart:translate(record.localStart),localEnd:translate(record.localEnd),mid:translate(record.mid),evidenceLocalStart:record.localStart,evidenceLocalEnd:record.localEnd,evidenceMid:record.mid,evidenceOrigin:manifest.origin,evidenceAreaId:areaId,renderBuildingId:record.buildingId,district:building.ownerDistrict,evidenceKey:sha256(JSON.stringify({selection,derivationKey:record.derivationKey,manifest:preflight.manifestSha256,proposal:p})),agentSourceAudit:{disposition:'preflight-passed',visualSourceIdentity:'not-reviewed'},machineRoutingProposal:p,effectiveProposal:{family:p.family,wallMaterial:p.wallMaterial,wallColour:p.wallColour,wholeUsable:p.upperUsable,groundUsable:p.groundUsable,shopfront:['storefront','mixed'].includes(p.groundType)?'yes':p.groundType==='residential'?'no':'unknown',signText:p.signText??'',signTextEligible:p.signTextEligible??'unknown',awning:'unknown',roofShape:'unknown',facadeTop:'unknown'},appearancePublication:'quarantined-machine-preview'};
        for(const image of Object.values(record.images??{}) as any[])evidenceFiles.set(image.sha256,path.join(dir,'evidence/images',image.file));
        evidence.push({...result,renderSurfaceIndices:surfaceMatches(building,result)});
      }
    }
  }
  const revocations=await read(flag('revocations')??'scripts/city-appearance/districts/appearance-revocations-v1.json');
  if(revocations.version!==1||!Array.isArray(revocations.records)||revocations.records.some((r:any)=>!r.id||typeof r.reason!=='string'||!r.reason.trim()))throw Error('Invalid per-record revocation registry');
  evidenceHashes.push({kind:'revocations',sha256:sha256(JSON.stringify(revocations))});
  const unique=[...new Map(evidence.map(r=>[r.id,r])).values()].map(record=>{const revoked=revocations.records.find((r:any)=>r.id===record.id&&(!r.evidenceKey||r.evidenceKey===record.evidenceKey));return revoked?{...record,machineRevocation:{...revoked,revoked:true},appearancePublication:'revoked-machine-observation',effectiveProposal:{wholeUsable:'unknown',groundUsable:'unknown',shopfront:'unknown',signText:'',signTextEligible:'unknown',awning:'unknown',roofShape:'unknown',facadeTop:'unknown'}}:record;});
  const metadata={...block.district,isolatedArtifacts,configHash:district.configHash,budgets:district.budgets,areas:entries.map(e=>({id:e.id,district:e.district,configHash:e.configHash,buildings:e.block.buildings.length,blockSha256:sha256(JSON.stringify(e.block))})),routeHash:district.route?.sha256};
  const manifest=await publishAreaGeometryDemo({area,run,evidenceAreaFile:'scripts/city-appearance/areas/da-costa-tranche-400m-v1.json',district:metadata,waypoints:district.route?.value.waypoints,records:()=>unique,additionalEvidenceHashes:evidenceHashes,evidenceFiles,appearanceCoverage:{automatedPreflightFrontages:unique.length,rejectedBindings:unique.filter(r=>!r.renderSurfaceIndices.length).length},beforeActivate:validateDistrictRelease});
  if(!process.argv.includes('--dry-run')){
    const catalogPath='public/data/city-appearance/areas.json',catalog=await read(catalogPath);catalog.areas=catalog.areas.filter((e:any)=>e.pointerUrl!=='/data/city-expansion/current.json'&&!district.areas.some((a:any)=>a.id===e.id));catalog.areas.push({id:district.id,name:district.name,pointerUrl:'/data/city-expansion/current.json',lesson:true,priority:100});const temp=`${catalogPath}.${process.pid}.tmp`;await fs.writeFile(temp,JSON.stringify(catalog));await fs.rename(temp,catalogPath);
  }
  return {releaseId:manifest.releaseId,areaId:manifest.areaId,buildings:manifest.buildings,observations:manifest.observations,root};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)publishDistrictDemo().then(v=>console.log(JSON.stringify(v,null,2))).catch(e=>{console.error(e);process.exitCode=1;});
