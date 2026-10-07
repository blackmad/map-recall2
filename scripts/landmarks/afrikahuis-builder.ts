import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './afrikahuis-footprints.json';
type C=Parameters<BuildingTools['add']>[1];type P=number[];
/** Original structuralist reconstruction, current BAG envelope in native east/south metres. */
export function buildAfrikahuis(_w:number,_d:number,b:BuildingTools){
 const ring=source.outline[0].slice(0,-1),main=source.roofs.find(r=>r.index===54)!.rings[0],high=source.roofs.find(r=>r.index===55)!.rings[0];
 const shape=(r:P[])=>new T.Shape(r.map(p=>new T.Vector2(p[0],p[1])));
 const flat=(r:P[],y:number,c:C)=>{const g=upwardRoofPlane(shape(r),y);g.userData.explicitRoof=true;b.add(g,c);};
 const panel=(a:P,z:P,y:number,h:number,c:C,depth=.15,offset=0)=>{const dx=z[0]-a[0],dz=z[1]-a[1],L=Math.hypot(dx,dz),nx=-dz/L,nz=dx/L;b.box((a[0]+z[0])/2+nx*offset,y,(a[1]+z[1])/2+nz*offset,L,h,depth,c,Math.atan2(-dz,dx));};
 const detail=(a:P,z:P,t:number,y:number,w:number,h:number,c:C,offset=.12,depth=.08)=>{const dx=z[0]-a[0],dz=z[1]-a[1],L=Math.hypot(dx,dz);b.box(a[0]+dx*t-dz/L*offset,y,a[1]+dz*t+dx/L*offset,w,h,depth,c,Math.atan2(-dz,dx));};
 // Survey top plates: roof54 owns the whole lower linked ring, roof55 only taller east octagon.
 flat(main,9.21,'slate');flat(high,13.09,'slate');
 // No opaque ground extrusion beneath the corner hall: a recessed entrance core and
 // discrete concrete supports retain the street-level sheltered forecourt.
 const core=[[-4,4],[1,2.5],[5,4.6],[6,8.5],[3,11.8],[-2,12.9],[-5,10.8],[-6,6.7]];
 b.add(openTopPrism(shape(core),0,3.12),'glass');flat(core,3.12,'concrete');
 for(const p of [[-8.1,3.6],[-8.5,10.5],[-.6,.9],[6,2.1],[7,11.3]])b.box(p[0],0,p[1],.46,3.05,.46,'concrete');
 // Native perimeter shells are strips so apertures are exposed first-hit surfaces.
 for(let i=0;i<ring.length;i++){
  const a=ring[i],z=ring[(i+1)%ring.length],L=Math.hypot(z[0]-a[0],z[1]-a[1]);if(L<.3)continue;
  const raised=i<=4||i>=42;const tall=i>=24&&i<=32;const stair=[5,6,7,10,11,12,18,19,20,37,38,39,43,44,45].includes(i);
  const y0=raised?3.12:0,top=tall?13.09:9.21;
  if(stair){
   panel(a,z,.18,Math.min(top-.7,7.65),'glass');panel(a,z,7.65,.63,'red',.22,.06);
   for(let u=.32;u<L;u+=.58)detail(a,z,u/L,.18,.055,7.47,'bronze');
   for(const y of [2.8,5.4])detail(a,z,.5,y,L,.055,'bronze');for(let j=0;j<5;j++)detail(a,z,.20+j*.15,2.45+j*.19,.10,5.2-j*.19,'concrete',.19,.065);
   panel(a,z,8.28,top-8.28,'dark');continue;
  }
  if(i!==30&&i!==31)panel(a,z,y0,raised?.72:1.02,'concrete',.25);
  const wallBottom=raised?3.84:1.02,wallTop=tall?12.78:7.90;
  if(tall){
   // Observed presbytery long faces are limestone with narrow high ribbons;
   // the north-west bevel holds a full-width timber bay, not repeated punched windows.
   const bay=i===30||i===31||i===25||i===28;
   for(const y of (i===30||i===31?[4.65,8.28]:[1.12,4.65,8.28])){
    panel(a,z,y,3.05,'stone');
    if(bay){detail(a,z,.5,y+.28,L-.32,2.35,'glass',.16);for(const t of [.06,.32,.50,.68,.94])detail(a,z,t,y+.28,.095,2.35,'red',.22);detail(a,z,.5,y+2.1,L-.25,.08,'red',.22);detail(a,z,.5,y+.05,L,.32,'red',.21);}
    else if(i!==32){detail(a,z,.5,y+2.38,L*.8,.53,'glass',.16);for(let u=.3;u<L*.8;u+=.85)detail(a,z,(L*.1+u)/L,y+2.38,.05,.53,'bronze',.22);}
    panel(a,z,y+3.05,.28,'concrete',.24);
   }
   panel(a,z,11.63,1.15,'stone');
   // Closed chunky concrete roof edge; vertical strip only, explicit roof owns top.
   panel(a,z,12.78,.31,'concrete',.29);
  }else{
   panel(a,z,wallBottom,wallTop-wallBottom,'stone');
   // Limestone courses are shallow native geometry; block joints stop at facade
   // edges and never substitute for missing structural assemblies.
   for(let y=wallBottom+.48;y<wallTop;y+=.48)panel(a,z,y,.009,'greyBrick',.012,.083);
   for(let y=wallBottom;y<wallTop-.3;y+=.48)for(let t=.4+((Math.round((y-wallBottom)/.48)%2)*.55);t<L;t+=1.1)detail(a,z,t/L,y,.008,.48,'greyBrick',.083,.012);
   panel(a,z,7.90,1.09,'dark');for(let t=.25;t<L;t+=2.15)detail(a,z,t/L,7.90,.07,1.17,'bronze');
   // Slight eave fascia above the open shadow/clerestory band.
   panel(a,z,9.08,.13,'green',.30,.015);
   if(!raised&&L>5){detail(a,z,.5,.38,L*.66,.40,'dark',.17);for(let t=.35;t<L*.66;t+=.22)detail(a,z,(L*.17+t)/L,.38,.025,.40,'bronze',.23);}
  }
 }
 // Survey roof55 also has two upper inset edges above the lower9.21m roof.
 // Close these vertical returns without filling the ground entrance/forecourt.
 for(const [a,z] of [[high[0],high[1]],[high[1],high[2]]]){panel(a,z,9.21,3.57,'stone');panel(a,z,12.78,.31,'concrete',.29);}
 // Actual cross at the prominent north-west chamfer, subordinate to the mass.
 const a=ring[0],z=ring[1]; // Source photo cross sits on a long faceted face: use north-west long front.
 const ca=ring[1],cz=ring[2];detail(ca,cz,.5,5.2,.19,1.72,'bronze',.19);detail(ca,cz,.5,5.93,1.05,.18,'bronze',.19);
 // Recessed entrance doors and timber diagonals remain behind the raised hall.
 const da=core[0],dz=core[1];detail(da,dz,.5,.1,2.8,2.45,'dark',.03);for(const t of [.25,.5,.75])detail(da,dz,t,.15,.075,2.4,'bronze',.11);
 // Source2021 presbytery: sheltered ground entrance beneath two upper bays.
 // Two angled door planes meet a recessed finned central concrete core.
 const sa=ring[30],sz=ring[32],sdx=sz[0]-sa[0],sdz=sz[1]-sa[1],sl=Math.hypot(sdx,sdz),snx=-sdz/sl,snz=sdx/sl,sangle=Math.atan2(-sdz,sdx),sx=(sa[0]+sz[0])/2,ss=(sa[1]+sz[1])/2;
 const apex=[sx-snx*1.18,ss-snz*1.18],left=[sa[0]-snx*.12,sa[1]-snz*.12],right=[sz[0]-snx*.12,sz[1]-snz*.12];
 for(const [outer,inner] of [[left,apex],[right,apex]]){
  panel(outer,inner,1.19,2.86,'glass',.12);
  const dl=Math.hypot(inner[0]-outer[0],inner[1]-outer[1]);
  const exposedOffset=outer===right?-.08:.08;
  for(const t of [.04,.50,.96])detail(outer,inner,t,1.19,.11,2.86,'red',exposedOffset);
  for(const y of [1.19,2.78,3.94])detail(outer,inner,.5,y,dl,.13,'red',exposedOffset);
  // Flared concrete beam underside descends towards its central support.
  const dx=inner[0]-outer[0],dz=inner[1]-outer[1],nx=-dz/dl*.15,nz=dx/dl*.15;
  const v:number[]=[];const points=[ [outer[0]+nx,4.10,outer[1]+nz],[inner[0]+nx,3.42,inner[1]+nz],[inner[0]+nx,4.43,inner[1]+nz],[outer[0]+nx,4.43,outer[1]+nz],[outer[0]-nx,4.10,outer[1]-nz],[inner[0]-nx,3.42,inner[1]-nz],[inner[0]-nx,4.43,inner[1]-nz],[outer[0]-nx,4.43,outer[1]-nz] ];
  for(const face of [[0,1,2,3],[7,6,5,4],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]])for(const j of [0,1,2,0,2,3])v.push(...points[face[j]]);
  const beam=new T.BufferGeometry();beam.setAttribute('position',new T.Float32BufferAttribute(v,3));beam.computeVertexNormals();b.add(beam,'concrete');
 }
 b.box(apex[0],1.19,apex[1],.78,3.12,.95,'concrete',sangle);
 for(const u of [-.24,0,.24])b.box(apex[0]+sdx/sl*u+snx*.51,1.19,apex[1]+sdz/sl*u+snz*.51,.105,3.12,.12,'bronze',sangle);
 panel(sa,sz,4.17,.28,'concrete',.34);
 // Broad fanning approach. Seven-riser count and dimensions are bounded
 // photo-guided approximations; no hidden extra treads asserted.
 const at=(u:number,dist:number)=>[sx+sdx/sl*u+snx*dist,ss+sdz/sl*u+snz*dist];
 for(let k=0;k<7;k++){
  const inner=.04+(6-k)*.34,outer=inner+.36,wi=sl+.3+(6-k)*.28,wo=wi+.28;
  const r=[at(-wi/2,inner),at(wi/2,inner),at(wo/2,outer),at(-wo/2,outer)];const sh=shape(r),g=new T.ExtrudeGeometry(sh,{depth:(k+1)*.17,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,(k+1)*.17,0);b.add(g,'concrete');
 }
 // Flat south service wing uses the surveyed envelope; no invented identifying words.
}
