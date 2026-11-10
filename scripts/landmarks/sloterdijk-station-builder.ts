import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
type C=Parameters<BuildingTools['add']>[1];

/**
 * Station Amsterdam Sloterdijk (Harry Reijnders, 1983-86): a crossing station. The Zaanlijn/Oude Lijn run east-west at
 * grade (platforms 3-8); the Westelijke Ringspoorbaan (platforms 11/12) and the metro (50/51) cross north-south on
 * viaducts under two long glazed vaults with blue perforated ribs, a grey rounded belly and a red band; the glass hall
 * on the Orlyplein side stands under the white space-frame "table"; a glazed wedge concourse joins the two vaults and
 * the Regenboogpad (the rainbow footbridge) curves along the east vault between two round lift towers.
 *
 * Plan measured on the PDOK 2023 orthophoto (Actueel_orthoHR, 8 px/m, RD 117547-117707 x 489077-489237) in the native
 * frame (x east, z south, metres from the spec anchor 4.8382093, 52.3889971): west vault x -20.3..3.5, z -90..67;
 * east vault x 34.4..56, z -55..45; white table x -56.5..9.75, z -31..20.6 with 4 m corner towers; hall x -52..-19,
 * z -26..16; wedge x 3.5..34.4; rainbow path arc x 60..74, z -64..42, lift towers r 4 m at both ends.
 * Heights from the 3DBAG LoD2.2 planes of pand 0363100012120833 (CC BY 4.0) above its ground: hall roof 19.1, vault
 * crowns 17.7-18.1 and eaves 16.5, table top 23.5-24.7, wedge 9.5-11, hall side wings 10.5.
 * Look from Wikimedia Commons photographs 'Station Amsterdam Sloterdijk 2011', 'Amsterdam Sloterdijk Station in 2019.01-05',
 * 'Station-amsterdam-sloterdijk.jpg' (CC BY-SA) and Gemeente Amsterdam panoramas w01-w12 (CC BY 4.0).
 */
