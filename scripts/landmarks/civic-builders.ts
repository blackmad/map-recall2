import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
/** Original civic/religious silhouettes: +Z is the long frontage. Units are metres. */
export function buildCivicLandmark(id:string,w:number,d:number,b:BuildingTools){
 const {add,box,sign}=b;type C=Parameters<BuildingTools['add']>[1];
 function hipped(x:number,y:number,z:number,a:number,c:number,h:number,topX:number,topZ:number,colour:C){
  const v=[[-a/2,0,-c/2],[a/2,0,-c/2],[a/2,0,c/2],[-a/2,0,c/2],[-topX/2,h,-topZ/2],[topX/2,h,-topZ/2],[topX/2,h,topZ/2],[-topX/2,h,topZ/2]];
  const f=[0,4,5,0,5,1,1,5,6,1,6,2,2,6,7,2,7,3,3,7,4,3,4,0,4,7,6,4,6,5,0,1,2,0,2,3];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(f.flatMap(i=>v[i]),3));g.computeVertexNormals();add(g,colour,x,y,z);
 }
 function arched(x:number,y:number,z:number,a:number,h:number,colour:C,angle=0){let s=new T.Shape();s.moveTo(-a/2,0);s.lineTo(a/2,0);s.lineTo(a/2,h-a/2);s.absarc(0,h-a/2,a/2,0,Math.PI,false);s.closePath();add(new T.ExtrudeGeometry(s,{depth:.15,bevelEnabled:false,curveSegments:7}),colour,x,y,z,angle);}
 function multiWindow(x:number,y:number,z:number,a:number,h:number,angle=0){
  function piece(u:number,v:number,z1:number,ww:number,hh:number,dd:number,c:C){const g=new T.BoxGeometry(ww,hh,dd);g.translate(u,v+hh/2,z1);add(g,c,x,y,z,angle);}
  piece(0,-.12,0,a+.35,h+.24,.16,'white');piece(0,0,.12,a,h,.13,'dark');for(let u=-a/2+a/4;u<a/2;u+=a/4)piece(u,0,.23,.08,h,.09,'white');for(let v=h/4;v<h;v+=h/4)piece(0,v,.23,a,.08,.09,'white');
 }
 function column(x:number,y:number,z:number,r:number,h:number){add(new T.CylinderGeometry(r*.85,r,h,12),'stone',x,y+h/2,z);box(x,y,z,r*2.8,.3,r*2.8,'stone');box(x,y+h-.3,z,r*2.8,.3,r*2.8,'stone');for(const dx of [-r*.9,r*.9])for(const dz of [-r*.9,r*.9])add(new T.IcosahedronGeometry(r*.4,0),'stone',x+dx,y+h-.05,z+dz);}
 function clock(x:number,y:number,z:number,r:number,angle=0){const disc=new T.CylinderGeometry(r,r,.16,24).rotateX(Math.PI/2);add(disc,'stone',x,y,z,angle);const face=new T.CylinderGeometry(r*.81,r*.81,.2,24).rotateX(Math.PI/2);add(face,'dark',x,y,z+.1,angle);for(let i=0;i<12;i++){const a=i*Math.PI/6;box(x+Math.sin(a)*r*.67,y+Math.cos(a)*r*.67-.055,z+.23,.065,.11,.06,'gold');}box(x,y,z+.3,.07,r*.65,.07,'gold');box(x,y-.03,z+.31,r*.52,.07,.07,'gold');}
 function curvedRoof(x:number,y:number,z:number,a:number,c:number,h:number){
  // The ridge follows the facade. Pitches fall toward front/back eaves, while
  // their corners lift upward; a small grid preserves the concave low-poly form.
  const cols=12,rows=8,verts:number[]=[];
  function p(i:number,j:number):number[]{const xx=-a/2+a*i/cols,zz=-c/2+c*j/rows,t=Math.abs(zz)/(c/2),u=Math.abs(xx)/(a/2);return [xx,h*(1-t)**1.65+u**4*t*h*.32,zz];}
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){const q=[p(i,j),p(i+1,j),p(i+1,j+1),p(i,j+1)];verts.push(...q[0],...q[2],...q[1],...q[0],...q[3],...q[2]);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.computeVertexNormals();add(g,'gold',x,y,z);
  box(x,y+h,z,a*.96,.16,.18,'red');
  for(const side of [-1,1])for(let i=0;i<=cols;i++){const v=p(i,side<0?0:rows);box(x+v[0],y+v[1]-.18,z+v[2],.22,.28,.4,'red');}
  for(let u=-a/2+.3;u<a/2;u+=.65)box(x+u,y-.42,z,.22,.35,c*.9,'red');
 }

 if(id==='amstelkerk'){
  // Wide low aisles surround the taller square nave. White clapboards and four
  // roof levels are the defining silhouette; there is no invented bell spire.
  const a=w*.97,c=d*.95;box(0,0,0,a,6.6,c,'white');hipped(0,6.6,0,a+.5,c+.5,4.1,a*.59,c*.61,'slate');box(0,10.7,0,a*.57,3.3,c*.59,'white');hipped(0,14,0,a*.61,c*.63,5.1,a*.19,c*.12,'slate');
  for(const side of [-1,1]){const z=side*c/2;for(let y=.5;y<6.6;y+=.44)box(0,y,z+.03*side,a,.045,.045,'stone');for(let x=-a*.4;x<a*.42;x+=5.1)multiWindow(x,1.3,z+side*.09,2.65,4.2,side>0?0:Math.PI);}
  for(const side of [-1,1]){const x=side*a/2;for(let y=.5;y<6.6;y+=.44)box(x,y,0,.045,.045,c,'stone');for(let z=-c*.35;z<c*.4;z+=5)multiWindow(x+side*.09,1.3,z,2.65,4.2,side>0?Math.PI/2:-Math.PI/2);}
  for(const x of [-a*.18,a*.18]){arched(x,11.1,c*.3+.03,2.6,2.5,'white');arched(x,11.25,c*.3+.2,2.25,2.2,'dark');}
  // Small brick canal-side entrance beneath its own dark hip roof.
  box(0,0,c/2-1,7.6,6.9,4.4,'brick');hipped(0,6.9,c/2-1,8,4.9,4.5,.15,.15,'slate');for(const x of [-2.5,0,2.5])multiWindow(x,3.8,c/2+1.28,1.4,2.3);box(0,0,c/2+1.35,2.7,3.2,.25,'stone');box(0,.1,c/2+1.55,2.1,2.8,.15,'dark');sign('AMSTELKERK',0,3.15,c/2+1.6,.09,'gold');box(0,19.1,0,.1,2.8,.1,'white');
 }else if(id==='he-hua-temple'){
  const z=d*.43,gate=w*.61;
  // Stone-and-cream side accommodation, opening around the main palace gate.
  for(const x of [-w*.4,w*.4]){box(x,0,-d*.04,w*.18,9.8,d*.83,'stone');box(x,9.8,-d*.04,w*.19,.25,d*.84,'red');for(const y of [1.1,4.3,7.3])for(const u of [-w*.047,w*.047])multiWindow(x+u,y,z+.03,1.6,1.9);}
  box(0,0,-d*.2,gate,7.1,d*.54,'stone');curvedRoof(0,7.1,-d*.2,gate+1,d*.62,2.8);
  // Three genuine open arched passageways are cut out of the gate wall.
  const shape=new T.Shape();shape.moveTo(-gate/2,0);shape.lineTo(gate/2,0);shape.lineTo(gate/2,6.4);shape.lineTo(-gate/2,6.4);shape.closePath();
  for(const [x,a,h] of [[-gate*.35,3.2,3.8],[0,5.6,5.15],[gate*.35,3.2,3.8]]){const hole=new T.Path();hole.moveTo(x-a/2,0);hole.lineTo(x-a/2,h-a/2);hole.absarc(x,h-a/2,a/2,Math.PI,0,true);hole.lineTo(x+a/2,0);hole.closePath();shape.holes.push(hole);}
  add(new T.ExtrudeGeometry(shape,{depth:.75,bevelEnabled:false,curveSegments:10}),'stone',0,0,z-.45);
  for(const x of [-gate*.35,gate*.35]){box(x,4.15,z,gate*.29,.75,1.05,'red');curvedRoof(x,4.9,z,gate*.32,3.25,1.05);}
  box(0,5.4,z,gate*.46,.75,1.2,'red');curvedRoof(0,6.15,z,gate*.51,3.9,1.45);box(0,7.9,z-.27,gate*.49,.72,.92,'red');curvedRoof(0,8.6,z-.27,gate*.53,3.65,1.35);
  sign('HE HUA TEMPLE',0,5.6,z+.67,.16,'gold');for(const x of [-gate*.26,gate*.26])for(let y=.8;y<5.2;y+=.7)box(x,y,z+.5,.18,.26,.08,'red');for(let i=0;i<6;i++)box(0,i*.23,z+.52+(5-i)*.4,5.6,.23,.4,'stone');
  // Simplified ridge beasts and lifted corner finials retain the roof silhouette
  // without copying decorative reference pixels or inventing unreadable text.
  for(const x of [-gate*.24,gate*.24]){add(new T.IcosahedronGeometry(.22,0),'gold',x,10.25,z-.27);box(x,10.15,z-.27,.12,.6,.12,'gold');}
 }else if(id==='haarlemmerpoort'){
  // Open porticos on both sides, with inhabited side pavilions. No solid box
  // through the central gate: the passage remains visibly open at street level.
  const passage=w*.48,wing=(w-passage)/2;
  for(const x of [-(passage+wing)/2,(passage+wing)/2]){box(x,0,0,wing*.98,10.7,d*.94,'stone');for(const z of [-d*.48,d*.48]){multiWindow(x,1.6,z,2.1,3.4,z>0?0:Math.PI);multiWindow(x,6.6,z,2.1,1.6,z>0?0:Math.PI);}box(x,10.7,0,wing+1,.55,d+.2,'stone');}
  box(0,10.35,0,w+.2,1.4,d*.95,'stone');box(0,11.75,0,w+.6,.55,d+.4,'stone');box(0,12.3,0,passage+1.5,1.85,d*.81,'stone');box(0,14.15,0,passage+2,.2,d*.84,'slate');
  for(const side of [-1,1]){const z=side*d*.42;for(const x of [-passage*.42,-passage*.15,passage*.15,passage*.42])column(x,.1,z,.52,10.25);for(let x=-w*.48;x<=w*.48;x+=.8)box(x,11.5,z+side*.85,.28,.5,.22,'stone');}
  // Clock cartouches facing both approaches; inset dark circular dials.
  for(const side of [-1,1]){const z=side*d*.491;box(0,12.2,z,4.4,1.8,.23,'stone');add(new T.CylinderGeometry(1.25,1.25,.15,20).rotateX(Math.PI/2),'stone',0,13.85,z);if(side>0)clock(0,13.85,z+.13,1.15);else{const g=new T.CylinderGeometry(.94,.94,.2,20).rotateX(Math.PI/2);add(g,'dark',0,13.85,z-.14);box(0,13.85,z-.28,.07,.75,.08,'gold');box(0,13.82,z-.29,.6,.07,.08,'gold');}}
 }else throw new Error(`No civic builder for ${id}`);
}
