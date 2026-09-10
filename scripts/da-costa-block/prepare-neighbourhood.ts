/** Cache-only geometry selection, bounded panorama downloads, three evidence views. */
import fs from 'node:fs/promises';
import path from 'node:path';
import jpeg from 'jpeg-js';
import sharp from 'sharp';
import { buildFootprintElevations } from './footprint-elevations.ts';
import { AMSTERDAM_WORLD_ALIGNED, rectifyFacade, worldToEquirectangularPixel } from '../../src/canalRecall/facade/rectify.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';
import { VERSION, VISIBILITY_VERSION, VERTICAL_EXTENT_VERSION, sha, lensFor, inside, footprintOcclusion, wallVerticalExtent } from './neighbourhood-core.ts';
import { loadAreaConfig } from './area-config.mjs';

const arg=(n:string,d:string)=>process.argv.find(v=>v.startsWith(`--${n}=`))?.slice(n.length+3)??d;
const area=await loadAreaConfig(),custom=!area.referencePreset;
const root=arg('out',custom?`.cache/city-appearance/areas/${area.id}/evidence`:'.cache/da-costa-neighbourhood');
const inventoryOnly=process.argv.includes('--inventory');
const onlyBuilding=arg('building','');
const onlyElevation=arg('elevation','');
const selectedElevations=new Set(onlyElevation.split(',').filter(Boolean));
const useWallHeights=process.argv.includes('--wall-heights');
const reusePanoramas=arg('reuse-panoramas','.cache/da-costa-neighbourhood/panoramas');
if(!inventoryOnly&&path.resolve(root)===path.resolve('.cache/da-costa-neighbourhood')&&!process.argv.includes('--allow-active-write'))
  throw Error('Use --out=<staging-root> for revised visibility evidence; active replacement requires --allow-active-write.');
const limit=Number(arg('limit','100')), downloadLimit=Number(arg('downloads',custom?'0':'70'));
if(!Number.isInteger(limit)||limit<0||!Number.isInteger(downloadLimit)||downloadLimit<0)throw Error('Limit and downloads must be nonnegative integers');
const read=async(p:string)=>JSON.parse(await fs.readFile(p,'utf8'));
const block=await read(arg('block',path.join(area.outputRoot,'block.json')));
if(custom&&block.areaConfigHash!==area.configHash)throw Error('Compiled block does not match area configuration');
const bag=await read(path.join(area.cacheRoot,'bag.json'));
const panos=(await read(path.join(area.cacheRoot,'panoramas.json'))).filter((p:any)=>p.surface_type==='L');
const sourceHash=sha(JSON.stringify({block,bag,panos,version:VERSION,visibility:VISIBILITY_VERSION,...(useWallHeights?{verticalExtent:VERTICAL_EXTENT_VERSION}:{}),camera:AMSTERDAM_WORLD_ALIGNED}));
if(!inventoryOnly){await fs.mkdir(path.join(root,'images'),{recursive:true});await fs.mkdir(path.join(root,'panoramas'),{recursive:true});}
const registry=new Map(bag.map((f:any)=>[f.properties.identificatie,f]));
const toLocal=(p:any)=>[p.x-block.origin.x,block.origin.y-p.y];
const buildings=block.buildings.filter((b:any)=>(!onlyBuilding||b.id===onlyBuilding)&&b.addresses.length&&b.height>5&&
  (custom||area.referencePreset==='elandsgracht'?custom||b.street==='Elandsgracht':(['Da Costakade','Da Costastraat','De Clercqstraat','Nassaukade'].includes(b.street)||b.anchorIds?.length)));
