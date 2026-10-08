import * as T from 'three';
import type {BuildingTools} from '../landmarks/cultural-builders';
import {openTopPrism,upwardRoofPlane} from '../landmarks/house-geometry';
import spec from './prinsen485-spec.json';
export const openingProbes:{label:string;point:number[];normal:number[];kind:string}[]=[];
export function buildPrinsen485(_w:number,_d:number,b:BuildingTools){
 openingProbes.length=0;type C=Parameters<BuildingTools['add']>[1];
 const add=(g:T.BufferGeometry,c:C,x=0,y=0,z=0,a=0)=>b.add(g,c,x,y,z,a);
 const shape=(r:number[][],holes:number[][][]=[])=>{const s=new T.Shape(r.map(p=>new T.Vector2(...p as[number,number])));for(const h of holes)s.holes.push(new T.Path(h.map(p=>new T.Vector2(...p as[number,number]))));return s;};
 const a=spec.nativeRing[4],q=spec.nativeRing[5],L=Math.hypot(q[0]-a[0],q[1]-a[1]),t=[(q[0]-a[0])/L,(q[1]-a[1])/L],n=[-t[1],t[0]],angle=Math.atan2(-t[1],t[0]);
 const xy=(u:number,out:number)=>[a[0]+u*t[0]+out*n[0],a[1]+u*t[1]+out*n[1]];
 // Native low support follows full installed polygon; its3.7m cap is omitted
 // because all15ownsurvey roofs own their top and native exterior notches.
 add(openTopPrism(shape(spec.nativeRing),0,3.7),'brick');
 for(const r of spec.roofs){
  const at=(x:number,z:number)=>r.plane[0]*x+r.plane[1]*z+r.plane[2];
  const roof=upwardRoofPlane(shape(r.ring,r.holes),0),p=roof.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,at(p.getX(i),p.getZ(i)));roof.computeVertexNormals();add(roof,'slate');
  const wall=openTopPrism(shape(r.ring,r.holes),0,1),v=wall.getAttribute('position');for(let i=0;i<v.count;i++)if(v.getY(i)>.5)v.setY(i,at(v.getX(i),v.getZ(i)));wall.computeVertexNormals();add(wall,'brick');
 }
 const panel=(u:number,y:number,w:number,h:number,d:number,c:C,out=.12)=>{const p=xy(u,out);add(new T.BoxGeometry(w,h,d),c,p[0],y+h/2,p[1],angle);};
 const probe=(label:string,u:number,y:number,out:number,kind='glass')=>{const p=xy(u,out);openingProbes.push({label,point:[p[0],y,p[1]],normal:[n[0],0,n[1]],kind});};
 function window(label:string,u:number,y:number,w:number,h:number,columns=2,rows=3,out=.17){panel(u,y,w,h,.05,'glass',out);for(const k of[-1,1])panel(u+k*(w/2-.055),y,.11,h,.12,'white',out+.06);for(const yy of[y,y+h-.10])panel(u,yy,w,.10,.12,'white',out+.06);for(let k=1;k<columns;k++)panel(u-w/2+w*k/columns,y,.055,h,.10,'white',out+.07);for(let k=1;k<rows;k++)panel(u,y+h*k/rows,w,.05,.10,'white',out+.07);panel(u,y-.08,w+.19,.13,.25,'white',out+.09);for(const f of[.19,.39,.58,.83])probe(`${label}-${f}`,u+(f-.5)*w,y+h*.58,out+.03);}
 // Six observed white-trim bays3+3, two tall tiers and upper shorter tier.
 const centers=[.89,2.61,4.31,6.57,8.29,10.00];
 for(let i=0;i<6;i++){window(`lower-residential-${i}`,centers[i],4.5,1.28,3.13);window(`middle-residential-${i}`,centers[i],8.21,1.28,2.80);window(`upper-residential-${i}`,centers[i],11.55,1.28,1.75,2,2);}
 // Aperture-aware pale garage base: separate piers/fascia around dark gates.
 panel(L/2,3.70,L,.64,.18,'white',.25);panel(L/2,4.34,L,.14,.34,'slate',.29);
 for(const p of[{u:.21,w:.42},{u:5.06,w:.68},{u:9.33,w:.52},{u:10.97,w:.35}])panel(p.u,.08,p.w,3.62,.16,'white',.22);
 for(const [i,g]of [{u:2.54,w:4.20},{u:7.31,w:3.46}].entries()){
  panel(g.u,.14,g.w,2.86,.06,'dark',.18);window(`garage-transom-${i}`,g.u,3.03,g.w,.58,Math.round(g.w/.47),1);
  for(let y=.26;y<2.9;y+=.55)panel(g.u,y,g.w-.18,.045,.055,'slate',.23);
  for(let k=1;k<4;k++)panel(g.u-g.w/2+g.w*k/4,.18,.045,2.65,.055,'slate',.23);
  probe(`garage-${i}`,g.u+g.w*.11,.71,.20,'dark');
 }
 window('shared485-487-entry',10.12,.14,1.05,2.79,2,1);window('entry-transom',10.12,3.03,1.05,.58,2,1);panel(10.12,.02,1.29,.12,.45,'slate',.29);
 panel(L/2,13.60,L,.18,.27,'white',.20);panel(L/2,13.90,L,.28,.44,'white',.24);panel(L/2,14.23,L,.12,.39,'slate',.24);
 // Two independently observed dormer/attic blocks, dark cheeks and white frames.
 // Front owner rings are split to the photo-observed twin sloping profile; original source planes remain in spec.
 for(const d of[{u:2.58,w:3.75,h:2.9},{u:8.26,w:3.0,h:2.02}]){
  panel(d.u,14.32,d.w,d.h,.25,'slate',.28);window(`attic-${d.u}`,d.u,14.48,d.w*.54,d.h*.73,3,2,.47);panel(d.u,14.32+d.h,d.w+.18,.10,.37,'white',.30);
 }
}
