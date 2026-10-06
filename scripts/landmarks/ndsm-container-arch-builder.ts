import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original nine-box polygonal arch. Photo calibration, not assumed ISO dimensions.
 * +X bearing307.737° (same undirected axis127.737°); current principal striped ends face -Z (southwest).
 * 2026 FIRESTARTER artwork is interpreted in flat native shapes, with no pixels/text.
 */
export function buildNdsmContainerArch(_w:number,_d:number,b:BuildingTools):void {
 const size=2.44,half=size/2,depth=6.48,radius=8.006,datum=half;
 const point=(i:number,x:number,y:number,z:number)=>{const a=i*Math.PI/8;return new T.Vector3(radius*Math.cos(a)+x*Math.cos(a)-y*Math.sin(a),datum+radius*Math.sin(a)+x*Math.sin(a)+y*Math.cos(a),z)};
 function emit(i:number,g:T.BufferGeometry,c:Colour,role:string){g.rotateZ(i*Math.PI/8);g.translate(radius*Math.cos(i*Math.PI/8),datum+radius*Math.sin(i*Math.PI/8),0);g.userData={role,container:i};b.add(g,c);}
 function box(i:number,x:number,y:number,z:number,w:number,h:number,d:number,c:Colour,role='surface'){emit(i,new T.BoxGeometry(w,h,d).translate(x,y,z),c,role)}
 function beam(a:T.Vector3,q:T.Vector3,w:number,c:Colour,role:string){const delta=q.clone().sub(a),g=new T.BoxGeometry(w,delta.length(),w);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));g.translate(...a.clone().add(q).multiplyScalar(.5).toArray());g.userData={role};b.add(g,c)}
 // Thin artwork ribbons follow each panel; nothing spans an inter-container wedge.
 function ribbon(i:number,face:'front'|'back'|'outer',wave:number){const n=18;for(let j=0;j<n;j++){const u=(j+.5)/n,yy=.60*Math.sin(u*Math.PI*2+wave);if(face==='outer')box(i,half+.035,yy,(u-.5)*(depth-.18),.025,.46,(depth-.18)/n+.006,'pink','artwork-ribbon-outer');else box(i,(u-.5)*(size-.14),yy,face==='front'?-depth/2-.052:depth/2+.055,(size-.14)/n+.006,.37,.023,'pink',`artwork-ribbon-${face}`)}}
 for(let i=0;i<9;i++){
  // Closed boxes remain separate; inward surfaces are nearly black purple.
  box(i,0,0,0,size,size,depth,'dark','container-volume');
  box(i,half+.014,0,0,.035,size-.10,depth-.12,'blue','outer-turquoise-panel');
  for(const x of[-half,half])for(const y of[-half,half])box(i,x,y,0,.085,.085,depth+.035,'frame','corner-rail');
  for(const z of[-depth/2,depth/2]){for(const y of[-half,half])box(i,0,y,z,size+.08,.08,.085,'frame','end-frame');for(const x of[-half,half])box(i,x,0,z,.08,size,.085,'frame','end-frame');}
  // Principal end: coloured horizontal corrugations rotate with the box.
  box(i,0,0,-depth/2-.014,size-.10,size-.10,.024,'frame','principal-end');
  for(let j=0;j<10;j++){const y=-1.05+j*.232;box(i,0,y,-depth/2-.037,size-.14,.115,.033,j%3===0?'blue':j%3===1?'gold':'ochre','painted-end-corrugation')}
  ribbon(i,'front',i*.55);
  // Bounded emblem-like shapes stand in for the current observed coloured figures.
  // These are original geometric interpretations, not traced mural artwork.
  if(i===2||i===4||i===6){const c:Colour=i===4?'blue':i===2?'gold':'ochre';
   const head=new T.CircleGeometry(.29,12);head.rotateY(Math.PI);head.translate(.28,-.26,-depth/2-.073);emit(i,head,c,'front-abstract-figure');
   for(const x of[-.27,.43])box(i,x,.01,-depth/2-.070,.14,.64,.027,c,'front-abstract-figure');
   box(i,.08,-.45,-depth/2-.073,.65,.23,.026,c,'front-abstract-figure');
  }
  // Reverse door panels: purple sheet, raised locking bars and hinges.
  box(i,0,0,depth/2+.014,size-.10,size-.10,.024,'frame','reverse-door');
  for(const x of[-.65,-.28,.28,.65])box(i,x,0,depth/2+.045,.045,size-.20,.042,i===4?'gold':'blue','door-locking-rod');
  ribbon(i,'back',i*.55);
  // Broad outer wall corrugation; restrained dark ridges retain the turquoise field.
  for(let z=-depth/2+.18;z<depth/2-.10;z+=.19)box(i,half+.040,0,z,.024,size-.16,.032,'frame','side-corrugation');
  // Photo0/2 show plain turquoise upper broad panels. Repeat artwork only
  // on the supported lowest pair: closed magenta loops on bases and ribbon/
  // figure panels one tier above. Far upper panels are partly occluded;
  // keeping them plain has stronger support than inventing another motif.
  if(i===1||i===7)ribbon(i,'outer',i*.70);
  if(i===0||i===8){
   const start=-2.88,end=2.30,n=22;
   for(const side of[-1,1])for(let j=0;j<n;j++){
    const u=(j+.5)/n,z=start+(end-start)*u;
    const y=side*(.58+.16*Math.sin(u*Math.PI*2));
    box(i,half+.035,y,z,.025,.35,(end-start)/n+.007,'pink','base-closed-loop');
   }
   // A broad return connects the two bands at the side-panel right end.
   for(let j=0;j<10;j++){const a=-Math.PI/2+(j+.5)*Math.PI/10;
    box(i,half+.036,.58*Math.sin(a),end+.58*Math.cos(a),.027,.24,.25,'pink','base-closed-loop');
   }
  }
  // Dark interior corrugations are readable from below and leave the passage open.
  for(let z=-depth/2+.15;z<depth/2-.10;z+=.23)box(i,-half-.016,0,z,.028,size-.18,.028,'frame','inward-corrugation');
  // Current yellow/orange accents are bounded original interpretations.
  if(i===1||i===7){box(i,half+.067,.48,.65,.025,.58,2.00,'ochre','artwork-accent');const ring=new T.TorusGeometry(.42,.10,4,12);ring.rotateY(Math.PI/2);ring.translate(half+.075,-.06,-1.45);emit(i,ring,'gold','artwork-loop');box(i,half+.076,-.63,-1.25,.035,.50,.14,'gold','artwork-accent');}
 }
 // Open wedge joints: end rails and narrow diagonal spacer arms, no solid wedges.
 for(let i=0;i<8;i++)for(const z of[-depth/2,depth/2]){
  const outerA=point(i,half,half,z),outerB=point(i+1,half,-half,z),innerA=point(i,-half,half,z),innerB=point(i+1,-half,-half,z);
  beam(outerA,outerB,.09,'frame','wedge-outer-connector');beam(innerA,innerB,.075,'frame','wedge-inner-connector');
  beam(outerA,innerB,.065,'frame','wedge-spacer');beam(innerA,outerB,.065,'frame','wedge-spacer');
 }
}
