/** Cache-only diagnostic; never compiles bay observations into whole-wall appearance. */
import fs from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import {AMSTERDAM_WORLD_ALIGNED,rectifyFacade,worldToEquirectangularPixel} from '../../src/canalRecall/facade/rectify.ts';
import {lngLatToRd} from '../../src/canalRecall/facade/rdNew.ts';
import {sha,lensFor,footprintOcclusion,VISIBILITY_VERSION} from './neighbourhood-core.ts';
import {wallBayIntervals} from './bay-geometry.ts';
const VERSION='ground-bay-evidence/v1';
const root=process.argv.find(v=>v.startsWith('--out='))?.slice(6)??'.cache/da-costa-ground-bays';
if(path.resolve(root)===path.resolve('.cache/da-costa-neighbourhood')||path.resolve(root).startsWith(path.resolve('.cache/da-costa-neighbourhood')+path.sep))throw Error('Bay experiment must not write into active cache');
const read=async(p:string)=>JSON.parse(await fs.readFile(p,'utf8'));
const bytes=await fs.readFile('.cache/da-costa-neighbourhood/manifest.json'),manifest=JSON.parse(bytes.toString('utf8'));
const block=await read('public/data/da-costa-block/block.json'),bag=await read('.cache/da-costa-block/bag.json');
const allPanoramas=await read('.cache/da-costa-block/panoramas.json');
const parentIds=['0363100012077314_e_14o9326','0363100012237064_e_1hyy18v'];
const parents=parentIds.map(id=>manifest.records.find((r:any)=>r.id===id));
if(parents.some(r=>!r))throw Error('Missing planned parent frontage');
const panoRoot='.cache/da-costa-neighbourhood/panoramas',cached=new Set((await fs.readdir(panoRoot)).filter(n=>n.endsWith('.jpg')).map(n=>n.slice(0,-4)));
const registry=new Map(bag.map((b:any)=>[b.properties.identificatie,b]));
const local=(p:any)=>[p.x-block.origin.x,block.origin.y-p.y];
const occluders=block.buildings.map((b:any)=>{
  const source:any=registry.get(b.id);
  const polygons=source?(source.geometry.type==='Polygon'?[source.geometry.coordinates]:source.geometry.coordinates).map((p:any)=>p.map((r:any)=>r.map((v:any)=>local(lngLatToRd(v))))):b.footprint.coordinates;
  const points=polygons.flat(2),xs=points.map((p:any)=>p[0]),zs=points.map((p:any)=>p[1]);
  return {id:b.id,polygons,bounds:[Math.min(...xs),Math.min(...zs),Math.max(...xs),Math.max(...zs)]};
});
const blockers=(a:number[],b:number[])=>occluders.filter((o:any)=>{
  if(Math.max(a[0],b[0])<o.bounds[0]||Math.min(a[0],b[0])>o.bounds[2]||Math.max(a[1],b[1])<o.bounds[1]||Math.min(a[1],b[1])>o.bounds[3])return false;
  return footprintOcclusion(a,b,o.polygons).blocked;
}).map((b:any)=>b.id);
const cameras=allPanoramas.filter((p:any)=>cached.has(p.pano_id)&&p.surface_type==='L').flatMap((p:any)=>{
  const rd=lngLatToRd(p.geometry.coordinates),from=local(rd);
  const nearest=block.buildings.filter((b:any)=>Number.isFinite(b.groundNAP)).sort((a:any,b:any)=>Math.hypot(a.center[0]-from[0],a.center[1]-from[1])-Math.hypot(b.center[0]-from[0],b.center[1]-from[1]))[0];
  const lens=lensFor(p,nearest?.groundNAP);return lens?[{p,lens}]:[];
});
const decoded=new Map<string,any>();
async function panorama(id:string){
  if(decoded.has(id))return decoded.get(id);
  const file=path.join(panoRoot,id+'.jpg'),bytes=await fs.readFile(file),value={image:jpeg.decode(bytes,{useTArray:true,formatAsRGBA:true}),sha256:sha(bytes)};
  decoded.set(id,value);if(decoded.size>3)decoded.delete(decoded.keys().next().value!);return value;
}
await fs.mkdir(root+'/images',{recursive:true});
const records:any[]=[];
for(const parent of parents){
  const length=parent.wallWidthM,point=(m:number)=>({x:parent.wall.start.x+(parent.wall.end.x-parent.wall.start.x)*m/length,y:parent.wall.start.y+(parent.wall.end.y-parent.wall.start.y)*m/length});
  for(const interval of wallBayIntervals(length)){
    const id=parent.id+'_bay_'+String(interval.index+1).padStart(2,'0'),start=point(interval.startM),end=point(interval.endM),mid=point((interval.startM+interval.endM)/2);
    const visibility=(pose:any)=>{
      const dx=pose.x-mid.x,dy=pose.y-mid.y,distance=Math.hypot(dx,dy),standoff=dx*parent.wall.normal.x+dy*parent.wall.normal.y;
      const obliquity=distance?Math.acos(Math.max(-1,Math.min(1,standoff/distance)))*180/Math.PI:90;
      const rays=[.15,.5,.85].map(t=>blockers(local(pose),local({x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t})));
      const hiddenFraction=rays.filter(r=>r.length).length/3;
      return {version:VISIBILITY_VERSION,distance,standoff,obliquity,hiddenFraction,rayBlockers:rays,geometryEligible:standoff>=3&&distance<=52&&obliquity<=48&&hiddenFraction<=.34};
    };
    const ranked=cameras.map(c=>({...c,visibility:visibility(c.lens.pose)})).filter(c=>c.visibility.geometryEligible)
      .map(c=>({...c,score:8000/(2*Math.PI)*Math.cos(c.visibility.obliquity*Math.PI/180)/c.visibility.standoff*(1-c.visibility.hiddenFraction)*(Number(c.p.timestamp.slice(0,4))>=2025?1.15:1)})).sort((a,b)=>b.score-a.score);
    const best=ranked[0];
    const variants=[{kind:'same-source',panoramaId:parent.images.ground.panoramaId,pose:parent.images.ground.pose,date:parent.images.ground.date,url:parent.images.ground.url,datum:parent.images.ground.datum,start,end,baseZ:parent.images.ground.plane.baseZ,topZ:parent.images.ground.plane.topZ},
      ...(best?[{kind:'best-cached',panoramaId:best.p.pano_id,pose:best.lens.pose,date:best.p.timestamp,url:best.p._links.equirectangular_full.href,datum:best.lens.datum,start,end,baseZ:parent.images.ground.plane.baseZ,topZ:parent.images.ground.plane.topZ},
      {kind:'context',panoramaId:best.p.pano_id,pose:best.lens.pose,date:best.p.timestamp,url:best.p._links.equirectangular_full.href,datum:best.lens.datum,start:point(Math.max(0,interval.startM-1.5)),end:point(Math.min(length,interval.endM+1.5)),baseZ:parent.images.ground.plane.baseZ,topZ:parent.groundNAP+7}]:[])];
    const images:any={};
    for(const v of variants){
      const source=await panorama(v.panoramaId),plane={start:v.start,end:v.end,baseZ:v.baseZ,topZ:v.topZ};
      const rect=rectifyFacade(source.image,v.pose,plane,{camera:AMSTERDAM_WORLD_ALIGNED,pixelsPerMetre:110,maxPixels:1600000});
      const file=id+'-'+v.kind+'.jpg',bytes=jpeg.encode({width:rect.width,height:rect.height,data:Buffer.from(rect.data)},90).data;
      await fs.writeFile(root+'/images/'+file,bytes);
      images[v.kind]={file,sha256:sha(bytes),panoramaId:v.panoramaId,panoramaSha256:source.sha256,date:v.date,url:v.url,pose:v.pose,datum:v.datum,plane,width:rect.width,height:rect.height,visibility:visibility(v.pose),rawQuad:[v.start,v.end].flatMap(p=>[worldToEquirectangularPixel({...p,z:v.baseZ},v.pose,source.image,AMSTERDAM_WORLD_ALIGNED),worldToEquirectangularPixel({...p,z:v.topZ},v.pose,source.image,AMSTERDAM_WORLD_ALIGNED)]),note:v.kind==='context'?'Context extends at most1.5m beyond bay, clamped to parent wall; adjacent-bay content must not become this bay label.':null};
    }
    records.push({id,parentId:parent.id,parentBuildingId:parent.buildingId,parentElevationId:parent.elevationId,parentDerivationKey:parent.derivationKey,parentGroundImage:{file:parent.images.ground.file,sha256:parent.images.ground.sha256},interval:{...interval,lengthM:interval.endM-interval.startM,unit:'metres from ordered parent wall start'},wall:{start,end,normal:parent.wall.normal,localStart:local(start),localEnd:local(end)},images,derivationKey:sha(JSON.stringify({version:VERSION,parentDerivationKey:parent.derivationKey,interval,start,end,images})),bestCachedCandidates:ranked.length});
    console.log(`${id} ${interval.startM.toFixed(2)}–${interval.endM.toFixed(2)}m best=${best?.p.pano_id??'none'}`);
  }
}
const summary={parents:parents.length,distinctBuildings:new Set(parents.map(p=>p.buildingId)).size,bays:records.length,cachedPanoramas:cached.size,withoutEligibleBest:records.filter(r=>!r.images['best-cached']).length,sameSourceGeometryIneligible:records.filter(r=>!r.images['same-source'].visibility.geometryEligible).length,downloads:0,inferenceCostUsd:0};
await fs.writeFile(root+'/manifest.json',JSON.stringify({version:VERSION,sourceManifestFileHash:sha(bytes),camera:AMSTERDAM_WORLD_ALIGNED,policy:'Diagnostic bay projections only. Equal metric subdivisions are not tenant boundaries. No active whole-wall proposals, renderer state, reviews or paid outputs changed. Unknown/occluded bays must stay unknown; mixed evidence must not be collapsed to a whole-wall boolean.',summary,records},null,2));
console.log(JSON.stringify(summary));
