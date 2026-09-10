/** Pure per-wall association shared by the publisher, renderer and regression checks. */
export function surfaceMatches(b,r){
  const [a,c]=[r.localStart,r.localEnd],dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz);
  if(!len)return [];
  const ux=dx/len,uz=dz/len;
  return b.surfaces.flatMap((s,i)=>{
    if(s.type!=='wall')return [];
    const points=s.rings[0],dist=points.map(p=>Math.abs((p[0]-a[0])*uz-(p[2]-a[1])*ux));
    const along=points.map(p=>(p[0]-a[0])*ux+(p[2]-a[1])*uz);
    const overlap=Math.min(len,Math.max(...along))-Math.max(0,Math.min(...along));
    return Math.max(...dist)<.8&&overlap>Math.min(2,len*.5)?[i]:[];
  });
}
/** Compatibility lookup only. Renderers must use wallObservationIntervals for shared walls. */
export function observationFor(records,buildingId,surfaceIndex){
  const matches=(records||[]).filter(r=>r.renderBuildingId===buildingId&&r.renderSurfaceIndices.includes(surfaceIndex)&&!['rejected','uncertain','crop-repair'].includes(r.review?.placement)&&r.effectiveProposal&&r.effectiveProposal.wholeUsable!=='no');
  const accepted=matches.filter(r=>r.review?.placement==='accepted'),choices=accepted.length?accepted:matches;
  return choices.length===1?choices[0]:undefined;
}
/** A small palette preserves geometry batching; aerial medians are not material labels. */
export function roofPalette(hex){
  if(!/^#[0-9a-f]{6}$/i.test(hex||''))return null;
  const palette=['#62666a','#737679','#858682','#96978d','#a4a497','#776f65','#8a7768','#9a8574'];
  const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),source=rgb(hex);
  const distance=h=>rgb(h).reduce((s,v,i)=>s+(v-source[i])**2,0);
  return palette.reduce((a,b)=>distance(a)<distance(b)?a:b);
}
