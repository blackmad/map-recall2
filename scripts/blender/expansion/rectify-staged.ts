/** Minimal expansion adapter over the shared municipal rectifier. Cache only. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {globSync} from 'node:fs';
import jpeg from 'jpeg-js';
import {AMSTERDAM_WORLD_ALIGNED,rectifyFacade,worldToEquirectangularPixel} from '../../../src/canalRecall/facade/rectify.ts';

const root=process.cwd(),base=path.join(root,'artifacts/building-library/expansion'),out=path.join(base,'evidence');
await fs.mkdir(out,{recursive:true});
const read=async(p:string)=>JSON.parse(await fs.readFile(p,'utf8'));
const sha=(b:Uint8Array)=>crypto.createHash('sha256').update(b).digest('hex');
const entries=(await read('scripts/blender/expansion/source-manifest.json')).entries;
const cache=path.join(root,'.worktrees/amsterdam-facade-rebuild/.cache');
const manifests=await Promise.all(globSync('**/panorama-audit/*/evidence/manifest.json',{cwd:cache}).map(async p=>({path:path.join(cache,p),data:await read(path.join(cache,p))})));
const audit=[];
for(const entry of entries){
 const inventory=await read(path.join(base,entry.id+'-cached-inventory.json'));
 const primary=entry.owner.observations[0].payload,origin=entry.owner.geometry.building.coordinateFrame.originRD;
 const point=(p:number[])=>({x:origin.x+p[0],y:origin.y-p[1]});
 const target={...primary.images.full.plane,start:point(entry.front[0]),end:point(entry.front[1])};
 const width=Math.hypot(target.end.x-target.start.x,target.end.y-target.start.y);
 const cameras=new Map<string,any>();
 for(const manifest of manifests)for(const record of manifest.data.records??[])for(const image of Object.values(record.images??{}) as any[]){
  if(!image.pose||!image.date)continue;
  const vx=image.pose.x-(target.start.x+target.end.x)/2,vy=image.pose.y-(target.start.y+target.end.y)/2;
  const distance=Math.hypot(vx,vy),standoff=(vx*(target.end.y-target.start.y)-vy*(target.end.x-target.start.x))/width;
  const angle=Math.acos(Math.max(-1,Math.min(1,standoff/distance)))*180/Math.PI;
  if(standoff<2||distance>55||angle>65)continue;
  const pano=path.join(path.dirname(manifest.path),'panoramas',image.panoramaId+'.jpg');
  if(!await fs.stat(pano).then(()=>true).catch(()=>false))continue;
  const key=image.panoramaId+'|'+image.date;
  const score=(image.sourceDimensions?.[0]??8000)*Math.cos(angle*Math.PI/180)/distance;
  const prev=cameras.get(key);
  if(!prev||score>prev.score)cameras.set(key,{image,pano,key,record,score,fit:{standoff,distance,angle}});
 }
 const years=new Map<string,any[]>();
 for(const c of cameras.values()){const year=c.image.date.slice(0,4);years.set(year,[...(years.get(year)??[]),c]);}
 const selected=[...years.values()].flatMap(c=>c.sort((a,b)=>b.score-a.score).slice(0,2));
 const derived=[];
 for(const source of selected){
  const bytes=await fs.readFile(source.pano),decoded=jpeg.decode(bytes,{useTArray:true,formatAsRGBA:true,maxMemoryUsageInMB:1024});
  for(const tier of ['full','roof','ground']){
   const plane=tier==='full'?target:tier==='ground'?{...target,topZ:primary.images.ground.plane.topZ}:{...target,baseZ:Math.max(target.baseZ,target.topZ-8.2)};
   const rect=rectifyFacade(decoded,source.image.pose,plane,{camera:AMSTERDAM_WORLD_ALIGNED,pixelsPerMetre:80,maxPixels:1000000});
   const output=jpeg.encode(rect,92).data,hash=sha(output),file=entry.id+'-'+source.image.date.slice(0,10)+'-'+tier+'-'+hash.slice(0,8)+'.jpg';
   await fs.writeFile(path.join(out,file),output);
   const angular=[plane.start,plane.end].map(p=>worldToEquirectangularPixel({...p,z:(plane.baseZ+plane.topZ)/2},source.image.pose,decoded,AMSTERDAM_WORLD_ALIGNED)[0]);
   derived.push({id:hash,ownerId:entry.owner.id,physicalFacadeId:entry.owner.id+':selected-primary',captureKey:source.key,captureDate:source.image.date,tier,panoramaId:source.image.panoramaId,panoramaSha256:sha(bytes),sourceDimensions:[decoded.width,decoded.height],width:rect.width,height:rect.height,nativeAngularWidthPx:Math.abs(((angular[1]-angular[0]+decoded.width*1.5)%decoded.width)-decoded.width*.5),geometryRevision:entry.owner.geometryRevision,geometryRevisionVerified:false,plane,pixelToMetres:{xMetresPerPixel:width/rect.width,zMetresPerPixel:(plane.topZ-plane.baseZ)/rect.height,origin:plane.start,topNAP:plane.topZ},registration:{status:'ambiguous',reason:'Projected onto selected physical shell/BAG plane using cached camera pose; independent visual-anchor and geometry registration still required.'},occlusion:{status:'unreviewed'},coverage:tier==='full'?['ground','upper','roof']:[tier],path:path.relative(root,path.join(out,file)),url:'./'+file,sourceAvailable:true,sourceObservationFacadeId:source.record.elevationId,cameraFit:source.fit,selectedReason:'Two best frontal native-resolution cached cameras per year; independent panorama acquisition keys.',rectifier:'src/canalRecall/facade/rectify.ts:AMSTERDAM_WORLD_ALIGNED',datum:source.image.datum,pose:source.image.pose});
  }
 }
 const coverage=[...years.keys()].sort().map(year=>({year,...Object.fromEntries(['ground','upper','roof'].map(region=>{const c=derived.filter(c=>c.captureDate.startsWith(year)&&c.coverage.includes(region));return [region,{captures:[...new Set(c.map(c=>c.captureKey))],crops:c.length,registered:0,visible:'unreviewed'}]}))}));
 const bundle={schemaVersion:1,id:entry.id,ownerId:entry.owner.id,geometryRevision:entry.owner.geometryRevision,physicalFacade:{plane:target,frontage:entry.front,originalObservationPlane:primary.images.full.plane,associationDiscrepancy:entry.expansionAudit.originalPlaneEndpointErrorM>.3},targetAppearanceDate:entry.source.ground.captureDate,candidates:inventory.evidence,derived,coverage,searchedYears:[...years.keys()].sort(),searchedLocations:inventory.searchedLocations,gaps:['Visual source identity, visibility and independent metric anchors require review.','No multiyear hidden-feature recovery performed; no metric-registration acceptance.'],policy:'Owner AND physical facade binding required; only cached whole panoramas are reprojected. Native upsampling is not source resolution.'};
 await fs.writeFile(path.join(out,entry.id+'.json'),JSON.stringify(bundle,null,2)+'\n');
 audit.push({id:entry.id,years:[...years.keys()].sort(),independentCaptures:selected.length,derivedCrops:derived.length,registered:0});
 console.log(JSON.stringify(audit.at(-1)));
}
await fs.writeFile(path.join(out,'audit.json'),JSON.stringify({reviewDate:'2026-10-01',models:audit,downloads:0},null,2)+'\n');
