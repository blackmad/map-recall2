import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism} from './house-geometry';
import source from './fire-station-victor-footprints.json';
import letters from './fire-station-victor-lettering.json';
type C=Parameters<BuildingTools['add']>[1];
/** Original native surveyed reconstruction. Photographs guide geometry; no textures/imported meshes. */
export function buildFireStationVictor(_w:number,_d:number,b:BuildingTools){
 const ring=source.nativeRing;
 // Each semantic roof ring owns its top; variable-height wall skirts reach its actual vertices.
 for(const r of source.surveyRoofParts){if(r.index===35)continue; /* unsupported22.4m thinboundaryartifact beside tallschool, absentcurrentphotos and2024existingsections */const p=r.rings[0],sh=new T.Shape(p.map(v=>new T.Vector2(v[0],v[2]))),bottom=r.index===35?17.25:0,min=Math.min(...p.map(v=>v[1]));b.add(openTopPrism(sh,bottom,min),'brick');
  const xyz:number[]=[];const push=(a:number[],c:number[],d:number[])=>xyz.push(...a,...c,...d);
  const faces=T.ShapeUtils.triangulateShape(p.map(v=>new T.Vector2(v[0],v[2])),[]);for(const f of faces){const a=p[f[0]],c=p[f[1]],d=p[f[2]],n=new T.Vector3().fromArray(c).sub(new T.Vector3().fromArray(a)).cross(new T.Vector3().fromArray(d).sub(new T.Vector3().fromArray(a)));const longest=Math.max(new T.Vector3().fromArray(a).distanceTo(new T.Vector3().fromArray(c)),new T.Vector3().fromArray(c).distanceTo(new T.Vector3().fromArray(d)),new T.Vector3().fromArray(d).distanceTo(new T.Vector3().fromArray(a)));if(Math.abs(n.y)/longest<.002)continue; /* omit only <2mm plan-altitude remnants from rounded survey boundaries; compressed winding failed before cleanup */if(n.y<0)push(a,d,c);else push(a,c,d)}
  const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute(xyz,3));roof.computeVertexNormals();roof.userData={tag:'roof'};b.add(roof,r.index===35?'stone':'slate');
  const skirt:number[]=[];for(let i=0;i<p.length;i++){const a=p[i],c=p[(i+1)%p.length];skirt.push(a[0],min,a[2],c[0],min,c[2],...c,a[0],min,a[2],...c,...a)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(skirt,3));g.computeVertexNormals();b.add(g,'brick');
 }
 function facade(a:number[],z:number[],top=14.1,role='street'){const dx=z[0]-a[0],dz=z[1]-a[1],len=Math.hypot(dx,dz),tx=dx/len,tz=dz/len,nx=-tz,nz=tx,ang=Math.atan2(nx,nz);
  const pos=(u:number,v:number)=>[a[0]+tx*u+nx*v,a[1]+tz*u+nz*v];
  const box=(u:number,y:number,v:number,w:number,h:number,d:number,c:C)=>{const p=pos(u,v);b.box(p[0],y,p[1],w,h,d,c,ang)};
  const shaped=(points:T.Vector2[],u:number,y:number,v:number,depth:number,c:C,tag='')=>{const g=new T.ExtrudeGeometry(new T.Shape(points),{depth,bevelEnabled:false,curveSegments:8});g.rotateY(ang);const p=pos(u,v);g.translate(p[0],y,p[1]);if(tag)g.userData={tag,aperture:{role,u,y,v,w:Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x)),h:Math.max(...points.map(p=>p.y)),a:ang,x:p[0],z:p[1]}};b.add(g,c);return g};
  const arch=(w:number,h:number,r:number)=>{const p=[new T.Vector2(-w/2,0),new T.Vector2(w/2,0),new T.Vector2(w/2,h-r)];for(let k=1;k<=16;k++){const th=k/16*Math.PI;p.push(new T.Vector2(Math.cos(th)*w/2,h-r+Math.sin(th)*r))}return p};
  function window(u:number,y:number,w:number,h:number,r=0){shaped(arch(w+.16,h+.08,r),u,y,.075,.06,'stone');shaped(arch(w,h,r),u,y,.16,.045,'glass','pane');box(u,y-.065,.21,w+.24,.1,.28,'stone');for(const off of[-w/2,w/2])box(u+off,y,.23,.06,h-r,.075,'white');for(const yy of[h*.2,h*.6,h-r])box(u,y+yy,.235,w,.065,.085,'white');box(u,y,.245,.04,h,.08,'dark');if(r){for(let k=0;k<16;k++){const t=(k+.5)/16*Math.PI,rr=w/2+.14,uu=u+Math.cos(t)*rr,yy=y+h-r+Math.sin(t)*(r+.14);box(uu,yy,.11,.12,.16,.075,'brick')}for(const off of[-w/2-.08,w/2+.08])box(u+off,y+h-r-.2,.14,.2,.42,.15,'white');}else box(u,y+h,.19,w+.25,.12,.18,'stone');}
  box(len/2,0,.04,len,.8,.1,'stone');box(len/2,top,.09,len,.2,.3,'white');box(len/2,top-.25,.045,len,.16,.1,'brick');
  return {pos,box,shaped,arch,window,len,ang};
 }
 const f=facade(ring[2],ring[5]),s=facade(ring[5],ring[6]);
 // Dapperstraat: two great round-arched apparatus portals, four upper windows, paired corner bay.
 for(const u of[2.25,5.87]){const w=3.13,h=4.45;f.shaped(f.arch(w,h,1.35),u,.04,.16,.065,'dark');f.box(u,.08,.25,w,1.36,.075,u===2.25?'red':'dark');f.box(u,1.48,.26,w,1.18,.075,'glass');for(const y of[1.45,2.05,2.7,3.18])f.box(u,y,.3,w,.07,.07,'dark');for(const x of[-w/2,w/2])f.box(u+x,.04,.24,.065,3.13,.08,'dark');for(let k=0;k<24;k++){const th=(k+.5)/24*Math.PI,rr=w/2+.14;f.box(u+Math.cos(th)*rr,3.14+Math.sin(th)*1.46,.10,.17,.22,.15,'brick')}for(const off of[-1,1])f.box(u+off*(w/2+.16),3.02,.15,.42,.62,.18,'white');}
 for(const u of[1.38,3.1,4.82,6.54]){f.window(u,5.65,1.35,3.36,.62);f.window(u,10.14,1.35,2.84);}
 for(const u of[8.61,9.93]){f.window(u,1.25,1.03,3.05,.5);f.window(u,5.65,1.03,3.36,.5);f.window(u,10.14,1.03,2.84);}
 // Twin corner gables, photo supported crest; no building-name words added.
 function gable(q:ReturnType<typeof facade>,u:number,w:number){q.shaped([new T.Vector2(-w/2,0),new T.Vector2(w/2,0),new T.Vector2(0,3.05)],u,14.16,.05,.13,'brick');q.box(u,17.14,.11,.34,.5,.22,'stone');q.window(u,14.45,1.65,.84);}
 gable(f,9.26,3.32);gable(s,1.82,3.64);
 // Domselaerstraat: projecting first bay balcony and photo-specific irregular secondary lights.
 for(const u of[1.13,2.51]){s.window(u,1.25,1.06,3.05,.52);s.window(u,5.65,1.06,3.36,.52);s.window(u,10.14,1.06,2.84);}
 for(const u of[5.4,7.3]){s.window(u,5.98,1.2,2.6,.57);s.window(u,10.22,1.2,2.55);}
 s.window(5.4,.14,1.25,4.0,.59);s.window(7.34,1.13,1.17,1.94,.55);s.window(9.56,1.15,.56,1.6);s.window(11.35,1.12,1.15,2.3);s.window(9.56,6.55,.62,1.24);s.window(11.35,5.92,1.18,2.68);s.window(9.56,10.74,.55,1.1);s.window(11.35,10.12,1.12,2.71);
 s.box(1.82,9.91,.63,3.2,.18,1.15,'stone');for(const u of[.38,1.82,3.24]){s.box(u,9.02,.43,.22,.89,.74,'white');s.box(u,8.84,.25,.25,.18,.43,'white');}for(let i=0;i<15;i++)s.box(.35+i*.21,10.06,1.17,.038,.9,.038,'dark');s.box(1.82,10.98,1.17,3.18,.055,.055,'dark');for(const u of[.26,3.38])s.box(u,10.04,.65,.045,.93,1.05,'dark');
 // Exposed rear groups: current2024 ENZO bestaand sections A/B/E take precedence.
 // The1911 ACHTERGEVEL corroborates two stair bays and room groups, not today's full counts.
 // Survey rear terrace has altered the northern rear; do not resurrect historical broad bands.
 const rear=facade(ring[6],ring[7],17.08,'rear-stair');
 rear.window(1.36,1.08,1.08,2.67);rear.window(3.77,.12,1.07,3.39,.48);
 rear.window(1.36,5.62,1.08,2.66);rear.window(3.77,7.10,1.07,2.22,.48);
 rear.window(1.36,10.52,1.08,2.34);rear.window(3.77,10.12,1.07,2.55);
 for(const u of[1.36,3.77])rear.window(u,14.23,1.08,2.15);
 const lowRear=facade(ring[8],ring[0],9.88,'rear-room-low');
 for(const u of[1.30,3.78]){lowRear.window(u,1.16,1.48,2.82);lowRear.window(u,5.61,1.48,3.00);}
 // Current survey recessed rear-room wall rises above the10.07m terrace; not the party wall.
 const upperRear=facade([2.55,-4.84],[.66,-9.18],17.08,'rear-room-upper');
 for(const u of[1.12,3.25]){upperRear.window(u,10.56,1.08,2.28);upperRear.window(u,14.24,1.08,2.17);}
 // Roof dormers match low zinc slope in current photographs, kept subordinate to gables.
 for(const u of[2.45,5.8]){f.box(u,14.62,-.75,1.2,1.09,.87,'white');f.window(u,14.7,1.02,.73);f.box(u,15.75,-.67,1.44,.1,1.01,'stone');}for(const u of[5.7,9.7]){s.box(u,14.72,-.8,1.2,.96,.85,'white');s.window(u,14.78,1.0,.68);s.box(u,15.7,-.73,1.43,.1,.99,'stone');}
 // Authentic small ceramic BRANDWEER plaque: Roman serif approximation, mounted on native panel.
 f.box(9.26,4.62,.16,2.67,.49,.11,'stone');f.box(9.26,4.7,.23,2.45,.3,.05,'white');
 const path=new T.ShapePath();for(const c of letters.commands as any[]){if(c.type==='M')path.moveTo(c.x,-c.y);else if(c.type==='L')path.lineTo(c.x,-c.y);else if(c.type==='Q')path.quadraticCurveTo(c.x1,-c.y1,c.x,-c.y);else if(c.type==='C')path.bezierCurveTo(c.x1,-c.y1,c.x2,-c.y2,c.x,-c.y);else if(c.type==='Z')path.currentPath?.closePath();}const glyph=new T.ExtrudeGeometry(path.toShapes(),{depth:.012,bevelEnabled:false,curveSegments:3});glyph.computeBoundingBox();const bb=glyph.boundingBox!,sz=bb.getSize(new T.Vector3());glyph.translate(-(bb.min.x+bb.max.x)/2,-bb.min.y,0);glyph.scale(2.08/sz.x,.20/sz.y,1);glyph.rotateY(f.ang);const sign=f.pos(9.26,.266);glyph.translate(sign[0],4.76,sign[1]);b.add(glyph,'dark');
 // Recognizable red/gold operator flame shield and red historic street alarm next to the portal.
 f.shaped([new T.Vector2(-.46,.35),new T.Vector2(-.33,.72),new T.Vector2(-.11,.87),new T.Vector2(.1,.77),new T.Vector2(.43,.63),new T.Vector2(.39,.3),new T.Vector2(0,0)],4.08,4.47,.22,.055,'red');f.shaped([new T.Vector2(-.30,.35),new T.Vector2(-.10,.61),new T.Vector2(-.06,.81),new T.Vector2(.06,.65),new T.Vector2(.29,.54),new T.Vector2(.24,.3),new T.Vector2(0,.1)],4.08,4.5,.282,.025,'bronze');f.box(8.01,0,.64,.29,1.67,.32,'red');f.box(8.01,1.64,.64,.36,.28,.37,'red');
 // Rainwater pipes and masonry articulation stay on photographed street planes.
 for(const [q,u]of[[f,.16],[s,3.74]] as const)q.box(u,.8,.1,.085,13.3,.09,'frame');
}
