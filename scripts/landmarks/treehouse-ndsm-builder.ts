import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './treehouse-ndsm-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original sixteen-volume studio village. Surveyed alleys never become a slab. */
export function buildTreehouseNdsm(_w:number,_d:number,{add,box,sign}:BuildingTools){
 function rib(p:T.Vector2,y:number,h:number,c:Colour,rot:number){const tangent=new T.Vector2(Math.cos(rot),-Math.sin(rot));for(const side of[-1,1]){const m=p.clone().addScaledVector(tangent,side*.012);add(new T.PlaneGeometry(.035,h),c,m.x,y+h/2,m.y,rot+side*.65);}}
 // The north panorama shows yellow and pale mint cabins. The existing frame
 // material is the closest pale green-grey tone; shared green is olive.
 // Keep this bounded approximation pending a native reference/render review.
 const colours:Record<string,Colour>={'2476':'gold','2477':'green','2479':'frame','2480':'red','2481':'green','2482':'white','2483':'green','2484':'white','2486':'red','2487':'blue','2488':'green','2489':'blue','2490':'blue','2491':'green','2492':'red','2493':'green'};
 const pts=data.buildings.flatMap(part=>part.outline[0].map(p=>new T.Vector2(p[0],p[1]))).sort((p,q)=>p.x-q.x||p.y-q.y);
 const cross=(o:T.Vector2,p:T.Vector2,q:T.Vector2)=>(p.x-o.x)*(q.y-o.y)-(p.y-o.y)*(q.x-o.x);
 const half=(list:T.Vector2[])=>{const h:T.Vector2[]=[];for(const p of list){while(h.length>1&&cross(h[h.length-2],h[h.length-1],p)<=0)h.pop();h.push(p);}h.pop();return h;};
 const hull=[...half(pts),...half([...pts].reverse())],c0=hull.reduce((s,p)=>s.add(p),new T.Vector2()).multiplyScalar(1/hull.length);
 // Walls on the hull stand behind the fence: their ground-floor windows and doors cannot be seen and are not drawn.
 const behindFence=(mid:T.Vector2,normal:T.Vector2)=>hull.some((p,i)=>{const q=hull[(i+1)%hull.length],d=q.clone().sub(p),t=Math.max(0,Math.min(1,mid.clone().sub(p).dot(d)/d.lengthSq())),out=new T.Vector2(d.y,-d.x).normalize();if(out.dot(p.clone().sub(c0))<0)out.negate();return mid.distanceTo(p.clone().addScaledVector(d,t))<1.6&&normal.dot(out)>.7;});
 const nearFence=(p:T.Vector2)=>hull.some((h,i)=>{const q=hull[(i+1)%hull.length],d=q.clone().sub(h),t=Math.max(0,Math.min(1,p.clone().sub(h).dot(d)/d.lengthSq()));return p.distanceTo(h.clone().addScaledVector(d,t))<1.4;});
 // A wall shared with the next studio (same edge, either way round) is a party wall: no trim on it, it would sit inside the neighbour.
 const edges=data.buildings.flatMap(part=>part.outline[0].map((p,i,r)=>({id:part.id,a:new T.Vector2(p[0],p[1]),b:new T.Vector2(r[(i+1)%r.length][0],r[(i+1)%r.length][1])})));
 const party=(id:string,a:T.Vector2,b:T.Vector2)=>edges.some(e=>e.id!==id&&((e.a.distanceTo(a)<.3&&e.b.distanceTo(b)<.3)||(e.a.distanceTo(b)<.3&&e.b.distanceTo(a)<.3)));
 for(const part of data.buildings){
  const short=part.id.slice(-4),colour=colours[short],hall=short==='2481'||short==='2487',r=part.outline[0].map(p=>new T.Vector2(p[0],p[1])),shape=new T.Shape(r);
  function facade(g:T.BufferGeometry){g.userData.role='studio-wall';g.userData.pandId=part.id;add(g,colour);}
  facade(openTopPrism(shape,0,2.9));
  const fallback=short==='2482'?3.1:short==='2484'?3.2:5.55;
  if(!part.roofs.length){facade(openTopPrism(shape,2.9,fallback));add(upwardRoofPlane(shape,fallback),short==='2492'?'slate':'white');}
  for(const roof of part.roofs){
   const ring=roof.rings[0],cx=ring.reduce((s,p)=>s+p[0],0)/ring.length,cz=ring.reduce((s,p)=>s+p[1],0)/ring.length,cy=ring.reduce((s,p)=>s+p[2],0)/ring.length;
   let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of ring){const x=p[0]-cx,z=p[1]-cz,y=p[2]-cy;xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}const det=xx*zz-xz*xz,a=(xy*zz-zy*xz)/det,b=(zy*xx-xy*xz)/det,height=(x:number,z:number)=>cy+a*(x-cx)+b*(z-cz);
   const sh=new T.Shape(ring.map(p=>new T.Vector2(p[0],p[1]))),top=upwardRoofPlane(sh),pos=top.getAttribute('position');for(let i=0;i<pos.count;i++)pos.setY(i,height(pos.getX(i),pos.getZ(i)));top.computeVertexNormals();top.userData.role='roof';add(top,hall?'slate':'white');
   const walls:number[]=[];for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length];walls.push(p[0],2.9,p[1],q[0],2.9,q[1],q[0],height(q[0],q[1]),q[1],p[0],2.9,p[1],q[0],height(q[0],q[1]),q[1],p[0],height(p[0],p[1]),p[1]);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(walls,3));g.computeVertexNormals();facade(g);
  }
  function facadeHeight(mid:T.Vector2){let best=Infinity,h=fallback;for(const roof of part.roofs)for(const ring of roof.rings)for(let k=0;k<ring.length;k++){const p=ring[k],q=ring[(k+1)%ring.length],a=new T.Vector2(p[0],p[1]),delta=new T.Vector2(q[0]-p[0],q[1]-p[1]),t=Math.max(0,Math.min(1,mid.clone().sub(a).dot(delta)/delta.lengthSq())),distance=mid.distanceTo(a.addScaledVector(delta,t));if(distance<best){best=distance;h=p[2]+t*(q[2]-p[2]);}}return h;}
  for(let i=0;i<r.length;i++){
   const a=r[i],b=r[(i+1)%r.length],delta=b.clone().sub(a),len=delta.length();if(len<1||party(part.id,a,b))continue;const tangent=delta.clone().normalize(),normal=new T.Vector2(-tangent.y,tangent.x),mid=a.clone().add(b).multiplyScalar(.5),rot=Math.atan2(-delta.y,delta.x),eave=facadeHeight(mid),fenced=behindFence(mid,normal);
   // Corrugation remains visible between real studio openings; ribs do not cross
   // panes. Photos support both pitched cabin blocks and reused container ends.
   const upper=eave>4.9&&!hall,windows=hall?Math.floor(len/4.4):Math.floor(len/2.75),step=len/(windows+1),w=hall?2.0:1.5;
   function pane(center:number,y:number,h:number,width:number){const p=a.clone().addScaledVector(tangent,center).addScaledVector(normal,.065);add(new T.PlaneGeometry(width+.14,h+.14),'white',p.x,y+h/2,p.y,rot);p.addScaledVector(normal,.035);add(new T.PlaneGeometry(width,h),'glass',p.x,y+h/2,p.y,rot);const m=p.clone().addScaledVector(normal,.025);box(m.x,y,m.y,.075,h,.075,'white');}
   for(let j=1;j<=windows;j++){const d=step*j;if(upper)pane(d,3.9,1.35,w);if(!hall&&len>5&&!fenced&&!nearFence(a.clone().addScaledVector(tangent,d)))pane(d,.75,1.45,w);if(hall&&!fenced&&!nearFence(a.clone().addScaledVector(tangent,d)))pane(d,1.4,2.3,w);}
   // Each independent building keeps its own public/studio doorway.
   if(len>5&&!fenced&&!nearFence(a.clone().addScaledVector(tangent,.9))){const p=a.clone().addScaledVector(tangent,.9).addScaledVector(normal,.105);add(new T.PlaneGeometry(.85,2.2),'frame',p.x,1.1,p.y,rot);p.addScaledVector(normal,.03);add(new T.PlaneGeometry(.7,1.85),'glass',p.x,1.2,p.y,rot);}
   for(let d=.2;d<len-.1;d+=.33){const p=a.clone().addScaledVector(tangent,d).addScaledVector(normal,.045);const onOpening=Array.from({length:windows},(_,j)=>Math.abs(d-step*(j+1))<w/2+.15).some(Boolean)||d<1.4;
    if(onOpening){if(upper)rib(p,2.3,1.48,colour,rot);if(eave>5.38)rib(p,5.38,eave-5.38,colour,rot);}else rib(p,0,eave,colour,rot);
   }
   const p=mid.clone().addScaledVector(normal,.07);for(const y of[.08,2.8,eave-.12])if(!((fenced||nearFence(mid))&&y<3.5))box(p.x,y,p.y,len,.08,.1,'frame',rot);
  }
 }

 // Panoramas 2025-09-16/22 from every side: a continuous ~3.5 m black slatted fence rings the village (ground floors
 // show only above it, the courtyard is private) with TREEHOUSE in white letters on its top rail facing the north-west
 // car park. Run it along the village's convex hull, 0.4 m out from the outermost walls.
 const FENCE=3.5,OUT=.4;let signEdge:{a:T.Vector2;len:number;tangent:T.Vector2;normal:T.Vector2;rot:number}|null=null,signScore=-1;
 for(let i=0;i<hull.length;i++){
  const a0=hull[i],b0=hull[(i+1)%hull.length],delta=b0.clone().sub(a0),len=delta.length();if(len<.5)continue;
  const tangent=delta.clone().normalize();let normal=new T.Vector2(-tangent.y,tangent.x);if(normal.dot(a0.clone().sub(c0))<0)normal.negate();
  const a=a0.clone().addScaledVector(normal,OUT),mid=a.clone().addScaledVector(tangent,len/2),rot=Math.atan2(-delta.y,delta.x);
  box(mid.x,0,mid.y,len,FENCE,.06,'slate',rot);
  for(const y of[.15,FENCE-.12]){const p=mid.clone().addScaledVector(normal,.06);box(p.x,y,p.y,len,.1,.06,'slate',rot);}
  for(let d=.25;d<len;d+=.5){const p=a.clone().addScaledVector(tangent,d).addScaledVector(normal,.065);box(p.x,0,p.y,.08,FENCE,.07,'slate',rot);}
  // Bearing of the outward normal (x east, z south): the sign wants the longest run facing the north-west car park.
  const bearing=(Math.atan2(normal.x,-normal.y)*180/Math.PI+360)%360,score=bearing>270&&bearing<350?len:-1;
  if(score>signScore){signScore=score;signEdge={a,len,tangent,normal,rot};}
 }
 if(signEdge){const {a,len,tangent,normal}=signEdge,start=a.clone().addScaledVector(tangent,len*.5).addScaledVector(normal,.03);sign('TREEHOUSE',start.x,FENCE-1.45,start.y,.17,'white',9.2,Math.atan2(normal.x,normal.y));}
}
