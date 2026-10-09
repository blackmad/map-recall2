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
  // Former Huis van Bewaring court building (1890s Dutch Renaissance Revival), read from the
  // east panorama: pale sandstone, two storeys over a barred basement, seven axes (wide mullioned
  // pavilion bays at both ends, five regular bays, central arched portal), a crowning cornice,
  // two stepped gables, a steep slate roof with three dormers.
  const wd=width*.98,zf=depth*.49,eave=10.6,s='stone' as C;
  box(0,0,0,wd,eave,depth*.98,s);
  for(const y of [1.1,5.3])box(0,y,zf+.12,wd+.2,.3,.24,s);box(0,eave-.5,zf+.22,wd+.4,.55,.44,s);box(0,0,zf+.07,wd+.1,1.1,.14,'concrete');
  // Roof: pavilion gable roofs run back; the central hip is a prism whose ridge runs along the front.
  const rd=depth*.98,ridgeH=14.3,hipHalf=rd/2;
  for(const x of [-13.2,13.2]){const g=new T.Shape();g.moveTo(-3.3,0);g.lineTo(3.3,0);g.lineTo(0,5.7);g.closePath();add(new T.ExtrudeGeometry(g,{depth:rd,bevelEnabled:false}),'slate',x,eave,-rd/2);}
  {const p=new T.Shape();p.moveTo(-hipHalf,0);p.lineTo(hipHalf,0);p.lineTo(hipHalf-6,ridgeH-eave);p.lineTo(-hipHalf+6,ridgeH-eave);p.closePath();const g=new T.ExtrudeGeometry(p,{depth:20.2,bevelEnabled:false});g.translate(0,0,-10.1);g.rotateY(Math.PI/2);add(g,'slate',0,eave,0);}
  const axes=[-8.2,-4.4,0,3.9,7.8];
  const row=(x:number,wide:boolean)=>{const ww=wide?4.4:2.5;
   win(x,1.7,zf+.1,ww,3.1,true);win(x,6.2,zf+.1,ww,3.4,true);
   box(x,.35,zf+.16,wide?3:1.6,.6,.1,'dark');};
  row(-13.4,true);row(13.1,true);
  for(const x of axes){if(x!==0)row(x,false);else{win(0,6.2,zf+.1,2.5,3.4,true);}}
  // Central portal with small pediment and name plate
  box(0,0,zf+.3,4.2,4.6,.5,s);arch(0,.9,zf+.56,2.5,3.4,'dark');box(0,4.5,zf+.35,4.8,.35,.8,s);gable(0,4.85,zf+.55,4.8,1.2,.5,s);
  box(0,5.3,zf+.85,3.4,.55,.1,'dark');text('DE BALIE',0,5.33,zf+.93,.09,'white');
  // Stepped Dutch-Renaissance gables above the pavilion bays
  for(const x of [-13.2,13.2]){const g=new T.Shape(),pts:[number,number][]=[[3.3,0],[3.3,.8],[2.7,1.4],[2.7,2.4],[2.0,3.0],[2.0,3.9],[1.3,4.5],[1.3,5.3],[.6,5.9],[.6,6.7],[0,7.3]];
   g.moveTo(3.3,0);for(const [px,py] of pts.slice(1))g.lineTo(px,py);for(const [px,py] of pts.slice(1,-1).reverse())g.lineTo(-px,py);g.lineTo(-3.3,0);g.closePath();
   add(new T.ExtrudeGeometry(g,{depth:.7,bevelEnabled:false}),s,x,eave,zf-.2);
   win(x,eave+.8,zf+.55,1.2,2.2,true);add(new T.CylinderGeometry(.45,.45,.12,10).rotateX(Math.PI/2),'dark',x,eave+4.2,zf+.55);
   box(x,eave+7.2,zf+.2,.35,1.3,.35,s);box(x,eave+8.4,zf+.2,.08,.9,.08,'dark');}
  // Three dormers on the central hip
  for(const x of [-6,0,6]){const z=zf-2.3;box(x,eave+1.3,z,1.5,1.9,1.1,s);box(x,eave+1.7,z+.56,.9,1.2,.08,'dark');gable(x,eave+3.2,z,1.9,.9,1.2,'slate');}
 }else throw new Error(`No theatre builder for ${id}`);
}