export function buildSloterdijkStation(b:BuildingTools,levels:{hallFloor:number;deck:number}):void{
 const {add,box}=b;
 const F=levels.hallFloor,D=levels.deck;
 function strut(a:number[],q:number[],r:number,c:C='stone',sides=6){const v=new T.Vector3(q[0]-a[0],q[1]-a[1],q[2]-a[2]),g=new T.CylinderGeometry(r,r,v.length(),sides,1,true);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.clone().normalize()));add(g,c,(a[0]+q[0])/2,(a[1]+q[1])/2,(a[2]+q[2])/2);}
 /** Thin box between two points (cheaper than a cylinder: 12 triangles). */
 function beam(a:number[],q:number[],w:number,h:number,c:C){const dx=q[0]-a[0],dy=q[1]-a[1],dz=q[2]-a[2],len=Math.hypot(dx,dy,dz),g=new T.BoxGeometry(w,len,h);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(dx,dy,dz).normalize()));add(g,c,(a[0]+q[0])/2,(a[1]+q[1])/2,(a[2]+q[2])/2);}

 // ---- The two vaults over the north-south viaducts ----
 const EAVE=D+2.6;   // top of the belly's red band: 3DBAG eaves 10.5-11 over the 8 m deck
 function vault(xc:number,w:number,z0:number,z1:number,crown:number,letteringFace:number){
  const half=w/2,len=z1-z0,zc=(z0+z1)/2,n=10;
  // Elliptical profile, vertical at the springing as the ribs rise straight off the belly in the photographs.
  const prof=Array.from({length:n+1},(_,i)=>{const t=Math.PI*(1-i/n);return [xc+half*Math.cos(t),EAVE+(crown-EAVE)*Math.sin(t)];});
  const pos:number[]=[];for(let i=0;i<n;i++){const [x0,y0]=prof[i],[x1,y1]=prof[i+1];pos.push(x0,y0,z0,x1,y1,z0,x1,y1,z1,x0,y0,z0,x1,y1,z1,x0,y0,z1);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.computeVertexNormals();add(g,'glass');
  const inner=g.clone();inner.scale(1,1,1);const idx=inner.getAttribute('position');const flipped:number[]=[];for(let i=0;i<idx.count;i+=3)for(const k of [0,2,1])flipped.push(idx.getX(i+k),idx.getY(i+k),idx.getZ(i+k));
  const gi=new T.BufferGeometry();gi.setAttribute('position',new T.Float32BufferAttribute(flipped,3));gi.computeVertexNormals();add(gi,'glass');
  // Blue perforated ribs every 3.2 m, standing 0.35 m proud of the glass.
  for(let z=z0+1.2;z<z1;z+=3.2)for(let i=0;i<n;i++){const [x0,y0]=prof[i],[x1,y1]=prof[i+1],s=1.06;beam([xc+(x0-xc)*s,EAVE+(y0-EAVE)*1.03+.02,z],[xc+(x1-xc)*s,EAVE+(y1-EAVE)*1.03+.02,z],.32,.55,'blue');}
  // Pale-blue rounded end caps and white crown lattice (the X-braced strip down the middle in the orthophoto).
  for(const [z,s] of [[z0,-1],[z1,1]] as const){
   const cap=new T.Shape();cap.moveTo(prof[0][0]-xc,prof[0][1]);for(const p of prof)cap.lineTo(p[0]-xc,p[1]);cap.closePath();
   const gc=new T.ExtrudeGeometry(cap,{depth:.12,bevelEnabled:false});add(gc,'glass',xc,0,z+(s>0?0:-.12));
   for(let i=0;i<n;i++)beam([prof[i][0],prof[i][1]+.05,z+s*.2],[prof[i+1][0],prof[i+1][1]+.05,z+s*.2],.6,.7,'blue');
  }
  for(const dx of [-2.6,2.6])box(xc+dx,crown-.3,zc,.22,.3,len,'stone');
  for(let z=z0+1.2;z<z1-3;z+=3.2){beam([xc-2.6,crown-.2,z],[xc+2.6,crown-.2,z+3.2],.16,.16,'stone');beam([xc+2.6,crown-.2,z],[xc-2.6,crown-.2,z+3.2],.16,.16,'stone');}
  // Deck slab, grey rounded belly fascia with the red band on both long sides.
  box(xc,D-.6,zc,w-.2,.6,len-.2,'concrete');
  for(const s of [-1,1]){
   const sh=new T.Shape();const o=[[0,EAVE],[0,D+.9],[.3,D+.2],[.9,D-.35],[2.0,D-.7],[3.0,D-.7],[3.0,EAVE]];
   sh.moveTo(o[0][0],o[0][1]);for(const p of o.slice(1))sh.lineTo(p[0],p[1]);sh.closePath();
   const gb=new T.ExtrudeGeometry(sh,{depth:len,bevelEnabled:false});gb.translate(0,0,z0);if(s>0)gb.scale(-1,1,1);
   if(s>0){const p=gb.getAttribute('position');for(let i=0;i<p.count;i+=3){const ax=p.getX(i+1),ay=p.getY(i+1),az=p.getZ(i+1);p.setXYZ(i+1,p.getX(i+2),p.getY(i+2),p.getZ(i+2));p.setXYZ(i+2,ax,ay,az);}gb.computeVertexNormals();}
   add(gb,'greyBrick',xc+s*half,0,0);
   box(xc+s*(half+.02),EAVE-.42,zc,.12,.38,len,'red');
   box(xc+s*(half-.4),EAVE,zc,.9,.12,len,'stone');
  }
  // Round grey concrete columns under the belly, two rows, about 14 m apart.
  for(let z=z0+6;z<z1-3;z+=14)for(const s of [-1,1]){const g2=new T.CylinderGeometry(.85,.85,D-.7,10);add(g2,'concrete',xc+s*(half-3.2),(D-.7)/2,z);}
  // "Amsterdam Sloterdijk" along the belly, white on grey, and the NS double arrow, on the face riders see.
  const fx=xc+letteringFace*(half+.04),ang=letteringFace>0?Math.PI/2:-Math.PI/2;
  b.sign('AMSTERDAM SLOTERDIJK',fx,D+1.0,zc,.16,'white',30,ang);
  nsLogo(xc+letteringFace*(half+.03),D+.85,zc-letteringFace*19,letteringFace);
 }
 /** The NS logo: two opposed white arrows on a blue field, about 2.6 x 1.5 m, on a wall facing +x (out=1) or -x (out=-1). */
 function nsLogo(x:number,y:number,z:number,out:number){
  const angle=out>0?Math.PI/2:-Math.PI/2;
  box(x,y,z,2.4,1.3,.06,'blue',angle);
  for(const [u0,u1,v] of [[-.9,.7,.4],[-.7,.9,.9]] as const)beam([x+out*.06,y+v,z-out*u0],[x+out*.06,y+v,z-out*u1],.16,.1,'white');
 }
 vault(-8.4,23.8,-90,67,18.0,-1);
 vault(45.2,21.6,-55,45,18.0,1);

 // ---- Glass hall under the table ----
 const hx0=-52,hx1=-19,hz0=-26,hz1=16,top=19.1;
 box((hx0+hx1)/2,F,(hz0+hz1)/2,hx1-hx0,.3,hz1-hz0,'concrete');
 box((hx0+hx1)/2,top,(hz0+hz1)/2,hx1-hx0+.4,.3,hz1-hz0+.4,'slate');
 for(let x=hx0+2;x<hx1;x+=3.3)box(x,top+.3,(hz0+hz1)/2,.16,.12,hz1-hz0,'stone');
 for(let z=hz0+2;z<hz1;z+=3.3)box((hx0+hx1)/2,top+.3,z,hx1-hx0,.12,.16,'stone');
 const entranceZ=-4.5,doorW=9;
 for(const [x0,z0,x1,z1] of [[hx0,hz0,hx0,hz1],[hx0,hz1,hx1,hz1],[hx1,hz1,hx1,hz0],[hx1,hz0,hx0,hz0]]){
  const len=Math.hypot(x1-x0,z1-z0),ang=-Math.atan2(z1-z0,x1-x0),cx=(x0+x1)/2,cz=(z0+z1)/2;
  add(new T.PlaneGeometry(len,top-F-.3).rotateY(Math.PI),'glass',cx,(F+top)/2+.15,cz,ang);
  add(new T.PlaneGeometry(len,top-F-.3),'glass',cx,(F+top)/2+.15,cz,ang);
  const n=Math.round(len/3.3);for(let i=0;i<=n;i++){const t=i/n;box(x0+(x1-x0)*t,F+.3,z0+(z1-z0)*t,.16,top-F-.3,.16,'frame',ang);}
  for(const y of [F+3.6,F+7.2,top-.3])box(cx,y,cz,len,.16,.16,'frame',ang);
 }
 // West entrance (Orlyplein): blue door frames, the canopy, the clock and the lettering over the doors (panorama w03).
 const wx=hx0-.15;
 box(wx-1.6,F+3.6,entranceZ,3.2,.35,doorW+6,'stone');
 box(hx0-.12,F+4.6,entranceZ,.24,1.9,24,'slate');
 for(const z of [entranceZ-3,entranceZ,entranceZ+3]){for(const dz of [-1.12,1.12])box(wx,F+.3,z+dz,.13,3.0,.14,'blue');box(wx,F+3.2,z,.13,.15,2.4,'blue');}
 b.sign('AMSTERDAM SLOTERDIJK',hx0-.28,F+5.0,entranceZ,.2,'white',22,-Math.PI/2);
 nsLogo(hx0-.27,F+4.9,entranceZ-12.4,-1);
 {const g=new T.CylinderGeometry(.75,.75,.15,16);g.rotateZ(Math.PI/2);add(g,'stone',wx-.08,F+3.95+.8,entranceZ);}
 // Low glazed wings either side of the hall (3DBAG 10.5 m) and the undercroft frame over the low tracks.
 for(const [z0,z1] of [[-31,-26],[16,21]]){box(-36,F,(z0+z1)/2,30,10.5-F,z1-z0,'glass');box(-36,10.5,(z0+z1)/2,30.4,.3,z1-z0+.4,'slate');}
 if(F>1)for(const x of [-50,-36,-22])for(const z of [-28,0,18])box(x,0,z,.9,F,.9,'concrete');

 // ---- The white space-frame table: box trusses on lattice towers with tree feet ----
 const x0=-56.5,x1=9.75,z0=-31,z1=20.6,lo=20.3,hi=24.0,tw=3.6;
 function boxTruss(a:[number,number],q:[number,number]){
  const len=Math.hypot(q[0]-a[0],q[1]-a[1]),ux=(q[0]-a[0])/len,uz=(q[1]-a[1])/len,px=-uz*tw/2,pz=ux*tw/2,n=Math.ceil(len/3.6);
  for(const s of [-1,1])for(const y of [lo,hi])strut([a[0]+s*px,y,a[1]+s*pz],[q[0]+s*px,y,q[1]+s*pz],.2);
  for(let i=0;i<=n;i++){const t=i/n,x=a[0]+(q[0]-a[0])*t,z=a[1]+(q[1]-a[1])*t;
   for(const s of [-1,1])strut([x+s*px,lo,z+s*pz],[x+s*px,hi,z+s*pz],.13);
   strut([x-px,hi,z-pz],[x+px,hi,z+pz],.12);strut([x-px,lo,z-pz],[x+px,lo,z+pz],.12);
   if(i<n){const t2=(i+1)/n,x2=a[0]+(q[0]-a[0])*t2,z2=a[1]+(q[1]-a[1])*t2;for(const s of [-1,1]){strut([x+s*px,lo,z+s*pz],[x2+s*px,hi,z2+s*pz],.11);}strut([x-px,hi,z-pz],[x2+px,hi,z2+pz],.1);}}
 }
 boxTruss([x0,z0],[x1,z0]);boxTruss([x0,z1],[x1,z1]);boxTruss([x0,z0],[x0,z1]);boxTruss([x1,z0],[x1,z1]);
 for(const x of [x0,x1])for(const z of [z0,z1]){
  // Lattice tower 3.6 m square from 4.4 m to the table, X-braced per 4 m panel (panoramas w05, w10, w11).
  const r=1.8,foot=4.4;
  for(const dx of [-r,r])for(const dz of [-r,r])strut([x+dx,foot,z+dz],[x+dx,lo,z+dz],.17);
  for(let y=foot;y<lo-.5;y+=3.98){for(const s of [-1,1]){strut([x-r,y,z+s*r],[x+r,y+3.98,z+s*r],.11);strut([x+r,y,z+s*r],[x-r,y+3.98,z+s*r],.11);strut([x+s*r,y,z-r],[x+s*r,y+3.98,z+r],.11);strut([x+s*r,y,z+r],[x+s*r,y+3.98,z-r],.11);}
   for(const s of [-1,1]){strut([x-r,y,z+s*r],[x+r,y,z+s*r],.1);strut([x+s*r,y,z-r],[x+s*r,y,z+r],.1);}}
  // Tree foot: one white column on a round plinth, four branches out to the tower corners.
  strut([x,0,z],[x,foot-1.6,z],.42,'stone',10);
  for(const dx of [-r,r])for(const dz of [-r,r])strut([x,foot-1.8,z],[x+dx,foot,z+dz],.2);
  {const g=new T.CylinderGeometry(1.9,2.1,.35,16);add(g,'concrete',x,.17,z);}
 }

 // ---- Glazed wedge concourse between the vaults, over the low tracks ----
 {const s=new T.Shape([new T.Vector2(3.5,-15.6),new T.Vector2(34.4,-21),new T.Vector2(34.4,14),new T.Vector2(3.5,7.5)].map(p=>new T.Vector2(p.x,-p.y)));
  const slab=new T.ExtrudeGeometry(s,{depth:.6,bevelEnabled:false});slab.rotateX(-Math.PI/2);add(slab,'concrete',0,D-.6,0);
  const walls=new T.ExtrudeGeometry(s,{depth:2.4,bevelEnabled:false});walls.rotateX(-Math.PI/2);add(walls,'glass',0,D,0);
  const roof=new T.ExtrudeGeometry(s,{depth:.15,bevelEnabled:false});roof.rotateX(-Math.PI/2);add(roof,'canopyGlass',0,D+2.4,0);
  for(let x=5;x<34;x+=2.6){const t=(x-3.5)/30.9,za=-15.6+(-21+15.6)*t,zb=7.5+(14-7.5)*t;box(x,D+2.55,(za+zb)/2,.14,.14,zb-za,'stone');}
  // Raised ridge of the sloping glass (3DBAG 9.5-11 m).
  box(19,D+2.55,-3.5,30.9,.9,1.2,'canopyGlass');
 }
 // Red steel portal frames of the stair and lift shafts beside the wedge.
 for(const z of [-27,17])for(const dx of [-2.6,2.6]){box(23+dx,0,z,.45,D+4,.45,'red');box(23,D+3.6,z,5.6,.45,.45,'red');}

 // ---- Regenboogpad: rainbow-painted footbridge curving along the east vault, two round glazed lift towers ----
 const path=[[62.5,42.5],[68.8,28.8],[71,0],[68,-30],[60.6,-63.8]];
 const curve=new T.CatmullRomCurve3(path.map(p=>new T.Vector3(p[0],0,p[1])));
 const pts=curve.getSpacedPoints(24),W=6,rain:C[]=['red','ochre','gold','green','blue','pink'];
 for(let i=0;i<pts.length-1;i++){
  const a=pts[i],q=pts[i+1],len=a.distanceTo(q),ang=-Math.atan2(q.z-a.z,q.x-a.x),cx=(a.x+q.x)/2,cz=(a.z+q.z)/2,nx=-(q.z-a.z)/len,nz=(q.x-a.x)/len;
  box(cx,D-.7,cz,len+.05,.7,W,'concrete',ang);
  rain.forEach((c,k)=>{const off=-W/2+W*(k+.5)/rain.length;box(cx+nx*off,D,cz+nz*off,len+.05,.04,W/rain.length,c,ang);});
  for(const s of [-1,1]){box(cx+nx*s*W/2,D,cz+nz*s*W/2,len,1.1,.08,'greyBrick',ang);}
  if(i%3===1)box(cx,0,cz,.7,D-.7,.7,'concrete');
 }
 for(const [x,z] of [[67.5,-62.5],[72.8,39.4]]){
  const g=new T.CylinderGeometry(4,4,D+3,20,1,true);add(g,'glass',x,(D+3)/2,z);
  const roof=new T.SphereGeometry(4.1,20,4,0,Math.PI*2,0,Math.PI/2);roof.scale(1,.35,1);add(roof,'canopyGlass',x,D+3,z);
  for(let i=0;i<10;i++){const t=i*Math.PI/5;box(x+4.05*Math.cos(t),0,z+4.05*Math.sin(t),.18,D+3,.18,'greyBrick');}
   }

 // ---- Low-level island platform canopies (platforms 3-8, east-west at grade) beyond the station ----
 for(const zc of [-25,-3,18])for(const [xa,xb] of [[80,120]]){
  box((xa+xb)/2,3.9,zc,xb-xa,.3,6.4,'slate');box((xa+xb)/2,4.2,zc,xb-xa,.1,6.6,'stone');
  for(let x=xa+3;x<xb;x+=10)box(x,0,zc,.35,3.9,.35,'greyBrick');
 }
}
