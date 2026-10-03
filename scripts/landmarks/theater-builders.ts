import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
/** Original theatre/cultural-house silhouettes; local front is the short +X side. */
export function buildTheaterLandmark(id:string,w:number,d:number,b:BuildingTools){
 type C=Parameters<BuildingTools['add']>[1];const width=d,depth=w,front=depth/2;
 function add(g:T.BufferGeometry,c:C,x=0,y=0,z=0){g.translate(x,y,z);g.rotateY(Math.PI/2);b.add(g,c);}
 function box(x:number,y:number,z:number,a:number,h:number,c:number,colour:C){add(new T.BoxGeometry(a,h,c),colour,x,y+h/2,z);}
 function gable(x:number,y:number,z:number,a:number,h:number,c:number,colour:C){const s=new T.Shape();s.moveTo(-a/2,0);s.lineTo(a/2,0);s.lineTo(0,h);s.closePath();add(new T.ExtrudeGeometry(s,{depth:c,bevelEnabled:false}),colour,x,y,z-c/2);}
 function arch(x:number,y:number,z:number,a:number,h:number,colour:C){const s=new T.Shape();s.moveTo(-a/2,0);s.lineTo(a/2,0);s.lineTo(a/2,h-a/2);s.absarc(0,h-a/2,a/2,0,Math.PI,false);s.closePath();add(new T.ExtrudeGeometry(s,{depth:.14,bevelEnabled:false,curveSegments:6}),colour,x,y,z);}
 function win(x:number,y:number,z:number,a:number,h:number,arched=false){if(arched){arch(x,y-.12,z,a+.35,h+.25,'stone');arch(x,y,z+.15,a,h,'dark');}else{box(x,y-.12,z,a+.35,h+.24,.15,'stone');box(x,y,z+.12,a,h,.13,'dark');}box(x,y,z+.3,.1,h,.07,'stone');box(x,y+h*.55,z+.3,a,.1,.07,'stone');box(x,y-.18,z,a+.5,.15,.4,'stone');}
 function cylinder(x:number,y:number,z:number,r:number,h:number,c:C){add(new T.CylinderGeometry(r,r,h,12),c,x,y+h/2,z);}
 function text(t:string,x:number,y:number,z:number,p:number,c:C){const letters:Record<string,string[]>={A:['010','101','111','101','101'],B:['110','101','110','101','110'],D:['110','101','101','101','110'],E:['111','100','110','100','111'],F:['111','100','110','100','100'],I:['111','010','010','010','111'],K:['101','110','100','110','101'],L:['100','100','100','100','111'],M:['10001','11011','10101','10001','10001'],N:['1001','1101','1011','1001','1001'],O:['111','101','101','101','111'],R:['110','101','110','101','101'],S:['111','100','111','001','111'],T:['111','010','010','010','010'],X:['101','101','010','101','101']};let total=[...t].reduce((v,ch)=>v+(letters[ch]?.[0].length??2)+1,0)*p,u=x-total/2;for(const ch of t){const rows=letters[ch];if(rows)for(let j=0;j<5;j++)for(let k=0;k<rows[j].length;k++)if(rows[j][k]==='1')box(u+k*p,y+(4-j)*p,z,p*.85,p*.85,.08,c);u+=((rows?.[0].length??2)+1)*p;}}
 if(id==='felix-meritis'){
  // The measured plot is long: narrow stair connector and oval concert hall
  // behind the rectangular front house, rather than one oversized canal block.
  const fd=Math.min(31,depth*.4),fz=front-fd/2;
  box(0,0,fz,width*.96,23,fd,'brick');box(0,23,fz,width*.98,.5,fd,'slate');
  box(0,0,-depth*.07,width*.53,19,depth*.36,'brick');box(0,19,-depth*.07,width*.56,.4,depth*.36,'slate');
  let hall=new T.CylinderGeometry(1,1,19,24);hall.scale(width*.45,1,depth*.21);add(hall,'brick',0,9.5,-depth*.29);let roof=new T.CylinderGeometry(1,1,.5,24);roof.scale(width*.46,1,depth*.21);add(roof,'slate',0,19.3,-depth*.29);
  const z=front+.06;box(0,0,z,width,23,.4,'stone');for(const y of [.2,5.8,21.7,23])box(0,y,z+.3,width+.5,.4,.6,'white');
  for(let i=0;i<5;i++){let x=(i-2)*width*.185;win(x,.8,z+.26,width*.14,4.1);win(x,6.5,z+.26,width*.14,7,true);win(x,16,z+.26,width*.14,3.3);}
  for(const x of [-width*.29,-width*.1,width*.1,width*.29]){cylinder(x,5.8,z+.58,.45,15.8,'stone');box(x,5.7,z+.58,1.25,.35,1.25,'white');box(x,21.1,z+.58,1.35,.6,1.35,'white');}
  gable(0,23.3,z+.3,width+1,4.1,1.2,'stone');gable(0,23.6,z+.96,width-1,3.3,.16,'white');text('FELIX MERITIS',0,22,z+.95,.17,'dark');
  // Low faceted observation pavilion and open roof platform behind the pediment.
  box(0,23.5,front-fd*.66,width*.58,.5,fd*.32,'stone');cylinder(0,24,front-fd*.66,3.2,3.5,'stone');add(new T.ConeGeometry(3.5,2.1,8),'slate',0,28.55,front-fd*.66);for(let i=0;i<8;i++){let a=i*Math.PI/4;box(3.15*Math.sin(a),24.8,front-fd*.66+3.15*Math.cos(a),.7,1.7,.12,'dark');}
 }else if(id==='kleine-komedie'){
  box(0,0,0,width*.98,13.5,depth*.97,'brick');gable(0,13.5,0,width*.98,5,depth*.97,'slate');const z=front+.06;
  for(const y of [.1,5.1,9.3,13.3])box(0,y,z,width,.25,.4,'stone');for(let i=0;i<6;i++){let x=(i-2.5)*width*.15;win(x,.5,z,2.1,3.8,true);win(x,5.6,z,2.05,3);win(x,9.8,z,2.05,2.5);}
  box(0,13.6,z,width+.4,.35,.7,'white');text('KLEINE KOMEDIE',0,4.3,z+.45,.22,'red');
  for(const x of [-width*.29,0,width*.29]){box(x,3.4,z+.5,2.8,.15,1.6,'glass');box(x,3.5,z+.5,2.9,.09,1.7,'frame');}
 }else if(id==='de-balie'){
  box(0,0,0,width*.97,10.8,depth*.96,'brick');gable(0,10.8,0,width*.97,5.1,depth*.96,'slate');const z=front+.05;
  for(const y of [.15,4.8,10.5])box(0,y,z,width,.25,.4,'stone');for(let i=0;i<8;i++){const x=(i-3.5)*width*.118;win(x,.7,z,2.4,3.7,true);win(x,5.6,z,2.35,4.05,true);}
  // Two rising facade gables flank the stone-framed central courtroom portal.
  for(const x of [-width*.34,width*.34]){gable(x,10.7,z,8.2,5.4,.8,'brick');gable(x,11,z+.45,7.3,4.8,.2,'stone');gable(x,11.35,z+.55,6.4,4.2,.2,'brick');win(x,11.3,z+.7,1.7,2.5,true);box(x,16,z,.25,1,.25,'stone');}
  box(0,0,z+.25,4.6,5.2,.6,'stone');arch(0,.2,z+.61,3.4,4.4,'dark');box(0,4.9,z+.2,5.4,.3,.9,'stone');text('DE BALIE',0,5.3,z+.65,.25,'white');for(const x of [-4.7,4.7])box(x,3,z+.3,1.2,5.3,.12,'gold');
 }else throw new Error(`No theatre builder for ${id}`);
}
