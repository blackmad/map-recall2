import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './muiderpoort-footprints.json';

/** Original surveyed gate with an actual open passage; no lower slab across the arch. */
export function buildMuiderpoort(_w:number,_d:number,b:BuildingTools){
 const angle=source.authorAngleRadians;
 type Colour=Parameters<BuildingTools['add']>[1];
 const at=(x:number,z:number)=>[x*Math.cos(angle)+z*Math.sin(angle),-x*Math.sin(angle)+z*Math.cos(angle)];
 function add(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0,rotation=0){const q=at(x,z);b.add(g,c,q[0],y,q[1],angle+rotation);}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour,rotation=0){const q=at(x,z);b.box(q[0],y,q[1],w,h,d,c,angle+rotation);}
 const polygon=source.localPolygon.slice(0,-1);
 function shape(points:number[][]){const s=new T.Shape();s.moveTo(points[0][0],points[0][1]);for(const p of points.slice(1))s.lineTo(p[0],p[1]);s.closePath();return s;}
 function clip(points:number[][],cut:number,side:number){const out:number[][]=[];for(let i=0;i<points.length;i++){const a=points[i],q=points[(i+1)%points.length],inside=(p:number[])=>side*(p[0]-cut)>=0;if(inside(a))out.push(a);if(inside(a)!==inside(q)){const t=(cut-a[0])/(q[0]-a[0]);out.push([cut,a[1]+t*(q[1]-a[1])]);}}return out;}
 // Surveyed wings remain separate physical volumes. The central gap reaches both facades.
 for(const side of [-1,1])add(openTopPrism(shape(clip(polygon,side*2.35,side)),0,9.4),'brick');
 add(upwardRoofPlane(shape(polygon),9.4),'slate');
 // Long barrel/cross-vault abstraction: a continuous arch soffit, never a filled rectangle.
 const arch=new T.Shape();arch.moveTo(-2.35,9.4);arch.lineTo(-2.35,4.0);arch.absarc(0,4,2.35,Math.PI,0,true);arch.lineTo(2.35,9.4);arch.closePath();
 const vaultRaw=new T.ExtrudeGeometry(arch,{depth:17.13,bevelEnabled:false,curveSegments:18});
 // Explicit surveyed slate roof owns the top: remove the wall-colored arch cap.
 const vp=vaultRaw.getAttribute('position'),vn=vaultRaw.getAttribute('normal'),vv:number[]=[];
 for(let i=0;i<vp.count;i+=3){if([0,1,2].every(j=>vn.getY(i+j)>.9))continue;for(let j=0;j<3;j++)vv.push(vp.getX(i+j),vp.getY(i+j),vp.getZ(i+j));}
 const vault=new T.BufferGeometry();vault.setAttribute('position',new T.Float32BufferAttribute(vv,3));vault.computeVertexNormals();vaultRaw.dispose();add(vault,'brick',0,0,-6.95);
 function archRim(z:number,r=2.35){for(let i=0;i<18;i++){const lo=i*Math.PI/18+.009,hi=(i+1)*Math.PI/18-.009;const s=new T.Shape();s.moveTo(r*Math.cos(lo),4+r*Math.sin(lo));s.lineTo((r+.36)*Math.cos(lo),4+(r+.36)*Math.sin(lo));s.lineTo((r+.36)*Math.cos(hi),4+(r+.36)*Math.sin(hi));s.lineTo(r*Math.cos(hi),4+r*Math.sin(hi));s.closePath();add(new T.ExtrudeGeometry(s,{depth:.18,bevelEnabled:false}),'stone',0,0,z);}}
 // Front stone masks are on the surveyed central projection; reversed face has pilasters.
 for(const side of [-1,1]){
  const z=side>0?10.02:-7.48;
  for(const x of [-4.78,4.78]){
   box(x,0,z,4.8,8.05,.28,'stone');
   for(let y=.6;y<8;y+=.56)box(x,y,z+side*.17,4.8,.045,.04,'frame');
  }
  box(0,6.75,z,14.65,1.3,.34,'stone');
  archRim(z+side*.2);
  for(const x of [-2.53,2.53])box(x,0,z+side*.19,.36,4.0,.28,'stone');
  box(0,6.18,z+side*.38,.48,.74,.3,'stone');
  for(const x of [-6.35,-3.35,3.35,6.35]){
   if(side>0){
    add(new T.CylinderGeometry(.43,.48,7.15,12),'stone',x,4.03,z+.40);
    for(let y=.78;y<7.95;y+=.98)add(new T.CylinderGeometry(.5,.5,.16,12),'frame',x,y,z+.4);
    for(const y of [.2,.5,7.62,7.9])box(x,y,z+.42,1.16,.22,1.16,'stone');
   }else{
    box(x,.38,z-.24,.88,7.24,.45,'stone');for(let y=.5;y<7.8;y+=.58)box(x,y,z-.5,.94,.08,.09,'frame');
    box(x,7.7,z-.25,1.25,.25,.65,'stone');
   }
  }
  // Shallow arched stone niches and round medallions sit between the paired orders.
  for(const x of [-4.88,4.88]){
   const niche=new T.Shape();niche.moveTo(-.69,0);niche.lineTo(.69,0);niche.lineTo(.69,2.9);niche.absarc(0,2.9,.69,0,Math.PI,false);niche.closePath();
   add(new T.ExtrudeGeometry(niche,{depth:.035,bevelEnabled:false,curveSegments:10}),'white',x,1.05,z+side*.19);
   add(new T.TorusGeometry(.48,.075,4,16),'frame',x,6.75,z+side*.24);
   add(new T.CircleGeometry(.43,16),'white',x,6.75,z+side*.26,side<0?Math.PI:0);
  }
  // Doric entablature, triglyphs and restrained cornice dentils.
  for(const [y,h,w,d] of [[8.03,.2,15.2,.7],[8.3,.65,14.8,.48],[8.97,.22,15.35,.86],[9.22,.18,15.65,1]])box(0,y,z,w,h,d,'stone');
  for(let x=-6.7;x<=6.7;x+=1.22){box(x,8.32,z+side*.28,.23,.58,.1,'frame');box(x,9.03,z+side*.52,.3,.18,.16,'stone');}
  const pediment=new T.Shape();pediment.moveTo(-7.65,0);pediment.lineTo(7.65,0);pediment.lineTo(0,2.3);pediment.closePath();
  add(new T.ExtrudeGeometry(pediment,{depth:.38,bevelEnabled:false}),'stone',0,9.40,z-.05);
  for(const s of [-1,1]){const g=new T.BoxGeometry(8.12,.24,.65);g.rotateZ(s*Math.atan2(2.3,7.65));add(g,'frame',s*-3.83,10.62,z+side*.18);}
  // Heraldic stone relief, different on the two real faces; no name lettering.
  add(new T.IcosahedronGeometry(.61,1),'stone',0,10.23,z+side*.36);
  if(side>0){box(0,9.79,z+.57,.72,1.16,.13,'frame');for(const y of [9.95,10.25,10.55])for(const r of [-1,1]){const g=new T.BoxGeometry(.33,.085,.1);g.rotateZ(r*Math.PI/4);add(g,'stone',0,y,z+.69);}}
  else{box(0,9.9,z-.5,1.15,.24,.18,'frame');box(0,10.11,z-.5,.08,.85,.12,'frame');const sail=new T.Shape();sail.moveTo(0,0);sail.lineTo(.55,.3);sail.lineTo(0,.75);sail.closePath();add(new T.ExtrudeGeometry(sail,{depth:.10,bevelEnabled:false}),'white',0,10,z-.57);}
  for(const x of [-1.42,1.42]){add(new T.IcosahedronGeometry(.32,0),'stone',x,10.05,z+side*.32);box(x,9.52,z+side*.28,.30,.62,.14,'stone');}
 }
 // Brick side wings: round front/rear lights; rectangular windows on short end walls.
 for(const side of [-1,1])for(const x of [-9.65,9.65])for(const y of [2.35,5.65]){
  const z=side*6.80;add(new T.TorusGeometry(.49,.11,5,16),'stone',x,y,z);
  add(new T.CircleGeometry(.42,16),'glass',x,y,z+side*.06,side<0?Math.PI:0);
 }
 for(const side of [-1,1]){
  for(const z of [-4.4,0,4.4])for(const y of [1.25,4.95]){
   box(side*12.26,y,z,.12,2.04,1.32,'stone');box(side*12.34,y+.12,z,.10,1.77,1.05,'glass');box(side*12.42,y+.12,z,.10,1.77,.09,'stone');box(side*12.42,y+.97,z,.10,.10,1.12,'stone');
  }
  for(const z of [-6.3,6.3])box(side*12.24,0,z,.30,9.4,.72,'stone');
 }
 // Source-supported raised square stage and balustrade, offset toward city side.
 box(0,9.42,-1.5,9.65,4.18,9.9,'stone');
 for(const y of [9.65,12.9,13.45])box(0,y,-1.5,10.08,.22,10.33,'frame');
 for(const side of [-1,1]){
  box(0,13.75,-1.5+side*4.93,9.85,.18,.28,'stone');
  box(side*4.8,13.75,-1.5,.28,.18,9.95,'stone');
  for(let x=-4.45;x<4.6;x+=.54)box(x,13.08,-1.5+side*4.85,.14,.66,.14,'stone');
  for(let z=-5.95;z<3.1;z+=.54)box(side*4.8,13.08,z,.14,.66,.14,'stone');
 }
 // Octagonal dome: direct bounded loft with outward/upward winding and exposed ribs.
 function loft(levels:number[][],c:Colour,z=-1.5,role='dome'){
  const p:number[]=[];for(let j=0;j<levels.length-1;j++)for(let i=0;i<8;i++){
   const v=(k:number,l:number)=>{const a=l*Math.PI/4+Math.PI/8;return[levels[k][1]*Math.cos(a),levels[k][0],z+levels[k][1]*Math.sin(a)];};
   p.push(...v(j,i),...v(j+1,i),...v(j+1,i+1),...v(j,i),...v(j+1,i+1),...v(j,i+1));
  }const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.computeVertexNormals();g.userData.role=role;add(g,c);
 }
 loft([[13.85,5.18],[15.2,4.90],[16.65,3.82],[17.85,2.45],[18.4,1.74]],'slate');
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4+Math.PI/8;const points=[[13.88,5.20],[15.22,4.93],[16.67,3.85],[17.87,2.48],[18.43,1.77]];
  for(let j=0;j<points.length-1;j++){const v=(k:number)=>new T.Vector3(Math.cos(a)*points[k][1],points[k][0],-1.5+Math.sin(a)*points[k][1]);const lo=v(j),hi=v(j+1),delta=hi.clone().sub(lo),g=new T.CylinderGeometry(.09,.09,delta.length(),5);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));const mid=lo.clone().add(hi).multiplyScalar(.5);add(g,'frame',mid.x,mid.y,mid.z);}
 }
 // Enclosed octagonal lantern: owner/RCE photos show pale panels and recessed
 // dark apertures. Open uurwerken refers to the clocks, not an empty tower cage.
 for(let i=0;i<8;i++){const a=i*Math.PI/4+Math.PI/8;box(Math.cos(a)*1.68,18.45,-1.5+Math.sin(a)*1.68,.18,4.8,.18,'frame');}
 for(const y of [18.5,19.0,23.25,23.65])add(new T.CylinderGeometry(1.91,1.91,.18,8),'frame',0,y,-1.5);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,x=1.55*Math.sin(a),z=-1.5+1.55*Math.cos(a);
  box(x,18.97,z,1.29,4.27,.15,'frame',a);
  if(i%2===0){
   const px=1.66*Math.sin(a),pz=-1.5+1.66*Math.cos(a);
   box(px,19.38,pz,.91,1.84,.035,'dark',a);
   for(const u of [-.51,.51])box(px+u*Math.cos(a),19.24,pz-u*Math.sin(a),.095,2.12,.09,'stone',a);
   for(const y of [19.22,21.30])box(px,y,pz,1.10,.12,.09,'stone',a);
  }else{
   const px=1.65*Math.sin(a),pz=-1.5+1.65*Math.cos(a);
   box(px,19.37,pz,.97,3.02,.045,'stone',a);
  }
 }

 for(let i=0;i<4;i++){
  const a=i*Math.PI/2;const z=-1.5+1.72*Math.cos(a),x=1.72*Math.sin(a);
  add(new T.CircleGeometry(.79,16),'dark',x,22.55,z,a);
  add(new T.TorusGeometry(.82,.065,4,16),'gold',x,22.55,z,a);
  const hand=(u:number,v:number,w:number,h:number,r=0)=>{const g=new T.BoxGeometry(w,h,.10);g.rotateZ(r);g.rotateY(a);add(g,'gold',x+u*Math.cos(a),22.55+v,z-u*Math.sin(a));};
  hand(0,.27,.06,.61);hand(.20,0,.45,.065);
  for(let j=0;j<12;j++){const t=j*Math.PI/6;hand(.66*Math.sin(t),.66*Math.cos(t),.055,.15,-t);}
 }
 loft([[23.73,1.95],[24.28,1.55],[24.9,.70],[25.2,.26]],'slate',-1.5,'lantern-roof');
 add(new T.CylinderGeometry(.06,.24,2.6,8),'frame',0,26.5,-1.5);box(0,27.8,-1.5,.08,.4,.08,'frame');box(0,27.86,-1.5,.88,.06,.06,'frame');
}
