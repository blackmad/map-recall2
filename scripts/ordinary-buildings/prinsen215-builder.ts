import * as T from 'three';
import type {BuildingTools} from '../landmarks/cultural-builders';
import {openTopPrism,upwardRoofPlane} from '../landmarks/house-geometry';
import {roundHeadOpening,archedLoadingShutters} from './round-front-assemblies.mjs';
import {pointedWarehouseContours} from './repeated-front-assemblies.mjs';
import spec from './prinsen215-spec.json';
export const openingProbes:{label:string;point:number[];normal:number[];kind:string}[]=[];
export const openingInventory={centralUpper:8,narrowUpper:12,ground215GlazedDoubleDoor:1,ground217BlackDoubleClosure:1,groundNarrow:3,ground217ArchedEntry:1,peakHoistApertures:2,completeObserved:28,visibleMinimum:28,unobservedRearNotInvented:true};
export function buildPrinsen215(_w:number,_d:number,b:BuildingTools){
 openingProbes.length=0;
 const add=(g:T.BufferGeometry,c:string)=>b.add(g,c as Parameters<BuildingTools['add']>[1],0,0,0,0);
 const shape=(r:number[][])=>new T.Shape(r.map(p=>new T.Vector2(p[0],p[1])));
 add(openTopPrism(shape(spec.nativeRing),0,spec.eaveHeight),'brick');
 for(const roof of spec.roofs)for(const r of roof.rings){
  const height=(x:number,z:number)=>roof.plane[0]*x+roof.plane[1]*z+roof.plane[2];
  const g=upwardRoofPlane(shape(r)),p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,height(p.getX(i),p.getZ(i)));g.computeVertexNormals();
  // Remove only sub-millimetre-area inverted triangulation remnants at source/native clipping joins.
  const flat=g.index?g.toNonIndexed():g,pos=flat.getAttribute('position'),clean:number[]=[];
  for(let i=0;i<pos.count;i+=3){const A=new T.Vector3().fromBufferAttribute(pos,i),B=new T.Vector3().fromBufferAttribute(pos,i+1),C=new T.Vector3().fromBufferAttribute(pos,i+2),cross=B.clone().sub(A).cross(C.clone().sub(A));if(cross.y<0&&cross.length()<.00001)continue;clean.push(...A.toArray(),...B.toArray(),...C.toArray());}
  const top=new T.BufferGeometry();top.setAttribute('position',new T.Float32BufferAttribute(clean,3));top.computeVertexNormals();add(top,'slate');
  const v:number[]=[];
  for(let k=0;k<r.length;k++){const a=r[k],c=r[(k+1)%r.length],ha=height(a[0],a[1]),hc=height(c[0],c[1]),bottom=spec.eaveHeight;if(Math.max(ha,hc)-bottom<.015)continue;v.push(a[0],bottom,a[1],c[0],bottom,c[1],c[0],hc,c[1],a[0],bottom,a[1],c[0],hc,c[1],a[0],ha,a[1]);}
  if(v.length){const skirt=new T.BufferGeometry();skirt.setAttribute('position',new T.Float32BufferAttribute(v,3));skirt.computeVertexNormals();add(skirt,'brick');}
 }
 const a=spec.nativeRing[0],c=spec.nativeRing[1],len=Math.hypot(c[0]-a[0],c[1]-a[1]),t=[(c[0]-a[0])/len,(c[1]-a[1])/len],n=[-t[1],t[0]],face={a,t,n,len};
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
 box(len/2,0,len,12.15,.12,'brick',-.06);
 const pitch=len/2;
 for(const [unit,x] of [pitch*.5,pitch*1.5].entries()){
  const levels=[[3.30,2.80,1.92],[6.60,2.55,1.90],[9.63,2.35,1.82],[12.46,2.13,1.68]];
  for(const [level,[bottom,height,width]] of levels.entries()){
   round(`unit${unit}-loading${level}`,x,bottom,width,height,true);
   if(level>0)box(x,bottom-.60,width*.88,.53,.08,'dark',.14);else box(x,bottom-.12,width+.16,.10,.08,'dark',.14);
   for(const rail of[.38,.73])box(x,bottom+rail,width+.10,.075,.09,'dark',.22);
   for(const p of archedLoadingShutters(face,{x,bottom,width:width+.18,height,rise:width/2,angle:.20}))add(p.geometry,p.color);
   // Sparse observed iron hinge straps, no fictitious lettering.
   for(const side of[-1,1])for(const y of[bottom+.45,bottom+height-1.05])box(x+side*(width*.76+.10),y,.54,.035,.06,'redDark',.23);
   if(level<3)for(const side of[-1,1])round(`unit${unit}-side${level}-${side}`,x+side*2.12,bottom+.23,.56,height-.45,false,.28);
  }
  const groundWidth=1.96;
  // Source-specific ground tier: 215 white glazed double doors, black open plank shutters;
  // 217 closed black double planks and separate outer-right arched entry.
  if(unit===0){
   box(x,.10,groundWidth,2.92,.07,'glass',.085);
   for(const side of[-1,1])box(x+side*(groundWidth/2+.045),.10,.09,2.95,.09,'white',.145);
   for(const y of[.10,3.0])box(x,y,groundWidth+.15,.09,.10,'white',.145);
   box(x,.10,.075,2.90,.07,'white',.15);
   for(const y of[.60,2.65])box(x,y,groundWidth,.065,.07,'white',.15);
   for(const side of[-1,1]){box(x+side*1.53,.08,.96,2.97,.075,'dark',.23);for(let row=0;row<7;row++)box(x+side*1.53,.35+row*.37,.95,.016,.012,'frame',.275);round(`215-ground-${side}`,x+side*2.17,.45,.64,2.04,false,.32);}
   for(const f of[-.30,.30])probe(`215-ground-${f}`,x+f*groundWidth,1.65,.126,'glass');
  }else{
   box(x,.10,groundWidth,2.95,.085,'dark',.13);
   for(let plank=0;plank<10;plank++)box(x+(plank-4.5)*.194,.10,.014,2.95,.014,'frame',.18);
   round('217-ground-left',x-2.17,.45,.64,2.04,false,.32);
   round('217-arched-entry',x+2.17,.10,.92,3.00,false,.46);
   for(let plank=0;plank<5;plank++)box(x+2.17+(plank-2)*.16,.1,.014,2.42,.025,'frame',.15);
   probe('217-closed-ground',x+.4,1.50,.177,'dark');
   probe('217-arched-entry',x+2.40,1.50,.084,'dark');
  }

 }
 // Shared repeated profile controls masonry and thin sloped pale coping.
 for(const contour of pointedWarehouseContours(face,{count:2,start:0,pitch,width:pitch,base:12.15,peak:17.55,shoulderRise:.48})){
  const s=new T.Shape(contour.map(([x,y]:number[])=>new T.Vector2(x,y)));const g=new T.ExtrudeGeometry(s,{depth:.20,bevelEnabled:false}).applyMatrix4(basis);g.translate(n[0]*-.17+a[0],0,n[1]*-.17+a[1]);add(g,'brick');
  for(let k=0;k<contour.length-1;k++){const [x,y]=contour[k],[u,v]=contour[k+1],A=at(x,y,.12),B=at(u,v,.12),dir=B.clone().sub(A),geom=new T.BoxGeometry(.12,dir.length()+.06,.22);geom.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize()));geom.translate(...A.add(B).multiplyScalar(.5).toArray());add(geom,'white');}
  const x=contour[4][0];box(x,17.47,.23,.22,1.60,'dark',.63);box(x,17.15,.11,.40,.12,'dark',.25);
  // Small source-visible upper oculus/hoist opening, not a fifth loading bay.
  round(`peak-${x}`,x,15.38,.56,.68,false,.28);
 }
 // Exposed narrow side panes have dark divisions distinct from pale centres.
}
