/** Inventories cached multi-date photographs. It never downloads, rectifies,
 * or promotes them to registrations; geometry agreement is only a candidate
 * association for a later independent registration review. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fuseStableFacadeEvidence, type MetricObservation } from '../../src/canalRecall/facadeTemporalEvidence.ts';
const root=process.cwd(),read=async(file:string)=>JSON.parse(await fs.readFile(file,'utf8'));
const manifests=['.cache/city-appearance/areas/da-costabuurt-v1/panorama-audit/b4fc23112b0593e31eb3d4ae7226adb95639120d92a75965b4f841fd274a32fd/evidence/manifest.json','.cache/city-appearance/areas/da-costa-expansion-550m-v1/panorama-audit/35e8d2f29c4634cbd07d6afa0d624f6a971f518e2e056859cf988030dedea61a/evidence/manifest.json','.cache/city-appearance/areas/da-costa-tranche-400m-v1/panorama-audit/be950e97c54cab9950c80fa33846ca8bbc2a2477fe4284977d91dc481128f783/evidence/manifest.json','.cache/city-appearance/areas/jordaan-sample-v1/panorama-audit/3efda804ec397771663a9af0cfab35b381c3fd30b70565029222bb0c25fbc61e/evidence/manifest.json'];
const regressions=await read('scripts/review/facade-regressions.json');
const sources:any[]=[];
for(const relative of manifests){const manifest=await read(relative);for(const record of manifest.records??[])sources.push({record,relative,images:Object.entries(record.images??{}).map(([tier,image])=>({tier,...image,path:path.join(path.dirname(relative),'images',(image as any).file??'')}))});}
const temporal=await read('.cache/da-costa-ground-bays-temporal-2026-09-09/manifest.json');
for(const record of temporal.records??[])sources.push({record:{buildingId:record.parentBuildingId,wall:record.wall,id:record.parentId},relative:'.cache/da-costa-ground-bays-temporal-2026-09-09/manifest.json',images:Object.entries(record.previousImages??{}).map(([tier,image])=>({tier,...image,path:path.join('.cache/da-costa-ground-bays-temporal-2026-09-09','images',(image as any).file??'')}))});
const distance=(a:any,b:any)=>Math.hypot(a.x-b.x,a.y-b.y),wallMatch=(a:any,b:any)=>{if(!a?.start||!a?.end||!b?.start||!b?.end)return {matched:false,reason:'plane-or-wall-missing'};const direct=Math.max(distance(a.start,b.start),distance(a.end,b.end)),reverse=Math.max(distance(a.start,b.end),distance(a.end,b.start));const ax=a.end.x-a.start.x,ay=a.end.y-a.start.y,bx=b.end.x-b.start.x,by=b.end.y-b.start.y,dot=(ax*bx+ay*by)/(Math.hypot(ax,ay)*Math.hypot(bx,by));return {matched:Math.min(direct,reverse)<=.3&&Math.abs(dot)>=.995,signedDirection:dot,directEndpointErrorM:direct,reverseEndpointErrorM:reverse};};
const cases=[];
for(const item of regressions.cases){const tile=JSON.parse(gunzipSync(await fs.readFile(item.binding.tile.path)).toString()),owner=tile.owners.find((entry:any)=>entry.id===item.binding.buildingId),payload=owner?.observations?.find((entry:any)=>entry.id===item.binding.observationId)?.payload,targetPlane=payload?.images?.full?.plane??payload?.images?.ground?.plane;
 const candidates:any[]=[],seen=new Set<string>();
 for(const source of sources.filter(source=>source.record.buildingId===item.binding.buildingId)){const match=wallMatch(targetPlane,source.record.wall);for(const image of source.images){if(!image.sha256||seen.has(image.sha256))continue;seen.add(image.sha256);candidates.push({observationId:source.record.id,tier:image.tier,cropSha256:image.sha256,captureDate:image.date,width:image.width,height:image.height,path:image.path,plane:image.plane??null,wall:source.record.wall??null,geometryCandidate:match,registration:{status:'ambiguous',reason:'cached plane/hash candidate only; independent metric alignment unresolved'}});}}
 candidates.sort((a,b)=>String(a.captureDate).localeCompare(String(b.captureDate))||String(a.cropSha256).localeCompare(String(b.cropSha256)));
 const frontageKey=JSON.stringify(item.binding.frontage),actualObservations:MetricObservation[]=candidates.map(candidate=>({id:candidate.cropSha256,buildingId:item.binding.buildingId,frontageKey,registration:{status:'ambiguous',uncertaintyM:NaN},sourceHash:candidate.cropSha256,sourceDate:candidate.captureDate,features:[]}));
 // Inventory is not a visual association review. Do not manufacture verified
 // links for unannotated photographs merely to exercise the rejection path.
 const fusion=fuseStableFacadeEvidence({buildingId:item.binding.buildingId,frontageKey},actualObservations,[]);
 cases.push({caseId:item.caseId,buildingId:item.binding.buildingId,frontage:item.binding.frontage,currentSources:item.source,candidates,fusion:{...fusion,status:fusion.recovered.length?'unexpected-recovered':'abstained-no-registered-temporal-observation'}});
}
const output={version:1,kind:'cached-temporal-evidence-inventory',createdAt:new Date().toISOString(),scope:'cached photographs only; geometry candidates are not registrations and no cross-date feature fusion is accepted',cases,summary:{cases:cases.length,candidates:cases.reduce((sum,item)=>sum+item.candidates.length,0),registeredTemporalObservations:0,recoveredFeatures:cases.reduce((sum,item)=>sum+item.fusion.recovered.length,0),case17Alternatives:cases.find(item=>item.caseId==='case-17')?.candidates.filter((candidate:any)=>candidate.tier==='full'&&candidate.cropSha256!==cases.find((entry:any)=>entry.caseId==='case-17')?.currentSources?.full?.sha256)??[]}};
await fs.writeFile('scripts/review/temporal-evidence-inventory.json',`${JSON.stringify(output,null,2)}\n`);console.log(JSON.stringify(output.summary));
