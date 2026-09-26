import { createHash } from 'node:crypto';
import type { CameraPose } from '../../src/canalRecall/facade/rectify.ts';
import { lngLatToRd } from '../../src/canalRecall/facade/rdNew.ts';

export const sha = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
export const VERSION = 'da-costa-neighbourhood/2';
/** Adapted from twin b9f050e; no datum artifact has yet been validated for this area. */
export function lensFor(p: any, ground: number | undefined): { pose: CameraPose; inferred: boolean; datum: string } | null {
  const point = lngLatToRd(p.geometry.coordinates);
  const published = p.geometry.coordinates[2];
  const z = Number.isFinite(published) && published > 0 ? published - 43.5 : null;
  const plausible = z !== null && (!Number.isFinite(ground) || z - ground! >= -3 && z - ground! <= 12);
  if (!plausible && !Number.isFinite(ground)) return null;
  return { pose: { ...point, z: plausible ? z! : ground! + 2.44,
    headingDeg: p.heading, pitchDeg: p.pitch, rollDeg: p.roll },
    inferred: !plausible, datum: plausible ? 'published-minus-43.5m; track-unsolved' : 'ground-plus-2.44m; approximate' };
}
export function inside(p: number[], ring: number[][]) {
  let yes = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) yes = !yes;
  }
  return yes;
}
export function crosses(a: number[], b: number[], c: number[], d: number[]) {
  const rx=b[0]-a[0], ry=b[1]-a[1], sx=d[0]-c[0], sy=d[1]-c[1], den=rx*sy-ry*sx;
  if(Math.abs(den)<1e-9)return false;
  const t=((c[0]-a[0])*sy-(c[1]-a[1])*sx)/den, u=((c[0]-a[0])*ry-(c[1]-a[1])*rx)/den;
  return t>.005&&t<.995&&u>=0&&u<=1;
}

export const VISIBILITY_VERSION = 'footprint-interior-traversal/v1';
export type FootprintPolygons = number[][][][];

export const VERTICAL_EXTENT_VERSION = 'matched-wall-and-adjacent-roof/v1';
/** Scene Y is NAP minus .65m, as established in compile.mjs, not camera height. */
export function wallVerticalExtent(building:any,wall:{localStart:number[];localEnd:number[]},
  {sceneDatumNAP=.65,minimumCoverage=.8,planeToleranceM=.8}={}){
  const [a,b]=[wall.localStart,wall.localEnd],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
  const ground=Number.isFinite(building.groundNAP)?building.groundNAP:sceneDatumNAP;
  const globalTop=Math.max(ground+(building.height||0),...building.surfaces.flatMap((s:any)=>s.rings.flatMap((r:any)=>r.map((p:any)=>p[1]+sceneDatumNAP))));
  const fallback=(reason:string)=>({version:VERTICAL_EXTENT_VERSION,source:'building-maximum-fallback',reason,topNAP:globalTop,globalTopNAP:globalTop,coverageFraction:0,wallTopNAP:null,adjacentRoofTopNAP:null,surfaceIndices:[] as number[],roofSurfaceIndices:[] as number[],overshootM:0});
  if(length<.1)return fallback('degenerate-wall');
  const ux=dx/length,uz=dz/length;
  const project=(p:number[])=>({along:(p[0]-a[0])*ux+(p[2]-a[1])*uz,distance:Math.abs((p[0]-a[0])*uz-(p[2]-a[1])*ux),y:p[1]+sceneDatumNAP});
  const intervals:number[][]=[],surfaceIndices:number[]=[],roofSurfaceIndices:number[]=[],tops:number[]=[],roofTops:number[]=[];
  for(let i=0;i<building.surfaces.length;i++){
    const s=building.surfaces[i],points=s.rings[0].map(project);
    if(s.type==='wall'){
      if(Math.max(...points.map((p:any)=>p.distance))>planeToleranceM)continue;
      const lo=Math.max(0,Math.min(...points.map((p:any)=>p.along))),hi=Math.min(length,Math.max(...points.map((p:any)=>p.along)));
      if(hi-lo<Math.min(.5,length*.2))continue;
      // Clip in the along-wall dimension so a long sloping wall cannot import
      // a high vertex located beyond this frontage's endpoints.
      const clipped=points.filter((p:any)=>p.along>=0&&p.along<=length).map((p:any)=>p.y);
      for(let j=0;j<points.length;j++)for(const edge of [0,length]){
        const p=points[j],q=points[(j+1)%points.length];
        if(Math.abs(q.along-p.along)<1e-10)continue;
        const t=(edge-p.along)/(q.along-p.along);if(t>=0&&t<=1)clipped.push(p.y+t*(q.y-p.y));
      }
      if(!clipped.length)continue;
      surfaceIndices.push(i);intervals.push([lo,hi]);tops.push(Math.max(...clipped));
    }else if(s.type==='roof'){
      // Require an actual contact edge, not one coincidental corner near the wall.
      let contact=0;
      for(let j=0;j<points.length;j++){
        const p=points[j],q=points[(j+1)%points.length];
        if(p.distance<=planeToleranceM&&q.distance<=planeToleranceM)
          contact+=Math.max(0,Math.min(length,Math.max(p.along,q.along))-Math.max(0,Math.min(p.along,q.along)));
      }
      if(contact>=Math.min(.5,length*.2)){roofSurfaceIndices.push(i);roofTops.push(Math.max(...points.map((p:any)=>p.y)));}
    }
  }
  intervals.sort((a,b)=>a[0]-b[0]);let coverage=0,end=-Infinity;
  for(const [lo,hi] of intervals){coverage+=Math.max(0,hi-Math.max(lo,end));end=Math.max(end,hi);}
  const coverageFraction=Math.min(1,coverage/length);
  if(coverageFraction<minimumCoverage)return {...fallback('insufficient-matched-wall-coverage'),coverageFraction,surfaceIndices,roofSurfaceIndices};
  const wallTopNAP=Math.max(...tops),adjacentRoofTopNAP=roofTops.length?Math.max(...roofTops):null;
  const topNAP=Math.max(wallTopNAP,adjacentRoofTopNAP??-Infinity);
  if(!Number.isFinite(topNAP)||topNAP<ground+3)return {...fallback('implausibly-low-matched-wall'),coverageFraction,surfaceIndices,roofSurfaceIndices};
  return {version:VERTICAL_EXTENT_VERSION,source:'matched-wall-and-adjacent-roof',reason:null,topNAP,globalTopNAP:globalTop,coverageFraction,wallTopNAP,adjacentRoofTopNAP,surfaceIndices,roofSurfaceIndices,overshootM:Math.max(0,globalTop-topNAP)};
}

