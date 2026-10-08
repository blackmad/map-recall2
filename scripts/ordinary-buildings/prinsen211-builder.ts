import * as T from 'three';
import type {BuildingTools} from '../landmarks/cultural-builders';
import {openTopPrism,upwardRoofPlane} from '../landmarks/house-geometry';
import {roundHeadOpening,archedLoadingShutters} from './round-front-assemblies.mjs';
import {pointedWarehouseContours} from './repeated-front-assemblies.mjs';
import spec from './prinsen211-spec.json';
export const openingProbes:{label:string;point:number[];normal:number[];kind:string}[]=[];
export const openingInventory={centralUpper:8,narrowUpper:12,groundCentral:2,groundNarrow:3,ground211Door:1,peakHoistApertures:2,completeObserved:28,visibleMinimum:28,unobservedRearNotInvented:true};
export function buildPrinsen211(_w:number,_d:number,b:BuildingTools){
 openingProbes.length=0;
 const add=(g:T.BufferGeometry,c:string)=>b.add(g,c as Parameters<BuildingTools['add']>[1],0,0,0,0);
 const shape=(r:number[][])=>new T.Shape(r.map(p=>new T.Vector2(p[0],p[1])));
 add(openTopPrism(shape(spec.nativeRing),0,3.40),'brick');
 for(const r of spec.mainRings)add(openTopPrism(shape(r),3.4,spec.eaveHeight),'brick');
 for(const r of spec.uncoveredRings)add(upwardRoofPlane(shape(r),3.4),'slate');
 for(const roof of spec.roofs)for(const r of roof.rings){
  const height=(x:number,z:number)=>roof.plane[0]*x+roof.plane[1]*z+roof.plane[2];
  const g=upwardRoofPlane(shape(r)),p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,height(p.getX(i),p.getZ(i)));g.computeVertexNormals();add(g,'slate');
  // Only bounded vertical supports, no duplicated wall-coloured roof cap.
  const bottom=roof.role==='low-rear'?3.4:spec.eaveHeight,v:number[]=[];
  for(let k=0;k<r.length;k++){const a=r[k],c=r[(k+1)%r.length],ha=height(...a as [number,number]),hc=height(...c as [number,number]);if(Math.max(ha,hc)-bottom<.015)continue;v.push(a[0],bottom,a[1],c[0],bottom,c[1],c[0],hc,c[1],a[0],bottom,a[1],c[0],hc,c[1],a[0],ha,a[1]);}
  if(v.length){const skirt=new T.BufferGeometry();skirt.setAttribute('position',new T.Float32BufferAttribute(v,3));skirt.computeVertexNormals();add(skirt,roof.role==='low-rear'?'brick':'slate');}
 }
 const a=spec.nativeRing[2],c=spec.nativeRing[3],len=Math.hypot(c[0]-a[0],c[1]-a[1]),t=[(c[0]-a[0])/len,(c[1]-a[1])/len],n=[-t[1],t[0]],face={a,t,n,len};
 const at=(x:number,y:number,d:number)=>new T.Vector3(a[0]+t[0]*x+n[0]*d,y,a[1]+t[1]*x+n[1]*d),basis=new T.Matrix4().makeBasis(new T.Vector3(t[0],0,t[1]),new T.Vector3(0,1,0),new T.Vector3(n[0],0,n[1]));
 const box=(x:number,y:number,w:number,h:number,d:number,col:string,out=.15)=>{const g=new T.BoxGeometry(w,h,d).applyMatrix4(basis);g.translate(...at(x,y+h/2,out).toArray());add(g,col);};
 const probe=(label:string,x:number,y:number,depth=.084,kind='glass')=>openingProbes.push({label,point:at(x,y,depth).toArray(),normal:[n[0],0,n[1]],kind});
 const round=(label:string,x:number,bottom:number,width:number,height:number,pale:boolean,rise=width/2)=>{
  for(const p of roundHeadOpening(face,{x,bottom,width,height,rise,trim:pale?.075:.06,colour:pale?'white':'brick',glassColour:pale?'glass':'dark'}))add(p.geometry,p.color);
  box(x,bottom+.02,.055,height-rise-.03,.045,'frame',.145);
  box(x,bottom+height-rise-.05,width,.06,.045,'frame',.145);
  if(!pale)for(const f of[-.23,.23])box(x+f*width,bottom+.02,.025,height-rise-.03,.045,'frame',.145);
  for(const f of[-.30,.30])for(const h of[.25,.65])probe(`${label}-${f}-${h}`,x+f*width,bottom+h*(height-rise),.084,pale?'glass':'dark');
 };
 // Explicit street face ties source-survey shell boundary tolerance to the
 // native frontage without padding suppression or filling the rear notch.
 box(len/2,3.4,len,8.75,.12,'brick',-.06);
 const pitch=len/2;
 for(const [unit,x] of [pitch*.5,pitch*1.5].entries()){
  const levels=[[3.30,2.80,1.92],[6.60,2.55,1.90],[9.63,2.35,1.82],[12.46,2.13,1.68]];
  for(const [level,[bottom,height,width]] of levels.entries()){
   round(`unit${unit}-loading${level}`,x,bottom,width,height,true);
   box(x,bottom-.35,width+.16,.32,.08,'dark',.14);
   box(x,bottom+.65,width,.065,.08,'frame',.15);
   for(const p of archedLoadingShutters(face,{x,bottom,width:width+.18,height,rise:width/2,angle:.20}))add(p.geometry,p.color);
   // Sparse observed iron hinge straps, no fictitious lettering.
   for(const side of[-1,1])for(const y of[bottom+.45,bottom+height-1.05])box(x+side*(width*.76+.10),y,.54,.035,.06,'redDark',.23);
   if(level<3)for(const side of[-1,1])round(`unit${unit}-side${level}-${side}`,x+side*2.12,bottom+.23,.56,height-.45,false,.28);
  }
  const groundWidth=1.96;
  box(x,.10,groundWidth,2.92,.07,'glass',.085);
  for(const side of[-1,1])box(x+side*(groundWidth/2+.045),.10,.09,2.95,.09,'white',.145);
  for(const y of[.10,3.0])box(x,y,groundWidth+.15,.09,.10,'white',.145);
  for(const side of[-1,1])box(x+side*1.55,.08,.98,2.95,.075,'red',.23);
  if(unit===0){
   // 211: mailbox loading frontage and separate narrow left-hand doorway.
   box(x,.73,groundWidth,2.1,.07,'dark',.11);box(x,.62,groundWidth,.09,.10,'white',.16);
   for(let row=0;row<4;row++)for(let col=0;col<4;col++){box(x+(col-1.5)*.41,1.04+row*.38,.35,.025,.035,'mailbox',.16);box(x+(col-1.5)*.41,1.16+row*.38,.10,.045,.02,'mailbox',.16);}
   round('211-entry',x-2.12,.10,.90,3.05,true,.45);box(x-2.12,.10,.80,2.60,.03,'dark',.14);probe('211-door',x-2.32,1.40,.159,'dark');
   round('211-ground-right',x+2.12,.45,.64,2.04,false,.32);
  }else{
   box(x,.10,.075,2.90,.07,'frame',.15);
   for(const side of[-1,1]){box(x+side*.48,.35,.70,.60,.04,'frame',.15);box(x+side*.12,1.15,.035,.32,.035,'mailbox',.20);round(`213-ground-${side}`,x+side*2.12,.45,.64,2.04,false,.32);}
  }
  for(const f of[-.30,.30])probe(`unit${unit}-ground-${f}`,x+f*groundWidth,2.30,.126,unit===0?'dark':'glass');
 }
 // Shared repeated profile controls masonry and thin sloped pale coping.
 for(const contour of pointedWarehouseContours(face,{count:2,start:0,pitch,width:pitch,base:12.15,peak:17.30,shoulderRise:.48})){
  const s=new T.Shape(contour.map(([x,y]:number[])=>new T.Vector2(x,y)));const g=new T.ExtrudeGeometry(s,{depth:.20,bevelEnabled:false}).applyMatrix4(basis);g.translate(n[0]*-.17+a[0],0,n[1]*-.17+a[1]);add(g,'brick');
  for(let k=0;k<contour.length-1;k++){const [x,y]=contour[k],[u,v]=contour[k+1],A=at(x,y,.12),B=at(u,v,.12),dir=B.clone().sub(A),geom=new T.BoxGeometry(.12,dir.length()+.06,.22);geom.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize()));geom.translate(...A.add(B).multiplyScalar(.5).toArray());add(geom,'white');}
  const x=contour[4][0];box(x,17.28,.17,.14,1.33,'white',.53);box(x,16.90,.11,.40,.12,'dark',.25);
  // Small source-visible upper oculus/hoist opening, not a fifth loading bay.
  round(`peak-${x}`,x,15.18,.56,.68,false,.28);
 }
 // Exposed narrow side panes have dark divisions distinct from pale centres.
}
