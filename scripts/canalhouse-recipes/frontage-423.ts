/** Scoped source reconciliation; original survey files remain immutable. */
import {ShapeUtils, Vector2} from 'three';

type Point = number[];
type Roof = {surfaceId:string; vertices:Point[]; ringsRD?:Point[][]; [key:string]:unknown};
type Survey = {bagId:string; attributes:{b3_h_maaiveld:number; [key:string]:unknown}; roofsRD:Roof[]; surveyFootprintsRD:Point[][]; surveyFootprintPolygonsRD:Point[][][]; [key:string]:unknown};
type InventoryHouse = {id:string; bagId:string; native:{anchorRD:{x:number;y:number}; footprint:Point[][]; frontEdgeIndices:number[]}};
const identity='NL.IMBAG.Pand.0363100012171742';
const roof38Id=`${identity}-0:lod22:roof:38`;
const roof38Plane={originRD:[120975.22607638889,486733.74288888887],heightNAP:15.254390521566384,slopeEast:-1.1734905648048999,slopeNorth:.7641612028918727,maxResidualM:.0009161899543830287};
const planeHeight=(p:Point)=>roof38Plane.heightNAP+(p[0]-roof38Plane.originRD[0])*roof38Plane.slopeEast+(p[1]-roof38Plane.originRD[1])*roof38Plane.slopeNorth;
const distance=(a:Point,b:Point)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const key=(p:Point)=>`${p[0].toFixed(6)},${p[1].toFixed(6)}`;
const open=(r:Point[])=>distance(r[0],r.at(-1)!)<1e-7?r.slice(0,-1):r;
const area=(r:Point[])=>{const a=r[0];return Math.abs(r.reduce((sum,p,i)=>{const q=r[(i+1)%r.length];return sum+(p[0]-a[0])*(q[1]-a[1])-(q[0]-a[0])*(p[1]-a[1]);},0)/2)};
function nearest(p:Point,ring:Point[]){
 let best={point:ring[0],distance:Infinity};
 for(let i=0;i<ring.length;i++){
  const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
  const point=[a[0]+t*dx,a[1]+t*dy],d=distance(point,p);
  if(d<best.distance)best={point,distance:d};
 }
 return best;
}
// Extend the closest original triangle's plane, preserving source elevations at
// unchanged vertices. A surface-wide fit would erase non-planar source detail.
function continuedHeight(p:Point,rings:Point[][]){
 const vertices=rings.flat(),origin=vertices[0];
 const mapped=rings.map(r=>r.map(v=>new Vector2(v[0]-origin[0],v[1]-origin[1])));
 let bestDistance=Infinity,bestHeight=NaN;
 for(const triangle of ShapeUtils.triangulateShape(mapped[0],mapped.slice(1))){
  const [a,b,c]=triangle.map(i=>vertices[i]),dx=b[0]-a[0],dy=b[1]-a[1],ex=c[0]-a[0],ey=c[1]-a[1],den=dx*ey-ex*dy;
  if(Math.abs(den)<1e-9)continue;
  const u=((p[0]-a[0])*ey-(p[1]-a[1])*ex)/den,v=(dx*(p[1]-a[1])-dy*(p[0]-a[0]))/den;
  const d=u>=-1e-8&&v>=-1e-8&&u+v<=1+1e-8?0:nearest(p,[a,b,c]).distance;
  if(d<bestDistance){bestDistance=d;bestHeight=a[2]+u*(b[2]-a[2])+v*(c[2]-a[2]);}
 }
 if(!Number.isFinite(bestHeight))throw Error('423 source roof has no usable triangle');
 return bestHeight;
}

