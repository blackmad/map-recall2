import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
/** Original Kraan13: open portal, lattice tower, three suites and rotating boom. */
export function buildFaralda(_w:number,_d:number,b:BuildingTools):void{
 type C=Parameters<BuildingTools['add']>[1];type P=[number,number,number];
 function beam(a:P,q:P,width:number,c:C='frame',role='steel'){const delta=new T.Vector3(...q).sub(new T.Vector3(...a)),g=new T.BoxGeometry(width,delta.length(),width);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));g.userData.role=role;const mid=new T.Vector3(...a).add(new T.Vector3(...q)).multiplyScalar(.5);b.add(g,c,mid.x,mid.y,mid.z)}
 function rail(x:number,y:number,z:number,w:number,d:number,c:C='frame'){for(const side of[-1,1]){b.box(x,y,z+side*d/2,w,.1,.1,c);b.box(x+side*w/2,y,z,.1,.1,d,c);for(let t=-w/2;t<=w/2;t+=.7)b.box(x+t,y-1,z+side*d/2,.075,1,.075,c)}}
 // Four inclined steel legs stand on individual shoes, leaving the base open.
 for(const sx of[-1,1])for(const sz of[-1,1]){b.box(sx*3.9,0,sz*3.9,1.2,.45,1.2,'stone');beam([sx*3.9,.45,sz*3.9],[sx*2.4,10.4,sz*2.2],.9,'frame','footing');b.box(sx*3.9,.45,sz*3.9,1.15,.2,1.15,'dark')}
 b.box(0,9.8,0,8.2,.65,7.4,'red');b.box(0,10.45,0,5.5,2.5,4.4,'red');for(const side of[-1,1]){b.box(0,10.85,side*2.25,4.5,1.65,.08,'glass');b.box(side*2.8,10.85,0,.08,1.65,3.45,'glass');}rail(0,13.1,0,8.2,7.4,'red');
 // Continuous mast posts, horizontal rings and true diagonal lattice struts.
 const sx=2.4,sz=2.2;for(const x of[-sx,sx])for(const z of[-sz,sz])beam([x,12.95,z],[x,49.1,z],.32,'frame','mast-post');
 for(let y=13;y<=48.01;y+=5){for(const z of[-sz,sz])beam([-sx,y,z],[sx,y,z],.24);for(const x of[-sx,sx])beam([x,y,-sz],[x,y,sz],.24);if(y>=48)continue;for(const z of[-sz,sz]){beam([-sx,y,z],[sx,y+5,z],.16);beam([sx,y,z],[-sx,y+5,z],.16)}for(const x of[-sx,sx]){beam([x,y,-sz],[x,y+5,sz],.16);beam([x,y,sz],[x,y+5,-sz],.16)}}
 // New access remains visibly red; the lower spiral is separate from the portal.
 b.box(-5.55,0,0,1.15,13.0,1.35,'red');for(let y=1;y<12.6;y+=1.6)b.box(-6.16,y,0,.075,1.05,.85,'glass');
 b.box(-3.4,13,0,.7,34.5,.9,'red');for(let y=14;y<47;y+=1.25){b.box(-3.79,y,0,.07,.95,.66,'glass');b.box(-3.4,y+.98,0,.86,.12,1.06,'frame')}
 for(let i=0;i<34;i++){const a=i*Math.PI/5,y=i*.28;const g=new T.BoxGeometry(1.05,.12,.42);b.add(g,'red',-4.2+Math.cos(a)*1.1,y+.4,Math.sin(a)*1.1,-a);beam([-4.2+Math.cos(a)*1.6,y+.5,Math.sin(a)*1.6],[-4.2+Math.cos(a)*1.6,y+1.25,Math.sin(a)*1.6],.065,'red')}
 // Suite heights35/40/45m are operator-published; faceted skins are approximate.
 for(let i=0;i<3;i++){const y=33+i*5,c:C=i===1?'frame':'red';b.box(0,y,0,4.45,4.2,3.9,c);b.box(0,y+4.2,0,4.9,.25,4.4,'frame');for(const side of[-1,1]){b.box(0,y+.7,side*2.0,3.45,2.8,.09,'glass');b.box(side*2.28,y+.7,0,.08,2.8,2.6,'glass');for(const t of[-1.12,0,1.12])b.box(t,y+.7,side*2.07,.08,2.8,.1,'frame');}b.box(0,y-.2,2.9,5.6,.25,1.45,'frame');rail(0,y+.95,2.9,5.6,1.45);}
 // Long boom and short counterweight arm: each is open triangulated steel.
 const stations=[[-15.5,46.6,1.0],[-8,48.5,1.35],[0,49.4,1.65],[8,48.8,1.45],[16,48.0,1.2],[24,47.3,.95],[33.5,46.65,.65]];
 for(let i=0;i<stations.length-1;i++){const [a,topA,za]=stations[i],[q,topQ,zq]=stations[i+1],c:C=i===0?'gold':'frame';for(const side of[-1,1]){beam([a,46.3,side*za],[q,46.3,side*zq],.20,c,'boom');beam([a,topA,side*za],[q,topQ,side*zq],.17,c,'boom');beam([a,46.3,side*za],[q,topQ,side*zq],.14,c,'boom');beam([a,topA,side*za],[q,46.3,side*zq],.14,c,'boom');}beam([a,46.3,-za],[a,topA,-za],.15,c);beam([a,46.3,za],[a,topA,za],.15,c);beam([a,46.3,-za],[q,46.3,zq],.12,c);beam([a,46.3,za],[q,46.3,-zq],.12,c);}
 for(const side of[-1,1])beam([29.5,46.3,side*.8],[34.2,46.3,side*.6],.28,'gold');b.box(33.8,46.2,0,.65,.35,1.9,'gold');
 const weight=new T.CylinderGeometry(2.0,2.0,1.25,12);weight.rotateX(Math.PI/2);b.add(weight,'dark',-15.7,47.0,0);beam([-15.7,47,0],[-8,48.5,0],.3,'gold');
 // Hoist cable and hook descend from the long arm, leaving the yard untouched.
 beam([29.8,46.3,0],[29.8,35.8,0],.045,'dark');b.add(new T.TorusGeometry(.4,.09,5,10,Math.PI*1.65),'gold',29.8,35.5,0);
 // Open rooftop deck and a small jacuzzi beneath the boom's mast apex.
 b.box(0,47.45,0,4.8,.2,4.5,'frame');rail(0,48.7,0,4.8,4.5);const tub=new T.CylinderGeometry(.85,.85,.45,12);b.add(tub,'white',0,47.95,0);const water=new T.CircleGeometry(.73,12);water.rotateX(-Math.PI/2);b.add(water,'glass',0,48.18,0);
 beam([33.5,46.6,.6],[33.5,49.2,.6],.07,'frame');b.box(33.15,48.55,.6,.7,.48,.055,'blue');b.box(33.15,48.55,.56,.25,.48,.02,'white');
}
