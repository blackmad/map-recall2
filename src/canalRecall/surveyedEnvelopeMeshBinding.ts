import {envelopeFootprintFingerprint} from './surveyedBuildingEnvelope.js';
import type {adaptSurveyedBuildingEnvelope,EnvelopeFootprint,EnvelopePoint,EnvelopeTriangle} from './surveyedBuildingEnvelope.js';

type ValidatedEnvelopePlan=NonNullable<ReturnType<typeof adaptSurveyedBuildingEnvelope>>;
export type NativeWallTopSegment={t0:number;t1:number;z0:number;z1:number;sourceSurfaceIndices:number[]};
export type SurveyedMeshWallEdge={nativeEdgeIndex:number;start:[number,number];end:[number,number];sourceStart:[number,number];sourceEnd:[number,number];segments:NativeWallTopSegment[];topAt:(t:number)=>number|undefined};
const NUMERIC_EPS=1e-10;
const open=(ring:number[][])=>ring.length>1&&JSON.stringify(ring[0])===JSON.stringify(ring[ring.length-1])?ring.slice(0,-1):ring;

/** A source-specific binding, not a generic roof or city-wide wall-height prior.
 * Installed vertices match the validated LoD0/legacy extraction exactly. Source
 * quantization cells come from the archived CityJSON scale, not a tuned distance
 * tolerance. Heights remain on original source profile segments. */
