/** Initial frontage framing only; conservatively keep the camera before footprint obstacles. */
const cross=(a,b)=>a[0]*b[1]-a[1]*b[0];
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1]];
const polygons=footprint=>footprint?.type==='MultiPolygon'?footprint.coordinates:footprint?.type==='Polygon'?[footprint.coordinates]:[];
function inRing(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function insideBuildingFootprint(point,building){return polygons(building.footprint).some(rings=>inRing(point,rings[0])&&!rings.slice(1).some(r=>inRing(point,r)));}
export function firstFootprintObstruction(origin,direction,buildings,maxDistance,{sourceBuildingId,sourceBoundaryToleranceM=0}={}){
  let hit=null;
  for(const building of buildings){
    const cuts=[0,maxDistance];
    for(const ring of polygons(building.footprint).flat())for(let i=0;i<ring.length;i++){
      const a=ring[i],b=ring[(i+1)%ring.length],edge=sub(b,a),relative=sub(a,origin),denom=cross(direction,edge);
      if(Math.abs(denom)<1e-9)continue;
      const t=cross(relative,edge)/denom,u=cross(relative,direction)/denom;
      if(t>0&&t<maxDistance&&u>=-1e-8&&u<=1+1e-8)cuts.push(t);
    }
    cuts.sort((a,b)=>a-b);
    for(let i=1;i<cuts.length;i++){
      if(cuts[i]-cuts[i-1]<1e-7)continue;
      // Source wall/footprint rounding can put the ray origin a few centimetres
      // inside its own boundary. Ignore only that initial short interval, never
      // the rest of the target building or an intervening neighbour.
      if(building.id===sourceBuildingId&&cuts[i-1]<1e-7&&cuts[i]<=sourceBoundaryToleranceM)continue;
      const mid=(cuts[i]+cuts[i-1])/2,point=[origin[0]+direction[0]*mid,origin[1]+direction[1]*mid];
      if(insideBuildingFootprint(point,building)&&(!hit||cuts[i-1]<hit.distanceM)){hit={buildingId:building.id,distanceM:cuts[i-1]};break;}
    }
  }
  return hit;
}
export function frontageFraming(record,aspect,radius,maxFov=95){
  if(!Number.isFinite(aspect)||aspect<=0||!Number.isFinite(radius)||radius<=0)throw Error('Positive camera aspect and radius required');
  const neededFov=2*Math.atan(Math.max(record.height*.65,record.wallWidthM*.65/aspect)/radius)*180/Math.PI;
  return {fov:Math.min(maxFov,Math.max(38,neededFov)),wholeFacadeFits:neededFov<=maxFov};
}
export function planFrontageCamera(record,buildings,aspect,{desiredRadius=21,clearanceM=1.5,maxFov=95}={}){
  if(!Number.isFinite(aspect)||aspect<=0)throw Error('Positive camera aspect required');
  const norm=Math.hypot(...record.normal);if(!norm)throw Error('Nonzero frontage normal required');
  const direction=record.normal.map(x=>x/norm),phi=1.4,target=[record.mid[0],Math.min(12,record.height*.5),record.mid[1]];
  const desiredHorizontal=desiredRadius*Math.sin(phi),hit=firstFootprintObstruction(record.mid,direction,buildings,desiredHorizontal+clearanceM,{sourceBuildingId:record.buildingId,sourceBoundaryToleranceM:.25});
  const horizontal=hit?Math.min(desiredHorizontal,Math.max(0,hit.distanceM-clearanceM)):desiredHorizontal;
  if(horizontal<.8)return {version:1,usable:false,reason:'No clear outward camera position on this wall normal',obstruction:hit,target};
  const radius=horizontal/Math.sin(phi),framing=frontageFraming(record,aspect,radius,maxFov);
  return {version:1,usable:true,target,radius,theta:Math.atan2(direction[0],direction[1]),phi,...framing,position:[target[0]+direction[0]*horizontal,target[1]+radius*Math.cos(phi),target[2]+direction[1]*horizontal],constrained:radius<desiredRadius-1e-6,obstruction:hit,clearanceM,scope:'Initial source-wall framing; conservative footprint geometry only. Trees, overhangs and manual orbit are not collision-tested.'};
}
