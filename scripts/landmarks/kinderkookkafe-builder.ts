import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './kinderkookkafe-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Native original reconstruction; AHN surfaces supply surveyed heights, never imported triangles. */
export function buildKinderkookkafe(_w:number,_d:number,b:BuildingTools){
 const emit=(points:number[][],colour:Colour)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.computeVertexNormals();b.add(g,colour);};
 const beam=(a:T.Vector3,q:T.Vector3,w:number,c:Colour)=>{const d=q.clone().sub(a),g=new T.BoxGeometry(w,w,d.length());g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),d.clone().normalize()));const p=a.clone().add(q).multiplyScalar(.5);b.add(g,c,p.x,p.y,p.z);};
 for(const [partIndex,part] of source.parts.entries()){
  const ring=part.ring.map(p=>new T.Vector2(...p as [number,number]));
  const sign=Math.sign(ring.reduce((s,p,i)=>{const q=ring[(i+1)%ring.length];return s+p.x*q.y-q.x*p.y},0));
  const roofAt=(p:T.Vector2)=>{let nearest=Infinity,h=3.7;for(const roof of part.roofs)for(const r of roof.rings)for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length],v=new T.Vector2(q[0]-a[0],q[2]-a[2]),u=T.MathUtils.clamp(p.clone().sub(new T.Vector2(a[0],a[2])).dot(v)/v.lengthSq(),0,1),distance=p.distanceTo(new T.Vector2(a[0]+v.x*u,a[2]+v.y*u));if(distance<nearest){nearest=distance;h=a[1]+u*(q[1]-a[1]);}}return h;};
  for(const [roofIndex,roof] of part.roofs.entries())for(const r of roof.rings){const flat=r.map(p=>new T.Vector2(p[0],p[2]));for(const ids of T.ShapeUtils.triangulateShape(flat,[])){let pts=ids.map(i=>r[i]);const a=new T.Vector3(...pts[0] as [number,number,number]),q=new T.Vector3(...pts[1] as [number,number,number]),v=new T.Vector3(...pts[2] as [number,number,number]);if(q.sub(a).cross(v.sub(a)).y<0)pts=[pts[0],pts[2],pts[1]];emit(pts,partIndex===0&&roofIndex===0?'glass':'slate');}}
  // Survey roof surfaces meet at the conservatory wall with a small height step.
  // Close the step explicitly; otherwise an aerial view can see into the shed.
  const same=(a:number[],q:number[])=>Math.hypot(a[0]-q[0],a[2]-q[2])<.025;
  for(let k=0;k<part.roofs.length;k++)for(let l=k+1;l<part.roofs.length;l++){
   const r=part.roofs[k].rings[0],t=part.roofs[l].rings[0];
   for(let i=0;i<r.length;i++)for(let j=0;j<t.length;j++){
    const a=r[i],q=r[(i+1)%r.length],u=t[j],v=t[(j+1)%t.length];
    const pair=same(a,u)&&same(q,v)?[u,v]:same(a,v)&&same(q,u)?[v,u]:null;
    if(!pair||Math.max(Math.abs(a[1]-pair[0][1]),Math.abs(q[1]-pair[1][1]))<.05)continue;
    const pts=[a,q,pair[1],a,pair[1],pair[0]];emit(pts,'brick');emit([pts[0],pts[2],pts[1],pts[3],pts[5],pts[4]],'brick');
   }
  }
  const facade=(i:number,end=(i+1)%ring.length)=>{const a=ring[i],q=ring[end],d=q.clone().sub(a),length=d.length(),n=new T.Vector2(d.y,-d.x).normalize().multiplyScalar(sign),angle=-Math.atan2(d.y,d.x);return {a,q,d,length,n,angle,point:(u:number,offset=0)=>a.clone().lerp(q,u).addScaledVector(n,offset)};};
  for(let i=0;i<ring.length;i++){
   const f=facade(i),{a,q,length,n,angle,point}=f;const glass=partIndex===0&&[2,3,4,5].includes(i),steps=Math.max(1,Math.ceil(length/.25));
   for(let j=0;j<steps;j++){const p=a.clone().lerp(q,j/steps),s=a.clone().lerp(q,(j+1)/steps),hp=roofAt(p),hs=roofAt(s),pts=[[p.x,0,p.y],[s.x,0,s.y],[s.x,hs,s.y],[p.x,0,p.y],[s.x,hs,s.y],[p.x,hp,p.y]];if(sign>0)for(let k=0;k<pts.length;k+=3)[pts[k+1],pts[k+2]]=[pts[k+2],pts[k+1]];emit(pts,glass?'glass':'brick');}
   if(glass){const count=Math.max(1,Math.round(length/1.3));for(let j=0;j<=count;j++){const p=point(j/count,.055);b.box(p.x,0,p.y,.065,roofAt(p),.09,'stone',angle);}const m=point(.5,.055);b.box(m.x,.12,m.y,length,.10,.09,'stone',angle);continue;}
   const m=point(.5,.035),eave=Math.min(roofAt(a),roofAt(q));for(const y of [.17,.65,eave-.30,eave-.16])b.box(m.x,y,m.y,length,.095,.07,y<1?'ochre':'brick',angle);
   // Raised masonry pilasters and restrained corbel course on real opaque sides.
   for(let u=.06;u<1;u+=.30){const p=point(u,.07);b.box(p.x,0,p.y,.24,Math.min(roofAt(p),3.8),.15,'brick',angle);}for(let u=.05;u<1;u+=.065){const p=point(u,.10);b.box(p.x,eave-.42,p.y,.14,.17,.17,'brick',angle);}
  }
  // Owner front photo has the northern cafe at right and southern shed at left.
  // Those source-facing portals belong to the east/northeast gable ends.
  const frontIndex=partIndex===0?9:3,f=facade(frontIndex,partIndex===0?1:0),m=f.point(.5,.14);
  b.box(m.x,.15,m.y,3.25,2.75,.13,partIndex===0?'glass':'green',f.angle);
  for(const u of [.5-1.68/f.length,.5+1.68/f.length]){const p=f.point(u,.19);b.box(p.x,.1,p.y,.14,2.85,.13,'ochre',f.angle);}
  // Segmental entrance lintel, source-backed red/yellow voussoirs.
  for(let j=0;j<20;j++){const u=j/19,x=(u-.5)*3.7,y=2.93+.28*(1-(2*u-1)**2),p=f.point(.5+x/f.length,.20);b.box(p.x,y,p.y,.18,.28,.17,j%3===0?'ochre':'brick',f.angle);}
  const eye=f.point(.5,.11),eyeY=5.05;const disc=new T.CircleGeometry(.53,24);b.add(disc,'dark',eye.x,eyeY,eye.y,Math.atan2(f.n.x,f.n.y));
  const pc=(u:number,y:number)=>{const p=f.point(.5+u/f.length,.18);return new T.Vector3(p.x,y,p.y);};for(const [u,y,v,z]of [[0,eyeY+.36,.36,eyeY],[.36,eyeY,0,eyeY-.36],[0,eyeY-.36,-.36,eyeY],[-.36,eyeY,0,eyeY+.36]])beam(pc(u,y),pc(v,z),.065,'ochre');
  // Dutch tuit termination and climbing corbel motif; no applied name lettering.
  const crest=roofAt(f.point(.5)),tip=f.point(.5,.05);b.box(tip.x,crest-.16,tip.y,.68,.76,.36,'brick',f.angle);b.box(tip.x,crest+.60,tip.y,.83,.09,.47,'stone',f.angle);
  // Continuous inset climbing corbel friezes: photo-guided masonry steps,
  // not isolated flecks following the outer roof slope. Exact step count is approximate.
  const half=f.length/2,steps=5,inset=.55;
  for(const side of [-1,1])for(let j=0;j<steps;j++){
   const x0=side*(half-inset-j*(half-inset-.25)/steps),x1=side*(half-inset-(j+1)*(half-inset-.25)/steps);
   const lower=roofAt(f.point(.5+x0/f.length))-.48,upper=roofAt(f.point(.5+x1/f.length))-.48;
   const shelf=f.point(.5+(x0+x1)/2/f.length,.16),riser=f.point(.5+x1/f.length,.16);
   b.box(shelf.x,lower,shelf.y,Math.abs(x1-x0)+.12,.15,.25,'brick',f.angle);
   b.box(riser.x,lower,riser.y,.14,Math.max(.15,upper-lower+.15),.25,'brick',f.angle);
  }
 }
}
