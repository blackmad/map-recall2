import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import data from './beest-boulders-footprints.json';
import { openTopPrism, upwardRoofPlane } from './house-geometry';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original metre-scale shared factory reconstruction; survey coordinates are
 * evidence for shapes, not an imported mesh. Current photos override the
 * survey's flat approximation of the defining northern barrel cladding. */
export function buildBeestBoulders(_w:number,_d:number,tools:BuildingTools){
 const axes=data.nativeAxes,angle=Math.atan2(axes.zEast,axes.xEast);
 function add(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0,a=0){g.rotateY(a+angle);tools.add(g,c,x*axes.xEast+z*axes.zEast,y,x*axes.xSouth+z*axes.zSouth);}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour){add(new T.BoxGeometry(w,h,d),c,x,y+h/2,z);}
 function shape(rings:number[][][]){const s=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[1])));for(const r of rings.slice(1))s.holes.push(new T.Path(r.map(p=>new T.Vector2(p[0],p[1]))));return s;}
 add(openTopPrism(new T.Shape(data.outline.map(p=>new T.Vector2(...p as [number,number]))),0,3.3),'greyBrick');
 const barrelHeight=(z:number)=>8.65+4.05*Math.sin(Math.PI*T.MathUtils.clamp(z/70.6,0,1));
 for(const roof of data.roofs){
  const r=roof.rings[0],cx=r.reduce((s,p)=>s+p[0],0)/r.length,cz=r.reduce((s,p)=>s+p[1],0)/r.length,cy=r.reduce((s,p)=>s+p[2],0)/r.length;
  let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of r){const x=p[0]-cx,z=p[1]-cz,y=p[2]-cy;xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}
  const det=xx*zz-xz*xz,a=Math.abs(det)>1e-8?(xy*zz-zy*xz)/det:0,b=Math.abs(det)>1e-8?(zy*xx-xy*xz)/det:0;
  // AHN surface183 is a narrow south-terrace fit rising6.7m over2.7m.
  // Current side photo has a level upper-storey cornice, not this roof fin;
  // retain its footprint but use the contiguous main roof196 datum.
  const height=roof.sourceSurface===193?(_:number,z:number)=>barrelHeight(z):roof.sourceSurface===183?()=>24.286:(x:number,z:number)=>cy+a*(x-cx)+b*(z-cz);
  let top:T.BufferGeometry=upwardRoofPlane(shape(roof.rings));
  if(roof.sourceSurface===193){
   // Subdivide source triangulation before projection so curved roof follows
   // its photo-supported profile while preserving elevated-office holes.
   const f=top.toNonIndexed(),p=f.getAttribute('position');let tris:number[][]=[];
   for(let i=0;i<p.count;i+=3)tris.push([p.getX(i),p.getZ(i),p.getX(i+1),p.getZ(i+1),p.getX(i+2),p.getZ(i+2)]);
   for(let round=0;round<4;round++){const next:number[][]=[];for(const t of tris){const[a,b,c,d,e,f]=t,ab=(a+c)/2,bd=(b+d)/2,ce=(c+e)/2,df=(d+f)/2,ea=(e+a)/2,fb=(f+b)/2;next.push([a,b,ab,bd,ea,fb],[ab,bd,c,d,ce,df],[ea,fb,ce,df,e,f],[ab,bd,ce,df,ea,fb]);}tris=next;}
   const values:number[]=[];for(const t of tris)for(let i=0;i<6;i+=2)values.push(t[i],height(t[i],t[i+1]),t[i+1]);top=new T.BufferGeometry();top.setAttribute('position',new T.Float32BufferAttribute(values,3));top.computeVertexNormals();f.dispose();
  }else{const p=top.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,height(p.getX(i),p.getZ(i)));top.computeVertexNormals();}
  const colour:Colour=roof.sourceSurface===193?'white':'slate';add(top,colour);
  const walls:number[]=[];for(const ring of roof.rings)for(let i=0;i<ring.length;i++){
   const p=ring[i],q=ring[(i+1)%ring.length],steps=roof.sourceSurface===193?Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/2):1;
   for(let k=0;k<steps;k++){const ax=T.MathUtils.lerp(p[0],q[0],k/steps),az=T.MathUtils.lerp(p[1],q[1],k/steps),bx=T.MathUtils.lerp(p[0],q[0],(k+1)/steps),bz=T.MathUtils.lerp(p[1],q[1],(k+1)/steps),ay=Math.max(3.3,height(ax,az)),by=Math.max(3.3,height(bx,bz));walls.push(ax,3.3,az,bx,3.3,bz,bx,by,bz,ax,3.3,az,bx,by,bz,ax,ay,az);}
  }const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(walls,3));g.computeVertexNormals();add(g,roof.sourceSurface===193?'white':'greyBrick');
 }
 // The photographed street side is x=-20.25. Sparse real tall panes and
 // ground-level doors replace an invented generic grid; exposed projections
 // clear the brick shell. East canal side remains the quieter service wall.
 function westPanel(v:number,y:number,width:number,h:number,c:Colour,offset=.12){box(-20.25-offset,y,v,.08,h,width,c);}
 for(const v of[6,18,30,41,52,63]){westPanel(v,.2,1.35,3.0,'frame');westPanel(v,.35,1.1,2.7,'glass',.18);}
 for(const v of[30,52]){westPanel(v,2.65,2.0,4.8,'frame');westPanel(v,2.8,1.75,4.5,'glass',.18);for(let y=3.9;y<7.3;y+=1.1)westPanel(v,y,1.85,.08,'frame',.23);}
 westPanel(57,.08,7.0,3.2,'frame');westPanel(57,.15,6.7,2.95,'glass',.19);for(const v of[54.8,57,59.2])westPanel(v,.15,.1,2.95,'frame',.24);
 for(let v=2;v<70;v+=5.6){if(![6,18,30,41,52,57,63].some(p=>Math.abs(v-p)<1.0))box(-20.38,0,v,.18,3.3,.22,'concrete');const h=barrelHeight(v);box(-20.34,3.3,v,.10,h-3.3,.085,'white');}
 for(let v=0.5;v<70.4;v+=.7)box(-20.30,3.3,v,.06,barrelHeight(v)-3.3,.035,'concrete');
 // Office glazing visible in aerial/current context; local western brick band
 // and white upper volume remain distinct from both shed and workshop roof.
 for(let v=55;v<68;v+=2.3){box(-13.62,13.0,v,.10,2.2,1.6,'frame');box(-13.70,13.12,v,.08,1.95,1.4,'glass');}
 // Eight original photovoltaic fields on the observed pitched workshop roofs.
 // Panels are geometry with subdued dark colour, never source-photo textures.
 for(const roof of data.roofs.filter(r=>[175,178,179,182,185,186,187,198].includes(r.sourceSurface))){const r=roof.rings[0],xmin=Math.min(...r.map(p=>p[0])),xmax=Math.max(...r.map(p=>p[0])),zmin=Math.min(...r.map(p=>p[1])),zmax=Math.max(...r.map(p=>p[1]));
  // The measured plane rises along length. Keep each cell inside its source
  // ring; geometric point-in-polygon clips irregular ends without roof spill.
  function inside(x:number,z:number){let yes=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
  const c=r.reduce((s,p)=>s+p[2],0)/r.length,zc=r.reduce((s,p)=>s+p[1],0)/r.length,xc=r.reduce((s,p)=>s+p[0],0)/r.length;let xx=0,xz=0,zz=0,xy=0,zy=0;for(const p of r){const dx=p[0]-xc,dz=p[1]-zc,dy=p[2]-c;xx+=dx*dx;xz+=dx*dz;zz+=dz*dz;xy+=dx*dy;zy+=dz*dy;}const det=xx*zz-xz*xz,a=(xy*zz-zy*xz)/det,b=(zy*xx-xy*xz)/det;
  for(let x=xmin+1.1;x<xmax-1;x+=1.4)for(let z=zmin+.9;z<zmax-.9;z+=1.8){if(![[x-.57,z-.7],[x+.57,z-.7],[x+.57,z+.7],[x-.57,z+.7]].every(p=>inside(...p as [number,number])))continue;
   const y=(zz:number)=>c+a*(x-xc)+b*(zz-zc)+.08;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([x-.57,y(z-.7),z-.7,x-.57,y(z+.7),z+.7,x+.57,y(z+.7),z+.7,x-.57,y(z-.7),z-.7,x+.57,y(z+.7),z+.7,x+.57,y(z-.7),z-.7],3));g.computeVertexNormals();add(g,'dark');}
 }
 // Real multicolour circular facade emblem, with no identification lettering.
 for(const [dv,dy,c] of [[-.35,.15,'gold'],[.35,0,'blue'],[0,-.3,'pink']] as const){const ring=new T.TorusGeometry(2.35,.20,4,40);add(ring,c,-20.50,9.1+dy,48+dv,-Math.PI/2);}
 // Current southern panorama shows long workshop frontage as pale structural
 // bays with continuous upper-storey glazing and sparse ground-floor doors.
 for(let z=79;z<168;z+=5.0){box(-20.92,3.9,z,.10,3.1,4.2,'frame');box(-21.01,4.05,z,.08,2.8,3.95,'glass');box(-21.05,3.9,z,.08,3.1,.1,'white');box(-20.88,3.55,z,.20,.28,4.9,'white');box(-20.88,7.05,z,.20,.28,4.9,'white');}
 for(let z=82;z<168;z+=10){box(-20.94,.12,z,.08,2.9,2.1,'frame');box(-21.03,.25,z,.08,2.65,1.9,'glass');}
 // Southern office is a distinct band-and-base assembly. The 2022 native
 // southwest street photos show a roughly two-storey glazed structural base,
 // broad projecting grey-brown spandrels and much narrower recessed upper
 // glazing. Heights below are photo-guided tier proportions, not floor surveys.
 // Roof footprints188/196 establish the actual fronts and setbacks.
 const officeBands=[[8.3,2.2],[11.6,2.2],[14.9,2.2],[18.2,2.2],[21.5,2.2]];
 const officeGlass=[[10.5,1.1],[13.8,1.1],[17.1,1.1],[20.4,1.1],[23.7,.25]];
 type Edge={p:[number,number],q:[number,number],normal:[number,number],height:number,base:boolean,stair?:boolean};
 function officeEdge(e:Edge){
  const p=new T.Vector2(...e.p),q=new T.Vector2(...e.q),delta=q.clone().sub(p),length=delta.length(),tangent=delta.clone().normalize(),normal=new T.Vector2(...e.normal),angle=Math.atan2(-tangent.y,tangent.x);
  function panel(start:number,end:number,y:number,h:number,c:Colour,projection:number,depth:number){if(h<=0||end<=start)return;const mid=p.clone().addScaledVector(tangent,(start+end)/2).addScaledVector(normal,projection);add(new T.BoxGeometry(end-start,h,depth),c,mid.x,y+h/2,mid.y,angle);}
  // The stair/vertical curtain-wall bay interrupts the horizontal ribbons.
  // Its location and width are bounded photo reconstructions on the west face.
  const stair=e.stair?[9.2,12.5]:null;
  function ribbon(y:number,h:number,c:Colour,projection:number,depth:number){
   if(y>=e.height)return;h=Math.min(h,e.height-y);if(!e.base&&y<16.26)return;
   if(stair){panel(0,stair[0],y,h,c,projection,depth);panel(stair[1],length,y,h,c,projection,depth);}else panel(0,length,y,h,c,projection,depth);
  }
  if(e.base){
   panel(.16,length-.16,.15,8.05,'glass',.22,.10);
   // Full-height pale structural columns form large shopfront bays, rather
   // than a repeated equal-height pavement-to-roof window grid.
   const count=Math.ceil(length/5.2);for(let k=0;k<=count;k++){const u=k*length/count;if(stair&&u>stair[0]&&u<stair[1])continue;panel(Math.max(0,u-.20),Math.min(length,u+.20),0,8.3,'concrete',.49,.34);}
   // Photographed opaque lower spandrel panels occupy only the middle of
   // selected shopfront bays; transparent ground and upper transoms remain.
   for(let k=0;k<count;k++)if(k%3!==1){const a=k*length/count+.24,b=(k+1)*length/count-.24;if(stair&&a<stair[1]&&b>stair[0]){panel(a,Math.min(b,stair[0]),3.1,2.75,'greyBrick',.29,.12);panel(Math.max(a,stair[1]),b,3.1,2.75,'greyBrick',.29,.12);}else panel(a,b,3.1,2.75,'greyBrick',.29,.12);}
   panel(.1,length-.1,2.95,.11,'frame',.32,.14);panel(.1,length-.1,6.05,.11,'frame',.32,.14);
  }
  for(const [y,h]of officeBands)ribbon(y,h,'greyBrick',.54,.38);
  for(const [y,h]of officeGlass){ribbon(y,h,'glass',.20,.09);if(y>=e.height)continue;
   const count=Math.ceil(length/3.8);for(let k=1;k<count;k++){const u=k*length/count;if(stair&&u>stair[0]&&u<stair[1])continue;if(!e.base&&y<16.26)continue;panel(u-.065,u+.065,y,Math.min(h,e.height-y),'frame',.27,.11);}
  }
  ribbon(e.height-.32,.32,'greyBrick',.55,.42);
  if(stair){panel(stair[0],stair[1],.15,e.height-.5,'glass',.26,.10);for(const u of[stair[0],stair[0]+1.65,stair[1]])panel(u-.10,u+.10,0,e.height-.32,'concrete',.51,.24);for(let y=3.1;y<e.height;y+=3.3)panel(stair[0],stair[1],y,.10,'frame',.35,.10);}
 }
 officeEdge({p:[-20.7431,171.1784],q:[-20.7431,191.8363],normal:[-1,0],height:24.286,base:true,stair:true});
 // Native west/south/east lower-wing fronts; corner band continuity is
 // preserved across the real stepped width change, without a parcel slab.
 officeEdge({p:[-20.6304,193.0],q:[-20.6304,200.179],normal:[-1,0],height:16.236,base:true});
 officeEdge({p:[-15.0483,200.4],q:[-15.0483,221.7842],normal:[-1,0],height:16.255,base:true});
 officeEdge({p:[-15.0483,221.7842],q:[14.9749,221.8171],normal:[0,1],height:16.255,base:true});
 officeEdge({p:[15.2059,200.4383],q:[15.2059,221.8171],normal:[1,0],height:16.244,base:true});
 // The taller return above the lower wing follows the actual surveyed
 // roof196 perimeter; it never creates floating windows across its setbacks.
 for(const surface of[196,183]){const tower=data.roofs.find(r=>r.sourceSurface===surface)!.rings[0];
 for(let i=0;i<tower.length;i++){const p=tower[i],q=tower[(i+1)%tower.length],dx=q[0]-p[0],dz=q[1]-p[1],length=Math.hypot(dx,dz);if(p[1]<191.80||q[1]<191.80||length<1.5)continue;officeEdge({p:[p[0],p[1]],q:[q[0],q[1]],normal:[-dz/length,dx/length],height:24.286,base:false});}}
 // Canal-side band rhythm is a conservative return of the same assembly;
 // the available southwest photographs do not independently establish its
 // openings; this conservative return remains explicitly inferred.
 officeEdge({p:[20.166,171.2375],q:[20.166,191.9505],normal:[1,0],height:24.265,base:true});
}
