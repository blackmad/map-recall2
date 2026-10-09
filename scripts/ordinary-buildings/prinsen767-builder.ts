import * as T from 'three';
import type {BuildingTools} from '../landmarks/cultural-builders';
import {upwardRoofPlane} from '../landmarks/house-geometry';
import {nativeRoofEnvelope,roofStepSupport} from './roof-step-support.mjs';
import spec from './prinsen767-spec.json';
import lettering from './prinsen767-lettering.json';
import roofMaterials from './prinsen767-roof-materials.json';
type C=Parameters<BuildingTools['add']>[1];
type Frame={a:number[];t:number[];n:number[];L:number;start:number;end:number};
export const probes:any[]=[];
/** Source-guided original geometry; unresolved source voids remain uncapped. */
export function buildPrinsen767(_w:number,_d:number,b:BuildingTools){
 probes.length=0;
 const add=(g:T.BufferGeometry,c:C,x=0,y=0,z=0,a=0)=>b.add(g,c,x,y,z,a);
 const shape=(ring:number[][],holes:number[][][]=[])=>{const s=new T.Shape(ring.map(p=>new T.Vector2(p[0],p[1])));for(const h of holes)s.holes.push(new T.Path(h.map(p=>new T.Vector2(p[0],p[1]))));return s;};
 const roofOwners=spec.roofs.filter(r=>r.surface!==363);
 const regions=roofOwners.map(r=>({sourceRegionIndex:r.surface,ring:r.ring.map(p=>[p[0],r.plane[0]*p[0]+r.plane[1]*p[1]+r.plane[2],p[1]])}));
 for(const r of spec.roofs){const g=upwardRoofPlane(shape(r.ring,r.holes)),p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,r.plane[0]*p.getX(i)+r.plane[1]*p.getZ(i)+r.plane[2]);g.computeVertexNormals();g.userData.sourceRoofSurface=r.surface;add(g,(roofMaterials.surfaces as Record<string,{colour:string}>)[r.surface]?.colour??'roof');}
 // Original flat solar modules on own observed wing353; aerial-guided
 // approximate module count/placement, not copied image pixels or relief.
 const solarRoof=spec.roofs.find(r=>r.surface===353&&r.role==='survey-roof-owner')!;
 const aerialPoint=(px:number,py:number)=>{const lng=4.88638+px/1800*(4.8879-4.88638),lat=52.36418-py/1450*(52.36418-52.36345),x=(lng-spec.anchor[0])*111320*Math.cos(spec.anchor[1]*Math.PI/180),z=-(lat-spec.anchor[1])*111320;return[x,solarRoof.plane[0]*x+solarRoof.plane[1]*z+solarRoof.plane[2]+.08,z];};
 const centres=[[204,414],[240,466],[278,515],[314,560],...[0,1,2].flatMap(col=>[0,1,2,3].map(row=>[426+col*40-row*40,314+col*43+row*43]))];
 for(const [cx,cy]of centres){const p=[[cx,cy-38],[cx+36,cy],[cx,cy+38],[cx-36,cy]].map(([x,y])=>aerialPoint(190+x/2,240+y/2));const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>p[i]),3));g.computeVertexNormals();if(g.getAttribute('normal').getY(0)<0){g.setAttribute('position',new T.Float32BufferAttribute([0,2,1,0,3,2].flatMap(i=>p[i]),3));g.computeVertexNormals();}add(g,'solar');}
 const envelope=nativeRoofEnvelope(regions,spec.nativeRing,spec.nativeRing.map((_,i)=>i),'brick',{boundedHeights:true});
 for(const [i,p]of envelope.groups.entries()){p.geometry.userData.nativeEnvelope=envelope.report[i];add(p.geometry,p.color);}
 // Survey363 is paved courtyard ground: use its measured level only as
 // the bottom of adjacent walls; it never owns a building roof/envelope.
 const stepRegions=spec.roofs.map(r=>({sourceRegionIndex:r.surface,ring:r.ring.map(p=>[p[0],r.plane[0]*p[0]+r.plane[1]*p[1]+r.plane[2],p[1]])}));
 const steps=roofStepSupport(stepRegions,spec.nativeRing,{intervalMetres:2,adjacencyToleranceMetres:.12,color:'brick'});for(const [i,p]of steps.groups.entries()){p.geometry.userData.roofStep=steps.report[i];add(p.geometry,p.color);}
 const frame=(start:number,end:number):Frame=>{const a=spec.nativeRing[start],q=spec.nativeRing[end],L=Math.hypot(q[0]-a[0],q[1]-a[1]),t=[(q[0]-a[0])/L,(q[1]-a[1])/L];return{a,t,n:[-t[1],t[0]],L,start,end};};
 function facade(f:Frame){const {a,t,n,L}=f,angle=Math.atan2(-t[1],t[0]);let overrideOffset:number|undefined;const faceOffset=(u:number)=>{for(let i=f.start;i<f.end;i++){const p=spec.nativeRing[i],q=spec.nativeRing[i+1],pu=(p[0]-a[0])*t[0]+(p[1]-a[1])*t[1],qu=(q[0]-a[0])*t[0]+(q[1]-a[1])*t[1];if(u>=Math.min(pu,qu)-.001&&u<=Math.max(pu,qu)+.001&&Math.abs(qu-pu)>.01){const v=(u-pu)/(qu-pu),x=p[0]+(q[0]-p[0])*v,z=p[1]+(q[1]-p[1])*v;return(x-a[0])*n[0]+(z-a[1])*n[1];}}return 0;};const point=(u:number,y:number,d:number)=>{const depth=d+(overrideOffset??faceOffset(u));return[a[0]+t[0]*u+n[0]*depth,y,a[1]+t[1]*u+n[1]*depth];};
  const box=(u:number,y:number,w:number,h:number,depth:number,col:C,d=.1)=>{const p=point(u,y+h/2,d);add(new T.BoxGeometry(w,h,depth),col,...p as[number,number,number],angle);};
  const quad=(pts:number[][],col:C,d=.1)=>{const outline=pts.filter((p,i)=>i===0||Math.hypot(p[0]-pts[i-1][0],p[1]-pts[i-1][1])>1e-8);if(outline.length>2&&Math.hypot(outline[0][0]-outline.at(-1)![0],outline[0][1]-outline.at(-1)![1])<1e-8)outline.pop();const vertices=outline.map(([u,y])=>point(u,y,d)),ids=T.ShapeUtils.triangulateShape(outline.map(p=>new T.Vector2(p[0],p[1])),[]);const arr=ids.flatMap(tri=>{const v=tri.map(i=>new T.Vector3(...vertices[i] as[number,number,number])),normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));if(normal.dot(new T.Vector3(n[0],0,n[1]))<0)tri=tri.slice().reverse();return tri.flatMap(i=>vertices[i]);});const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(arr,3));g.computeVertexNormals();add(g,col);};
  const panel=(u:number,y:number,w:number,h:number,col:C,d=.15)=>quad([[u-w/2,y],[u+w/2,y],[u+w/2,y+h],[u-w/2,y+h]],col,d);
  const probe=(label:string,u:number,y:number,d:number,kind='glass')=>probes.push({label,point:point(u,y,d),normal:[n[0],0,n[1]],kind});
  function window(label:string,u:number,y:number,w:number,h:number,rows=2,cols=2,d=.16){overrideOffset=Math.max(faceOffset(u-w/2-.08),faceOffset(u),faceOffset(u+w/2+.08));panel(u,y,w+.16,h+.14,'white',d);panel(u,y+.06,w,h-.02,'glass',d+.012);const fw=.042;for(let j=1;j<cols;j++)panel(u-w/2+w*j/cols,y+.06,fw,h-.02,'frame',d+.018);for(let j=1;j<rows;j++)panel(u,y+h*j/rows,w,fw,'frame',d+.018);for(const x of [.2,.8])probe(label+'-'+y+'-'+x,u+(x-.5)*w,y+h*.47,d+.013);overrideOffset=undefined;}
  function arch(label:string,u:number,y:number,w:number,h:number,rise:number,d=.2,grille=false){overrideOffset=Math.max(faceOffset(u-w/2-.08),faceOffset(u),faceOffset(u+w/2+.08));const top=h-rise;for(let k=0;k<12;k++){const x0=-w/2+w*k/12,x1=-w/2+w*(k+1)/12,hy=(x:number)=>y+top+rise*Math.sqrt(Math.max(0,1-(2*x/w)**2));quad([[u+x0,y],[u+x1,y],[u+x1,hy(x1)],[u+x0,hy(x0)]],'glass',d);quad([[u+x0,hy(x0)],[u+x1,hy(x1)],[u+x1,hy(x1)+.13],[u+x0,hy(x0)+.13]],'stone',d+.025);}
   panel(u-w/2-.07,y,.14,top+.04,'stone',d+.015);panel(u+w/2+.07,y,.14,top+.04,'stone',d+.015);panel(u,y,w+.16,.13,'stone',d+.015);panel(u,y,.045,h,'frame',d+.028);panel(u,y+top,w,.06,'frame',d+.028);
   if(grille){for(let x=-w/2+.17;x<w/2;x+=.29){const height=top+rise*Math.sqrt(Math.max(0,1-(2*x/w)**2));box(u+x,y,.034,height,.04,'iron',d+.19);panel(u+x,y+height-.12,.1,.18,'iron',d+.22);}for(const yy of [.18,top*.58])panel(u,y+yy,w,.05,'iron',d+.22);}
   probe(label,u-w*.23,y+h*.4,d+.006);overrideOffset=undefined;}
  function cornice(y:number,len=L,u=L/2){box(u,y,len,.20,.40,'stone',.18);box(u,y+.22,len,.12,.62,'white',.29);box(u,y-.12,len,.10,.30,'stone',.16);}
  function pediment(u:number,y:number,w:number,h:number,d=.35){quad([[u-w/2,y],[u+w/2,y],[u,y+h],[u-w/2,y]],'stone',d);for(let k=0;k<2;k++){const left=k===0,ax=u+(left?-w/2:0),ay=y+(left?0:h),bx=u+(left?0:w/2),by=y+(left?h:0),v=new T.Vector3((bx-ax)*t[0],by-ay,(bx-ax)*t[1]),mid=point((ax+bx)/2,(ay+by)/2,d+.08),g=new T.BoxGeometry(v.length()+.1,.18,.38);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(1,0,0),v.normalize()));add(g,'white',...mid as[number,number,number]);}box(u,y-.10,w+.34,.20,.48,'white',d+.08);}
  return{box,panel,quad,window,arch,cornice,pediment,probe,point};
 }

 const brown=frame(17,42),a=facade(brown),pitch=brown.L/17;
 a.panel(brown.L/2,.03,brown.L,1.18,'stone',.055);
 // Seventeen observed axes: historic extension8 + older9, current rooftop box1–2.
 for(let k=0;k<17;k++){const u=(k+.5)*pitch,w=1.40;
  if(k===0){a.arch('extension-entry',u,.10,1.70,4.40,.83,.22);a.panel(u,.1,1.67,3.25,'frame',.25);a.panel(u,.18,.04,3.10,'stone',.27);}
  else if(k===12){a.arch('older-main-entry',u,.12,1.65,4.25,.82,.26);a.panel(u,.13,1.55,3.2,'frame',.29);a.pediment(u,4.65,2.30,.7,.33);}
  else a.arch('brown-ground-'+k,u,k<8?.35:1.32,w,k<8?4.0:3.05,.70,.20);
  a.arch('brown-first-'+k,u,5.65,w,2.9,.70,.20);
  a.arch('brown-second-'+k,u,9.60,w,2.55,.26,.20);
  // Native small striped awnings, three source-observed tiers.
  for(const y of[k<8?4.1:4.05,8.12,11.75]){if(k===12&&y<5)continue;
   const W=w+.14;for(let j=0;j<8;j++){const u0=u-W/2+W*j/8,u1=u-W/2+W*(j+1)/8,p=[a.point(u0,y+.19,.22),a.point(u1,y+.19,.22),a.point(u1,y-.02,.73),a.point(u0,y-.02,.73)];const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,2,1,0,3,2].flatMap(i=>p[i]),3));g.computeVertexNormals();add(g,j%2?'white':'awning');a.panel((u0+u1)/2,y-.16,W/8,.16,j%2?'white':'awning',.73);}
  }
  if(k<2)continue;
  const crown=[3,4,5,7,9,11,12,13,15].includes(k);
  if(crown)a.window('brown-crown-'+k,u,13.0,w,[4,12].includes(k)?3.02:2.45,2,2,.21);
  else{a.window('brown-top-left-'+k,u-.40,13.02,.64,1.40,1,1,.21);a.window('brown-top-right-'+k,u+.40,13.02,.64,1.40,1,1,.21);}
 }
 for(const y of[5.06,9.07,12.63])a.cornice(y);
 for(const [first,last]of[[2,2],[3,5],[6,6],[7,7],[8,8],[9,9],[10,10],[11,13],[14,14],[15,15],[16,16]]){const crown=last>first||[7,9,15].includes(first);if(last>first){a.cornice(15.80,pitch,(first+.5)*pitch);a.cornice(15.80,pitch,(last+.5)*pitch);}else a.cornice(crown?15.80:14.90,pitch,(first+.5)*pitch);}
 for(const k of[4,12])a.cornice(16.45,pitch,(k+.5)*pitch);
 // Current tiled transverse heads, supported in front of surveyed slopes.
 for(const [k,width,height,y]of[[4,pitch*3,1.48,15.80],[12,pitch*3,1.48,15.80],[7,pitch*1.15,.80,15.80],[9,pitch*1.15,.80,15.80],[15,pitch*1.15,.80,15.80]]){const u=(k+.5)*pitch,outline=(inset:number)=>width>pitch*2?[[u-width/2+inset,y+inset],[u-.85,y+inset],[u-.85,16.50],[u+.85,16.50],[u+.85,y+inset],[u+width/2-inset,y+inset],[u,y+height-inset]]:[[u-width/2+inset,y+inset],[u+width/2-inset,y+inset],[u,y+height-inset]];a.quad(outline(0),'stone',.29);a.quad(outline(.13),'streetTile',.34);if(width>pitch*2)a.probe('crown-upper-clear-'+k,u-.3,15.96,.225);}
 // Current modern glass box is source visible, not historic attic windows.
 a.panel(pitch,12.85,2*pitch-.2,3.13,'stone',.20);
 for(const u of[pitch*.5,pitch*1.5])a.window('modern-rooftop-'+u,u,13.02,pitch-.25,2.75,1,2,.24);
 a.cornice(16.02,pitch*2,pitch);
 const white=frame(16,17),w=facade(white),wp=white.L/6;
 w.panel(white.L/2,.05,white.L,16.18,'white',.045);w.panel(white.L/2,.05,white.L,3.55,'frame',.065);
 for(let k=0;k<6;k++){const u=(k+.5)*wp;w.window('white-shop-'+k,u,.80,wp*.62,1.75,1,1,.11);for(const y of[4.40,8.20,12.0])w.window('white-upper-'+k+'-'+y,u,y,wp-.32,2.72,2,2,.12);}
 for(const y of[3.60,7.45,11.25,15.6])w.box(white.L/2,y,white.L,.23,.25,'white',.10);
 const kerk=frame(6,7),c=facade(kerk);
 // Current left2 / middle3 / classical right, with final paired sashes retained.
 const groups=[{us:[1.1,3.1],width:1.22},{us:[6.6,9.45,12.2],width:1.50},{us:[15.2,18.2,21.2],width:1.48},{us:[27.0,28.5],width:1.02}];
 for(const group of groups)for(const u of group.us){if(u>5.5&&u<13.5)continue;if(u<5.5)c.window('kerk-ground-'+u,u,.60,group.width,2.90,2,2,.22);else c.arch('kerk-ground-'+u,u,.60,group.width,2.90,.50,.22);c.window('kerk-first-'+u,u,4.85,group.width,2.70,2,2,.22);if(u>5.5&&u<13.5)c.arch('kerk-top-'+u,u,9.00,group.width,2.6,.48,.23);else c.window('kerk-top-'+u,u,9.00,group.width,2.6,2,2,.23);}
 for(const y of[4.25,8.30,12.20])c.cornice(y);
 c.arch('kerk-real-entry',24.15,.08,1.68,3.25,.82,.31);c.panel(24.15,.12,1.53,2.37,'frame',.34);
 for(const u of[23.09,25.21]){c.box(u,.06,.39,3.27,.32,'stone',.32);c.box(u,3.02,.59,.19,.45,'white',.38);}
 c.window('kerk-entry-upper',24.15,4.85,1.46,2.7,2,2,.26);c.window('kerk-entry-top',24.15,9.0,1.46,2.6,2,2,.26);
 // Source-visible two-axis left tuit gable: stepped shoulders and narrow neck.
 c.quad([[.10,12.20],[4.22,12.20],[4.22,12.48],[3.90,12.48],[2.38,14.98],[2.38,15.43],[1.65,15.43],[1.65,14.98],[.35,12.48],[.10,12.48]],'brick',.14);
 for(const [u,y,ww]of[[.27,12.40,.50],[4.05,12.40,.50],[2.01,15.35,.85]])c.box(u,y,ww,.18,.31,'stone',.22);
 c.window('left-gable-attic',2.01,12.65,.94,1.40,2,1,.25);
 // Middle three-axis facade projects in front of the native wall line.
 const bow=(u:number)=>.40*Math.sqrt(Math.max(0,1-((u-9.45)/1.08)**2));
 // A coherent shallow bowed brick face supports the three projecting axes.
 for(let u=5.55;u<13.35;u+=.30){const hi=Math.min(13.35,u+.30),points=[c.point(u,.08,.06+bow(u)),c.point(hi,.08,.06+bow(hi)),c.point(hi,12.20,.06+bow(hi)),c.point(u,12.20,.06+bow(u))],g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>points[i]),3));g.computeVertexNormals();if(new T.Vector3().fromBufferAttribute(g.getAttribute('normal'),0).dot(new T.Vector3(kerk.n[0],0,kerk.n[1]))<0){g.setAttribute('position',new T.Float32BufferAttribute([0,2,1,0,3,2].flatMap(i=>points[i]),3));g.computeVertexNormals();}add(g,'brick');for(const y of[4.25,8.30,12.20])c.box((u+hi)/2,y,hi-u+.015,.20,.22,'stone',.18+bow((u+hi)/2));}
 for(const u of[6.6,9.45,12.2]){for(const [y,h]of[[.60,2.90],[4.85,2.70],[9.0,2.60]]){if(y===4.85||y===.60)c.window('middle-projecting-'+u+'-'+y,u,y,1.50,h,2,2,.18+bow(u));else c.arch('middle-projecting-'+u+'-'+y,u,y,1.50,h,.48,.18+bow(u));}}
 for(const u of[5.9,8.02,10.87,12.93])c.box(u,.10,.21,12.12,.15,'brick',.12+bow(u));
 c.box(9.45,11.64,2.02,2.30,.40,'brick',.24);
 c.window('middle-dormer',9.45,12.10,1.28,1.78,2,2,.49);
 const roundedDormerCap=(u:number,y:number,width:number)=>{const contour=[[u-width/2,y],[u+width/2,y],...Array.from({length:13},(_,i)=>{const x=width/2-width*i/12;return[u+x,y+.20+.35*Math.sqrt(Math.max(0,1-(x/(width/2))**2))];})];c.quad(contour,'stone',.56);c.box(u,y,width+.12,.16,.33,'stone',.58);};
 roundedDormerCap(9.45,13.95,2.12);
 // Separate classical entry-axis dormer, not merged into the middle crown.
 c.box(24.15,11.75,1.90,2.23,.40,'brick',.24);
 c.window('entry-axis-dormer',24.15,12.05,1.10,1.60,2,1,.49);
 roundedDormerCap(24.15,13.83,2.08);
