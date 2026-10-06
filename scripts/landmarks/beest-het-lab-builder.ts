import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import data from './beest-het-lab-footprints.json';
import { openTopPrism, upwardRoofPlane } from './house-geometry';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original interpretation of survey planes and municipal facade photos. No photo textures. */
export function buildBeestHetLab(_w:number,_d:number,{add,box}:BuildingTools){
 const outline=data.outline[0].map(p=>new T.Vector2(p[0],p[1]));
 add(openTopPrism(new T.Shape(outline),0,3.12),'greyBrick');
 // Each measured roof patch owns its top. A centered plane fit handles rounded
 // survey rings without unstable three-point planes or protruding crest fins.
 for(const roof of data.roofs){
  const r=roof.rings[0],cx=r.reduce((s,p)=>s+p[0],0)/r.length,cz=r.reduce((s,p)=>s+p[1],0)/r.length,cy=r.reduce((s,p)=>s+p[2],0)/r.length;
  let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of r){const x=p[0]-cx,z=p[1]-cz,y=p[2]-cy;xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}
  const det=xx*zz-xz*xz,a=(xy*zz-zy*xz)/det,b=(zy*xx-xy*xz)/det;
  const height=(x:number,z:number)=>cy+a*(x-cx)+b*(z-cz);
  const shape=new T.Shape(r.map(p=>new T.Vector2(p[0],p[1])));
  for(const hole of roof.rings.slice(1))shape.holes.push(new T.Path(hole.map(p=>new T.Vector2(p[0],p[1]))));
  const top=upwardRoofPlane(shape);const positions=top.getAttribute('position');for(let i=0;i<positions.count;i++)positions.setY(i,height(positions.getX(i),positions.getZ(i)));top.computeVertexNormals();add(top,'slate');
  // Vertically bounded shell sides retain every low extension and roof step.
  const walls:number[]=[];for(const ring of roof.rings)for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length],hp=height(p[0],p[1]),hq=height(q[0],q[1]);walls.push(p[0],3.12,p[1],q[0],3.12,q[1],q[0],hq,q[1],p[0],3.12,p[1],q[0],hq,q[1],p[0],hp,p[1]);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(walls,3));g.computeVertexNormals();add(g,'greyBrick');
 }
 function panel(p:T.Vector2,q:T.Vector2,y:number,h:number,c:Colour,offset=.05){const tangent=q.clone().sub(p).normalize(),normal=new T.Vector2(-tangent.y,tangent.x),mid=p.clone().add(q).multiplyScalar(.5).addScaledVector(normal,offset),ang=Math.atan2(-tangent.y,tangent.x);add(new T.PlaneGeometry(p.distanceTo(q),h),c,mid.x,y+h/2,mid.y,ang);}
 function ribbon(p:T.Vector2,q:T.Vector2,y:number,h:number,offset=.05){panel(p,q,y-.08,h+.16,'white',offset);panel(p,q,y,h,'glass',offset+.04);const length=p.distanceTo(q),n=Math.ceil(length/2.4);for(let i=0;i<=n;i++){const m=p.clone().lerp(q,i/n),d=q.clone().sub(p).normalize(),normal=new T.Vector2(-d.y,d.x);m.addScaledVector(normal,offset+.08);box(m.x,y,m.y,.12,h,.12,'white');}}
 const frontA=new T.Vector2(-19.4,36.5),frontB=new T.Vector2(17,35.5);
 ribbon(frontA,frontB,4.12,1.25);panel(frontA,frontB,5.44,.24,'white',.15);
 const tangent=frontB.clone().sub(frontA).normalize(),frontPoint=(x:number)=>frontA.clone().addScaledVector(tangent,x+19.4);
 // Broad real roller door in otherwise blind brick front; small public door east.
 const shutterA=frontPoint(-.5),shutterB=frontPoint(5.6);panel(shutterA,shutterB,.08,3.0,'frame');panel(shutterA,shutterB,.15,2.83,'concrete',.1);for(let y=.25;y<2.95;y+=.17)panel(shutterA,shutterB,y,.035,'frame',.13);
 const da=frontPoint(11.1),db=frontPoint(13.4);panel(da,db,.12,2.9,'frame');panel(da,db,.22,2.7,'glass',.12);
 // Raised southern office follows surveyed high roof ring; recessed upper glass,
 // white shallow cornice and steel uprights establish its photographed character.
 const high=data.roofs.find(roof=>roof.rings[0].every(p=>p[2]>9.25))!;
 const ring=high.rings[0];for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length];if(Math.hypot(q[0]-p[0],q[1]-p[1])<2)continue;const a=new T.Vector2(p[0],p[1]),b=new T.Vector2(q[0],q[1]);ribbon(a,b,6.15,2.1);panel(a,b,8.3,1.0,'white',.12);}
 // Municipal2025 front shows the office glass continuously across its right
 // third. The AHN small southern wedge protrudes0.25m in front of that pane;
 // retain surveyed roof, but give the photographed thick front fascia/frames
 // their0.55m projection instead of burying the glass in the fitted end shell.
 const officeA=new T.Vector2(-11.107,33.777),officeB=new T.Vector2(6.51,33.302);
 ribbon(officeA,officeB,6.15,2.1,.55);panel(officeA,officeB,8.3,1.0,'white',.62);
 for(const p of[officeA,officeB])box(p.x,5.6,p.y+.35,.18,3.7,.72,'white');
 // West long shed clerestory and exposed structural piers, no invented full
 // ground-floor window grid on the photographed mostly blind industrial wall.
 ribbon(new T.Vector2(-21.3,-31.8),new T.Vector2(-19.4,36.5),4.15,1.2);
 ribbon(new T.Vector2(20.2,-36.6),new T.Vector2(-21.1,-35.4),2.15,1.0);
}
