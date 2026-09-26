/** Bind cached expansion source planes to preserved 3DBAG owner geometry.
 * Candidate transforms stay ambiguous: this is staging preparation, never a
 * registration certificate or a release mutation. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {facadeWallFrame} from '../../src/canalRecall/cityAppearanceFacadeRecipes.ts';
import {sourceHeightOffset} from '../../src/canalRecall/appearanceHeight.ts';

const digest=(value:any)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const finite=(value:any)=>typeof value==='number'&&Number.isFinite(value);
const hash=(value:any)=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
const date=(value:any)=>typeof value==='string'&&Number.isFinite(Date.parse(value));
type TargetResult={targetRecords:any[];candidateSources:any[];omissions:any[];evidenceFiles:Map<string,string>};
function local(point:any,origin:any):[number,number]{return [point.x-origin.x,origin.y-point.y];}
function planeMatch(owner:any,raw:any,tolerance:number){
 const plane=raw?.plane,origin=owner.geometry?.frame?.originRD;
 if(!plane||!origin||![plane.start?.x,plane.start?.y,plane.end?.x,plane.end?.y,plane.baseZ,plane.topZ].every(finite)||plane.topZ<=plane.baseZ)return null;
 const start=local(plane.start,origin),end=local(plane.end,origin),dx=end[0]-start[0],dz=end[1]-start[1],length=Math.hypot(dx,dz);
 if(length<.02)return null;
 const direction:[number,number]=[dx/length,dz/length];
 const choices=owner.geometry.building.surfaces.flatMap((surface:any,index:number)=>{
  if(surface.type!=='wall')return [];
  const frame=facadeWallFrame(surface,owner,[owner]);if(!frame)return [];
  const off=(point:number[])=>Math.abs((point[0]-frame.a[0])*frame.u[1]-(point[1]-frame.a[1])*frame.u[0]);
  const offM=Math.max(off(start),off(end));
  const along=(point:number[])=>(point[0]-frame.a[0])*frame.u[0]+(point[1]-frame.a[1])*frame.u[1];
  const projected=[along(start),along(end)],overlap=Math.max(0,Math.min(frame.width,Math.max(...projected))-Math.max(0,Math.min(...projected)));
  return offM<=tolerance?[{index,frame,offM,overlap,projected}]:[];
 }).sort((a:any,b:any)=>a.offM-b.offM||b.overlap-a.overlap||a.index-b.index);
 if(!choices.length)return null;
 // A near-identical score has no defensible single surface owner.
 if(choices[1]&&Math.abs(choices[0].offM-choices[1].offM)<.01&&Math.abs(choices[0].overlap-choices[1].overlap)<.05)return null;
 const selected=choices[0],heightDatum=owner.geometry.frame.heightDatum;
 let offset:number;try{offset=sourceHeightOffset(heightDatum);}catch{return null;}
 const [left,right]=selected.projected;
 return {surfaceIndex:selected.index,frame:selected.frame,offM:selected.offM,wallDirection:direction,imageToWall:[(right-left)/raw.width,0,left,0,(plane.baseZ-plane.topZ)/raw.height,plane.topZ-(selected.frame.bottom+offset),0,0,1],planeLocal:{start,end},heightDatum};
}
function sourceIdentity(raw:any){return raw&&hash(raw.sha256)&&date(raw.captureDate)&&Number.isInteger(raw.width)&&Number.isInteger(raw.height)&&raw.width>0&&raw.height>0&&typeof raw.path==='string';}
function ownerRecord(item:any,owner:any,match:any){
 const origin=owner.geometry.frame.originRD,wall=item.wall,first=wall?.start??item.sources.full.plane.start,last=wall?.end??item.sources.full.plane.end;
 if(!first||!last)return null;
 const localStart=local(first,origin),localEnd=local(last,origin),mid=[(localStart[0]+localEnd[0])/2,(localStart[1]+localEnd[1])/2];
 const rawNormal=wall?.normal,normal=rawNormal&&finite(rawNormal.x)&&finite(rawNormal.y)?[rawNormal.x,-rawNormal.y]:null;if(!normal||Math.hypot(...normal)<1e-6)return null;
 const evidenceKey=digest({kind:'cached-expansion-native-candidate-v1',observationId:item.observationId,buildingId:owner.id,geometryRevision:owner.geometryRevision,tiers:Object.fromEntries(Object.entries(item.sources).map(([tier,raw]:any)=>[tier,{sha256:raw.sha256,captureDate:raw.captureDate,width:raw.width,height:raw.height}]))});
 return {id:item.observationId,observationId:item.observationId,sourceObservationId:item.sourceObservationId??item.observationId,buildingId:owner.id,renderBuildingId:owner.id,street:item.street??owner.geometry.building.street??'',geometryRevision:owner.geometryRevision,evidenceKey,derivationKey:digest({observationId:item.observationId,evidenceKey}),localStart,localEnd,mid,normal,wallWidthM:Math.hypot(localEnd[0]-localStart[0],localEnd[1]-localStart[1]),height:owner.geometry.building.height??match.frame.top-match.frame.bottom,address:item.address??owner.geometry.building.addresses?.[0]??item.street??'',renderSurfaceIndices:[match.surfaceIndex],images:Object.fromEntries(Object.entries(item.sources).map(([tier,raw]:any)=>[tier,{sha256:raw.sha256,date:raw.captureDate,width:raw.width,height:raw.height,file:raw.path,plane:raw.plane,panoramaSha256:raw.panoramaSha256??null}])),effectiveProposal:{wholeUsable:'unknown',groundUsable:'unknown',shopfront:'unknown',signText:'',signTextEligible:'unknown',awning:'unknown',roofShape:'unknown',facadeTop:'unknown'},review:{placement:'candidate-registration-preview',disposition:'native-plane-unregistered'},appearancePublication:'candidate-registration-preview'};
}
/** Pure target preparation; useful for tests and for callers that already loaded owners. */
export function prepareInventoryTargetsFromOwners(inventory:any,owners:any[],toleranceM=.18):TargetResult{
 if(inventory?.version!==1||!Array.isArray(inventory.records)||!Array.isArray(owners))throw Error('Invalid source inventory or owner collection');
 const byBuilding=new Map(owners.map(owner=>[owner.id,owner])),targetRecords:any[]=[],candidateSources:any[]=[],omissions:any[]=[],evidenceFiles=new Map<string,string>();
 const declaredTranche=Array.isArray(inventory.trancheObservationIds)&&inventory.trancheObservationIds.every((value:any)=>typeof value==='string'&&value.length>0);
 const selected=declaredTranche?inventory.records.filter((item:any)=>inventory.trancheObservationIds.includes(item.observationId)):inventory.records.slice(0,Number.isInteger(inventory.requestedTranche)?inventory.requestedTranche:inventory.records.length);
 if(Array.isArray(inventory.trancheObservationIds)&&!declaredTranche)omissions.push({observationId:null,reason:'invalid-tranche-observation-ids; deterministic records-order fallback used'});
 for(const item of selected.slice().sort((a:any,b:any)=>String(a.observationId).localeCompare(String(b.observationId)))){
  const owner=byBuilding.get(item.renderBuildingId??item.buildingId);if(!owner){omissions.push({observationId:item.observationId,reason:'target-owner-not-found'});continue;}
  const sources=item.sources??item.tiers;if(!sources?.full||!sources?.ground||!sourceIdentity(sources.full)||!sourceIdentity(sources.ground)){omissions.push({observationId:item.observationId,reason:'source-tier-identity-incomplete'});continue;}
  const fullMatch=planeMatch(owner,sources.full,toleranceM),groundMatch=planeMatch(owner,sources.ground,toleranceM);
  if(!fullMatch||!groundMatch){omissions.push({observationId:item.observationId,reason:'source-plane-does-not-match-a-single-wall-within-tolerance',fullMatched:!!fullMatch,groundMatched:!!groundMatch});continue;}
  if(fullMatch.surfaceIndex!==groundMatch.surfaceIndex){omissions.push({observationId:item.observationId,reason:'full-and-ground-select-different-surfaces',fullSurface:fullMatch.surfaceIndex,groundSurface:groundMatch.surfaceIndex});continue;}
  const record=ownerRecord(item,owner,fullMatch);if(!record){omissions.push({observationId:item.observationId,reason:'source-wall-endpoints-missing'});continue;}
  targetRecords.push(record);
  for(const tier of ['full','ground']){const raw=sources[tier],match=tier==='full'?fullMatch:groundMatch;candidateSources.push({observationId:record.id,buildingId:record.buildingId,geometryRevision:record.geometryRevision,evidenceKey:record.evidenceKey,frontage:[record.localStart,record.localEnd],surfaceIndex:match.surfaceIndex,tier,cropSha256:raw.sha256,captureDate:raw.captureDate,width:raw.width,height:raw.height,path:raw.path,imageToWall:match.imageToWall,wallDirection:match.wallDirection,cropMarginsPx:{left:0,top:0,right:0,bottom:0},abstention:'native-crop-plane alignment, camera height and metric uncertainty are unresolved'});evidenceFiles.set(raw.sha256,raw.path);}
 }
 return {targetRecords:targetRecords.sort((a,b)=>a.id.localeCompare(b.id)),candidateSources:candidateSources.sort((a,b)=>`${a.observationId}:${a.tier}`.localeCompare(`${b.observationId}:${b.tier}`)),omissions:omissions.sort((a,b)=>String(a.observationId).localeCompare(String(b.observationId))),evidenceFiles};
}
async function readJson(file:string){return JSON.parse(await fs.readFile(file,'utf8'));}
/** Load immutable preserved release owner tiles, then prepare candidate targets. */
export async function prepareThousandInventoryTargets({inventoryPath='scripts/review/thousand-building-sources.json',inventory:providedInventory,currentPath='public/data/city-expansion/current.json',toleranceM=.18,scopeAllRecords=false,extraOwners=[]}:{extraOwners?:any[];inventoryPath?:string;inventory?:any;currentPath?:string;toleranceM?:number;scopeAllRecords?:boolean}={}):Promise<TargetResult>{
 const [loadedInventory,current]=await Promise.all([providedInventory??readJson(inventoryPath),readJson(currentPath)]),owners:any[]=[];
 const inventory=scopeAllRecords?{...loadedInventory,trancheObservationIds:undefined,requestedTranche:loadedInventory.records?.length}:loadedInventory;
 for(const tile of current.tiles??[]){const relative=String(tile.url??'').replace(/^\//,''),file=path.join('public',relative),bytes=await fs.readFile(file);let payload:any;try{payload=JSON.parse(gunzipSync(bytes).toString());}catch{payload=JSON.parse(bytes.toString());}owners.push(...(payload.owners??[]));}
 const known=new Set(owners.map(owner=>owner.id));for(const owner of extraOwners){if(known.has(owner.id))throw Error(`Supplemental geometry cannot replace preserved owner ${owner.id}`);known.add(owner.id);owners.push(owner);}
 const deduped=[...new Map(owners.map(owner=>[owner.id,owner])).values()];return prepareInventoryTargetsFromOwners(inventory,deduped,toleranceM);
}
