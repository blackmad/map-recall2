import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {facadeFrame} from './museums2-shared';
type Colour=Parameters<BuildingTools['add']>[1];

function pointInRing(ring:number[][],x:number,z:number){
 let yes=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],c=ring[j];if((a[1]>z)!==(c[1]>z)&&x<((c[0]-a[0])*(z-a[1]))/(c[1]-a[1])+a[0])yes=!yes}
 return yes;
}
export interface EdgeFrame extends ReturnType<typeof facadeFrame>{
 /** u coordinate (facadeFrame convention) for a distance `t` metres from ring[i] along the edge. */
 s:(t:number)=>number;
 flipped:boolean;
}
/** Facade frame on ring edge i -> i+1 whose local +o always points out of the building. */
export function edgeFrame(b:BuildingTools,ring:number[][],i:number,j=(i+1)%ring.length):EdgeFrame{
 const a=ring[i],c=ring[j];
 let f=facadeFrame(b,a,c),flipped=false;
 const [px,pz]=f.at(0,.3);
 if(pointInRing(ring,px,pz)){f=facadeFrame(b,a,c,true);flipped=true}
 const len=f.len;
 return {...f,flipped,s:(t:number)=>flipped?len/2-t:t-len/2};
}
export const edgeLength=(ring:number[][],i:number,j=(i+1)%ring.length)=>Math.hypot(ring[j][0]-ring[i][0],ring[j][1]-ring[i][1]);

/** Flat quad facing local +o on the facade (2 triangles): cheap glazing/frames. y is the bottom. */
export function panel(b:BuildingTools,f:EdgeFrame,t:number,y:number,o:number,w:number,h:number,c:Colour){
 const g=new T.PlaneGeometry(w,h);
 const [x,z]=f.at(f.s(t),o);
 b.add(g,c,x,y+h/2,z,f.ang);
}
/** Window with a pale frame plane behind a glass plane. */
export function windowPane(b:BuildingTools,f:EdgeFrame,t:number,y:number,w:number,h:number,opts:{frame?:Colour;glass?:Colour;mullion?:boolean;sill?:Colour}={}){
 panel(b,f,t,y-.12,.03,w+.28,h+.24,opts.frame??'white');
 panel(b,f,t,y,.05,w,h,opts.glass??'glass');
 if(opts.mullion!==false){panel(b,f,t,y,.065,.08,h,opts.frame??'white');panel(b,f,t,y+h*.62,.065,w,.07,opts.frame??'white')}
 if(opts.sill){f.box(f.s(t),y-.2,.1,w+.45,.1,.24,opts.sill)}
}
/** Round-headed window: plane rectangle plus a half-disc top. */
export function archedPane(b:BuildingTools,f:EdgeFrame,t:number,y:number,w:number,h:number,opts:{frame?:Colour;glass?:Colour}={}){
 const mk=(ww:number,hh:number,o:number,c:Colour)=>{
  const s=new T.Shape();const r=ww/2;s.moveTo(-r,0);s.lineTo(r,0);s.lineTo(r,hh-r);s.absarc(0,hh-r,r,0,Math.PI,false);s.lineTo(-r,0);
  const g=new T.ShapeGeometry(s,6);const [x,z]=f.at(f.s(t),o);b.add(g,c,x,y,z,f.ang);
 };
 mk(w+.3,h+.15,.03,opts.frame??'white');mk(w,h,.05,opts.glass??'glass');
 panel(b,f,t,y,.065,.07,h-w/2,opts.frame??'white');
}
/** Regular rows of windows along an edge. `skip` ranges (metres from ring[i]) are left blank. */
export function windowRows(b:BuildingTools,f:EdgeFrame,o:{from:number;to:number;pitch:number;w:number;h:number;sills:number[];skip?:[number,number][];arch?:boolean|((rowIndex:number)=>boolean);frame?:Colour;glass?:Colour;mullion?:boolean;top?:(x:number,z:number)=>number}){
 const n=Math.max(1,Math.floor((o.to-o.from)/o.pitch)),used=n*o.pitch,start=o.from+((o.to-o.from)-used)/2+o.pitch/2;
 let count=0;
 for(let k=0;k<n;k++){
  const t=start+k*o.pitch;
  if(o.skip?.some(([a,c])=>t>a-o.w/2&&t<c+o.w/2))continue;
  const [px,pz]=f.at(f.s(t),-.6),lim=o.top?o.top(px,pz):Infinity;
  o.sills.forEach((y,r)=>{
   if(y+o.h>lim-.35)return;
   const arch=typeof o.arch==='function'?o.arch(r):!!o.arch;
   if(arch)archedPane(b,f,t,y,o.w,o.h,{frame:o.frame,glass:o.glass});else windowPane(b,f,t,y,o.w,o.h,{frame:o.frame,glass:o.glass,mullion:o.mullion});
   count++;
  });
 }
 return count;
}
/** Lowest 3DBAG roof vertex within r metres (plan) of a point: the eave height there. */
export function eaveNear(roofs:{rings:number[][][]}[],x:number,z:number,r=1.5){
 let m=Infinity;
 for(const f of roofs)for(const p of f.rings[0])if(Math.hypot(p[0]-x,p[2]-z)<r)m=Math.min(m,p[1]);
 return Number.isFinite(m)?m:0;
}
/** Wall-top lookup from 3DBAG roofs: lowest roof vertex within r metres, or Infinity when none is near. */
export const wallTop=(roofs:{rings:number[][][]}[],r=2.5)=>(x:number,z:number)=>{
 // prefer the roof face that actually covers this (inward-offset) point; fall back to the nearest eave vertex
 let best=Infinity;
 for(const f of roofs){const ring=f.rings[0];let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],c=ring[j];if((a[2]>z)!==(c[2]>z)&&x<((c[0]-a[0])*(z-a[2]))/(c[2]-a[2])+a[0])yes=!yes}
  if(yes)best=Math.min(best,Math.min(...ring.map(p=>p[1])))}
 if(Number.isFinite(best))return best;
 const m=eaveNear(roofs,x,z,r);return m>0?m:Infinity;
};
/** Backstop wall quads just inside every ring edge up to the local eave, so any gap the roof-skirted survey
 * shell leaves (roof faces that stop short of the footprint line) still reads as wall from outside. */
