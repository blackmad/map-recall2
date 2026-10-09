import * as T from 'three';
import type {BuildingTools} from '../landmarks/cultural-builders';
import {upwardRoofPlane} from '../landmarks/house-geometry';
import spec from './keizers73-spec.json';
type C=Parameters<BuildingTools['add']>[1];
export const probes:{label:string;point:number[];normal:number[];kind:string}[]=[];
export const roofGeometries:T.BufferGeometry[]=[];
export function buildKeizers73(_w:number,_d:number,b:BuildingTools){
 probes.length=0;roofGeometries.length=0;
 const add=(g:T.BufferGeometry,c:C,x=0,y=0,z=0,a=0)=>b.add(g,c,x,y,z,a);
 const shape=(r:number[][],holes:number[][][]=[])=>{const s=new T.Shape(r.map(p=>new T.Vector2(p[0],p[1])));for(const h of holes)s.holes.push(new T.Path(h.map(p=>new T.Vector2(p[0],p[1]))));return s;};
 for(const r of spec.roofs){const g=upwardRoofPlane(shape(r.ring,r.holes)),p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,r.plane[0]*p.getX(i)+r.plane[1]*p.getZ(i)+r.plane[2]);g.computeVertexNormals();roofGeometries.push(g);add(g,'roof');}
 for(const wall of spec.nativeWalls){const{a,q=b,heights:h,normal:n}=wall as any;const bb=(wall as any).b;const ps=[[a[0],0,a[1]],[bb[0],0,bb[1]],[bb[0],h[1],bb[1]],[a[0],h[0],a[1]]],normal=new T.Vector3(...ps[1] as[number,number,number]).sub(new T.Vector3(...ps[0] as[number,number,number])).cross(new T.Vector3(...ps[2] as[number,number,number]).sub(new T.Vector3(...ps[0] as[number,number,number]))),order=normal.x*n[0]+normal.z*n[1]>0?[0,1,2,0,2,3]:[0,2,1,0,3,2],g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(order.flatMap(i=>ps[i]),3));g.computeVertexNormals();add(g,wall.edge===12?'stone':'brick');probes.push({label:'native-wall-'+wall.edge+'-'+probes.length,point:[(a[0]+bb[0])/2,Math.min(h[0],h[1])*.52,(a[1]+bb[1])/2],normal:[n[0],0,n[1]],kind:'masonry'});}
 for(const w of spec.sourceInteriorWalls){const g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(w.triangles.flat(),3));g.computeVertexNormals();add(g,'brick');}
 function facade(start:number,end:number){
  const a=spec.nativeRing[start],q=spec.nativeRing[end],L=Math.hypot(q[0]-a[0],q[1]-a[1]),t=[(q[0]-a[0])/L,(q[1]-a[1])/L],n=[-t[1],t[0]],angle=Math.atan2(-t[1],t[0]);
  const offset=(u:number)=>{for(let e=start;e<end;e++){const p=spec.nativeRing[e],q=spec.nativeRing[e+1],u0=(p[0]-a[0])*t[0]+(p[1]-a[1])*t[1],u1=(q[0]-a[0])*t[0]+(q[1]-a[1])*t[1];if(u>=Math.min(u0,u1)-.001&&u<=Math.max(u0,u1)+.001&&Math.abs(u1-u0)>.02){const f=(u-u0)/(u1-u0);return(p[0]+(q[0]-p[0])*f-a[0])*n[0]+(p[1]+(q[1]-p[1])*f-a[1])*n[1];}}return 0;};
  let overrideOffset:number|undefined;
  const pt=(u:number,y:number,d:number)=>[a[0]+t[0]*u+n[0]*(d+(overrideOffset??offset(u))),y,a[1]+t[1]*u+n[1]*(d+(overrideOffset??offset(u)))];
  const box=(u:number,y:number,w:number,h:number,dep:number,c:C,d=.22)=>add(new T.BoxGeometry(w,h,dep),c,...pt(u,y+h/2,d) as[number,number,number],angle);
  const poly=(vs:number[][],c:C,d=.24)=>{const indices=T.ShapeUtils.triangulateShape(vs.map(p=>new T.Vector2(...p as[number,number])),[]),points=vs.map(([u,y])=>pt(u,y,d)),g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(indices.flatMap(ids=>ids.flatMap(i=>points[i])),3));g.computeVertexNormals();if(new T.Vector3().fromBufferAttribute(g.getAttribute('normal'),0).dot(new T.Vector3(n[0],0,n[1]))<0){const p=g.getAttribute('position');for(let i=0;i<p.count;i+=3){const x=[p.getX(i+1),p.getY(i+1),p.getZ(i+1)];p.setXYZ(i+1,p.getX(i+2),p.getY(i+2),p.getZ(i+2));p.setXYZ(i+2,...x as[number,number,number]);}g.computeVertexNormals();}add(g,c);};
  const panel=(u:number,y:number,w:number,h:number,c:C,d=.23)=>poly([[u-w/2,y],[u+w/2,y],[u+w/2,y+h],[u-w/2,y+h]],c,d);
  const line=(ps:number[][],c:C,r=.045,d=.36)=>{const curve=new T.CatmullRomCurve3(ps.map(([u,y])=>new T.Vector3(...pt(u,y,d) as[number,number,number])));add(new T.TubeGeometry(curve,Math.max(3,ps.length*2),r,4,false),c);};
  const probe=(label:string,u:number,y:number,d:number,kind='glass')=>probes.push({label,point:pt(u,y,d),normal:[n[0],0,n[1]],kind});
  function window(label:string,u:number,y:number,w:number,h:number,cols=2,rows=4,d=.27){overrideOffset=Math.max(offset(u-w/2-.1),offset(u),offset(u+w/2+.1));panel(u,y,w+.20,h+.17,'stone',d);panel(u,y+.07,w,h-.01,'glass',d+.025);for(const x of[-1,1])panel(u+x*(w/2-.04),y+.05,.08,h,'white',d+.055);for(const yy of[y+.07,y+h-.07])panel(u,yy,w,.08,'white',d+.055);for(let c=1;c<cols;c++)panel(u-w/2+w*c/cols,y+.07,c===cols/2?.075:.038,h-.02,'white',d+.055);for(let row=1;row<rows;row++)panel(u,y+h*row/rows,w,row===Math.round(rows*.7)?.08:.034,'white',d+.055);for(const frac of[.17,.83])probe(label+'-'+frac,u+(frac-.5)*w,y+h*.47,d+.026);overrideOffset=undefined;}
  function windowCircle(label:string,u:number,cy:number,windowWidth:number,radius:number,windowD:number){
   // Source circle belongs to the same relief plane as the actual transom,
   // including max-offset compensation across the quantized stepped frontage.
   overrideOffset=Math.max(offset(u-windowWidth/2-.1),offset(u),offset(u+windowWidth/2+.1));
   const d=windowD+.085;
   line(Array.from({length:25},(_,j)=>[u+radius*Math.cos(j*Math.PI/12),cy+radius*Math.sin(j*Math.PI/12)]),'white',.032,d);
   for(let j=0;j<4;j++){const a=Math.PI/4+j*Math.PI/2;probe(label+'-quarter-'+j,u+radius*Math.cos(a),cy+radius*Math.sin(a),d+.033,'white');}
   overrideOffset=undefined;
  }
  function arch(label:string,u:number,y:number,w:number,h:number,d=.27){const rad=w/2,base=y+h-rad,outer:number[][]=[[u-w/2,y],[u+w/2,y]];for(let k=0;k<=12;k++){const an=Math.PI*k/12;outer.push([u+rad*Math.cos(an),base+rad*Math.sin(an)]);}poly(outer,'glass',d);line(Array.from({length:13},(_,k)=>{const an=Math.PI*k/12;return[u+rad*Math.cos(an),base+rad*Math.sin(an)];}),'stone',.075,d+.065);for(const x of[-1,1])panel(u+x*(w/2-.035),y,.07,h-rad,'white',d+.052);panel(u,y,w,.085,'white',d+.05);panel(u,base,w,.07,'white',d+.05);panel(u,y,.05,h-rad,'white',d+.05);panel(u,y+(h-rad)/2,w,.04,'white',d+.05);probe(label,u-w*.19,y+(h-rad)*.39,d+.006);}
  const cornice=(y:number,w=L,u=L/2)=>{box(u,y,w,.17,.40,'stone',.25);box(u,y+.18,w,.13,.56,'stone',.30);};
  const relief=(u:number,y:number,w:number,h:number)=>{panel(u,y,w,h,'stone',.31);line([[u-w*.35,y+h*.70],[u-w*.2,y+h*.30],[u,y+h*.16],[u+w*.2,y+h*.30],[u+w*.35,y+h*.70]],'relief',.085,.37);for(const x of[-.34,.34]){line([[u+x*w,y+h*.78],[u+x*w-.10,y+h*.51],[u+x*w+.08,y+h*.32]],'relief',.075,.38);}};
  const pediment=(u:number,y:number,w:number,h:number,d=.4)=>{poly([[u-w/2,y],[u+w/2,y],[u,y+h]],'stone',d);line([[u-w/2,y],[u,y+h],[u+w/2,y]],'stone',.16,d+.10);box(u,y-.08,w,.17,.5,'stone',d);};
  const nativeBacking=(y:number,h:number,c:C,d=.13)=>{for(let e=start;e<end;e++){const p=spec.nativeRing[e],q=spec.nativeRing[e+1],u0=(p[0]-a[0])*t[0]+(p[1]-a[1])*t[1],u1=(q[0]-a[0])*t[0]+(q[1]-a[1])*t[1],points=[[p[0]+n[0]*d,y,p[1]+n[1]*d],[q[0]+n[0]*d,y,q[1]+n[1]*d],[q[0]+n[0]*d,y+h,q[1]+n[1]*d],[p[0]+n[0]*d,y+h,p[1]+n[1]*d]],g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>points[i]),3));g.computeVertexNormals();if(new T.Vector3().fromBufferAttribute(g.getAttribute('normal'),0).dot(new T.Vector3(n[0],0,n[1]))<0){g.setAttribute('position',new T.Float32BufferAttribute([0,2,1,0,3,2].flatMap(i=>points[i]),3));g.computeVertexNormals();}add(g,c);}};
  return{L,pt,box,panel,poly,line,probe,window,windowCircle,arch,cornice,relief,pediment,nativeBacking};
 }
 const k=facade(6,9),K=k.L,p=K/3;
 k.nativeBacking(0,1.3,'stone',.14);k.cornice(1.25);k.cornice(5.5);k.cornice(19.28);k.panel(K/2,19.6,K,.90,'stone',.26);k.cornice(20.48);
 for(let i=0;i<3;i++){
  const u=(i+.5)*p;
  if(i===0){k.panel(u,1.38,1.35,2.42,'dark',.28);k.probe('keizers-left-door',u+.25,2.75,.281,'dark');k.window('keizers-transom',u,3.85,1.34,1.15,2,2,.28);k.windowCircle('keizers-circular-transom',u,4.43,1.34,.20,.28);}
  else k.window('keizers-lower-'+i,u,1.68,1.45,3.22,2,4);
  if(i===0){k.panel(u,.03,1.20,1.19,'dark',.31);k.probe('keizers-basement-soliddoor',u+.22,.60,.311,'dark');}else if(i===2)k.window('keizers-basement-multipane-entry',u-.27,.06,1.67,1.20,3,3,.30);
  for(const [row,y,h] of [[0,6.1,2.7],[1,9.72,2.54],[2,13.23,2.49],[3,16.67,1.87]])k.window('keizers-upper-'+row+'-'+i,u,y,1.48,h,2,row===3?2:3);
 }
 const crownY=20.58,crownR=1.28,cv:number[][]=[[K/2-crownR,crownY],[K/2+crownR,crownY]];for(let j=0;j<=20;j++){const an=j*Math.PI/20;cv.push([K/2+crownR*Math.cos(an),crownY+crownR*Math.sin(an)]);}k.line(cv,'stone',.10,.40);k.nativeBacking(20.5,.04,'stone',.25);
 // Crown backing owns only the visible half-round front plane.
 const crownShape=new T.Shape(cv.map(p=>new T.Vector2(p[0],p[1]))),cg=new T.ShapeGeometry(crownShape);const cp=cg.getAttribute('position');for(let i=0;i<cp.count;i++){const pos=k.pt(cp.getX(i),cp.getY(i),.28);cp.setXYZ(i,...pos as[number,number,number]);}cg.computeVertexNormals();const cnormal=cg.getAttribute('normal'),cfront=k.pt(0,0,1),cback=k.pt(0,0,0);if(cnormal.getX(0)*(cfront[0]-cback[0])+cnormal.getZ(0)*(cfront[2]-cback[2])<0){const ids=cg.index!;for(let i=0;i<ids.count;i+=3){const a=ids.getX(i+1);ids.setX(i+1,ids.getX(i+2));ids.setX(i+2,a);}cg.computeVertexNormals();}add(cg,'stone');k.box(K/2,20.55,.42,.58,.48,'stone',.42);k.box(K/2,20.74,.18,.20,1.32,'dark',.94);
 // Current2025 stoep: landing bridges the exposed basement door;
 // stair flight descends sideways RIGHT, rather than toward the canal.
 const landingU=p*.5,stairStart=landingU+.94,stairRun=2.38;
 k.box(landingU,1.25,1.89,.14,1.24,'stone',.82);
 for(const dx of[-1,1])k.box(landingU+dx*.86,.04,.14,1.20,.52,'stone',.54);
 for(let j=0;j<7;j++){const width=stairRun/7,u=stairStart+width*(j+.5),top=1.25*(1-j/7);k.box(u,0,width+.018,top,1.12,'stone',.78);}
 // Source-supported stone diagonal stair cheek, bounded outside the door.
 k.poly([[stairStart,.02],[stairStart+stairRun,.02],[stairStart+stairRun,.20],[stairStart,1.43]],'stone',1.40);
 k.line([[stairStart,1.45],[stairStart+stairRun,.22]],'stone',.07,1.43);
 k.line([[landingU-.91,2.23],[stairStart,2.23],[stairStart+stairRun,.94]],'iron',.032,1.47);
 for(const u of[landingU-.91,stairStart])k.line([[u,1.35],[u,2.23]],'iron',.03,1.47);
 for(const f of[.23,.51,.80])for(const yy of[.22,.61,1.02])k.probe('keizers-basement-door-exposure-'+f+'-'+yy,landingU+(f-.5)*1.20,yy,.311,'dark');
 const e=facade(12,13),E=e.L,ep=E/5;
 e.nativeBacking(0,13.5,'stone',.135);
 for(const y of[1.0,4.75,8.36,11.48,13.15])e.cornice(y);
 for(let i=0;i<5;i++){
  const u=(i+.5)*ep;
  if(i!==2)e.window('heren-ground-'+i,u,1.33,1.67,3.07,2,2,.27);
  if(i!==2)e.window('heren-basement-'+i,u,.12,1.58,.73,4,1,.29);
  for(const[row,y,h]of [[0,5.13,2.98],[1,8.82,2.39],[2,11.87,1.04]]){e.window('heren-upper-'+row+'-'+i,u,y,1.70,h,2,row===2?1:2,.30);for(const dx of[-1,1])e.box(u+dx*.96,y-.06,.17,h+.22,.23,'white',.36);e.box(u,y+h,2.12,.15,.36,'stone',.4);e.box(u,y-.15,2.17,.19,.38,'stone',.4);if(row<2){for(const dx of[-.88,.88])e.relief(u+dx,y-.28,.23,.37);}}
 }
 // Dark carved paired door under a rounded glazed transom and pale arch surround.
 const U=E/2;e.panel(U,1.04,1.80,2.63,'dark',.30);e.probe('heren-carved-door',U+.48,2.0,.301,'dark');e.arch('heren-round-transom',U,3.50,1.80,1.03,.31);probes.pop();e.probe('heren-round-transom',U-.35,4.05,.311);for(const dx of[-1,1])e.box(U+dx*1.03,1.0,.24,3.11,.34,'white',.40);e.line(Array.from({length:21},(_,j)=>[U+1.06*Math.cos(j*Math.PI/20),3.7+1.06*Math.sin(j*Math.PI/20)]),'white',.13,.45);
 for(const dx of[-.45,.45])for(const yy of[1.30,2.31]){e.box(U+dx,yy,.68,.84,.05,'relief',.36);e.box(U+dx,yy+.1,.51,.60,.05,'dark',.405);}
 for(let j=0;j<6;j++)e.box(U,1.04-j*.17,2.32,.17,.32,'stone',.54+j*.26);
 // Balcony slab, two sculptural supports, repeated circular metal balustrade.
 e.box(U,4.88,3.14,.18,1.09,'stone',.70);for(const dx of[-1,1]){e.box(U+dx*1.08,4.16,.35,.64,.42,'stone',.42);e.line([[U+dx*1.10,4.19],[U+dx*1.0,4.43],[U+dx*.98,4.81]],'stone',.15,.66);}
 e.box(U,5.74,3.10,.045,.06,'iron',1.18);e.box(U,5.09,3.1,.045,.06,'iron',1.18);for(let i=0;i<7;i++){const u=U-1.32+i*.44;e.line(Array.from({length:17},(_,j)=>[u+.17*Math.cos(j*Math.PI/8),5.41+.24*Math.sin(j*Math.PI/8)]),'iron',.022,1.18);}for(const dx of[-1,1]){e.line([[U+dx*1.51,5.12],[U+dx*1.51,5.75]],'iron',.028,.75);}
 for(let u=.30;u<E;u+=.77){e.box(u,12.98,.16,.36,.25,'white',.43);}
 e.poly([[U-2.13,13.45],[U+2.13,13.45],[U+2.13,13.51],[U+1.69,13.81],[U+.90,14.18],[U,14.39],[U-.90,14.18],[U-1.69,13.81],[U-2.13,13.51]],'stone',.32);e.probe('heren-solid-curved-tympanum',U+.30,13.90,.321,'stone');
 e.line([[U-2.13,13.51],[U-1.69,13.81],[U-.90,14.18],[U,14.39],[U+.90,14.18],[U+1.69,13.81],[U+2.13,13.51]],'stone',.13,.42);
 e.line([[U-1.5,13.55],[U-.85,13.84],[U,14.02],[U+.85,13.84],[U+1.5,13.55]],'relief',.065,.46);
 // No invented hidden rear windows or lettering; roof21 retains its6.5m low mass.
}
