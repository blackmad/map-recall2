/** Small display-only extension to include already selected frontage endpoints. */
export function neighbourhoodDisplayBounds(sourceBounds,records,{marginM=2,maxExtensionM=10}={}){
  const bounds=[...sourceBounds];
  const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
  for(const r of records)for(const p of [r.localStart,r.localEnd]){
    if(!validPoint(p))continue;
    bounds[0]=Math.min(bounds[0],Math.floor(p[0]-marginM));bounds[1]=Math.min(bounds[1],Math.floor(p[1]-marginM));
    bounds[2]=Math.max(bounds[2],Math.ceil(p[0]+marginM));bounds[3]=Math.max(bounds[3],Math.ceil(p[1]+marginM));
  }
  bounds[0]=Math.max(bounds[0],sourceBounds[0]-maxExtensionM);bounds[1]=Math.max(bounds[1],sourceBounds[1]-maxExtensionM);
  bounds[2]=Math.min(bounds[2],sourceBounds[2]+maxExtensionM);bounds[3]=Math.min(bounds[3],sourceBounds[3]+maxExtensionM);
  const clippedFrontageIds=records.filter(r=>[r.localStart,r.localEnd].some(p=>!validPoint(p)||p[0]<bounds[0]||p[0]>bounds[2]||p[1]<bounds[1]||p[1]>bounds[3])).map(r=>r.id);
  return {sourceBounds:[...sourceBounds],bounds,marginM,maxExtensionM,clippedFrontageIds,source:'display-only existing-frontage coverage; no new data acquisition'};
}
