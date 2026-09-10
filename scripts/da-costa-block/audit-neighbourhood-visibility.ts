/** Read existing evidence; write only a separate staging audit, never active data. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { footprintOcclusion, VISIBILITY_VERSION, sha } from './neighbourhood-core.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
const out=process.argv.find(s=>s.startsWith('--out='))?.slice(6)??'.cache/da-costa-visibility-stage/visibility-audit.json';
if(path.resolve(out).startsWith(path.resolve('.cache/da-costa-neighbourhood')+path.sep))throw Error('Audit must not write to active cache');
const read=async(p:string)=>JSON.parse(await fs.readFile(p,'utf8'));
const manifestBytes=await fs.readFile('.cache/da-costa-neighbourhood/manifest.json');
const manifest=JSON.parse(manifestBytes.toString('utf8')),block=await read('public/data/da-costa-block/block.json'),bag=await read('.cache/da-costa-block/bag.json');
const registry=new Map(bag.map((b:any)=>[b.properties.identificatie,b]));
const local=(p:any)=>[p.x-manifest.origin.x,manifest.origin.y-p.y];
const buildings=block.buildings.map((b:any)=>{
  const s:any=registry.get(b.id);
  const polygons=s?(s.geometry.type==='Polygon'?[s.geometry.coordinates]:s.geometry.coordinates).map((p:any)=>p.map((r:any)=>r.map((v:any)=>local(lngLatToRd(v))))):b.footprint.coordinates;
  return {id:b.id,polygons};
});
const records=manifest.records.map((r:any)=>{
  const views=Object.fromEntries(['full','ground'].map(kind=>{
    const from=local(r.images[kind].pose);
    const rays=[.15,.5,.85].map(t=>{
      const to=local({x:r.wall.start.x+(r.wall.end.x-r.wall.start.x)*t,y:r.wall.start.y+(r.wall.end.y-r.wall.start.y)*t});
      return buildings.map((b:any)=>({buildingId:b.id,self:b.id===r.buildingId,...footprintOcclusion(from,to,b.polygons)})).filter((b:any)=>b.blocked);
    });
    return [kind,{panoramaId:r.images[kind].panoramaId,blockedFraction:rays.filter(x=>x.length).length/3,selfBlockedFraction:rays.filter(x=>x.some((b:any)=>b.self)).length/3,rejected:rays.filter(x=>x.length).length>=2,rays}];
  }));
  return {id:r.id,buildingId:r.buildingId,address:r.address,derivationKey:r.derivationKey,wallWidthM:r.wallWidthM,views};
});
const summary={records:records.length,fullRejected:records.filter((r:any)=>r.views.full.rejected).length,groundRejected:records.filter((r:any)=>r.views.ground.rejected).length,eitherRejected:records.filter((r:any)=>r.views.full.rejected||r.views.ground.rejected).length,fullSelfRejected:records.filter((r:any)=>r.views.full.selfBlockedFraction>.34).length,groundSelfRejected:records.filter((r:any)=>r.views.ground.selfBlockedFraction>.34).length,unchangedEligible:records.filter((r:any)=>!r.views.full.rejected&&!r.views.ground.rejected).length};
await fs.mkdir(path.dirname(out),{recursive:true});
await fs.writeFile(out,JSON.stringify({version:VISIBILITY_VERSION,sourceManifestHash:manifest.sourceHash,sourceManifestFileHash:sha(manifestBytes),policy:'Conservative 2D footprint audit. Existing evidence, paid outputs and human reviews remain unchanged. Underpasses/overhangs require 3D review.',summary,records},null,2));
console.log(JSON.stringify({out,summary,rejectedIds:records.filter((r:any)=>r.views.full.rejected||r.views.ground.rejected).map((r:any)=>r.id)},null,2));
