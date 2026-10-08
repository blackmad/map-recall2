import earcut from 'earcut';
import {lngLatToRd,rdToLngLat,NSGI_ALIGNMENT_M,type RdPoint,type LngLat} from './facade/rdNew.js';

export type EnvelopePoint = [number, number, number]; // local east, north, up above source ground
export type EnvelopeSurface = {sourceSurfaceIndex:number;rings:EnvelopePoint[][]};
export type EnvelopeFootprint = {type:'Polygon';coordinates:number[][][]};
export type SurveyedBuildingEnvelope = {
 schemaVersion:1;nativeParentId:string;installedFootprintFingerprint:string;
 coordinateFrame:'nsgi-aligned-rd-polynomial'|'legacy-extract-rd-no-nsgi';
 frameProof?:{sourceLoD0Local:number[][][];sourceRawSha256:string;legacyTransform:'scripts/build-3dbag-appearance.ts#toWgs';roundingDecimals:6};
 nativeMetadata:{aggregateHeightM:number;constructionYear:number};
 source:{coordinateScaleM?:[number,number,number];authority:'3DBAG';archivePath:string;rawSha256:string;bagArchivePath:string;bagRawSha256:string;compiledAt:string;surveyYear:number;lod:'2.2';groundNapM:number;quality:{insufficient:boolean;validityErrors:string;rmseM:number}};
 anchorRd:[number,number];footprintLocal:number[][][];
 roofSurfaces:EnvelopeSurface[];exteriorWallTopProfiles:{sourceSurfaceIndex:number;points:EnvelopePoint[]}[];closureSurfaces:EnvelopeSurface[];
};
export type EnvelopeTriangle={p:[EnvelopePoint,EnvelopePoint,EnvelopePoint];n:EnvelopePoint;sourceSurfaceIndex:number;role:'roof'|'closure'};
export type EnvelopeContext={nativeParentId:string;footprint:EnvelopeFootprint;aggregateHeightM:number;constructionYear:number;now?:string;maxSurveyAgeYears?:number};

/** Deterministic guard over the actual installed outline, not a guessed bounding box. */
export function envelopeFootprintFingerprint(footprint:EnvelopeFootprint):string {
 let h=0xcbf29ce484222325n;for(const c of JSON.stringify(footprint)){h^=BigInt(c.charCodeAt(0));h=BigInt.asUintN(64,h*0x100000001b3n);}return `fnv1a64:${h.toString(16).padStart(16,'0')}`;
}
/** Reproduce the existing 3DBAG extractor's horizontal frame explicitly.
 * Source RD coordinates/heights remain untouched. Never apply this legacy
 * display datum to unrelated corrected geographic sources. */
