/** Bounded drawing inference over a surveyed partition; never edits raw surveys. */
import {ShapeUtils, Vector2} from 'three';
import type {CanalHouseRecipe, CanalhousePoint, CanalhousePolygon} from '../../src/canalRecall/canalhouseRecipes.ts';

type Roof = CanalHouseRecipe['roof']['value'][number];
type Point = CanalhousePoint;
const EPS=1e-8;
const area=(r:Point[])=>r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-q[0]*p[1];},0)/2;
const netArea=(p:CanalhousePolygon)=>Math.abs(area(p.outer))-p.holes.reduce((s,h)=>s+Math.abs(area(h)),0);
const height=(r:Roof,p:Point)=>r.plane.heightM+p[0]*r.plane.slopeX+p[1]*r.plane.slopeZ;

export interface FrontReturnOptions {
  principalFront: [Point,Point];
  /** Explicit local x/z direction into this house; checked against all roof vertices. */
  inwardNormal: Point;
  bodyHeightM: number;
  transitionDepthM: number;
  slopeInward: number;
  confidence: number;
  /** Small surveyed frontage bends may straddle the principal chord. */
  frontageToleranceM?: number;
  /** Optional exact semantic survey owner for each input plane. */
  sourceSurfaceIds?: string[];
}

function clip(ring:Point[],signedDistance:(p:Point)=>number):Point[]{
  const out:Point[]=[];
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],da=signedDistance(a),db=signedDistance(b);
    const ia=da<=0,ib=db<=0;
    if(ia)out.push([...a]);
    if(ia!==ib){const t=da/(da-db);out.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);}
  }
  return out.filter((p,i)=>Math.hypot(p[0]-out[(i+out.length-1)%out.length][0],p[1]-out[(i+out.length-1)%out.length][1])>EPS);
}

/**
 * Take the lower envelope of source triangle planes and a single inferred
 * pitched return inside a finite principal-front strip. A transition that cuts
 * through the source roof is rejected instead of producing a hidden step wall.
 * Hole-aware triangulation partitions occupied roof area only. Unchanged planes
 * keep their complete polygons, holes and original coefficients.
 */
