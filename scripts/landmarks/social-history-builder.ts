import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './social-history-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original native-scale concrete warehouse conversion; references are not textures. */
export function buildSocialHistory(_w:number,_d:number,{add,box}:BuildingTools){
 const local=(p:number[])=>new T.Vector2((p[0]-data.anchor[0])*111320*Math.cos(data.anchor[1]*Math.PI/180),-(p[1]-data.anchor[1])*110540);
 const outline=data.building.geometry.coordinates[0].slice(0,-1).map(local);
 // BAG contains the low rounded pavilion and library projection. Those are
 // separate volumes, never an opaque25m whole-parent extrusion.
 const main=outline.map(p=>new T.Vector2(p.x,Math.max(p.y,p.x>-30.1&&p.x<-.5?-9.6:-14))).filter((p,i,a)=>i===0||p.distanceTo(a[i-1])>.15);
 function shell(r:T.Vector2[],b:number,t:number,c:Colour='concrete'){const shape=new T.Shape(r);add(openTopPrism(shape,b,t),c);add(upwardRoofPlane(shape,t),'slate');}
 const rect=(x1:number,x2:number,z1:number,z2:number)=>[new T.Vector2(x1,z1),new T.Vector2(x2,z1),new T.Vector2(x2,z2),new T.Vector2(x1,z2)];
 shell(main,3.8,23.8);
 // Tall southern roof band and stair pylons produce the source stepped skyline.
 shell(rect(-34,34.45,10.5,17.8),23.8,25.4);
 shell(rect(-38,-32.8,-13.2,3.7),23.8,25.4);
 shell(rect(32.2,37.8,-14,2.7),23.8,25.4);
 // Recessed raised entry at west half: dark backing and proud round columns.
 shell(rect(-34,-30,-12.9,15.1),0,3.8,'stone');shell(rect(-30,-2.2,-9.55,15.1),0,3.8,'stone');
 shell(rect(-2.2,34.45,-13.7,17.85),0,3.8,'stone');
 shell(rect(-38,-34,-13.2,3.7),0,3.8,'stone');shell(rect(34.45,37.8,-14,2.7),0,3.8,'stone');
 function panel(x:number,y:number,z:number,w:number,h:number,c:Colour='glass',a=0){add(new T.PlaneGeometry(w,h),c,x,y+h/2,z,a);}
 function window(x:number,y:number,z:number,w:number,h:number,a=0){panel(x,y-.07,z,w+.14,h+.14,'frame',a);const n=new T.Vector3(Math.sin(a),0,Math.cos(a));panel(x+n.x*.03,y,z+n.z*.03,w,h,'glass',a);}
 // South front deliberately sparse: four paired glass assemblies, three rows.
 for(const x of[-29.8,-22.3,-14.8,-7.3]){panel(x,4.45,18.96,5.9,8.2,'frame');for(const y of[4.6,8.65]){window(x,y,19,5.6,3.6);box(x,y,19.08,.09,3.6,.10,'frame');box(x,y+1.5,19.09,5.6,.08,.10,'frame');}}
 panel(-18.6,.9,15.18,29.4,2.8,'glass');for(const x of[-32,-24.5,-17,-9.5,-2.7])add(new T.CylinderGeometry(.30,.30,2.9,10),'concrete',x,2.35,18.2);
 window(-3.7,1,18.09,2.9,2.7);for(let i=0;i<6;i++)box(-3.7,i*.16,20.1-i*.3,7.8,.16,.7,'stone');
 // Fine vertical precast ribs, paired into wider panels rather than a window grid.
 for(let x=-33.5;x<34.5;x+=1.9){const base=x<-3?13:4;box(x,base,19.05,.12,25.3-base,.24,'concrete');}
 for(const x of[-33.15,-26.65,-25.65,-19.15,-18.15,-11.65,-10.65,-4.15])box(x,3.8,19.1,.3,9.2,.32,'concrete');
 for(const x of[-28,-20.5,-13,-5.5,6,13.5,21,28.5])for(const y of[17.8,22.0])window(x,y,19.12,1.18,.48);
 for(const x of[3.5,11,18.5,26,32])for(const y of[1,5.2,9.5,13.6])window(x,y,18.95,1.25,1.35);
 // North: lower ground openings, long first-floor library ribbon and tall atrium.
 const lr=rect(-.3,31.9,-18.12,-13.95);shell(lr,6.1,10.1);
 panel(15.8,6.85,-18.21,31.8,2.50,'glass',Math.PI);for(let x=.1;x<32;x+=1.45)box(x,6.85,-18.29,.075,2.5,.12,'frame');
 for(const x of[-.25,31.85])panel(x,6.85,-16.05,4.2,2.5,'glass',x<0?-Math.PI/2:Math.PI/2);
 // Source projection is also continuous across western section behind rounded lobby.
 shell(rect(-30,-.3,-13.30,-9.55),6.1,10.1);panel(-15.2,6.85,-13.39,29.7,2.5,'glass',Math.PI);for(let x=-29.7;x<0;x+=1.45)box(x,6.85,-13.48,.075,2.5,.12,'frame');
 for(let x=-29.3;x<31.8;x+=3.0)window(x,1.15,x<-.5?-9.7:-14.07,1.9,2.8,Math.PI);
 // Large atrium opening reads as a tall recessed window, framed with exposed mullions.
 panel(-34.2,1.0,-14.10,7.2,15.0,'glass',Math.PI);for(let x=-37.4;x<-30.5;x+=1.7)box(x,1,-14.21,.09,15,.15,'frame');for(const y of[4.6,8.7,12.8])box(-34.2,y,-14.24,7.2,.09,.15,'frame');
 // Upper archive ribs and intermittent small slots retain the largely blind wall.
 for(let x=-23.5;x<32.1;x+=1.9)box(x,10.1,x<-.5?-9.72:-14.12,.12,13.5,.24,'concrete');
 for(let x=-21.7;x<31;x+=7.6)for(const y of[15.5,20])window(x,y,x<-.5?-9.88:-14.28,1.1,.48,Math.PI);
 // Rounded former press-museum lobby follows actual BAG arc; low glass only.
 const arc=outline.slice(8,17),pavilion=[new T.Vector2(-.34,-13.95),...arc,new T.Vector2(-14.55,-13.38)];
 const shape=new T.Shape(pavilion);add(openTopPrism(shape,.35,4.05),'glass');add(upwardRoofPlane(shape,4.1),'slate');
 for(let i=0;i<arc.length-1;i++){const a=arc[i],b=arc[i+1],mid=a.clone().add(b).multiplyScalar(.5),len=a.distanceTo(b),ang=Math.atan2(-(b.y-a.y),b.x-a.x);box(mid.x,3.85,mid.y,len,.25,.18,'frame',ang);for(const y of[.55,1.75,2.95])box(mid.x,y,mid.y,len,.065,.08,'bronze',ang);box(a.x,.4,a.y,.09,3.5,.09,'bronze');}
 // Short ends: exposed windows on the stair strips, otherwise sparse concrete ribs.
 for(const side of[-1,1]){const x=side<0?-38.14:38.1,a=side*Math.PI/2;for(let z=-12;z<3;z+=1.9)box(x,4,z,.21,21.2,.12,'concrete');for(const y of[1.3,5.2,9.6,13.7,17.8,22])window(x+side*.10,y,-3.5,1.9,1.45,a);}
 // Inset service box stays within the supported southern roof, not at tile maximum.
 shell(rect(7,14,11,15),25.4,25.65,'stone');
}
