import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './petruskerk-footprints.json';
/** Original native-metre geometry. Tower spire uses current photo ratios where AHN misses it. */
export function buildPetruskerk(_w:number,_d:number,b:BuildingTools){
 const turn=source.localRotationDegrees*Math.PI/180;
 const add=(g:T.BufferGeometry,c:Parameters<BuildingTools['add']>[1],x=0,y=0,z=0,a=0)=>{g.rotateY(a);g.translate(x,y,z);g.rotateY(turn);b.add(g,c);};
 const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:Parameters<BuildingTools['add']>[1],a=0)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z,a);
 const shape=(v:number[][])=>new T.Shape(v.map(q=>new T.Vector2(q[0],q[1])));
 const ring=shape(source.parts[0].localRing.slice(0,-1));
 add(openTopPrism(ring,0,1.0),'brick');add(upwardRoofPlane(ring,1.0),'brick');
 const xa=-12.65,xb=12.6,half=5.72,eave=7.45,ridge=11.65;
 const core=shape([[xa,-half],[xb,-half],[xb,half],[xa,half]]);add(openTopPrism(core,0,eave),'brick');
 function surface(v:number[][],c:Parameters<BuildingTools['add']>[1],up=false){let pts=v.map(q=>new T.Vector3(...q as [number,number,number]));if(up&&pts[1].clone().sub(pts[0]).cross(pts[2].clone().sub(pts[0])).y<0)pts.reverse();const values:number[]=[];for(let i=1;i<pts.length-1;i++)values.push(...pts[0].toArray(),...pts[i].toArray(),...pts[i+1].toArray());const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();add(g,c);}
 for(const s of [-1,1])surface([[xa,eave,s*(half+.12)],[xb,eave,s*(half+.12)],[xb,ridge,s*2.3],[xa,ridge,s*2.3]],'slate',true);
 surface([[xa,ridge,-2.3],[xb,ridge,-2.3],[xb,ridge,2.3],[xa,ridge,2.3]],'slate',true);
 // Truncated end gables; west tower emerges from the shared nave rather than a separate giant shaft.
 for(const x of [xa,xb]){surface([[x,eave,-half],[x,eave,half],[x,ridge,2.3],[x,ridge,-2.3]],'brick');for(const s of [-1,1]){const a=new T.Vector3(x,eave,s*half),z=new T.Vector3(x,ridge,s*2.3),delta=z.clone().sub(a);const g=new T.CylinderGeometry(.11,.11,delta.length(),5);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));const mid=a.add(z).multiplyScalar(.5);add(g,'stone',...mid.toArray() as [number,number,number]);}}
 for(const s of [-1,1]){box(0,7.21,s*(half+.09),xb-xa,.22,.25,'stone');box(0,7.43,s*(half+.12),xb-xa+.2,.13,.37,'white');}
 const facing=(x:number,z:number,a:number,d:number,u=0)=>[x+Math.sin(a)*d+Math.cos(a)*u,z+Math.cos(a)*d-Math.sin(a)*u];
 function arch(x:number,y:number,z:number,w:number,h:number,a:number,c:Parameters<BuildingTools['add']>[1]){const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-w/2);s.absarc(0,h-w/2,w/2,0,Math.PI,false);s.closePath();add(new T.ExtrudeGeometry(s,{depth:.07,bevelEnabled:false,curveSegments:8}),c,x,y,z,a);}
 function pointed(x:number,y:number,z:number,w:number,h:number,a:number,c:Parameters<BuildingTools['add']>[1]){const q=new T.Shape();q.moveTo(-w/2,0);q.lineTo(w/2,0);q.lineTo(w/2,h-w*.72);q.quadraticCurveTo(w*.42,h-w*.28,0,h);q.quadraticCurveTo(-w*.42,h-w*.28,-w/2,h-w*.72);q.closePath();add(new T.ExtrudeGeometry(q,{depth:.07,bevelEnabled:false,curveSegments:8}),c,x,y,z,a);}
 function window(x:number,y:number,z:number,w:number,h:number,a:number){arch(x,y,z,w+.16,h+.10,a,'white');const q=facing(x,z,a,.09);arch(q[0],y+.06,q[1],w,h-.08,a,'glass');const mull=facing(x,z,a,.18);box(mull[0],y+.07,mull[1],.065,h-w*.52,.07,'white',a);for(let h0=.65;h0<h-w*.46;h0+=.73)box(mull[0],y+h0,mull[1],w,.06,.07,'white',a);
  const centre=h-w/2;for(const t of [-.65,0,.65]){const q=facing(x,z,a,.18,Math.sin(t)*w*.25);box(q[0],y+centre,q[1],.045,w*.43,.065,'white',a+t*.6);}}
 // Seven surveyed buttress stations with heavy lower offsets and small sloped stone caps.
 for(const s of [-1,1])for(let i=0;i<7;i++){const x=-12.05+i*4.08,z=s*6.12;box(x,0,z,.84,2.1,1.9,'brick');box(x,2.1,s*6.04,.72,3.95,1.72,'brick');box(x,2.02,z,.97,.15,1.96,'stone');surface([[x-.43,6.1,s*5.52],[x+.43,6.1,s*5.52],[x+.43,5.79,s*6.98],[x-.43,5.79,s*6.98]],'slate',true);
  if(i<6){const cx=x+2.04,a=s>0?0:Math.PI;window(cx,2.05,s*(half+.025),1.37,4.05,a);}}
 // Photo-supported tomb assemblies, held wholly against the church's own wall.
 // Separate BAG tomb footprints at the east end remain installed ordinary geometry.
 for(const s of [-1,1])for(const i of [1,3]){const x=-12.05+i*4.08+2.04,z=s*6.05;box(x,0,z,2.25,.2,.57,'stone');box(x,.2,z,2.05,1.42,.50,'stone');box(x,1.62,z,2.25,.15,.64,'white');for(const dx of [-.93,.93])box(x+dx,.25,z+s*.04,.15,1.35,.56,'white');box(x,1.83,z,.72,.14,.43,'stone');}
 const west=-Math.PI/2;
 // West doorway and the two defining blind Gothic panels (brick recesses, not glazing).
 box(xa-.05,0,0,2.4,2.55,.13,'dark',west);for(const dz of [-1.32,1.32])box(xa-.15,0,dz,.18,2.68,.30,'white',west);box(xa-.17,2.65,0,2.85,.19,.33,'white',west);box(xa-.24,.22,0,.07,2.2,.08,'stone',west);box(xa-.15,2.15,0,2.35,.06,.12,'stone',west);
 for(const z of [-1.03,1.03]){pointed(xa-.03,4.0,z,1.05,3.85,west,'stone');pointed(xa-.12,4.08,z,.82,3.61,west,'brick');}
 for(const z of [-3.95,3.95])window(xa-.025,2.1,z,1.27,3.33,west);
 arch(xa-.03,8.7,0,.54,1.32,west,'stone');arch(xa-.13,8.77,0,.36,1.12,west,'dark');arch(xa-.03,4.03,0,.50,1.1,west,'dark');
 // Timber belfry at measured 11.65–16.2m, broad cream fascia and slender pyramidal slate roof.
 const tx=xa+2.38,tw=4.72,td=4.65;box(tx,11.65,0,tw,4.55,td,'white');box(tx,11.59,0,tw+.12,.18,td+.12,'stone');box(tx,16.16,0,tw+.38,.19,td+.38,'white');
 for(const a of [0,Math.PI/2,Math.PI,-Math.PI/2]){const q=facing(tx,0,a,tw/2+.025);box(q[0],12.56,q[1],1.20,1.64,.09,'dark',a);for(let y=12.68;y<14.13;y+=.18){const l=facing(q[0],q[1],a,.09);box(l[0],y,l[1],1.08,.065,.1,'frame',a);}const clock=facing(tx,0,a,tw/2+.095);add(new T.CircleGeometry(.59,24),'dark',clock[0],15.14,clock[1],a);for(let i=0;i<12;i++){const t=i*Math.PI/6,u=Math.sin(t)*.48,v=Math.cos(t)*.48,q=facing(clock[0],clock[1],a,.03,u);box(q[0],15.14+v-.055,q[1],.065,.11,.035,'gold',a);}for(const [dx,dy,w,h] of [[0,.08,.045,.37],[.12,0,.29,.045]]){const q=facing(clock[0],clock[1],a,.04,dx);box(q[0],15.14+dy,q[1],w,h,.035,'gold',a);}}
 const base=16.35,peak=23.55,rx=2.51,rz=2.48;const corners=[[tx-rx,base,-rz],[tx+rx,base,-rz],[tx+rx,base,rz],[tx-rx,base,rz]];for(let i=0;i<4;i++)surface([corners[i],corners[(i+1)%4],[tx,peak,0]],'slate',true);
 add(new T.SphereGeometry(.14,8,6),'gold',tx,23.67,0);box(tx,23.72,0,.045,1.18,.045,'dark');box(tx,24.34,0,.72,.045,.045,'dark');
 // East wall keeps the genuine rectangular nave termination; no invented attached house.
 for(const z of [-3.8,0,3.8])window(xb+.03,2.1,z,1.34,3.9,Math.PI/2);
}
