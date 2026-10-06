import * as T from 'three';
import type { BuildingTools } from './cultural-builders';
import data from './willem-de-zwijger-frontage-footprints.json';
import { openTopPrism, upwardRoofPlane } from './house-geometry';
import {frontageSignGeometry, padelWordmarkGeometry, padelEmblemGeometry} from './willem-de-zwijger-frontage-signs';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original metre-scale shared factory reconstruction; survey coordinates are
 * evidence for shapes, not an imported mesh. Current photos override the
 * survey's flat approximation of the defining northern barrel cladding. */
export function buildWillemDeZwijgerFrontage(_w:number,_d:number,tools:BuildingTools,addDecal?:(geometry:T.BufferGeometry,hex:string)=>void){
 const axes=data.nativeAxes,angle=Math.atan2(axes.zEast,axes.xEast);
 function add(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0,a=0){g.rotateY(a+angle);tools.add(g,c,x*axes.xEast+z*axes.zEast,y,x*axes.xSouth+z*axes.zSouth);}
 function paint(g:T.BufferGeometry,c:Colour,hex:string,x=0,y=0,z=0){
  if(!addDecal){add(g,c,x,y,z);return;}
  g.rotateY(angle);g.translate(x*axes.xEast+z*axes.zEast,y,x*axes.xSouth+z*axes.zSouth);addDecal(g,hex);
 }
 // Paint follows each actual folded/strip surface, without a floating
 // carrier board. Clip the original filled SVG triangles at every fold
 // boundary; applying a profile only to original vertices would bridge ribs.
 function surfacePaint(g:T.BufferGeometry,hex:string,y:number,z:number,axis:'y'|'z',cuts:number[],surface:(coordinate:number,intervalMid:number)=>number){
  g.rotateY(-Math.PI/2);g.translate(0,y,z);
  const source=g.index?g.toNonIndexed():g,p=source.getAttribute('position'),values:number[]=[];
  const coord=(v:T.Vector3)=>axis==='y'?v.y:v.z;
  function clip(poly:T.Vector3[],edge:number,above:boolean){const result:T.Vector3[]=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ca=coord(a),cb=coord(b),ia=above?ca>=edge:ca<=edge,ib=above?cb>=edge:cb<=edge;if(ia)result.push(a);if(ia!==ib)result.push(a.clone().lerp(b,(edge-ca)/(cb-ca)));}return result;}
  for(let i=0;i<p.count;i+=3){const tri=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,i+k)),lo=Math.min(...tri.map(coord)),hi=Math.max(...tri.map(coord));
   const edges=[lo,...cuts.filter(c=>c>lo+1e-8&&c<hi-1e-8),hi];
   for(let k=0;k<edges.length-1;k++){const a=edges[k],b=edges[k+1];if(b-a<1e-8)continue;const poly=clip(clip(tri,a,true),b,false),mid=(a+b)/2;
    for(const v of poly)v.x=surface(coord(v),mid)-.004;
    for(let j=1;j<poly.length-1;j++)for(const v of[poly[0],poly[j],poly[j+1]])values.push(v.x,v.y,v.z);
   }
  }
  const attached=new T.BufferGeometry();attached.setAttribute('position',new T.Float32BufferAttribute(values,3));attached.computeVertexNormals();attached.userData={...g.userData,attachment:'source-cladding-profile',clearanceMetres:.004};paint(attached,'copper',hex);
  if(source!==g)source.dispose();g.dispose();
 }
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
   const p=ring[i],q=ring[(i+1)%ring.length];
   // Open the actual central west facade for source-observed recessed loggias.
   // A continuous wall here would bury the complete rear glazing plane.
   if(roof.sourceSurface===200&&p[0]<-19&&q[0]<-19&&Math.hypot(q[0]-p[0],q[1]-p[1])>10)continue;
   const steps=roof.sourceSurface===193?Math.ceil(Math.hypot(q[0]-p[0],q[1]-p[1])/2):1;
   for(let k=0;k<steps;k++){const ax=T.MathUtils.lerp(p[0],q[0],k/steps),az=T.MathUtils.lerp(p[1],q[1],k/steps),bx=T.MathUtils.lerp(p[0],q[0],(k+1)/steps),bz=T.MathUtils.lerp(p[1],q[1],(k+1)/steps),ay=Math.max(3.3,height(ax,az)),by=Math.max(3.3,height(bx,bz));walls.push(ax,3.3,az,bx,3.3,bz,bx,by,bz,ax,3.3,az,bx,by,bz,ax,ay,az);}
  }const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(walls,3));g.computeVertexNormals();add(g,roof.sourceSurface===193?'white':'greyBrick');
 }
 // Full west-front assembly is authored independently below.
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
 // Full western frontage and real flat graphic signs.
 // Principal street front is native x=-20.25; no parcel expansion or
 // opposite-address suppression. Dimensions below are photo-guided bounds.
 function westPanel(z:number,y:number,width:number,h:number,c:Colour,out=.22){const wallX=z>=70.4?-20.77:-20.25;box(wallX-out,y,z,.055,h,width,c);}
 function westWindow(z:number,y:number,w:number,h:number,divisions=1){
  westPanel(z,y,w,h,'dark',.26);westPanel(z,y+.065,w-.13,h-.13,'glass',.305);
  for(let k=0;k<=divisions;k++)westPanel(z-w/2+k*w/divisions,y,.065,h,'frame',.35);
  westPanel(z,y,w,.065,'frame',.35);westPanel(z,y+h-.065,w,.065,'frame',.35);
 }
 // Sparse aperture rhythm in the masonry plinth; these are windows/doors,
 // not a generic equal-height storefront grid.
 for(const z of[6,18,30,41,52])westWindow(z,.18,1.32,3.02);
 for(const z of[30,52]){westWindow(z,3.20,1.32,3.85);for(const y of[4.35,5.65])westPanel(z,y,1.32,.065,'frame',.35);}
 // This source entrance carries CrossFit lettering on its tall glazing,
 // immediately before the lower Padel wing rather than inside that wing.
 westWindow(57,.10,5.0,4.80,1);
 // Door mullions finish below the uninterrupted lettered transom.
 for(const z of[57-5/6,57+5/6])westPanel(z,.10,.065,3.23,'frame',.35);
 // Current entrance crops expose two broad dark industrial garage leaves.
 for(const z of[62.0,67.0]){
  westPanel(z,0,4.55,4.75,'frame',.29);westPanel(z,.08,4.30,4.56,'dark',.35);
  for(let y=.65;y<4.5;y+=.48)westPanel(z,y,4.29,.024,'frame',.384);
 }
 for(let z=2;z<=70;z+=5.55){
  if([6,18,30,41,52].some(v=>Math.abs(z-v)<.85)||Math.abs(z-57)<2.7||[62,67].some(v=>Math.abs(z-v)<2.5))continue;
  box(-20.59,0,z,.16,3.3,.18,'concrete');
 }
 // Fine shallow folded ridges retain the large continuous corrugated wall.
 // Two sloped facets per rib are cheaper and flatter than tall rectangular fins.
 const ridges:number[]=[];
 for(let z=.10;z<70.5;z+=.22){
  const h=Math.min(barrelHeight(z)-.035,barrelHeight(z+.06)-.035);
  if([30,52].some(v=>Math.abs(z-v)<.76))continue;
  for(const [a,b,xa,xb] of [[z-.045,z,-20.265,-20.305],[z,z+.045,-20.305,-20.265]]){
   ridges.push(xa,3.3,a,xb,3.3,b,xb,h,b,xa,3.3,a,xb,h,b,xa,h,a);
  }
 }
 const ribs=new T.BufferGeometry();ribs.setAttribute('position',new T.Float32BufferAttribute(ridges,3));ribs.computeVertexNormals();add(ribs,'concrete');
 // The actual source-supported emblem uses the operator's clean SVG
 // paths, including its twelve dots. It is flat paint, not raised hoops.
 const hallRing=data.roofs.find(r=>r.sourceSurface===193)!.rings[0];
 function hallWallX(z:number){const intersections:number[]=[];for(let i=0;i<hallRing.length;i++){const p=hallRing[i],q=hallRing[(i+1)%hallRing.length];if(z>=Math.min(p[1],q[1])&&z<=Math.max(p[1],q[1])&&Math.abs(q[1]-p[1])>1e-8)intersections.push(p[0]+(q[0]-p[0])*(z-p[1])/(q[1]-p[1]));}return Math.min(...intersections);}
 const hallCuts:number[]=[];for(let c=.10;c<70.5;c+=.22)hallCuts.push(c-.045,c,c+.045);
 function hallSurface(z:number,mid:number){const c=.10+Math.round((mid-.10)/.22)*.22;return Math.abs(mid-c)<.045?Math.min(hallWallX(z),-20.305+Math.abs(z-c)*(.04/.045)):hallWallX(z);}
 for(const {geometry:g,hex}of padelEmblemGeometry(5.16))surfacePaint(g,hex,9.15,48,'z',hallCuts,hallSurface);
 // Central lower wing: current2025 views show recessed upper loggias
 // mixed with flat full-height glazing. Source200 carrier wall is removed
 // above the brick plinth so the rear planes and white returns stay exposed.
 const wingStart=70.3755,wingEnd=169.7433,bays=19,wingPitch=(wingEnd-wingStart)/bays;
 for(let bay=0;bay<bays;bay++){
  const a=wingStart+bay*wingPitch,b=a+wingPitch,z=(a+b)/2;
  const flat=bay>=2&&bay<=4,backX=flat?-20.68:-19.67;
  box(backX,3.60,z,.065,4.47,wingPitch-.38,'dark');
  box(backX-.048,3.73,z,.045,3.95,wingPitch-.54,'glass');
  // Wide rear frame and glazing bars follow the true plane, not the piers.
  for(let k=0;k<=3;k++)box(backX-.079,3.65,a+.22+k*(wingPitch-.44)/3,.04,4.14,.07,'frame');
  box(backX-.08,5.83,z,.04,.08,wingPitch-.38,'frame');
  box(backX-.08,7.75,z,.04,.33,wingPitch-.38,'dark');
  if(!flat){
   box(-20.19,3.33,z,1.16,.20,wingPitch,'concrete');
   // A low glazed guard at the opening mouth leaves the upper loggia open.
   box(-20.80,3.65,z,.028,.78,wingPitch-.42,'glass');
   box(-20.81,4.43,z,.032,.04,wingPitch-.38,'frame');
   for(const end of[a+.16,b-.16])box(-20.19,3.5,end,1.16,4.72,.24,'concrete');
  }
  // Quiet masonry/door lower tier, with retained research-backed exceptions.
  if(bay%2===0&&bay!==2)westWindow(z,.14,2.12,2.90,2);
 }
 for(let bay=0;bay<=bays;bay++)box(-20.19,0,wingStart+bay*wingPitch,1.16,8.47,.26,'concrete');
 box(-20.19,8.30,(wingStart+wingEnd)/2,1.16,.29,wingEnd-wingStart,'concrete');
 box(-20.78,3.31,(wingStart+wingEnd)/2,.09,.19,wingEnd-wingStart,'concrete');
 // The dark panel between PadelNEXT and Beest is a visible ground-level
 // service/entry feature, not an invented additional tenant destination.
 box(-20.87,0,83.5,.13,4.5,3.4,'dark');
 for(let y=.12;y<4.5;y+=.12)box(-20.939,y,83.5,.032,.022,3.4,'frame');
 function westSign(text:string,z:number,y:number,h:number,w:number,c:Colour,hex=c==='red'?'#ce2537':'#f4f5f3',x=z>=70.4?-20.84:-20.68){const g=frontageSignGeometry(text,h,w);g.rotateY(-Math.PI/2);paint(g,c,hex,x,y,z);}
 // Real contemporary letters are fitted to their photographed fascia planes.
 // Positions/letter dimensions are bounded photo interpretations, not survey.
 // Separate shallow source fascia fields provide real backing for the
 // graphics. Neither field closes the recessed upper glazing/loggias.
 const fasciaFront=-20.85;
 for(const [z,width]of[[75.55,8.85],[98.1,12.2]])box(fasciaFront+.03,3.46,z,.06,.69,width,'concrete');
 {const g=padelWordmarkGeometry(.61,8.55);g.rotateY(-Math.PI/2);paint(g,'green','#88b7a7',fasciaFront-.004,3.51,75.55);}
 westSign('BEEST BOULDERS',98.1,3.50,.54,11.9,'white','#f4f5f3',fasciaFront-.004);
 // The same real small graphic is visible on the black entry panel.
 const panelCuts:number[]=[];for(let c=.12;c<4.5;c+=.12)panelCuts.push(c,c+.022);
 for(const {geometry:g,hex}of padelEmblemGeometry(1.44))surfacePaint(g,hex,3.11,83.5,'y',panelCuts,(_y,mid)=>{const c=.12+Math.floor((mid-.12)/.12)*.12;return mid>=c&&mid<c+.022?-20.955:-20.935;});
 westWindow(72.0,.10,4.7,3.20,3);
 // Flat printed graphics sit four millimetres proud of the actual entrance
 // glass front (-20.25 - .305 - .055/2), not an arbitrary exterior plane.
 const entranceGraphicX=-20.25-.305-.055/2-.004;
 westSign('CrossFit',56.10,3.50,.42,2.8,'white','#f4f5f3',entranceGraphicX);
 westSign('AKA',58.05,3.50,.42,1.1,'red','#ce2537',entranceGraphicX);
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