const cameraPoints=panos.map((p:any)=>({...p,rd:lngLatToRd(p.geometry.coordinates)}));
// Use the same BAG footprint as target-wall construction for self-occlusion;
// otherwise a different footprint vintage can falsely put the endpoint indoors.
const visibilityBuildings=block.buildings.map((b:any)=>{
  const source:any=registry.get(b.id);
  const polygons=source?(source.geometry.type==='Polygon'?[source.geometry.coordinates]:source.geometry.coordinates)
    .map((poly:any)=>poly.map((ring:any)=>ring.map((p:any)=>toLocal(lngLatToRd(p))))):b.footprint.coordinates;
  const points=polygons.flat(2),xs=points.map((p:any)=>p[0]),ys=points.map((p:any)=>p[1]);
  return {id:b.id,polygons,bounds:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]};
});
const blockers=(from:number[],to:number[])=>visibilityBuildings.filter((b:any)=>{
  if(Math.max(from[0],to[0])<b.bounds[0]||Math.min(from[0],to[0])>b.bounds[2]||Math.max(from[1],to[1])<b.bounds[1]||Math.min(from[1],to[1])>b.bounds[3])return false;
  return footprintOcclusion(from,to,b.polygons).blocked;
}).map((b:any)=>b.id);
const targets:any[]=[];
for(const b of buildings){
  const source:any=registry.get(b.id);if(!source)continue;
  const walls=buildFootprintElevations(source.geometry,{pandId:b.id,minLengthM:3});
  for(const wall of walls){
    if(selectedElevations.size&&!selectedElevations.has(wall.elevationId.replaceAll(':','_')))continue;
    const verticalExtent=wallVerticalExtent(b,{localStart:toLocal(wall.start),localEnd:toLocal(wall.end)});
    const targetHeight=useWallHeights?verticalExtent.topNAP-(b.groundNAP??.65):b.height;
    const mid=toLocal(wall.midpoint),normal=[wall.normal.x,-wall.normal.y];
    const publicFace=[2,5,9,14].some(d=>{const p=[mid[0]+normal[0]*d,mid[1]+normal[1]*d];return block.layers.wegdeel.some((f:any)=>/voet|woon|rijbaan|fiets/.test(f.kind)&&f.geometry.coordinates.some((poly:any)=>inside(p,poly[0])&&!poly.slice(1).some((hole:any)=>inside(p,hole))));});
    if(!publicFace)continue;
    const ranked=[];
    for(const p of cameraPoints){
      const dx=p.rd.x-wall.midpoint.x,dy=p.rd.y-wall.midpoint.y;
      const distance=Math.hypot(dx,dy),standoff=dx*wall.normal.x+dy*wall.normal.y;
      if(standoff<3||distance>52)continue;
      const angle=Math.acos(Math.min(1,standoff/distance))*180/Math.PI;if(angle>48)continue;
      const from=toLocal(p.rd);
      const rayBlockers=[.15,.5,.85].map(t=>blockers(from,toLocal({x:wall.start.x+(wall.end.x-wall.start.x)*t,y:wall.start.y+(wall.end.y-wall.start.y)*t})));
      const hidden=rayBlockers.filter(ids=>ids.length).length/3;
      if(hidden>.34)continue;
      const nearest=block.buildings.filter((n:any)=>Number.isFinite(n.groundNAP)).sort((a:any,c:any)=>Math.hypot(a.center[0]-from[0],a.center[1]-from[1])-Math.hypot(c.center[0]-from[0],c.center[1]-from[1]))[0];
      const lens=lensFor(p,nearest?.groundNAP);if(!lens)continue;
      const fullQuality=Math.min(8000/(2*Math.PI)*Math.cos(angle*Math.PI/180)/standoff,4000/Math.PI*standoff/(standoff*standoff+targetHeight*targetHeight));
      const detailQuality=8000/(2*Math.PI)*Math.cos(angle*Math.PI/180)/standoff;
      const recent=Number(p.timestamp.slice(0,4))>=2025?1.15:1;
      const month=Number(p.timestamp.slice(5,7)),winter=month>=11||month<=3;
      // Soft preference preserves a much closer leaf-on view; canopy is checked in pixels later.
      ranked.push({p,lens,standoff,angle,hidden,rayBlockers,fullScore:fullQuality*(1-hidden)*recent*(winter?1.4:1),detailScore:detailQuality*(1-hidden)*recent});
    }
    if(!ranked.length)continue;
    const full=[...ranked].sort((a,b)=>b.fullScore-a.fullScore)[0];
    const detail=[...ranked].sort((a,b)=>b.detailScore-a.detailScore)[0];
    targets.push({b,wall,full,detail,mid,normal,verticalExtent});
  }
}
// Street order includes both shopping-street sides; no named shop or model result influences selection.
targets.sort((a,b)=>a.b.street.localeCompare(b.b.street)||a.mid[1]-b.mid[1]||a.mid[0]-b.mid[0]);
if(inventoryOnly){
  const selected=targets.slice(0,limit),panoramaIds=[...new Set(selected.flatMap(t=>[t.full.p.pano_id,t.detail.p.pano_id]))].sort();
  const output=JSON.stringify({version:1,areaId:area.id,areaConfigHash:area.configHash,sourceHash,inventoryOnly:true,
    buildings:buildings.length,candidateFrontages:targets.length,selectedFrontages:selected.length,
    selectedFacadeLengthM:selected.reduce((sum,t)=>sum+t.wall.lengthM,0),panoramaIds,
    records:selected.map(t=>({id:t.wall.elevationId.replaceAll(':','_'),buildingId:t.b.id,street:t.b.street,wallWidthM:t.wall.lengthM,fullPanorama:t.full.p.pano_id,groundPanorama:t.detail.p.pano_id})),downloads:0,paidCalls:0},null,2);
  // process.exit can truncate piped output once inventories exceed the stream's
  // internal buffer (the first real tranche crossed 64 KiB). Wait for the write.
  await new Promise<void>((resolve,reject)=>process.stdout.write(output,error=>error?reject(error):resolve()));
  process.exit(0);
}
let downloads=0;const decoded=new Map<string,any>();const records:any[]=[],omitted:any[]=[];
async function panorama(p:any){
  if(decoded.has(p.pano_id))return decoded.get(p.pano_id);
  const file=path.join(root,'panoramas',p.pano_id+'.jpg');let bytes;
  try{bytes=await fs.readFile(file);}catch{
    try{bytes=await fs.readFile(path.join(reusePanoramas,p.pano_id+'.jpg'));await fs.writeFile(file,bytes);}catch{}
  }
  if(!bytes){
    if(downloads>=downloadLimit)throw Error('download-cap');
    const url=p._links.equirectangular_full.href;
    const r=await fetch(url,{signal:AbortSignal.timeout(45000)});if(!r.ok)throw Error(`panorama-http-${r.status}`);
    bytes=Buffer.from(await r.arrayBuffer());downloads++;await fs.writeFile(file,bytes);
  }
  const image=jpeg.decode(bytes,{useTArray:true,formatAsRGBA:true});
  const value={image,hash:sha(bytes)};decoded.set(p.pano_id,value);
  // Decoded 8K panoramas are large. Keep only a small reuse window.
  if(decoded.size>3)decoded.delete(decoded.keys().next().value!);
  return value;
}
for(const target of targets.slice(0,limit)){
  const {b,wall,full,detail,mid,normal,verticalExtent}=target;
  try{
    const id=wall.elevationId.replaceAll(':','_');
    const images:any={};
    for(const kind of ['full','ground','roof','context']){
      const v=kind==='ground'?detail:full;const {image,hash}=await panorama(v.p);
      const ground=Number.isFinite(b.groundNAP)?b.groundNAP:.65;
      const top=useWallHeights?verticalExtent.topNAP:Math.max(...b.surfaces.flatMap((s:any)=>s.rings.flatMap((r:any)=>r.map((q:any)=>q[1]+.65))),ground+b.height);
      const margin=kind==='context'?.7:.02;
      const dx=wall.end.x-wall.start.x,dy=wall.end.y-wall.start.y;
      const plane={start:{x:wall.start.x-dx*margin,y:wall.start.y-dy*margin},end:{x:wall.end.x+dx*margin,y:wall.end.y+dy*margin},baseZ:kind==='roof'?Math.max(ground,top-7):ground-.3,topZ:kind==='ground'?ground+4.6:top+1.2};
      const rect=rectifyFacade(image,v.lens.pose,plane,{camera:AMSTERDAM_WORLD_ALIGNED,pixelsPerMetre:kind==='ground'?110:45,maxPixels:1400000});
      const file=`${id}-${kind}.jpg`;const bytes=jpeg.encode({width:rect.width,height:rect.height,data:Buffer.from(rect.data)},89).data;
      const stats=await sharp(bytes).stats();
      if(stats.channels.slice(0,3).every(c=>c.stdev<6))throw Error('blank-crop');
      await fs.writeFile(path.join(root,'images',file),bytes);
      images[kind]={file,sha256:sha(bytes),panoramaId:v.p.pano_id,panoramaSha256:hash,date:v.p.timestamp,url:v.p._links.equirectangular_full.href,visibility:{version:VISIBILITY_VERSION,hiddenFraction:v.hidden,rayBlockers:v.rayBlockers},...(useWallHeights?{verticalExtent}:{}),
        pose:v.lens.pose,heightInferred:v.lens.inferred,datum:v.lens.datum,plane,width:rect.width,height:rect.height,sourceDimensions:[image.width,image.height],standoff:v.standoff,obliquity:v.angle};
      if(kind==='full'&&records.length<6){
        const legacy=rectifyFacade(image,v.lens.pose,plane,{yaw:'centre',pixelsPerMetre:45,maxPixels:1400000});
        await fs.writeFile(path.join(root,'images',id+'-legacy.jpg'),jpeg.encode({width:legacy.width,height:legacy.height,data:Buffer.from(legacy.data)},85).data);
        const quad=[wall.start,wall.end].flatMap(p=>[worldToEquirectangularPixel({...p,z:ground},v.lens.pose,image,AMSTERDAM_WORLD_ALIGNED),worldToEquirectangularPixel({...p,z:top},v.lens.pose,image,AMSTERDAM_WORLD_ALIGNED)]);
        images.full.rawQuad=quad;
      }
    }
    records.push({id,buildingId:b.id,elevationId:wall.elevationId,address:b.addresses.join(' / '),street:b.street,year:b.year,
      wallWidthM:wall.lengthM,height:b.height,wall,mid,normal,localStart:toLocal(wall.start),localEnd:toLocal(wall.end),
      groundNAP:b.groundNAP,roofGeometry:b.roofType,images,
      derivationKey:sha(JSON.stringify({sourceHash,wall,images})),placement:'unreviewed',metricEligible:false});
    console.log(`${records.length}/${Math.min(limit,targets.length)} ${b.addresses[0]} ${wall.lengthM.toFixed(1)}m`);
  }catch(e){omitted.push({elevationId:wall.elevationId,buildingId:b.id,reason:String(e)});console.log(`omit ${b.id}: ${e}`);}
  await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify({version:VERSION,visibility:VISIBILITY_VERSION,sourceHash,camera:AMSTERDAM_WORLD_ALIGNED,generatedAt:new Date().toISOString(),origin:block.origin,bounds:block.bounds,records,omitted,candidates:targets.length,downloads},null,2));
}
console.log(JSON.stringify({frontages:records.length,buildings:new Set(records.map(r=>r.buildingId)).size,omitted:omitted.length,downloads}));