export function surveyedEnvelopeRdToLngLat(envelope:Pick<SurveyedBuildingEnvelope,'coordinateFrame'>,point:RdPoint):LngLat {
 const wgs=rdToLngLat(point);if(envelope.coordinateFrame==='legacy-extract-rd-no-nsgi')return[wgs[0]+NSGI_ALIGNMENT_M.east/(111320*Math.cos(wgs[1]*Math.PI/180)),wgs[1]+NSGI_ALIGNMENT_M.north/111320];return wgs;
}
export function legacyExtractFootprint(anchorRd:readonly number[],rings:number[][][]):EnvelopeFootprint {
 return {type:'Polygon',coordinates:rings.map(r=>{const points=r.map(p=>surveyedEnvelopeRdToLngLat({coordinateFrame:'legacy-extract-rd-no-nsgi'},{x:anchorRd[0]+p[0],y:anchorRd[1]+p[1]}).map(v=>Number(v.toFixed(6))));if(points.length&&JSON.stringify(points[0])!==JSON.stringify(points[points.length-1]))points.push([...points[0]]);return points;})};
}
function installedLngLatToRd(envelope:SurveyedBuildingEnvelope,p:readonly number[]):RdPoint {
 if(envelope.coordinateFrame==='legacy-extract-rd-no-nsgi'){const latitude=p[1]-NSGI_ALIGNMENT_M.north/111320;return lngLatToRd([p[0]-NSGI_ALIGNMENT_M.east/(111320*Math.cos(latitude*Math.PI/180)),latitude]);}return lngLatToRd([p[0],p[1]]);
}
const cross=(a:EnvelopePoint,b:EnvelopePoint,c:EnvelopePoint):EnvelopePoint=>[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])];
const side=(a:readonly number[],b:readonly number[],p:readonly number[])=> (b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function triangulate(surface:EnvelopeSurface,role:'roof'|'closure'):EnvelopeTriangle[]{
 const points=surface.rings.flat(),holes:number[]=[];let offset=0;surface.rings.forEach((r,i)=>{if(i)holes.push(offset);offset+=r.length;});
 const normal=points.slice(2).map(p=>cross(points[0],points[1],p)).find(n=>Math.hypot(...n)>1e-8);if(!normal)throw Error('Degenerate surface');
 const axis=role==='roof'?2:normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs)));
 const axes=[0,1,2].filter(i=>i!==axis),flat=points.flatMap(p=>axes.map(i=>p[i])),ix=earcut(flat,holes,2),out:EnvelopeTriangle[]=[];
 if(!ix.length)throw Error('Untriangulable surface');
 for(let i=0;i<ix.length;i+=3){let p=ix.slice(i,i+3).map(k=>[...points[k]]) as EnvelopeTriangle['p'];let n=cross(...p);if(Math.hypot(...n)<1e-8)continue;if(role==='roof'?n[2]<0:n.reduce((sum,v,j)=>sum+v*normal[j],0)<0){p=[p[0],p[2],p[1]];n=cross(...p);}const l=Math.hypot(...n);out.push({p,n:n.map(x=>x/l)as EnvelopePoint,sourceSurfaceIndex:surface.sourceSurfaceIndex,role});}
 return out;
}
function footprintTriangles(rings:number[][][]):number[][][]{
 const holes:number[]=[];let n=0;rings.forEach((r,i)=>{if(i)holes.push(n);n+=r.length;});const pts=rings.flat(),ix=earcut(pts.flatMap(p=>p.slice(0,2)),holes,2),out:number[][][]=[];
 for(let i=0;i<ix.length;i+=3){let tri=ix.slice(i,i+3).map(k=>pts[k]);if(side(tri[0],tri[1],tri[2])<0)tri=[tri[0],tri[2],tri[1]];out.push(tri);}if(!out.length)throw Error('Invalid footprint');return out;
}
/** Convex clipping interpolates heights along original triangles. Native holes
 * are already absent from the footprint triangulation. */
function clipTriangle(triangle:EnvelopeTriangle,clip:number[][]):EnvelopeTriangle[]{
 let poly:EnvelopePoint[]=triangle.p;
 for(let k=0;k<3;k++){const a=clip[k],b=clip[(k+1)%3],next:EnvelopePoint[]=[];
  for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],sp=side(a,b,p),sq=side(a,b,q),pin=sp>=-1e-9,qin=sq>=-1e-9;if(pin)next.push(p);if(pin!==qin){const t=sp/(sp-sq);next.push(p.map((v,j)=>v+(q[j]-v)*t)as EnvelopePoint);}}poly=next;if(poly.length<3)return [];
 }
 const out:EnvelopeTriangle[]=[];for(let i=1;i<poly.length-1;i++){const p:[EnvelopePoint,EnvelopePoint,EnvelopePoint]=[poly[0],poly[i],poly[i+1]],n=cross(...p);if(triangle.role==='roof'?n[2]>1e-9:Math.hypot(...n)>1e-9){const l=Math.hypot(...n);out.push({...triangle,p,n:n.map(v=>v/l)as EnvelopePoint});}}return out;
}
function validRings(rings:EnvelopePoint[][]){return rings.length>0&&rings.every(r=>r.length>=3&&r.every(p=>p.length===3&&p.every(Number.isFinite)));}
function profileValue(points:EnvelopePoint[],x:number,y:number):number|undefined{
 let value:number|undefined;for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;if(l2<1e-12)continue;const t=((x-a[0])*dx+(y-a[1])*dy)/l2;const clamped=Math.max(0,Math.min(1,t));if(Math.hypot(x-a[0]-clamped*dx,y-a[1]-clamped*dy)>.025)continue;const z=a[2]+clamped*(b[2]-a[2]);value=value===undefined?z:Math.max(value,z);}return value;
}
/** Atomic fallback: native metadata is returned verbatim and never replaced by
 * a local crest/eave. All LODs may retain these cheap roof triangles; wall/door
 * texture and trimming policy belong to the caller. */
