import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism} from './house-geometry';
import source from './canals-museum-footprints.json';
/** Native BAG shell; RCE1828 central risalit/pediment, operator stacked orders. */
export function buildCanalsMuseum(_w:number,_d:number,b:BuildingTools){
 const {add,box}=b,ring=source.localRing.map(p=>new T.Vector2(...p as [number,number]));
 const shape=new T.Shape(ring),eave=14.2,front=10.8921856573,rear=-10.8921856573,half=7.356;
 add(openTopPrism(shape,0,eave),'brick');
 // Exact surveyed perimeter clipped against four explicit upward hipped roof planes.
 const roofHeight=(p:T.Vector2)=>eave+Math.max(0,Math.min(3.61,(half-Math.abs(p.x))*.495,(front-Math.abs(p.y))*.495));
 const clip=(poly:T.Vector2[],a:T.Vector2,c:T.Vector2)=>{const out:T.Vector2[]=[];const value=(p:T.Vector2)=>(c.x-a.x)*(p.y-a.y)-(c.y-a.y)*(p.x-a.x);for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],vp=value(p),vq=value(q);if(vp>=-1e-8)out.push(p);if((vp>=0)!==(vq>=0))out.push(p.clone().lerp(q,vp/(vp-vq)));}return out;};
 const zridge=front-half,domains=[[[ -half,-front],[half,-front],[0,-zridge]],[[half,-front],[half,front],[0,zridge],[0,-zridge]],[[half,front],[-half,front],[0,zridge]],[[-half,front],[-half,-front],[0,-zridge],[0,zridge]]];
 const positions:number[]=[];for(const domain of domains){let poly=ring;const q=domain.map(p=>new T.Vector2(...p as [number,number]));for(let i=0;i<q.length;i++)poly=clip(poly,q[i],q[(i+1)%q.length]);for(let i=1;i<poly.length-1;i++){const a=poly[0],c=poly[i],d=poly[i+1],cross=(c.x-a.x)*(d.y-a.y)-(c.y-a.y)*(d.x-a.x);if(Math.abs(cross)<1e-7)continue;for(const p of (cross<0?[a,c,d]:[a,d,c]))positions.push(p.x,roofHeight(p),p.y);}}
 const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute(positions,3));roof.computeVertexNormals();add(roof,'slate');
 // Cream limestone basement and projecting central bay remain below exposed panes.
 box(0,0,front+.03,14.6,2.05,.18,'stone');box(0,2.05,front+.09,2.7,12.15,.22,'brick');
 function pane(x:number,y:number,z:number,w:number,h:number,angle=0){
  const nx=Math.sin(angle),nz=Math.cos(angle),tx=Math.cos(angle),tz=-Math.sin(angle);
  add(new T.PlaneGeometry(w+.22,h+.22),'stone',x,y+h/2,z,angle);
  add(new T.PlaneGeometry(w,h),'glass',x+nx*.045,y+h/2,z+nz*.045,angle);
  for(const u of [-w/2,0,w/2])box(x+tx*u+nx*.10,y,z+tz*u+nz*.10,.075,h,.09,'white',angle);
  for(const v of [0,h/2,h])box(x+nx*.10,y+v-.035,z+nz*.10,w,.07,.09,'white',angle);
 }
 for(const x of [-5.6,-2.8,2.8,5.6]){pane(x,.35,front+.16,1.65,1.25);pane(x,2.65,front+.10,1.65,3.95);}
 for(const y of [7.55,11.28])for(const x of [-5.6,-2.8,0,2.8,5.6])pane(x,y,front+(x===0?.24:.10),1.65,y===7.55?2.85:2.02);
 // Doric lower order, composite upper order: six actual inter-bay pilaster axes.
 for(const x of [-7.05,-4.2,-1.4,1.4,4.2,7.05]){
  box(x,2.1,front+.18,.36,4.95,.25,'stone');box(x,2.1,front+.23,.66,.23,.39,'stone');box(x,6.7,front+.25,.64,.20,.4,'stone');
  box(x,7.4,front+.18,.34,6.2,.24,'stone');box(x,7.4,front+.24,.65,.22,.42,'stone');box(x,13.38,front+.24,.62,.25,.40,'stone');
  for(const side of [-1,1])add(new T.TorusGeometry(.125,.055,4,8),'stone',x+side*.20,13.5,front+.49);
  box(x,13.63,front+.24,.72,.16,.44,'stone');
 }
 for(const [y,w,h,d] of [[2.03,14.8,.22,.42],[6.96,14.9,.26,.55],[7.23,15.02,.20,.66],[13.90,14.9,.22,.55],[14.15,15.08,.27,.72]])box(0,y,front+.20,w,h,d,'stone');
 for(let x=-7.1;x<7.2;x+=.36)box(x,13.94,front+.54,.11,.14,.15,'stone');
 // Triangular pediment on central risalit, rather than an invented neck gable.
 const ped=new T.Shape();ped.moveTo(-5.2,0);ped.lineTo(5.2,0);ped.lineTo(0,2.18);ped.closePath();add(new T.ExtrudeGeometry(ped,{depth:.18,bevelEnabled:false}),'brick',0,14.45,front+.22);
 function bar(a:T.Vector3,c:T.Vector3,r=.105){const delta=c.clone().sub(a),g=new T.CylinderGeometry(r,r,delta.length(),4);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));const p=a.clone().add(c).multiplyScalar(.5);add(g,'stone',p.x,p.y,p.z);}
 for(const s of [-1,1])bar(new T.Vector3(s*5.35,14.43,front+.50),new T.Vector3(0,16.72,front+.50),.13);
 box(0,14.43,front+.43,10.75,.18,.35,'stone');
 function oval(x:number,y:number,z:number,rx:number,ry:number){const g=new T.CircleGeometry(1,20);g.scale(rx,ry,1);add(g,'glass',x,y,z);const t=new T.TorusGeometry(1,.095,5,24);t.scale(rx,ry,1);add(t,'stone',x,y,z+.06);}
 oval(0,15.46,front+.45,.29,.49);for(const s of [-1,1]){const shield=new T.Shape();shield.moveTo(-.34,.34);shield.lineTo(.34,.34);shield.lineTo(.25,-.2);shield.lineTo(0,-.4);shield.lineTo(-.25,-.2);shield.closePath();add(new T.ShapeGeometry(shield),'stone',s*1.2,15.33,front+.47);for(let k=0;k<7;k++){const x=s*(1.6+k*.28),y=14.98+.45*(k/6-.5)**2;add(new T.IcosahedronGeometry(.085,0),'stone',x,y,front+.49);}}
 // Current nineteenth-century central stone doorcase and oval overdoor, no lettering.
 box(0,.12,front+.32,1.62,3.38,.15,'dark');for(const s of [-1,1])box(s*.98,.12,front+.43,.30,4.0,.3,'stone');box(0,3.32,front+.48,2.3,.20,.38,'stone');
 const arch=new T.Shape();arch.absarc(0,0,.79,0,Math.PI,false);arch.lineTo(-.79,0);add(new T.ShapeGeometry(arch),'glass',0,3.58,front+.45);add(new T.TorusGeometry(.87,.10,5,16,Math.PI),'stone',0,3.58,front+.52);
 box(0,4.42,front+.46,2.6,.2,.45,'stone');oval(0,5.38,front+.40,.29,.43);
 for(const s of [-1,1]){box(s*1.14,4.60,front+.43,.18,1.10,.18,'stone');bar(new T.Vector3(s*1.1,4.60,front+.53),new T.Vector3(s*.38,5.06,front+.53),.08);}
 for(let k=0;k<3;k++)box(0,k*.12,front+.66+(3-k)*.22,1.65,.12,.24,'stone');
 for(const x of [-6.65,-4.75,-2.15,2.15,4.75,6.65]){box(x,0,front+.85,.22,1.25,.22,'stone');box(x,1.22,front+.85,.30,.12,.30,'stone');}
 for(const side of [-1,1]){box(side*4.0,.65,front+.83,5.8,.06,.07,'dark');for(let x=1.2;x<6.9;x+=.24)box(side*x,.2,front+.83,.035,.65,.035,'dark');}
 // Historic roof/context photo supports two restrained small dormers.
 for(const x of [-5.4,5.4]){box(x,14.3,front-1.65,1.05,1.3,1.5,'stone');pane(x,14.52,front-.86,.70,.90);box(x,15.6,front-1.65,1.2,.18,1.65,'slate');}
 // Opposite garden elevation, native wall tangent (not floating in rectangular bounds).
 const back=(ring[1].y+ring[2].y)/2;for(const y of [2.8,7.55,11.25])for(const x of [-5.5,-2.75,0,2.75,5.5])pane(x,y,back-.055,1.5,y===11.25?2.1:2.8,Math.PI);
}
