import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './huize-frankendael-footprints.json';
/** Original native metre reconstruction. +X NW, +Z NE main frontage. */
export function buildHuizeFrankendael(_w:number,_d:number,b:BuildingTools):void {
 type P=[number,number];type V=[number,number,number];type C=Parameters<BuildingTools['add']>[1];
 const ring=source.localRing.slice(0,-1) as P[];
 function clip(r:P[],axis:0|1,value:number,positive:boolean):P[]{const out:P[]=[];for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length],inside=(p:P)=>positive?p[axis]>=value:p[axis]<=value,aa=inside(a),qq=inside(q);if(aa)out.push(a);if(aa!==qq){const t=(value-a[axis])/(q[axis]-a[axis]);out.push([a[0]+t*(q[0]-a[0]),a[1]+t*(q[1]-a[1])]);}}return out;}
 function shape(r:P[]){return new T.Shape(r.map(p=>new T.Vector2(...p)));}
 function shell(r:P[],height:number,c:C='brick'){const g=openTopPrism(shape(r),0,height);g.userData.role='wall';b.add(g,c);}
 function surface(points:V[],c:C,role='roof',up=true){const values:number[]=[];for(let i=1;i<points.length-1;i++){const a=points[0];let q=points[i],r=points[i+1];if(up&&new T.Vector3(...q).sub(new T.Vector3(...a)).cross(new T.Vector3(...r).sub(new T.Vector3(...a))).y<0)[q,r]=[r,q];values.push(...a,...q,...r);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();g.userData.role=role;b.add(g,c);}
 function roof(x0:number,x1:number,z0:number,z1:number,eaves:number,crest:number,inset:number){const a:V[]=[[x0,eaves,z0],[x1,eaves,z0],[x1,eaves,z1],[x0,eaves,z1]],q:V[]=[[x0+inset,crest,z0+inset],[x1-inset,crest,z0+inset],[x1-inset,crest,z1-inset],[x0+inset,crest,z1-inset]];for(let i=0;i<4;i++)surface([a[i],a[(i+1)%4],q[(i+1)%4],q[i]],'slate');surface(q,'slate');}

 // An elevation assembly has u along its wall and normal (sin angle, cos angle).
 function faceBox(cx:number,y:number,cz:number,u:number,v:number,w:number,h:number,d:number,c:C,a=0,role='detail',offset=0){const g=new T.BoxGeometry(w,h,d);g.translate(u,v+h/2,offset);g.rotateY(a);g.translate(cx,y,cz);g.userData.role=role;b.add(g,c);}
 function opening(x:number,y:number,z:number,w:number,h:number,cols:number,rows:number,a=0,door=false){
  faceBox(x,y,z,0,0,w,h,.065,door?'dark':'glass',a,'glazing');
  for(const u of[-w/2-.065,w/2+.065])faceBox(x,y,z,u,-.09,.11,h+.18,.14,'white',a,'window-frame',.04);
  for(const v of[-.09,h])faceBox(x,y,z,0,v,w+.22,.11,.18,'white',a,'window-frame',.04);
  for(let i=1;i<cols;i++)faceBox(x,y,z,-w/2+i*w/cols,0,.04,h,.085,'frame',a,'mullion',.07);
  for(let i=1;i<rows;i++)faceBox(x,y,z,0,i*h/rows,w,.045,.085,'frame',a,'mullion',.07);
  faceBox(x,y,z,0,-.13,w+.30,.09,.23,'stone',a,'sill',.05);
 }
 // Curved aperture and perimeter share the same sampled arch. No rectangular
 // glazing or horizontal lintel may erase the rounded head in first-hit views.
 function archPath(w:number,h:number,rise:number,base=0){const q=new T.Shape();q.moveTo(-w/2,base);q.lineTo(w/2,base);q.lineTo(w/2,h-rise);q.absellipse(0,h-rise,w/2,rise,0,Math.PI,false,0);q.closePath();return q;}
 function faceShape(s:T.Shape,x:number,y:number,z:number,depth:number,c:C,a:number,role:string,offset=0){const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:16});g.translate(0,0,offset);g.rotateY(a);g.translate(x,y,z);g.userData.role=role;b.add(g,c);}
 function archedOpening(x:number,y:number,z:number,w:number,h:number,rise:number,cols:number,rows:number,a=0,role='arched'){
  const glass=archPath(w,h,rise);faceShape(glass,x,y,z,.035,'glass',a,role+'-glazing');
  const perimeter=archPath(w+.22,h+.11,rise+.11,-.09);perimeter.holes.push(new T.Path(glass.getPoints(32)));faceShape(perimeter,x,y,z,.12,'white',a,role+'-frame',.035);
  for(let i=1;i<cols;i++){const u=-w/2+i*w/cols,top=h-rise+rise*Math.sqrt(1-(2*u/w)**2);faceBox(x,y,z,u,0,.04,top,.045,'frame',a,'mullion',.07);}
  for(let i=1;i<rows;i++)faceBox(x,y,z,0,i*(h-rise)/rows,w,.045,.045,'frame',a,'mullion',.07);
  faceBox(x,y,z,0,-.13,w+.30,.09,.23,'stone',a,'sill',.05);
 }
 function cornice(x:number,z:number,w:number,d:number,y:number){b.box(x,y,z,w+.40,.18,d+.38,'white');b.box(x,y+.18,z,w+.62,.13,d+.60,'stone');b.box(x,y+.31,z,w+.77,.11,d+.77,'white');}
 const middle=clip(clip(clip(ring,0,-6.131,true),0,6.09,false),1,-4.265,true);
 // The rear bay uses its six native vertices; clipping the full outline would
 // promote millimetre-deep wing-edge slivers into full-height rear walls.
 const rear=ring.slice(6,12),left=clip(ring,0,-6.131,false),right=clip(ring,0,6.09,true);
 shell(middle,11.6);shell(left,6);shell(right,6);shell(rear,11.45);
 // Wings preserve the surveyed offsets and central pavilion's 0.7m projection.
 cornice(-11.18,-.17,10.08,8.10,5.68);cornice(11.13,-.30,10.05,8.10,5.68);
 roof(-16.52,-5.97,-4.49,4.07,6.10,8.60,1.90);roof(5.95,16.51,-4.56,3.97,6.10,8.60,1.90);
 cornice(-.02,.10,12.25,8.73,11.18);roof(-6.45,6.40,-4.51,4.76,11.60,14.60,2.14);
 const cap=upwardRoofPlane(shape(rear),11.45);cap.userData.role='roof';b.add(cap,'slate');
 // The cut-corner garden-room projection is part of the real BAG polygon.
 for(let i=0;i<rear.length;i++){const p=rear[i],q=rear[(i+1)%rear.length],dx=q[0]-p[0],dz=q[1]-p[1],l=Math.hypot(dx,dz);if(l<1||p[1]>-4.27&&q[1]>-4.27)continue;const a=-Math.atan2(dz,dx),nx=Math.sin(a),nz=Math.cos(a);const cx=(p[0]+q[0])/2,cz=(p[1]+q[1])/2;for(const y of[10.9,11.2])faceBox(cx,y,cz,0,0,l+.12,.17,.28,'stone',a,'attic',.07);}
 // Front plinth and corner/riser pilasters are relief, with no wall caps.
 for(const x of[-5.98,5.95]){b.box(x,.2,4.52,.38,10.98,.12,'brick');for(const y of[.45,5.90,10.92])b.box(x,y,4.62,.49,.12,.13,'stone');}
 for(const x of[-3.70,3.65]){opening(x,.20,4.60,1.88,.92,4,2);opening(x,2.0,4.60,1.89,3.36,4,4);opening(x,6.89,4.60,1.89,2.89,3,4);}
 opening(-.02,6.98,4.62,1.61,2.78,3,4);
 // Central raised double panel door and six-pane transom.
 opening(-.02,1.62,4.64,1.67,2.55,2,1,0,true);archedOpening(-.02,4.19,4.66,1.67,1.30,.27,3,2,0,'front-transom');
 for(const s of[-1,1])for(const y of[1.88,2.80])faceBox(-.02,y,4.71,s*.41,0,.57,.63,.035,'dark',0,'door-panel',.03);
 // Seven broad hardstone steps, landing and slender wrought iron railings.
 for(let i=0;i<7;i++){const rise=(i+1)*1.62/7,z=6.80-i*.29;b.box(-.02,0,z,2.56,rise,.31,'concrete');}
 b.box(-.02,0,4.98,2.56,1.62,.61,'concrete');
 function beam(a:V,q:V,r:number,c:C,role='detail'){const d=new T.Vector3(...q).sub(new T.Vector3(...a)),g=new T.CylinderGeometry(r,r,d.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));g.userData.role=role;const m=new T.Vector3(...a).add(new T.Vector3(...q)).multiplyScalar(.5);b.add(g,c,m.x,m.y,m.z);}
 for(const x of[-1.30,1.26]){beam([x,.95,6.82],[x,2.63,4.80],.04,'frame');for(let i=0;i<5;i++){const z=6.66-i*.42,y=.28+i*.34;beam([x,y,z],[x,y+.90,z],.035,'frame');}b.box(x,2.47,4.80,.08,.08,.42,'frame');}
 // Pale Lodewijk XV surrounds: original curves, festoons and rocaille relief.
 function scroll(x:number,y:number,z:number,s:number,a=0){const pts:V[]=[];for(let i=0;i<=12;i++){const t=i/12*Math.PI*1.65,r=.15+.14*i/12;pts.push([x+s*r*Math.cos(t),y+r*Math.sin(t),z]);}for(let i=1;i<pts.length;i++){const g=new T.CylinderGeometry(.055,.055,new T.Vector3(...pts[i]).distanceTo(new T.Vector3(...pts[i-1])),5);const d=new T.Vector3(...pts[i]).sub(new T.Vector3(...pts[i-1]));g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));g.translate(...new T.Vector3(...pts[i]).add(new T.Vector3(...pts[i-1])).multiplyScalar(.5).toArray() as V);g.rotateY(a);g.userData.role='rococo';b.add(g,'stone');}}
 for(const s of[-1,1]){
  b.box(s*1.10,1.55,4.72,.24,3.91,.22,'stone');b.box(s*1.30,1.62,4.74,.15,3.60,.27,'white');
  for(const y of[5.42,6.25,7.15,8.25,9.38,10.25])scroll(s*1.0,y,4.83,s);
  b.box(s*.91,6.83,4.74,.12,3.01,.18,'stone');
  b.add(new T.IcosahedronGeometry(.19,0),'stone',s*.58,10.19,4.85);
 }
 // Broad carved cheek silhouettes surround the upper sash without covering it.
 for(const side of[-1,1]){const cheek=new T.Shape();cheek.moveTo(.88,6.90);cheek.bezierCurveTo(1.43,6.82,1.48,7.21,1.25,7.58);cheek.bezierCurveTo(.98,8.01,1.29,8.63,1.18,9.04);cheek.bezierCurveTo(1.42,9.49,1.12,9.85,.88,9.82);cheek.lineTo(.88,6.90);const g=new T.ExtrudeGeometry(cheek,{depth:.065,bevelEnabled:false});g.scale(side,1,1);if(side<0){const flat=g.index?g.toNonIndexed():g,p=flat.getAttribute('position');for(let i=0;i<p.count;i+=3)for(let a=0;a<3;a++){const u=p.getComponent(i+1,a);p.setComponent(i+1,a,p.getComponent(i+2,a));p.setComponent(i+2,a,u);}flat.computeVertexNormals();b.add(flat,'stone',-.02,0,4.77);}else b.add(g,'stone',-.02,0,4.77);}
 for(const y of[5.50,5.75,6.54,9.95]){b.box(0,y,4.77,2.65,.17,.29,'stone');}
 // Curved pediment above the door, below the upper window.
 const arch=new T.Shape();arch.moveTo(-1.42,0);arch.lineTo(1.42,0);arch.bezierCurveTo(.98,.43,.60,.55,0,.55);arch.bezierCurveTo(-.60,.55,-.98,.43,-1.42,0);const archg=new T.ExtrudeGeometry(arch,{depth:.18,bevelEnabled:false});archg.userData.role='rococo';b.add(archg,'stone',-.02,5.77,4.80);
 for(const x of[-5.85,-1.38,1.34,5.81]){b.box(x,10.76,4.76,.29,.48,.41,'stone');b.add(new T.IcosahedronGeometry(.18,0),'stone',x,10.87,5.02);}
 // Wing fronts: real carriage doors and the front left blind niche.
 for(const x of[-12.67,12.63]){opening(x,.18,x<0?3.96:3.84,2.18,2.65,2,1,0,true);opening(x,2.85,x<0?3.98:3.86,2.18,.72,4,1);for(const s of[-1,1])faceBox(x,.15,x<0?4.03:3.91,s*1.26,0,.39,3.0,.08,'dark',0,'shutter');}
 // NW coachhouse has its additional narrow door; SE blind panel is intentionally masonry.
 opening(8.20,.18,3.85,1.14,2.65,2,1,0,true);opening(8.20,2.85,3.86,1.14,.72,3,1);
 b.box(-8.18,.45,3.97,1.40,2.66,.035,'brick');for(const x of[-8.89,-7.47])b.box(x,.45,4.0,.05,2.70,.055,'stone');
 // Four dormers and central/side dormers project beyond the enclosing roof slope.
 function dormer(x:number,y:number,z:number,w:number,a=0,ornate=false,rows=2){const depth=1.65;faceBox(x,y,z,0,0,w+.42,1.72,depth,'stone',a,'dormer-body',-depth/2+.04);opening(x+Math.sin(a)*.12,y+.21,z+Math.cos(a)*.12,w,1.17,4,rows,a);for(const s of[-1,1]){faceBox(x,y,z,s*(w/2+.20),0,.16,1.57,.21,'white',a,'dormer-frame',.11);if(ornate)scroll(x+s*(w/2+.37),y+.44,z+.12,s,a);}
  faceBox(x,y,z,0,1.52,w+.60,.13,.40,'white',a,'dormer-cornice',.13);
  // Slate top, bounded and explicitly upward, transformed into the wall's orientation.
  const vv:V[]=[[-w/2-.24,y+1.65,-1.60],[w/2+.24,y+1.65,-1.60],[w/2+.24,y+1.65,.20],[-w/2-.24,y+1.65,.20]].map(p=>{const v=new T.Vector3(p[0],p[1],p[2]).applyAxisAngle(new T.Vector3(0,1,0),a);return[v.x+x,v.y,v.z+z] as V});surface(vv,'slate');
 }
 for(const x of[-13.43,-8.96,8.89,13.39])dormer(x,6.12,x<0?3.78:3.66,1.05,0,true);
 // Principal dormer: rounded sash, continuous sculpted head and broad volutes.
 // Operator current page / 2022-04-17 photo agree. Dimensions are approximate.
 const dormerBody=archPath(1.76,1.66,.37);
 faceShape(dormerBody,-.02,11.64,3.08,1.60,'stone',0,'central-dormer-body');
 archedOpening(-.02,11.85,4.78,1.40,1.17,.22,4,3,0,'central-dormer');
 for(const side of[-1,1]){
  const cheek=new T.Shape();const m=(x:number,y:number)=>cheek.moveTo(side*x,y),l=(x:number,y:number)=>cheek.lineTo(side*x,y),c=(a:number,b:number,d:number,e:number,f:number,g:number)=>cheek.bezierCurveTo(side*a,b,side*d,e,side*f,g);
  m(.79,11.64);l(1.73,11.64);c(1.77,11.98,1.70,12.33,1.44,12.35);c(1.18,12.39,1.19,12.14,1.31,12.08);c(1.43,12.02,1.48,12.16,1.42,12.20);c(1.19,12.05,1.02,12.54,.94,12.88);c(.90,13.14,.92,13.28,.81,13.30);l(.79,11.64);
  faceShape(cheek,-.02,0,4.80,.15,'stone',0,'central-dormer-volute');
  scroll(-.02+side*1.43,11.98,5.005,side);
 }
 // Original bounded rocaille head: broad lobes and shallow curved crown,
 // joined to the arched perimeter, never a detached pointed/triangular crest.
 const crown=new T.Shape();crown.moveTo(-.98,13.04);crown.bezierCurveTo(-1.08,13.29,-.88,13.48,-.66,13.39);crown.bezierCurveTo(-.72,13.61,-.39,13.57,-.28,13.65);crown.bezierCurveTo(-.20,13.78,.20,13.78,.28,13.65);crown.bezierCurveTo(.39,13.57,.72,13.61,.66,13.39);crown.bezierCurveTo(.88,13.48,1.08,13.29,.98,13.04);crown.lineTo(.72,13.03);crown.bezierCurveTo(.50,13.39,-.50,13.39,-.72,13.03);crown.closePath();
 faceShape(crown,-.02,0,4.81,.17,'stone',0,'central-dormer-crown');
 faceBox(-.02,11.58,4.83,0,0,3.53,.14,.30,'white',0,'central-dormer-base');
 for(const s of[-1,1])dormer(s*6.27,11.72,.10,1.46,s*Math.PI/2,false,4);
 // Open pierced balustrade around the actual truncated roof plateau.
 const xa=-4.23,xb=4.18,za=-2.28,zb=2.57;
 function baluster(x:number,z:number,a=0){const s=new T.Shape();s.moveTo(-.085,0);s.lineTo(.085,0);s.lineTo(.06,.14);s.lineTo(.11,.29);s.lineTo(.08,.45);s.lineTo(.05,.59);s.lineTo(.10,.72);s.lineTo(-.10,.72);s.lineTo(-.05,.59);s.lineTo(-.08,.45);s.lineTo(-.11,.29);s.lineTo(-.06,.14);s.closePath();const g=new T.ExtrudeGeometry(s,{depth:.065,bevelEnabled:false});g.rotateY(a);g.userData.role='roof-baluster';b.add(g,'white',x,14.78,z);}
 for(const z of[za,zb]){b.box((xa+xb)/2,14.64,z,xb-xa,.15,.16,'white');b.box((xa+xb)/2,15.51,z,xb-xa,.13,.18,'white');for(let x=xa+.30;x<xb-.16;x+=.34)baluster(x,z);}
 for(const x of[xa,xb]){b.box(x,14.64,(za+zb)/2,.16,.15,zb-za,'white');b.box(x,15.51,(za+zb)/2,.18,.13,zb-za,'white');for(let z=za+.28;z<zb-.16;z+=.34)baluster(x,z,Math.PI/2);}
 for(const x of[xa,xb])for(const z of[za,zb]){b.box(x,14.60,z,.66,1.03,.61,'white');for(const y of[14.68,15.30])b.box(x,y,z+.32,.44,.055,.045,'stone');}
 // Front pair are chimney casings with shaped lead caps and real vanes.
 for(const x of[xa,xb]){b.box(x,15.63,zb,.84,.10,.79,'stone');roof(x-.41,x+.41,zb-.38,zb+.38,15.73,16.02,.26);b.add(new T.ConeGeometry(.10,.24,6),'slate',x,16.15,zb);beam([x,16.23,zb],[x,16.63,zb],.018,'frame');b.box(x+.12,16.48,zb,.24,.085,.027,'gold');}
 // Central armorial panel, bounded abstract relief without invented lettering.
 b.box(-.02,14.83,zb+.025,.72,.67,.08,'stone');b.add(new T.IcosahedronGeometry(.13,0),'white',-.02,15.18,zb+.13);beam([-.24,15.1,zb+.12],[.18,15.31,zb+.12],.045,'white');
 // Rear garden bay openings: central plane and the broad flanking windows.
 for(const x of[-4.14,4.10]){opening(x,.16,-4.37,2.20,.94,4,2,Math.PI);opening(x,2.01,-4.37,2.20,3.31,5,4,Math.PI);opening(x,6.93,-4.37,2.20,2.72,4,4,Math.PI);}
 opening(-.08,.15,-8.47,1.50,.96,4,2,Math.PI);opening(-.08,2.02,-8.47,1.50,3.30,3,5,Math.PI);opening(-.08,6.94,-8.47,1.50,2.69,3,4,Math.PI);
 // Wing rear doors/long 9-pane transoms supported by register and garden photograph.
 for(const x of[9.15,11.27,13.39]){opening(x,.15,-4.40,1.83,2.78,2,1,Math.PI,true);opening(x,2.96,-4.41,1.83,.79,3,3,Math.PI);}
 opening(-11.19,.15,-4.32,2.45,2.82,3,1,Math.PI,true);opening(-11.19,2.98,-4.33,2.45,.72,3,2,Math.PI);
 // Exposed end elevations are genuine garden elevations, never party walls.
 // NW end empire doorway: register-supported glazed double leaf, half-round
 // fanlight with two diagonal bars, pilasters and cornice. Current end photo
 // unavailable: approximate placement retained, no invented extra end openings.
 opening(16.30,.32,-.15,1.90,2.50,2,2,Math.PI/2);
 archedOpening(16.32,2.86,-.15,1.90,.95,.95,1,1,Math.PI/2,'nw-empire-transom');
 for(const side of[-1,1]){
  faceBox(16.30,.23,-.15,side*1.20,0,.22,3.75,.18,'stone',Math.PI/2,'nw-empire-pilaster',.10);
  faceBox(16.30,3.79,-.15,side*1.20,0,.32,.16,.27,'white',Math.PI/2,'nw-empire-capital',.13);
  // local fanlight bars rise diagonally from the central springing point.
  const g=new T.CylinderGeometry(.025,.025,1,6),a=new T.Vector3(0,2.86,.11),q=new T.Vector3(side*.672,3.532,.11),d=q.clone().sub(a);g.scale(1,d.length(),1);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));g.translate(...a.add(q).multiplyScalar(.5).toArray() as V);g.rotateY(Math.PI/2);g.translate(16.32,0,-.15);g.userData.role='nw-empire-diagonal';b.add(g,'frame');
 }
 faceBox(16.30,3.96,-.15,0,0,2.87,.16,.32,'white',Math.PI/2,'nw-empire-cornice',.14);
 faceBox(16.30,4.12,-.15,0,0,3.02,.11,.38,'stone',Math.PI/2,'nw-empire-cornice',.14);for(const z of[-2.66,2.33])opening(16.30,1.01,z,1.32,2.22,2,3,Math.PI/2);
 for(const z of[-2.52,.02]){opening(-16.36,.2,z,1.50,2.71,2,1,-Math.PI/2,true);opening(-16.36,2.96,z,1.50,.72,3,2,-Math.PI/2);}opening(-16.36,3.0,2.48,1.1,.66,3,2,-Math.PI/2);
}