export function adaptSurveyedBuildingEnvelope(envelope:SurveyedBuildingEnvelope,context:EnvelopeContext){
 try{
  const s=envelope.source,now=new Date(context.now??new Date().toISOString()),compiled=new Date(s.compiledAt);
  if(envelope.schemaVersion!==1||envelope.nativeParentId!==context.nativeParentId||envelope.installedFootprintFingerprint!==envelopeFootprintFingerprint(context.footprint)||context.constructionYear!==envelope.nativeMetadata.constructionYear||Math.abs(context.aggregateHeightM-envelope.nativeMetadata.aggregateHeightM)>1e-6)return;
  if(s.authority!=='3DBAG'||s.lod!=='2.2'||!s.archivePath||!s.bagArchivePath||![s.rawSha256,s.bagRawSha256].every(x=>/^[a-f0-9]{64}$/.test(x))||!Number.isFinite(+now)||!Number.isFinite(+compiled)||+compiled>+now+60000||now.getUTCFullYear()-s.surveyYear>(context.maxSurveyAgeYears??10)||s.surveyYear>now.getUTCFullYear()||s.quality.insufficient!==false||s.quality.validityErrors!=='[]'||!Number.isFinite(s.quality.rmseM)||s.quality.rmseM>1||!Number.isFinite(s.groundNapM))return;
  if(!envelope.roofSurfaces.length||!envelope.exteriorWallTopProfiles.length||!envelope.footprintLocal.length||!envelope.roofSurfaces.concat(envelope.closureSurfaces).every(s=>validRings(s.rings))||!envelope.exteriorWallTopProfiles.every(p=>p.points.length>=2&&p.points.every(v=>v.length===3&&v.every(Number.isFinite))))return;
  if(!['nsgi-aligned-rd-polynomial','legacy-extract-rd-no-nsgi'].includes(envelope.coordinateFrame))return;
  if(envelope.coordinateFrame==='legacy-extract-rd-no-nsgi'){const proof=envelope.frameProof;if(!proof||proof.sourceRawSha256!==s.rawSha256||proof.legacyTransform!=='scripts/build-3dbag-appearance.ts#toWgs'||proof.roundingDecimals!==6||envelopeFootprintFingerprint(legacyExtractFootprint(envelope.anchorRd,proof.sourceLoD0Local))!==envelope.installedFootprintFingerprint)return;}
  else if(envelope.frameProof)return;
  const installedLocal=context.footprint.coordinates.map(r=>r.map(p=>{const rd=installedLngLatToRd(envelope,p);return[rd.x-envelope.anchorRd[0],rd.y-envelope.anchorRd[1]];}));
  const distanceToRing=(p:number[],ring:number[][])=>Math.min(...ring.map((a,i)=>{const b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,t=l2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)):0;return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}));
  // Installed outlines are rounded in WGS84. Bound only that reprojection gap;
  // this never admits a different footprint or invents/erases a courtyard.
  if(installedLocal.length!==envelope.footprintLocal.length||installedLocal.some((r,i)=>r.some(p=>distanceToRing(p,envelope.footprintLocal[i])>.15)||envelope.footprintLocal[i].some(p=>distanceToRing(p,r)>.15)))return;
  const clips=footprintTriangles(installedLocal),roofTriangles=envelope.roofSurfaces.flatMap(s=>triangulate(s,'roof').flatMap(t=>clips.flatMap(c=>clipTriangle(t,c))));if(!roofTriangles.length)return;
  // Source junction faces receive the same exact native-outline clipping as
  // roofs. Six-decimal extraction changes boundary points by centimetres;
  // clipping prevents overhang without widening any identity/outline guard.
  if(!envelope.closureSurfaces.every(s=>s.rings.flat().every(p=>Number.isFinite(p[2]))))return;
  // Coverage evidence is checked in the original surveyed footprint frame;
  // display triangles are subsequently clipped to the exact installed outline.
  // The legacy frame is admitted only through an exact LoD0+rounding proof.
  const coverageClips=footprintTriangles(envelope.coordinateFrame==='legacy-extract-rd-no-nsgi'?envelope.frameProof!.sourceLoD0Local:envelope.footprintLocal);
  const sourceRoofTriangles=envelope.roofSurfaces.flatMap(s=>triangulate(s,'roof'));
  for(const c of coverageClips)for(const weights of [[1/3,1/3,1/3],[.6,.2,.2],[.2,.6,.2],[.2,.2,.6]]){const p=[0,1].map(j=>weights.reduce((v,w,i)=>v+w*c[i][j],0));if(!sourceRoofTriangles.some(t=>t.p.every((a,i)=>side(a,t.p[(i+1)%3],p)>=-1e-7)||distanceToRing(p,t.p)<.025))return;}
  const closureTriangles=envelope.closureSurfaces.flatMap(s=>triangulate(s,'closure').flatMap(t=>clips.flatMap(c=>clipTriangle(t,c))));
  const wallTopAt=(x:number,y:number)=>{let z:number|undefined;for(const p of envelope.exteriorWallTopProfiles){const v=profileValue(p.points,x,y);if(v!==undefined)z=z===undefined?v:Math.max(z,v);}return z;};
  const wallTopSegments=(start:readonly number[],end:readonly number[])=>{
   const dx=end[0]-start[0],dy=end[1]-start[1],l2=dx*dx+dy*dy;if(l2<1e-8)return;
   const ts=[0,1];for(const profile of envelope.exteriorWallTopProfiles)for(const p of profile.points){const t=((p[0]-start[0])*dx+(p[1]-start[1])*dy)/l2;if(t>0&&t<1&&Math.hypot(p[0]-start[0]-t*dx,p[1]-start[1]-t*dy)<.025)ts.push(t);}
   const lines:{lo:number;hi:number;m:number;b:number}[]=[];
   for(const profile of envelope.exteriorWallTopProfiles)for(let i=1;i<profile.points.length;i++){const a=profile.points[i-1],b=profile.points[i],ta=((a[0]-start[0])*dx+(a[1]-start[1])*dy)/l2,tb=((b[0]-start[0])*dx+(b[1]-start[1])*dy)/l2;if(Math.abs(tb-ta)<1e-8||[a,b].some((p,j)=>Math.hypot(p[0]-start[0]-[ta,tb][j]*dx,p[1]-start[1]-[ta,tb][j]*dy)>.025))continue;const m=(b[2]-a[2])/(tb-ta);lines.push({lo:Math.min(ta,tb),hi:Math.max(ta,tb),m,b:a[2]-m*ta});}
   for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){const a=lines[i],b=lines[j];if(Math.abs(a.m-b.m)<1e-8)continue;const t=(b.b-a.b)/(a.m-b.m);if(t>Math.max(0,a.lo,b.lo)&&t<Math.min(1,a.hi,b.hi))ts.push(t);}
   const sorted=[...new Set(ts)].sort((a,b)=>a-b),result:EnvelopePoint[]=[];for(const t of sorted){const x=start[0]+t*dx,y=start[1]+t*dy,z=wallTopAt(x,y);if(z===undefined)return;result.push([x,y,z]);}for(let i=1;i<sorted.length;i++){const t=(sorted[i-1]+sorted[i])/2;if(wallTopAt(start[0]+t*dx,start[1]+t*dy)===undefined)return;}return result;
  };
  // Full exterior coverage is required before any caller lowers body walls.
  for(const ring of envelope.footprintLocal)for(let i=0;i<ring.length;i++)if(!wallTopSegments(ring[i],ring[(i+1)%ring.length]))return;
  return {nativeParentId:envelope.nativeParentId,roofTriangles,closureTriangles,wallTopAt,wallTopSegments,nativeMetadata:{...envelope.nativeMetadata},anchorRd:[...envelope.anchorRd]as[number,number],coarseRoofTriangles:roofTriangles,sourceRoofTriangles,sourceClosureTriangles:envelope.closureSurfaces.flatMap(s=>triangulate(s,'closure')),sourceCoordinateScaleM:s.coordinateScaleM?[...s.coordinateScaleM]as[number,number,number]:undefined,sourceLoD0Local:envelope.frameProof?.sourceLoD0Local.map(r=>r.map(p=>[...p])),exteriorWallTopProfiles:envelope.exteriorWallTopProfiles.map(p=>({sourceSurfaceIndex:p.sourceSurfaceIndex,points:p.points.map(v=>[...v]as EnvelopePoint)})),coordinateFrame:envelope.coordinateFrame,originLngLat:surveyedEnvelopeRdToLngLat(envelope,{x:envelope.anchorRd[0],y:envelope.anchorRd[1]}),rdToInstalledLngLat:(point:RdPoint)=>surveyedEnvelopeRdToLngLat(envelope,point),installedLngLatToRd:(point:readonly number[])=>installedLngLatToRd(envelope,point)};
 }catch{return;}
}
