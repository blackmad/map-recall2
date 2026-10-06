import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism} from './house-geometry';
import source from './wine-guildhall-footprints.json';

/** All observations inform the fit, avoiding near-collinear first triples. */
export function fitWineGuildhallPlane(rings:number[][][]){
 const ps=rings.flat(),c=ps.reduce((s,p)=>s.map((v,i)=>v+p[i]),[0,0,0]).map(v=>v/ps.length);
 let xx=0,xz=0,zz=0,xy=0,zy=0;
 for(const p of ps){const x=p[0]-c[0],y=p[1]-c[1],z=p[2]-c[2];xx+=x*x;xz+=x*z;zz+=z*z;xy+=x*y;zy+=z*y;}
 const det=xx*zz-xz*xz;if(!(det>1e-12*xx*zz))throw Error('Unstable projected survey plane');
 const a=(xy*zz-zy*xz)/det,b=(zy*xx-xy*xz)/det;
 const height=(x:number,z:number)=>c[1]+a*(x-c[0])+b*(z-c[2]);
 const residual=Math.max(...ps.map(p=>Math.abs(height(p[0],p[2])-p[1])));
 if(residual>.01)throw Error(`Nonplanar survey roof ${residual}`);return{height,residual};
}

/** Original flat-colour house style, exact current holed BAG scope. */
export function buildWineGuildhall(_w:number,_d:number,b:BuildingTools){
 type Colour=Parameters<BuildingTools['add']>[1];
 // Survey regions constrain original shell/plane geometry; no render mesh is imported.
 for(const rings of source.surveyRoofPolygons){
  const s=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[2])));
  for(const h of rings.slice(1))s.holes.push(new T.Path(h.map(p=>new T.Vector2(p[0],p[2]))));
  const {height,residual}=fitWineGuildhallPlane(rings),base=Math.min(...rings.flat().map(p=>p[1]));
  const shell=openTopPrism(s,0,base);shell.userData.role='survey-shell';b.add(shell,'brick');
  const g=new T.ShapeGeometry(s),p=g.getAttribute('position');
  for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getY(i);p.setXYZ(i,x,height(x,z),z);}
  const ix=g.index!;for(let i=0;i<ix.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,ix.getX(i)),q=new T.Vector3().fromBufferAttribute(p,ix.getX(i+1)),r=new T.Vector3().fromBufferAttribute(p,ix.getX(i+2));if(q.sub(a).cross(r.sub(a)).y<0){const k=ix.getX(i+1);ix.setX(i+1,ix.getX(i+2));ix.setX(i+2,k);}}
  g.computeVertexNormals();g.userData.role='roof';g.userData.sourceRings=rings;g.userData.residual=residual;b.add(g,'red');
  const v:number[]=[];for(const ring of rings)for(let i=0;i<ring.length;i++){const a=ring[i],c=ring[(i+1)%ring.length],ay=height(a[0],a[2]),cy=height(c[0],c[2]);v.push(a[0],base,a[2],c[0],base,c[2],c[0],cy,c[2],a[0],base,a[2],c[0],cy,c[2],a[0],ay,a[2]);}
  const sides=new T.BufferGeometry();sides.setAttribute('position',new T.Float32BufferAttribute(v,3));sides.computeVertexNormals();b.add(sides,'brick');
 }
 const chain=source.frontEdgeIndices.map(i=>new T.Vector2(...source.localRing[i])),mid=chain[0].clone().lerp(chain.at(-1)!,.5),u=chain.at(-1)!.clone().sub(chain[0]).normalize(),width=chain[0].distanceTo(chain.at(-1)!),horizontalScale=width/18.548521629031217,frontNormal=new T.Vector2(-u.y,u.x);
 const projection=(p:T.Vector2)=>p.clone().sub(mid).dot(u);
 function frame(x:number){
  const distance=x*horizontalScale;
  // Survey jogs can backtrack a millimetre along the common tangent. Select
  // the exposed envelope where two native segments overlap in projection.
  let point:T.Vector2|undefined,exposure=-Infinity;
  for(let i=0;i<chain.length-1;i++){
   const a=chain[i],c=chain[i+1],lo=projection(a),hi=projection(c);
   if(distance<Math.min(lo,hi)-1e-9||distance>Math.max(lo,hi)+1e-9)continue;
   const q=a.clone().lerp(c,(distance-lo)/(hi-lo)),out=q.dot(frontNormal);
   if(out>exposure){point=q;exposure=out;}
  }
  if(!point)point=distance<projection(chain[0])?chain[0].clone():chain.at(-1)!.clone();
  return{point,normal:frontNormal};
 }
 function at(x:number,z:number){const f=frame(x);return f.point.clone().addScaledVector(f.normal,z);}
 // Warp every original facade vertex to the current boundary chain. This
 // retains the measured northeast frontage and its small boundary jogs; there
 // is no longest-edge selection or rigid floating plane across the setback.
 function add(g:T.BufferGeometry,c:Colour,x:number,y:number,z:number){const p=g.getAttribute('position');for(let i=0;i<p.count;i++){const q=at(x+p.getX(i),z+p.getZ(i));p.setXYZ(i,q.x,y+p.getY(i),q.y);}g.computeVertexNormals();g.userData.role='principal-facade';b.add(g,c);}
 // Rectangular details spanning a surveyed frontage jog need vertices at that
 // jog. A two-endpoint box bridges the notch and buries part of its glazing in
 // the separately correct masonry backing. Split at native projected breaks;
 // micrometre seams select the correct side of nearly perpendicular jogs.
 const detailBreaks=chain.slice(1,-1).map(p=>projection(p)/horizontalScale).sort((a,c)=>a-c);
 function box(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour){
  const lo=x-w/2,hi=x+w/2,cuts=[lo,...detailBreaks.filter(v=>v>lo&&v<hi),hi];
  for(let i=0;i<cuts.length-1;i++){
   const a=cuts[i]+(i?1e-6:0),q=cuts[i+1]-(i<cuts.length-2?1e-6:0);
   if(q>a)add(new T.BoxGeometry(q-a,h,d),c,(a+q)/2,y+h/2,z);
  }
 }
 function outline(points:number[][],x:number,y:number,z:number,c:Colour,depth=.12){const s=new T.Shape(points.map(p=>new T.Vector2(...p)));s.closePath();add(new T.ExtrudeGeometry(s,{depth,bevelEnabled:false,curveSegments:10}),c,x,y,z);}
 // The photograph-supported thin principal masonry plane backs the sash
 // assemblies, including portions where the surveyed roof behind it is low.
 // It is confined to the actual street perimeter, never a parcel slab/cap.
 const cross=(a:T.Vector2,c:T.Vector2)=>a.x*c.y-a.y*c.x;
 function intersect(a:T.Vector2,d:T.Vector2,c:T.Vector2,e:T.Vector2){return a.clone().addScaledVector(d,cross(c.clone().sub(a),e)/cross(d,e));}
 for(let i=0;i<chain.length-1;i++){const a=chain[i].clone(),c=chain[i+1].clone(),d=c.clone().sub(a),n=new T.Vector2(-d.y,d.x).normalize();if(i===0)a.addScaledVector(d.clone().normalize(),.015);if(i===chain.length-2)c.addScaledVector(d.clone().normalize(),-.015);let ia=a.clone().addScaledVector(n,-.13),ic=c.clone().addScaledVector(n,-.13);
  // End mitres stop exactly at the adjoining party line, rather than leaking
  // a rectangular strip into the separately retained neighbouring Pand.
  if(i===0){const p=new T.Vector2(...source.localRing[14]);ia=intersect(ia,d,p,a.clone().sub(p)).addScaledVector(d.clone().normalize(),.015);}
  if(i===chain.length-2){const p=new T.Vector2(...source.localRing[10]);ic=intersect(ia,d,c,p.clone().sub(c)).addScaledVector(d.clone().normalize(),-.015);}
  const wall=openTopPrism(new T.Shape([a,c,ic,ia]),0,7.75);wall.userData.role='principal-backing';b.add(wall,'brick');}

 function window(x:number,y:number,w:number,h:number,z=.10){box(x,y-.07,z,w+.16,h+.14,.095,'stone');box(x,y,z+.075,w,h,.06,'glass');for(const dx of [-w/6,w/6])box(x+dx,y,z+.12,.035,h,.035,'white');for(let yy=.5;yy<h-.12;yy+=.52)box(x,y+yy,z+.12,w,.035,.035,'white');box(x,y+h*.69,z+.14,w,.075,.05,'stone');box(x,y-.13,z+.04,w+.25,.10,.25,'stone');}
 // Tall sash groups on two levels; restored division is photographic, not inferred from BAG year.
 for(const x of [-7.5,-4.5,-1.5,1.5,4.5,7.5])window(x,4.83,1.65,2.35);
 for(const x of [-7.6,-5.1,-2.6,.6,5.0,7.55]){window(x,1.47,1.62,2.70);box(x,.10,.105,1.65,1.0,.09,'stone');box(x,.17,.17,1.40,.80,.08,'red');for(let dx=-.59;dx<.65;dx+=.18)box(x+dx,.18,.225,.025,.75,.02,'dark');}
 // Sparse cream stone diamonds and black iron ties are the RCE's block ornament.
 for(const x of [-8.7,-6,-3,0,3,6,8.7])for(const y of [4.44,7.40]){const d=new T.BoxGeometry(.20,.20,.055);d.rotateZ(Math.PI/4);add(d,'stone',x,y,.16);box(x+.25,y-.35,.18,.045,.64,.055,'dark');}
 // Three connected neck tops, with original curved shoulder outlines and pediments.
 const eave=7.75;
 for(const x of [-6.12,.5,6.12]){
  outline([[-3.04,0],[-2.60,.15],[-2.03,.38],[-1.56,.82],[-1.38,1.24],[-1.38,3.12],[1.38,3.12],[1.38,1.24],[1.56,.82],[2.03,.38],[2.60,.15],[3.04,0]],x,eave,.09,'brick');
  // Cream volute shoulders and vertical neck edges stay subordinate to the brick.
  for(const side of [-1,1]){const shoulder=new T.Shape();shoulder.moveTo(side*1.31,.05);shoulder.lineTo(side*3.02,.05);shoulder.quadraticCurveTo(side*1.55,.27,side*1.38,1.38);shoulder.lineTo(side*1.20,1.38);shoulder.quadraticCurveTo(side*1.45,.28,side*1.31,.05);shoulder.closePath();add(new T.ExtrudeGeometry(shoulder,{depth:.10,bevelEnabled:false}),'stone',x,eave,.23);box(x+side*1.32,eave+1.32,.25,.15,1.9,.16,'stone');}
  window(x,eave+.22,1.15,1.69,.26);for(const side of [-1,1]){box(x+side*.93,eave+.25,.28,.57,1.58,.11,'red');box(x+side*.93,eave+.34,.35,.39,1.38,.025,'brick');}
  outline([[-1.50,0],[1.50,0],[0,.84]],x,eave+3.12,.22,'stone',.23);outline([[-1.18,.08],[1.18,.08],[0,.65]],x,eave+3.12,.465,'brick',.02);box(x,eave+3.04,.26,3.04,.13,.30,'stone');
 }
 // Source front has four lower sash openings left of the right-half portal, two right.
 // Real1633 arched entrance and interrupted pediment, sculptural Saint Urbanus medal.
 const door=2.62;outline([[-.71,0],[.71,0],[.71,2.12],[.63,2.48],[.38,2.74],[0,2.86],[-.38,2.74],[-.63,2.48],[-.71,2.12]],door,.06,.15,'dark',.08);
 for(const side of [-1,1]){box(door+side*.91,.07,.32,.34,2.88,.43,'stone');for(const y of [.13,.43,2.95,3.15])box(door+side*.91,y,.34,.56,.16,.58,'stone');for(let y=.64;y<2.9;y+=.35)box(door+side*.95,y,.40,.42,.10,.44,'stone');}
 for(let i=0;i<13;i++){const lo=i*Math.PI/13,hi=(i+1)*Math.PI/13;outline([[.70*Math.cos(lo),.70*Math.sin(lo)],[.91*Math.cos(lo),.91*Math.sin(lo)],[.91*Math.cos(hi),.91*Math.sin(hi)],[.70*Math.cos(hi),.70*Math.sin(hi)]],door,2.12,.38,'stone',.13);}
 box(door,3.30,.34,2.45,.19,.64,'stone');
 // Owner portal close-up: a broken segmental fronton, not straight triangular
 // wings. Original curved tympana sit behind a projecting rounded cornice;
 // the Saint Urbanus oval interrupts the middle. Curve/thickness are photo-
 // guided approximations, not measured restoration-drawing dimensions.
 for(const side of [-1,1]){
  const wing=new T.Shape();wing.moveTo(side*.20,0);wing.lineTo(side*1.25,0);
  wing.quadraticCurveTo(side*.92,.92,side*.20,.96);wing.closePath();
  const backing=new T.ExtrudeGeometry(wing,{depth:.11,bevelEnabled:false,curveSegments:16});
  backing.userData.feature='portal-curved-tympanum';add(backing,'stone',door,3.52,.30);
  const rim=new T.Shape();rim.moveTo(side*1.25,0);
  rim.quadraticCurveTo(side*.92,.92,side*.20,.96);rim.lineTo(side*.20,.79);
  rim.quadraticCurveTo(side*.82,.80,side*1.07,.15);rim.closePath();
  const cornice=new T.ExtrudeGeometry(rim,{depth:.17,bevelEnabled:false,curveSegments:16});
  cornice.userData.feature='portal-curved-rim';add(cornice,'stone',door,3.52,.47);
 }
 // Small scroll relief on the observed oval cartouche edge. The figure itself
 // remains the restrained original house-style approximation below.
 for(const side of [-1,1])for(const [cy,flip] of [[4.44,1],[3.54,-1]]){
  const points:T.Vector3[]=[];
  for(let i=0;i<=20;i++){const a=i/20*Math.PI*1.65,r=.095-.052*i/20;points.push(new T.Vector3(side*(.17+r*Math.cos(a)),cy+flip*r*Math.sin(a),.69));}
  const scroll=new T.TubeGeometry(new T.CatmullRomCurve3(points),20,.025,6,false);
  scroll.userData.feature='portal-cartouche-scroll';add(scroll,'stone',door,0,0);
 }
 const medal=new T.SphereGeometry(.51,12,8);medal.scale(.68,1.17,.14);add(medal,'stone',door,3.99,.62);add(new T.IcosahedronGeometry(.10,1),'white',door,4.15,.72);box(door,3.75,.71,.14,.32,.09,'white');for(const side of [-1,1])box(door+side*.08,3.53,.71,.055,.26,.075,'white');
 // Only courtyard-facing rear openings are added. Long exterior sides are
 // shared party walls and remain undecorated; no borrowed neighbouring facade.
 const hole=source.localHoles[0];for(const [indices,y] of [[[1,2],2],[[1,2],5]] as [number[],number][]){const a=new T.Vector2(...hole[indices[0]]),c=new T.Vector2(...hole[indices[1]]),d=c.clone().sub(a),normal=new T.Vector2(-d.y,d.x).normalize(),ang=Math.atan2(normal.x,normal.y);for(const t of [.25,.65]){const p=a.clone().lerp(c,t).addScaledVector(normal,.13);b.box(p.x,y,p.y,.78,1.45,.10,'stone',ang);b.box(p.x+normal.x*.075,y+.07,p.y+normal.y*.075,.64,1.31,.06,'glass',ang);}}
 // No building-name words; roof/windows/portal provide recognition.
}
