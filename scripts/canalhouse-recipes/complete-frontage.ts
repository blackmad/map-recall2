/** Survey discovery only: retain native edges and the selected chord; never
 * turn the candidate into an authored/accepted frontage or infer a house style. */
export interface FrontageDiscoveryOptions {
 streetNormalRD?:number[];
 maxFacadeAngleDeg?:number;
 maxOffPlaneM?:number;
 maxJogM?:number;
 maxAddedWidthM?:number;
 maxEdges?:number;
}
const distance=(a:number[],b:number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
export function discoverCompleteFrontage(polygonsRD:number[][][][],selectedEndpointsRD:number[][],options:FrontageDiscoveryOptions={}) {
 const limits={maxFacadeAngleDeg:35,maxOffPlaneM:1.5,maxJogM:.35,maxAddedWidthM:20,maxEdges:32,...options};
 if(selectedEndpointsRD.length!==2||selectedEndpointsRD.some(p=>p.length<2||!p.slice(0,2).every(Number.isFinite)))throw Error('Expected two finite selected native endpoints');
 for(const k of ['maxFacadeAngleDeg','maxOffPlaneM','maxJogM','maxAddedWidthM','maxEdges'] as const)if(!Number.isFinite(limits[k])||limits[k]<=0)throw Error('Invalid frontage discovery limit '+k);
 if(limits.maxFacadeAngleDeg>=90||!Number.isInteger(limits.maxEdges))throw Error('Invalid frontage discovery angle/edge bound');
 if(limits.maxJogM>1)throw Error('Frontage max jog must be greater than zero and at most 1m');
 const [a,b]=selectedEndpointsRD,widthM=distance(a,b);if(widthM<=1e-5)throw Error('Degenerate selected frontage');
 const matches=polygonsRD.flatMap((poly,polygonIndex)=>{
  // Explicitly closed source rings retain their coordinates; the duplicate
  // closing vertex does not represent an additional edge.
  const raw=poly[0],ring=raw?.length>1&&distance(raw[0],raw.at(-1)!)<1e-8?raw.slice(0,-1):raw;
  if(!ring||ring.length<3)return [];
  const start=ring.findIndex(p=>distance(p,a)<1e-5),end=ring.findIndex(p=>distance(p,b)<1e-5);
  return start>=0&&end>=0?[{polygonIndex,ring,start,end}]:[];
 });
 if(matches.length!==1)throw Error('Selected endpoints must identify one native outer ground ring');
 const {polygonIndex,ring,start,end}=matches[0],n=ring.length;
 const area=ring.reduce((s,p,i)=>{const q=ring[(i+1)%n];return s+(p[0]-a[0])*(q[1]-a[1])-(q[0]-a[0])*(p[1]-a[1]);},0)/2;
 if(Math.abs(area)<1e-8)throw Error('Degenerate native ground ring');
 const tangent=[(b[0]-a[0])/widthM,(b[1]-a[1])/widthM],mod=(i:number)=>(i+n)%n;
 const walk=(step:number)=>{const indices:number[]=[];let v=start;while(v!==end){indices.push(step===1?v:mod(v-1));v=mod(v+step);}return indices;};
 const paths=[walk(1),walk(-1)];
 const outward=(index:number)=>{const p=ring[index],q=ring[mod(index+1)],len=distance(p,q),sign=area>0?1:-1;return len?[sign*(q[1]-p[1])/len,-sign*(q[0]-p[0])/len]:[0,0];};
 // The shorter boundary path supplies a provisional side when no surveyed
 // street normal is available. Report that assumption for human review.
 const shortPath=paths.reduce((p,q)=>q.reduce((s,i)=>s+distance(ring[i],ring[mod(i+1)]),0)<p.reduce((s,i)=>s+distance(ring[i],ring[mod(i+1)]),0)?q:p);
 const side=shortPath.reduce((s,i)=>{const o=outward(i),len=distance(ring[i],ring[mod(i+1)]);return s+(o[0]*tangent[1]-o[1]*tangent[0])*len;},0)>=0?1:-1;
 const provided=options.streetNormalRD,normal=provided?[...provided]:[side*tangent[1],-side*tangent[0]],normalLength=Math.hypot(normal[0],normal[1]);
 if(normal.length!==2||!normal.every(Number.isFinite)||normalLength<=1e-8)throw Error('Invalid street normal');
 normal[0]/=normalLength;normal[1]/=normalLength;
 const project=(p:number[])=>[(p[0]-a[0])*tangent[0]+(p[1]-a[1])*tangent[1],(p[0]-a[0])*normal[0]+(p[1]-a[1])*normal[1]];
 const edges=ring.map((p,edgeIndex)=>{
  const q=ring[mod(edgeIndex+1)],pa=project(p),pb=project(q),o=outward(edgeIndex),alignment=o[0]*normal[0]+o[1]*normal[1];
  return {polygonIndex,ringIndex:0,edgeIndex,endpointsRD:[[...p],[...q]],lengthM:distance(p,q),projectedWidthM:Math.abs(pb[0]-pa[0]),alongRangeM:[Math.min(pa[0],pb[0]),Math.max(pa[0],pb[0])],offPlaneDistancesM:[pa[1],pb[1]],outwardNormalRD:o,streetNormalAlignment:alignment};
 });
 const facade=(i:number)=>edges[i].streetNormalAlignment>=Math.cos(limits.maxFacadeAngleDeg*Math.PI/180)&&edges[i].offPlaneDistancesM.every(v=>Math.abs(v)<=limits.maxOffPlaneM);
 const jog=(i:number)=>edges[i].lengthM<=limits.maxJogM&&edges[i].offPlaneDistancesM.every(v=>Math.abs(v)<=limits.maxOffPlaneM);
 const qualifyingPaths=paths.map((p,i)=>({p,step:i===0?1:-1})).filter(({p})=>p.length<=limits.maxEdges&&p.every(i=>facade(i)||jog(i))&&p.some(facade));
 const uncertainty=['Candidate requires source/photo review; outward-facing geometry does not establish street exposure, architectural unity or complete ownership frontage.'];
 if(!provided)uncertainty.push('Street normal inferred from the shorter native boundary path; verify its street-facing side.');
 if(polygonsRD.length>1)uncertainty.push('Other ground polygons were not joined; disconnected or separately surveyed frontage may remain.');
 const selected=qualifyingPaths.length===1?qualifyingPaths[0]:null;
 if(!selected)uncertainty.push(qualifyingPaths.length?'Both native boundary paths qualify; no complete frontage candidate selected.':'Selected chord has no bounded outward-facing boundary path; no complete frontage candidate selected.');
 const chain=selected?[...selected.p]:[],stops:{edgeIndex:number;reason:string;lengthM:number;streetNormalAngleDeg:number;maxOffPlaneM:number;nearParallelFacadeBeyondRejectedJog:boolean}[]=[];
 const stop=(i:number,reason:string,nearParallelFacadeBeyondRejectedJog=false)=>stops.push({edgeIndex:i,reason,lengthM:edges[i].lengthM,streetNormalAngleDeg:Math.acos(Math.max(-1,Math.min(1,edges[i].streetNormalAlignment)))*180/Math.PI,maxOffPlaneM:Math.max(...edges[i].offPlaneDistancesM.map(Math.abs)),nearParallelFacadeBeyondRejectedJog});
 const extend=(atStart:boolean)=>{
  if(!selected)return;
  for(let count=0;count<limits.maxEdges;count++){
   const current=atStart?chain[0]:chain.at(-1)!,next=mod(current+(atStart?-selected.step:selected.step));
   if(chain.includes(next)){stop(next,'closed-ring boundary');break;}
   let additions=[next];
   if(!facade(next)){
    const after=mod(next+(atStart?-selected.step:selected.step));
    if(!jog(next)||chain.includes(after)||!facade(after)){
     const near=edges[next].lengthM<=1&&edges[next].offPlaneDistancesM.every(v=>Math.abs(v)<=limits.maxOffPlaneM)&&!chain.includes(after)&&facade(after);
     stop(next,'not an outward-facing facade or a short jog connecting one',near);break;
    }
    additions.push(after);
   }
   const expanded=[...chain,...additions],range=expanded.flatMap(i=>edges[i].alongRangeM),added=Math.max(...range)-Math.min(...range)-widthM;
   if(expanded.length>limits.maxEdges||added>limits.maxAddedWidthM){stop(next,'bounded edge/added-width limit');break;}
   if(atStart)chain.unshift(...additions.reverse());else chain.push(...additions);
  }
 };
 extend(true);extend(false);
 const possiblePartialFront=stops.some(s=>s.nearParallelFacadeBeyondRejectedJog);
 if(possiblePartialFront)uncertainty.push('Possible partial selected frontage: a near-parallel outward facade lies beyond a rejected native jog of at most 1m. Inspect sources and explicitly review a bounded jog-limit override.');
 const candidateEdges=chain.map(i=>({...edges[i],role:facade(i)?'outward-facade':'short-jog',selectedPath:selected?.p.includes(i)??false}));
 if(candidateEdges.some(e=>e.role==='short-jog'))uncertainty.push('Short native jogs retained; the frontage is not a single planar facade.');
 const range=candidateEdges.flatMap(e=>e.alongRangeM);
 const orderedVerticesRD=selected?[...chain.map(i=>[...ring[selected.step===1?i:mod(i+1)]]),[...ring[selected.step===1?mod(chain.at(-1)!+1):chain.at(-1)!]]]:[];
 return {status:'discovery-only-not-acceptance',selectedEndpointsRD:selectedEndpointsRD.map(p=>[...p]),selectedWidthM:widthM,polygonIndex,streetNormalRD:normal,streetNormalSource:provided?'provided':'shorter-native-path-assumption',limits,possiblePartialFront,candidate:!selected?null:{edges:candidateEdges,orderedVerticesRD,widthM:Math.max(...range)-Math.min(...range),boundaryLengthM:candidateEdges.reduce((s,e)=>s+e.lengthM,0),extendsSelectedFront:chain.some(i=>!selected.p.includes(i))},stops,uncertainty};
}
