/** Generic native RD survey conversion. Source-selected endpoints identify the
 * frontage; this helper supplies neither a street direction nor a house style. */
import * as T from 'three';
import type {CanalhousePoint,CanalhousePolygon,CanalHouseRecipe} from '../../src/canalRecall/canalhouseRecipes.ts';
import {CANALHOUSE_MIN_POLYGON_AREA_M2} from '../../src/canalRecall/canalhouseRecipes.ts';
import {discoverCompleteFrontage} from './complete-frontage.ts';
export interface NativeRecipeSurvey {
 attributes:{b3_h_maaiveld:number};
 roofsRD:{surfaceId:string;vertices:number[][];ringsRD?:number[][][]}[];
}
const area=(r:CanalhousePoint[])=>r.reduce((s,p,i)=>{const q=r[(i+1)%r.length];return s+p[0]*q[1]-q[0]*p[1]},0)/2;
const clockwise=(r:CanalhousePoint[])=>area(r)>0?[...r].reverse():r;
export function surveyRecipe(survey:NativeRecipeSurvey,ringsRD:number[][][][],frontEndpointsRD:number[][]) {
 const ground=survey.attributes.b3_h_maaiveld;
 if(!Number.isFinite(ground)||!ringsRD.length||frontEndpointsRD.length!==2)throw Error('Incomplete native survey');
 const vertices=ringsRD.flatMap(p=>p[0]);
 const anchorRD:CanalhousePoint=[vertices.reduce((s,p)=>s+p[0],0)/vertices.length,vertices.reduce((s,p)=>s+p[1],0)/vertices.length];
 const local=(p:number[]):CanalhousePoint=>[p[0]-anchorRD[0],anchorRD[1]-p[1]];
 const polygons:CanalhousePolygon[]=ringsRD.map(r=>({outer:clockwise(r[0].map(local)),holes:r.slice(1).map(h=>h.map(local))}));
 const [a,b]=frontEndpointsRD.map(local),width=Math.hypot(b[0]-a[0],b[1]-a[1]);
 if(width<=0)throw Error('Degenerate source frontage');
 const matches=polygons.flatMap((p,polygonIndex)=>{
  const start=p.outer.findIndex(v=>Math.hypot(v[0]-a[0],v[1]-a[1])<1e-5),end=p.outer.findIndex(v=>Math.hypot(v[0]-b[0],v[1]-b[1])<1e-5);
  return start>=0&&end>=0?[{polygonIndex,edgeIndex:start,endEdgeIndex:end}]:[];
 });
 if(matches.length!==1)throw Error('Source frontage endpoints must select one surveyed polygon');
 const roof:CanalHouseRecipe['roof']['value']=[],roofOwners:string[]=[];
 const roofBoundarySnaps:{surfaceId:string;fromRD:number[];toLocal:CanalhousePoint;distanceM:number}[]=[];
 const roofPoint=(p:number[],surfaceId:string):CanalhousePoint=>{
  const q=local(p);
  let closest=q,distanceM=Infinity;
  for(const poly of polygons)for(const ring of [poly.outer,...poly.holes])for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],den=dx*dx+dz*dz;
   if(!den)continue;const t=Math.max(0,Math.min(1,((q[0]-a[0])*dx+(q[1]-a[1])*dz)/den));
   const candidate:CanalhousePoint=[a[0]+t*dx,a[1]+t*dz],distance=Math.hypot(q[0]-candidate[0],q[1]-candidate[1]);
   if(distance<distanceM){distanceM=distance;closest=candidate;}
  }
  // Millimetre-rounded source rings may disagree by fractions of a millimetre.
  // Repair boundary rounding, report it, and retain original source heights.
  // Larger differences remain unchanged for the compiler to reject.
  if(distanceM>1e-7&&distanceM<=.0005){roofBoundarySnaps.push({surfaceId,fromRD:[...p],toLocal:closest,distanceM});return closest;}
  return q;
 };
 const omittedRoofFragments:{surfaceId:string;verticesRD:number[][];areaM2:number}[]=[];
 // Preserve original semantic rings. Rounded non-planar vertices are separately
 // triangulated instead of extrapolating a fitted plane across other roof parts.
 for(const surface of survey.roofsRD){
  const rings=surface.ringsRD??[surface.vertices],points=rings.flat();
  const rawArea=Math.abs(area(rings[0].map(local)))-rings.slice(1).reduce((sum,r)=>sum+Math.abs(area(r.map(local))),0);
  // Tiny fragments keep their original coordinates so omission accounting
  // cannot be bypassed by snapping them into degenerate triangles.
  const localPoints=points.map(p=>rawArea<CANALHOUSE_MIN_POLYGON_AREA_M2?local(p):roofPoint(p,surface.surfaceId));
  let offset=0;const mapped=rings.map(r=>r.map(()=>new T.Vector2(...localPoints[offset++])));
  for(const triangle of T.ShapeUtils.triangulateShape(mapped[0],mapped.slice(1))){
   const [a,b,c]=triangle.map(i=>{const p=points[i],q=localPoints[i];return[q[0],p[2]-ground,q[1]]});
   const x1=b[0]-a[0],z1=b[2]-a[2],x2=c[0]-a[0],z2=c[2]-a[2],den=x1*z2-x2*z1;
   const areaM2=Math.abs(den)/2;
   if(areaM2<CANALHOUSE_MIN_POLYGON_AREA_M2){
    omittedRoofFragments.push({surfaceId:surface.surfaceId,verticesRD:triangle.map(i=>[...points[i]]),areaM2});continue;
   }
   const slopeX=((b[1]-a[1])*z2-(c[1]-a[1])*z1)/den,slopeZ=(x1*(c[1]-a[1])-x2*(b[1]-a[1]))/den;
   roof.push({polygon:{outer:clockwise([a,b,c].map(p=>[p[0],p[2]])),holes:[]},plane:{heightM:a[1]-a[0]*slopeX-a[2]*slopeZ,slopeX,slopeZ}});roofOwners.push(surface.surfaceId);
  }
 }
 // Rounded almost-collinear survey vertices can produce microscopic fragments.
 // Keep the raw rings and exact ground footprint, report every omitted fragment,
 // and refuse cumulative omissions beyond one square centimetre.
 const omittedRoofAreaM2=omittedRoofFragments.reduce((sum,f)=>sum+f.areaM2,0);
 if(omittedRoofAreaM2>1e-4)throw Error('Native roof fragment omissions exceed precision budget');
 const shellTopM=Math.min(...survey.roofsRD.flatMap(r=>r.vertices.map(p=>p[2]-ground)))-.001;
 if(!roof.length||!Number.isFinite(shellTopM))throw Error('Missing native roof surfaces');
 return {anchorRD,polygons,roof,roofOwners,roofBoundarySnaps,omittedRoofFragments,omittedRoofAreaM2,shellTopM,frontageDiscovery:discoverCompleteFrontage(ringsRD,frontEndpointsRD),front:{...matches[0],a,b,widthM:width,normal:[-(b[1]-a[1])/width,(b[0]-a[0])/width] as CanalhousePoint}};
}