export function bindSurveyedEnvelopeToMesh(plan:ValidatedEnvelopePlan,footprint:EnvelopeFootprint,meshOrigin:{lng:number;lat:number}){
 try{
  if(plan.coordinateFrame!=='legacy-extract-rd-no-nsgi'||!plan.sourceLoD0Local||footprint.type!=='Polygon'||footprint.coordinates.length!==1||plan.sourceLoD0Local.length!==1||![meshOrigin.lng,meshOrigin.lat].every(Number.isFinite))return;
  const scale=plan.sourceCoordinateScaleM;if(!scale||scale.some(v=>!Number.isFinite(v)||v<=0||v>.01))return;
  const source=open(plan.sourceLoD0Local[0]),native=open(footprint.coordinates[0]);if(source.length!==native.length||source.length<3)return;
  const rounded=source.map(p=>plan.rdToInstalledLngLat({x:plan.anchorRd[0]+p[0],y:plan.anchorRd[1]+p[1]}).map(v=>Number(v.toFixed(6))));
  const matches=native.map(p=>rounded.flatMap((q,i)=>JSON.stringify(p)===JSON.stringify(q)?[i]:[]));if(matches.some(m=>m.length!==1))return;
  const mapping=matches.map(m=>m[0]);if(new Set(mapping).size!==source.length)return;
  // Preserve cyclic source topology, including reversal, without admitting a
  // different outline or mapping a roof hole onto a ground courtyard.
  const direction=(mapping[1]-mapping[0]+source.length)%source.length===1?1:-1;
  if(mapping.some((v,i)=>v!==(mapping[0]+direction*i+source.length*i)%source.length))return;
  const kx=111320*Math.cos(meshOrigin.lat*Math.PI/180),toMesh=(w:readonly number[]):[number,number]=>[(w[0]-meshOrigin.lng)*kx,(w[1]-meshOrigin.lat)*110540];
  const edges:SurveyedMeshWallEdge[]=native.map((p,i)=>({nativeEdgeIndex:i,start:toMesh(p),end:toMesh(native[(i+1)%native.length]),sourceStart:source[mapping[i]].slice(0,2)as[number,number],sourceEnd:source[mapping[(i+1)%native.length]].slice(0,2)as[number,number],segments:[],topAt:()=>undefined}));
  type Line={t0:number;t1:number;z0:number;z1:number;id:number;cover0?:number;cover1?:number};const byEdge:Line[][]=edges.map(()=>[]);
  for(const profile of plan.exteriorWallTopProfiles){
   const fits:number[]=[];
   edges.forEach((edge,i)=>{const a=edge.sourceStart,b=edge.sourceEnd,dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;if(l2<1e-10)return;
    // The source point and source edge endpoints each carry half a quantization
    // cell. Their combined cross-product uncertainty is exactly one source cell.
    const crossBound=Math.abs(dy)*scale[0]+Math.abs(dx)*scale[1],alongBound=Math.abs(dx)*scale[0]+Math.abs(dy)*scale[1];
    if(profile.points.every(p=>{const cross=dx*(p[1]-a[1])-dy*(p[0]-a[0]),dot=(p[0]-a[0])*dx+(p[1]-a[1])*dy;return Math.abs(cross)<=crossBound+NUMERIC_EPS&&dot>=-alongBound-NUMERIC_EPS&&dot<=l2+alongBound+NUMERIC_EPS;}))fits.push(i);
   });
   if(fits.length!==1)return;const index=fits[0],edge=edges[index],a=edge.sourceStart,b=edge.sourceEnd,dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy;
   for(let j=1;j<profile.points.length;j++){const p=profile.points[j-1],q=profile.points[j],t0=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2,t1=((q[0]-a[0])*dx+(q[1]-a[1])*dy)/l2;if(Math.abs(t1-t0)<NUMERIC_EPS)continue;byEdge[index].push(t0<t1?{t0,t1,z0:p[2],z1:q[2],id:profile.sourceSurfaceIndex}:{t0:t1,t1:t0,z0:q[2],z1:p[2],id:profile.sourceSurfaceIndex});}
  }
  const lineHeight=(l:Line,t:number)=>l.z0+(l.z1-l.z0)*(t-l.t0)/(l.t1-l.t0);
  for(let i=0;i<edges.length;i++){
   const lines=byEdge[i];if(!lines.length)return;const edge=edges[i],length=Math.hypot(edge.sourceEnd[0]-edge.sourceStart[0],edge.sourceEnd[1]-edge.sourceStart[1]);
   // Endpoint cell intersections correspond to the same original source corner;
   // snap only endpoints whose archived quantization cells reach that corner.
   const tCell=Math.hypot(scale[0],scale[1])/length;
   for(const line of lines){line.cover0=Math.abs(line.t0)<tCell?0:line.t0;line.cover1=Math.abs(line.t1-1)<tCell?1:line.t1;}
   const ts=[0,1,...lines.flatMap(l=>[l.cover0!,l.cover1!]).filter(t=>t>0&&t<1)];
   for(let j=0;j<lines.length;j++)for(let k=j+1;k<lines.length;k++){const a=lines[j],b=lines[k],ma=(a.z1-a.z0)/(a.t1-a.t0),mb=(b.z1-b.z0)/(b.t1-b.t0);if(Math.abs(ma-mb)<NUMERIC_EPS)continue;const t=(b.z0-mb*b.t0-a.z0+ma*a.t0)/(ma-mb);if(t>Math.max(0,a.t0,b.t0)&&t<Math.min(1,a.t1,b.t1))ts.push(t);}
   const sorted=[...new Set(ts)].sort((a,b)=>a-b);
   for(let j=1;j<sorted.length;j++){const t0=sorted[j-1],t1=sorted[j],mid=(t0+t1)/2,active=lines.filter(l=>mid>=l.cover0!-NUMERIC_EPS&&mid<=l.cover1!+NUMERIC_EPS);if(!active.length)return;const top=active.reduce((a,b)=>lineHeight(a,mid)>=lineHeight(b,mid)?a:b);edge.segments.push({t0,t1,z0:lineHeight(top,t0),z1:lineHeight(top,t1),sourceSurfaceIndices:active.map(l=>l.id)});}
   edge.topAt=(t:number)=>{if(!Number.isFinite(t)||t<0||t>1)return;const active=edge.segments.filter(s=>t>=s.t0-NUMERIC_EPS&&t<=s.t1+NUMERIC_EPS);return active.length?Math.max(...active.map(s=>s.z0+(s.z1-s.z0)*(t-s.t0)/(s.t1-s.t0))):undefined;};
  }
  const sourceToMesh=(p:readonly number[])=>toMesh(plan.rdToInstalledLngLat({x:plan.anchorRd[0]+p[0],y:plan.anchorRd[1]+p[1]}));
  const cornerDisplacements=source.map((p,i)=>{const match=native[mapping.indexOf(i)],rd=plan.installedLngLatToRd(match);return Math.hypot(rd.x-plan.anchorRd[0]-p[0],rd.y-plan.anchorRd[1]-p[1]);});
  const cellDiagonal=Math.hypot(scale[0],scale[1]),collarWidthM=Math.max(...cornerDisplacements)+2*cellDiagonal;
  const area=source.reduce((sum,a,i)=>{const b=source[(i+1)%source.length];return sum+a[0]*b[1]-b[0]*a[1];},0),sign=area>0?1:-1;
  // The correction band is measured from this exact source/native pairing.
  // It is a display attachment, not a surveyed roof-family dimension.
  const bands=source.map((a,i)=>{const b=source[(i+1)%source.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy),ux=dx/len,uy=dy/len,nx=-uy*sign,ny=ux*sign,w=collarWidthM;
   const r=[[a[0]-ux*w,a[1]-uy*w],[b[0]+ux*w,b[1]+uy*w],[b[0]+ux*w+nx*w,b[1]+uy*w+ny*w],[a[0]-ux*w+nx*w,a[1]-uy*w+ny*w]];return sign>0?r:r.reverse();
  });
  const mappedPoint=(p:EnvelopePoint,attachment:boolean):EnvelopePoint=>{
   const xy=sourceToMesh(p);if(!attachment)return[...xy,p[2]];
   let nearest:{edge:SurveyedMeshWallEdge;t:number;distance:number;point:number[]}|undefined;
   for(const edge of edges){const a=edge.sourceStart,b=edge.sourceEnd,dx=b[0]-a[0],dy=b[1]-a[1],l2=dx*dx+dy*dy,t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2)),q=[a[0]+t*dx,a[1]+t*dy],distance=Math.hypot(p[0]-q[0],p[1]-q[1]);if(!nearest||distance<nearest.distance)nearest={edge,t,distance,point:q};}
   if(!nearest||nearest.distance>=collarWidthM)return[...xy,p[2]];
   const {edge,t,distance,point}=nearest,nativeXY=[edge.start[0]+(edge.end[0]-edge.start[0])*t,edge.start[1]+(edge.end[1]-edge.start[1])*t],sourceXY=sourceToMesh(point),weight=distance<=cellDiagonal?1:(collarWidthM-distance)/(collarWidthM-cellDiagonal);
   const zExpected=edge.topAt(t)!,maxSlope=Math.max(...edge.segments.map(s=>Math.abs(s.z1-s.z0)/((s.t1-s.t0)*Math.hypot(edge.sourceEnd[0]-edge.sourceStart[0],edge.sourceEnd[1]-edge.sourceStart[1]))));
   // A lower source roof at a multi-level junction is not raised to the maximum
   // wall profile. Only a source-consistent exterior top joins that same top.
   const z=distance<=cellDiagonal&&Math.abs(p[2]-zExpected)<=2*scale[2]+maxSlope*cellDiagonal?zExpected:p[2];
   return distance<=cellDiagonal?[nativeXY[0],nativeXY[1],z]:[xy[0]+(nativeXY[0]-sourceXY[0])*weight,xy[1]+(nativeXY[1]-sourceXY[1])*weight,z];
  };
  const sourceRoofTriangles=plan.sourceRoofTriangles??plan.roofTriangles,sourceClosureTriangles=plan.sourceClosureTriangles??plan.closureTriangles;
  let unchangedInteriorTriangles=0,attachmentTriangles=0;
  const transform=(triangle:EnvelopeTriangle):EnvelopeTriangle[]=>{
   let remaining:EnvelopePoint[][]=[triangle.p];const collars:EnvelopePoint[][]=[];
   for(const band of bands){const next:EnvelopePoint[][]=[];for(const poly of remaining){const split=partitionSourceRect(poly,band);if(split.inside.length)collars.push(split.inside);next.push(...split.outside);}remaining=next;}
   const out:EnvelopeTriangle[]=[];
   for(const [polygons,attachment]of[[remaining,false],[collars,true]]as const)for(const poly of polygons){const points=poly.map(p=>mappedPoint(p,attachment));for(let i=1;i<points.length-1;i++){const p:EnvelopeTriangle['p']=[points[0],points[i],points[i+1]],a=p[0],b=p[1],c=p[2],n:EnvelopePoint=[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])],l=Math.hypot(...n);if(l<1e-10)continue;if(triangle.role==='roof'&&Math.abs(n[2])<1e-10)continue;if(triangle.role==='roof'&&n[2]<0)throw Error('Folded source roof attachment');out.push({...triangle,p,n:n.map(v=>v/l)as EnvelopePoint});if(attachment)attachmentTriangles++;else unchangedInteriorTriangles++;}}
   return out;
  };
  const roofTriangles=sourceRoofTriangles.flatMap(transform),closureTriangles=sourceClosureTriangles.flatMap(transform);if(!roofTriangles.length)return;
  return {nativeParentId:plan.nativeParentId,installedFootprintFingerprint:envelopeFootprintFingerprint(footprint),edges,roofTriangles,closureTriangles,coarseRoofTriangles:roofTriangles,nativeMetadata:{...plan.nativeMetadata},attachment:{method:'source-LoD0-to-rounded-native-perimeter-collar',maxCornerDisplacementM:Math.max(...cornerDisplacements),collarWidthM,unchangedInteriorTriangles,attachmentTriangles,sourceQuantizationM:[...scale]},meshOrigin:{...meshOrigin}};
 }catch{return;}
}