/**
 * Length of a sightline through solid footprint interior, excluding a metric
 * tolerance at both endpoints. Unlike strict edge crossing, this handles
 * concavity, holes, rays through vertices, and cameras already inside a footprint.
 * Boundary tangency is not occlusion. This is deliberately conservative 2D
 * evidence: overhangs, underpasses and height-dependent visibility need 3D review.
 */
export function footprintOcclusion(from: number[], to: number[], polygons: FootprintPolygons,
  { endpointToleranceM = .15, minimumInteriorM = .1 } = {}) {
  const dx=to[0]-from[0],dy=to[1]-from[1],length=Math.hypot(dx,dy);
  if(length<=2*endpointToleranceM)return {blocked:false,interiorM:0,firstInteriorM:null};
  const lo=endpointToleranceM/length,hi=1-lo,cuts=[lo,hi];
  const rings=polygons.flat();
  const onBoundary=(p:number[],polygon:number[][][])=>polygon.some(ring=>ring.some((a,i)=>{
    const b=ring[(i+1)%ring.length],ex=b[0]-a[0],ey=b[1]-a[1],n=ex*ex+ey*ey;
    if(n<1e-16)return Math.hypot(p[0]-a[0],p[1]-a[1])<1e-7;
    const t=Math.max(0,Math.min(1,((p[0]-a[0])*ex+(p[1]-a[1])*ey)/n));
    return Math.hypot(p[0]-a[0]-t*ex,p[1]-a[1]-t*ey)<1e-7;
  }));
  for(const ring of rings)for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length],ex=b[0]-a[0],ey=b[1]-a[1],den=dx*ey-dy*ex;
    if(Math.abs(den)<1e-10){
      if(Math.abs((a[0]-from[0])*dy-(a[1]-from[1])*dx)<1e-7)
        for(const p of [a,b]){const t=((p[0]-from[0])*dx+(p[1]-from[1])*dy)/(length*length);if(t>lo&&t<hi)cuts.push(t);}
      continue;
    }
    const t=((a[0]-from[0])*ey-(a[1]-from[1])*ex)/den,u=((a[0]-from[0])*dy-(a[1]-from[1])*dx)/den;
    if(t>lo&&t<hi&&u>=-1e-9&&u<=1+1e-9)cuts.push(t);
  }
  cuts.sort((a,b)=>a-b);let interiorM=0,firstInteriorM:number|null=null;
  for(let i=1;i<cuts.length;i++){
    if(cuts[i]-cuts[i-1]<1e-10)continue;
    const t=(cuts[i]+cuts[i-1])/2,p=[from[0]+t*dx,from[1]+t*dy];
    const solid=polygons.some(poly=>!onBoundary(p,poly)&&inside(p,poly[0])&&!poly.slice(1).some(hole=>inside(p,hole)));
    if(solid){interiorM+=(cuts[i]-cuts[i-1])*length;firstInteriorM??=cuts[i-1]*length;}
  }
  return {blocked:interiorM>minimumInteriorM,interiorM,firstInteriorM};
}
