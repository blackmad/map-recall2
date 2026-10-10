import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism} from './house-geometry';
import source from './w139-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original metres/Y-up reconstruction. Measured part polygons bound every roof;
 * only each bounded surface determines its shell height, never Pand maxima. */
export function buildW139(_width:number,_depth:number,{add}:BuildingTools,decal:(g:T.BufferGeometry,hex:string)=>void=()=>{}){
 const triangle=(g:T.BufferGeometry,colour:Colour)=>add(g,colour);
 // Centered least-squares over EVERY original roof vertex avoids near-collinear
 // first-vertex fits and removes centimetre source-rounding roof fins.
 const fitted=(region:typeof source.roofRegions[number])=>{
  const ps=region.rings.flat(),n=ps.length,c=ps.reduce((s,p)=>s.map((v,i)=>v+p[i]/n),[0,0,0]);
  let xx=0,zz=0,xz=0,xy=0,zy=0;for(const p of ps){const x=p[0]-c[0],z=p[2]-c[2],y=p[1]-c[1];xx+=x*x;zz+=z*z;xz+=x*z;xy+=x*y;zy+=z*y;}
  const det=xx*zz-xz*xz;if(det<1e-8)throw new Error('Degenerate roof region');const a=(xy*zz-zy*xz)/det,b=(zy*xx-xy*xz)/det;
  return region.rings.map(r=>r.map(p=>[p[0],c[1]+a*(p[0]-c[0])+b*(p[2]-c[2]),p[2]]));
 };
 for(const [id,region] of source.roofRegions.entries()){
  const fittedRings=fitted(region);
  const rings=fittedRings.map(r=>r.map(p=>new T.Vector2(p[0],p[2]))),outer=rings[0];
  const heights=fittedRings.flat().map(p=>p[1]),eave=Math.min(...heights);
  const shape=new T.Shape(outer);for(const hole of rings.slice(1))shape.holes.push(new T.Path(hole));
  const wallColour:Colour=id===13?'brick':id===0||id===5||id===6||id===8||id===12||id===17?'white':'greyBrick';
  // Open-top shell gives the roof sole ownership of its upper surface.
  const shell=openTopPrism(shape,0,eave);shell.userData.surveyPart=id;add(shell,wallColour);
  const flat=fittedRings.flat();const roofPositions:number[]=[],wallPositions:number[]=[];
  for(const ids of T.ShapeUtils.triangulateShape(outer,rings.slice(1))){
   const ps=ids.map(i=>new T.Vector3(flat[i][0],flat[i][1],flat[i][2]));
   const n=ps[1].clone().sub(ps[0]).cross(ps[2].clone().sub(ps[0]));if(n.lengthSq()<1e-10)continue;if(n.y<0)[ps[1],ps[2]]=[ps[2],ps[1]];for(const p of ps)roofPositions.push(p.x,p.y,p.z);
  }
  for(const ring of fittedRings)for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length];wallPositions.push(a[0],eave,a[2],b[0],eave,b[2],b[0],b[1],b[2],a[0],eave,a[2],b[0],b[1],b[2],a[0],a[1],a[2]);
  }
  const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute(roofPositions,3));roof.computeVertexNormals();roof.userData.roofSurface=true;roof.userData.surveyPart=id;triangle(roof,region.approxPitch>15?'red':'slate');
  const walls=new T.BufferGeometry();walls.setAttribute('position',new T.Float32BufferAttribute(wallPositions,3));walls.computeVertexNormals();walls.userData.surveyPart=id;triangle(walls,wallColour);
 }
 const v=(i:number)=>new T.Vector2(...source.localRing[i] as [number,number]);
 function facade(a:T.Vector2,b:T.Vector2,baseOffset=0){
  const t=b.clone().sub(a).normalize(),n=new T.Vector2(-t.y,t.x),length=a.distanceTo(b),yaw=Math.atan2(n.x,n.y);
  const at=(u:number,o:number)=>a.clone().addScaledVector(t,u).addScaledVector(n,o+baseOffset);
  const panel=(u:number,y:number,w:number,h:number,c:Colour,o=.09)=>{const p=at(u,o);const g=new T.PlaneGeometry(w,h);g.userData.facadeOutward=[n.x,0,n.y];add(g,c,p.x,y+h/2,p.y,yaw);};
  const block=(u:number,y:number,w:number,h:number,d:number,c:Colour,o=.09)=>{const p=at(u,o);add(new T.BoxGeometry(w,h,d),c,p.x,y+h/2,p.y,yaw);};
  const pane=(u:number,y:number,w:number,h:number,cols=2,rows=2)=>{
   panel(u,y-.08,w+.16,h+.16,'white',.13);panel(u,y,w,h,'glass',.18);
   for(let i=0;i<=cols;i++)block(u-w/2+i*w/cols,y-.035,.055,h+.07,.06,'white',.23);
   for(let i=0;i<=rows;i++)block(u,y-.035+i*h/rows,w+.08,.065,.07,'white',.24);
   block(u,y-.17,w+.28,.14,.31,'frame',.19);
  };
  const line=(u1:number,y1:number,u2:number,y2:number,r:number,c:Colour,o=.2)=>{const p=at(u1,o),q=at(u2,o),A=new T.Vector3(p.x,y1,p.y),B=new T.Vector3(q.x,y2,q.y),delta=B.clone().sub(A);const g=new T.CylinderGeometry(r,r,delta.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));const m=A.clone().add(B).multiplyScalar(.5);add(g,c,m.x,m.y,m.z);};
  // Exact-colour solid (door leaves, red sign letters); rz tilts a stroke about the wall normal.
  const deco=(u:number,y:number,w:number,h:number,d:number,hex:string,o=.09,rz=0)=>{const p=at(u,o);const g=new T.BoxGeometry(w,h,d);g.rotateZ(rz);g.rotateY(yaw);g.translate(p.x,y+h/2,p.y);decal(g,hex);};
  return {length,panel,block,pane,line,deco};
 }
 const main=facade(v(source.frontEdges.main[0]),v(source.frontEdges.main[1])),W=main.length;
 main.panel(W/2,0,W,19.94,'white',.045);main.block(W/2,0,W,.35,.12,'frame');
 // Restored 2006–07 four-storey classical front: three bays diminish upwards.
 const bays=[W/6,W/2,W*5/6],bw=W/3-.60;
 // Upper storeys (photo, Jan 2025 panorama): tall sashes, iron balcony rail on the 1st and 2nd floors.
 for(const u of bays){main.pane(u,6.05,bw,4.47,2,3);main.pane(u,12.16,bw,3.60,2,2);main.pane(u,17.43,bw,1.47,2,1);}
 const IRON='#33383d',DOOR='#8a2b19',SIGN='#e4351f';
 for(const u of bays)for(const y of [6.05,12.16]){
  main.deco(u,y+.02,bw+.18,.045,.07,IRON,.42);main.deco(u,y+.88,bw+.18,.045,.07,IRON,.42);
  for(let k=0;k<=8;k++)main.deco(u-bw/2-.09+k*(bw+.18)/8,y+.03,.04,.88,.05,IRON,.42);
 }
 // Ground floor: tall shop windows (transom over one large pane) on a dark plinth, left and right.
 for(const u of [bays[0],bays[2]]){main.block(u,0,bw+.30,.98,.22,'greyBrick',.14);main.pane(u,1.0,bw,3.90,1,2);}
 // Centre: red-brown glazed double door under a glazed transom (photo ref-front-c).
 const dw=bw*.86,dl=dw/2;
 main.deco(W/2,.40,dw+.20,3.38,.10,DOOR,.27);
 for(const side of [-1,1]){
  const cx=W/2+side*(dl/2+.01);
  main.deco(cx,.46,dl-.08,3.26,.06,DOOR,.33);
  main.panel(cx,1.55,dl-.32,1.9,'glass',.37);main.block(cx,.62,dl-.32,.75,.05,'greyBrick',.37);
  for(const y of [2.35,3.05])main.deco(cx,y,dl-.32,.05,.06,DOOR,.40);
 }
 main.deco(W/2,.46,.06,3.26,.08,DOOR,.40);
 main.pane(W/2,3.84,dw,1.04,3,1);main.deco(W/2,3.74,dw+.34,.12,.30,'#6d2214',.30);
 // Red W139 sign on the transom (source-defining signage): chunky sans, 3D letters.
 {
  const sd=main.deco;
  const k=.80,H=1.0*k,st=.23*k,dep=.20,y0=3.95;
  const glyphs:{w:number;draw:(x:number)=>void}[]=[
   {w:.98*k,draw:x=>{const pts=[[0,H],[.245*k,0],[.49*k,.62*H],[.735*k,0],[.98*k,H]];for(let i=0;i<4;i++){const a=pts[i],b=pts[i+1],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy)+st*.3;sd(x+(a[0]+b[0])/2,y0+(a[1]+b[1])/2-st*.5+0,len,st,dep,SIGN,.30,Math.atan2(dy,dx));}}},
   {w:.50*k,draw:x=>{sd(x+.30*k,y0,st,H,dep,SIGN,.30);sd(x+.10*k,y0+H*.80,.36*k,st*.9,dep,SIGN,.30,.55);}},
   {w:.72*k,draw:x=>{for(const f of [0,.5,1])sd(x+.36*k,y0+f*(H-st),.72*k,st,dep,SIGN,.30);sd(x+.72*k-st/2,y0,st,H,dep,SIGN,.30);}},
   {w:.72*k,draw:x=>{for(const f of [0,.5,1])sd(x+.36*k,y0+f*(H-st),.72*k,st,dep,SIGN,.30);sd(x+.72*k-st/2,y0,st,H,dep,SIGN,.30);sd(x+st/2,y0+H/2,st,H/2,dep,SIGN,.30);}}
  ];
  const gap=.14*k,total=glyphs.reduce((a,g)=>a+g.w,0)+gap*3;let x=W/2-total/2;
  for(const g of glyphs){g.draw(x-W/2+W/2);x+=g.w+gap;}
 }
 for(let i=0;i<4;i++){
  const u=i===0?.19:i===3?W-.19:i*W/3;
  main.block(u,.40,i===0||i===3?.37:.45,4.87,.25,'white',.25);
  main.block(u,.27,.54,.16,.35,'frame',.25);main.block(u,5.03,.59,.19,.38,'stone',.25);
  if(i===0||i===3)for(let y=.8;y<4.8;y+=.48)main.block(u,y,.40,.035,.30,'stone',.29);
  else for(const side of [-1,1])main.block(u+side*.13,.65,.033,4.10,.07,'stone',.4);
 }
 for(const [y,h,d]of [[5.27,.18,.34],[5.45,.18,.48],[5.65,.12,.56],[11.15,.21,.23],[11.36,.13,.31],[16.43,.16,.21],[19.32,.20,.35],[19.59,.22,.53],[19.82,.15,.62]])main.block(W/2,y,W+.10,h,d,'white',.13);
 for(let u=.15;u<W;u+=.29)main.block(u,19.13,.12,.20,.28,'stone',.22);
 // Lower left 139a gateway stays a separate narrow bent-cornice volume.
 const low=facade(v(source.frontEdges.lowEntrance[0]),v(source.frontEdges.lowEntrance[1])),L=low.length;
 low.panel(L/2,0,L,8.90,'white',.07);low.block(L/2,0,L,.30,.15,'frame',.12);
 low.pane(L/2,.35,L-.79,2.43,2,1);low.block(L/2,2.93,L-.48,.91,.20,'stone',.15);
 low.pane(L/2,4.08,L-.70,3.63,3,3);
 for(const u of [.20,L-.20]){low.block(u,3.82,.28,4.03,.21,'white',.19);low.block(u,7.75,.43,.22,.30,'stone',.20);}
 low.block(L/2,7.86,L+.05,.22,.31,'white',.18);
 for(const [offset,r]of [[0,.065],[.16,.075]] as const){low.line(0,8.03+offset,L/2,8.73+offset,r,'stone');low.line(L/2,8.73+offset,L,8.03+offset,r,'stone');}
 low.block(L/2,9.14,L+.05,.19,.28,'white',.14);
 for(const u of [L*.18,L*.50,L*.82]){low.block(u,8.85,L*.26,.23,.10,'stone',.19);low.panel(u,8.895,L*.22,.14,'white',.255);}
 // Measured roof coverage does not support the entire extended cadastral
 // theatre edge. Do not place panes along that cadastral envelope: the
 // uncovered strip is an access/coverage gap, not proof of a vertical wall.
 // Primary architect court photo184 and axonometric186 identify the white
 // gabled rear of the same surveyed deep house. Its actual roof6/12 end
 // bounds the openings; lower extension roof17 hides the lower floors.
 const rearA=new T.Vector2(-14.83954,-7.10756),rearB=new T.Vector2(-10.47331,-13.41892);
 const rearLeft=facade(rearA,new T.Vector2(-13.08444,-10.68408));
 for(const u of [1.15,rearLeft.length-.70])rearLeft.pane(u,13.66,1.14,2.13,2,2);
 const rearRight=facade(new T.Vector2(-11.13946,-11.72945),rearB);rearRight.pane(rearRight.length/2,13.66,1.14,2.13,2,2);
 for(const u of [rearLeft.length-.70,rearLeft.length+.60])rearLeft.pane(u,17.61,.61,.81,1,1);
 // Higher modern former stage-tower face uses red/brown brick and white glazing.
 // This wall follows a real roof13 edge instead of an invented rectangle.
 const tower=source.roofRegions[13].rings[0];let best=0;for(let i=1;i<tower.length;i++)if(new T.Vector2(tower[i][0],tower[i][2]).distanceTo(new T.Vector2(tower[(i+1)%tower.length][0],tower[(i+1)%tower.length][2]))>new T.Vector2(tower[best][0],tower[best][2]).distanceTo(new T.Vector2(tower[(best+1)%tower.length][0],tower[(best+1)%tower.length][2])))best=i;
 const ta=tower[best],tb=tower[(best+1)%tower.length],rear=facade(new T.Vector2(ta[0],ta[2]),new T.Vector2(tb[0],tb[2]));
 for(const y of [7.2,10.35,13.05])for(const u of [rear.length*.25,rear.length*.75])rear.pane(u,y,Math.min(1.7,rear.length*.25),y>13?1.15:1.8,2,2);
}
