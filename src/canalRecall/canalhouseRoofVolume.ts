import type {CanalHouseRecipe,CanalhousePoint} from './canalhouseRecipes';

type Roof=CanalHouseRecipe['roof']['value'][number];
export interface CanalhouseRoofVolume {
 seedSurfaceIds:string[];
 depthM:[number,number];
 minHeightM:number;
 excludedSurfaceIds?:string[];
 sourceReview:string;
}
/** Select a connected surveyed volume, rather than separately fitting its front
 * and rear survey partitions. This chooses coverage, never a roof family. */
export function canalhouseRoofVolume(roofs:Roof[],owners:string[],front:{a:CanalhousePoint;normal:CanalhousePoint},selection:CanalhouseRoofVolume){
 const {depthM,minHeightM,seedSurfaceIds}=selection,tolerance=.02;
 if(owners.length!==roofs.length||!seedSurfaceIds.length||new Set(seedSurfaceIds).size!==seedSurfaceIds.length||!depthM.every(Number.isFinite)||depthM[1]<=depthM[0]||!Number.isFinite(minHeightM)||!selection.sourceReview.trim())throw Error('Invalid reviewed roof volume');
 const ids=[...new Set(owners)],excluded=new Set(selection.excludedSurfaceIds??[]);
 if([...seedSurfaceIds,...excluded].some(id=>!ids.includes(id))||seedSurfaceIds.some(id=>excluded.has(id)))throw Error('Unknown or excluded roof volume seed');
 const groups=ids.map(id=>({id,roofs:roofs.filter((_,i)=>owners[i]===id)}));
 const pointDepth=(p:CanalhousePoint)=>-(p[0]-front.a[0])*front.normal[0]-(p[1]-front.a[1])*front.normal[1];
 const bounds=groups.map(g=>{
  const depths=g.roofs.flatMap(r=>r.polygon.outer.map(pointDepth));
  const heights=g.roofs.flatMap(r=>r.polygon.outer.map(p=>r.plane.heightM+p[0]*r.plane.slopeX+p[1]*r.plane.slopeZ));
  return {id:g.id,depthM:[Math.min(...depths),Math.max(...depths)],minHeightM:Math.min(...heights)};
 });
 const eligible=new Set(bounds.filter(b=>!excluded.has(b.id)&&b.depthM[0]>=depthM[0]-tolerance&&b.depthM[1]<=depthM[1]+tolerance&&b.minHeightM>=minHeightM-tolerance).map(b=>b.id));
 if(seedSurfaceIds.some(id=>!eligible.has(id)))throw Error('Roof volume seed exceeds reviewed bounds');
 const edges=(g:typeof groups[number])=>g.roofs.flatMap(r=>[r.polygon.outer,...r.polygon.holes].flatMap(ring=>ring.map((a,i)=>[a,ring[(i+1)%ring.length]] as [CanalhousePoint,CanalhousePoint])));
 const shared=(a:typeof groups[number],b:typeof groups[number])=>edges(a).some(([p,q])=>edges(b).some(([r,s])=>{
  const dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz);if(length<.05)return false;
  const distance=(v:CanalhousePoint)=>Math.abs((v[0]-p[0])*dz-(v[1]-p[1])*dx)/length;
  if(distance(r)>tolerance||distance(s)>tolerance)return false;
  const along=(v:CanalhousePoint)=>((v[0]-p[0])*dx+(v[1]-p[1])*dz)/length;
  return Math.min(length,Math.max(along(r),along(s)))-Math.max(0,Math.min(along(r),along(s)))>=.05;
 }));
 const selected=new Set(seedSurfaceIds);let changed=true;
 while(changed){changed=false;for(const g of groups)if(eligible.has(g.id)&&!selected.has(g.id)&&groups.some(other=>selected.has(other.id)&&shared(g,other))){selected.add(g.id);changed=true;}}
 return {surfaceIds:ids.filter(id=>selected.has(id)),preservedSurfaceIds:ids.filter(id=>!selected.has(id)),bounds,sourceReview:selection.sourceReview};
}
