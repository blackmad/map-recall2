/** Offline explanation of owners absent from the frozen district frontage inventory.
 * Mirrors the candidate cascade in prepare-neighbourhood.ts without downloading or
 * rectifying panoramas. This diagnostic is not a policy change. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadDistrictConfig } from '../city-appearance/district-config.mjs';
import { planDistrictCoverageQueue } from '../city-appearance/select-panorama-audit.mjs';
import { buildFootprintElevations } from '../da-costa-block/footprint-elevations.ts';
import { inside, footprintOcclusion, lensFor, sha } from '../da-costa-block/neighbourhood-core.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';

const flag=(name:string)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.slice(name.length+3);
const read=async(file:string)=>JSON.parse(await fs.readFile(file,'utf8'));
const spatialIndex=(items:any[], boundsFor:(value:any)=>number[])=>{
  const grid=new Map<string,number[]>();
  items.forEach((item,index)=>{const b=boundsFor(item);for(let x=Math.floor(b[0]/60);x<=Math.floor(b[2]/60);x++)for(let y=Math.floor(b[1]/60);y<=Math.floor(b[3]/60);y++){
    const key=`${x},${y}`, bucket=grid.get(key)??[];bucket.push(index);grid.set(key,bucket);
  }});
  return (b:number[])=>{const ids=new Set<number>();for(let x=Math.floor(b[0]/60);x<=Math.floor(b[2]/60);x++)for(let y=Math.floor(b[1]/60);y<=Math.floor(b[3]/60);y++)for(const index of grid.get(`${x},${y}`)??[])ids.add(index);return [...ids].sort((a,b)=>a-b).map(index=>items[index]);};
};
const increment=(map:Record<string,number>,key:string,n=1)=>map[key]=(map[key]??0)+n;

function makeDiagnostic(source:any, bag:any[], panos:any[]) {
  const block=source.block, registry=new Map(bag.map((f:any)=>[f.properties.identificatie,f]));
  const toLocal=(p:any)=>[p.x-block.origin.x,block.origin.y-p.y];
  const visibilityBuildings=block.buildings.map((b:any)=>{
    const sourceFeature=registry.get(b.id);
    const polygons=sourceFeature?(sourceFeature.geometry.type==='Polygon'?[sourceFeature.geometry.coordinates]:sourceFeature.geometry.coordinates)
      .map((poly:any)=>poly.map((ring:any)=>ring.map((p:any)=>toLocal(lngLatToRd(p))))):b.footprint.coordinates;
    const points=polygons.flat(2), xs=points.map((p:any)=>p[0]), ys=points.map((p:any)=>p[1]);
    return {id:b.id,polygons,bounds:[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)]};
  });
  const nearbyBuildings=spatialIndex(visibilityBuildings,(b:any)=>b.bounds);
  const publicRoads=block.layers.wegdeel.filter((f:any)=>/voet|woon|rijbaan|fiets/.test(f.kind));
  const nearbyRoads=spatialIndex(publicRoads,(f:any)=>{const points=f.geometry.coordinates.flat(2),xs=points.map((p:any)=>p[0]),ys=points.map((p:any)=>p[1]);return[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];});
  const cameraPoints=panos.filter((p:any)=>p.surface_type==='L').map((p:any,index:number)=>({...p,_order:index,rd:lngLatToRd(p.geometry.coordinates)}));
  const panoGrid=new Map<string,any[]>();for(const p of cameraPoints){const key=`${Math.floor(p.rd.x/60)},${Math.floor(p.rd.y/60)}`, bucket=panoGrid.get(key)??[];bucket.push(p);panoGrid.set(key,bucket);}
  const nearbyPanoramas=(mid:any)=>{const x=Math.floor(mid.x/60),y=Math.floor(mid.y/60),result:any[]=[];for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)result.push(...(panoGrid.get(`${x+dx},${y+dy}`)??[]));return result.sort((a,b)=>a._order-b._order);};
  const lensCache=new Map<string,any>();
  const cachedLens=(p:any,from:number[])=>{if(lensCache.has(p.pano_id))return lensCache.get(p.pano_id);let nearest:any,best=Infinity;for(const n of block.buildings){if(!Number.isFinite(n.groundNAP))continue;const distance=Math.hypot(n.center[0]-from[0],n.center[1]-from[1]);if(distance<best){best=distance;nearest=n;}}const lens=lensFor(p,nearest?.groundNAP);lensCache.set(p.pano_id,lens);return lens;};
  const blockers=(from:number[],to:number[])=>nearbyBuildings([Math.min(from[0],to[0]),Math.min(from[1],to[1]),Math.max(from[0],to[0]),Math.max(from[1],to[1])]).filter((b:any)=>footprintOcclusion(from,to,b.polygons).blocked).map((b:any)=>b.id);
  const publicFace=(wall:any)=>{const mid=toLocal(wall.midpoint), normal=[wall.normal.x,-wall.normal.y];return [2,5,9,14].some(d=>{const point=[mid[0]+normal[0]*d,mid[1]+normal[1]*d];return nearbyRoads([point[0],point[1],point[0],point[1]]).some((f:any)=>f.geometry.coordinates.some((poly:any)=>inside(point,poly[0])&&!poly.slice(1).some((hole:any)=>inside(point,hole))));});};
  const diagnose=(building:any)=>{
    const feature=registry.get(building.id); if(!feature)return {stage:'missing-bag-footprint',walls:{all:0,min3:0,publicRoad:0},views:{nearby:0,distanceStandoff:0,obliquity:0,occlusion:0,lens:0},dateYears:{}};
    const all=buildFootprintElevations(feature.geometry,{pandId:building.id,minLengthM:0});
    const walls=all.filter(w=>w.lengthM>=3), road=walls.filter(publicFace);
    const views={nearby:0,distanceStandoff:0,obliquity:0,occlusion:0,lens:0}, dateYears:Record<string,number>={};
    for(const wall of road) for(const p of nearbyPanoramas(wall.midpoint)){
      views.nearby++; const dx=p.rd.x-wall.midpoint.x,dy=p.rd.y-wall.midpoint.y,distance=Math.hypot(dx,dy),standoff=dx*wall.normal.x+dy*wall.normal.y;
      if(standoff<3||distance>52)continue; views.distanceStandoff++;
      const angle=Math.acos(Math.min(1,standoff/distance))*180/Math.PI;if(angle>48)continue; views.obliquity++;
      const from=toLocal(p.rd), rays=[.15,.5,.85].map(t=>blockers(from,toLocal({x:wall.start.x+(wall.end.x-wall.start.x)*t,y:wall.start.y+(wall.end.y-wall.start.y)*t})));
      if(rays.filter(ids=>ids.length).length/3>.34)continue; views.occlusion++;
      if(!cachedLens(p,from))continue; views.lens++; increment(dateYears,String(p.timestamp).slice(0,4));
    }
    const stage=walls.length===0?'minimum-wall-length':road.length===0?'public-road-face':views.nearby===0?'camera-grid-radius':views.distanceStandoff===0?'distance-or-standoff':views.obliquity===0?'obliquity':views.occlusion===0?'footprint-occlusion':views.lens===0?'lens-inference':'candidate-would-exist';
    return {stage,walls:{all:all.length,min3:walls.length,publicRoad:road.length},views,dateYears};
  };
  return {diagnose};
}

async function main(){
  const districtConfig=path.resolve(flag('district-config')??'scripts/city-appearance/districts/da-costa-jordaan-v1.json');
  const district=await loadDistrictConfig(districtConfig), areas:any[]=[];
  for(const member of district.areas){
    const queue=await planDistrictCoverageQueue({...member.area,configHash:member.configHash},{districtConfigFile:districtConfig});
    const [bag,panos]=await Promise.all([read(path.join(member.area.cacheRoot,'bag.json')),read(path.join(member.area.cacheRoot,'panoramas.json'))]);
    const byId=new Map(queue.source.block.buildings.map((b:any)=>[b.id,b])), accepted=new Set(queue.records.map((r:any)=>r.buildingId));
    const absent=[...queue.ownerIds].filter(id=>!accepted.has(id)).map(id=>byId.get(id));
    const engine=makeDiagnostic(queue.source,bag,panos), stages:Record<string,number>={}, addressOnly:any[]=[];
    const passBoth=absent.filter((b:any)=>b.addresses?.length&&b.height>5);
    const records=passBoth.map((b:any)=>{const result=engine.diagnose(b);increment(stages,result.stage);return {buildingId:b.id,stage:result.stage};});
    for(const b of absent.filter((b:any)=>!b.addresses?.length&&b.height>5)){const result=engine.diagnose(b);addressOnly.push({buildingId:b.id,stage:result.stage});}
    const stageOwnerIds=(rows:any[])=>Object.fromEntries([...new Set(rows.map(row=>row.stage))].sort().map(stage=>[stage,rows.filter(row=>row.stage===stage).map(row=>row.buildingId).sort()]));
    areas.push({areaId:member.id,queueHash:queue.queueHash,noCandidateOwners:absent.length,passesAddressAndHeight:passBoth.length,passBothStages:stages,passBothStageOwnerIds:stageOwnerIds(records),addresslessAbove5m:{owners:addressOnly.length,candidateWouldExist:addressOnly.filter(r=>r.stage==='candidate-would-exist').length,candidateOwnerIds:addressOnly.filter(r=>r.stage==='candidate-would-exist').map(r=>r.buildingId).sort(),stages:addressOnly.reduce((acc,r)=>(increment(acc,r.stage),acc),{} as Record<string,number>),stageOwnerIds:stageOwnerIds(addressOnly)}});
  }
  const report={version:1,generatedAt:new Date().toISOString(),districtId:district.id,districtConfigHash:district.configHash,method:'Offline reproduction of prepare-neighbourhood.ts candidate cascade on frozen BAG, compiled block, road and panorama metadata. No downloads, rectification, model inference or policy change.',policy:{address:'diagnostic separately evaluates only no-address owners above 5m; exact BAG ID/footprint remains binding',height:'no relaxation evaluated',date:'No date gate exists: date only affects ranking preference after a candidate survives geometry, occlusion and lens checks.'},thresholds:{minimumWallLengthM:3,publicRoadProbeM:[2,5,9,14],cameraGridCellM:60,nearbyGridCells:1,standoffMinM:3,distanceMaxM:52,obliquityMaxDeg:48,blockedRayFractionMax:0.34,raySamples:[.15,.5,.85]},areas};
  const out=path.resolve(flag('out')??'review-data/district-rectification/gap-selector-diagnostic.json');await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,areas:areas.map(a=>({areaId:a.areaId,passBothStages:a.passBothStages,addresslessAbove5m:{owners:a.addresslessAbove5m.owners,candidateWouldExist:a.addresslessAbove5m.candidateWouldExist,stages:a.addresslessAbove5m.stages}}))},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(error=>{console.error(error.stack??error);process.exitCode=1;});