export function backstopWalls(b:BuildingTools,ring:number[][],roofs:{rings:number[][][]}[],c:Colour,step=2){
 const top=wallTop(roofs,2.5);
 for(let i=0;i<ring.length;i++){
  const f=edgeFrame(b,ring,i);if(f.len<.5)continue;
  const n=Math.max(1,Math.round(f.len/step)),w=f.len/n;
  for(let k=0;k<n;k++){
   const t=(k+.5)*w,[x,z]=f.at(f.s(t),-.6),h=top(x,z);
   if(Number.isFinite(h)&&h>1)panel(b,f,t,0,-.03,w+.02,h-.1,c);
  }
 }
}
/** Triangular pediment (extruded outward) centred at u on the facade, base at y. */
export function pediment(b:BuildingTools,f:EdgeFrame,u:number,y:number,w:number,h:number,depth:number,c:Colour,o=0){
 const s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(0,h);s.closePath();
 const g=new T.ExtrudeGeometry(s,{depth,bevelEnabled:false});
 const [x,z]=f.at(f.s(u),o);b.add(g,c,x,y,z,f.ang);
}
/** Horizontal band (cornice/string course) along a whole edge. */
export function band(b:BuildingTools,f:EdgeFrame,y:number,h:number,out:number,c:Colour,inset=0){
 f.box(0,y,out/2,f.len-inset*2,h,out,c);
}

/** 5x7 pixel capitals for signs set on a (possibly rotated) facade; pixels are flat planes. */
const GLYPHS:Record<string,string[]>={
 A:['01110','10001','10001','11111','10001','10001','10001'],B:['11110','10001','10001','11110','10001','10001','11110'],
 C:['01111','10000','10000','10000','10000','10000','01111'],E:['11111','10000','10000','11110','10000','10000','11111'],
 G:['01110','10001','10000','10111','10001','10001','01110'],H:['10001','10001','10001','11111','10001','10001','10001'],
 I:['01110','00100','00100','00100','00100','00100','01110'],K:['10001','10010','10100','11000','10100','10010','10001'],
 L:['10000','10000','10000','10000','10000','10000','11111'],M:['10001','11011','10101','10101','10001','10001','10001'],
 N:['10001','11001','10101','10011','10001','10001','10001'],O:['01110','10001','10001','10001','10001','10001','01110'],
 P:['11110','10001','10001','11110','10000','10000','10000'],R:['11110','10001','10001','11110','10100','10010','10001'],
 S:['01111','10000','10000','01110','00001','00001','11110'],T:['11111','00100','00100','00100','00100','00100','00100'],
 U:['10001','10001','10001','10001','10001','10001','01110'],V:['10001','10001','10001','10001','10001','01010','00100'],
 W:['10001','10001','10001','10101','10101','11011','10001'],' ':['000','000','000','000','000','000','000'],
};
/** Pixel-font text on an edge frame, centred at t metres from the edge start. */
export function frameText(b:BuildingTools,f:EdgeFrame,text:string,t:number,y:number,o:number,pixel:number,c:Colour){
 const adv=(ch:string)=>(GLYPHS[ch]??GLYPHS[' '])[0].length+1;
 const total=[...text].reduce((s,ch)=>s+adv(ch),-1)*pixel;let u=t-total/2;
 for(const ch of text){
  const rows=GLYPHS[ch];
  if(rows)for(let j=0;j<7;j++)for(let k=0;k<rows[j].length;k++)if(rows[j][k]==='1')panel(b,f,u+k*pixel+pixel/2,y+(6-j)*pixel,o,pixel*.92,pixel*.92,c);
  u+=adv(ch)*pixel;
 }
 return total;
}
