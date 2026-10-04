import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import specs from './independent-cinemas-specs.json';
import sources from './independent-cinemas-footprints.json';
type C=Parameters<BuildingTools['add']>[1];
/** Three individual cinema/music buildings, retaining mapped notches and adjoining open space. */
export function buildIndependentCinemaLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const {box,add,sign}=b,s=specs.find(x=>x.id===id)!,src=sources.find(x=>x.id===id)!,a=s.surveyed.anchor,h=(90+s.surveyed.northOffsetDegrees)*Math.PI/180;
 const ring=src.parts[0].polygons[0][0].map(([lng,lat])=>{const e=(lng-a[0])*111320*Math.cos(a[1]*Math.PI/180),n=(lat-a[1])*110540;return new T.Vector2(e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h));});
 const clip=(r:T.Vector2[],axis:'x'|'y',v:number,more:boolean)=>{const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],pi=more?p[axis]>=v:p[axis]<=v,qi=more?q[axis]>=v:q[axis]<=v;if(pi)out.push(p.clone());if(pi!==qi)out.push(p.clone().lerp(q,(v-p[axis])/(q[axis]-p[axis])));}return out;};
 const region=(x0:number,x1:number,z0:number,z1:number)=>clip(clip(clip(clip(ring,'x',x0,true),'x',x1,false),'y',z0,true),'y',z1,false);
 const body=(r:T.Vector2[],hh:number,c:C='brick')=>{if(r.length<3)return;const g=new T.ExtrudeGeometry(new T.Shape(r),{depth:hh,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,hh,0);add(g,c);};
 const roof=(r:T.Vector2[],base:number,height:(x:number,z:number)=>number,c:C='slate')=>{if(r.length<3)return;const g=new T.ShapeGeometry(new T.Shape(r)),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setXYZ(i,x,base+height(x,z),z);}const idx=g.getIndex()!;for(let i=0;i<idx.count;i+=3){const n=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,n);}g.computeVertexNormals();add(g,c);};
 const flat=(r:T.Vector2[],y:number)=>roof(r,y,()=>0);
 const sash=(x:number,y:number,z:number,w:number,hh:number,back=false)=>{const d=back?-1:1;box(x,y,z,w+.18,hh+.16,.15,'stone');box(x,y+.08,z+d*.12,w,hh,.06,'glass');box(x,y+.08,z+d*.17,.05,hh,.05,'frame');for(let yy=y+.08+.7;yy<y+hh;yy+=.75)box(x,yy,z+d*.17,w,.045,.05,'frame');};
 const arch=(x:number,y:number,z:number,w:number,hh:number,c:C,back=false)=>{const r=w/2,sh=new T.Shape();sh.moveTo(-r,0);sh.lineTo(r,0);sh.lineTo(r,hh-r);sh.absarc(0,hh-r,r,0,Math.PI,false);sh.closePath();const g=new T.ShapeGeometry(sh);if(back)g.rotateY(Math.PI);add(g,c,x,y,z);};
 const beam=(x1:number,y1:number,z1:number,x2:number,y2:number,z2:number,w:number,c:C)=>{const p=new T.Vector3(x1,y1,z1),q=new T.Vector3(x2,y2,z2),g=new T.BoxGeometry(w,p.distanceTo(q),w),m=new T.Matrix4().makeRotationFromQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),q.clone().sub(p).normalize()));g.applyMatrix4(m);add(g,c,...p.add(q).multiplyScalar(.5).toArray() as [number,number,number]);};
 if(id==='lab111'){
  // Hulshoff's flat-roofed laboratory has three unequal wings; the south recess is open.
  body(ring,11.8);flat(ring,11.83);
  const main=region(-3,29,-16,5.5);body(main,16.7);flat(main,16.73);
  const west=region(-29,-11,-19,19);body(west,16.0);flat(west,16.03);
  const tower=region(-11.2,-3.1,-3,8.1);body(tower,21.5);flat(tower,21.53);
  const front=5.18;for(let x=.8;x<24;x+=3.4)for(const y of [1.0,4.7,8.4,12.1])sash(x,y,front+.1,2.35,2.65);
  for(let x=-25;x<24;x+=3.6)for(const y of [1.1,4.7,8.4,12.1])sash(x,y,-18.15-.09,2.4,2.55,true);
  for(const z of [-14,-9,-4,1,6,11,16])for(const y of [1.2,4.9,8.6,12.2]){box(-21.5,y,z,.13,2.55,2.3,'glass');box(-21.62,y+2.6,z,.22,.15,2.5,'stone');}
  // Stair/clock tower: three very tall gridded windows, decorative figures and dot clock.
  const tx=-7.15,tz=8.01;for(const x of [tx-2.1,tx,tx+2.1]){sash(x,5.0,tz+.12,1.15,5.0);sash(x,11.4,tz+.12,1.15,5.3);box(x,16.9,tz+.1,.7,.95,.25,'stone');add(new T.SphereGeometry(.23,6,4),'stone',x,18.05,tz+.22);}
  for(let i=0;i<12;i++){const aa=i*Math.PI/6;add(new T.CircleGeometry(.07,6),'stone',tx+Math.sin(aa)*.75,19.47+Math.cos(aa)*.75,tz+.23);}beam(tx,19.47,tz+.25,tx+.4,19.8,tz+.25,.06,'dark');beam(tx,19.47,tz+.25,tx,20.07,tz+.25,.055,'dark');
  box(tx,21.25,3.25,8.3,.65,10.3,'stone');box(tx,0,tz+.16,3.6,3.55,.15,'dark');box(tx,3.55,tz+.55,4.55,.32,1.5,'stone');for(let i=0;i<4;i++)box(tx,i*.22,tz+1.8-i*.32,4.3,.23,1.7-i*.32,'stone');sign('LAB111',tx-1.55,4.03,tz+.45,.22,'white');
  // Main wing cornices remain separate from the recessed entrance.
  box(11.5,16.42,front,29,.36,.38,'stone');box(-16.3,15.72,18.3,10.2,.32,.42,'stone');
  for(const x of [-19,-16,-13])for(const y of [1.2,5,8.8,12.4])sash(x,y,18.52,1.65,2.45);
  // Lower former lecture/aula wing retains its daylight roof.
  box(-16.25,16.08,-9.8,9.0,.2,11.0,'glass');for(let z=-15;z<-5;z+=1.65)box(-16.25,16.22,z,9,.07,.07,'frame');
 }else if(id==='occii'){
  body(ring,4.8);flat(ring,4.83);const lo=-6.4,hi=2.6,cx=(lo+hi)/2;
  // The narrow tram house runs deep behind its carved street gable, not across the yard.
  for(const [min,max] of [[lo,cx],[cx,hi]])roof(clip(clip(ring,'x',min,true),'x',max,false),4.8,(x)=>3.65*(1-Math.abs(x-cx)/4.5));
  const f=(x:number)=>31.93+(x-cx)*.12;
  const tri=new T.BufferGeometry();tri.setAttribute('position',new T.Float32BufferAttribute([lo,4.8,f(lo)+.09,hi,4.8,f(hi)+.09,cx,8.5,f(cx)+.09],3));tri.computeVertexNormals();add(tri,'brick');
  box(cx,0,f(cx)+.12,4.3,3.1,.16,'dark');for(let i=0;i<5;i++)box(cx-2.1+i*1.05,.1,f(cx)+.25,.08,3.0,.06,'gold');
  for(const x of [lo+1,hi-1]){sash(x,.9,f(x)+.12,1.3,2.0);arch(x,2.6,f(x)+.3,1.65,1.1,'gold');add(new T.CircleGeometry(.19,8),'red',x,3.27,f(x)+.4);}
  for(const x of [cx-1.3,cx,cx+1.3]){box(x,4.3,f(x)+.2,1.0,1.5,.12,'gold');box(x,4.4,f(x)+.29,.76,1.27,.06,'dark');arch(x,5.6,f(x)+.33,.98,.7,'gold');arch(x,5.68,f(x)+.36,.74,.5,'dark');box(x-.65,4.15,f(x)+.35,.16,2.0,.2,'gold');}for(const x of [cx-2.85,cx+2.85]){box(x,4.35,f(x)+.24,1.0,1.9,.08,'red');for(let j=0;j<3;j++){add(new T.CircleGeometry(.28,12),'gold',x,4.64+j*.55,f(x)+.32);add(new T.CircleGeometry(.20,12),'dark',x,4.64+j*.55,f(x)+.36);}beam(x-.5,4.4,f(x)+.4,x+.5,6.2,f(x)+.4,.06,'gold');beam(x+.5,4.4,f(x)+.4,x-.5,6.2,f(x)+.4,.06,'gold');}add(new T.CircleGeometry(.49,12),'gold',cx,7.15,f(cx)+.22);add(new T.CircleGeometry(.31,12),'white',cx,7.15,f(cx)+.25);
  for(const yy of [3.75,4.08,5.67])box(cx,yy,f(cx)+.25,8.7,.15,.25,'gold',-Math.atan(.12));
  beam(lo-.15,4.75,f(lo)+.35,cx,8.6,f(cx)+.35,.23,'gold');beam(cx,8.6,f(cx)+.35,hi+.15,4.75,f(hi)+.35,.23,'gold');
  for(let i=0;i<9;i++){const x=lo+.4+i*.95,y=8.5-Math.abs(x-cx)*.82;add(new T.CircleGeometry(.16,8),'red',x,y-.4,f(x)+.4);}
  for(const x of [cx-1.1,cx,cx+1.1]){beam(x,5.85,f(x)+.35,cx,7.4,f(cx)+.35,.11,'red');}
  add(new T.IcosahedronGeometry(.28,0),'gold',cx,9.48,f(cx));box(cx,8.5,f(cx),.12,.7,.12,'gold');
  box(lo+.5,5.5,27.5,.65,4.35,.75,'brick');box(lo+.5,9.75,27.5,.83,.14,.92,'stone');sign('OCCII',cx-1.0,3.26,f(cx)+.45,.2,'gold');
  // Rear stable/forge stays on the same individual parent without filling neighboring courtyards.
  for(let z=-24;z<18;z+=6)box(-5.95,1.2,z,.15,1.65,1.4,'glass');
 }else if(id==='ketelhuis'){
  body(ring,7.35);const knee=5.6;
  // Two broken pitches of the slate mansard. Ridge follows the seven-bay long elevation.
  for(const [min,max] of [[-9.1,-knee],[-knee,0],[0,knee],[knee,9.1]]){
   const r=clip(clip(ring,'y',min,true),'y',max,false);roof(r,7.35,(_x,z)=>Math.abs(z)>knee?(9.1-Math.abs(z))/(9.1-knee)*3.9:3.9+(1-Math.abs(z)/knee)*2.15);
  }
  // Brick short-end mansard profiles close the actual hall volume below its broken roof.
  for(const side of [-1,1]){const sh=new T.Shape();sh.moveTo(-9.02,7.35);sh.lineTo(-5.6,11.25);sh.lineTo(0,13.4);sh.lineTo(5.6,11.25);sh.lineTo(9.02,7.35);sh.closePath();const g=new T.ShapeGeometry(sh);g.rotateY(side*Math.PI/2);add(g,'brick',side*11.59,0,0);for(const [z0,y0,z1,y1] of [[-9,7.35,-5.6,11.25],[-5.6,11.25,0,13.4],[0,13.4,5.6,11.25],[5.6,11.25,9,7.35]])beam(side*11.72,y0,z0,side*11.72,y1,z1,.23,'stone');}
  for(const back of [false,true]){const z=back?-9.14:9.14,d=back?-1:1;
   for(let i=0;i<7;i++){const cx=-9.6+i*3.2;for(const dx of [-.67,.67]){const x=cx+dx;arch(x,.7,z+d*.02,1.12,4.4,'gold',back);arch(x,.84,z+d*.07,.9,4.1,'glass',back);box(x,.88,z+d*.13,.045,3.9,.06,'frame');for(const y of [1.9,3.15])box(x,y,z+d*.13,.9,.045,.06,'frame');}box(cx+1.4,0,z+d*.07,.45,7.2,.32,'brick');}
   for(const y of [.4,2.0,5.7,6.8,7.15])box(0,y,z,23.1,.18,.25,'gold');for(let x=-11;x<11;x+=.6)box(x,6.45,z+d*.12,.24,.26,.25,'gold');
  }
  // Three coupled round-arched windows on each short end; geometry follows the side plane.
  for(const side of [-1,1])for(const z of [-5,0,5]){const sh=new T.Shape();sh.moveTo(-1.7,0);sh.lineTo(1.7,0);sh.lineTo(1.7,3.5);sh.absarc(0,3.5,1.7,0,Math.PI,false);sh.closePath();const g=new T.ShapeGeometry(sh);g.rotateY(side*Math.PI/2);add(g,'glass',side*11.66,1.0,z);box(side*11.74,1.0,z,.08,5.0,.08,'frame');}
  box(0,0,9.3,2.55,4.75,.14,'dark');box(0,4.7,9.5,3.15,.25,.8,'stone');sign('HET KETELHUIS',-4.25,6.0,9.43,.19,'white');
 }
 else throw new Error(`No independent cinema builder for ${id}`);
}