export type SurveyedMeshBinding=NonNullable<ReturnType<typeof bindSurveyedEnvelopeToMesh>>;

/** Partition a source polygon at a vertical half-plane. Used on roofs AND
 * vertical junction faces; unlike XY area subtraction it retains wall faces. */
function splitSourcePolygon(poly:EnvelopePoint[],a:number[],b:number[]):{inside:EnvelopePoint[];outside:EnvelopePoint[]}{
 const side=(p:EnvelopePoint)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]),ds=poly.map(side);
 if(ds.every(d=>d>=-1e-12))return{inside:poly,outside:[]};if(ds.every(d=>d<=1e-12))return{inside:[],outside:poly};
 const inside:EnvelopePoint[]=[],outside:EnvelopePoint[]=[];
 poly.forEach((p,i)=>{const q=poly[(i+1)%poly.length],dp=ds[i],dq=ds[(i+1)%poly.length];if(dp>=0)inside.push(p);if(dp<=0)outside.push(p);if((dp>0&&dq<0)||(dp<0&&dq>0)){const t=dp/(dp-dq),r=p.map((v,j)=>v+(q[j]-v)*t)as EnvelopePoint;inside.push(r);outside.push(r);}});return{inside,outside};
}
function partitionSourceRect(poly:EnvelopePoint[],rect:number[][]){
 let inside=poly;const outside:EnvelopePoint[][]=[];
 for(let i=0;i<rect.length&&inside.length>=3;i++){const split=splitSourcePolygon(inside,rect[i],rect[(i+1)%rect.length]);if(split.outside.length>=3)outside.push(split.outside);inside=split.inside;}
 return{inside:inside.length>=3?inside:[],outside};
}
