import * as T from 'three';
import type {BuildingTools} from '../landmarks/cultural-builders';
import {upwardRoofPlane} from '../landmarks/house-geometry';
import {nativeRoofEnvelope} from './roof-step-support.mjs';
import spec from './brouwers1-spec.json';
type C=string;
export const probes:any[]=[];
export const reports:any={};
/** Original geometry from current facade evidence and independently owned survey planes. */
export function buildBrouwers1(_w:number,_d:number,b:BuildingTools){
 probes.length=0;
 const add=(g:T.BufferGeometry,c:C,x=0,y=0,z=0,a=0)=>b.add(g,c as Parameters<BuildingTools['add']>[1],x,y,z,a);
 const shape=(ring:number[][],holes:number[][][]=[])=>{const s=new T.Shape(ring.map(p=>new T.Vector2(p[0],p[1])));for(const h of holes)s.holes.push(new T.Path(h.map(p=>new T.Vector2(p[0],p[1]))));return s;};
 const low245=spec.roofs.find(r=>r.surface===245&&r.role==='survey-roof-owner')!;
 for(const raw of spec.roofs){const r=raw.surface===246?{...raw,plane:low245.plane}:raw;const g=upwardRoofPlane(shape(r.ring,r.holes)),p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,r.plane[0]*p.getX(i)+r.plane[1]*p.getZ(i)+r.plane[2]);g.computeVertexNormals();g.userData.sourceRoof=r.surface;add(g,r.surface===244?'chamber':[222,226,240,242,243].includes(r.surface)?'tile':'roof');}
 const regions=spec.roofs.map(r=>({sourceRegionIndex:r.surface===246?245:r.surface,ring:r.ring.map(p=>{const plane=r.surface===246?low245.plane:r.plane;return[p[0],plane[0]*p[0]+plane[1]*p[1]+plane[2],p[1]];})}));
 const env=nativeRoofEnvelope(regions,spec.nativeRing,spec.nativeRing.map((_,i)=>i),'brick',{boundedHeights:true});
 // Place the exact native wall planes together at corners; helper's generic
 // outward displacement is unsuitable for this highly articulated footprint.
 for(const [i,item]of env.groups.entries()){const p=item.geometry.getAttribute('position'),n=env.report[i].outwardNormalXZ;for(let j=0;j<p.count;j++){p.setX(j,p.getX(j)-n[0]*.018);p.setZ(j,p.getZ(j)-n[1]*.018);if(env.report[i].nativeEdge===14&&p.getY(j)>12.10)p.setY(j,12.10);}item.geometry.computeVertexNormals();add(item.geometry,env.report[i].nativeEdge===2?'white':env.report[i].nativeEdge===3?'warehouseBrick':'brick');}
 reports.nativeEnvelope=env.report;reports.facadeOwnershipOverrides=[{nativeEdge:14,topMetres:12.10,reason:"Singel26 source neckgable owns facade above straight lowercornice; do not expose generic survey triangle"},{sourceRoof:246,exteriorOwner:245,reason:"Tiny inset raisedpatch cannot extrapolate into exteriorwall; raisedroof/shaft unadmitted pending evidence; neighboring low245 envelope owns visible patch"},{sourceRoof:244,role:"Measured raisedroofchamber",wallColor:"white",topColor:"chamber",reason:"Detailed currentaerial green/darkflat withwhitechamber rim, rawWallSurfaces support raisedlocalheight"}];
 // Exact source-edge internal step supports are prepared by the local Python
 // ownership analysis, split at crossing roof edges, not metre sampling.
 for(const s of ((spec as any).supports??[]).filter((s:any)=>s.upper!==246)){let pts=s.points as number[][];const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>pts[i]),3));g.computeVertexNormals();add(g,s.upper===244?'white':'brick');}
 // Source aerial244 central green/dark flat chamber has pale vertical rim
 // faces. Preserve the measured raisedtop/hip eaves and add its observed
 // independent lightweight rim; do not extrapolate it into ground walls.
 const chamber=spec.roofs.find(r=>r.surface===244&&r.role==='survey-roof-owner')!;for(let i=0;i<chamber.ring.length;i++){const a=chamber.ring[i],q=chamber.ring[(i+1)%chamber.ring.length],dx=q[0]-a[0],dz=q[1]-a[1],L=Math.hypot(dx,dz);if(L<.03)continue;const middle=[(a[0]+q[0])/2,(a[1]+q[1])/2],height=chamber.plane[0]*middle[0]+chamber.plane[1]*middle[1]+chamber.plane[2];add(new T.BoxGeometry(L+.025,.10,.11),'white',middle[0],height+.04,middle[1],Math.atan2(-dz,dx));}
 const signed=spec.nativeRing.reduce((s,p,i)=>s+p[0]*spec.nativeRing[(i+1)%spec.nativeRing.length][1]-p[1]*spec.nativeRing[(i+1)%spec.nativeRing.length][0],0);
 const frame=(start:number,end:number)=>{const a=spec.nativeRing[start],q=spec.nativeRing[end],L=Math.hypot(q[0]-a[0],q[1]-a[1]),t=[(q[0]-a[0])/L,(q[1]-a[1])/L],n=signed<0?[-t[1],t[0]]:[t[1],-t[0]];return{a,t,n,L,start,end};};
 function facade(f:ReturnType<typeof frame>){const {a,t,n,L}=f,angle=Math.atan2(-t[1],t[0]);
 const nativeOffset=(u:number)=>{for(let i=f.start;i<f.end;i++){const p=spec.nativeRing[i],q=spec.nativeRing[i+1],pu=(p[0]-a[0])*t[0]+(p[1]-a[1])*t[1],qu=(q[0]-a[0])*t[0]+(q[1]-a[1])*t[1];if(u>=Math.min(pu,qu)-.001&&u<=Math.max(pu,qu)+.001&&Math.abs(qu-pu)>.01){const v=(u-pu)/(qu-pu);return(p[0]+(q[0]-p[0])*v-a[0])*n[0]+(p[1]+(q[1]-p[1])*v-a[1])*n[1];}}return 0;};
 const point=(u:number,y:number,d:number)=>[a[0]+t[0]*u+n[0]*(d+nativeOffset(u)),y,a[1]+t[1]*u+n[1]*(d+nativeOffset(u))];
 const quad3=(vertices:number[][],col:C)=>{let order=[0,1,2,0,2,3];const nn=new T.Vector3(...vertices[1] as[number,number,number]).sub(new T.Vector3(...vertices[0] as[number,number,number])).cross(new T.Vector3(...vertices[2] as[number,number,number]).sub(new T.Vector3(...vertices[0] as[number,number,number])));if(nn.dot(new T.Vector3(n[0],0,n[1]))<0)order=[0,2,1,0,3,2];const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(order.flatMap(i=>vertices[i]),3));g.computeVertexNormals();add(g,col);};
 const quad=(poly:number[][],col:C,d=.08)=>{const tri=T.ShapeUtils.triangulateShape(poly.map(p=>new T.Vector2(...p as[number,number])),[]),vertices=poly.map(([u,y])=>point(u,y,d)),arr=tri.flatMap(ids=>{const nn=new T.Vector3(...vertices[ids[1]] as[number,number,number]).sub(new T.Vector3(...vertices[ids[0]] as[number,number,number])).cross(new T.Vector3(...vertices[ids[2]] as[number,number,number]).sub(new T.Vector3(...vertices[ids[0]] as[number,number,number])));if(nn.dot(new T.Vector3(n[0],0,n[1]))<0)ids.reverse();return ids.flatMap(i=>vertices[i]);});const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(arr,3));g.computeVertexNormals();add(g,col);};
 const curved=(sh:T.Shape,col:C,d:number)=>{const g=new T.ShapeGeometry(sh,12),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const q=point(p.getX(i),p.getY(i),d);p.setXYZ(i,...q as[number,number,number]);}g.computeVertexNormals();if(new T.Vector3().fromBufferAttribute(g.getAttribute('normal'),0).dot(new T.Vector3(n[0],0,n[1]))<0){const ids=g.index!;for(let j=0;j<ids.count;j+=3){const a=ids.getX(j+1);ids.setX(j+1,ids.getX(j+2));ids.setX(j+2,a);}g.computeVertexNormals();}add(g,col);};
 const panel=(u:number,y:number,w:number,h:number,col:C,d=.08)=>quad([[u-w/2,y],[u+w/2,y],[u+w/2,y+h],[u-w/2,y+h]],col,d);
 const box=(u:number,y:number,w:number,h:number,dep:number,col:C,d=.1)=>{const p=point(u,y+h/2,d);add(new T.BoxGeometry(w,h,dep),col,...p as[number,number,number],angle);};
 const probe=(label:string,u:number,y:number,d:number,kind='glass')=>probes.push({label,point:point(u,y,d),normal:[n[0],0,n[1]],kind});
 function window(label:string,u:number,y:number,w:number,h:number,rows=2,cols=2,deep=false,forward=.20){const d=deep?.09:forward,outer=deep?.52:forward+.05;panel(u,y,w,h,'glass',d);const border=deep?.17:.10;
 for(const [x,yy,ww,hh]of[[u-w/2-border/2,y,border,h],[u+w/2+border/2,y,border,h],[u,y-border,w+border*2,border],[u,y+h,w+border*2,border]])box(x,yy,ww,hh,deep?.10:.12,'white',outer);
 if(deep){const corners=[[u-w/2,y],[u+w/2,y],[u+w/2,y+h],[u-w/2,y+h]];for(let k=0;k<4;k++){const [a,b]=[corners[k],corners[(k+1)%4]];quad3([point(a[0],a[1],outer),point(b[0],b[1],outer),point(b[0],b[1],d),point(a[0],a[1],d)],'reveal');}}
 for(let k=1;k<cols;k++)panel(u-w/2+w*k/cols,y,.046,h,'frame',d+.028);for(let k=1;k<rows;k++)panel(u,y+h*k/rows,w,.05,'frame',d+.028);
 box(u,y-.045,w+.24,.075,.21,'white',outer+.035);probe(label,u+(label==='corner-basement-false3'?w*.23:-w*.23),y+h*(label.includes('basement')?.91:label.startsWith('warehouse')?.71:.43),d+.002);}
 const cornice=(y:number,u=L/2,w=L)=>{box(u,y-.15,w,.13,.27,'stone',.17);box(u,y,w,.20,.42,'white',.25);box(u,y+.22,w+.12,.13,.62,'white',.34);};
 function rail(u:number,y:number,w:number,d:number,h=.85){for(const yy of [y+.08,y+h])box(u,yy,w,.045,.055,'iron',d);for(let x=u-w/2;x<=u+w/2+.005;x+=.20)box(x,y,.027,h,.045,'iron',d);}
 function entrance(label:string,u:number,y:number,h:number=4.1,w=1.48){panel(u,y,w,h,'door',.27);panel(u,y+h-1.05,w,1.05,'glass',.30);for(const x of[u-w/2-.18,u+w/2+.18]){box(x,y,.32,h+.08,.40,'white',.33);box(x,y+h-.15,.44,.20,.50,'stone',.40);}cornice(y+h+.04,u,w+.72);box(u,y+h-1.15,w,.16,.30,'stone',.36);for(const yy of[y+.4,y+1.65]){box(u,yy,w-.22,.08,.045,'frame',.31);box(u-w/2+.12,yy,.08,1.05,.045,'frame',.31);box(u+w/2-.12,yy,.08,1.05,.045,'frame',.31);}probe(label,u-.22,y+h*.30,.272,'door');
 // Original radial snijraam, restrained approximation of source-cut fanwork.
 const cy=y+h-.53;for(let j=0;j<8;j++){const angle=j*Math.PI/4,pp=point(u,cy,.34),g=new T.BoxGeometry(.65,.022,.025);g.rotateZ(angle);add(g,'white',...pp as[number,number,number],Math.atan2(-t[1],t[0]));}
 }
 function stoop(u:number,width:number,top=1.65){
 // Raised landing keeps the observed cellar entrance below it open.
 box(u,top-.23,width,.23,.78,'stone',.91);
 for(const sign of[-1,1]){const count=6;for(let k=0;k<count;k++){const height=top*(count-k)/count,x=u+sign*(width/2+.28+k*.22);box(x,0,.45,height,.75,'stone',.98+k*.11);box(x,height,.045,.83,.05,'iron',1.26+k*.11);}const pa=point(u+sign*(width/2+.15),top+.84,1.23),pb=point(u+sign*(width/2+1.42),.96,1.91),v=new T.Vector3(...pb as[number,number,number]).sub(new T.Vector3(...pa as[number,number,number])),g=new T.BoxGeometry(.055,v.length(),.055);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),v.clone().normalize()));const mid=new T.Vector3(...pa as[number,number,number]).add(new T.Vector3(...pb as[number,number,number])).multiplyScalar(.5);add(g,'iron',mid.x,mid.y,mid.z);}
 }
 return{L,point,quad,curved,panel,box,probe,window,cornice,rail,entrance,stoop,n,t};}
 // White joined warehouse has two trapezium heads and its deep unglazed
 // physical reveals are retained, with source selected loading guards.
 const wh=facade(frame(2,3)),pitch=wh.L/6,holes:number[][][]=[];
 const openings:any[]=[];
 for(let k=0;k<6;k++){const u=(k+.5)*pitch;for(const [y,h,w]of [[.10,1.18,pitch*.63],[2.05,2.55,pitch*.69],[5.7,2.60,pitch*.69],[9.4,2.2,pitch*.69],[12.65,1.75,pitch*.64]]){openings.push({u,y,w,h,k});holes.push([[u-w/2,y],[u+w/2,y],[u+w/2,y+h],[u-w/2,y+h]]);}}
 const outer=[[0,.02],[wh.L,.02],[wh.L,15.45],[wh.L-.55,16.48],[pitch*3+.55,16.48],[pitch*3,15.45],[pitch*3-.55,16.48],[.55,16.48],[0,15.45]],s=shape(outer,holes),g=new T.ShapeGeometry(s),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const q=wh.point(p.getX(i),p.getY(i),.52);p.setXYZ(i,...q as[number,number,number]);}g.computeVertexNormals();if(new T.Vector3().fromBufferAttribute(g.getAttribute('normal'),0).dot(new T.Vector3(wh.n[0],0,wh.n[1]))<0){const ix=g.index!;for(let j=0;j<ix.count;j+=3){const a=ix.getX(j+1);ix.setX(j+1,ix.getX(j+2));ix.setX(j+2,a);}g.computeVertexNormals();}add(g,'white');
 for(const o of openings){wh.window('warehouse-'+o.k+'-'+o.y,o.u,o.y,o.w,o.h,o.y<1?1:2,2,true);if((o.k%3===1&&[2.05,9.4].includes(o.y))||(o.k%3===0&&o.y===5.7))wh.rail(o.u,o.y+.08,o.w,.40,o.y===2.05?1.12:.82);}
 for(let k=0;k<=6;k++){const u=k*pitch;for(const y of[3.0,6.8,10.6,13.9]){wh.box(u,y,.032,.50,.032,'iron',.585);wh.box(u,y+.17,.16,.035,.038,'iron',.59);}}
 wh.box(pitch*3,.05,.13,15.6,.09,'brick',.58);for(const [u,y]of[[pitch*1.5,16.33],[pitch*4.5,16.33]])wh.box(u,y,pitch*2.6,.15,.32,'white',.55);
 // Independent original01246 projected scope: this6.64m frontage is a
 // distinct brick building within the same parent, not another white warehouse.
 // Continuous broad white spandrels/window bands retain its modern character.
 const modern=facade(frame(3,4)),bandWidth=modern.L-.44;
 modern.panel(modern.L/2,.02,modern.L,15.84,'warehouseBrick',.035);
 modern.panel(modern.L/2,.02,bandWidth+.20,11.79,'white',.06);
 for(const [y,h]of[[.10,1.85],[2.76,2.33],[6.31,2.32],[9.91,1.56]]){
  modern.window('brick-band-'+y,modern.L/2,y,bandWidth,h,y===.10?1:2,y===9.91?4:3,false,.12);
  if(y!==9.91)modern.panel(modern.L/2,y+h+.11,bandWidth+.19,.85,'white',.19);
 }
 // Ground band is interrupted by the observed central entrance leaf.
 modern.panel(modern.L*.50,.11,1.26,1.78,'door',.16);modern.box(modern.L*.50,.11,.05,1.78,.045,'white',.205);modern.probe('brick-ground-entry',modern.L*.45,.94,.162,'door');
 modern.window('brick-small-top-pair',modern.L*.5,12.85,2.42,1.28,2,2,false,.12);
 modern.box(modern.L*.50,15.73,modern.L,.14,.18,'warehouseBrick',.07);modern.box(modern.L*.5,15.08,.12,.16,.90,'iron',.52);modern.box(modern.L*.5,14.64,.08,.45,.09,'iron',.89);
 for(const u of[.14,modern.L-.14])for(const y of[1.1,5.0,8.8,12.4])modern.box(u,y,.030,.45,.035,'iron',.095);
 const cornerFront=facade(frame(0,1)),cornerSide=facade(frame(1,2));
 for(const [face,count,side]of[[cornerFront,6,false],[cornerSide,4,true]] as const){const q=face.L/count;face.panel(face.L/2,.01,face.L,1.82,'stone',.045);
 for(let k=0;k<count;k++){const u=(k+.5)*q;face.window('corner-basement-'+side+k,u,.36,q*.67,.83,1,2);for(const [y,h]of[[2.1,3.88],[7.02,2.88],[11.00,2.05],[14.10,1.36]]){if(!side&&k===2&&y===2.1)continue;face.window('corner-'+side+k+'-'+y,u,y,q*.70,h,2,2);}}
 face.cornice(16.03);for(let u=.4;u<face.L-.1;u+=q){face.box(u,15.70,.24,.35,.42,'stone',.29);face.box(u,15.95,.38,.12,.53,'white',.34);}
 }
 const cp=cornerFront.L/6;cornerFront.entrance('corner-empire-entry',cp*2.5,1.80,4.45,1.5);cornerFront.stoop(cp*2.5,2.15,1.80);const medallion=(r:number)=>Array.from({length:33},(_,i)=>[cp*2.5+r*Math.cos(i/32*Math.PI*2),5.72+r*Math.sin(i/32*Math.PI*2)]);cornerFront.quad(medallion(.29),'frame',.36);cornerFront.quad(medallion(.245),'stone',.375);
 const fronts=[{start:14,end:15,name:'singel26',top:12.05},{start:15,end:17,name:'singel24',top:17.05},{start:17,end:21,name:'singel22',top:18.24}];
 for(const cfg of fronts){const face=facade(frame(cfg.start,cfg.end)),q=face.L/3;
 face.panel(face.L/2,.02,face.L,1.75,'stone',.045);
 if(cfg.name==='singel24'){face.panel(face.L/2,1.74,face.L,3.55,'stone',.075);for(let y=1.9;y<5.3;y+=.43)face.panel(face.L/2,y,face.L,.025,'joint',.092);}
 const tiers=cfg.name==='singel26'?[[1.88,2.88],[5.70,2.92],[9.40,2.00]]:[[1.90,3.10],[6.00,3.40],[10.62,2.71],[cfg.name==='singel22'?15.60:14.35,1.58]];
 for(let k=0;k<3;k++){const u=(k+.5)*q;face.window(cfg.name+'-basement-'+k,u,.22,q*.63,1.05,1,2);for(const [y,h]of tiers){if(y===tiers[0][0]&&k===(cfg.name==='singel24'?2:1))continue;face.window(cfg.name+'-'+k+'-'+y,u,y,q*.67,h,2,2);if(cfg.name==='singel22'&&y===10.62){face.rail(u,y+.06,q*.68,.39,.70);for(let j=0;j<3;j++){const x=u-q*.22+j*q*.22;face.box(x,y+.17,.022,.45,.03,'iron',.405);}}}}
 const entryU=cfg.name==='singel24'?q*2.5:q*1.5;face.entrance(cfg.name+'-empire-entry',entryU,1.78,cfg.name==='singel24'?3.22:3.35,q*.63);face.stoop(entryU,q*.87,1.76);
 if(cfg.name==='singel26'){
 // Actual00905/00906 neck profile: scroll shoulders curve into an
 // upright neck. This facade owns the front; the survey triangle is clipped.
 const W=face.L,neck=(inset:number)=>{const sh=new T.Shape(),base=12.08+inset;sh.moveTo(.06+inset,base);sh.lineTo(W-.06-inset,base);sh.lineTo(W-.06-inset,12.42-inset);sh.bezierCurveTo(W-.70,12.42-inset,W-.66,13.18,W-1.03,13.48-inset);sh.bezierCurveTo(W-1.14,13.94-inset,W*.65+inset,14.12,W*.65-inset,14.25);sh.lineTo(W*.65-inset,15.57-inset);sh.lineTo(W*.61-inset,15.57-inset);sh.bezierCurveTo(W*.62-inset,15.82-inset,W*.38+inset,15.82-inset,W*.39+inset,15.57-inset);sh.lineTo(W*.35+inset,15.57-inset);sh.lineTo(W*.35+inset,14.25);sh.bezierCurveTo(W*.35-inset,14.12,1.14,13.94-inset,1.03,13.48-inset);sh.bezierCurveTo(.66,13.18,.70,12.42-inset,.06+inset,12.42-inset);sh.closePath();return sh;};
 face.curved(neck(0),'white',.36);face.curved(neck(.14),'brick',.39);
 // Shoulder curls have an actual curved outline; small inner disks express
 // the scroll turns without exporting a photograph or restoring a steppedhead.
 for(const u of[.54,W-.54]){const pts=Array.from({length:25},(_,i)=>[u+.21*Math.cos(i/24*Math.PI*2),12.48+.21*Math.sin(i/24*Math.PI*2)]);face.quad(pts,'white',.40);const inner=pts.map(([x,y])=>[u+(x-u)*.60,12.48+(y-12.48)*.60]);face.quad(inner,'brick',.412);}
 face.window('singel26-attic',W*.5,12.62,1.18,1.15,2,2,false,.48);
 face.cornice(12.05);face.box(W*.5,15.55,W*.28,.17,.42,'white',.43);face.box(W*.50,14.92,.16,.19,1.65,'iron',1.04);face.box(W*.50,14.38,.14,.57,.14,'iron',1.80);
 face.probe('singel26-neck-crown',W*.5,15.34,.392,'brick');face.probe('singel26-white-shoulder',.40,12.43,.402,'white');
 }else{face.cornice(cfg.top);if(cfg.name==='singel22')face.probe('singel22-straight-eave',face.L/2,cfg.top+.27,.652,'white');if(cfg.name==='singel24'){
 for(let u=.23;u<face.L;u+=.63){face.box(u,cfg.top-.38,.25,.26,.27,'stone',.27);for(const dx of[-.07,0,.07])face.box(u+dx,cfg.top-.38,.019,.25,.025,'joint',.42);}face.box(face.L*.5,17.40,face.L*.98,.30,.47,'stone',.28);
 // Sandstone attic: central raised panel, paired scroll shoulders and
 // a ship hull with three masts, yards and triangular furled sail shapes.
 face.quad([[.06,17.55],[face.L-.06,17.55],[face.L-.15,18.03],[face.L*.73,18.03],[face.L*.67,18.62],[face.L*.60,18.81],[face.L*.4,18.81],[face.L*.33,18.62],[face.L*.27,18.03],[.15,18.03]],'stone',.29);face.box(face.L*.5,18.77,face.L*.26,.13,.35,'white',.34);
 const u=face.L*.5;face.quad([[u-.85,18.87],[u+.95,18.87],[u+.68,18.64],[u-.60,18.64]],'stone',.40);for(const [dx,h]of[[-.50,.69],[0,.87],[.50,.63]]){face.box(u+dx,18.9,.046,h,.04,'stone',.40);face.box(u+dx,19.20,.43,.038,.04,'stone',.40);face.quad([[u+dx+.03,19.20],[u+dx+.03,19.54],[u+dx+.30,19.20]],'stone',.405);}face.probe('singel24-ship-hull',u,18.75,.403,'stone');
 }}
 }
}
