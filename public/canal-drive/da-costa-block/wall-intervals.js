/** Source-wall coordinates and evidence partitions. Runtime patches never alter source faces. */
export function wallAxis(surface) {
  const points=surface.rings?.[0]||[];
  let pair,length=0;
  for(const p of points)for(const q of points){const d=Math.hypot(q[0]-p[0],q[2]-p[2]);if(d>length){pair=[p,q];length=d;}}
  if(!pair||length<1e-8)return null;
  pair.sort((p,q)=>p[0]-q[0]||p[2]-q[2]);
  const [a,b]=pair;
  return {origin:[a[0],a[2]],u:[(b[0]-a[0])/length,(b[2]-a[2])/length],length};
}
export const alongWall=(axis,p)=>(p[0]-axis.origin[0])*axis.u[0]+(p[2]-axis.origin[1])*axis.u[1];

export function wallObservationIntervals(surface,surfaceIndex,buildingId,records=[]) {
  const axis=wallAxis(surface);
  if(!axis)return {axis:null,sourceSurfaceIndex:surfaceIndex,intervals:[]};
  const candidates=[];
  for(const record of records){
    if(record.renderBuildingId!==buildingId||!record.renderSurfaceIndices?.includes(surfaceIndex)||
      ['rejected','uncertain','crop-repair'].includes(record.review?.placement)||
      !record.effectiveProposal||record.effectiveProposal.wholeUsable==='no')continue;
    // A reviewed reassignment uses the TARGET interval, never the old photographic wall.
    const target=record.review?.placement==='accepted'&&record.review.targetId&&record.review.targetId!==record.id
      ?records.find(r=>r.id===record.review.targetId):record;
    if(!target||target.buildingId&&target.buildingId!==buildingId)continue;
    const endpoints=[target.localStart,target.localEnd];
    if(endpoints.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)))continue;
    if(endpoints.some(p=>Math.abs((p[0]-axis.origin[0])*axis.u[1]-(p[1]-axis.origin[1])*axis.u[0])>=.8))continue;
    const t=endpoints.map(p=>alongWall(axis,[p[0],0,p[1]]));
    const startM=Math.max(0,Math.min(...t)),endM=Math.min(axis.length,Math.max(...t));
    if(endM-startM>1e-8)candidates.push({record,startM,endM});
  }
  const bounds=[...new Set([0,axis.length,...candidates.flatMap(c=>[c.startM,c.endM])])].sort((a,b)=>a-b);
  const intervals=[];
  for(let i=0;i<bounds.length-1;i++){
    const startM=bounds[i],endM=bounds[i+1];if(endM-startM<1e-8)continue;
    const mid=(startM+endM)/2,active=candidates.filter(c=>c.startM<=mid&&c.endM>=mid);
    const accepted=active.filter(c=>c.record.review?.placement==='accepted');
    const choices=accepted.length?accepted:active;
    const observation=choices.length===1?choices[0].record:null;
    intervals.push({startM,endM,observation,candidateIds:active.map(c=>c.record.id).sort(),
      status:observation?(accepted.length?'human':'machine'):choices.length?'conflict':'uncovered'});
  }
  return {axis,sourceSurfaceIndex:surfaceIndex,intervals};
}

/** Sutherland–Hodgman half-plane clipping, applied to already triangulated source geometry.
 * Clipping triangles (not independently filling rings) preserves holes and concavities. */
export function clipWallTriangles(triangles,axis,startM,endM) {
  function half(poly,bound,sign){
    const out=[];
    for(let i=0;i<poly.length;i++){
      const a=poly[i],b=poly[(i+1)%poly.length],da=sign*(alongWall(axis,a)-bound),db=sign*(alongWall(axis,b)-bound);
      if(da>=0)out.push(a);
      if((da>=0)!==(db>=0)){const t=da/(da-db);out.push(a.map((v,k)=>v+(b[k]-v)*t));}
    }
    return out;
  }
  const out=[];
  for(let i=0;i<triangles.length;i+=9){
    let poly=[triangles.slice(i,i+3),triangles.slice(i+3,i+6),triangles.slice(i+6,i+9)];
    poly=half(half(poly,startM,1),endM,-1);
    for(let k=1;k<poly.length-1;k++){
      const [a,b,c]=[poly[0],poly[k],poly[k+1]],u=b.map((v,j)=>v-a[j]),v=c.map((x,j)=>x-a[j]);
      if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])>1e-10)out.push(...a,...b,...c);
    }
  }
  return out;
}

/** Restrict a source facade frame, retaining its polygon and holes for detail containment. */
export function intervalFaceFrame(frame,axis,interval) {
  if(!frame)return null;
  const world=t=>[axis.origin[0]+axis.u[0]*t,axis.origin[1]+axis.u[1]*t];
  const positions=[interval.startM,interval.endM].map(world).map(p=>(p[0]-frame.a[0])*frame.u[0]+(p[1]-frame.a[1])*frame.u[1]);
  const start=Math.max(0,Math.min(...positions)),end=Math.min(frame.width,Math.max(...positions));
  if(end-start<1e-8)return null;
  const a=[frame.a[0]+frame.u[0]*start,frame.a[1]+frame.u[1]*start],width=end-start;
  return {...frame,a,width,mid:[a[0]+frame.u[0]*width/2,a[1]+frame.u[1]*width/2],
    polygon:frame.polygon.map(p=>[p[0]-start,p[1]]),holes:(frame.holes||[]).map(r=>r.map(p=>[p[0]-start,p[1]])),
    intervalBounded:true,observation:interval.observation,intervalStatus:interval.status};
}
