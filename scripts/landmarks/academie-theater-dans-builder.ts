import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism} from './house-geometry';
import source from './academie-theater-dans-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original native east/south metres. Bounded measured roof zones, no wall cap.
 * Draft: source massing preflight before fine detail; explicit terrace review pending. */
export function buildAcademieTheaterDans(_width:number,_depth:number,{add}:BuildingTools){
 const roofFits:{id:number,rings:number[][][],a:number,b:number,c:number}[]=[];
 const streetA=new T.Vector2(...source.localRing[26] as [number,number]),streetB=new T.Vector2(...source.localRing[35] as [number,number]);const streetT=streetB.clone().sub(streetA).normalize(),streetN=new T.Vector2(-streetT.y,streetT.x);
 const clip=(r:T.Vector2[],test:(p:T.Vector2)=>number)=>{const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],a=test(p),b=test(q);if(a>=0)out.push(p);if((a>=0)!==(b>=0))out.push(p.clone().lerp(q,a/(a-b)))}return out};
 const inset=(p:T.Vector2)=>{const d=p.clone().sub(streetA),u=d.dot(streetT),v=d.dot(streetN);if(p.x<streetA.x&&p.y>-1&&p.y<9){const c=new T.Vector2(-25.9,3.8);return p.clone().add(p.clone().sub(c).normalize().multiplyScalar(-1.45));}return v>-1.0&&u>-4&&u<42?p.clone().addScaledVector(streetN,-1.45):p.clone()};
 for(const [id,region] of source.roofRegions.entries()){
  const ps=region.rings.flat(),n=ps.length,c=ps.reduce((s,p)=>s.map((v,i)=>v+p[i]/n),[0,0,0]);
  let xx=0,zz=0,xz=0,xy=0,zy=0;
  for(const p of ps){const x=p[0]-c[0],z=p[2]-c[2],y=p[1]-c[1];xx+=x*x;zz+=z*z;xz+=x*z;xy+=x*y;zy+=z*y;}
  const det=xx*zz-xz*xz;if(det<1e-8)throw new Error('Degenerate measured roof');const a=(xy*zz-zy*xz)/det,b=(zy*xx-xy*xz)/det;
  const fitted=region.rings.map(r=>r.map(p=>[p[0],c[1]+a*(p[0]-c[0])+b*(p[2]-c[2]),p[2]]));
  roofFits.push({id,rings:fitted,a,b,c:c[1]-a*c[0]-b*c[2]});
  const residual=Math.max(...ps.map(p=>Math.abs(p[1]-(c[1]+a*(p[0]-c[0])+b*(p[2]-c[2])))));
  if(residual>.12)throw new Error(`Nonplanar roof ${id}: ${residual}`);
  const rings=fitted.map(r=>r.map(p=>new T.Vector2(p[0],p[2]))),shape=new T.Shape(rings[0]);
  for(const r of rings.slice(1))shape.holes.push(new T.Path(r));
  const low=Math.min(...fitted.flat().map(p=>p[1]));
  const lowerRings=rings.map(r=>{const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],u=p.clone().sub(streetA).dot(streetT),v=q.clone().sub(streetA).dot(streetT);out.push(inset(p));if((u<42)!==(v<42)&&Math.abs(v-u)>.1){const m=p.clone().lerp(q,(42-u)/(v-u));out.push(inset(m.clone().addScaledVector(streetT,u<42?-.001:.001)));out.push(inset(m.clone().addScaledVector(streetT,u<42?.001:-.001)))}}return out}),lowerShape=new T.Shape(lowerRings[0]);for(const r of lowerRings.slice(1))lowerShape.holes.push(new T.Path(r));const lower=openTopPrism(lowerShape,0,5.6);lower.userData.role='ground-inset-shell';add(lower,'white');
  // Source roof subdivisions do not imply closed storeys beneath all their edges.
  const bodyTop=[0,3,6,9].includes(id)?low:Math.min(low,21.40),shell=openTopPrism(shape,5.6,bodyTop);shell.userData.role='massing-shell';shell.userData.surveyPart=id;add(shell,'white');
  const flat=fitted.flat(),top:number[]=[],skirts:number[]=[];
  if([2,7,12].includes(id)){const center=rings[0].reduce((a,p)=>a.add(p),new T.Vector2()).divideScalar(rings[0].length),core=rings.map(r=>clip(clip(r.map(p=>p.clone().add(p.clone().sub(center).normalize().multiplyScalar(-2.5))),p=>p.clone().sub(streetA).dot(streetT)-15),p=>-7-p.clone().sub(streetA).dot(streetN))),coreShape=new T.Shape(core[0]);for(const r of core.slice(1))coreShape.holes.push(new T.Path(r));const g=openTopPrism(coreShape,21.4,low-.10);g.userData.role='recessed-upper-core';add(g,'dark');}

  for(const tri of T.ShapeUtils.triangulateShape(rings[0],rings.slice(1))){const p=tri.map(i=>new T.Vector3(...flat[i]));const area=p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));// Remove centimetre-wide numerical triangulation remnants before quantization.
   const span=Math.max(p[0].distanceTo(p[1]),p[1].distanceTo(p[2]),p[2].distanceTo(p[0]));if(Math.abs(area.y)/span<.02)continue;if(area.y<0)[p[1],p[2]]=[p[2],p[1]];for(const q of p)top.push(q.x,q.y,q.z);}
  if(![2,7,10,12].includes(id))for(const r of fitted)for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];skirts.push(p[0],low,p[2],q[0],low,q[2],q[0],q[1],q[2],p[0],low,p[2],q[0],q[1],q[2],p[0],p[1],p[2]);}
  if([2,7,12].includes(id)){const underside:number[]=[];for(let i=0;i<top.length;i+=9)for(const j of [0,2,1])underside.push(top[i+3*j],top[i+3*j+1]-.08,top[i+3*j+2]);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(underside,3));g.computeVertexNormals();g.userData.role='cantilever-underside';add(g,'dark');}
  for(const [positions,c,role] of [[top,'stone','survey-roof'],[skirts,'white','roof-skirt']] as const){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();g.userData.role=role;g.userData.surveyPart=id;add(g,c);}
 }
 // Source-facing regional white corner brow closes ONLY the principal
 // upper facade edge of roof2; the northwest terrace remains open behind it.
 const cornerRoof=roofFits.find(r=>r.id===2)!,cornerRing=cornerRoof.rings[0];
 for(const [a,b] of [[cornerRing[cornerRing.length-1],cornerRing[0]],[cornerRing[cornerRing.length-2],cornerRing[cornerRing.length-1]]]){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([a[0],21.4,a[2],b[0],21.4,b[2],b[0],b[1],b[2],a[0],21.4,a[2],b[0],b[1],b[2],a[0],a[1],a[2]],3));g.computeVertexNormals();g.userData.role='principal-corner-brow';add(g,'white');}
 // Bounded roof14 is a rooftop equipment enclosure, NOT a whole-building
 // height. Its support datum comes from matching adjacent measured roof7
 // vertices (26.79--27.04m), rather than the facade or equipment maximum.
 const equipment=roofFits.find(r=>r.id===14)!,equipmentRing=equipment.rings[0],adjacent=source.roofRegions[7].rings.flat();
 const bed=equipmentRing.map(p=>{const q=adjacent.reduce((best,q)=>Math.hypot(q[0]-p[0],q[2]-p[2])<Math.hypot(best[0]-p[0],best[2]-p[2])?q:best,adjacent[0]);return [p[0],q[1],p[2]]});
 const sides:number[]=[];for(let i=0;i<bed.length;i++){const j=(i+1)%bed.length,a=bed[i],b=bed[j],c=equipmentRing[j],d=equipmentRing[i];for(const p of [a,b,c,a,c,d])sides.push(...p);}
 const enclosure=new T.BufferGeometry();enclosure.setAttribute('position',new T.Float32BufferAttribute(sides,3));enclosure.computeVertexNormals();enclosure.userData.role='equipment-enclosure';add(enclosure,'white');
 const bedShape=bed.map(p=>new T.Vector2(p[0],p[2])),support:number[]=[];for(const tri of T.ShapeUtils.triangulateShape(bedShape,[])){const vs=tri.map(i=>new T.Vector3(...bed[i]));if(vs[1].clone().sub(vs[0]).cross(vs[2].clone().sub(vs[0])).y<0)[vs[1],vs[2]]=[vs[2],vs[1]];for(const p of vs)support.push(p.x,p.y,p.z);}
 const floor=new T.BufferGeometry();floor.setAttribute('position',new T.Float32BufferAttribute(support,3));floor.computeVertexNormals();floor.userData.role='equipment-support-bed';add(floor,'stone');
 const inside=(p:T.Vector2,r:number[][])=>{let hit=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[2]>p.y)!==(b[2]>p.y)&&p.x<(b[0]-a[0])*(p.y-a[2])/(b[2]-a[2])+a[0])hit=!hit;}return hit;};
 // Roof plan current PDOK orthophoto: dark panel field follows main curved roof.
 // Photo-guided modular spacing; no claim of an exact equipment/panel count.
 for(let u=8;u<65;u+=1.85)for(let v=-9;v>-34;v-=1.3){const center=streetA.clone().addScaledVector(streetT,u).addScaledVector(streetN,v),corners=[[-.81,-.55],[.81,-.55],[.81,.55],[-.81,.55]].map(([x,z])=>center.clone().addScaledVector(streetT,x).addScaledVector(streetN,z));const roof=roofFits.find(r=>[2,7,12].includes(r.id)&&corners.every(p=>inside(p,r.rings[0])&&!r.rings.slice(1).some(h=>inside(p,h))));if(!roof)continue;const positions:number[]=[];for(const i of [0,2,1,0,3,2]){const p=corners[i];positions.push(p.x,roof.a*p.x+roof.b*p.y+roof.c+.045,p.y)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();g.userData.role='solar-panel';add(g,'blue');}
 // Source-supported low metal balustrade on the21.4mfront terrace strip.
 const tube=(a:T.Vector3,b:T.Vector3,r=.025)=>{const d=b.clone().sub(a),g=new T.CylinderGeometry(r,r,d.length(),8);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));const c=a.clone().add(b).multiplyScalar(.5);g.userData.role='terrace-rail';add(g,'frame',c.x,c.y,c.z)};
 const railAt=(u:number,y:number)=>{const p=streetA.clone().addScaledVector(streetT,u).addScaledVector(streetN,-1);return new T.Vector3(p.x,y,p.y)};for(const y of [21.95,22.45])tube(railAt(1,y),railAt(14,y));for(let u=1;u<=14;u+=1.3)tube(railAt(u,21.4),railAt(u,22.45));
 const local=(lon:number,lat:number)=>new T.Vector2((lon-source.anchor[0])*111320*Math.cos(source.anchor[1]*Math.PI/180),-(lat-source.anchor[1])*111320);
 function facade(a:T.Vector2,b:T.Vector2,followFront=false,baseOffset=0){
  const t=b.clone().sub(a).normalize(),n=new T.Vector2(-t.y,t.x),yaw=Math.atan2(n.x,n.y),length=a.distanceTo(b);
  const boundary=(u:number)=>{if(!followFront)return 0;let outward=-Infinity;for(let i=26;i<35;i++){const A=new T.Vector2(...source.localRing[i] as [number,number]).sub(a),B=new T.Vector2(...source.localRing[i+1] as [number,number]).sub(a),U=A.dot(t),V=B.dot(t);if(u>=Math.min(U,V)-.001&&u<=Math.max(U,V)+.001&&Math.abs(V-U)>.001){const k=(u-U)/(V-U);outward=Math.max(outward,A.dot(n)*(1-k)+B.dot(n)*k)}}return Number.isFinite(outward)?outward:0};
  const panel=(u:number,y:number,w:number,h:number,c:Colour,o=.11,role='facade-panel')=>{const p=a.clone().addScaledVector(t,u).addScaledVector(n,o+boundary(u)+baseOffset),g=new T.PlaneGeometry(w,h);g.userData.role=role;add(g,c,p.x,y+h/2,p.y,yaw);};
  const block=(u:number,y:number,w:number,h:number,d:number,c:Colour,o=.17,role='facade-frame')=>{const p=a.clone().addScaledVector(t,u).addScaledVector(n,o+boundary(u)+baseOffset),g=new T.BoxGeometry(w,h,d);g.userData.role=role;add(g,c,p.x,y+h/2,p.y,yaw);};
  const glazing=(u:number,y:number,w:number,h:number,cols:number,rows:number)=>{const depth=followFront&&y<5.6&&u<34?-1.45:0;for(let i=0;i<cols;i++)for(let j=0;j<rows;j++)panel(u-w/2+(i+.5)*w/cols,y+j*h/rows,w/cols,h/rows,'glass',.18+depth,'exposed-glazing');for(let i=0;i<=cols;i++)block(u-w/2+i*w/cols,y,.08,h,.10,'frame',.22+depth);for(let j=0;j<=rows;j++)block(u,y+j*h/rows,w,.09,.10,'frame',.22+depth);};
  const column=(u:number,h:number)=>{const p=a.clone().addScaledVector(t,u).addScaledVector(n,boundary(u)+.10);const g=new T.CylinderGeometry(.24,.24,h,12);g.userData.role='exposed-column';add(g,'stone',p.x,h/2,p.y);};
  return {length,panel,block,glazing,column};
 }
 // Southwest principal frontage oriented from NW toward SE; normal towards street.
 const front=facade(local(4.9016064,52.3695817),local(4.9024409,52.3692266),true),L=front.length;
 // Recognition assemblies are approximate photo-guided proportions pending calibrated views.
 // Actual source shell supplies white masonry; no overlapping large cladding plane.

 for(let u=L*.52;u<L*.92;u+=.5)front.panel(u+.25,0,.50,5.2,'brick',.13);
 for(const y of [.35,3.25])front.glazing(L*.08,y,L*.145,2.10,3,1);
 for(let u=0;u<L*.41;u+=.5)front.block(u+.25,21.4,.5,26.4-.015*u-21.4,.08,'white',.035,'principal-corner-brow');
 front.panel(L*.075,6.15,L*.145,17.9,'glass',.12);for(let j=0;j<4;j++)front.glazing(L*.075,6.4+j*4.8,L*.145,3.25,4,1);
 front.glazing(L*.285,5.7,L*.235,18.3,8,4);
 for(const y of [.3,3.25])front.glazing(L*.28,y,L*.23,2.10,6,1);
 for(let u=.2;u<L*.40;u+=.5)front.block(u+.25,2.75,.5,.50,.15,'bronze',-1.10);
 // Narrow broad-opening transition precedes THREE small-window tiers.
 for(let j=0;j<4;j++)front.glazing(L*.445,6.3+j*3.6,L*.062,2.35,2,1);
 for(let j=0;j<3;j++)for(let i=0;i<7;i++)front.glazing(L*(.53+i*.047),6.3+j*3.5,L*.021,1.70,1,1);
 for(let i=0;i<8;i++){const u=i===6?53.8:i===7?56.9:L*(.52+(i+.5)*.04175),w=i>=6?1.05:L*.04175;front.glazing(u,17.8,w,2.75,1,1);}
 for(let i=0;i<6;i++)front.glazing(L*(.48+i*.065),.55,L*.035,2.3,1,1);
 for(let u=1;u<L*.50;u+=4.25)front.column(u,5.6);
 // NW Antoniessluis side, broad four-tier curtain wall, brick flank.
 const northwest=facade(local(4.9018526,52.3697684),local(4.9016064,52.3696517)),N=northwest.length;
 northwest.panel(N*.15,0,N*.30,20.8,'brick',.10);
 northwest.glazing(N*.625,5.6,N*.59,15.05,5,4);
 for(const y of [.3,3.25])northwest.glazing(N*.625,y,N*.59,2.10,5,1);northwest.block(N*.625,2.75,N*.59,.5,.18,'bronze',.25);
 // Surveyed rounded NW connector: source glazed/spandrel wrap above
 // a recessed two-level glazed foyer. Use actual tangent at every chord.
 for(let i=0;i<26;i+=4){const j=Math.min(26,i+4),a=new T.Vector2(...source.localRing[i] as [number,number]),b=new T.Vector2(...source.localRing[j] as [number,number]),f=facade(a,b),F=f.length;f.block(F/2,21.4,F,5.0,.08,'white',.035,'principal-corner-brow');f.panel(F/2,6.15,F,17.9,'glass',.13);for(let k=0;k<4;k++)f.glazing(F/2,6.4+k*4.8,F,3.25,1,1);const ground=facade(a,b,false,-1.45);for(const y of [.3,3.25])ground.glazing(F/2,y,F,2.10,1,1);ground.block(F/2,2.75,F,.5,.15,'bronze',.25);}
 // Glazed pavilion uses its bounded measured roof10, above the terrace
 // datum; no solid opaque box beneath its top. Small front framing approximate.
 const pavilion=source.roofRegions[10].rings[0];for(let i=0;i<pavilion.length;i++){const a=pavilion[i],b=pavilion[(i+1)%pavilion.length],f=facade(new T.Vector2(a[0],a[2]),new T.Vector2(b[0],b[2]));if([3,4,6].includes(i))f.glazing(f.length/2,21.45,f.length,3.55,Math.max(1,Math.round(f.length/1.4)),3);}

 // Canal elevation in original2025panorama (left acrosswater), cross-checked
 // with current orthophoto. Brick piers frame repeating pale grouped glazing.
 const rear=facade(local(4.9028132,52.3695642),local(4.9020272,52.3698889),false,.35),R=rear.length;
 rear.panel(R/2,.20,R,19.7,'white',.05);
 for(let bay=0;bay<5;bay++){const u=(bay+.5)*R/5,w=R/5*.71;for(let j=0;j<4;j++){rear.panel(u,2.8+j*4.0,w+.65,3.80,'white',.10);rear.glazing(u,3.30+j*4.0,w,2.45,3,1);}}
 rear.block(R/2,.15,R,1.8,.25,'stone',.24);rear.block(R/2,19.65,R,.4,.4,'white',.27);

}
