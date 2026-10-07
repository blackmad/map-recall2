import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './haparandaweg-2-4-footprints.json';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original native metre-scale school reconstruction. Roof surveys bound massing;
 * Paul de Ruiter and 2025 municipal photographs establish three facade zones. */
export function buildHaparandaweg24(_w:number,_d:number,b:BuildingTools){
 const add=(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0,a=0)=>b.add(g,c,x,y,z,a);
 const shape=(r:number[][])=>new T.Shape(r.map(p=>new T.Vector2(p[0],p[1])));
 // Explicit measured roofs own the tops. Two tiny elevated strips are equipment,
 // not carrier masses; the slim western canopy is owned separately by region41.
 for(const roof of data.roofs.filter(r=>[37,38,40,41].includes(r.sourceSurface))){
  const r=roof.rings[0],cx=r.reduce((s,p)=>s+p[0],0)/r.length,cz=r.reduce((s,p)=>s+p[1],0)/r.length,cy=r.reduce((s,p)=>s+p[2],0)/r.length;
  let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of r){const x=p[0]-cx,z=p[1]-cz,y=p[2]-cy;xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}
  const det=xx*zz-xz*xz,a=(xy*zz-zy*xz)/det,c=(zy*xx-xy*xz)/det,height=(x:number,z:number)=>cy+a*(x-cx)+c*(z-cz);
  // Source roof37 is the central sloping glazed atrium enclosure; lower roof38
  // is the south terrace. Neither extends beyond its own native ring.
  const s=shape(r);const top=upwardRoofPlane(s),p=top.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,height(p.getX(i),p.getZ(i)));top.computeVertexNormals();
  // Survey rings contain near-collinear millimetre remnants. Remove only tiny
  // top triangles before quantization; otherwise their winding can reverse.
  const flat=top.toNonIndexed(),pa=flat.getAttribute('position'),values:number[]=[];for(let i=0;i<pa.count;i+=3){const v=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(pa,i+k)),n=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));if(Math.abs(n.y)/2<.025)continue;for(const p of v)values.push(p.x,p.y,p.z);}
  const clean=new T.BufferGeometry();clean.setAttribute('position',new T.Float32BufferAttribute(values,3));clean.computeVertexNormals();add(clean,roof.sourceSurface===37?'glass':'slate');flat.dispose();top.dispose();
  if(roof.sourceSurface===41){add(openTopPrism(s,4.40,4.59),'concrete');continue;}
  const walls:number[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],py=height(p[0],p[1]),qy=height(q[0],q[1]);walls.push(p[0],0,p[1],q[0],0,q[1],q[0],qy,q[1],p[0],0,p[1],q[0],qy,q[1],p[0],py,p[1]);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(walls,3));g.computeVertexNormals();add(g,'dark');
 }
 // Source footprint has no courtyard. The atrium is enclosed and roofed rather
 // than an open court; preserve its central bounded low roof within northern top.
 const out=data.outline[0];
 const faces=[{name:'south',a:out[15],z:out[17],bays:14},{name:'east',a:out[17],z:out[0],bays:20},{name:'north',a:out[0],z:out[3],bays:14},{name:'west',a:out[3],z:out[15],bays:20}];
 for(const face of faces){const west=face.name==='west',south=face.name==='south',east=face.name==='east';const [ax,az]=face.a,[bx,bz]=face.z,L=Math.hypot(bx-ax,bz-az),ux=(bx-ax)/L,uz=(bz-az)/L,nx=-uz,nz=ux,angle=Math.atan2(-uz,ux),pitch=L/face.bays;
  function panel(u:number,y:number,w:number,h:number,d:number,c:Colour,out=.10){add(new T.BoxGeometry(w,h,d),c,ax+ux*u+nx*out,y+h/2,az+uz*u+nz*out,angle);}
  // Native map rendering exposed precision fighting with the former17-20mm
  // slat/backing gaps. Keep continuous slat geometry behind the timber frame
  // fronts, with measured export separation over140mm. No shader depth bias.
  function louver(u:number,y:number,w:number,c:Colour,out=.22){const g=new T.PlaneGeometry(w,.04);add(g,c,ax+ux*u+nx*out,y+.02,az+uz*u+nz*out,angle);}
  function glazed(u:number,y:number,w:number,h:number){panel(u,y,w,h,.06,'glass',.16);for(const f of[0,.36,.68,1])panel(u,y+f*h-.025,w,.055,.08,'frame',.205);for(const s of[-1,1])panel(u+s*(w/2-.035),y,.07,h,.08,'frame',.205);}
  for(let k=0;k<face.bays;k++){const u=(k+.5)*pitch,x=ax+ux*u,z=az+uz*u+nz*.12,north=z<14.5;
   const west=face.name==='west',south=face.name==='south',east=face.name==='east';
   const wide=west&&k>=10&&k<15,red=(west&&k<10)||(east&&k>=8&&k<15)||(face.name==='north'&&k>=9);
   const c:Colour=wide?'red':red?'copper':'gold',colWidth=wide?pitch*.59:pitch*.32,glassWidth=pitch-colWidth-.15;
   // Original coloured enamel glass beside narrow continuous vertical panes;
   // opaque grey spandrels separate the classrooms at actual slab datums.
   const fullHeight=south||face.name==='north',bottom=fullHeight?.25:3.6;panel(u+pitch/2-colWidth/2-.05,bottom,colWidth,12.72-bottom,.075,c,.13);
   const paneU=u-colWidth/2;
   for(const y of fullHeight?[.25,4.25,8.25]:[4.15,8.30]){glazed(paneU,y,glassWidth,3.03);panel(paneU,y+3.04,glassWidth,.97,.08,'concrete',.145);}
   if(!fullHeight){glazed(u,.18,pitch-.12,3.22);panel(u,.05,pitch,.13,.09,'concrete',.23);}
   // Sun shading wood frames remain projecting, without hiding the glazing.
   panel(k*pitch+.05,fullHeight?.10:3.45,.12,12.85-(fullHeight?.10:3.45),.70,'bronze',.34);
   panel(u,12.76,pitch+.06,.16,.70,'bronze',.34);
   // West entrance broad orange composition reaches to the low entrance floor.
   if(wide&&k!==13){panel(u+pitch/2-colWidth/2-.05,.15,colWidth,3.48,.08,'red',.25);}
  }
  // Silver sports halls have an independent large-module grid. Sources show
  // seven narrower northern west modules followed by two broad middle modules;
  // north has three broad yellow-side modules and four orange-side modules.
  // The small height difference is a photo-supported screen/parapet step over
  // the survey roof, not a changed whole-building roof elevation.
  const moduleEnds=west?[0, .52/7, .52*2/7, .52*3/7, .52*4/7, .52*5/7, .52*6/7, .52, .64, .76]:face.name==='north'?[0,.2,.4,.6,.7,.8,.9,1]:east?[.24,.36,.48,.58,.68,.78,.89,1]:[];
  for(let k=0;k<moduleEnds.length-1;k++){const left=moduleEnds[k]*L,right=moduleEnds[k+1]*L,u=(left+right)/2,w=right-left,top=west?(moduleEnds[k]<.52?21.9:21.3):face.name==='north'?(moduleEnds[k]<.6?21.3:21.9):21.3,base=12.92;
   panel(u,base,w-.12,top-base-.08,.08,'white',.145);for(let y=base+.11;y<top-.1;y+=.44)louver(u,y,w-.16,'concrete',.335);panel(left+.04,base,.12,top-base,.66,'bronze',.32);panel(u,top-.08,w+.1,.16,.68,'bronze',.33);
  }
  // Above-deck terrace enclosure, supported by architect terrace and dated
  // west/south views. No replacement of the upper classroom glazing below it.
  const guardEnds=south?[0,.25,.5,.75,1]:west?[.76,.84,.92,1]:east?[0,.08,.16,.24]:[];
  for(let k=0;k<guardEnds.length-1;k++){const left=guardEnds[k]*L,right=guardEnds[k+1]*L,u=(left+right)/2,w=right-left,base=12.86,h=2.34;
   panel(u,base,w-.12,h,.065,'glass',.20);panel(left+.045,base,.09,h,.42,'bronze',.27);panel(u,base+h-.07,w+.04,.14,.44,'bronze',.27);if(south)for(let y=base+.14;y<base+h-.14;y+=.32)louver(u,y,w-.16,'white',.385);
  }
  panel(L-.05,3.45,.12,9.4,.70,'bronze',.34);panel(L/2,3.43,L,.18,.65,'bronze',.34);
  // Physical door leaves and a shallow canopy make the lower apertures legible.
  const doorU=face.name==='south'?L*.61:west?L*.68:east?L*.37:L*.15;
  if(south||west||east){const threshold=west?.64:.10;glazed(doorU,threshold,2.15,2.8);panel(doorU,threshold,.08,2.8,.09,'frame',.30);panel(doorU-.8,threshold+.9,.035,.45,.08,'white',.33);panel(doorU+.8,threshold+.9,.035,.45,.08,'white',.33);}
  if(west){ // Source-supported external stepped forecourt; suppression stays exact.
   // Four useful0.65m tread runs arrive at a0.64m door threshold. Geometry
   // extends into the observed west schoolyard, never into an adjacent building.
   const landingEdge=-.04,totalRun=3.58;for(let k=0;k<4;k++){const near=landingEdge,far=landingEdge+totalRun-k*.65;panel(L*.62,0,L*.32,(k+1)*.16,far-near,'concrete',(near+far)/2);}
  }
 }
 // Every exposed atrium perimeter segment follows its sloped roof endpoint
 // heights. The main roof shell has its notch backed at the same plane, so the
 // outward glazing offset is necessary to expose panes on both sides.
 const atrium=data.roofs.find(r=>r.sourceSurface===37)!.rings[0];
 for(let k=0;k<atrium.length;k++){const a=atrium[k],c=atrium[(k+1)%atrium.length],dx=c[0]-a[0],dz=c[1]-a[1],L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L,nx=-uz,nz=ux,angle=Math.atan2(-uz,ux),base=12.84;
  const values:number[]=[a[0]+nx*.08,base,a[1]+nz*.08,c[0]+nx*.08,base,c[1]+nz*.08,c[0]+nx*.08,c[2],c[1]+nz*.08,a[0]+nx*.08,base,a[1]+nz*.08,c[0]+nx*.08,c[2],c[1]+nz*.08,a[0]+nx*.08,a[2],a[1]+nz*.08];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(values,3));g.computeVertexNormals();add(g,'glass');const inner=g.clone();inner.translate(-nx*.16,0,-nz*.16);add(inner,'glass');
  for(let u=.08;u<L;u+=2.4){const h=T.MathUtils.lerp(a[2],c[2],u/L)-base;add(new T.BoxGeometry(.07,h,.08),'frame',a[0]+ux*u+nx*.115,base+h/2,a[1]+uz*u+nz*.115,angle);}
 }
 // Source terrace photo shows silver hall ends and white upper returns above
 // the glazed enclosure. Cover the actual inner hall faces above the atrium.
 const hall=data.roofs.find(r=>r.sourceSurface===40)!.rings[0];
 for(let k=0;k<5;k++){const a=hall[k],c=hall[k+1],dx=c[0]-a[0],dz=c[1]-a[1],L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L,nx=-uz,nz=ux,angle=Math.atan2(-uz,ux),base=k===0||k===4?12.86:18.10,top=Math.min(a[2],c[2]),mx=(a[0]+c[0])/2+nx*.09,mz=(a[1]+c[1])/2+nz*.09;
  add(new T.BoxGeometry(L,top-base,.26),'white',mx-nx*.09,(base+top)/2,mz-nz*.09,angle);for(let y=base+.12;y<top-.1;y+=.44)add(new T.BoxGeometry(L,.03,.06),'concrete',mx+nx*.24,y,mz+nz*.24,angle);
 }
 // Quiet geometric rooftop photovoltaics, bounded to north roof and separated
 // from the atrium. Their existence is architect-supported; exact count simplified.
 for(const x of[-14,-10,-6,0,5,10,14])for(const z of[-20,-15,-10]){const g=new T.BoxGeometry(2.4,.045,3.5);g.rotateX(.10);add(g,'dark',x,21.36,z);}
}
