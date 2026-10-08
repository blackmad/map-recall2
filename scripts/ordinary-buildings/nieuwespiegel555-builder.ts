import * as T from 'three';import type {BuildingTools} from '../landmarks/cultural-builders';import {openTopPrism,upwardRoofPlane} from '../landmarks/house-geometry';import {roofStepSupport} from './roof-step-support.mjs';import spec from './nieuwespiegel555-spec.json';
type C=Parameters<BuildingTools['add']>[1];
export const probes:any[]=[];
/** Original native geometry: reference photos guide dimensions, never supply pixels. */
export function buildNieuwespiegel555(_w:number,_d:number,b:BuildingTools){
 probes.length=0;const add=(g:T.BufferGeometry,c:C,x=0,y=0,z=0,a=0)=>b.add(g,c,x,y,z,a),shape=(r:number[][],holes:number[][][]=[])=>{const s=new T.Shape(r.map(p=>new T.Vector2(p[0],p[1])));for(const h of holes)s.holes.push(new T.Path(h.map(p=>new T.Vector2(p[0],p[1]))));return s;};
 const distance=(p:number[],ring:number[][])=>Math.min(...ring.map((a,i)=>{const c=ring[(i+1)%ring.length],dx=c[0]-a[0],dz=c[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dz*t);}));
 const shell=(g:T.BufferGeometry,ground=false)=>{const p=g.getAttribute('position'),n=g.getAttribute('normal'),v:number[]=[];for(let i=0;i<p.count;i+=3){if(n.getY(i)<-.9)continue;const mid=[(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3];if(distance(mid,spec.nativeRing)>.025&&(!ground||distance(mid,spec.arcadeStrip)>.025))continue;for(let j=0;j<3;j++)v.push(p.getX(i+j),p.getY(i+j),p.getZ(i+j));}const q=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(v,3));q.computeVertexNormals();return q;};
 // Separate source partitions retain the irregular footprint and own heights.
 // Ground front strip is removed before upper shell construction: real arcade.
 for(const roof of spec.roofs){const at=(x:number,z:number)=>roof.plane[0]*x+roof.plane[1]*z+roof.plane[2],min=Math.min(...roof.ring.map(p=>at(p[0],p[1]))),max=Math.max(...roof.ring.map(p=>at(p[0],p[1]))),col=min<19?'brick':'historicBrick';
  for(const g of roof.groundRings)add(shell(openTopPrism(shape(g.ring,g.holes),0,Math.min(spec.arcadeTop,min)),true),col);
  if(min>spec.arcadeTop)add(shell(openTopPrism(shape(roof.ring,roof.holes),spec.arcadeTop,min)),col);
  const g=upwardRoofPlane(shape(roof.ring,roof.holes)),p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,at(p.getX(i),p.getZ(i)));g.computeVertexNormals();add(g,[333,339].includes(roof.surface)?'solar':max-min>.5?'slate':'roof');
  if(max-min>.03){const v:number[]=[];for(let i=0;i<roof.ring.length;i++){const a=roof.ring[i],c=roof.ring[(i+1)%roof.ring.length],ha=at(a[0],a[1]),hc=at(c[0],c[1]);v.push(a[0],min,a[1],c[0],min,c[1],c[0],hc,c[1],a[0],min,a[1],c[0],hc,c[1],a[0],ha,a[1]);}const sides=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(v,3));sides.computeVertexNormals();add(sides,max-min>1.5?'slate':col);}
 }
 const regions=spec.roofs.map(r=>({sourceRegionIndex:r.surface,ring:r.ring.map(p=>[p[0],r.plane[0]*p[0]+r.plane[1]*p[1]+r.plane[2],p[1]])}));const supports=roofStepSupport(regions,spec.nativeRing,{intervalMetres:2,adjacencyToleranceMetres:.2,color:'historicBrick'});for(const g of supports.groups)add(g.geometry,g.color);

 // v04: exact native perimeter owns every outer wall. Roof-cell/native shifts
 // must not delete broad walls merely because source rings stop20–36cm inside.
 const nativeArea=spec.nativeRing.reduce((sum,a,i)=>sum+a[0]*spec.nativeRing[(i+1)%spec.nativeRing.length][1]-a[1]*spec.nativeRing[(i+1)%spec.nativeRing.length][0],0);
 const nearestRoof=(p:number[])=>{let best=Infinity,h=12.22;for(const r of spec.roofs){for(let i=0;i<r.ring.length;i++){const a=r.ring[i],b=r.ring[(i+1)%r.ring.length],dx=b[0]-a[0],dz=b[1]-a[1],den=dx*dx+dz*dz;if(den<1e-10)continue;const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/den)),x=a[0]+dx*t,z=a[1]+dz*t,d=Math.hypot(p[0]-x,p[1]-z);if(d<best){best=d;h=r.plane[0]*x+r.plane[1]*z+r.plane[2];}}}return Math.max(6,Math.min(28.04,h));};
 for(let edge=0;edge<spec.nativeRing.length;edge++){const a=spec.nativeRing[edge],c=spec.nativeRing[(edge+1)%spec.nativeRing.length],dx=c[0]-a[0],dz=c[1]-a[1],L=Math.hypot(dx,dz);if(L<.02)continue;const steps=Math.max(1,Math.ceil(L/.65)),n=nativeArea>0?[dz/L,-dx/L]:[-dz/L,dx/L],bottom=edge>=3&&edge<15?spec.arcadeTop:0;
  for(let k=0;k<steps;k++){const p=[a[0]+dx*k/steps,a[1]+dz*k/steps],q=[a[0]+dx*(k+1)/steps,a[1]+dz*(k+1)/steps],hp=nearestRoof(p),hq=nearestRoof(q),v=[[p[0],bottom,p[1]],[q[0],bottom,q[1]],[q[0],hq,q[1]],[p[0],hp,p[1]]],normal=new T.Vector3(...v[1]).sub(new T.Vector3(...v[0])).cross(new T.Vector3(...v[2]).sub(new T.Vector3(...v[0]))),order=normal.dot(new T.Vector3(n[0],0,n[1]))>0?[0,1,2,0,2,3]:[0,2,1,0,3,2],g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(order.flatMap(i=>v[i]),3));g.computeVertexNormals();add(g,Math.max(hp,hq)<19?'brick':'historicBrick');}
 }

 // v05: current aerial's own framed panel field lies on source333/339, not a
 // nearby roof. Original narrow module-grid strips follow each native plane.
 const solarAxis=spec.frames[1],toUV=(p:number[])=>[(p[0]-solarAxis.a[0])*solarAxis.n[0]+(p[1]-solarAxis.a[1])*solarAxis.n[1],(p[0]-solarAxis.a[0])*solarAxis.t[0]+(p[1]-solarAxis.a[1])*solarAxis.t[1]];
 for(const roof of spec.roofs.filter(r=>[333,339].includes(r.surface))){const ring=roof.ring.map(toUV),fromUV=(u:number,v:number)=>{const x=solarAxis.a[0]+solarAxis.n[0]*u+solarAxis.t[0]*v,z=solarAxis.a[1]+solarAxis.n[1]*u+solarAxis.t[1]*v;return[x,roof.plane[0]*x+roof.plane[1]*z+roof.plane[2]+.022,z];};
  for(const axis of[0,1]){const other=1-axis,lo=Math.min(...ring.map(p=>p[axis])),hi=Math.max(...ring.map(p=>p[axis]));for(let coord=Math.ceil(lo/.78)*.78;coord<hi;coord+=.78){const hits:number[]=[];for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if((a[axis]<=coord&&b[axis]>coord)||(b[axis]<=coord&&a[axis]>coord))hits.push(a[other]+(b[other]-a[other])*(coord-a[axis])/(b[axis]-a[axis]));}hits.sort((a,b)=>a-b);for(let i=0;i+1<hits.length;i+=2){const bottom=hits[i]+.045,top=hits[i+1]-.045;if(top<=bottom)continue;const xy=(d:number,t:number)=>axis===0?fromUV(d,t):fromUV(t,d),v=[xy(coord-.018,bottom),xy(coord+.018,bottom),xy(coord+.018,top),xy(coord-.018,top)],g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>v[i]),3));g.computeVertexNormals();if(g.getAttribute('normal').getY(0)<0){g.setAttribute('position',new T.Float32BufferAttribute([0,2,1,0,3,2].flatMap(i=>v[i]),3));g.computeVertexNormals();}add(g,'solarFrame');}}}
  // Pale field boundary is separate from the source plane, approximately6cm.
  for(let i=0;i<roof.ring.length;i++){const a=roof.ring[i],b=roof.ring[(i+1)%roof.ring.length],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz);if(L<.12)continue;const nx=-dz/L*.045,nz=dx/L*.045,at=(x:number,z:number)=>[x,roof.plane[0]*x+roof.plane[1]*z+roof.plane[2]+.027,z],v=[at(a[0]-nx,a[1]-nz),at(b[0]-nx,b[1]-nz),at(b[0]+nx,b[1]+nz),at(a[0]+nx,a[1]+nz)],g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>v[i]),3));g.computeVertexNormals();if(g.getAttribute('normal').getY(0)<0){g.setAttribute('position',new T.Float32BufferAttribute([0,2,1,0,3,2].flatMap(i=>v[i]),3));g.computeVertexNormals();}add(g,'white');}
 }
 function facade(f:typeof spec.frames[0]){const {a,t,n,L}=f,angle=Math.atan2(-t[1],t[0]);let overrideOffset:number|undefined;const faceOffset=(u:number)=>{for(let i=f.start;i<f.end;i++){const p=spec.nativeRing[i],q=spec.nativeRing[i+1],pu=(p[0]-a[0])*t[0]+(p[1]-a[1])*t[1],qu=(q[0]-a[0])*t[0]+(q[1]-a[1])*t[1];if(u>=Math.min(pu,qu)-.001&&u<=Math.max(pu,qu)+.001&&Math.abs(qu-pu)>.01){const v=(u-pu)/(qu-pu),x=p[0]+(q[0]-p[0])*v,z=p[1]+(q[1]-p[1])*v;return(x-a[0])*n[0]+(z-a[1])*n[1];}}return 0;};const point=(u:number,y:number,d:number)=>{const depth=d+(overrideOffset??faceOffset(u));return[a[0]+t[0]*u+n[0]*depth,y,a[1]+t[1]*u+n[1]*depth];};
  const box=(u:number,y:number,w:number,h:number,depth:number,col:C,d=.1)=>{const p=point(u,y+h/2,d);add(new T.BoxGeometry(w,h,depth),col,...p as[number,number,number],angle);};
  const quad=(pts:number[][],col:C,d=.1)=>{const v=pts.map(([u,y])=>point(u,y,d));const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>v[i]),3));g.computeVertexNormals();if(new T.Vector3().fromBufferAttribute(g.getAttribute('normal'),0).dot(new T.Vector3(n[0],0,n[1]))<0){const arr=[0,2,1,0,3,2].flatMap(i=>v[i]);g.setAttribute('position',new T.Float32BufferAttribute(arr,3));g.computeVertexNormals();}add(g,col);};
  const panel=(u:number,y:number,w:number,h:number,col:C,d=.15)=>quad([[u-w/2,y],[u+w/2,y],[u+w/2,y+h],[u-w/2,y+h]],col,d);
  const probe=(label:string,u:number,y:number,d:number,kind='glass')=>probes.push({label,point:point(u,y,d),normal:[n[0],0,n[1]],kind});
  function window(label:string,u:number,y:number,w:number,h:number,rows=2,cols=2,d=.16){overrideOffset=Math.max(faceOffset(u-w/2-.08),faceOffset(u),faceOffset(u+w/2+.08));panel(u,y,w+.16,h+.14,'white',d);panel(u,y+.06,w,h-.02,'glass',d+.012);const fw=.042;for(let j=1;j<cols;j++)panel(u-w/2+w*j/cols,y+.06,fw,h-.02,'frame',d+.018);for(let j=1;j<rows;j++)panel(u,y+h*j/rows,w,fw,'frame',d+.018);for(const x of [.2,.8])probe(label+'-'+y+'-'+x,u+(x-.5)*w,y+h*.47,d+.013);overrideOffset=undefined;}
  function arch(label:string,u:number,y:number,w:number,h:number,rise:number,d=.2,grille=false){overrideOffset=Math.max(faceOffset(u-w/2-.08),faceOffset(u),faceOffset(u+w/2+.08));const top=h-rise;for(let k=0;k<12;k++){const x0=-w/2+w*k/12,x1=-w/2+w*(k+1)/12,hy=(x:number)=>y+top+rise*Math.sqrt(Math.max(0,1-(2*x/w)**2));quad([[u+x0,y],[u+x1,y],[u+x1,hy(x1)],[u+x0,hy(x0)]],'glass',d);quad([[u+x0,hy(x0)],[u+x1,hy(x1)],[u+x1,hy(x1)+.13],[u+x0,hy(x0)+.13]],'stone',d+.025);}
   panel(u-w/2-.07,y,.14,top+.04,'stone',d+.015);panel(u+w/2+.07,y,.14,top+.04,'stone',d+.015);panel(u,y,w+.16,.13,'stone',d+.015);panel(u,y,.045,h,'frame',d+.028);panel(u,y+top,w,.06,'frame',d+.028);
   if(grille){for(let x=-w/2+.17;x<w/2;x+=.29){const height=top+rise*Math.sqrt(Math.max(0,1-(2*x/w)**2));box(u+x,y,.034,height,.04,'iron',d+.19);panel(u+x,y+height-.12,.1,.18,'iron',d+.22);}for(const yy of [.18,top*.58])panel(u,y+yy,w,.05,'iron',d+.22);}
   probe(label,u-w*.23,y+h*.4,d+.006);overrideOffset=undefined;}
  function cornice(y:number,len=L,u=L/2){box(u,y,len,.20,.40,'stone',.18);box(u,y+.22,len,.12,.62,'white',.29);box(u,y-.12,len,.10,.30,'stone',.16);}
  function pediment(u:number,y:number,w:number,h:number,d=.35){quad([[u-w/2,y],[u+w/2,y],[u,y+h],[u-w/2,y]],'stone',d);for(let k=0;k<2;k++){const left=k===0,ax=u+(left?-w/2:0),ay=y+(left?0:h),bx=u+(left?0:w/2),by=y+(left?h:0),v=new T.Vector3((bx-ax)*t[0],by-ay,(bx-ax)*t[1]),mid=point((ax+bx)/2,(ay+by)/2,d+.08),g=new T.BoxGeometry(v.length()+.1,.18,.38);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(1,0,0),v.normalize()));add(g,'white',...mid as[number,number,number]);}box(u,y-.10,w+.34,.20,.48,'white',d+.08);}
  const nativeBase=()=>{for(let i=f.start;i<f.end;i++){const p=spec.nativeRing[i],q=spec.nativeRing[i+1],pts=[[p[0]+n[0]*.11,.08,p[1]+n[1]*.11],[q[0]+n[0]*.11,.08,q[1]+n[1]*.11],[q[0]+n[0]*.11,8.03,q[1]+n[1]*.11],[p[0]+n[0]*.11,8.03,p[1]+n[1]*.11]],g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,1,2,0,2,3].flatMap(j=>pts[j]),3));g.computeVertexNormals();add(g,'stone');}};return{nativeBase,box,panel,window,arch,cornice,pediment,probe,point};
 }
 const low=spec.frames[0],a=facade(low),L=low.L;
 // Sixteen real recessed bays, ordered north→south. The pier rhythm is distinct
 // from source-traced upper groups, including inset and paired end projections.
 const pitch=L/16;
 for(let k=0;k<=16;k++){const u=Math.max(.31,Math.min(L-.31,k*pitch));a.box(u,.05,.60,4,.74,k===0||k===16?'brick':'stone',-.16);a.box(u,.05,.70,.63,.84,'stone',-.12);a.box(u,3.78,.76,.18,.85,'stone',-.12);a.probe('arcade-pier-'+k,u,2.1,.215,'pier');}
 for(let k=0;k<16;k++){const u=(k+.5)*pitch,w=pitch-.75;a.box(u,3.99,w,.13,2.2,'stone',-1.1);a.box(u,.02,w,.05,2.2,'floor',-1.1);a.window('arcade-back-'+k,u,.3,w-.12,3.3,2,2,-2.19);a.probe('arcade-clear-'+k,u,2,0,'arcade');}
 a.cornice(4.07);a.box(L/2,4.39,L,.27,.37,'stone',.07);
 // Source-supported minimum: seven regular axes on EACH flank, separate
 // from inset and paired terminal groups; three central pavilion axes.
 // Positions are photo-guided approximations on the unchanged native frontage.
 const upperPitch=L/18;
 const upperGroups=[
  {role:'north-terminal',positions:[1.7,4.1],width:1.46},
  {role:'north-inset',positions:[6.85],width:1.55},
  {role:'north-regular',positions:Array.from({length:7},(_,i)=>9.2+i*1.85),width:1.28},
  {role:'central',positions:[23.65,26.9,30.15],width:1.68},
  {role:'south-regular',positions:Array.from({length:7},(_,i)=>33.65+i*3.0),width:1.68},
  {role:'south-inset',positions:[55.2],width:1.55},
  {role:'south-terminal',positions:[57.6,59.7],width:1.46},
 ];
 for(const group of upperGroups)for(const [index,u] of group.positions.entries()){
  if(group.role.endsWith('inset'))a.panel(u,4.75,3.1,7.15,'insetBrick',.16);
  for(const [y,h]of[[5.15,2.75],[9.15,2.02]])a.window('red-upper-'+group.role+'-'+index+'-'+y,u,y,group.width,h,1,2,.17);
 }
 a.cornice(11.95);
 // Source-visible tall terminal projections with paired modern sashes below
 // one large arched attic opening; no invented gables on the straight middle.
 for(const u of[upperPitch,L-upperPitch]){a.box(u,12.05,5.6,3.4,.44,'brick',-.20);a.arch('red-attic-'+u,u,12.8,2.36,2.25,.6,.08);a.cornice(15.4,5.8,u);}
 // Current full-front wall-plane comparison reveals three arches in the
 // central pavilion (u21.7–32.3m), not merely the two terminal projections.
 const pavilionU=26.9,pavilionW=10.55;a.box(pavilionU,12.04,pavilionW,3.55,.60,'brick',-.10);
 for(const u of[23.65,26.9,30.15])a.arch('central-pavilion-'+u,u,12.73,1.75,2.22,.52,.26);
 for(const u of[22.0,25.27,28.53,31.8])a.box(u,12.62,.19,2.53,.23,'stone',.36);
 a.cornice(15.46,pavilionW+.18,pavilionU);
 // One source inset near south projection has a different single-axis width.
 for(let faceIndex=1;faceIndex<=2;faceIndex++){const f=spec.frames[faceIndex],a=facade(f),count=faceIndex===1?8:9,p=f.L/count;
  // Pale rusticated base surrounds visible apertures, rather than solid plinth.
  a.nativeBase();
  for(let row=0,y=.55;y<7.9;y+=.55,row++){for(let u=.35;u<f.L;u+=1.30){const j=u+(row%2?.65:0);if(j<f.L-.1)a.panel(j,y-.51,.027,.46,'joint',.132);}a.panel(f.L/2,y,f.L,.040,'joint',.13);}
  for(let k=0;k<count;k++){const u=(k+.5)*p,w=Math.min(1.82,p*.63);if(faceIndex!==1||k>0)a.arch('historic-ground-'+faceIndex+'-'+k,u,.62,w,2.95,.25,.17,true);if(faceIndex!==1||k>1)a.window('historic-first-'+faceIndex+'-'+k,u,4.24,w,2.89,6,3,.18);
   for(const [y,h]of[[9.10,2.80],[13.02,2.80],...(faceIndex===1&&k<4?[]:[[17.01,2.65]])])a.window('historic-upper-'+faceIndex+'-'+k,u,y,w,h,6,3,.20);
   a.box(u,8.82,w+.22,.12,.23,'stone',.22);a.box(u,12.76,w+.22,.12,.23,'stone',.22);
  }
  a.cornice(7.98);a.box(f.L/2,8.3,f.L,.11,.31,'stone',.17);
  for(let k=0;k<=count;k++){const u=Math.min(f.L-.15,Math.max(.15,k*p));a.box(u,8.53,.46,8.06,.28,'stone',.17);a.box(u,8.43,.62,.25,.4,'stone',.19);a.box(u,16.36,.66,.28,.42,'stone',.20);for(let dx=-.14;dx<=.14;dx+=.07)a.panel(u+dx,8.9,.025,1.3,'joint',.322);}
  a.cornice(20.20);a.box(f.L/2,19.87,f.L,.22,.32,'stone',.19);
  for(let u=.25;u<f.L;u+=.48)a.box(u,20.48,.17,.20,.34,'stone',.3);
  // Risalit crown/pediment retains relief family as native shallow geometries.
  const center=faceIndex===1?f.L*.69:f.L*.56;
  a.pediment(center,20.83,p*3.1,2.28,.35);
  for(const off of[-1,1]){a.box(center+off*p*.50,17.1,.25,2.65,.29,'stone',.28);for(let yy=17.3;yy<19.3;yy+=.40)a.box(center+off*p*.50,yy,.36,.22,.28,'stone',.3);}
  for(const off of[-.8,-.4,0,.4,.8]){const u=center+off*p;const sphere=new T.SphereGeometry(.23,6,4);sphere.scale(1,.75,.25);add(sphere,'stone',...a.point(u,21.35+.35*(1-Math.abs(off)),.42) as[number,number,number]);}
  // Four west bays have source-described open balustrade in lieu of fifth tier.
  if(faceIndex===1){for(let k=0;k<4;k++){const u=(k+.5)*p;a.panel(u,17.01,p-.7,2.65,'historicBrick',.23);}a.box(p*2,16.9,p*4,.15,.4,'stone',.22);a.box(p*2,18.02,p*4,.16,.45,'stone',.23);for(let u=.35;u<p*4;u+=.47){a.box(u,17.06,.12,.93,.18,'stone',.22);}for(const u of[.22,p*2,p*4-.22]){const g=new T.SphereGeometry(.23,7,5);g.scale(1,1.5,1);add(g,'stone',...a.point(u,18.5,.22) as[number,number,number]);}}
  // Corner ashlar and real shallow portico, fitted to the own west boundary.
  for(const u of[.18,f.L-.18])for(let y=8.7;y<20;y+=.48)a.box(u,y,.58,.34,.35,'stone',.23);
  if(faceIndex===1){const u=p*.7,w=p*1.4;a.box(u,4.55,w,2.9,.65,'stone',.68);for(const off of[-1,1])a.box(u+off*w*.38,.14,.48,5.03,1.1,'stone',.61);a.window('portico-upper-left',u-w*.22,4.89,.75,1.56,3,2,1.02);a.window('portico-upper-right',u+w*.22,4.89,.75,1.56,3,2,1.02);a.pediment(u,7.45,w+.3,1.23,1.12);a.box(u,4.32,w+.3,.23,1.22,'stone',.6);a.arch('portico-entry',u,.25,w*.55,3.75,.25,.32,true);}
  // Bounded roof dormers supported behind eave, never whole-building plate.
  for(const u of[1.8,f.L*.38,f.L*.81]){a.box(u,22.65,1.15,1.25,.70,'stone',-1.85);a.window('dormer-'+faceIndex+'-'+u,u,22.8,.73,.85,2,2,-1.47);a.pediment(u,23.88,1.45,.45,-1.4);}
 }
 // Chamfered corner stays native; muted ashlar articulation instead of fake
 // building-name text. Architectural inscriptions omitted pending font proof.
 const cornerA=spec.nativeRing[21],cornerB=spec.nativeRing[22],d=Math.hypot(cornerB[0]-cornerA[0],cornerB[1]-cornerA[1]),t=[(cornerB[0]-cornerA[0])/d,(cornerB[1]-cornerA[1])/d],n=[t[1],-t[0]],cf=facade({a:cornerA,b:cornerB,L:d,t,n,start:21,end:22});cf.panel(d/2,.1,d,8,'stone',.16);for(const y of[9.1,13.02,17.01])cf.window('corner-'+y,d/2,y,Math.min(1.5,d-.4),2.6,6,3,.2);cf.cornice(20.2);
}
