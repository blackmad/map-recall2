import coupled from './melkweg-coupled-footprints.json';
import nativeRoofs from './stadsschouwburg-native-roofs.json';
import {legacyTools} from './melkweg-coupled-legacy-tools';
import {FontLoader} from 'three/examples/jsm/loaders/FontLoader.js';
import {TextGeometry} from 'three/examples/jsm/geometries/TextGeometry.js';
import fontData from './melkweg-coupled-helvetiker-font.json';
import * as T from 'three';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
import type {BuildingTools} from './cultural-builders';
import data from './industrial-theater-footprints.json';
import specs from './industrial-theater-specs.json';

/** Original industrial and neo-Renaissance venue meshes in surveyed metres. */
export function buildIndustrialTheaterCoupledLandmark(id:string,w:number,d:number,b:BuildingTools){
 let {add,box,prism,hip,window,sign}=b;const site=data.sites.find(s=>s.id===id)!,spec=specs.find(s=>s.id===id)!;
 const lngScale=111320*Math.cos(site.anchor[1]*Math.PI/180);
 function ring(points:number[][]){return points.slice(0,-1).map(p=>new T.Vector2((p[0]-site.anchor[0])*lngScale,-(p[1]-site.anchor[1])*110540));}
 function arch(x:number,y:number,z:number,width:number,height:number,angle:number,c:'brick'|'red'|'dark'){
  const s=new T.Shape();s.moveTo(-width/2,0);s.lineTo(width/2,0);s.lineTo(width/2,height-width/2);s.absarc(0,height-width/2,width/2,0,Math.PI,false);s.lineTo(-width/2,0);
  add(new T.ExtrudeGeometry(s,{depth:.16,curveSegments:5,bevelEnabled:false}),c,x,y,z,angle);
 }
 if(id==='gashouder'){
  const {x,z,r}=site.circle!;
  // The masonry plinth preserves its two projecting pipe-house annexes.
  for(const poly of site.buildings[0].geometry.coordinates){const shape=new T.Shape(ring(poly[0]));shape.holes=poly.slice(1).map(h=>new T.Path(ring(h)));const g=new T.ExtrudeGeometry(shape,{depth:5,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,5,0);add(g,'brick');}
  add(new T.CylinderGeometry(r,r,8,48),'frame',x,9,z);
  const dome=new T.SphereGeometry(1,48,8,0,Math.PI*2,0,Math.PI/2);dome.scale(r,3.2,r);add(dome,'slate',x,13,z);
  for(let y of [5.05,7.05,9.05,11.05,12.95]){const ring=new T.TorusGeometry(r+.06,.075,4,48);ring.rotateX(Math.PI/2);add(ring,'dark',x,y,z);}
  for(let i=0;i<36;i++){
   const a=i*Math.PI*2/36,cx=x+(r+.12)*Math.sin(a),cz=z+(r+.12)*Math.cos(a);
   arch(cx,.2,cz,4.2,4.5,a,'red');if(i%3===0)arch(cx+Math.sin(a)*.04,.35,cz+Math.cos(a)*.04,2.25,3.8,a,'dark');
   if(i%3===0){for(let y of [1.1,2.15,3.2])box(cx+Math.sin(a)*.28,y,cz+Math.cos(a)*.28,2.2,.09,.2,'frame',a);box(cx+Math.sin(a)*.28,.4,cz+Math.cos(a)*.28,.09,3.4,.2,'frame',a);}
   box(x+(r+.15)*Math.sin(a),5,z+(r+.15)*Math.cos(a),.15,8,.18,'dark',a);
   box(x+(r+.45)*Math.sin(a),12.8,z+(r+.45)*Math.cos(a),.095,1.6,.095,'dark');
  }
  for(let y of [13.1,14.3]){const rail=new T.TorusGeometry(r+.5,.065,4,48);rail.rotateX(Math.PI/2);add(rail,'dark',x,y,z);}
  // Shallow conical lids on the two side annexes. Positions come from the
  // actual outward lobes of the building ring rather than invented wings.
  const raw=ring(site.buildings[0].geometry.coordinates[0][0]);
  const lobes=raw.filter(p=>Math.hypot(p.x-x,p.y-z)>r+1.4);
  const groups:T.Vector2[][]=[];
  for(const p of lobes){const group=groups.find(g=>g.some(a=>a.distanceTo(p)<8));if(group)group.push(p);else groups.push([p]);}
  for(const group of groups.filter(g=>g.length>3)){const cx=group.reduce((s,p)=>s+p.x,0)/group.length,cz=group.reduce((s,p)=>s+p.y,0)/group.length;add(new T.ConeGeometry(5.2,3,16),'slate',cx,6.4,cz);}
  box(x,0,z+r+.32,5,4.8,.4,'stone');arch(x,.2,z+r+.56,3.5,4.3,0,'dark');box(x,4.8,z+r+.4,5.8,.35,.8,'stone');
  sign('GASHOUDER',x,5.3,z+r+.68,.16,'dark');
 }else if(id==='stadsschouwburg'){
  // Original fitted roof-plan volumes replace uniform17.5/22.5m parent caps.
  const nativeShape=(ring:number[][],holes:number[][][]=[])=>{const s=new T.Shape(ring.map(p=>new T.Vector2(p[0],p[1])));s.holes=holes.map(r=>new T.Path(r.map(p=>new T.Vector2(p[0],p[1]))));return s;};
  for(const part of nativeRoofs.parts){
   const shape=nativeShape(part.ring,part.holes),plane=part.plane,top=(x:number,z:number)=>plane[0]*x+plane[1]*z+plane[2],wall=openTopPrism(shape,0,part.eaveMinM),wp=wall.getAttribute('position');
   for(let i=0;i<wp.count;i++)if(Math.abs(wp.getY(i)-part.eaveMinM)<.001)wp.setY(i,top(wp.getX(i),wp.getZ(i)));wall.computeVertexNormals();wall.name=part.id+'-source-eave-shell';b.add(wall,'brick');
   const roof=upwardRoofPlane(shape,0),rp=roof.getAttribute('position');for(let i=0;i<rp.count;i++)rp.setY(i,top(rp.getX(i),rp.getZ(i)));const flat=roof.toNonIndexed(),fp=flat.getAttribute('position'),values:number[]=[];let removedTriangles=0,removedProjectedAreaM2=0;
   for(let i=0;i<fp.count;i+=3){const ps=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(fp,i+j));const crossY=ps[1].clone().sub(ps[0]).cross(ps[2].clone().sub(ps[0])).y,longest=Math.max(...[0,1,2].map(j=>Math.hypot(ps[j].x-ps[(j+1)%3].x,ps[j].z-ps[(j+1)%3].z)));
    // Source-rounded clipping remnants thinner than20mm invert under14bit map-scale quantization. Retain original rings/walls; omit only numerical roof triangulation slivers.
    if(crossY<.0001||crossY/longest<.02){removedTriangles++;removedProjectedAreaM2+=Math.abs(crossY)/2;continue;}for(const p of ps)values.push(...p.toArray());}
   const clean=new T.BufferGeometry();clean.setAttribute('position',new T.Float32BufferAttribute(values,3));clean.computeVertexNormals();clean.name=part.id+'-upward-roof';clean.userData.role='explicit-roof';clean.userData.cleanup={sourceTriangles:fp.count/3,removedTriangles,removedProjectedAreaM2};b.add(clean,part.material as Parameters<BuildingTools['add']>[1]);roof.dispose();flat.dispose();
  }

  // Register46503 twelve-axis long sides. Native wall chains source their positions;
  // aperture dimensions/heights are bounded facade-photo approximations, not a surveyed elevation.
  const outer=coupled.stadsschouwburgNativePolygons[0][0];
  for(const side of[{edges:[36,38],counts:[5,7]},{edges:[4,6],counts:[7,5]}])for(let k=0;k<side.edges.length;k++){
   const edge=side.edges[k],A=outer[edge],B=outer[(edge+1)%outer.length],dx=B[0]-A[0],dz=B[1]-A[1],L=Math.hypot(dx,dz),ux=dx/L,uz=dz/L,nx=-uz,nz=ux,angle=Math.atan2(-dz,dx),count=side.counts[k];
   const detail=(u:number,y:number,w:number,h:number,c:Parameters<BuildingTools['add']>[1],name:string,offset=.12,depth=.08)=>{const g=new T.BoxGeometry(w,h,depth);g.rotateY(angle);g.translate(A[0]+u*ux+offset*nx,y+h/2,A[1]+u*uz+offset*nz);g.name=name;b.add(g,c);};
   for(let bay=0;bay<count;bay++){const u=(bay+.5)*L/count;
    for(const[y,h]of[[.3,1.1],[3.2,2.3],[7.3,2.8],[11.4,2.4]]){
     detail(u,y,1.18,h,'glass','historic-side-'+edge+'-'+bay+'-pane');
     for(const sign of[-1,1])detail(u+sign*.65,y-.05,.11,h+.12,'stone','historic-side-frame',.16,.13);
     detail(u,y-.09,1.48,.13,'stone','historic-side-sill',.18,.18);detail(u,y+h-.015,1.43,.13,'stone','historic-side-lintel',.16,.13);
     detail(u,y,.06,h,'stone','historic-side-central-mullion',.19,.10);detail(u,y+h*.62,1.18,.055,'stone','historic-side-transom',.19,.10);
    }
   }
   for(const y of[2.55,6.55,10.85,14.8])detail(L/2,y,L,.13,'stone','historic-side-source-stringcourse',.075,.15);
  }
  // Exact principal street-front interval at localdepth51m is x[-17.0992,9.0197].
  // Preserve the same detailed assemblies, correcting their old centered54m frontage.
  const nativeFrontWidth=26.118893121515473,nativeFrontCenter=-4.039757103485408;
  const frontageScale=nativeFrontWidth/(w*.86+5.1);
  const nativeDetailAdd:BuildingTools['add']=(g,c,x=0,y=0,z=0,angle=0)=>{g.rotateY(angle);g.translate(x,y,z);g.scale(frontageScale,1,1);g.translate(nativeFrontCenter,0,0);b.add(g,c);};
  ({add,box,prism,hip,window,sign}=legacyTools(nativeDetailAdd));
  const front=d/2-.4,main=w*.64;
  const frontShape=new T.Shape(coupled.historicFrontBody.ring.map(p=>new T.Vector2(p[0],p[1])));frontShape.holes=coupled.historicFrontBody.holes.map(r=>new T.Path(r.map(p=>new T.Vector2(p[0],p[1]))));
  // The source roof/eave shells own the front body; source parapet/facade detail follows below.
  // Three tall round-arched foyer windows establish the central facade.
  for(let x of [-main*.28,0,main*.28]){
   window(x,7.4,front+.25,5.2,8);
   for(let dx of [-3.4,3.4]){box(x+dx,6.6,front+.3,.65,8.8,.7,'stone');box(x+dx,15.3,front+.3,.95,.45,.95,'stone');}
   box(x,6.8,front+.55,5.4,.32,1,'stone');
   for(let u=-2.5;u<=2.5;u+=.6)box(x+u,6.1,front+.6,.15,.8,.22,'stone');
  }
  for(let y of [1.0,4.4,6.7,15.7,17.2,18.5])box(0,y,front+.25,main,.32,.6,'stone');
  // A mansard behind the stone attic, with two circular dormers.
  // Source mansard/hip planes own the main roof rather than an unsupported flat23.5m generic cap.
  // Register46503/currentphoto: three round mansard dormers on the source front steep plane.
  const mansard=nativeRoofs.parts.find(p=>p.sourceFace===640)!,mansardZ=39.1;
  for(const x of[-10.2,-4.0,2.2]){const y=mansard.plane[0]*x+mansard.plane[1]*mansardZ+mansard.plane[2]+.28;
   const ring=new T.RingGeometry(.58,.77,20);ring.translate(x,y,mansardZ+.12);b.add(ring,'stone');const glass=new T.CircleGeometry(.58,20);glass.translate(x,y,mansardZ+.14);b.add(glass,'glass');}

  function tower(x:number,z:number,size:number,height:number,roofHeight:number){
   if(height===16.8){const q=coupled.historicSmallTowerBodies[x<0?0:1],s=new T.Shape(q.ring.map(p=>new T.Vector2(p[0],p[1])));b.add(openTopPrism(s,0,height),'brick');}
   else box(x,0,z,size,height,size,'brick');
   for(let y of [1,4.4,6.7,15.7,height-.3])box(x,y,z,size+.5,.33,size+.5,'stone');
   for(let dx of [-size/2+.3,size/2-.3]){box(x+dx,0,z+size/2,.38,height,.4,'stone');for(let y=1.6;y<height;y+=1.4)box(x+dx,y,z+size/2,.75,.27,.42,'stone');}
   window(x,height-5.4,z+size/2+.15,size*.38,4.5);
   hip(x,height,z,size+.6,size+.6,roofHeight,'slate');
   const top=height+roofHeight;
   box(x,top,z,size*.45,.3,size*.45,'stone');
   for(let dx of [-size*.18,size*.18])for(let dz of [-size*.18,size*.18])box(x+dx,top+.3,z+dz,.3,2.8,.3,'stone');
   box(x,top+3.1,z,size*.52,.3,size*.52,'stone');hip(x,top+3.4,z,size*.47,size*.47,2,'slate');box(x,top+5.4,z,.095,2.1,.095,'frame');
  }
  for(let x of [-main*.54,main*.54])tower(x,front-3.8,6.8,25.9,3.8);
  // Official2024 facade: these two smaller visible front assemblies belong on the surveyed street wall, not4.4m behind it.
  for(let x of [-w*.43,w*.43])tower(x,51.95-5.1/2-.15,5.1,16.8,4.2);
  box(0,0,front+.45,main*.79,4.4,.25,'glass');box(0,4.4,front+1.3,main*.91,.85,3.4,'dark');
  // Official30-Apr-2024 photo shows the current charcoal ITA canopy panel.
  // Approximate thin geometric sans, native outline glyphs rather than legacy pixel-name lettering.
  const font=new FontLoader().parse(fontData),label=new TextGeometry('ITA internationaal theater amsterdam',{font,size:.55,depth:.012,curveSegments:3,bevelEnabled:false});label.computeBoundingBox();
  const lb=label.boundingBox!,targetWidth=main*.91*frontageScale*.92;label.scale(targetWidth/(lb.max.x-lb.min.x),1,1);label.translate(nativeFrontCenter-targetWidth/2,4.55,front+3.015);b.add(label,'stone');

  // A geometric central sculptural crest and roof balustrade.
  box(0,17.7,front+.45,3.8,2.2,.65,'stone');for(let x of [-1,0,1]){box(x,20,front+.5,.45,1.15,.5,'stone');add(new T.IcosahedronGeometry(.3,0),'stone',x,21.5,front+.5);}
  for(let x=-main/2;x<=main/2;x+=1.3){box(x,17.2,front+.5,.14,1.4,.25,'stone');}box(0,18.6,front+.5,main,.22,.4,'stone');
  // Rear stage house retains its industrial scale, with a glazed connector.
  // Removed unsupported generic rear stage box; exact native parent shell owns this volume.
  // Removed unsupported generic rear side-glass slabs: decoded broad void probes found two real blockers.
 }else throw Error(`Unknown industrial theatre ${id}`);
}
