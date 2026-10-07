import * as T from 'three';import type {BuildingTools} from './cultural-builders';import data from './haparandaweg-8-338-footprints.json';import {openTopPrism,upwardRoofPlane} from './house-geometry';
type C=Parameters<BuildingTools['add']>[1];
/** Original, native metres. AHN5 bounded roofs, architect and dated2025municipal photos. */
export function buildHaparandaweg8338(_w:number,_d:number,b:BuildingTools){
 const add=(g:T.BufferGeometry,c:C,x=0,y=0,z=0,a=0)=>b.add(g,c,x,y,z,a);
 const shape=(rings:number[][][])=>{const s=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[1])));for(const r of rings.slice(1))s.holes.push(new T.Path(r.map(p=>new T.Vector2(p[0],p[1]))));return s;};
 const main=[165,173,174,186,187],colour=(id:number,x:number):C=>id===187?'gold':id===174?(x<-26?'brick':'stone'):id===173?(x<14?'ochre':'brick'):id===165?'brick':x<-24?'stone':x<3.6?'brick':'stone';
 function face(a:number[],q:number[],base:number,top:number,c:C,n:number,style:'grid'|'gallery'|'ochre'|'shop'|'glazed'|'loggia'='grid',floorsOverride?:number,clipEnd=0){
  const L=Math.hypot(q[0]-a[0],q[1]-a[1]),ux=(q[0]-a[0])/L,uz=(q[1]-a[1])/L,nx=-uz,nz=ux,angle=Math.atan2(-uz,ux),pitch=L/n;
  const panel=(u:number,y:number,w:number,h:number,d:number,col:C,out=.14)=>add(new T.BoxGeometry(w,h,d),col,a[0]+ux*u+nx*out,y+h/2,a[1]+uz*u+nz*out,angle);
  const plane=(u:number,y:number,w:number,h:number,col:C,out=.24)=>add(new T.PlaneGeometry(w,h),col,a[0]+ux*u+nx*out,y+h/2,a[1]+uz*u+nz*out,angle);
  const frame=(u:number,y:number,w:number,h:number,col:C,glazedWidth=w)=>{plane(u,y,glazedWidth,h,'glass');for(const s of[-1,1])plane(u+s*(w/2-.045),y,.09,h,col,.29);for(const yy of[y,y+h-.09])plane(u,yy,w,.09,col,.295);if(style==='ochre'){plane(u,y,.065,h,col,.30);plane(u,y+h*.36,w,.065,col,.30);plane(u-w*.28,y,.065,h,col,.30);plane(u+w*.28,y,.065,h,col,.30);}else if(style==='gallery')plane(u,y,.065,h,col,.30);};
  const rail=(u:number,y:number,w:number,col:C)=>{plane(u,y,w,.055,col,.635);plane(u,y+1,w,.055,col,.635);for(let t=-w/2;t<=w/2+.01;t+=.19)plane(u+t,y,.035,1,col,.635);};
  plane(L/2,base,L,top-base,c,.205);
  // The source lower khaki level is a continuous curtain wall; only slender
  // white mullions interrupt glazing, with no residential masonry piers.
  if(style==='glazed'){
   plane(L/2,base+.10,L-.16,top-base-.20,'glass',.245);
   for(let k=0;k<=n*2;k++)plane(.08+(L-.16)*k/(n*2),base+.10,.065,top-base-.20,'white',.30);
   for(const yy of[base+.04,top-.08])plane(L/2,yy,L,.075,'white',.31);
   return;
  }
  const floors=floorsOverride??Math.round((top-base)/3.15),fh=(top-base)/floors;
  for(let j=0;j<floors;j++){const y=base+j*fh+.26,wh=fh-.65,fr:C=style==='ochre'?'white':c==='brick'?'copper':'frame';for(let k=0;k<n;k++){let u=(k+.5)*pitch,w=pitch-(style==='ochre'?.72:.62);if(k===n-1&&clipEnd){u-=clipEnd/2;w-=clipEnd;}if((style==='grid'&&c==='brick')||style==='loggia'){frame(u-w*.11,y,w*.76,wh,fr);plane(u+w*.41,y,w*.18,wh,'dark',.25);rail(u+w*.41,y,w*.18,fr);}else{frame(u,y,w,wh,fr,style==='grid'&&c==='stone'?w*.68:w);if(style==='grid'&&c==='stone'){plane(u,y,w*.10,wh,'white',.31);for(const ss of[-1,1]){plane(u+ss*w*.43,y,w*.14,wh,'dark',.25);rail(u+ss*w*.43,y,w*.14,fr);}}if(style==='gallery')rail(u,y,w,fr);}if(style==='grid'&&c==='brick')panel(u,y+wh,w,.28,.18,'copper',.18);}
   panel(L/2,base+j*fh,L,style==='gallery'?.22:.25,style==='gallery'?.92:.45,style==='gallery'?'white':c,style==='gallery'?.44:.22);
  }
  for(let k=0;k<=n;k++)panel(k*pitch,base,.27,top-base,.48,c,.235);
  panel(L/2,top-.20,L,.2,.48,c,.235);
 }
 // Separate surfaces retain all surveyed height changes. Courtyard is a raised
 // deck over commercial/parking plinth; no opaque tower across its open air.
 for(const roof of data.roofs){const id=roof.sourceSurface,r=roof.rings[0],h=r.reduce((s,p)=>s+p[2],0)/r.length,s=shape(roof.rings),cx=r.reduce((s,p)=>s+p[0],0)/r.length,c=colour(id,cx);let bottom=main.includes(id)?0:h-.5;if(id===175)bottom=h-.18;if([179,180,181].includes(id))bottom=h-.12;if(id===166)bottom=17.15;
  // Surface166 is the broad pale pavilion cap, not the glazing footprint.
  // Inset transparent walls below its source-observed cantilever; preserve roof hole.
  if(id===166){const centre=new T.Vector2(cx,r.reduce((s,p)=>s+p[1],0)/r.length);const inset=roof.rings.map((ring,j)=>ring.map(p=>{if(j)return p;const v=new T.Vector2(p[0],p[1]),d=v.clone().sub(centre),scale=Math.max(0,(d.length()-.9)/d.length());return [centre.x+d.x*scale,centre.y+d.y*scale,p[2]];}));add(openTopPrism(shape(inset),bottom,h-.5),'glass');add(openTopPrism(s,h-.5,h),'white');}
  else add(openTopPrism(s,bottom,h),main.includes(id)?c:'concrete');
  const top=upwardRoofPlane(s,h),flat=top.toNonIndexed(),pa=flat.getAttribute('position'),v:number[]=[];
  for(let i=0;i<pa.count;i+=3){const p=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(pa,i+k));if(p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0])).length()/2<.03)continue;for(const q of p)v.push(q.x,q.y,q.z);}
  const clean=new T.BufferGeometry();clean.setAttribute('position',new T.Float32BufferAttribute(v,3));clean.computeVertexNormals();add(clean,id===187?'green':[166,175].includes(id)?'white':'slate');top.dispose();flat.dispose();
 }
 // Long observed street-front chains, with slight surveyed rotation.
 face([35,-25.3],[3.6,-26.1],0,31.5,'stone',8);face([3.6,-27.4],[-24.3,-28],0,31.5,'brick',7);face([-24.6,-26.2],[-33.2,-26.8],0,31.5,'stone',2,'loggia');
 // The north building's east side has apertures; east southern side is largely
 // pale blind end-wall in full context image, so preserve that blank end-plane.
 face([34.6,-10.1],[35,-25.3],0,31.5,'brick',4);
 face([-33.2,-26.8],[-33.8,-4.8],0,31.5,'stone',6);
 face([-33.8,-4.8],[-34.6,27.8],0,22.45,'brick',8);
 face([-34.6,27.8],[-26,27.7],0,22.45,'brick',2);face([-26,27.7],[-19.4,27.6],0,22.45,'stone',1);
 face([-18.8,17.7],[-18.7,-4.5],4.25,22.45,'stone',6);
 face([-4,16.1],[-3.7,27.9],4.2,17.12,'ochre',3,'ochre');
 face([-2.7,28.5],[14,28.9],7.35,17.12,'ochre',5,'ochre',3);face([-2.7,28.5],[14,28.9],4.2,7.35,'ochre',5,'glazed',1);face([14,28.9],[33.7,29.4],0,17.12,'brick',5);
 // Courtyard galleries: pale cantilevered slab bands with warm frames and rails.
 // Survey165's visible courtyard perimeter owns these gallery openings.
 // The former straight chord behind this angled core was not exterior facade.
 face([-18.347960383,-4.499712032],[-15.868219123,-4.449261464],4.25,28.1,'brick',1,'gallery');
 // The short surveyed chamfer is a solid corner return, not an invented tiny bay.
 face([-15.092495721,-3.704389184],[-8.764939643,-7.489224184],4.25,28.1,'brick',2,'gallery');face([-8.4,-12.9],[5.4,-12.6],4.25,28.1,'brick',4,'gallery');face([5.6,-11.2],[34.6,-10.1],4.25,31.5,'brick',7);
 face([34.1,12.4],[-3.4,12],4.25,17.1,'ochre',10,'ochre');// Current context reference establishes this eastern end as a pale blind wall.
 const endA=[33.7,29.4],endB=[34.1,12.4],endL=Math.hypot(endB[0]-endA[0],endB[1]-endA[1]);add(new T.BoxGeometry(endL,17.1,.16),'concrete',34.12,8.55,20.9,Math.atan2(-(endB[1]-endA[1]),endB[0]-endA[0]));
 // Ground-floor commercial openings on southern podium. Taller glass wall above.
 face([-18.4,28.1],[-2.7,28.5],0,4.18,'gold',4,'shop');
 // Current municipal view and architect3 continue alternating shop/door bays
 // below the khaki wing; it belongs to survey173, not the neighboring podium.
 face([-2.7,28.5],[14,28.9],0,4.18,'gold',4,'shop');
 const frontageA=[-2.7,28.5],frontageB=[14,28.9],fl=Math.hypot(16.7,.4),fu=16.7/fl,fz=.4/fl,fnx=-fz,fnz=fu,fa=Math.atan2(-fz,fu);
 for(let k=0;k<4;k++){
  const u=(k+.5)*fl/4,door=k%2===1,w=fl/4-.62;
  add(new T.PlaneGeometry(.07,3.52),door?'white':'frame',frontageA[0]+fu*u+fnx*.31,1.98,frontageA[1]+fz*u+fnz*.31,fa);
  add(new T.BoxGeometry(w,.10,.44),'concrete',frontageA[0]+fu*u+fnx*.22,.10,frontageA[1]+fz*u+fnz*.22,fa);
 }
 // Dated2025 view: yellow/white projecting shop awning. The photo establishes
 // span/striping; 1.5m projection and mounting heights are approximate.
 const canopySpan=fl-.48,canopyStart=.24,stripeCount=22;
 for(let k=0;k<stripeCount;k++){
  const w=canopySpan/stripeCount,u=canopyStart+(k+.5)*w,col:C=k%2?'white':'bronze';
  const g=new T.BoxGeometry(w,.045,1.52);g.rotateX(.29);
  add(g,col,frontageA[0]+fu*u+fnx*.98,3.76,frontageA[1]+fz*u+fnz*.98,fa);
  add(new T.BoxGeometry(w,.20,.06),col,frontageA[0]+fu*u+fnx*1.72,3.43,frontageA[1]+fz*u+fnz*1.72,fa);
 }
 const p=(x:number,y:number,z:number,w:number,h:number,d:number,c:C)=>add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z);
 // Source-supported white podium and roof safety rails; thin bars remain geometry.
 for(let x=-18.3;x<-3;x+=.22)p(x,4.22,28.0,.035,1.05,.055,'white');p(-10.7,5.22,28,15.5,.055,.08,'white');
 for(const [x0,x1,z,h] of [[-33,-19,27.8,22.5],[-3,34,29,17.2],[-33,35,-26.7,31.5]]){p((x0+x1)/2,h+1,z,x1-x0,.045,.06,'white');for(let x=x0;x<x1;x+=1.5)p(x,h,z,.045,1,.06,'white');}
 // Roof pavilion is the measured20.5m southern volume, entirely above lower roof.
 const pavilion=data.roofs.find(v=>v.sourceSurface===166)!.rings[0],pcx=pavilion.reduce((s,p)=>s+p[0],0)/pavilion.length,pcz=pavilion.reduce((s,p)=>s+p[1],0)/pavilion.length;
 const glazingEdge=pavilion.map(p=>{const d=Math.hypot(p[0]-pcx,p[1]-pcz),f=(d-.9)/d;return [pcx+(p[0]-pcx)*f,pcz+(p[1]-pcz)*f];});
 for(let i=0;i<glazingEdge.length;i++){const a=glazingEdge[i],q=glazingEdge[(i+1)%glazingEdge.length],dx=q[0]-a[0],dz=q[1]-a[1],L=Math.hypot(dx,dz);if(L<4)continue;const ang=Math.atan2(-dz,dx),sign=(dz*((a[0]+q[0])/2-pcx)-dx*((a[1]+q[1])/2-pcz))>=0?1:-1,nx=sign*dz/L,nz=-sign*dx/L;
  // Mullions follow the actual inset planar wall, outside its first-hit surface.
  for(let t=0;t<=L;t+=2)add(new T.BoxGeometry(.07,2.8,.09),'white',a[0]+dx*t/L+nx*.08,18.55,a[1]+dz*t/L+nz*.08,ang);
 }

 // Photo-derived airbridge spans the west wing to the south roof at16–17m.
 // Survey175 is a separate inner south-facade cantilever band at13.73m.
 const ba=new T.Vector3(-18.8,16.6,17.7),bq=new T.Vector3(-3.6,17.05,17.0),dir=bq.clone().sub(ba),mid=ba.clone().add(bq).multiplyScalar(.5),yaw=Math.atan2(-dir.z,dir.x),length=dir.length();const bridge=new T.BoxGeometry(length,.28,1.75);bridge.rotateZ(Math.atan2(dir.y,Math.hypot(dir.x,dir.z)));add(bridge,'white',mid.x,mid.y,mid.z,yaw);for(const side of[-1,1]){const g=new T.BoxGeometry(length,1.12,.10);g.rotateZ(Math.atan2(dir.y,Math.hypot(dir.x,dir.z)));add(g,'concrete',mid.x+Math.sin(yaw)*side*.85,mid.y+.65,mid.z+Math.cos(yaw)*side*.85,yaw);}
 // Retain surveyed175 slab; unsupported glass/parapet overlay removed.
}
