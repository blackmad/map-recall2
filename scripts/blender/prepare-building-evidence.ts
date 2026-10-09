/** Cache-only multi-year facade bundles. Reuses the municipal rectifier; never upgrades registration by itself. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import jpeg from 'jpeg-js';
import { globSync } from 'node:fs';
import { AMSTERDAM_WORLD_ALIGNED,rectifyFacade,worldToEquirectangularPixel } from '../../src/canalRecall/facade/rectify.ts';
const root=process.cwd(),cache=path.join(root,'.worktrees/amsterdam-facade-rebuild/.cache');
const out=path.join(root,'public/canal-drive/models/building-library/evidence');await fs.mkdir(out,{recursive:true});
const sha=(b:any)=>crypto.createHash('sha256').update(b).digest('hex');
const read=async(p:string)=>JSON.parse(await fs.readFile(p,'utf8'));
const entries=(await read('scripts/blender/jordaan-pois-source.json')).entries;
const manifestPaths=globSync('**/panorama-audit/*/evidence/manifest.json',{cwd:cache}).map(p=>path.join(cache,p)).sort();
const manifests=await Promise.all(manifestPaths.map(async p=>({path:p,data:await read(p)})));
const dist=(a:any,b:any)=>Math.hypot(a.x-b.x,a.y-b.y);
const all=[];
for(const entry of entries){
 const owner=entry.owner.id,obs=entry.owner.observations.find((o:any)=>o.payload?.images?.full)?.payload;
 const origin=entry.owner.geometry.building.coordinateFrame.originRD;
 const point=(p:any)=>({x:origin.x+p[0],y:origin.y-p[1]});
 const target={...obs.images.full.plane,start:point(entry.front[0]),end:point(entry.front[1])};
 const wall={start:target.start,end:target.end,elevationId:owner+':primary-frontage',lengthM:dist(target.start,target.end)};
 const primaryFacadeId=owner+':primary:'+sha(JSON.stringify([target.start,target.end])).slice(0,12);
 const cameraFit=(image:any)=>{const dx=target.end.x-target.start.x,dy=target.end.y-target.start.y,w=Math.hypot(dx,dy),mx=(target.start.x+target.end.x)/2,my=(target.start.y+target.end.y)/2,vx=image.pose.x-mx,vy=image.pose.y-my,d=Math.hypot(vx,vy),standoff=(vx*dy-vy*dx)/w,angle=Math.acos(Math.max(-1,Math.min(1,standoff/d)))*180/Math.PI;return {standoff,angle,distance:d,eligible:standoff>=2&&d<=55&&angle<=65};};
 const candidates:any[]=[],captures=new Map<string,any>(),seen=new Set<string>();
 for(const manifest of manifests)for(const record of manifest.data.records??[]){
  if(record.buildingId!==owner)continue;
  const rw=record.wall,err=rw?Math.max(dist(target.start,rw.start),dist(target.end,rw.end)):Infinity;
  const reverseErr=rw?Math.max(dist(target.start,rw.end),dist(target.end,rw.start)):Infinity;
  const reason=err>.3?(reverseErr<=.3?'reversed-frontage':'different-physical-facade'):'unreviewed-metric-registration';
  for(const [tier,image] of Object.entries(record.images??{}) as [string,any][]){
   if(!image.sha256||seen.has(image.sha256))continue;seen.add(image.sha256);
   const file=path.join(path.dirname(manifest.path),'images',image.file),exists=await fs.stat(file).then(()=>true).catch(()=>false);
   const captureKey=image.panoramaId+'|'+image.date;
   const candidate={id:image.sha256,ownerId:owner,physicalFacadeId:record.elevationId,captureKey,panoramaId:image.panoramaId,panoramaSha256:image.panoramaSha256,captureDate:image.date,tier,width:image.width,height:image.height,sourceDimensions:image.sourceDimensions,nativeResolution:image.sourceDimensions,plane:image.plane,wall:rw,geometryRevision:entry.owner.geometryRevision,geometryRevisionVerified:false,rectificationDerivationKey:record.derivationKey,pose:image.pose,datum:image.datum,obliquity:image.obliquity,coverage:tier==='full'?['ground','upper','roof']:tier==='ground'?['ground']:tier==='roof'?['roof']:[],occlusion:{status:entry.caseId==='case-03'&&tier!=='ground'?'tree-obscured':'unreviewed',note:'Footprint hiddenFraction is not a tree/pixel visibility measure'},registration:{status:err<=.3?'ambiguous':'rejected',reason,endpointErrorM:err},path:path.relative(root,file),sourceAvailable:exists,pixelToMetres:image.plane?{xMetresPerPixel:dist(image.plane.start,image.plane.end)/image.width,zMetresPerPixel:(image.plane.topZ-image.plane.baseZ)/image.height,origin:image.plane.start,topNAP:image.plane.topZ}:null};
   if(exists){const publicFile=entry.id+'-cached-'+image.sha256.slice(0,12)+'.jpg';await fs.copyFile(file,path.join(out,publicFile));Object.assign(candidate,{url:'./models/building-library/evidence/'+publicFile});}
   candidates.push(candidate);
   if(err<=.3&&exists&&cameraFit(image).eligible){const pano=path.join(path.dirname(manifest.path),'panoramas',image.panoramaId+'.jpg');if(await fs.stat(pano).then(()=>true).catch(()=>false)){const prev=captures.get(captureKey);if(!prev||(image.sourceDimensions?.[0]??0)>(prev.image.sourceDimensions?.[0]??0))captures.set(captureKey,{image,pano,record});}}
  }
 }
 // Nearby cached WHOLE panoramas may be reprojected onto this physical wall.
 // Adjacent-owner crops are never transferred; camera-facing tests reject the
 // Bar Theo side-view camera behind the primary facade.
 const nearby=new Map<string,any>();
 for(const manifest of manifests)for(const record of manifest.data.records??[])for(const image of Object.values(record.images??{}) as any[]){
  if(!image.pose||!image.date||!cameraFit(image).eligible)continue;
  const pano=path.join(path.dirname(manifest.path),'panoramas',image.panoramaId+'.jpg');
  if(!await fs.stat(pano).then(()=>true).catch(()=>false))continue;
  const captureKey=image.panoramaId+'|'+image.date,fit=cameraFit(image),score=(image.sourceDimensions?.[0]??8000)*Math.cos(fit.angle*Math.PI/180)/fit.distance;
  const previous=nearby.get(captureKey);if(!previous||score>previous.score)nearby.set(captureKey,{image,pano,record,score,fit});
 }
 const knownYears=new Set([...captures.values()].map(c=>c.image.date.slice(0,4)));
 const byYear=new Map<string,any>();
 for(const [key,c] of nearby){const year=c.image.date.slice(0,4);if(knownYears.has(year))continue;const previous=byYear.get(year);if(!previous||c.score>previous.c.score)byYear.set(year,{key,c});}
 for(const {key,c} of [...byYear.values()].sort((a,b)=>a.c.image.date.localeCompare(b.c.image.date)).slice(0,3))captures.set(key,c);
 // Each independent cached panorama is rectified into ALL target regions,
 // including years formerly available only as ground crops. Upsampling never
 // creates native detail or a verified metric registration.
 const derived=[];
 for(const [captureKey,source] of captures){
  const bytes=await fs.readFile(source.pano),decoded=jpeg.decode(bytes,{useTArray:true,formatAsRGBA:true,maxMemoryUsageInMB:1024});
  for(const tier of ['full','roof','ground']){
   const plane=tier==='full'?target:tier==='ground'?{...target,topZ:obs.images.ground.plane.topZ}:{...target,baseZ:target.topZ-8.2};
   const rect=rectifyFacade(decoded,source.image.pose,plane,{camera:AMSTERDAM_WORLD_ALIGNED,pixelsPerMetre:80,maxPixels:1000000});
   const outputBytes=jpeg.encode(rect,92).data,hash=sha(outputBytes),file=entry.id+'-'+source.image.date.slice(0,10)+'-'+tier+'-'+hash.slice(0,8)+'.jpg';await fs.writeFile(path.join(out,file),outputBytes);
   const angular=plane.start&&plane.end?[plane.start,plane.end].map(p=>worldToEquirectangularPixel({...p,z:(plane.baseZ+plane.topZ)/2},source.image.pose,decoded,AMSTERDAM_WORLD_ALIGNED)[0]):[0,0];
   const nativeAngularWidthPx=Math.abs(((angular[1]-angular[0]+decoded.width*1.5)%decoded.width)-decoded.width*.5);
   derived.push({id:hash,ownerId:owner,physicalFacadeId:primaryFacadeId,captureKey,panoramaId:source.image.panoramaId,panoramaSha256:sha(bytes),captureDate:source.image.date,tier,width:rect.width,height:rect.height,sourceDimensions:[decoded.width,decoded.height],nativeAngularWidthPx,geometryRevision:entry.owner.geometryRevision,geometryRevisionVerified:false,plane,pixelToMetres:{xMetresPerPixel:dist(plane.start,plane.end)/rect.width,zMetresPerPixel:(plane.topZ-plane.baseZ)/rect.height,origin:plane.start,topNAP:plane.topZ},registration:{status:'ambiguous',reason:'Same physical plane projected with existing municipal convention; independently measured anchors and geometry revision alignment still required'},occlusion:{status:'unreviewed',note:'Inspect new dated crop; no invisible-feature recovery inferred'},coverage:tier==='full'?['ground','upper','roof']:tier==='ground'?['ground']:['roof'],url:'./models/building-library/evidence/'+file,path:path.relative(root,path.join(out,file)),sourceAvailable:true,sourceObservationFacadeId:source.record.elevationId,cameraFit:cameraFit(source.image),selectedReason:'Independent capture year; known owner capture or best cached frontal/native-resolution candidate for missing year',rectifier:'src/canalRecall/facade/rectify.ts:AMSTERDAM_WORLD_ALIGNED',datum:source.image.datum,pose:source.image.pose});
  }
 }
 const searchedYears=[...new Set([...candidates,...derived].map(c=>c.captureDate?.slice(0,4)).filter(Boolean))].sort();
 const years=[...new Set([...candidates,...derived].filter(c=>c.registration.status!=='rejected'&&c.coverage.length).map(c=>c.captureDate?.slice(0,4)).filter(Boolean))].sort();
 const coverage=years.map(year=>({year,...Object.fromEntries(['ground','upper','roof'].map(region=>{const c=[...candidates,...derived].filter(c=>c.captureDate?.startsWith(year)&&c.coverage.includes(region)&&c.registration.status!=='rejected');return [region,{captures:[...new Set(c.map(c=>c.captureKey))],crops:c.length,registered:c.filter(c=>c.registration.status==='registered').length,visible:'unreviewed; crop coverage is not visibility'}]}))}));
 let visualReview:any=null;try{visualReview=await read('artifacts/jordaan-pois/alternate-year-visual-review.json');}catch{}
 const review=visualReview?.observations?.find((r:any)=>r.recipe===entry.id)??null;
 for(const crop of derived){
  if(crop.captureDate.startsWith('2025')&&review){crop.occlusion={status:entry.id==='rozengracht-160'?'lower-tree-occlusion-primary-facade-visible':'primary-facade-visible',note:'Visual observations from alternate-year-visual-review.json; metric registration remains ambiguous'};crop.visualReview='artifacts/jordaan-pois/alternate-year-visual-review.json';}
  if(entry.id==='elandsgracht-96'&&crop.captureDate.startsWith('2024'))crop.occlusion={status:'tree-obscured',note:'2024 source obscures upper bays; 2025 supplies clearer appearance evidence'};
 }
 const bundle={schemaVersion:1,id:entry.id,ownerId:owner,geometryRevision:entry.owner.geometryRevision,physicalFacade:{id:primaryFacadeId,plane:target,wall,frontage:entry.front,originalObservationPlane:obs.images.full.plane,originalObservationFacadeId:obs.wall?.elevationId,associationDiscrepancy:Math.max(dist(target.start,obs.images.full.plane.start),dist(target.end,obs.images.full.plane.end))>.3},targetAppearanceDate:entry.source.ground.captureDate,searchedYears,searchedLocations:manifestPaths.map(p=>path.relative(root,p)),candidates,derived,coverage,visualReview:review,featureProposals:[],policy:'Multiple years of rectified samples are required; ambiguous crops cannot derive metric geometry or recover hidden features. Business details use target-date ground appearance.',gaps:['Independent anchor registration remains required; no registered feature fusion performed.','Unseen roof and tree-obscured windows require dated visibility review.'],acquisitionTasks:[{region:'upper/roof',action:'Inspect dated full/roof crops, annotate common anchors and occlusion. If unresolved, select another cached municipal capture year/position and run this same rectifier; acquire only missing candidates.'}]};
 await fs.writeFile(path.join(out,entry.id+'.json'),JSON.stringify(bundle,null,2)+'\n');all.push({id:entry.id,years,searchedYears,independentCaptures:captures.size,derivedCrops:derived.length,registered:0});
}
await fs.writeFile(path.join(out,'audit.json'),JSON.stringify({schemaVersion:1,cacheRoot:path.relative(root,cache),manifestCount:manifestPaths.length,models:all,downloads:0,recoveredFeatures:0},null,2)+'\n');console.log(JSON.stringify(all,null,2));
