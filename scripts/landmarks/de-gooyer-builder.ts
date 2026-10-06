import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
/** Original native-scale De Gooyer, source-backed square base, two octagons and open stelling. */
export function buildDeGooyer(_w:number,_d:number,b:BuildingTools):void{
 type C=Parameters<BuildingTools['add']>[1];type P=[number,number,number];
 function beam(a:P,q:P,width:number,c:C,role='structure'){const v=new T.Vector3(...q).sub(new T.Vector3(...a)),g=new T.BoxGeometry(width,v.length(),width);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.normalize()));g.userData.role=role;const m=new T.Vector3(...a).add(new T.Vector3(...q)).multiplyScalar(.5);b.add(g,c,m.x,m.y,m.z)}
 function oct(r:number){const s=new T.Shape();for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4;i?s.lineTo(Math.cos(a)*r,Math.sin(a)*r):s.moveTo(Math.cos(a)*r,Math.sin(a)*r)}s.closePath();return s}
 function frustum(bottom:number,top:number,y:number,h:number,c:C,role:string){const g=new T.CylinderGeometry(top,bottom,h,8,1,true);g.rotateY(Math.PI/8);g.userData.role=role;b.add(g,c,0,y+h/2,0)}
 // BAG rectangle: 10.97m x 11.05m. Masonry ~7m, DHM; octagonal sides retain thatched outline.
 const base=new T.Shape().moveTo(-5.49,-5.52).lineTo(5.49,-5.52).lineTo(5.49,5.52).lineTo(-5.49,5.52).closePath();b.add(openTopPrism(base,0,7),'greyBrick');b.add(upwardRoofPlane(base,7),'stone');
 for(const side of[-1,1]){b.box(0,6.7,side*5.58,11.15,.27,.18,'white');b.box(side*5.56,6.7,0,.18,.27,11.15,'white');
  // Entrance and small ground doors are real exposed panels, subordinate to masonry.
  for(const x of[-3.9,3.9]){b.box(x,.2,side*5.57,1.03,2.3,.10,'white');b.box(x,.3,side*5.64,.78,2.06,.09,'dark')}
  b.box(0,.12,side*5.59,1.65,2.9,.10,'white');b.box(0,.16,side*5.67,1.36,2.65,.08,'green');
  for(const x of[-3.9,0,3.9]){const circle=new T.CircleGeometry(.38,16);circle.userData.role='base-round-window';if(side<0)circle.rotateY(Math.PI);b.add(circle,'glass',x,5.4,side*5.64)}
 }
 frustum(5.72,4.78,7,1.45,'greyBrick','lower-thatch-flare');frustum(4.78,4.78,8.45,9.35,'greyBrick','lower-octagon');
 frustum(4.78,2.75,17.8,10.35,'greyBrick','upper-octagon');
 // Exposed windows, attached per face tangent. Fine counts are photographic approximations.
 for(let i=0;i<8;i++){const a=i*Math.PI/4,r=4.78*Math.cos(Math.PI/8);for(const y of[10.5,14.5]){b.box(Math.sin(a)*(r+.08),y,Math.cos(a)*(r+.08),.62,1.0,.15,'white',a);b.box(Math.sin(a)*(r+.17),y+.08,Math.cos(a)*(r+.17),.43,.82,.10,'glass',a)}const y=23.1,rr=(4.78-(y-17.8)/10.35*2.03)*Math.cos(Math.PI/8);b.box(Math.sin(a)*(rr+.1),y,Math.cos(a)*(rr+.1),.48,.8,.16,'white',a);b.box(Math.sin(a)*(rr+.2),y+.07,Math.cos(a)*(rr+.2),.3,.64,.08,'glass',a)}
 // Gallery is a true annulus, not an opaque octagon across the tower.
 const deck=oct(7.45),hole=oct(4.77);deck.holes.push(new T.Path(hole.getPoints().reverse()));const floor=upwardRoofPlane(deck,17.8);floor.userData.role='gallery-deck';b.add(floor,'dark');
 for(let i=0;i<8;i++){const a=Math.PI/8+i*Math.PI/4,q=a+Math.PI/4;const p:P=[Math.cos(a)*7.45,17.8,Math.sin(a)*7.45],n:P=[Math.cos(q)*7.45,17.8,Math.sin(q)*7.45];beam(p,n,.21,'dark');for(const y of[18.3,18.9])beam([p[0],y,p[2]],[n[0],y,n[2]],.12,'dark');for(let j=0;j<=4;j++){const t=j/4,x=p[0]*(1-t)+n[0]*t,z=p[2]*(1-t)+n[2]*t;beam([x,17.8,z],[x,19,z],.09,'white','gallery-post');if(j<4)beam([x*.64,13.25,z*.64],[x,17.7,z],.13,'white','gallery-brace')}}
 // Rounded thatched boat cap, faceted with upward-owning closed surfaces.
 const cap=new T.SphereGeometry(1,12,6,0,Math.PI*2,0,Math.PI/2);cap.scale(3.25,2.05,3.6);cap.userData.role='cap';b.add(cap,'greyBrick',0,28.15,0);b.add(upwardRoofPlane(oct(3.15),28.15),'frame');
 // Source 2022 close-up: curved cheekboard/apron, white edge and two relief brackets.
 // Its scalloped profile is architectural; the temporary bare yellow patch in that photo
 // is not treated as a permanent paint scheme. Dimensions remain photo calibrated.
 function apron(width:number,bottom:number,top:number,depth:number,z:number,c:C,role:string){
  const half=width/2,s=new T.Shape().moveTo(-half,top).lineTo(half,top)
   .lineTo(half,bottom+.25).bezierCurveTo(half,bottom-.10,half-.3,bottom-.10,half-.48,bottom+.18)
   .bezierCurveTo(half-.7,bottom+.40,.75,bottom+.10,0,bottom+.10)
   .bezierCurveTo(-.75,bottom+.10,-half+.7,bottom+.40,-half+.48,bottom+.18)
   .bezierCurveTo(-half+.3,bottom-.10,-half,bottom-.10,-half,bottom+.25).closePath();
  const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:5});g.userData.role=role;b.add(g,c,0,0,z);
 }
 apron(3.8,27.18,29,.13,3.68,'white','cap-apron-frame');
 apron(3.48,27.40,28.86,.10,3.83,'green','cap-apron-panel');
 for(const side of[-1,1]){
  const bracket=new T.Shape().moveTo(side*.42,27.25).lineTo(side*1.7,27.25)
   .lineTo(side*1.7,26.92).bezierCurveTo(side*1.1,26.88,side*.95,26.4,side*.42,26.5).closePath();
  const g=new T.ExtrudeGeometry(bracket,{depth:.13,bevelEnabled:false,curveSegments:5});g.userData.role='cap-apron-bracket';b.add(g,'white',0,0,3.7);
 }
 // Representative stationary sail position; cap rotates in reality, not a surveyed fixed bearing.
 const hub:P=[0,28.7,5.2],tilt=Math.PI/12,rad=13.3;
 for(let k=0;k<4;k++){const ang=tilt+k*Math.PI/2;function p(r:number,l:number):P{return[Math.sin(ang)*r+Math.cos(ang)*l,28.7+Math.cos(ang)*r-Math.sin(ang)*l,5.2-(Math.cos(ang)*r-Math.sin(ang)*l)*.24]};beam(p(.05,0),p(rad,0),.23,'dark','sail-stock');beam(p(2,.35),p(rad,.35),.13,'white');beam(p(2,1.48),p(rad,1.48),.075,'white');for(let r=2;r<=13.25;r+=.5)beam(p(r,.1),p(r,1.48),.055,'white','sail-lattice');for(const l of[.7,1.1])beam(p(2,l),p(rad,l),.045,'frame')}
 beam([0,28.7,2.7],hub,.42,'frame','windshaft');
 const hubg=new T.CylinderGeometry(.52,.52,.48,12);hubg.rotateX(Math.PI/2);b.add(hubg,'green',...hub);const star=new T.Shape();for(let i=0;i<16;i++){const a=i*Math.PI/8,r=i%2?.13:.34;i?star.lineTo(Math.sin(a)*r,Math.cos(a)*r):star.moveTo(Math.sin(a)*r,Math.cos(a)*r)}star.closePath();b.add(new T.ShapeGeometry(star),'gold',0,28.7,5.455);
 // Rear tail, sheers and winding wheel descend to gallery without filling surrounding ground.
 beam([-4.8,27.9,-1],[4.8,27.9,-1],.26,'green');beam([0,28.8,-3],[0,18.2,-7.0],.3,'frame');for(const x of[-4.8,4.8])beam([x,27.9,-1],[0,18.5,-7],.16,'frame');b.add(new T.TorusGeometry(.65,.08,5,16),'frame',0,18.55,-7.12);
}
