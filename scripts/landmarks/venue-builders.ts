import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
/** Original silhouettes and facade details; no imported mesh or image textures. */
export function buildVenueLandmark(id:string,w:number,d:number,b:BuildingTools){
 const shortFront=id==='embassy-free-mind'||id==='the-movies'||id==='delamar';
 const angle=shortFront?Math.PI/2:0, width=shortFront?d:w, depth=shortFront?w:d;
 type Colour=Parameters<BuildingTools['add']>[1];
 function add(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0){g.translate(x,y,z);g.rotateY(angle);b.add(g,c);}
 function box(x:number,y:number,z:number,a:number,h:number,c:number,colour:Colour){add(new T.BoxGeometry(a,h,c),colour,x,y+h/2,z);}
 function gable(x:number,y:number,z:number,a:number,h:number,c:number,colour:Colour){const s=new T.Shape();s.moveTo(-a/2,0);s.lineTo(a/2,0);s.lineTo(0,h);s.closePath();add(new T.ExtrudeGeometry(s,{depth:c,bevelEnabled:false}),colour,x,y,z-c/2);}
 function arch(x:number,y:number,z:number,a:number,h:number,colour:Colour){const s=new T.Shape();s.moveTo(-a/2,0);s.lineTo(a/2,0);s.lineTo(a/2,h-a/2);s.absarc(0,h-a/2,a/2,0,Math.PI,false);s.closePath();add(new T.ExtrudeGeometry(s,{depth:.12,bevelEnabled:false,curveSegments:6}),colour,x,y,z);}
 function win(x:number,y:number,z:number,a:number,h:number,arched=false){if(arched){arch(x,y-.15,z,a+.35,h+.3,'stone');arch(x,y,z+.15,a,h,'dark');}else{box(x,y-.13,z,a+.35,h+.26,.15,'stone');box(x,y,z+.12,a,h,.13,'dark');}box(x,y,z+.28,.1,h,.08,'stone');box(x,y+h*.5,z+.28,a,.1,.08,'stone');box(x,y-.2,z,a+.5,.18,.4,'stone');}
 function sphere(x:number,y:number,z:number,r:number,colour:Colour,sx=1,sy=1,sz=1){const g=new T.IcosahedronGeometry(r,1);g.scale(sx,sy,sz);add(g,colour,x,y,z);}
 function sign(text:string,x:number,y:number,z:number,pixel:number,c:Colour){
  // BuildingTools lettering is emitted in global axes, so rotate the elevation by
  // collecting it through a tiny rotated add/box adapter for the short frontage.
  if(!shortFront)b.sign(text,x,y,z,pixel,c);
  else { // Short-frontage lettering is formed from authored geometry below.
   const glyph:Record<string,string[]>={D:['110','101','101','101','110'],L:['100','100','100','100','111'],A:['010','101','111','101','101'],R:['110','101','110','101','101'],T:['111','010','010','010','010'],H:['101','101','111','101','101'],E:['111','100','110','100','111'],M:['10001','11011','10101','10001','10001'],O:['111','101','101','101','111'],V:['101','101','101','101','010'],I:['111','010','010','010','111'],S:['111','100','111','001','111']};
   let total=[...text].reduce((n,ch)=>n+(glyph[ch]?.[0].length??2)+1,0)*pixel,u=x-total/2;for(const ch of text){const rows=glyph[ch];if(rows)for(let j=0;j<rows.length;j++)for(let k=0;k<rows[j].length;k++)if(rows[j][k]==='1')box(u+k*pixel,y+(4-j)*pixel,z,pixel*.88,pixel*.88,.1,c);u+=((rows?.[0].length??2)+1)*pixel;}
  }
 }
 const front=depth/2;
 if(id==='embassy-free-mind'){
  // Broad Renaissance double house: sandstone pilasters, six busts, stepped crown.
  box(0,0,0,width*.98,14.8,depth*.98,'brick');gable(0,14.8,0,width*.95,6,depth*.97,'slate');
  const z=front+.04;for(const y of [.15,1.9,6.5,10.45,14.4])box(0,y,z,width,.28,.4,'stone');
  for(let i=0;i<6;i++){const x=(i-2.5)*width*.154;box(x,1.9,z,.38,12.7,.4,'stone');box(x,4.1,z+.2,.75,.22,.7,'stone');box(x,4.4,z+.22,.55,.45,.5,'stone');sphere(x,5.15,z+.47,.3,'stone',.95,1.2,.8);sphere(x,4.85,z+.4,.45,'stone',1.1,.65,.65);}
  for(const y of [2.3,6.9,10.85])for(let i=0;i<5;i++)win((i-2)*width*.154,y,z+.04,width*.12,y<3?3.5:2.9);
  box(0,0,z+.28,2.5,2.7,.6,'stone');arch(0,.15,z+.62,1.7,2.2,'dark');box(0,2.7,z+.3,3,.35,.8,'stone');
  // Successively narrower brick levels carry their own pale coping and arched openings.
  for(const [a,y,h] of [[width*.69,14.8,3],[width*.45,17.8,3.1],[width*.25,20.9,1.9]]){box(0,y,z-.12,a,h,.6,'brick');box(0,y+h,z,a+.5,.22,.8,'stone');for(const x of [-a/2,a/2])box(x,y,z+.14,.3,h,.45,'stone');}
  win(0,15.3,z+.32,1.8,2.2,true);win(0,18.35,z+.32,1.3,2.2,true);gable(0,22.7,z,.24*width,1.2,.6,'stone');sphere(0,24.3,z,.28,'stone');
  for(const x of [-width*.44,width*.44]){box(x,16,0,.8,4,.8,'brick');box(x,20,0,1.1,.25,1.1,'stone');}
 }else if(id==='the-movies'){
  // Low screening rooms behind the much narrower white street house and marquee.
  box(0,0,-depth*.12,width*.95,7.3,depth*.72,'brick');box(0,7.3,-depth*.12,width*.96,.25,depth*.73,'slate');
  const fw=Math.min(6.9,width*.45);box(0,0,front-depth*.085,fw,13.7,depth*.16,'white');box(0,13.7,front-depth*.085,fw+.3,.35,depth*.17,'stone');
  for(const y of [5.9,9.7])for(const x of [-fw*.24,fw*.24])win(x,y,front+.09,fw*.34,2.5);
  box(0,0,front+.1,fw*.86,3.4,.2,'dark');for(const x of [-fw*.23,fw*.23])box(x,.2,front+.22,fw*.32,2.8,.15,'glass');
  box(0,3.5,front+.4,fw+.5,1.8,1.1,'stone');box(0,3.7,front+1.02,fw+.2,1.4,.15,'white');
  for(let y=3.85;y<4.9;y+=.25)box(0,y,front+1.13,fw*.8,.04,.05,'dark');
  for(let x=-fw/2;x<=fw/2;x+=.5)for(const y of [3.56,5.14])sphere(x,y,front+1.13,.07,'gold');
  sign('THE MOVIES',0,5.2,front+.47,.12,'red');
 }else if(id==='delamar'){
  // Large glazed foyer next to the reconstructed historic school facade.
  box(0,0,0,width*.96,19.5,depth*.96,'brick');box(0,19.5,0,width*.97,.4,depth*.97,'slate');
  const z=front+.08,gw=width*.66;box(width*.13,0,z,gw,18.4,.3,'glass');
  for(let x=width*.13-gw/2;x<width*.13+gw/2;x+=3.3)box(x,0,z+.22,.16,18.5,.17,'frame');for(const y of [4.4,8.8,13.2,17.6])box(width*.13,y,z+.24,gw,.18,.18,'frame');
  let hx=-width*.36,hw=width*.23;box(hx,0,z,hw,16.7,.6,'brick');for(const y of [1,5.5,10.8,16.4])box(hx,y,z+.4,hw+.2,.35,.25,'stone');
  for(const y of [1.7,6.3,11.5])for(const x of [hx-hw*.28,hx,hx+hw*.28])win(x,y,z+.35,hw*.19,3.5,true);
  box(width*.13,4.3,z+.5,gw+.8,.5,2,'dark');sign('DELAMAR',width*.13,5.1,z+.68,.29,'white');box(width*.12,0,z+.38,gw*.52,3.6,.3,'dark');for(let x=-gw*.15;x<=gw*.35;x+=3.3)box(x,.2,z+.61,2.6,3,.15,'glass');
  // Theatre fly tower is deliberately set back from the street entrance.
  box(-width*.06,19.9,-depth*.2,width*.5,3.3,depth*.38,'dark');
 }else if(id==='magna-plaza'){
  // Neo-Gothic post office: striped brick, tall arches, pear-shaped corner turrets.
  box(0,0,0,width*.98,18.5,depth*.95,'brick');gable(0,18.5,0,width*.98,6,depth*.96,'slate');
  for(const z of [-depth*.48,depth*.48]){for(const y of [1,5.6,10.2,14.7,18.2])box(0,y,z,width,.35,.45,'stone');for(let x=-width*.44;x<=width*.44;x+=5.3){win(x,1.5,z+.15,2.5,3.6,true);win(x,6.4,z+.15,2.4,3.1,true);win(x,10.9,z+.15,2.4,3.1,true);box(x-2.1,.4,z,.35,18,.5,'stone');gable(x,18.8,z,3.7,3.5,2,'brick');win(x,19.1,z+1.06,1.5,2.2,true);}}
  for(const x of [-width*.43,width*.43])for(const z of [-depth*.39,depth*.39]){box(x,0,z,6,23.3,6,'brick');for(const y of [5.6,10.2,14.7,18.2,22.9])box(x,y,z,6.4,.4,6.4,'stone');for(const y of [6.4,11,16.1])win(x,y,z+3.1,2.4,3.7,true);add(new T.CylinderGeometry(2.2,3.1,2,8),'stone',x,24.4,z);add(new T.SphereGeometry(1,8,6).scale(2.9,4.5,2.9),'slate',x,29.6,z);add(new T.ConeGeometry(1.3,3,8),'slate',x,34.4,z);box(x,35.7,z,.14,2.4,.14,'gold');}
  box(0,0,front+.6,11.5,21,2,'brick');for(const y of [5.6,10.2,14.7,20.6])box(0,y,front+1.7,12,.4,.4,'stone');arch(0,.3,front+1.9,5.5,5.5,'stone');arch(0,.4,front+2.05,4.7,5.1,'dark');for(const x of [-3.3,0,3.3])win(x,11,front+1.9,2,5.7,true);gable(0,21,front+.6,12,7,3,'brick');gable(0,21.3,front+.7,10.8,6,.7,'stone');gable(0,21.65,front+.72,9.6,5,.8,'brick');sign('MAGNA PLAZA',0,6.5,front+2,.23,'white');
 }else throw new Error(`No venue builder for ${id}`);
}
