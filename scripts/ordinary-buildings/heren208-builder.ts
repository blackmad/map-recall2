import * as T from 'three';
import type {BuildingTools} from '../landmarks/cultural-builders';
import {upwardRoofPlane} from '../landmarks/house-geometry';
import spec from './heren208-spec.json';
export const probes:any[]=[];
export const roofOwnership:any[]=[];
export function buildHeren208(_w:number,_d:number,b:BuildingTools){
 probes.length=0;roofOwnership.length=0;
 const add=(g:T.BufferGeometry,c:string,x=0,y=0,z=0,a=0)=>b.add(g,c,x,y,z,a);
 // Every original LoD2.2 face owns its original rings, including ground,
 // annexes, raised islands and roof31holes. No Pand parcel slab exists.
 for(const f of spec.faces){
  let g:T.BufferGeometry;
  if(f.type==='RoofSurface'){
   const shape=new T.Shape(f.rings[0].map(p=>new T.Vector2(p[0],p[2])));for(const h of f.rings.slice(1))shape.holes.push(new T.Path(h.map(p=>new T.Vector2(p[0],p[2]))));
   g=upwardRoofPlane(shape);const pos=g.getAttribute('position');
   // Preserve source vertices rather than a fitted crest/extrusion maximum.
   for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),near=f.rings.flat().reduce((a,p)=>Math.hypot(p[0]-x,p[2]-z)<Math.hypot(a[0]-x,a[2]-z)?p:a);pos.setY(i,near[1]);}g.computeVertexNormals();
   roofOwnership.push({part:f.part,face:f.face,semantic:f.semantic,rings:f.rings.length,vertices:f.rings.map(r=>r.length),heightRange:f.heightRange});
  }else{g=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(f.triangles.flat(),3));g.computeVertexNormals();}
  g.userData.source={part:f.part,face:f.face,semantic:f.semantic,rings:f.rings.length,type:f.type};
  const c=f.type==='RoofSurface'?(f.part.endsWith('-1')&&[3,4].includes(f.semantic)?'glass':f.part.endsWith('-1')&&[5,14].includes(f.semantic)?'lightRoof':'roof'):f.type==='GroundSurface'?'ground':'brick';add(g,c);
 }
 // Front measured native envelope endpoints; survey-to-installed discrepancy
 // is bounded(~0.36m). Raised geometry follows observed actual facade plane.
 const a=spec.nativeRing[36],q=spec.nativeRing[22],L=Math.hypot(q[0]-a[0],q[1]-a[1]),t=[(q[0]-a[0])/L,(q[1]-a[1])/L],n=[-t[1],t[0]],angle=Math.atan2(-t[1],t[0]);
 const point=(u:number,y:number,d:number)=>[a[0]+t[0]*u+n[0]*d,y,a[1]+t[1]*u+n[1]*d];
 const box=(u:number,y:number,w:number,h:number,c:string,d=.18,depth=.08)=>add(new T.BoxGeometry(w,h,depth),c,...point(u,y+h/2,d) as[number,number,number],angle);
 const panel=(u:number,y:number,w:number,h:number,c:string,d=.2)=>box(u,y,w,h,c,d,.035);
 const probe=(label:string,u:number,y:number,d:number,colour:string,distance=3)=>probes.push({label,point:point(u,y,d),normal:[n[0],0,n[1]],colour,distance});
 function quad(pts:number[][],c:string,d=.2){const shape=new T.Shape(pts.map(p=>new T.Vector2(p[0],p[1]))),g=new T.ShapeGeometry(shape),p=g.getAttribute('position');for(let i=0;i<p.count;i++){const v=point(p.getX(i),p.getY(i),d);p.setXYZ(i,...v as[number,number,number]);}g.computeVertexNormals();const normal=new T.Vector3().fromBufferAttribute(g.getAttribute('normal'),0);if(normal.dot(new T.Vector3(n[0],0,n[1]))<0){const ix=g.index!;for(let i=0;i<ix.count;i+=3){const z=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,z);}g.computeVertexNormals();}add(g,c);}
 function window(label:string,u:number,y:number,w:number,h:number,rows=2,cols=2,d=.31){panel(u,y,w+.15,h+.16,'white',d);panel(u,y+.08,w,h,'glass',d+.045);for(let i=1;i<cols;i++)box(u-w/2+w*i/cols,y+.08,.043,h,'white',d+.073,.033);for(let i=1;i<rows;i++)box(u,y+.08+h*i/rows,w,.043,'white',d+.073,.033);probe(label,u-w/2+w*.23,y+.08+h*.31/rows,d+.07,'glass');box(u,y-.045,w+.23,.12,'stone',d+.04,.25);}
 function arch(label:string,u:number,y:number,w:number,h:number,c='dark',d=.32){const rr=w/2,base=h-rr,pts=[[u-w/2,y],[u+w/2,y],[u+w/2,y+base]];for(let i=1;i<=12;i++){const aa=i*Math.PI/12;pts.push([u+rr*Math.cos(aa),y+base+rr*Math.sin(aa)]);}quad(pts,c,d);probe(label,u,y+h*.35,d+.005,c);for(let i=0;i<12;i++){const aa=(i+.5)*Math.PI/12,xx=u+(rr+.08)*Math.cos(aa),yy=y+base+(rr+.08)*Math.sin(aa);box(xx,yy-.055,.21,.11,'stone',d+.025,.10);}for(const side of[-1,1])box(u+side*(rr+.065),y,.11,base,'stone',d+.025,.12);}
 const south=5.10,north=L-5.55,bankW=north-south,pitch=bankW/7;
 // Fronts are slightly forward of all source relief: first-hit check prevents
 // source parent extrusion from hiding doors, glass or masonry details.
 quad([[south,0],[north,0],[north,14.25],[south,14.25]],'brick',.12);
 panel((south+north)/2,.04,bankW,3.16,'stone',.23);
 for(let i=0;i<7;i++){const u=south+(i+.5)*pitch;
  if([0,1,5,6].includes(i))arch('bank-base-arch-'+i,u,.06,1.72,2.88);else{window('bank-base-barred-'+i,u,.83,1.54,1.80,1,1,.34);probes[probes.length-1].point=point(u-.28,1.65,.40);for(let j=0;j<6;j++)box(u-.70+j*.28,.91,.045,1.70,'iron',.44,.055);for(const yy of[1.34,2.08])box(u,yy,1.50,.045,'iron',.44,.055);}
  window('bank-lower8-'+i,u,3.94,1.76,4.02,4,2,.35);window('bank-upper6-'+i,u,10.04,1.78,3.08,3,2,.35);
  // Seven original festoons suspended from end rosettes, continuous pale arc.
  const cy=9.0;for(let j=0;j<13;j++){const x=-.72+j*.12,yy=cy-.35*Math.sqrt(Math.max(0,1-(x/.75)**2));box(u+x,yy,.15,.115,'stone',.41,.13);}for(const side of[-1,1]){add(new T.SphereGeometry(.13,6,4),'stone',...point(u+side*.75,cy+.10,.42) as[number,number,number]);}
 }
 // Eight colossal brick pilasters with paired pale Ionic volutes and capitals.
 for(let i=0;i<=7;i++){const u=south+i*pitch;box(u,3.18,.46,10.26,'brick',.33,.33);box(u,3.19,.62,.32,'stone',.40,.36);box(u,13.15,.70,.32,'stone',.42,.43);box(u,13.42,.87,.15,'stone',.42,.46);for(const side of[-1,1]){const g=new T.TorusGeometry(.125,.04,4,10);g.rotateY(Math.PI/2);g.rotateY(-angle);add(g,'stone',...point(u+side*.24,13.24,.58) as[number,number,number]);}probe('bank-pilaster-'+i,u,7.0,.50,'brick');}
 for(const [y,h,w,d]of[[3.18,.18,bankW,.36],[13.57,.20,bankW+.22,.42],[13.86,.16,bankW+.35,.51],[14.04,.25,bankW+.55,.59]])box((south+north)/2,y,w,h,'stone',d,.42);
 for(let u=south+.18;u<north;u+=.40)box(u,13.72,.14,.15,'stone',.61,.20);
 // Balustrade in front of roof, separate open slots; carved solid endgroups.
 box((south+north)/2,14.36,bankW,.25,'brick',.24,.32);box((south+north)/2,16.52,bankW+.22,.22,'stone',.36,.40);
 for(let i=0;i<=7;i++)box(south+i*pitch,14.60,.50,1.92,'brick',.26,.35);
 for(let i=1;i<=5;i++){const u=south+(i+.5)*pitch;box(u,14.61,pitch-.54,.18,'stone',.29,.26);for(let j=0;j<6;j++){const xx=u-(pitch-.72)/2+j*(pitch-.72)/5;box(xx,14.8,.095,1.58,'stone',.31,.11);add(new T.SphereGeometry(.105,5,4),'stone',...point(xx,15.55,.31) as[number,number,number]);}}
 for(const u of[south+pitch*.50,north-pitch*.50]){quad([[u-pitch*.43,14.58],[u+pitch*.43,14.58],[u+pitch*.43,16.67],[u+pitch*.27,16.8],[u+pitch*.25,17.16],[u+.38,17.34],[u,17.65],[u-.38,17.34],[u-pitch*.25,17.16],[u-pitch*.27,16.8],[u-pitch*.43,16.67]],'stone',.32);for(const side of[-1,1])add(new T.SphereGeometry(.24,7,5),'stone',...point(u+side*.6,16.78,.43) as[number,number,number]);}
 for(let i=0;i<=7;i++){const u=south+i*pitch;box(u,16.75,.34,.19,'stone',.32,.35);add(new T.SphereGeometry(.17,6,4),'stone',...point(u,17.01,.32) as[number,number,number]);}
 // Three pediment dormers with pale jambs and curved segmented heads.
 for(let i=0;i<3;i++){const u=south+bankW*(.30+.20*i);box(u,17.17,1.10,1.19,'white',-.40,.48);window('bank-dormer-'+i,u,17.26,.70,.88,2,2,-.115);const pts=[[u-.65,18.33],[u+.65,18.33]];for(let j=0;j<=12;j++){const aa=j*Math.PI/12;pts.push([u+.65*Math.cos(aa),18.33+.30*Math.sin(aa)]);}quad(pts,'stone',-.11);}
 // Source-supported two roof endchimneys: never turn their maxima into walls.
 for(const u of[south+1.7,north-1.7]){box(u,21.35,.68,1.6,'brick',-3.2,.68);box(u,22.84,.90,.19,'stone',-3.2,.88);box(u,23.03,.58,.27,'stone',-3.2,.58);add(new T.SphereGeometry(.24,6,4),'stone',...point(u,23.41,-3.2) as[number,number,number]);}
 function flank(lo:number,hi:number,address:204|216){const w=hi-lo,p=w/3,top=address===204?12.95:12.55,door=address===204?lo+p/2:hi-p/2;
  quad([[lo,0],[hi,0],[hi,top],[lo,top]],'flankBrick',.12);panel((lo+hi)/2,.03,w,1.40,'stone',.23);
  for(let j=0;j<3;j++){const u=lo+(j+.5)*p;if(Math.abs(u-door)<.1){panel(u,1.12,1.14,2.62,'dark',.37);probe(address+'-raised-door',u,2,.405,'dark');if(address===216){arch('216-door-arched-transom',u,3.56,1.22,.76,'glass',.38);}else{window('204-diamond-transom',u,3.66,1.16,.62,1,1,.34);const g=new T.BoxGeometry(.055,.76,.035);for(const side of[-1,1]){const gg=g.clone();gg.rotateZ(side*.72);add(gg,'white',...point(u,4.04,.43) as[number,number,number],angle);}}}else{window(address+'-ground-'+j,u,1.70,1.15,2.67,2,2,.33);if(address===216)arch('216-ground-arch-'+j,u,4.16,1.15,.64,'glass',.48);}}
  // Correct present two upper three-window rows, never an invented third.
  for(const y of[address===204?5.30:5.12,address===204?9.18:8.80])for(let j=0;j<3;j++){const u=lo+(j+.5)*p;window(address+'-upper-'+y+'-'+j,u,y,1.19,2.55,2,2,.33);if(address===216&&y===8.80){box(u,y,1.34,.055,'iron',.53,.07);box(u,y+.67,1.34,.065,'iron',.53,.07);for(let k=0;k<8;k++)box(u-.61+k*.174,y,.035,.68,'iron',.53,.045);}}
  for(const yy of[top-.28,top-.06])box((lo+hi)/2,yy,w+.12,.19,'white',.38,.35);
  for(let j=0;j<3;j++)probe(address+'-masonry-'+j,lo+(j+.5)*p,8.23,.13,'flankBrick');
  // Source stoops approach bank-adjacent entrances; treads remain below door.
  for(let i=0;i<5;i++)box(door,.04+i*.205,1.44,.205,'stone',.60+(5-i)*.20,(5-i)*.40);
  for(const side of[-1,1]){const ru=door+side*.84;for(let j=0;j<5;j++)box(ru,.3+j*.20,.045,.65,'iron',.9+(4-j)*.23,.045);const points:Array<T.Vector3>=[];for(let j=0;j<6;j++)points.push(new T.Vector3(...point(ru,.88+j*.14,1.82-j*.22) as[number,number,number]));add(new T.TubeGeometry(new T.CatmullRomCurve3(points),8,.033,4,false),'iron');}
  probe(address+'-low-approach-door',door,1.61,.405,'dark',8);
  // Bounded visible basement minima, no invention under car occlusions.
  const basement=address===204?hi-p*.50:lo+p*.50;panel(basement,.30,1.00,.69,'dark',.31);probe(address+'-basement-minimum',basement,.6,.33,'dark');
  const cu=(lo+hi)/2;
  if(address===216){box(cu,13.15,1.98,2.29,'white',.30,.75);window('216-dormer',cu,13.32,1.52,1.93,2,2,.71);quad([[cu-1.25,15.48],[cu+1.25,15.48],[cu,16.15]],'stone',.74);}
  else{quad([[cu-1.30,top],[cu+1.30,top],[cu+1.1,top+.24],[cu+.78,top+.42],[cu+.45,top+.80],[cu,top+1.0],[cu-.45,top+.80],[cu-.78,top+.42],[cu-1.1,top+.24]],'stone',.35);}
 }
 flank(0,south,216);flank(north,L,204);
 // Current central pitched glazed surfaces3/4: bounded native ribs sit on
 // exact surveyed slopes. Islands5/14remain separate opaque uncertain roofs.
 for(const r of spec.roofs.filter(r=>r.part.endsWith('-1')&&[3,4].includes(r.semantic))){const ring=r.rings[0],v0=ring[0],v1=ring[1],v2=ring[2],v3=ring[3];for(let i=0;i<=10;i++){const f=i/10,A=new T.Vector3(...v0 as[number,number,number]).lerp(new T.Vector3(...v1 as[number,number,number]),f),B=new T.Vector3(...v3 as[number,number,number]).lerp(new T.Vector3(...v2 as[number,number,number]),f);A.y+=.035;B.y+=.035;const mid=A.clone().add(B).multiplyScalar(.5),g=new T.CylinderGeometry(.030,.030,A.distanceTo(B),4);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),B.clone().sub(A).normalize()));add(g,'white',...mid.toArray() as[number,number,number]);}}
}
