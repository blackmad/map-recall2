import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import data from './beta-boulders-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
type C=Parameters<BuildingTools['add']>[1];
/** Original native north Citroen garage. No downloaded mesh or photographic texture. */
export function buildBetaBoulders(_w:number,_d:number,b:BuildingTools):void{
 const makeShape=(rings:number[][][])=>{const s=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[1])));for(const r of rings.slice(1))s.holes.push(new T.Path(r.map(p=>new T.Vector2(p[0],p[1]))));return s};
 const footprint=makeShape(data.outline); b.add(openTopPrism(footprint,0,15.03),'white');
 // The wide surveyed roof includes its actual raised-volume/atrium hole.
 // Glazed atria terminate inside the building, not an invented ground passage.
 const base=data.roofs.find(r=>r.index===177)!;
 b.add(upwardRoofPlane(makeShape(base.rings),15.06),'slate');
 for(const roof of data.roofs.filter(r=>[166,168,179].includes(r.index))){
  const ring=roof.rings[0],cx=ring.reduce((s,p)=>s+p[0],0)/ring.length,cz=ring.reduce((s,p)=>s+p[1],0)/ring.length,cy=ring.reduce((s,p)=>s+p[2],0)/ring.length;
  let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of ring){const x=p[0]-cx,z=p[1]-cz,y=p[2]-cy;xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y}const det=xx*zz-xz*xz,a=(xy*zz-zy*xz)/det,d=(zy*xx-xy*xz)/det;
  const height=(x:number,z:number)=>cy+a*(x-cx)+d*(z-cz),top=upwardRoofPlane(makeShape(roof.rings)),p=top.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,height(p.getX(i),p.getZ(i)));top.computeVertexNormals();top.userData.roofAssembly=roof.index;b.add(top,'slate');
  const values:number[]=[];for(const r of roof.rings)for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];values.push(p[0],15.03,p[1],q[0],15.03,q[1],q[0],height(q[0],q[1]),q[1],p[0],15.03,p[1],q[0],height(q[0],q[1]),q[1],p[0],height(p[0],p[1]),p[1])}const wall=new T.BufferGeometry();wall.setAttribute('position',new T.Float32BufferAttribute(values,3));wall.computeVertexNormals();b.add(wall,'dark');
 }
 // Close only the low roof hole with transparent-atrium geometry at roof datum;
 // no opaque raised plate covers the surveyed upper atrium opening.
 for(const ring of base.rings.slice(1))b.add(upwardRoofPlane(makeShape([ring]),15.02),'glass');
 function panel(p:T.Vector2,q:T.Vector2,y:number,h:number,c:C,offset=.12){const tangent=q.clone().sub(p).normalize(),normal=new T.Vector2(-tangent.y,tangent.x),mid=p.clone().add(q).multiplyScalar(.5).addScaledVector(normal,offset);b.add(new T.PlaneGeometry(p.distanceTo(q),h),c,mid.x,y+h/2,mid.y,Math.atan2(-tangent.y,tangent.x))}
 function portalSolid(p:T.Vector2,q:T.Vector2,y:number,h:number){const t=q.clone().sub(p).normalize(),n=new T.Vector2(-t.y,t.x),m=p.clone().add(q).multiplyScalar(.5).addScaledVector(n,.4);b.box(m.x,y,m.y,p.distanceTo(q),h,.6,'dark',Math.atan2(-t.y,t.x))}
 function ribbon(p:T.Vector2,q:T.Vector2,y:number,h:number,c:C='white',offset=.12){panel(p,q,y-.13,h+.26,c,offset);panel(p,q,y,h,'glass',offset+.045);const l=p.distanceTo(q),n=Math.ceil(l/1.9);for(let i=0;i<=n;i++){const t=q.clone().sub(p).normalize(),normal=new T.Vector2(-t.y,t.x),m=p.clone().lerp(q,i/n).addScaledVector(normal,offset+.08);b.box(m.x,y,m.y,.075,h,.075,'frame')}panel(p,q,y+h*.48,.07,'frame',offset+.085)}
 // BAG ring is clockwise in east/south coordinates: left normals face outside.
 const ring=data.facadePerimeter;
 const se=new T.Vector2(...ring[1] as [number,number]),ne=new T.Vector2(...ring[30] as [number,number]),frontAxis=ne.clone().sub(se),frontLength=frontAxis.length();frontAxis.normalize();
 const frontageFraction=(p:T.Vector2)=>p.clone().sub(se).dot(frontAxis)/frontLength;
 // Clip source-wide opening groups to each installed articulated facade edge.
 function frontageClip(p:T.Vector2,q:T.Vector2,lo:number,hi:number){const a=frontageFraction(p),d=frontageFraction(q)-a;if(Math.abs(d)<.00001)return undefined;const f=(lo-a)/d,g=(hi-a)/d,begin=Math.max(0,Math.min(f,g)),end=Math.min(1,Math.max(f,g));if(end<=begin)return undefined;return [p.clone().lerp(q,begin),p.clone().lerp(q,end)] as const}
 for(let i=0;i<ring.length-1;i++){const p=new T.Vector2(...ring[i] as [number,number]),q=new T.Vector2(...ring[i+1] as [number,number]);if(p.distanceTo(q)<.3)continue;const principal=i>=1&&i<30;const length=p.distanceTo(q),front=(q.y-p.y)<-2||(q.x-p.x)>2;
  // Principal park/street faces are broad glazing bays between real wide white piers.
  for(const [y,h] of [[6.05,3.85],[11.05,3.25]]){
   if(principal){for(const [lo,hi] of[[.015,.38],[.46,.985]]){const clipped=frontageClip(p,q,lo,hi);if(clipped&&clipped[0].distanceTo(clipped[1])>.3)ribbon(clipped[0],clipped[1],y,h)}}
   else {const count=Math.max(1,Math.round(length/13));for(let k=0;k<count;k++){const pa=p.clone().lerp(q,(k+.035)/count),pb=p.clone().lerp(q,(k+.91)/count);ribbon(pa,pb,y,h)}}
  }
  if(principal){
   // Source entrance occupies the SE end. Dark projecting cheeks/head make
   // glass visibly recessed within the frame, without moving native wall scope.
   for(const [lo,hi] of[[.026,.366],[.39,.985]]){const c=frontageClip(p,q,lo,hi);if(c&&c[0].distanceTo(c[1])>.3)ribbon(c[0],c[1],.45,3.85,'concrete',.12)}
   const portal=frontageClip(p,q,.01,.39);if(portal)portalSolid(portal[0],portal[1],4.3,.92);
   for(const [lo,hi] of[[.01,.026],[.366,.39]]){const c=frontageClip(p,q,lo,hi);if(c)portalSolid(c[0],c[1],.08,4.65)}
   // Real entrance doors remain distinguishable inside the broad glazed portal.
   const door=frontageClip(p,q,.17,.225);if(door){ribbon(door[0],door[1],.18,3.5,'dark',.21);panel(door[0],door[1],3.72,.14,'dark',.31)}
  }else if(front)ribbon(p.clone().lerp(q,.018),q.clone().lerp(p,.018),.45,4.1,'concrete');else ribbon(p.clone().lerp(q,.04),q.clone().lerp(p,.04),1.1,2.6,'concrete');
  panel(p,q,5.22,.28,'white',.18);panel(p,q,10.25,.65,'white',.18);panel(p,q,14.55,.5,'white',.18);
  // Slim actual roof guard rails retain the industrial terrace silhouette.
  panel(p,q,15.18,.075,'dark',.2);panel(p,q,15.57,.06,'dark',.2);for(let k=0;k<=Math.ceil(length/3);k++){const t=q.clone().sub(p).normalize(),n=new T.Vector2(-t.y,t.x),m=p.clone().lerp(q,k/Math.ceil(length/3)).addScaledVector(n,.2);b.box(m.x,15.1,m.y,.05,.53,.05,'dark')}
 }
 // Upper office addition follows its surveyed irregular outline and atrium.
 for(const roof of data.roofs.filter(r=>[168,179].includes(r.index)))for(const ring of roof.rings){for(let i=0;i<ring.length;i++){const p=new T.Vector2(ring[i][0],ring[i][1]),q=new T.Vector2(ring[(i+1)%ring.length][0],ring[(i+1)%ring.length][1]);if(p.distanceTo(q)>4)ribbon(p.clone().lerp(q,.04),q.clone().lerp(p,.04),15.4,2.65,'dark',.14)}}
}
