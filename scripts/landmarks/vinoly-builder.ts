import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import sources from './vinoly-footprints.json';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
type P=[number,number];type Colour=Parameters<BuildingTools['add']>[1];
/** Native-scale original Mahler4: surveyed stepped volumes, recessed spiral,
 * continuous anodized vertical fins, transparent ground frontage. */
export function buildVinoly(_width:number,_depth:number,b:BuildingTools):void {
 const shape=(r:P[])=>new T.Shape(r.map(p=>new T.Vector2(...p)));
 const area=(r:P[])=>r.reduce((s,p,i)=>s+p[0]*r[(i+1)%r.length][1]-r[(i+1)%r.length][0]*p[1],0);
 function inset(r:P[],distance:number):P[]{
  const lines=r.map((a,i)=>{const q=r[(i+1)%r.length],dx=q[0]-a[0],dz=q[1]-a[1],len=Math.hypot(dx,dz),s=area(r)>0?1:-1;return {a:[a[0]-dz/len*s*distance,a[1]+dx/len*s*distance] as P,d:[dx,dz] as P}});
  return lines.map((l,i)=>{const p=lines[(i+r.length-1)%r.length],cross=p.d[0]*l.d[1]-p.d[1]*l.d[0],t=((l.a[0]-p.a[0])*l.d[1]-(l.a[1]-p.a[1])*l.d[0])/cross;return [p.a[0]+t*p.d[0],p.a[1]+t*p.d[1]]});
 }
 function beam(a:T.Vector3,q:T.Vector3,w:number,d:number,c:Colour){const delta=q.clone().sub(a),g=new T.BoxGeometry(w,delta.length(),d);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));const m=a.clone().add(q).multiplyScalar(.5);b.add(g,c,m.x,m.y,m.z)}
 const parts=sources.parts;
 for(const p of parts){
  const id=p.properties.osmId;if(id==='w754894011')continue;
  const ring=p.localRing as P[],tower=id!=='w754894014',upper=id==='w754894013';
  const base=upper?62.2:0,top=upper?90.95:tower?62.2:26.19;
  const inner=inset(ring,2.3);
  // The retreating backing owns no outer wall across the stair notch.
  b.add(openTopPrism(shape(inner),base,top),'dark');
  // Where an ascending flight reaches a terrace/crown, its headroom owns the
  // roof edge too. An uncut horizontal cap would seal the last landing.
  const roofRing=ring.map(p=>[...p] as P);
  for(const flight of sources.staircaseTrace.chains.flatMap(c=>c.segments).filter(s=>s.part===id)){
   const e=flight.edge,a=ring[e],q=ring[(e+1)%ring.length],dx=q[0]-a[0],dz=q[1]-a[1],len=Math.hypot(dx,dz),nx=(area(ring)>0?dz:-dz)/len,nz=(area(ring)>0?-dx:dx)/len;
   const y0=flight.reverse?flight.end:flight.start,y1=flight.reverse?flight.start:flight.end;
   if(Math.max(y0,y1)+2.35<=top)continue;
   const margin=Math.min(.45,1.90/len),t=margin+(1-2*margin)*(top-2.35-y0)/(y1-y0),cut:P=[a[0]+dx*t,a[1]+dz*t],inside:P=[cut[0]-nx*2.3,cut[1]-nz*2.3];
   if(y0>y1){roofRing[e]=[a[0]-nx*2.3,a[1]-nz*2.3];roofRing.splice(e+1,0,inside,cut)}
   else {roofRing[(e+1)%ring.length]=[q[0]-nx*2.3,q[1]-nz*2.3];roofRing.splice(e+1,0,cut,inside)}
  }
  b.add(upwardRoofPlane(shape(roofRing),top),'slate');
  const ar=area(ring);
  for(let edge=0;edge<ring.length;edge++){
   const a=ring[edge],q=ring[(edge+1)%ring.length],dx=q[0]-a[0],dz=q[1]-a[1],len=Math.hypot(dx,dz),nx=(ar>0?dz:-dz)/len,nz=(ar>0?-dx:dx)/len,ang=-Math.atan2(dz,dx);
   // Source-traced flights belong to ordered chains, never a repeating corner wave.
   const flight=sources.staircaseTrace.chains.flatMap(c=>c.segments).find(s=>s.part===id&&s.edge===edge);
   const stair=!!flight;
   const margin=Math.min(.45,1.90/len);
   const low=(t:number)=>{if(!flight)return 0;const f=flight.reverse?1-t:t,progress=Math.max(0,Math.min(1,(f-margin)/(1-2*margin)));return flight.start+(flight.end-flight.start)*progress};
   const pitch=1.36,count=Math.ceil(len/pitch);
   for(let j=0;j<count;j++){
    const t=(j+.5)/count,x=a[0]+dx*t,z=a[1]+dz*t,cut=low(t),gap=stair?2.35:0;
    const intervals=stair?[[base,Math.max(base,cut)],[Math.min(top,cut+gap),top]]:[[base,top]];
    for(const[y0,y1]of intervals){if(y1-y0<.10)continue;
     b.box(x+nx*.04,y0,z+nz*.04,len/count+.025,y1-y0,.12,'glass',ang);
     // Narrow fins project from exposed glass; they are clipped at the actual void.
     b.box(a[0]+dx*j/count+nx*.23,y0,a[1]+dz*j/count+nz*.23,.16,y1-y0,.50,'frame',ang);
    }
   }
   for(let y=4.4;y<top;y+=3.78){
    if(y<base)continue;
    const ts=stair?[0,margin,1-margin,1]:[0,1];
    if(stair&&Math.abs(low(1)-low(0))>.01)for(const value of [y,y-2.35]){const t=margin+(1-2*margin)*(value-low(0))/(low(1)-low(0));if(t>0&&t<1)ts.push(t)}
    ts.sort((a,q)=>a-q);
    for(let k=0;k<ts.length-1;k++){const t0=ts[k],t1=ts[k+1],t=(t0+t1)/2;if(stair&&y>=low(t)&&y<=low(t)+2.35)continue;b.box(a[0]+dx*t+nx*.13,y,a[1]+dz*t+nz*.13,len*(t1-t0),.115,.13,'frame',ang)}
   }
   if(stair){
    const start=low(0),end=low(1),steps=Math.max(1,Math.ceil(Math.abs(end-start)/(.22*(1-2*margin)))),depth=1.90;
    for(let k=0;k<steps;k++){
     const t=(k+.5)/steps,y=low(t),x=a[0]+dx*t-nx*depth/2,z=a[1]+dz*t-nz*depth/2;
     b.box(x,y,z,len/steps+.02,.18,depth,'concrete',ang);
    }
    const joints=[0,margin,1-margin,1];
    for(let i=0;i<joints.length-1;i++){const t0=joints[i],t1=joints[i+1];beam(new T.Vector3(a[0]+dx*t0+nx*.02,low(t0)+1.1,a[1]+dz*t0+nz*.02),new T.Vector3(a[0]+dx*t1+nx*.02,low(t1)+1.1,a[1]+dz*t1+nz*.02),.10,.10,'white')}
    const rails=Math.ceil(len/2.7);
    for(let k=0;k<=rails;k++){const t=k/rails;b.box(a[0]+dx*t,low(t),a[1]+dz*t,.10,1.13,.10,'frame')}
    // Source-appropriate pale soffit/floor boundary, not an applied painted stripe.
    for(let i=0;i<joints.length-1;i++){const t0=joints[i],t1=joints[i+1];beam(new T.Vector3(a[0]+dx*t0-nx*.05,low(t0),a[1]+dz*t0-nz*.05),new T.Vector3(a[0]+dx*t1-nx*.05,low(t1),a[1]+dz*t1-nz*.05),.23,.25,'white')}
   }
  }
 }
 // Explicit horizontal corner landings join the inset tread strips. Without
 // these, flights that share a facade vertex can still leave an interior gap.
 for(const chain of sources.staircaseTrace.chains){
  for(let i=1;i<chain.segments.length;i++){
   const previous=chain.segments[i-1],next=chain.segments[i];
   const edge=(s:typeof next)=>{const r=parts.find(p=>p.properties.osmId===s.part)!.localRing as P[],a=r[s.edge],q=r[(s.edge+1)%r.length],dx=q[0]-a[0],dz=q[1]-a[1],l=Math.hypot(dx,dz),sign=area(r)>0?1:-1;return {corner:s.reverse?q:a,n:[sign*dz/l,-sign*dx/l] as P}};
   const a=edge(previous),q=edge(next),c=q.corner,d=1.90;
   const landing:P[]=[c,[c[0]-a.n[0]*d,c[1]-a.n[1]*d],[c[0]-(a.n[0]+q.n[0])*d,c[1]-(a.n[1]+q.n[1])*d],[c[0]-q.n[0]*d,c[1]-q.n[1]*d]];
   b.add(openTopPrism(shape(landing),next.start,next.start+.18),'concrete');
   b.add(upwardRoofPlane(shape(landing),next.start+.18),'concrete');
  }
 }
 // Small independently supported roof plant, kept below the surveyed95.13NAP maximum.
 const roof=parts.find(p=>p.properties.osmId==='w754894013')!.localRing as P[];
 const cx=roof.reduce((s,p)=>s+p[0],0)/roof.length,cz=roof.reduce((s,p)=>s+p[1],0)/roof.length;
 b.box(cx,90.95,cz,16,3.1,8,'slate');
 // Current ground frontage: actual south-side glazed doors, no invented lettering.
 const podium=parts.find(p=>p.properties.osmId==='w754894014')!.localRing as P[];
 const a=podium[1],q=podium[2],dx=q[0]-a[0],dz=q[1]-a[1],len=Math.hypot(dx,dz),nx=-dz/len,nz=dx/len,ang=-Math.atan2(dz,dx),t=.57;
 const ex=a[0]+dx*t+nx*.35,ez=a[1]+dz*t+nz*.35;
 b.box(ex,0,ez,3.2,3.65,.18,'dark',ang);
 for(const u of [-.79,.79])b.box(ex+dx/len*u,0.18,ez+dz/len*u,1.42,3.4,.22,'glass',ang);
 b.box(ex,3.6,ez,4.1,.23,1.25,'frame',ang);
}
