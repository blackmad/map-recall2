import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism, upwardRoofPlane} from './house-geometry';
import source from './oosterparkkerk-footprints.json';
import {readFileSync} from 'node:fs';
import opentype from 'opentype.js';
type C=Parameters<BuildingTools['add']>[1];type P=number[];
const fontBytes=readFileSync(new URL('../../public/canal-drive/fonts/Anton-Regular.ttf',import.meta.url));
const font=opentype.parse(fontBytes.buffer.slice(fontBytes.byteOffset,fontBytes.byteOffset+fontBytes.byteLength));
/** Original current church and linked kosterij; native east/south metres, no imported mesh/photo pixels. */
export function buildOosterparkkerk(_w:number,_d:number,b:BuildingTools){
 const shape=(r:P[])=>new T.Shape(r.map(p=>new T.Vector2(p[0],p[1])));
 const ring=source.outline[0].slice(0,-1),cx=5.32,cz=-6.09,ux=-.423,uz=-.906,nx=.906,nz=-.423,angle=Math.atan2(-uz,ux);
 const point=(u:number,v:number)=>[cx+ux*u+nx*v,cz+uz*u+nz*v];
 const box=(u:number,y:number,v:number,w:number,h:number,d:number,c:C)=>{const p=point(u,v);b.box(p[0],y,p[1],w,h,d,c,angle);};
 const faced=(g:T.BufferGeometry,u:number,y:number,v:number,c:C)=>{const p=point(u,v);b.add(g,c,p[0],y,p[1],angle);};
 const flat=(r:P[],y:number,c:C)=>{const g=upwardRoofPlane(shape(r),y);g.userData={role:'explicit-roof'};b.add(g,c);};
 const volume=(r:P[],y:number,c:C)=>b.add(openTopPrism(shape(r),0,y),c);
 const roof=(ps:P[],c:C)=>{const sh=shape(ps),g=upwardRoofPlane(sh);const at=g.getAttribute('position');const a=ps[0],bb=ps[1],cc=ps.find(p=>Math.abs((bb[0]-a[0])*(p[1]-a[1])-(bb[1]-a[1])*(p[0]-a[0]))>.1)!;const den=(bb[0]-a[0])*(cc[1]-a[1])-(bb[1]-a[1])*(cc[0]-a[0]),sx=((bb[2]-a[2])*(cc[1]-a[1])-(cc[2]-a[2])*(bb[1]-a[1]))/den,sz=((bb[0]-a[0])*(cc[2]-a[2])-(cc[0]-a[0])*(bb[2]-a[2]))/den;for(let i=0;i<at.count;i++)at.setY(i,a[2]+sx*(at.getX(i)-a[0])+sz*(at.getZ(i)-a[1]));g.computeVertexNormals();g.userData={role:'explicit-roof'};b.add(g,c);};
 // Exact current BAG lower shell. Forecourt/neighbor parcels are never filled.
 volume(ring,3.30,'brick');
 // Both low entrance wings have their own source-bounded sandstone coping.
 // Clip only the foreground side regions of the exact BAG ring, excluding the
 // central risalit, main hall and higher caretaker volume. No parcel-wide cap.
 const clip=(r:P[],value:(p:P)=>number)=>{const out:P[]=[];for(let i=0;i<r.length;i++){const a=r[i],z=r[(i+1)%r.length],va=value(a),vz=value(z);if(va>=0)out.push(a);if((va>=0)!==(vz>=0)){const t=va/(va-vz);out.push(a.map((v,j)=>v+(z[j]-v)*t));}}return out;};
 const localU=(p:P)=>(p[0]-cx)*ux+(p[1]-cz)*uz,localV=(p:P)=>(p[0]-cx)*nx+(p[1]-cz)*nz;
 const foreground=clip(ring,p=>localV(p)-.36);
 const wings=[clip(clip(foreground,p=>localU(p)+4.4),p=>-1.82-localU(p)),clip(foreground,p=>localU(p)-2.23)];
 // Adjacent clip intersections closer than8mm collapse at mesh quantization.
 // Remove only numerical duplicates/near-collinear1.5mm outline remnants;
 // preserve the source corner arc and original BAG rings in the archive.
 for(const original of wings){const r=original.filter((p,i)=>Math.hypot(p[0]-original[(i+original.length-1)%original.length][0],p[1]-original[(i+original.length-1)%original.length][1])>.008);for(let changed=true;changed&&r.length>3;){changed=false;for(let i=0;i<r.length;i++){const a=r[(i+r.length-1)%r.length],p=r[i],z=r[(i+1)%r.length],len=Math.hypot(z[0]-a[0],z[1]-a[1]),distance=Math.abs((z[0]-a[0])*(p[1]-a[1])-(z[1]-a[1])*(p[0]-a[0]))/len;if(distance<.0015){r.splice(i,1);changed=true;break;}}}b.add(openTopPrism(shape(r),3.30,3.42),'stone');const g=upwardRoofPlane(shape(r),3.42);g.userData={role:'explicit-roof',assembly:'source-sandstone-wing-coping'};b.add(g,'stone');}
 // AHN5 main hall planes: clean surveyed eaves/ridge, avoiding roof-fit fins at
 // facade/turret intersections. Their perimeter remains within the surveyed Pand.
 const hn=[[-14.47,-4.62],[-10.86,6.69],[7.63,-1.14],[3.01,-11.03]];
 volume(hn,8.94,'brick');
 const rearR=[-12.61,1.21,12.39],frontR=[5.65,-6.22,12.42];
 roof([[-14.47,-4.62,8.95],rearR,frontR,[3.01,-11.03,9.08]],'red');
 roof([rearR,[-10.86,6.69,9.19],[7.63,-1.14,9.38],frontR],'red');
 // Sloping supporting wall triangles close eaves at surveyed local heights.
 const support=(a:P,z:P,topA:number,topZ:number)=>{const v=[a[0],0,a[1],z[0],0,z[1],z[0],topZ,z[1],a[0],0,a[1],z[0],topZ,z[1],a[0],topA,a[1]];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();b.add(g,'brick');};
 support(hn[0],hn[3],8.95,9.08);support(hn[2],hn[1],9.38,9.19);
 // Main front and hidden rear gables are original profile geometry; no unsupported roof plate.
 const gable=(p:P[],r:P)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([p[0][0],8.94,p[0][1],r[0],r[2],r[1],p[1][0],8.94,p[1][1]],3));g.computeVertexNormals();b.add(g,'brick');};gable([point(5.4,.36),point(-5.4,.36)],[...point(0,.36),12.42]);box(0,3.30,.26,10.8,5.64,.20,'brick');gable([hn[1],hn[0]],rearR);
 // Kosterij roof62/60 plus narrow party strip59: the11.2m survey strip is a
 // neighboring party-wall capture, overridden by current two-storey flat-roof photos.
 const leftClip=(r:P[])=>{const out:P[]=[];const val=(p:P)=>(p[0]-cx)*ux+(p[1]-cz)*uz+4.4;for(let i=0;i<r.length;i++){const a=r[i],z=r[(i+1)%r.length],va=val(a),vz=val(z);if(va<=0)out.push(a);if((va<=0)!==(vz<=0)){const t=va/(va-vz);out.push(a.map((v,j)=>v+(z[j]-v)*t));}}return out;};
 for(const i of [59,60,62]){const r=leftClip(source.roofs.find(r=>r.index===i)!.rings[0]);if(r.length<3)continue;volume(r,7.70,'brick');flat(r,7.70,'slate');}
 // Lower rear consistorie/annex. Roof58 reflects a low junction fit; retain current
 // surveyed plan and a bounded low cap, rather than burying it beneath the hall.
 for(const i of [57,58]){const r=source.roofs.find(r=>r.index===i)!.rings[0];volume(r,4.30,'brick');flat(r,4.30,'slate');}
 // Raised entrance risalit with low side wings, all within actual BAG perimeter.
 const entry=[point(-1.82,0),point(2.23,0),point(2.23,1.91),point(-1.82,1.91)];volume(entry,7.91,'brick');
 roof([ [...point(-1.82,0),8.38],[...point(2.23,0),8.38],[...point(2.23,2.02),7.94],[...point(-1.82,2.02),7.94]],'red');
 // Stone stepped, shouldered crown over the broad front gable.
 const profile=[[-5.4,9.0],[-4.9,9.0],[-.8,12.12],[-.8,12.47],[-.40,12.47],[-.40,12.71],[0,12.82],[.40,12.71],[.40,12.47],[.8,12.47],[.8,12.12],[4.9,9.0],[5.4,9.0]];
 const bar=(u0:number,y0:number,u1:number,y1:number,v:number,w:number,c:C)=>{const a=new T.Vector3(u0,y0,0),z=new T.Vector3(u1,y1,0),d=z.clone().sub(a),g=new T.BoxGeometry(w,d.length(),.24);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));g.translate((u0+u1)/2,(y0+y1)/2,0);faced(g,0,0,v,c);};
 for(let i=0;i<profile.length-1;i++)bar(...profile[i] as [number,number],...profile[i+1] as [number,number],.40,.24,'stone');
 function pinnacle(u:number,y:number,v:number,size=.48){box(u,y,v,size,.28,size,'stone');box(u,y+.28,v,size*1.12,.09,size*1.12,'stone');const g=new T.LatheGeometry([new T.Vector2(.06,0),new T.Vector2(.19,.10),new T.Vector2(.21,.20),new T.Vector2(.12,.31),new T.Vector2(.07,.37)],10);faced(g,u,y+.37,v,'stone');}
 for(const u of [-5.45,5.45]){box(u,8.65,.36,.5,.9,.60,'brick');pinnacle(u,9.55,.36);}
 for(const u of [-1.90,2.29]){box(u,6.68,1.89,.43,1.46,.48,'brick');pinnacle(u,8.14,1.89,.46);}
 // Apertures are exposed overlays, with shaped segment heads and dark-wood tracery.
 function aperture(u:number,y:number,v:number,w:number,h:number,glass:C='glass',trim=true){
  const head=Math.min(.38,.16*w),s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-head);s.quadraticCurveTo(0,h+head*.35,-w/2,h-head);s.closePath();faced(new T.ShapeGeometry(s,12),u,y,v,glass);
  if(trim){box(u-w/2-.075,y,v+.018,.15,h-head,.14,'stone');box(u+w/2+.075,y,v+.018,.15,h-head,.14,'stone');box(u,y-.14,v+.06,w+.36,.14,.34,'stone');
   const steps=16;for(let i=0;i<steps;i++){const x0=-w/2+i*w/steps,x1=-w/2+(i+1)*w/steps,yy=(x:number)=>h-head+head*1.35*(1-4*x*x/w/w);bar(u+x0,y+yy(x0),u+x1,y+yy(x1),v+.04,.17,'stone');}box(u,y+h-.14,v+.06,.30,.32,.17,'stone');}
  box(u,y+.04,v+.08,.075,h-head-.04,.10,'ochre');for(const f of [.29,.75])box(u,y+h*f,v+.08,w,.07,.10,'ochre');
  for(let x=-w/2+.16;x<w/2;x+=.22)box(u+x,y+.12,v+.025,.013,h-head-.16,.025,'dark');for(let yy=.35;yy<h-head-.05;yy+=.3)box(u,y+yy,v+.025,w-.06,.013,.025,'dark');
 }
 aperture(.20,8.61,.48,4.34,1.86);
 for(const u of [-3.78,4.05])aperture(u,5.24,.49,.42,1.47,'glass',false);
 // Sandstone shoulder assemblies and corbelled entrance cornice are signature
 // source-observed Art Nouveau elements, kept on the actual risalit front.
 for(const u of [-1.77,2.17]){const p=new T.Shape();p.moveTo(-.24,0);p.lineTo(.24,0);p.lineTo(.24,.70);p.lineTo(.38,.90);p.lineTo(.38,1.15);p.lineTo(.21,1.33);p.lineTo(.21,2.12);p.lineTo(0,2.37);p.lineTo(-.21,2.12);p.lineTo(-.21,1.33);p.lineTo(-.38,1.15);p.lineTo(-.38,.90);p.lineTo(-.24,.70);p.closePath();faced(new T.ExtrudeGeometry(p,{depth:.12,bevelEnabled:false}),u,3.25,2.04,'stone');}
 box(.20,7.65,2.05,4.47,.18,.32,'stone');box(.20,7.81,2.09,4.56,.13,.39,'stone');
 for(const u of [-1.46,-.65,.20,1.03,1.87]){box(u,7.31,2.07,.28,.34,.29,'stone');box(u,7.56,2.09,.44,.12,.39,'stone');}
 // Entrance door panels, large transom, segmented stone arch and carved plaque.
 box(.20,.88,2.035,3.22,3.05,.08,'ochre');for(const u of [-1.18,.20,1.58])box(u,.88,2.09,.10,3.05,.075,'dark');
 for(const u of [-.61,1.01])for(const y of [1.11,2.37]){box(u,y,2.101,1.12,.99,.028,'brick');box(u,y+.07,2.125,.97,.84,.025,'ochre');}
 aperture(.20,3.99,2.055,3.18,.83);box(.2,3.88,2.12,3.60,.17,.21,'stone');
 box(.2,5.34,2.02,4.01,1.06,.085,'stone');for(const [u,y,w,h]of[[.2,5.4,3.86,.035],[.2,6.30,3.86,.035],[-1.70,5.4,.035,.93],[2.1,5.4,.035,.93]])box(u,y,2.075,w,h,.025,'ochre');
 // Defining original1904 plaque, condensed smooth native font contours. Anton is
 // an explicit approximate match for the tightly set squared engraved capitals.
 const lettering=(text:string,u:number,y:number,v:number,w:number,h:number)=>{const paths=new T.ShapePath();for(const c of font.getPath(text,0,0,100,{kerning:true}).commands){if(c.type==='M')paths.moveTo(c.x,-c.y);else if(c.type==='L')paths.lineTo(c.x,-c.y);else if(c.type==='Q')paths.quadraticCurveTo(c.x1,-c.y1,c.x,-c.y);else if(c.type==='C')paths.bezierCurveTo(c.x1,-c.y1,c.x2,-c.y2,c.x,-c.y);else if(c.type==='Z')paths.currentPath?.closePath();}const g=new T.ExtrudeGeometry(paths.toShapes(),{depth:.012,bevelEnabled:false,curveSegments:3});g.computeBoundingBox();const bb=g.boundingBox!,size=bb.getSize(new T.Vector3());g.translate(-(bb.min.x+bb.max.x)/2,-bb.min.y,0);g.scale(w/size.x,h/size.y,1);g.userData={role:'source-supported-real-plaque',text,fontApproximation:'Anton condensed sans, exact1904typeface unknown'};faced(g,u,y,v,'ochre');};
 lettering('KERKGEBOUW',.20,6.05,2.079,1.72,.19);lettering('DER',.20,5.87,2.079,.43,.12);lettering('VEREEN: DOOPSGEZINDE GEMEENTE',.20,5.58,2.079,3.50,.22);lettering('ANNO',-1.22,6.10,2.079,.51,.16);lettering('1904',1.66,6.10,2.079,.48,.16);
 // Art Nouveau hood: transparent-looking pale glass plate carried by iron scroll brackets.
 roof([[...point(-1.87,2.01),4.04],[...point(2.27,2.01),4.04],[...point(2.27,3.0),3.86],[...point(-1.87,3.0),3.86]],'glass');box(.20,3.82,3.03,4.25,.09,.11,'dark');for(const u of [-1.65,2.04]){bar(u,3.02,u,3.97,2.20,.045,'dark');const pts=[];for(let i=0;i<18;i++){const t=i/17*Math.PI*1.65,r=.25*(1-i/22);pts.push(new T.Vector3(u,3.50+r*Math.sin(t),2.48+r*Math.cos(t)));}const curve=new T.CatmullRomCurve3(pts),g=new T.TubeGeometry(curve,22,.025,5,false);g.rotateY(angle);g.translate(cx,0,cz);b.add(g,'dark');}
 // Approach consists of visible five risers; photo-guided dimensions, not asserted survey.
 for(let k=0;k<5;k++)box(.20,0,2.13+(4-k)*.28,3.73,(k+1)*.176,.34,'slate');
 for(const u of [-1.62,2.02]){box(u,.88,2.33,.035,.91,.035,'dark');bar(u,.18,u,.98,3.45,.035,'dark');}
 aperture(-3.76,.36,2.04,.88,2.60,'ochre');aperture(4.24,1.30,2.04,.69,1.15);
 // Glazed-brick bands; local front faces, with the door/window apertures unobscured.
 for(const y of [1.07,1.31,3.18,3.41,4.92,5.15]){for(const [u,w] of [[-3.83,2.20],[4.06,2.55]])box(u,y,.12,w,.045,.06,'dark');}
 // Source six stepped north buttresses, three great windows between middle four.
 const na=hn[0],nzp=hn[3],dx=nzp[0]-na[0],dz=nzp[1]-na[1],L=Math.hypot(dx,dz),outX=dz/L,outZ=-dx/L,wallAngle=Math.atan2(-dz,dx);
 const sideBox=(t:number,y:number,w:number,h:number,d:number,c:C,o=.12)=>b.box(na[0]+dx*t+outX*o,y,na[1]+dz*t+outZ*o,w,h,d,c,wallAngle);
 const sideShape=(g:T.BufferGeometry,t:number,y:number,o:number,c:C)=>b.add(g,c,na[0]+dx*t+outX*o,y,na[1]+dz*t+outZ*o,wallAngle+Math.PI);
 for(const t of [.055,.24,.42,.60,.78,.97]){sideBox(t,.25,.55,3.01,.65,'brick',.16);sideBox(t,3.26,.43,2.47,.49,'brick',.10);sideBox(t,5.73,.33,2.65,.34,'brick',.07);for(const [y,w,dep] of [[3.26,.63,.76],[5.73,.51,.59],[8.20,.39,.43]])sideBox(t,y,w,.18,dep,'stone',.19);}
 for(const t of [.33,.51,.69]){const w=2.28,h=5.72,y=2.02,s=new T.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,h-.42);s.quadraticCurveTo(0,h+.10,-w/2,h-.42);s.closePath();sideShape(new T.ShapeGeometry(s,12),t,y,.10,'glass');for(const u of [-w/2,w/2])sideBox(t+u/L,y,.12,h-.32,.12,'ochre',.20);for(const yy of [y+1.97,y+4.45])sideBox(t,yy,w,.10,.12,'ochre',.20);sideBox(t,y,.10,h-.25,.12,'ochre',.20);for(let u=-.9;u<1;u+=.25)sideBox(t+u/L,y+.15,.015,h-.57,.025,'dark',.14);for(let yy=y+.4;yy<y+h-.3;yy+=.31)sideBox(t,yy,w,.015,.025,'dark',.14);sideBox(t,y-.19,w+.42,.18,.32,'stone',.20);for(let k=0;k<13;k++){const u=-w/2+k*w/12,yy=y+h-.42+.52*(1-4*u*u/w/w);sideBox(t+u/L,yy,.22,.14,.16,'stone',.20);}sideBox(t,y+h-.17,.36,.33,.18,'stone',.21);}
 for(const y of [1.07,1.31,3.18,3.41,4.92,5.15])sideBox(.5,y,L,.05,.04,'dark',.035);
 sideBox(.5,8.43,L,.29,.20,'stone',.09);sideBox(.5,8.78,L+.20,.18,.35,'white',.12);for(let u=.25;u<L;u+=.52){const s=new T.Shape();s.moveTo(-.17,0);s.lineTo(.17,0);s.lineTo(.17,.14);s.quadraticCurveTo(0,.32,-.17,.14);s.closePath();sideShape(new T.ShapeGeometry(s,6),u/L,8.40,.21,'brick');}
 // Lower kosterij: actual chamfered two-storey mass, paired T-windows and open
 // brick balustrade (the register and2025 photos retain gaps, not a solid cap).
 const ka=ring[0],kb=ring[48],kl=Math.hypot(kb[0]-ka[0],kb[1]-ka[1]),kx=(kb[0]-ka[0])/kl,kz=(kb[1]-ka[1])/kl,knx=kz,knz=-kx,kangle=Math.atan2(-kz,kx);
 const kp=(t:number,y:number,w:number,h:number,c:C,o=.12)=>b.box(ka[0]+(kb[0]-ka[0])*t+knx*o,y,ka[1]+(kb[1]-ka[1])*t+knz*o,w,h,.12,c,kangle);
 // Genuine shallow segment heads: glazing, curved timber head, and a raised
 // brick relieving arch with stone keystone, all in each actual wall plane.
 function caretakerWindow(x:number,z:number,y:number,w:number,h:number,tx:number,tz:number,ox:number,oz:number,yaw:number){
  const rise=.23,spring=h-rise;
  const at=(g:T.BufferGeometry,u:number,yy:number,o:number,c:C)=>b.add(g,c,x+tx*u+ox*o,y+yy,z+tz*u+oz*o,yaw);
  const line=(u:number,yy:number,width:number,height:number,c:C,o=.20)=>{const g=new T.BoxGeometry(width,height,.075);g.translate(0,height/2,0);at(g,u,yy,o,c);};
  const glass=new T.Shape();glass.moveTo(-w/2,0);glass.lineTo(w/2,0);glass.lineTo(w/2,spring);glass.quadraticCurveTo(0,h+rise,-w/2,spring);glass.closePath();const gg=new T.ShapeGeometry(glass,16);gg.userData={role:'caretaker-segment-head-glass',width:w,height:h};at(gg,0,0,.13,'glass');
  for(const u of [-w/2-.04,w/2+.04])line(u,0,.075,spring,'ochre');line(0,0,.075,1.70,'ochre');line(0,1.70,w+.15,.085,'ochre');line(0,-.16,w+.30,.16,'stone',.18);
  const timber=new T.Shape();timber.moveTo(-w/2,spring);timber.quadraticCurveTo(0,h+rise,w/2,spring);timber.lineTo(w/2+.07,spring+.01);timber.quadraticCurveTo(0,h+rise+.13,-w/2-.07,spring+.01);timber.closePath();const tg=new T.ExtrudeGeometry(timber,{depth:.075,bevelEnabled:false,curveSegments:16});tg.userData={role:'caretaker-arched-frame'};at(tg,0,0,.16,'ochre');
  const arch=new T.Shape();arch.moveTo(-w/2-.09,spring);arch.quadraticCurveTo(0,h+rise+.17,w/2+.09,spring);arch.lineTo(w/2+.25,spring+.025);arch.quadraticCurveTo(0,h+rise+.47,-w/2-.25,spring+.025);arch.closePath();const ag=new T.ExtrudeGeometry(arch,{depth:.09,bevelEnabled:false,curveSegments:16});ag.userData={role:'caretaker-relief-arch'};at(ag,0,0,.11,'brick');
  // Fine radial mortar joints make the relieved brick segment legible without
  // replacing its contour with a rectangular header or a pale full surround.
  for(let k=1;k<10;k++){const t=k/10,innerW=w+.18,outerW=w+.50,innerY=spring+4*(rise+.085)*t*(1-t),outerY=spring+.025+4*(rise+.2225)*t*(1-t),a=new T.Vector3((t-.5)*innerW,innerY,0),q=new T.Vector3((t-.5)*outerW,outerY,0),d=q.clone().sub(a),g=new T.BoxGeometry(.014,d.length(),.014);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));g.translate((a.x+q.x)/2,(a.y+q.y)/2,0);at(g,0,0,.211,'stone');}
  line(0,h+.045,.25,.205,'stone',.205);
 }
 for(const y of [.55,4.01])for(const t of [.27,.69])caretakerWindow(ka[0]+(kb[0]-ka[0])*t,ka[1]+(kb[1]-ka[1])*t,y,1.33,2.55,-kx,-kz,knx,knz,kangle+Math.PI);
 kp(.5,7.48,kl,.19,'brick');kp(.5,8.18,kl,.17,'stone');for(let u=.12;u<kl;u+=.47)kp(u/kl,7.66,.21,.53,'brick');
 for(const t of [0,1]){kp(t,7.55,.39,.83,'brick');const p=[ka[0]+(kb[0]-ka[0])*t,ka[1]+(kb[1]-ka[1])*t];b.add(new T.LatheGeometry([new T.Vector2(.14,0),new T.Vector2(.19,.12),new T.Vector2(.10,.32)],8),'stone',p[0],8.44,p[1]);}
 // Register-supported one T-window per storey on the narrow caretaker side.
 // The longitudinal placement is a bounded reconstruction; current frontal
 // sources establish the wing but obscure this inner forecourt face.
 const ca=[11.64,-3.37],cb=[8.96,-2.27],cdx=cb[0]-ca[0],cdz=cb[1]-ca[1],cl=Math.hypot(cdx,cdz),cnx=-cdz/cl,cnz=cdx/cl,cang=Math.atan2(-cdz,cdx),cpx=ca[0]+cdx*.28,cpz=ca[1]+cdz*.28;
 for(const y of [.55,4.01])caretakerWindow(cpx,cpz,y,1.14,2.45,cdx/cl,cdz/cl,cnx,cnz,cang);
 // Slender source-confirmed roof turret; survey misses its thin top. Photos guide
 // octagonal louvred lantern, slate tapered cap and lead piron, estimated17.0m total.
 const tur=point(.15,-2.15);b.add(new T.CylinderGeometry(.49,.52,1.55,8),'stone',tur[0],12.70,tur[1]);
 for(let i=0;i<8;i++){const a=i*Math.PI/4,px=tur[0]+.495*Math.sin(a),pz=tur[1]+.495*Math.cos(a);b.box(px,12.28,pz,.32,.86,.03,'dark',a);for(let y=12.30;y<13.11;y+=.11)b.box(px+.021*Math.sin(a),y,pz+.021*Math.cos(a),.33,.042,.04,'stone',a);}
 b.add(new T.CylinderGeometry(.65,.58,.15,8),'stone',tur[0],13.52,tur[1]);b.add(new T.ConeGeometry(.66,2.34,8),'slate',tur[0],14.76,tur[1]);b.add(new T.CylinderGeometry(.05,.10,.55,8),'stone',tur[0],16.20,tur[1]);b.add(new T.CylinderGeometry(.014,.024,.83,6),'dark',tur[0],16.85,tur[1]);
}
