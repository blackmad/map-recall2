import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './boomkerk-footprints.json';
type C=Parameters<BuildingTools['add']>[1];
/** Original surveyed church geometry. Native metre axes, no stretching; adjacent parents retained. */
export function buildBoomkerk(_w:number,_d:number,b:BuildingTools){
 const turn=source.localRotationDegrees*Math.PI/180;
 const add=(g:T.BufferGeometry,c:C,x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);g.rotateY(turn);b.add(g,c);};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:C,a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
 const shape=(v:number[][])=>new T.Shape(v.map(q=>new T.Vector2(q[0],q[1])));
 const rect=(x0:number,x1:number,z0:number,z1:number)=>shape([[x0,z0],[x1,z0],[x1,z1],[x0,z1]]);
 const surface=(v:number[][],c:C,up=false)=>{const p=v.map(q=>new T.Vector3(q[0],q[1],q[2]));if(up&&p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).y<0)p.reverse();let q:number[]=[];for(let i=1;i<p.length-1;i++)q.push(...p[0].toArray(),...p[i].toArray(),...p[i+1].toArray());const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(q,3));g.computeVertexNormals();add(g,c);};
 function shell(x0:number,x1:number,z0:number,z1:number,e:number){add(openTopPrism(rect(x0,x1,z0,z1),0,e),'brick');}
 function gable(x0:number,x1:number,z0:number,z1:number,e:number,r:number){const cx=(x0+x1)/2;shell(x0,x1,z0,z1,e);for(const x of [x0,x1])surface([[x,e,z0],[x,e,z1],[cx,r,z1],[cx,r,z0]],'slate',true);for(const z of [z0,z1])surface([[x0,e,z],[x1,e,z],[cx,r,z]],'brick');}
 const ring=shape(source.parts[0].localRing.slice(0,-1));add(openTopPrism(ring,0,4.2),'brick');add(upwardRoofPlane(ring,4.2),'slate');
 gable(-5,8.2,-12.5,25.66,16.2,22.7);
 // Surveyed transept, same roof family but its ridge crosses the long nave.
 shell(-13.35,14.13,-5.02,8.07,16.2);for(const z of [-5.02,8.07])surface([[-13.35,16.2,z],[14.13,16.2,z],[14.13,22.7,1.52],[-13.35,22.7,1.52]],'slate',true);for(const x of [-13.35,14.13])surface([[x,16.2,-5.02],[x,16.2,8.07],[x,22.7,1.52]],'brick');
 for(const s of [-1,1]){const xo=s<0?-11.92:14.13,xi=s<0?-5:8.2,zend=s<0?18:25.66;shell(Math.min(xo,xi),Math.max(xo,xi),8.07,zend,9.8);surface([[xo,9.8,8.07],[xo,9.8,zend],[xi,13.2,zend],[xi,13.2,8.07]],'slate',true);if(s>0)surface([[xo,9.8,25.66],[xi,9.8,25.66],[xi,13.2,25.66]],'brick');}
 // Distinct left aisle gable is source-supported, separate from the long lean-to aisle.
 gable(-11.92,-5,18,25.66,9.8,13.2);
 function apse(cx:number,cz:number,r:number,e:number,peak:number){const v:number[][]=[[cx-r,cz],[cx+r,cz]];for(let i=0;i<=16;i++){const a=i*Math.PI/16;v.push([cx+r*Math.cos(a),cz-r*Math.sin(a)]);}const sh=shape(v);add(openTopPrism(sh,0,e),'brick');for(let i=1;i<v.length-1;i++)surface([[v[i][0],e,v[i][1]],[v[i+1][0],e,v[i+1][1]],[cx,peak,cz]],'slate',true);}
 apse(1.6,-12.5,6.4,16.2,20.5);for(const [x,z,r] of [[-5.3,-19.5,3.6],[11.0,-19.4,3.8]]){shell(x-r,x+r,-19.5,-12,6.2);surface([[x-r,6.2,-12],[x+r,6.2,-12],[x+r,8.4,-19.5],[x-r,8.4,-19.5]],'slate',true);apse(x,z,r,6.2,8.4);}
 const facing=(x:number,z:number,a:number,d:number,u=0)=>[x+Math.sin(a)*d+Math.cos(a)*u,z+Math.cos(a)*d-Math.sin(a)*u];
 function arch(x:number,y:number,z:number,w:number,h:number,a:number,c:C){const q=new T.Shape();q.moveTo(-w/2,0);q.lineTo(w/2,0);q.lineTo(w/2,h-w/2);q.absarc(0,h-w/2,w/2,0,Math.PI,false);q.closePath();add(new T.ShapeGeometry(q,6),c,x,y,z,a);}
 function win(x:number,y:number,z:number,w:number,h:number,a:number,c:C='glass'){arch(x,y,z,w+.18,h+.13,a,'stone');const q=facing(x,z,a,.09);arch(q[0],y+.06,q[1],w,h-.10,a,c);const m=facing(x,z,a,.17);box(m[0],y+.09,m[1],.055,h-w*.51,.07,'stone',a);for(let dy=.9;dy<h-w*.5;dy+=1.15)box(m[0],y+dy,m[1],w,.05,.07,'stone',a);}
 function triplet(x:number,y:number,z:number,a:number,w=1,h=3.7){for(const u of [-1.35,0,1.35]){const q=facing(x,z,a,0,u);win(q[0],y,q[1],w,h,a);}}
 function frieze(x:number,z:number,a:number,len:number,y:number){const n=Math.floor(len/.75);for(let i=0;i<n;i++){const q=facing(x,z,a,.09,-len/2+(i+.5)*len/n);arch(q[0],y-.62,q[1],.50,.64,a,'stone');const p=facing(q[0],q[1],a,.07);arch(p[0],y-.55,p[1],.34,.45,a,'brick');}box(x,y,z,len,.17,.17,'stone',a);}
 for(const s of [-1,1]){const a=s<0?-Math.PI/2:Math.PI/2,x=s<0?-11.95:14.16;for(const z of [12.2,20.1]){triplet(x,4.7,z,a,.88,3.6);triplet(s<0?-5.03:8.23,12.1,z,a,.95,3.25);}frieze(x,16.85,a,17.6,9.65);frieze(s<0?-5.03:8.23,16.8,a,17.7,16.03);for(const z of [8.7,16.6,24.8]){box(x,0,z,.9,10.6,.83,'brick');box(x,10.5,z,1.1,.22,1.1,'stone');const xa=s<0?-5.1:8.3;surface([[x,10.7,z-.38],[x,10.7,z+.38],[xa,14.0,z+.38],[xa,14.0,z-.38]],'stone',true);}
 // Transept five lancets and upper triplet.
 for(const u of [-2.8,-1.4,0,1.4,2.8]){const q=facing(s<0?-13.38:14.16,1.52,a,0,u);win(q[0],5.6,q[1],.87,6.2,a);}triplet(s<0?-13.38:14.16,13.8,1.52,a,.95,3.4);frieze(s<0?-13.38:14.16,1.52,a,12.9,16.05);}
 // Main facade wheel window and triple entrance, all physically in front of parent wall.
 add(new T.CircleGeometry(3.37,48),'stone',1.6,11.2,25.72);add(new T.CircleGeometry(3.10,48),'glass',1.6,11.2,25.80);add(new T.TorusGeometry(3.14,.11,5,48),'stone',1.6,11.2,25.87);add(new T.CircleGeometry(.58,20),'stone',1.6,11.2,25.91);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;const g=new T.BoxGeometry(.12,2.56,.09);g.rotateZ(-a);add(g,'stone',1.6+Math.sin(a)*1.82,11.2+Math.cos(a)*1.82,25.91);}
 for(const x of [-2.4,1.6,5.6]){box(x,0,26.04,3.65,4.75,.7,'brick');arch(x,0,26.43,2.78,4.35,0,'stone');arch(x,.08,26.51,2.40,4.0,0,'dark');box(x,.12,26.64,.10,3.33,.07,'stone');surface([[x-1.88,4.75,26.4],[x+1.88,4.75,26.4],[x,6.1,26.4]],'stone');surface([[x-1.52,4.83,26.45],[x+1.52,4.83,26.45],[x,5.88,26.45]],'green');add(new T.CircleGeometry(.36,16),'stone',x,6.15,26.48);for(const u of [-1.08,-.72,-.36,.36,.72,1.08])box(x+u,.15,26.69,.045,1.8,.06,'frame');}
 triplet(-8.3,4.4,25.72,0,.94,4.2);frieze(-8.45,25.73,0,6.5,9.66);
 // Climbing arch frieze and small stone statue/niche, avoiding identifying lettering.
 for(let i=0;i<14;i++){const x=-4.6+i*.95,y=16.3+(1-Math.abs(x-1.6)/6.2)*5.7;arch(x,y-.7,25.73,.40,.76,0,'stone');arch(x,y-.63,25.81,.27,.53,0,'brick');}box(1.6,17.25,25.84,.63,1.85,.47,'stone');add(new T.SphereGeometry(.22,8,6),'stone',1.6,19.22,25.94);box(1.6,19.52,25.88,1.25,.2,.75,'stone');
 const tx=10.82,tz=22.6,tw=7.12;box(tx,0,tz,tw,32.9,tw,'brick');for(const y of [16.5,26.5,32.55])box(tx,y,tz,tw+.28,.22,tw+.28,'stone');
 for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2]){const q=facing(tx,tz,a,tw/2+.04);triplet(q[0],4.8,q[1],a,.88,4.1);for(const u of [-1.6,0,1.6]){const r=facing(q[0],q[1],a,0,u);arch(r[0],18.0,r[1],1.32,6.0,a,'stone');const v=facing(r[0],r[1],a,.09);arch(v[0],18.06,v[1],1.10,5.8,a,'brick');win(v[0],22,v[1],.83,1.79,a);win(r[0],28.1,r[1],1.26,3.95,a,'dark');}
 const clock=facing(tx,tz,a,tw/2+.20);const g=new T.PlaneGeometry(2.4,2.4);g.rotateZ(Math.PI/4);add(g,'blue',clock[0],26.3,clock[1],a);const cc=facing(clock[0],clock[1],a,.035);add(new T.CircleGeometry(1.06,32),'gold',cc[0],26.3,cc[1],a);const face=facing(cc[0],cc[1],a,.025);add(new T.CircleGeometry(.96,32),'blue',face[0],26.3,face[1],a);for(let i=0;i<12;i++){let t=i*Math.PI/6,q=facing(face[0],face[1],a,.03,Math.sin(t)*.78);box(q[0],26.3+Math.cos(t)*.78-.08,q[1],.075,.16,.035,'gold',a);}box(face[0],26.3,face[1],.08,.67,.09,'gold',a);const h=facing(face[0],face[1],a,.05,.28);box(h[0],26.27,h[1],.56,.08,.05,'gold',a);frieze(q[0],q[1],a,tw,32.5);for(let u=-2.9;u<3;u+=.4){const r=facing(q[0],q[1],a,.2,u);box(r[0],28.05,r[1],.07,.78,.10,'stone',a);}const rail=facing(q[0],q[1],a,.2);box(rail[0],28.75,rail[1],6.05,.09,.12,'stone',a);
 // Frontons emerge above a square spire; roof begins at shoulder, not a giant cap.
 const v1=facing(tx,tz,a,tw/2,-tw/2),v2=facing(tx,tz,a,tw/2,tw/2),vp=facing(tx,tz,a,tw/2);surface([[v1[0],32.9,v1[1]],[v2[0],32.9,v2[1]],[vp[0],36.3,vp[1]]],'brick');}
 const corners=[[tx-tw/2,32.9,tz-tw/2],[tx+tw/2,32.9,tz-tw/2],[tx+tw/2,32.9,tz+tw/2],[tx-tw/2,32.9,tz+tw/2]];for(let i=0;i<4;i++)surface([corners[i],corners[(i+1)%4],[tx,42.3,tz]],'slate',true);box(tx,42.3,tz,.07,1.12,.07,'dark');box(tx,42.87,tz,.70,.07,.07,'dark');
 // Open eight-sided crossing turret, supported on the intersecting ridges.
 const cx=1.6,cz=1.52;add(new T.CylinderGeometry(1.05,1.05,.35,8),'stone',cx,22.87,cz);for(let i=0;i<8;i++){const a=i*Math.PI/4,x=cx+Math.sin(a)*.92,z=cz+Math.cos(a)*.92;box(x,23,z,.15,2.9,.15,'stone');}add(new T.CylinderGeometry(1.13,1.13,.18,8),'stone',cx,25.94,cz);for(let i=0;i<8;i++){const a=i*Math.PI/4,aa=(i+1)*Math.PI/4;surface([[cx+Math.sin(a)*1.27,26.03,cz+Math.cos(a)*1.27],[cx+Math.sin(aa)*1.27,26.03,cz+Math.cos(aa)*1.27],[cx,31.53,cz]],'slate',true);}box(cx,31.53,cz,.06,.9,.06,'dark');box(cx,32.0,cz,.55,.06,.06,'dark');
 // Rear apse windows and dwarf gallery follow their actual curved wall tangent.
 for(let i=0;i<5;i++){const a=Math.PI*.16+i*Math.PI*.17,x=1.6+Math.cos(a)*6.43,z=-12.5-Math.sin(a)*6.43,f=Math.PI-a;win(x,7.1,z,1.22,5.3,f);frieze(x,z,f,2.5,16.02);}for(const [x,z] of [[-5.3,-19.5],[11,-19.4]])for(let i=0;i<4;i++){const a=.35+i*.8;win(x+Math.cos(a)*3.63,2,z-Math.sin(a)*3.63,.85,2.8,Math.PI-a);}
}
