import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import survey from './centrale-markthal-footprints.json';
/** Original native-scale surveyed hall. Whole-floor extents differ from RCE's70x100m interior description. */
export function buildCentraleMarkthal(_w:number,_d:number,b:BuildingTools):void{
 type C=Parameters<BuildingTools['add']>[1];
 const cx=-.78,half=26.1,back=-65.59,front=65.10,eave=17.75,ridge=28.23;
 function shape(points:number[][]){const s=new T.Shape();points.forEach(([x,z],i)=>i?s.lineTo(x,z):s.moveTo(x,z));s.closePath();return s}
 function shell(s:T.Shape,lo:number,hi:number,c:C,role:string,top=false){const g=openTopPrism(s,lo,hi);g.userData.role=role;b.add(g,c);if(top){const roof=upwardRoofPlane(s,hi);roof.userData.role=role+'-roof';b.add(roof,'slate')}}
 function rect(x0:number,z0:number,x1:number,z1:number){return shape([[x0,z0],[x1,z0],[x1,z1],[x0,z1]])}
 function plane(points:[number,number,number][],colour:C,role:string){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.setIndex([0,2,1,0,3,2]);g.computeVertexNormals();if(g.getAttribute('normal').getY(0)<0){g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals()}g.userData.role=role;b.add(g,colour)}
 // Exact installed BAG ground polygon, no bounding parcel slab. Explicit roofs own theirtops.
 shell(shape(survey.localFootprint),0,7.1,'ochre','surveyed-base',true);
 // Main hall walls remain open-top beneath upward supported gable surfaces.
 shell(rect(cx-half,back,cx+half,front),7.1,eave,'ochre','main-wall');
 // Profile-shaped endwalls close only under the shallow gable, never duplicate roofplates.
 for(const [z,rot]of[[front,0],[back,Math.PI]] as const){const profile=new T.Shape().moveTo(-half,eave).lineTo(half,eave).lineTo(0,ridge).closePath();const g=new T.ShapeGeometry(profile);if(rot)g.rotateY(rot);g.userData.role='gable-wall';b.add(g,'ochre',cx,0,z)}
 const roofY=(x:number)=>ridge-(ridge-eave)*Math.abs(x-cx)/half;
 function roofBand(z0:number,z1:number,c:C){for(const side of[-1,1])plane([[cx,roofY(cx),z0],[cx+side*half,roofY(cx+side*half),z0],[cx+side*half,roofY(cx+side*half),z1],[cx,roofY(cx),z1]],c,c==='glass'?'roof-skylight':'hall-roof')}
 // Sixteen structural bays; broad transverseglazing alternatingwith opaque roof, as photos/RCE.
 let cursor=back;for(let j=0;j<15;j++){const z=-57.2+j*8.15;roofBand(cursor,z-1.6,'slate');roofBand(z-1.6,z+1.6,'glass');for(const side of[-1,1]){for(const t of[.25,.5,.75]){const x=cx+side*half*t;const width=.07;plane([[x-width,roofY(x-width)+.025,z-1.6],[x+width,roofY(x+width)+.025,z-1.6],[x+width,roofY(x+width)+.025,z+1.6],[x-width,roofY(x-width)+.025,z+1.6]],'frame','roof-mullion')}for(const zz of[z-1.6,z+1.6])plane([[cx,roofY(cx)+.03,zz-.06],[cx+side*half,roofY(cx+side*half)+.03,zz-.06],[cx+side*half,roofY(cx+side*half)+.03,zz+.06],[cx,roofY(cx)+.03,zz+.06]],'frame','roof-frame')}cursor=z+1.6;}roofBand(cursor,front,'slate');
 // Low loadingwings and the overhangingoffice volumes have independent roofelevations.
 for(const side of[-1,1]){const outer=side>0?33.9:-36.0,inner=cx+side*half,office=side>0?31.7:-33.8;
  // 3DBAG LoD2.2 roof296 shares this stepped front contour with stair
  // roof309. The former east loading rectangle wrongly continued to57.2,
  // through the stairhouse above the BAG ground-floor shell. Retain the
  // full ground footprint and all stair/annex volumes; only this upper
  // loading zone follows its observed roof boundary. Outer wall remains
  // clipped to the installed BAG extent rather than the roof overhang.
  const eastLoadingFront=[
   [33.171557619741286,55.45600102492746],
   [31.969956003430326,54.085753764170505],
   [32.630393812549265,53.401702669376235],
   [32.62485008814363,52.45437681882687],
   [31.681411659250767,52.45156064169125],
   [31.69393221840702,51.58500410251922],
  ];
  const p=[34.419547883869136,55.135717867962846],q=eastLoadingFront[0];
  const eastOuterEnd=p[1]+(outer-p[0])*(q[1]-p[1])/(q[0]-p[0]);
  const loadingShape=side<0?rect(outer,-47.95,inner,57.2):shape([
   [inner,-47.95],[outer,-47.95],[outer,eastOuterEnd],
   ...eastLoadingFront,[inner,eastLoadingFront.at(-1)![1]],
  ]);
  shell(loadingShape,7.1,7.7,'ochre','loading-wing',true);
  shell(rect(Math.min(office,inner),-47.95,Math.max(office,inner),52.3),7.7,15.45,'ochre','office-wing');
  plane([[inner,eave,-47.95],[office,15.9,-47.95],[office,15.9,52.3],[inner,eave,52.3]],'slate','office-roof');
  b.box(outer,3.65,4.5,.26,.28,105.4,'stone');b.box(office,7.65,4.5,.3,.24,105.4,'stone');b.box(office,15.32,4.5,.4,.28,105.4,'stone');
  // Forty-six/forty-three upperwindowsperstorey; ladder steelmullions physically exposeglazing.
  const count=side<0?46:43;for(let i=0;i<count;i++){const z=-46+i*97/(count-1);for(const y of[10.7,13.4]){b.box(office+side*.08,y,z,.15,1.75,1.13,'dark');b.box(office+side*.17,y+.08,z,.10,1.58,.97,'glass');b.box(office+side*.24,y+.07,z,.045,1.58,.055,'frame');for(const t of[.4,.8,1.2])b.box(office+side*.24,y+t,z,.045,.045,.97,'frame')}}
  for(let i=0;i<14;i++){const z=-44+i*6.9;
   b.box(outer+side*.1,.12,z,.16,2.8,2.45,'white');b.box(outer+side*.21,.15,z,.1,2.7,2.25,'dark');
   b.box(office+side*.1,4.4,z,.15,2.8,1.42,'white');for(const dz of[-1.68,1.68])b.box(outer+side*.18,5.05,z+dz,.10,1.0,1.48,'glass');
   b.box(office+side*.65,7.4,z,1.5,.19,.22,'stone');for(const dy of[.55,1.1,1.65,2.2])b.box(outer+side*.27,dy,z,.03,.035,2.22,'frame');
  }
 }
 // Native endcornerappendages remain below their measured flatrooflevels.
 for(const side of[-1,1]){const x=side>0?30.9:-32.1;
  shell(rect(x-4.15,-65.3,x+4.15,-54.6),0,7.4,'ochre','rear-annex',true);
  shell(rect(x-3.1,-54.6,x+3.1,-48),7.1,16.3,'ochre','rear-stair',true);
  shell(rect(x-4.0,57.2,x+4.0,64.22),7.1,15.25,'ochre','front-annex',true);
  const stairX=side>0?27.3:-28.6;
  shell(rect(stairX-3.2,53.5,stairX+3.2,59),7.1,21.8,'ochre','front-stair',true);
  // Geo-matched 2020 west panorama and the 2016 east photo establish the
  // exposed stair wall and projecting window; LoD roof314/309 are fitted
  // fragments, not complete window plans. Retain their raw measured records.
  // Width, projection and head heights below are bounded photo reconstructions.
  const wall=side<0?-36.045:33.87,outer=wall+side*.62,centreZ=55.7;
  const stairShape=rect(Math.min(wall,side<0?-31.3:31.6),52.3,Math.max(wall,side<0?-31.3:31.6),57.226);
  // The fitted316/310 annex roofs remain low; the source-visible tall
  // street face is a bounded brick screen backed by the inset taller stair
  // zone, not an18.5m solid annex. Its8m span follows the photographed wall/
  // bay ratio and source323 front transition60.3. This is a photo-guided
  // facade reconstruction, not a new surveyed complete upper footprint.
  shell(stairShape,0,15.25,'ochre','photo-matched-outer-stairhouse',true);
  const faceWidth=8.0,faceStart=52.3,faceEnd=60.3;
  const screen=rect(Math.min(wall,wall-side*.30),faceStart,Math.max(wall,wall-side*.30),faceEnd);
  shell(screen,15.25,18.5,'ochre','photo-matched-stair-facade-screen',true);
  b.box(wall+side*.12,18.38,(faceStart+faceEnd)/2,.55,.18,faceWidth+.30,'stone');
  const bayRing=[[wall,centreZ-1.45],[outer,centreZ-1.0],[outer,centreZ+1.0],[wall,centreZ+1.45]];
  const bayTop=17.6;
  shell(shape(bayRing),4.4,bayTop+.22,'ochre','projecting-window-backing',true);
  const edges=[[0,1],[1,2],[2,3]];
  const area=bayRing.reduce((a,p,i)=>{const q=bayRing[(i+1)%bayRing.length];return a+p[0]*q[1]-q[0]*p[1]},0);
  for(const [face,[i,j]]of edges.entries()){const p=bayRing[i],q=bayRing[j],dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);
   const nx=Math.sign(area)*dz/len,nz=-Math.sign(area)*dx/len;
   const inset=.1,lo=4.4,hi=bayTop;
   const x0=p[0]+dx*inset/len+nx*.07,z0=p[1]+dz*inset/len+nz*.07,x1=q[0]-dx*inset/len+nx*.07,z1=q[1]-dz*inset/len+nz*.07;
   const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([x0,lo,z0,x1,lo,z1,x1,hi,z1,x0,hi,z0],3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();g.userData.role='stair-bay-glazing';g.userData.outwardNormal=[nx,0,nz];b.add(g,'glass');
   const angle=-Math.atan2(dz,dx),span=len-2*inset;
   function bayFrame(x:number,y:number,z:number,w:number,h:number,role:string){const f=new T.BoxGeometry(w,h,.055);f.userData.role=role;b.add(f,'frame',x,y+h/2,z,angle)}
   const divisions=face===1?3:1;
   for(let k=0;k<=divisions;k++){const t=k/divisions;bayFrame(x0+(x1-x0)*t+nx*.035,lo,z0+(z1-z0)*t+nz*.035,.065,hi-lo,'stair-bay-upright')}
   for(const y of[lo-.04,hi-.04])bayFrame((x0+x1)/2+nx*.035,y,(z0+z1)/2+nz*.035,span+.065,.08,'stair-bay-perimeter');
   for(let y=lo+.8;y<hi;y+=.85)bayFrame((x0+x1)/2+nx*.035,y,(z0+z1)/2+nz*.035,span,.055,'stair-bay-ladder');
  }
  // Open portico beneath flatcanopy: two genuinebrickpiers, visible glassdoors.
  const sidewall=side>0?35.0:-37.2;b.box(sidewall+side*.65,3.65,55.7,2.0,.24,4.0,'stone');for(const dz of[-1.5,1.5])b.box(sidewall+side*1.12,0,55.7+dz,.45,3.65,.45,'ochre');b.box(side>0?34.50:-36.22,.15,55.7,.1,3.1,1.6,'glass');
 }
 // Three endentrances plus continuousglazing and21 ladderwindowsperendrow.
 for(const side of[-1,1]){const z=side>0?front:back;for(const x of[cx-17,cx,cx+17]){b.box(x,0,z+side*.06,3.15,3.45,.14,'stone');b.box(x,.15,z+side*.16,2.76,3.14,.12,'glass');b.box(x,.15,z+side*.24,.08,3.14,.05,'frame')}
  b.box(cx,7.45,z+side*.09,55.0,.3,.22,'stone');b.box(cx,8.0,z+side*.13,53.5,2.0,.16,'glass');for(let x=cx-26;x<cx+26;x+=2.2)b.box(x,8.0,z+side*.23,.07,2.0,.07,'frame');
  for(let i=0;i<21;i++){const x=cx-25.5+i*2.55;for(const y of[11.1,14.1]){b.box(x,y,z+side*.09,1.10,1.72,.14,'dark');b.box(x,y+.07,z+side*.19,.94,1.55,.12,'glass');b.box(x,y+.07,z+side*.27,.055,1.55,.035,'frame');for(const yy of[.45,.9,1.35])b.box(x,y+yy,z+side*.27,.94,.045,.035,'frame')}}
 }
 // No reconstruction of demolishedNEclocktower, no inventedpaintedbuildingname.
}
