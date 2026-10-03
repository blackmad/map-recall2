import * as T from 'three';
import type {BuildingTools} from './cultural-builders';

/** Four original house-museum models. Width is the actual street-facing
 * frontage; depth follows the OSM plot, including Anne Frank's rear annex.
 * Photo references define architectural detail, never texture or geometry. */
export function buildHouseMuseumLandmark(id:string,w:number,d:number,b:BuildingTools){
 const {box,add,prism,hip,sign,window}=b;
 function sash(x:number,y:number,z:number,width:number,height:number,c:'white'|'stone'='white'){
  box(x,y-.12,z,width+.27,height+.25,.2,c);box(x,y,z+.13,width,height,.12,'glass');
  for(let u of [-width/4,0,width/4])box(x+u,y,z+.23,.065,height,.07,c);
  for(let v of [height*.33,height*.66])box(x,y+v,z+.24,width,.065,.08,c);
 }
 function stairs(x:number,z:number,width:number,height:number){for(let i=0;i<5;i++)box(x,i*height/5,z+(4-i)*.38,width,height/5,.44,'stone');}
 function statue(x:number,y:number,z:number){
  box(x,y,z,.7,.4,.7,'stone');add(new T.CylinderGeometry(.2,.33,1.35,6),'stone',x,y+1.03,z);
  add(new T.IcosahedronGeometry(.22,0),'stone',x,y+1.92,z);
  box(x-.3,y+.95,z,.18,.8,.22,'stone',.25);box(x+.3,y+1.2,z,.18,.6,.22,'stone',-.4);
 }
 if(id==='anne-frank-house'){
  // A modest three-bay cornice house; the rear annex is a separate roof volume.
  const frontDepth=d*.57,frontZ=d*.215,backDepth=d*.28,backZ=-d*.36;
  box(0,0,frontZ,w,14.4,frontDepth,'brick');
  box(0,14.4,frontZ,w+.05,.5,frontDepth+.08,'white');
  prism(0,14.9,frontZ,w,frontDepth,3,'red');
  // The false upper front conceals the pitched roof from the canal.
  box(0,13.9,d/2-.16,w,2.2,.35,'brick');box(0,16.1,d/2,w+.12,.32,.5,'white');
  box(0,0,backZ,w*.96,11.8,backDepth,'brick');prism(0,11.8,backZ,w*.98,backDepth,3.6,'red');
  box(-w*.39,0,-d*.04,w*.22,10.5,d*.18,'brick');box(-w*.39,10.5,-d*.04,w*.24,.25,d*.18,'slate');
  for(let x of [-w*.31,0,w*.31]){
   for(let y of [4.4,8,11.5])sash(x,y,d/2+.05,w*.2,2.3);
   box(x,0,d/2+.04,w*.26,3.5,.21,'dark');sash(x,2.55,d/2+.16,w*.19,.6,'frame');
   box(x,1.0,d/2+.19,.045,1.1,.11,'gold');
  }
  for(let y of [3.9,7.5,11.05])for(let x of [-w*.43,w*.43]){box(x,y,d/2+.2,.07,.65,.1,'dark');box(x,y+.3,d/2+.2,.27,.06,.1,'dark');}
  for(let x of [-w*.23,w*.23])for(let y of [3.7,7.1])sash(x,y,-d/2-.1,w*.29,2.2);
  // Small door plaque is proportionate, rather than a fictional giant sign.
  box(w*.31,3.27,d/2+.28,w*.26,.19,.04,'white');box(0,15.8,d/2+.37,.15,.15,.95,'dark');
 }else if(id==='rembrandt-house'){
  box(0,0,0,w,17.4,d,'brick');prism(0,17.4,0,w,d,5.3,'slate');
  const front=d/2+.03;
  for(let y of [1.1,3.0,6.9,11.5,16.7,17.3])box(0,y,front,w+.07,.25,.35,'stone');
  for(let x of [-w*.47,w*.47]){box(x,0,front,.44,17.5,.5,'stone');for(let y=1;y<17;y+=1.05)box(x,y,front+.1,.6,.25,.35,'stone');}
  for(let x of [-w*.35,-w*.12,w*.12,w*.35]){
   for(let y of [7.3,12.05])window(x,y,front+.09,w*.14,3.8);
   for(const [y,h] of [[3.6,3.3],[8.3,2.8],[13.3,2.5]]){
    sash(x,y,front+.25,w*.135,h);
    for(let side of [-1,1])box(x+side*w*.105,y,front+.5,w*.065,h*.64,.16,'red',side*.27);
   }
  }
  // Classical front pediment, double dormers and two chimney stacks.
  prism(0,17.65,front+.13,w*.78,.55,3.2,'stone');prism(0,17.9,front+.44,w*.65,.12,2.45,'brick');
  for(let x of [-w*.37,w*.37]){box(x,17.4,d*.23,w*.16,3.1,d*.15,'stone');sash(x,17.6,d*.31,w*.09,2);prism(x,20.5,d*.23,w*.19,d*.16,.65,'stone');}
  for(let x of [-w*.23,w*.23]){box(x,20.3,-d*.1,.95,3.9,1.05,'brick');box(x,24.2,-d*.1,1.25,.3,1.35,'dark');}
  stairs(0,front+.3,w*.19,1.3);window(0,1.3,front+.4,w*.14,4.3);prism(0,5.7,front+.45,w*.29,.45,1.2,'stone');
 }else if(id==='moco-museum'){
  box(0,0,0,w*.97,2.4,d*.94,'stone');box(0,2.4,0,w*.97,9,d*.94,'brick');
  box(0,11.4,0,w*.99,2.7,d*.96,'white');hip(0,14.1,0,w,d,5.5,'slate');
  const front=d*.485;
  for(let side of [-1,1]){
   const z=side*front;
   for(let x=-w*.45;x<=w*.45;x+=2.05)box(x,11.4,z,.14,2.7,.18,'brick');
   for(let y of [11.4,12.6,14])box(0,y,z,w,.14,.18,'brick');
   for(let x of [-w*.36,-w*.12,w*.12,w*.36])for(let y of [3.4,7.5,11.8])sash(x,y,z+.09,1.55,y===11.8?1.8:2.6);
  }
  // Faceted bay, half-timbered front gable and steep roof cross-gables.
  const bay=w*.15,bx=w*.2;
  box(bx,2.4,front+.6,bay,8.9,1.7,'stone');
  for(let y of [3.3,7.5]){sash(bx,y,front+1.5,bay*.63,2.9);for(let side of [-1,1])box(bx+side*bay*.43,y,front+.6,.16,2.9,1.05,'glass');}
  box(bx,11.4,front+.6,w*.32,2.7,2,'white');prism(bx,14.1,front+.6,w*.33,3.4,4,'slate');prism(bx,14.1,front+2.35,w*.33,.18,4,'white');
  for(let u of [-1.25,0,1.25])sash(bx+u,11.75,front+1.75,.95,1.95);
  for(let x of [bx-w*.15,bx,bx+w*.15])box(x,11.4,front+2.5,.18,x===bx?6.7:2.7,.2,'brick');
  box(bx,14.1,front+2.5,w*.33,.2,.2,'brick');
  const r=w*.16,h=4;
  for(let side of [-1,1]){const g=new T.BoxGeometry(Math.hypot(r,h),.19,.2);g.rotateZ(-side*Math.atan2(h,r));add(g,'brick',bx+side*r/2,14.1+h/2,front+2.5);}
  for(let x of [-w*.32,w*.37]){box(x,12,0,1.15,10.6,1.15,'brick');box(x,22.6,0,1.45,.3,1.45,'stone');}
  add(new T.CylinderGeometry(1.32,1.32,.35,16).rotateX(Math.PI/2),'brick',-w*.17,17.1,front*.42);add(new T.CylinderGeometry(1.08,1.08,.38,16).rotateX(Math.PI/2),'glass',-w*.17,17.1,front*.42+.16);
  for(let u of [-.5,0,.5])box(-w*.17+u,16.05,front*.42+.39,.08,2.1,.1,'white');box(-w*.17,17.1,front*.42+.39,2.1,.08,.1,'white');
  stairs(bx,front+1.65,2.5,2.4);window(bx,2.4,front+1.6,1.4,3.3);sign('MOCO',-w*.23,9.6,front+.35,.23);
 }else if(id==='museum-van-loon'){
  box(0,0,0,w,14.7,d,'brick');box(0,0,d/2-.1,w,14.7,.4,'stone');
  hip(0,14.7,0,w,d,3.7,'slate');
  const front=d/2+.12;
  for(let x of [-w*.36,-w*.18,0,w*.18,w*.36]){
   for(let y of [3.3,7.5,11.3])sash(x,y,front,1.35,2.55,'stone');
   box(x,14.5,front,.35,1.0,.55,'stone');
  }
  for(let x of [-w*.39,-w*.13,w*.13,w*.39])statue(x,15.5,front);
  for(let y of [2.4,6.6,10.5,14.1,15.3])box(0,y,front,w+.05,.23,.45,'stone');
  // Canal frontage is sandstone with five bays and statues on its balustrade.
  stairs(0,front+.3,2.5,1.6);window(0,1.6,front+.23,1.8,4.1);box(0,6.1,front+.7,2.8,.2,1.4,'stone');
  for(let x of [-1.3,1.3])box(x,6.3,front+1.3,.12,.9,.12,'dark');box(0,7.2,front+1.3,2.8,.1,.1,'dark');
  sign('VAN LOON',0,10.8,front+.33,.14,'dark');
  for(let x of [-w*.26,w*.26]){box(x,15.7,0,1.1,3.2,1.1,'brick');box(x,18.9,0,1.4,.3,1.4,'stone');}
  // The garden-side elevation has the distinct blue niches and classical portal.
  box(0,0,-d/2-.1,w,9.6,.35,'white');
  for(let x of [-w*.28,w*.28]){box(x,2.2,-d/2-.35,1.6,3.9,.13,'blue');statue(x,2.35,-d/2-.48);}
  for(let x of [-w*.16,w*.16])box(x,1.5,-d/2-.35,.35,6,.45,'stone');
  prism(0,7.5,-d/2-.2,w*.45,.6,1.7,'stone');box(0,1.5,-d/2-.4,1.8,4.6,.13,'dark');
 }else throw Error(`Unknown house museum ${id}`);
}