// Open metal lightwell fence is separate from the facade: no infill/cap.
 for(const [lo,hi]of[[.25,22.70],[25.60,kerk.L-.15]]){c.box((lo+hi)/2,.12,hi-lo,.045,.055,'iron',1.05);c.box((lo+hi)/2,1.12,hi-lo,.045,.055,'iron',1.05);for(let u=lo;u<=hi;u+=.37)c.box(u,.10,.026,1.06,.035,'iron',1.05);}
 // Source-supported raised gold arch inscription; Archivo Black outline
 // family is an approximate heavy grotesk match, not an identified typeface.
 const text=lettering.text,glyphs=lettering.glyphs as Record<string,{advance:number;commands:any[]}>,radius=1.14;
 const advances=[...text].map(ch=>glyphs[ch].advance),total=advances.reduce((a,b)=>a+b,0),fontScale=radius*2.48/total;
 let cursor=0;for(const [index,ch]of[...text].entries()){
  const glyph=glyphs[ch],theta=2.81-(cursor+glyph.advance/2)/total*2.48,path=new T.ShapePath();
  for(const [op,ps]of glyph.commands){if(op==='moveTo')path.moveTo(...ps[0] as[number,number]);else if(op==='lineTo')path.lineTo(...ps[0] as[number,number]);else if(op==='qCurveTo'){for(let j=0;j<ps.length-1;j++){const end=j===ps.length-2?ps[j+1]:[(ps[j][0]+ps[j+1][0])/2,(ps[j][1]+ps[j+1][1])/2];path.quadraticCurveTo(ps[j][0],ps[j][1],end[0],end[1]);}}else if(op==='closePath')path.currentPath.closePath();}
  const g=new T.ShapeGeometry(path.toShapes(false),4),p=g.getAttribute('position'),angle=theta-Math.PI/2;
  for(let j=0;j<p.count;j++){const x=(p.getX(j)-glyph.advance/2)*fontScale,y=p.getY(j)*fontScale,du=x*Math.cos(angle)-y*Math.sin(angle),dy=x*Math.sin(angle)+y*Math.cos(angle),pt=c.point(24.15+radius*Math.cos(theta)+du,2.43+radius*Math.sin(theta)+dy,.405);p.setXYZ(j,...pt as[number,number,number]);}
  // ShapeGeometry faces +Z; choose the actual facade outward winding.
  g.computeVertexNormals();if(new T.Vector3().fromBufferAttribute(g.getAttribute('normal'),0).dot(new T.Vector3(kerk.n[0],0,kerk.n[1]))<0){const ids=g.index!;for(let j=0;j<ids.count;j+=3){const v=ids.getX(j+1);ids.setX(j+1,ids.getX(j+2));ids.setX(j+2,v);}g.computeVertexNormals();}add(g,'gold');cursor+=glyph.advance;
 }
}
