import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './pllek-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
type Colour=Parameters<BuildingTools['add']>[1];
/** Native surveyed container compound; double barrel halls from original owner views. */
export function buildPllek(_w:number,_d:number,{add,box,sign}:BuildingTools){
 const angle=.2,cos=Math.cos(angle),sin=Math.sin(angle);
 const native=(u:number,v:number)=>new T.Vector2(cos*u-sin*v,sin*u+cos*v);
 const uv=(p:number[])=>new T.Vector2(cos*p[0]+sin*p[1],-sin*p[0]+cos*p[1]);
 const ring=data.outline[0].map(uv),shape=new T.Shape(data.outline[0].map(p=>new T.Vector2(p[0],p[1])));
 // Dark interior wall only behind the glazed fronts (below); the corrugated walls carry their own panels, so a full dark
 // prism under them only z-fought with the container panels 2 cm in front of it.
 // Sutherland clipping creates exact bounded roof owners from surveyed perimeter.
 function clipped(minU:number,maxU:number,minV:number,maxV:number){let r=ring.map(p=>p.clone());for(const [axis,value,keep]of[[0,minU,1],[0,maxU,-1],[1,minV,1],[1,maxV,-1]]){const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],a=axis?p.y:p.x,b=axis?q.y:q.x,pa=(a-value)*keep>=-1e-6,qa=(b-value)*keep>=-1e-6;if(pa)out.push(p);if(pa!==qa)out.push(p.clone().lerp(q,(value-a)/(b-a)));}r=out;if(!r.length)break;}return r;}
 // On the surveyed perimeter the corrugated container walls (below) already reach 3.45 m or 5.55 m: roof-region walls
 // there start at that height, so the two never overlap (they z-fought in different colours once the stacks were split).
 const onRing=(p:T.Vector2)=>ring.some((a,i)=>{const b=ring[(i+1)%ring.length],d=b.clone().sub(a),t=Math.max(0,Math.min(1,p.clone().sub(a).dot(d)/Math.max(d.lengthSq(),1e-9)));return p.distanceTo(a.clone().addScaledVector(d,t))<.05;});
 const facadeTop=(mid:T.Vector2,delta:T.Vector2)=>{const front=delta.x>0&&Math.abs(delta.x)>Math.abs(delta.y)&&mid.y>0;if(front&&((mid.x<-15.7)||(mid.x>3.1&&mid.x<19.1)))return 3;return mid.y<-4.4||mid.x>19.1?5.55:3.45;};
 const wallFoot=(p:T.Vector2,q:T.Vector2)=>{const mid=p.clone().add(q).multiplyScalar(.5);if(!onRing(p)||!onRing(q)||!onRing(mid))return 3;const k=ring.findIndex((a,i)=>{const b=ring[(i+1)%ring.length],d=b.clone().sub(a),t=mid.clone().sub(a).dot(d)/Math.max(d.lengthSq(),1e-9);return t>=-1e-6&&t<=1+1e-6&&mid.distanceTo(a.clone().addScaledVector(d,t))<.05;});if(k<0)return 3;const a=ring[k],b=ring[(k+1)%ring.length];return facadeTop(a.clone().add(b).multiplyScalar(.5),b.clone().sub(a));};
 function region(r:T.Vector2[],height:(u:number)=>number,c:Colour){if(r.length<3)return;const sh=new T.Shape(r.map(p=>native(p.x,p.y))),roof=upwardRoofPlane(sh);const pos=roof.getAttribute('position');for(let i=0;i<pos.count;i++){const u=cos*pos.getX(i)+sin*pos.getZ(i);pos.setY(i,height(u));}roof.computeVertexNormals();add(roof,c);const walls:number[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],a=native(p.x,p.y),b=native(q.x,q.y),y0=wallFoot(p,q);if(height(p.x)<=y0+.01&&height(q.x)<=y0+.01)continue;walls.push(a.x,y0,a.y,b.x,y0,b.y,b.x,height(q.x),b.y,a.x,y0,a.y,b.x,height(q.x),b.y,a.x,height(p.x),a.y);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(walls,3));g.computeVertexNormals();add(g,c);}
 // Rear double stack and low central service connector retain their actual plan.
 region(clipped(-40,40,-20,-4.4),()=>5.55,'ochre');
 region(clipped(-15.7,3.1,-4.4,20),()=>3.5,'red');
 region(clipped(19.1,40,-4.4,20),()=>5.55,'blue');
 // Owner photo shows real curved red sheet-metal roofs; AHN crest planes alone
 // would incorrectly produce a flat trapezoid. Faceted original arches below.
 function barrel(minU:number,maxU:number,minV:number,maxV:number,eave:number,rise:number){
  const n=18;for(let i=0;i<n;i++){const ua=minU+(maxU-minU)*i/n,ub=minU+(maxU-minU)*(i+1)/n;const height=(u:number)=>eave+rise*Math.sin(Math.PI*(u-minU)/(maxU-minU));region(clipped(ua,ub,minV,maxV),height,'red');}
 }
 barrel(-26.8,-15.7,-4.4,13.15,4.35,1.9);barrel(3.1,19.1,-4.4,7.6,5.6,2.2);
 function panel(u1:number,u2:number,v:number,y:number,h:number,c:Colour,offset=.06){const m=native((u1+u2)/2,v+offset);add(new T.PlaneGeometry(u2-u1,h),c,m.x,y+h/2,m.y,-angle);}
 function glazed(a:number,b:number,v:number,h:number){panel(a,b,v,0,h,'frame');panel(a+.12,b-.12,v,.12,h-.24,'glass',.1);for(let u=a;u<=b;u+=2.6){const p=native(u,v+.15);box(p.x,0,p.y,.12,h,.12,'frame');}panel(a,b,v,h-.1,.18,'frame',.17);}
 glazed(-26.65,-15.8,13.13,4.28);glazed(3.8,18.15,7.58,5.52);
 // Narrow source-supported public entry at central waterfront connector.
 glazed(-3,-1.3,7.55,2.95);
 // Corrugated facade follows actual native edges and container-sized seams. Panoramas 2024-12-12 (26 m, from the
 // south-south-east) and 2025-09-16 (from the north) show the two-high stacks as separate containers in mixed
 // rust red, blue-grey and mustard, not one painted block: walls of the 5.55 m stacks are split into two tiers of
 // 12.19 m (40 ft) containers, mostly red below and blue above, with the odd mustard box (a fixed per-wall cycle).
 const LOWER:Colour[]=['red','red','blue','red','ochre'],UPPER:Colour[]=['blue','ochre','blue','red','blue'];
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],delta=b.clone().sub(a),len=delta.length();if(len<.35)continue;const mid=a.clone().add(b).multiplyScalar(.5),front=delta.x>0&&Math.abs(delta.x)>Math.abs(delta.y)&&mid.y>0;if(front&&((mid.x<-15.7)||(mid.x>3.1&&mid.x<19.1))){const t=delta.clone().normalize(),inner=mid.clone().addScaledVector(new T.Vector2(-t.y,t.x),-.06),n=native(inner.x,inner.y),ea=native(a.x,a.y),eb=native(b.x,b.y);add(new T.PlaneGeometry(len,3),'dark',n.x,1.5,n.y,Math.atan2(-(eb.y-ea.y),eb.x-ea.x));continue;}const height=mid.y<-4.4||mid.x>19.1?5.55:3.45;const base:Colour=mid.y<-4.4?'ochre':mid.x>19.1?'blue':'red';const tangent=delta.clone().normalize(),normal=new T.Vector2(-tangent.y,tangent.x);const endA=native(a.x,a.y),endB=native(b.x,b.y),rot=Math.atan2(-(endB.y-endA.y),endB.x-endA.x);
  const stacked=height>5,tiers=stacked?[[0,2.78],[2.78,height]]:[[0,height]],seg=stacked?12.19:len,count=Math.max(1,Math.round(len/seg)),step=len/count;
  const colourAt=(tier:number,k:number):Colour=>stacked?(tier?UPPER:LOWER)[(i*2+k)%5]:base;
  for(let t=0;t<tiers.length;t++)for(let k=0;k<count;k++){const [y0,y1]=tiers[t],c=colourAt(t,k),m=a.clone().addScaledVector(tangent,(k+.5)*step).addScaledVector(normal,.018),n=native(m.x,m.y);add(new T.PlaneGeometry(step,y1-y0),c,n.x,(y0+y1)/2,n.y,rot);
   for(let d=k*step+.15;d<(k+1)*step-.05;d+=.32){const p=a.clone().addScaledVector(tangent,d).addScaledVector(normal,.035),q=native(p.x,p.y);box(q.x,y0,q.y,.055,y1-y0,.055,c);}}
  const pa=a.clone().addScaledVector(normal,.05),pb=b.clone().addScaledVector(normal,.05),na=native(pa.x,pa.y),nb=native(pb.x,pb.y),m=na.clone().add(nb).multiplyScalar(.5);for(const y of[.08,2.72,5.4].filter(y=>y<height))box(m.x,y,m.y,len,.1,.1,'frame',rot);
  if(stacked)for(let k=1;k<count;k++){const p=a.clone().addScaledVector(tangent,k*step).addScaledVector(normal,.05),q=native(p.x,p.y);box(q.x,0,q.y,.12,height,.1,'frame',rot);}
 }
 // The PLLEK sign: a red container on the upper tier of the east stack, white letters, facing the terrace and the IJ
 // (2024-12-12 panorama and the 2021-01-21 view from the water).
 { const u0=20.9,u1=27.4,v=-4.43,cu=(u0+u1)/2,p=native(cu,v+.09);box(p.x,2.86,p.y,u1-u0,2.6,.08,'red',-angle);
  const q=native(cu,v+.17);sign('PLLEK',q.x,3.45,q.y,.2,'white',(u1-u0)*.8,-angle); }
 // Steel space-frame canopy over the waterfront terrace in front of the east hall's glass front (both panoramas): light
 // grey posts, a 1 m deep truss on its three open sides with Warren diagonals, cross beams back to the hall.
 { const U0=3.4,U1=18.9,V0=7.6,V1=13.2,TOP=6.1,LOW=5.1,R=.15,steel:Colour='concrete';
  const at=(u:number,y:number,v:number)=>{const n=native(u,v);return new T.Vector3(n.x,y,n.y);};
  const bar=(p:T.Vector3,q:T.Vector3)=>{const d=q.clone().sub(p),g=new T.CylinderGeometry(R,R,d.length(),4);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize()));const c=p.clone().add(q).multiplyScalar(.5);add(g,steel,c.x,c.y,c.z);};
  const truss=(a:[number,number],b:[number,number])=>{const n=Math.max(1,Math.round(Math.hypot(b[0]-a[0],b[1]-a[1])/2.6));bar(at(a[0],TOP,a[1]),at(b[0],TOP,b[1]));bar(at(a[0],LOW,a[1]),at(b[0],LOW,b[1]));
   for(let k=0;k<n;k++){const f0=k/n,f1=(k+1)/n,u0=a[0]+(b[0]-a[0])*f0,v0=a[1]+(b[1]-a[1])*f0,u1=a[0]+(b[0]-a[0])*f1,v1=a[1]+(b[1]-a[1])*f1;bar(at(u0,k%2?TOP:LOW,v0),at(u1,k%2?LOW:TOP,v1));bar(at(u1,LOW,v1),at(u1,TOP,v1));}};
  for(const u of [U0,(U0+U1)/2,U1])bar(at(u,0,V1),at(u,TOP,V1));
  truss([U0,V1],[U1,V1]);truss([U0,V0],[U0,V1]);truss([U1,V0],[U1,V1]);
  for(let u=U0+2.6;u<U1-1;u+=2.6)bar(at(u,TOP,V0),at(u,TOP,V1)); }
 // Surveyed narrow vertical container/vent tower. Photo supports its tall
 // yellow industrial silhouette; its equipment elevation is never whole mass.
 const tower=clipped(.95,3.75,-7.3,-4.8);region(tower,()=>12.55,'ochre');
 for(let y=6;y<12.3;y+=.32){const a=native(1.2,-4.7),b=native(3.5,-4.7),m=a.clone().add(b).multiplyScalar(.5);box(m.x,y,m.y,2.3,.06,.06,'frame',-angle);}
}