/** Use only the exact house-owned native BAG rings; never borrow a neighbor. */
export function reconcileHerengracht423Survey<S extends Survey>(source:S,house:InventoryHouse,options:{inferFrontReturn?:boolean}={}){
 if(house.id!=='herengracht-423'||house.bagId!==identity.split('.').at(-1)||source.bagId!==house.bagId)throw Error('423 reconciliation applied to another identity');
 const survey=structuredClone(source),a=house.native.anchorRD;
 const rings=house.native.footprint.map(r=>open(r.map(p=>[a.x+p[0],a.y-p[1]])));
 if(rings.length!==1||rings[0].length!==7)throw Error('423 BAG topology changed; re-investigate reconciliation');
 const outer=rings[0],sourceBoundary=new Set(source.surveyFootprintPolygonsRD.flatMap(p=>p.flat()).map(key));
 const source38=source.roofsRD.find(r=>r.surfaceId===roof38Id);
 if(!source38||source38.vertices.length!==9||(source38.ringsRD?.length??1)!==1)throw Error('423 roof38 source topology changed');
 if(Math.max(...source38.vertices.map(p=>Math.abs(p[2]-planeHeight(p))))>.002)throw Error('423 measured roof38 plane changed');
 const changes:{surfaceId:string;fromRD:Point;toRD:Point;horizontalDistanceM:number;kind:string}[]=[];
 function boundaryPoint(p:Point,surface:Roof,originalRings:Point[][]):Point{
  if(!sourceBoundary.has(key(p)))return [...p];
  const corner=outer.find(q=>distance(p,q)<.025),match=corner?{point:corner,distance:distance(p,corner)}:nearest(p,outer);
  if(match.distance>.100001)throw Error(`423 unbounded boundary correction ${surface.surfaceId}: ${match.distance}m`);
  const q=[...match.point,surface.surfaceId===roof38Id?planeHeight(match.point):continuedHeight(match.point,originalRings)];
  changes.push({surfaceId:surface.surfaceId,fromRD:[...p],toRD:q,horizontalDistanceM:match.distance,kind:match.distance>.025?'inferred rear-right source inset continuation':'bounded BAG boundary continuation'});
  return q;
 }
 for(const surface of survey.roofsRD){
  const originalRings=surface.ringsRD??[surface.vertices];
  let reconciled=originalRings.map((r,ringIndex)=>r.map((p,i)=>surface.surfaceId===roof38Id&&ringIndex===0&&i>=1&&i<=4?[...p]:boundaryPoint(p,surface,originalRings)));
  if(surface.surfaceId===roof38Id){
   // The source inset vertices1–4 are replaced by the two exact BAG corners.
   // Everything beyond this front-right wedge keeps its semantic surface owner.
   const before=reconciled[0];
   reconciled[0]=[before[0],...[outer[5],outer[6]].map(p=>[...p,planeHeight(p)]),...before.slice(5)];
  }
  // Retain the very small BAG frontage bends rather than replacing its three
  // segments with a chord (the omitted sliver is approximately0.00037m²).
  reconciled=reconciled.map(r=>r.flatMap((p,i)=>{
   const next=r[(i+1)%r.length],dx=next[0]-p[0],dy=next[1]-p[1],length2=dx*dx+dy*dy;
   const inserts=outer.map(q=>({q,t:((q[0]-p[0])*dx+(q[1]-p[1])*dy)/length2}))
    .filter(({q,t})=>t>1e-7&&t<1-1e-7&&Math.abs(dx*(q[1]-p[1])-dy*(q[0]-p[0]))/Math.sqrt(length2)<.001)
    .sort((a,b)=>a.t-b.t).map(({q})=>[...q,surface.surfaceId===roof38Id?planeHeight(q):continuedHeight(q,originalRings)]);
   return [p,...inserts];
  }));
  surface.ringsRD=reconciled;
  surface.vertices=reconciled.flat();
  surface.holeCount=reconciled.length-1;
  surface.reconciliation={classification:'source-derived planes with explicitly inferred horizontal continuation',sourceSurfaceId:surface.surfaceId,investigation:'docs/references/canalhouse-recipes/herengracht-423-frontage-investigation.json'};
 }
 survey.surveyFootprintPolygonsRD=[structuredClone(rings)];
 survey.surveyFootprintsRD=[structuredClone(outer)];
 const front=[outer[2],outer[5]],ground=source.attributes.b3_h_maaiveld;
 const frontNAP=planeHeight(outer[5]),retainedRidge=[120978.4291875,486740.324,15.60350163269043];
 const frontDx=front[1][0]-front[0][0],frontDy=front[1][1]-front[0][1],frontWidth=distance(front[0],front[1]);
 const inwardDepth=(p:Point)=>((p[0]-front[0][0])*(-frontDy)+(p[1]-front[0][1])*frontDx)/frontWidth;
 const ridgeDepth=inwardDepth(retainedRidge),hipSlope=(retainedRidge[2]-frontNAP)/ridgeDepth;
 const hipHeight=(p:Point)=>frontNAP+hipSlope*inwardDepth(p);
 const affected=new Set([33,34,35,38].map(n=>`${identity}-0:lod22:roof:${n}`));
 const splitCounts={originalPlaneParts:0,inferredPlaneParts:0};
 if(options.inferFrontReturn){
  const partitioned:Roof[]=[];
  for(const surface of survey.roofsRD){
   if(!affected.has(surface.surfaceId)){partitioned.push(surface);continue;}
   const rings=surface.ringsRD!,vertices=rings.flat(),origin=vertices[0];
   const mapped=rings.map(r=>r.map(p=>new Vector2(p[0]-origin[0],p[1]-origin[1])));
   let part=0;
   const delta=(p:Point)=>p[2]-hipHeight(p);
   function clip(polygon:Point[],below:boolean){
    const result:Point[]=[];
    for(let i=0;i<polygon.length;i++){
     const a=polygon[i],b=polygon[(i+1)%polygon.length],da=delta(a),db=delta(b);
     const insideA=below?da<=0:da>=0,insideB=below?db<=0:db>=0;
     if(insideA)result.push([...a]);
     if(insideA!==insideB){const t=da/(da-db);result.push(a.map((v,k)=>v+t*(b[k]-v)));}
    }
    return result.filter((p,i)=>!i||distance(p,result[i-1])>1e-8);
   }
   function emit(ring:Point[],inferred:boolean){
    if(ring.length<3||area(ring)<1e-9)return;
    const points=inferred?ring.map(p=>[p[0],p[1],hipHeight(p)]):ring;
    partitioned.push({...surface,surfaceId:`${surface.surfaceId}:front-return-part:${part++}`,vertices:points,ringsRD:[points],holeCount:0,
     reconciliation:{classification:inferred?'inferred front-return plane; confidence0.25':'retained original source triangle plane below inferred front return',sourceSurfaceId:surface.surfaceId,investigation:'docs/references/canalhouse-recipes/herengracht-423-frontage-investigation.json'}});
    if(inferred)splitCounts.inferredPlaneParts++;else splitCounts.originalPlaneParts++;
   }
   for(const indices of ShapeUtils.triangulateShape(mapped[0],mapped.slice(1))){
    const triangle=indices.map(i=>vertices[i]),d=triangle.map(delta);
    if(Math.max(...d)<=1e-9)emit(triangle,false);
    else if(Math.min(...d)>=-1e-9)emit(triangle,true);
    else{emit(clip(triangle,true),false);emit(clip(triangle,false),true);}
   }
  }
  survey.roofsRD=partitioned;
 }
 // Source semanticSurfacesRD/groundSurfacesRD/roofWgs84 retain their original
 // evidence. Only the author-consumed roof/footprint arrays are reconciled.
 const provenance={
  identity,classification:'inferred reconciliation; not an exact 3DBAG survey',
  investigation:'docs/references/canalhouse-recipes/herengracht-423-frontage-investigation.json',
  footprintAuthority:'exact inventory native BAG footprint at scale1; no padding',
  principalFrontlineRD:front,frontWidthM:distance(front[0],front[1]),
  roof38Plane,frontRightContinuationCornersRD:[outer[5],outer[6]].map(p=>[...p,planeHeight(p)]),
  boundaryChanges:changes,
  projectedRoofAreaM2:survey.roofsRD.reduce((sum,r)=>sum+area(r.ringsRD![0])-r.ringsRD!.slice(1).reduce((v,h)=>v+area(h),0),0),
  footprintAreaM2:area(outer),
  frontReturn:options.inferFrontReturn?{enabled:true,classification:'reversible low-confidence inferred candidate',confidence:.25,
   formula:'heightNAP=frontHeightNAP+slopeInward*inwardDepthM; take lower envelope with original source triangles',
   frontHeightNAP:frontNAP,slopeInward:hipSlope,principalFrontlineRD:front,
   preservedInteriorRidgeRD:retainedRidge,preservedRidgeDepthM:ridgeDepth,
   affectedSourceSurfaceIds:[...affected],preservedRearSurfaceIds:[36,37,39].map(n=>`${identity}-0:lod22:roof:${n}`),splitCounts,
   sourceEvidence:['2024 municipal423detail: straightcornice with low roof projection; no large central front triangle','1934 Beeldbank9e396e6e: straightcornice, roofsection unresolved'],
   limits:'Exact hidden hip unproven; source crest cause unresolved. Inferred return cuts only above-plane portions of33/34/35/38, preserving all below-plane geometry and rear36/37/39. Original source input remains immutable.',
   visualAcceptance:'pending root and independent gallery/live-game comparison'}:{enabled:false},
  frontBodyM:Math.max(13.05750163269043,planeHeight(outer[5]))-ground,
  frontBodyEvidence:{classification:'inferred drawing estimate',confidence:.35,
   method:'Use the higher lateral endpoint of the measured front roof cross-section after bounded BAG continuation; current photo supports a continuous straight cornice and facade shorter than425, but supplies no absolute metric height.',
   sourcePhoto:'streets/canalhouse-recipes-pilot/processed/herengracht-423-detail.jpg',
   limits:'This selects a plausible eave/cornice drawing level, not a surveyed cornice. The retained source ridge still reaches16.65NAP at the facade; review possible exposed gabled-roof silhouette against the photo before visual acceptance.'},
  corniceEvidence:{status:'absolute metric cornice remains unresolved; use explicit photo inference for authored height',
   leftSourceEaveNAP:13.05750163269043,rightContinuedEaveNAP:planeHeight(outer[5]),
   sideEavesAboveGroundM:[13.05750163269043-ground,planeHeight(outer[5])-ground],
   rejectedCrestAsBodyHeightM:16.65150163269043-ground,
   note:'Side eaves are the low endpoints of the roof cross-section, not measurements of the continuous facade cornice.'},
  visualAcceptance:'pending root gallery/live-game and independent review',
 };
 return {survey,provenance};
}
