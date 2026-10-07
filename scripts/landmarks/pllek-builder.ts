import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './pllek-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
type Colour=Parameters<BuildingTools['add']>[1];
/** Native surveyed container compound; double barrel halls from original owner views. */
export function buildPllek(_w:number,_d:number,{add,box}:BuildingTools){
 const angle=.2,cos=Math.cos(angle),sin=Math.sin(angle);
 const native=(u:number,v:number)=>new T.Vector2(cos*u-sin*v,sin*u+cos*v);
 const uv=(p:number[])=>new T.Vector2(cos*p[0]+sin*p[1],-sin*p[0]+cos*p[1]);
 const ring=data.outline[0].map(uv),shape=new T.Shape(data.outline[0].map(p=>new T.Vector2(p[0],p[1])));
 add(openTopPrism(shape,0,3),'dark');
 // Sutherland clipping creates exact bounded roof owners from surveyed perimeter.
 function clipped(minU:number,maxU:number,minV:number,maxV:number){let r=ring.map(p=>p.clone());for(const [axis,value,keep]of[[0,minU,1],[0,maxU,-1],[1,minV,1],[1,maxV,-1]]){const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],a=axis?p.y:p.x,b=axis?q.y:q.x,pa=(a-value)*keep>=-1e-6,qa=(b-value)*keep>=-1e-6;if(pa)out.push(p);if(pa!==qa)out.push(p.clone().lerp(q,(value-a)/(b-a)));}r=out;if(!r.length)break;}return r;}
 function region(r:T.Vector2[],height:(u:number)=>number,c:Colour){if(r.length<3)return;const sh=new T.Shape(r.map(p=>native(p.x,p.y))),roof=upwardRoofPlane(sh);const pos=roof.getAttribute('position');for(let i=0;i<pos.count;i++){const u=cos*pos.getX(i)+sin*pos.getZ(i);pos.setY(i,height(u));}roof.computeVertexNormals();add(roof,c);const walls:number[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],a=native(p.x,p.y),b=native(q.x,q.y);walls.push(a.x,3,a.y,b.x,3,b.y,b.x,height(q.x),b.y,a.x,3,a.y,b.x,height(q.x),b.y,a.x,height(p.x),a.y);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(walls,3));g.computeVertexNormals();add(g,c);}
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
 // Corrugated facade follows actual native edges and container-sized seams.
 for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length],delta=b.clone().sub(a),len=delta.length();if(len<.35)continue;const mid=a.clone().add(b).multiplyScalar(.5),front=delta.x>0&&Math.abs(delta.x)>Math.abs(delta.y)&&mid.y>0;if(front&&((mid.x<-15.7)||(mid.x>3.1&&mid.x<19.1)))continue;const height=mid.y<-4.4||mid.x>19.1?5.55:3.45;const c:Colour=mid.y<-4.4?'ochre':mid.x>19.1?'blue':'red';const tangent=delta.clone().normalize(),normal=new T.Vector2(-tangent.y,tangent.x);const backing=mid.clone().addScaledVector(normal,.018),back=native(backing.x,backing.y),endA=native(a.x,a.y),endB=native(b.x,b.y);add(new T.PlaneGeometry(len,height),c,back.x,height/2,back.y,Math.atan2(-(endB.y-endA.y),endB.x-endA.x));for(let d=.15;d<len;d+=.32){const p=a.clone().addScaledVector(tangent,d).addScaledVector(normal,.035),n=native(p.x,p.y);box(n.x,0,n.y,.055,height,.055,c);}const pa=a.clone().addScaledVector(normal,.05),pb=b.clone().addScaledVector(normal,.05),na=native(pa.x,pa.y),nb=native(pb.x,pb.y),m=na.clone().add(nb).multiplyScalar(.5),rot=Math.atan2(-(nb.y-na.y),nb.x-na.x);for(const y of[.08,2.72,5.4].filter(y=>y<height))box(m.x,y,m.y,len,.1,.1,'frame',rot);}
 // Surveyed narrow vertical container/vent tower. Photo supports its tall
 // yellow industrial silhouette; its equipment elevation is never whole mass.
 const tower=clipped(.95,3.75,-7.3,-4.8);region(tower,()=>12.55,'ochre');
 for(let y=6;y<12.3;y+=.32){const a=native(1.2,-4.7),b=native(3.5,-4.7),m=a.clone().add(b).multiplyScalar(.5);box(m.x,y,m.y,2.3,.06,.06,'frame',-angle);}
}