export function inferPrincipalFrontReturn(source: readonly Roof[], options:FrontReturnOptions){
  const {principalFront:[a,b],inwardNormal:n,bodyHeightM,transitionDepthM:depth,slopeInward:slope,confidence}=options;
  const tolerance=options.frontageToleranceM??.01;
  const dx=b[0]-a[0],dz=b[1]-a[1],width=Math.hypot(dx,dz);
  if(![...a,...b,...n,bodyHeightM,depth,slope,confidence,tolerance].every(Number.isFinite))throw Error('Non-finite front return parameter');
  if(width<.5||Math.abs(Math.hypot(...n)-1)>1e-6||Math.abs(dx*n[0]+dz*n[1])>width*1e-6)throw Error('Front return requires a perpendicular inward unit normal');
  if(bodyHeightM<=0||depth<.25||depth>6||slope<=0||slope>2||confidence<0||confidence>.5||tolerance<0||tolerance>.35)throw Error('Front return inference exceeds bounds');
  if(!source.length||options.sourceSurfaceIds&&options.sourceSurfaceIds.length!==source.length)throw Error('Front return source ownership count mismatch');
  const inward=(p:Point)=>(p[0]-a[0])*n[0]+(p[1]-a[1])*n[1];
  const lateral=(p:Point)=>((p[0]-a[0])*dx+(p[1]-a[1])*dz)/width;
  const cap=(p:Point)=>bodyHeightM+slope*inward(p);
  const returnPlane={heightM:bodyHeightM-slope*(a[0]*n[0]+a[1]*n[1]),slopeX:slope*n[0],slopeZ:slope*n[1]};
  const all=source.flatMap(r=>[r.polygon.outer,...r.polygon.holes].flat());
  if(all.some(p=>!p.every(Number.isFinite)||inward(p)<-tolerance-EPS)||Math.max(...all.map(inward))<=depth)throw Error('Front return orientation or inward transition lies outside source bounds');
  if(all.filter(p=>inward(p)<=depth).some(p=>lateral(p)<-tolerance-EPS||lateral(p)>width+tolerance+EPS))throw Error('Front strip extends beyond the admitted principal frontage');
  const roofs:Roof[]=[],parts:{sourcePlaneIndex:number;sourceSurfaceId?:string;inferred:boolean}[]=[];
  const affectedSourcePlaneIndices:number[]=[];
  const emit=(polygon:Point[],plane:Roof['plane'],index:number,inferred:boolean)=>{
    if(polygon.length<3||Math.abs(area(polygon))<1e-10)return;
    // Local x/z clockwise rings have upward geometric normals in x/y/z.
    if(area(polygon)>0)polygon.reverse();
    roofs.push({polygon:{outer:polygon,holes:[]},plane:{...plane}});
    parts.push({sourcePlaneIndex:index,sourceSurfaceId:options.sourceSurfaceIds?.[index],inferred});
  };
  for(const [index,r] of source.entries()){
    if(!Object.values(r.plane).every(Number.isFinite)||netArea(r.polygon)<=EPS)throw Error('Invalid source roof plane or polygon');
    const points=[r.polygon.outer,...r.polygon.holes].flat();
    const triangles=ShapeUtils.triangulateShape(r.polygon.outer.map(p=>new Vector2(...p)),r.polygon.holes.map(h=>h.map(p=>new Vector2(...p)))).map(t=>t.map(i=>points[i]));
    const delta=(p:Point)=>height(r,p)-cap(p);
    const split=triangles.map(t=>({t,strip:clip(t,p=>inward(p)-depth)}));
    for(const {strip} of split)for(const p of strip)if(Math.abs(inward(p)-depth)<EPS&&delta(p)>1e-7)throw Error(`Front return fails continuous source join at plane ${index}`);
    const changed=split.some(({strip})=>strip.length>=3&&Math.abs(area(strip))>1e-10&&strip.some(p=>delta(p)>EPS));
    if(!changed){roofs.push(structuredClone(r));parts.push({sourcePlaneIndex:index,sourceSurfaceId:options.sourceSurfaceIds?.[index],inferred:false});continue;}
    affectedSourcePlaneIndices.push(index);
    for(const {t,strip} of split){
      emit(clip(t,p=>depth-inward(p)),r.plane,index,false);
      if(strip.every(p=>delta(p)<=EPS))emit(strip,r.plane,index,false);
      else if(strip.every(p=>delta(p)>=-EPS))emit(strip,returnPlane,index,true);
      else {emit(clip(strip,delta),r.plane,index,false);emit(clip(strip,p=>-delta(p)),returnPlane,index,true);}
    }
  }
  const sourceAreaM2=source.reduce((s,r)=>s+netArea(r.polygon),0),resultAreaM2=roofs.reduce((s,r)=>s+netArea(r.polygon),0);
  if(Math.abs(sourceAreaM2-resultAreaM2)>Math.max(1e-7,sourceAreaM2*1e-9))throw Error('Front return changed occupied roof area');
  return {roofs,provenance:{classification:'bounded reversible inferred front roof return; not measured hip',confidence,
    principalFront:structuredClone(options.principalFront),inwardNormal:[...n],bodyHeightM,transitionDepthM:depth,slopeInward:slope,
    formula:'inside strip: min(sourceTriangleHeight, bodyHeightM + slopeInward * inwardDepth); outside strip: sourceTriangleHeight',
    affectedSourcePlaneIndices,affectedSourceSurfaceIds:[...new Set(affectedSourcePlaneIndices.map(i=>options.sourceSurfaceIds?.[i]).filter((id):id is string=>Boolean(id)))],parts,sourceAreaM2,resultAreaM2,
    visualAcceptance:'pending source/render and independent gallery/live-game review'}};
}
