/** Reconcile dated survey perimeter only to current BAG; interior roof vertices retain XY/Y. */
type P = number[];
type Surface = {index:number;type:string;rings:P[][]};
const EPS=1e-7;
const distance=(a:P,b:P)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const lerp=(a:P,b:P,t:number)=>a.map((v,i)=>v+(b[i]-v)*t);
export function reconcileCollectieSixBoundary(surfaces:Surface[],bagRings:P[][]):Surface[]{
 const bag=bagRings[0].slice(0,-1),ground=surfaces.find(s=>s.type==='GroundSurface')!.rings[0].map(p=>[p[0],p[2]]);
 // Explicit ordered corner correspondence, verified against both source rings. These
 // are ground perimeter indices, not raw CityJSON vertex indices.
 const corners:Record<number,number>={3:18,5:16,7:15,9:14,11:13,12:12,13:11,14:10,16:9,18:8,20:7,23:6,27:3};
 const lens=bag.map((a,i)=>distance(a,bag[(i+1)%bag.length])),starts=[0];for(const l of lens)starts.push(starts.at(-1)!+l);const total=starts.at(-1)!;
 const station=(p:P)=>{let best={d:Infinity,s:0};bag.forEach((a,i)=>{const b=bag[(i+1)%bag.length],v=[b[0]-a[0],b[1]-a[1]],t=Math.max(0,Math.min(1,((p[0]-a[0])*v[0]+(p[1]-a[1])*v[1])/(lens[i]**2))),q=lerp(a,b,t),d=distance(p,q);if(d<best.d)best={d,s:starts[i]+t*lens[i]};});return best.s;};
 const nativeAt=(s:number)=>{s=((s%total)+total)%total;const i=lens.findIndex((l,i)=>s<=starts[i]+l+EPS);return lerp(bag[i],bag[(i+1)%bag.length],(s-starts[i])/lens[i]);};
 const nativeStations=ground.map((p,i)=>corners[i]===undefined?station(p):starts[corners[i]]);
 for(let i=1;i<nativeStations.length;i++)while(nativeStations[i]>=nativeStations[i-1]-EPS)nativeStations[i]-=total;
 nativeStations.push(nativeStations[0]-total);
 const locate=(p:P)=>{let best:{i:number;t:number}|undefined;for(let i=0;i<ground.length;i++){const a=ground[i],b=ground[(i+1)%ground.length],v=[b[0]-a[0],b[1]-a[1]],t=((p[0]-a[0])*v[0]+(p[1]-a[1])*v[1])/(distance(a,b)**2);if(t>=-EPS&&t<=1+EPS&&distance(p,lerp(a,b,t))<EPS){best={i,t:Math.max(0,Math.min(1,t))};break;}}return best;};
 const map=(p:P)=>{const l=locate([p[0],p[2]]);if(!l)return [...p];const q=nativeAt(nativeStations[l.i]+(nativeStations[l.i+1]-nativeStations[l.i])*l.t);return [q[0],p[1],q[1]];};
 // The omitted NW wedge belongs to roof104. Extend its local supported slope
 // through the three surveyed boundary roof vertices (ground25,24,23), not an
 // equipment/ridge maximum or the height of an artificial perimeter bridge.
 const localRoof=surfaces.find(s=>s.index===104&&s.type==='RoofSurface')!.rings[0];
 const planePoints=[25,24,23].map(i=>localRoof.find(p=>distance([p[0],p[2]],ground[i])<EPS)!);
 const [pa,pb,pc]=planePoints,u=pb.map((v,i)=>v-pa[i]),v=pc.map((value,i)=>value-pa[i]);
 const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 if(Math.abs(n[1])<EPS)throw new Error('Collectie Six NW local roof plane is degenerate');
 const mapOnSurface=(p:P,index:number)=>{const q=map(p);
  if((index===13||index===104)&&q[1]>1&&[4,5].some(i=>distance([q[0],q[2]],bag[i])<EPS))q[1]=pa[1]-(n[0]*(q[0]-pa[0])+n[2]*(q[2]-pa[2]))/n[1];
  return q;
 };
 // Current corners expressed on original survey boundary. Insert in every incident
 // roof/wall edge, sharing XY and heights; the NW wedge uses the local plane above.
 const breaks:P[]=[];
 for(let i=0;i<ground.length;i++){const a=nativeStations[i],b=nativeStations[i+1];for(const s of starts.slice(0,-1)){for(let k=Math.floor(b/total)-1;k<=Math.ceil(a/total)+1;k++){const q=s+k*total;if(q<b+EPS||q>a-EPS)continue;const t=(q-a)/(b-a);if(t>EPS&&t<1-EPS)breaks.push(lerp(ground[i],ground[(i+1)%ground.length],t));}}}
 const edgeBreaks=(a:P,b:P)=>{const xyA=[a[0],a[2]],xyB=[b[0],b[2]],len=distance(xyA,xyB);if(len<EPS||!locate(xyA)||!locate(xyB)||!locate(lerp(xyA,xyB,.5)))return [];return breaks.map(q=>({q,t:((q[0]-xyA[0])*(xyB[0]-xyA[0])+(q[1]-xyA[1])*(xyB[1]-xyA[1]))/(len*len)})).filter(v=>v.t>EPS&&v.t<1-EPS&&distance(v.q,lerp(xyA,xyB,v.t))<EPS).sort((a,b)=>a.t-b.t);};
 const insert=(ring:P[],index:number)=>ring.flatMap((p,i)=>[mapOnSurface(p,index),...edgeBreaks(p,ring[(i+1)%ring.length]).map(v=>mapOnSurface(lerp(p,ring[(i+1)%ring.length],v.t),index))]);
 const out:Surface[]=[];
 for(const surface of surfaces){
  const ring=surface.rings[0],a=ring[0],b=ring.find(p=>Math.hypot(p[0]-a[0],p[2]-a[2])>EPS);
  // Bent external walls need separate planar panels; triangulating one projected
  // polygon across a BAG jog would bridge its recess. Clip the original elevation
  // polygon into strips at each new native corner before mapping.
  if(surface.type==='WallSurface'&&surface.rings.length===1&&b&&ring.every(p=>locate([p[0],p[2]]))){
   const dx=b[0]-a[0],dz=b[2]-a[2],ll=dx*dx+dz*dz,tOf=(p:P)=>((p[0]-a[0])*dx+(p[2]-a[2])*dz)/ll;
   if(ring.every(p=>Math.hypot(p[0]-a[0]-dx*tOf(p),p[2]-a[2]-dz*tOf(p))<EPS)){
    const ts=ring.map(tOf),lo=Math.min(...ts),hi=Math.max(...ts),left=lerp(a,b,lo),right=lerp(a,b,hi),cuts=[lo,...edgeBreaks(left,right).map(v=>lo+(hi-lo)*v.t),hi];
    const clip=(poly:P[],cut:number,above:boolean)=>{const result:P[]=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],tp=tOf(p),tq=tOf(q),ip=above?tp>=cut-EPS:tp<=cut+EPS,iq=above?tq>=cut-EPS:tq<=cut+EPS;if(ip)result.push(p);if(ip!==iq)result.push(lerp(p,q,(cut-tp)/(tq-tp)));}return result;};
    for(let i=0;i<cuts.length-1;i++){const poly=clip(clip(ring,cuts[i],true),cuts[i+1],false);if(poly.length>=3)out.push({...surface,rings:[poly.map(p=>mapOnSurface(p,surface.index))]});}continue;
   }
  }
  out.push({...surface,rings:surface.rings.map(r=>insert(r,surface.index))});
 }
 return out;
}
