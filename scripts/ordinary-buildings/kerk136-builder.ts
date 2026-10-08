import * as T from 'three';
import type {BuildingTools} from '../landmarks/cultural-builders';
import {openTopPrism,upwardRoofPlane} from '../landmarks/house-geometry';
import spec from './kerk136-spec.json';
import letters from './kerk136-lettering.json';
export const openingProbes:{label:string;point:number[];normal:number[];kind:string}[]=[];
/** Original native reconstruction; no photo textures or imported reference mesh.
 * Main/front/rear roof planes are independently source-owned. */
export function buildKerk136(_w:number,_d:number,b:BuildingTools){
 openingProbes.length=0;
 type C=Parameters<BuildingTools['add']>[1];
 const add=(g:T.BufferGeometry,c:C,x=0,y=0,z=0,a=0)=>b.add(g,c,x,y,z,a);
 function shape(r:number[][],holes:number[][][]=[]){const s=new T.Shape(r.map(p=>new T.Vector2(p[0],p[1])));for(const h of holes)s.holes.push(new T.Path(h.map(p=>new T.Vector2(p[0],p[1]))));return s;}
 // No rectangle cap: exact surveyed installed ring preserves connected open notch.
 add(openTopPrism(shape(spec.nativeRing),0,6.55),'brick');
 add(upwardRoofPlane(shape(spec.nativeRing),6.55),'slate');
 for(const r of spec.roofs){
  const at=(x:number,z:number)=>r.plane[0]*x+r.plane[1]*z+r.plane[2];
  const roof=upwardRoofPlane(shape(r.ring,r.holes),0),p=roof.getAttribute('position');for(let i=0;i<p.count;i++)p.setY(i,at(p.getX(i),p.getZ(i)));roof.computeVertexNormals();add(roof,'slate');
  // Open-top support shell is bounded to this exact clipped roof polygon. Each
  // roof owns its top; no whole-parent wall at17/19.2m and no downward cap.
  const walls=openTopPrism(shape(r.ring,r.holes),0,1),v=walls.getAttribute('position');for(let i=0;i<v.count;i++)if(v.getY(i)>.5)v.setY(i,at(v.getX(i),v.getZ(i)));walls.computeVertexNormals();add(walls,r.surface===102?'dark':'brick');
 }
 const a=spec.nativeRing[1],q=spec.nativeRing[2],L=Math.hypot(q[0]-a[0],q[1]-a[1]),t=[(q[0]-a[0])/L,(q[1]-a[1])/L],n=[-t[1],t[0]],angle=Math.atan2(-t[1],t[0]);
 const panel=(u:number,y:number,w:number,h:number,d:number,c:C,out=.12)=>add(new T.BoxGeometry(w,h,d),c,a[0]+t[0]*u+n[0]*out,y+h/2,a[1]+t[1]*u+n[1]*out,angle);
 const probe=(label:string,u:number,y:number,out:number,kind:string)=>openingProbes.push({label,point:[a[0]+t[0]*u+n[0]*out,y,a[1]+t[1]*u+n[1]*out],normal:[n[0],0,n[1]],kind});
 function window(label:string,u:number,y:number,w:number,h:number,split=0){
  panel(u,y,w,h,.05,'glass',.14);
  for(const k of[-1,1])panel(u+k*(w/2-.055),y,.11,h,.10,'white',.20);
  for(const yy of[y,y+h-.10])panel(u,yy,w,.10,.10,'white',.20);
  for(let k=1;k<=split;k++)panel(u-w/2+w*k/(split+1),y,.075,h,.10,'white',.21);
  panel(u,y-.07,w+.24,.13,.27,'white',.23);
  for(const f of [.18,.42,.72,.88])probe(`${label}-${f}`,u+(f-.5)*w,y+h*.57,.18,'glass');
 }
 panel(L/2,0,L,5.48,.11,'dark',.07);
 panel(L/2,5.44,L,.12,.22,'dark',.17);
 // Two independently observed stacked apertures, uneven intergroup gaps.
 const centers=[2.1,4.0,6.8,9.05,11.15,13.2,15.35,18.25,20.4,22.65,25.35,28.1,31.15,33.65,35.9];
 for(let i=0;i<centers.length;i++){
  window(`upper-tall-${i}`,centers[i],6.32,1.42,1.74,i===10||i===12?1:0);
  window(`upper-short-${i}`,centers[i],8.27,1.42,1.05);
 }
 // Attic band has alternating small glass and brick-colored metal louvers.
 panel(L/2,10.77,L,.09,.14,'white',.15);
 for(let i=0;i<18;i++){
  const u=.95+i*(L-1.9)/17;
  if(i%2===0){window(`attic-${i}`,u,11.02,.93,.85);}
  else {panel(u,11.02,.93,.85,.07,'louver',.16);for(let y=11.06;y<11.85;y+=.17)panel(u,y,.93,.035,.10,'brick',.20);probe(`louver-${i}`,u,11.45,.24,'louver');}
 }
 panel(L/2,12.05,L,.25,.34,'white',.18);
 panel(L/2,12.40,L,.16,.28,'white',.17);
 // Full observed minimum lower inventory, SE→NW. Door/glazing groups differ.
 const lower=[{u:2.4,w:1.52},{u:8.6,w:1.60},{u:11.9,w:1.62},{u:15.0,w:1.6},{u:18.6,w:3.05},{u:25.0,w:2.58},{u:28.1,w:2.58},{u:31.65,w:1.64},{u:35.3,w:3.15}];
 for(let i=0;i<lower.length;i++){const k=lower[i],split=k.w>2?2:1;window(`ground-${i}`,k.u,1.17,k.w,2.54,split);window(`ground-transom-${i}`,k.u,3.87,k.w,1.1,k.w>2?2:0);}
 // Separate SE restaurant-side plain narrow doorway and source-position hostel door.
 window('restaurant-side-door',5.0,.12,.92,3.5,0);window('restaurant-side-door-transom',5.0,3.87,.92,1.1,0);
 for(const u of[21.60,23.20])panel(u,.10,.15,3.57,.16,'white',.22);panel(22.4,3.46,1.68,.21,.16,'white',.22);window('hostel-entrance',22.4,.17,1.35,3.27,1);window('hostel-entrance-transom',22.4,3.87,2.45,1.1,2);
 panel(22.4,3.51,2.55,.30,.55,'white',.34);panel(22.4,.02,1.9,.12,.85,'slate',.40);
 // Actual projecting yellow HOTEL sign, source serif approximation on both
 // sides of its vertical blade, attached to facade around27m fromSE end.
 const signU=27.1,base=5.75,signHeight=5.25;
 panel(signU,base,.13,signHeight,1.72,'yellow',1.0);
 function glyph(ch:string,width:number,height:number){const path=new T.ShapePath();for(const c of (letters.glyphs as Record<string,(number|string)[][]>)[ch]){const v=c.slice(1) as number[];if(c[0]==='M')path.moveTo(v[0],v[1]);else if(c[0]==='L')path.lineTo(v[0],v[1]);else if(c[0]==='Q')path.quadraticCurveTo(v[0],v[1],v[2],v[3]);else if(c[0]==='C')path.bezierCurveTo(v[0],v[1],v[2],v[3],v[4],v[5]);else path.currentPath.closePath();}const g=new T.ShapeGeometry(path.toShapes(false),2);g.computeBoundingBox();const bb=g.boundingBox!,size=bb.getSize(new T.Vector3());g.translate(-(bb.min.x+bb.max.x)/2,-bb.min.y,0);g.scale(width/size.x,height/size.y,1);return g;}
 for(let i=0;i<5;i++)for(const side of[-1,1]){const yaw=angle+side*Math.PI/2;const g=glyph('HOTEL'[i],1.35,.76);g.rotateY(yaw);g.translate(a[0]+t[0]*(signU+side*.071)+n[0]*1.0,base+(4-i)*1.04+.13,a[1]+t[1]*(signU+side*.071)+n[1]*1.0);add(g,'dark');}
 // Actual wall fascia retained as modest serif real signage, not map identity.
 panel(20.0,5.7,6.8,.54,.1,'dark',.17);
 const text='HANSBRINKER HOTEL';let start=16.78;for(const ch of text){if(ch===' '){start+=.24;continue;}const w=ch==='I'?.13:.32,g=glyph(ch,w,.29);g.rotateY(angle);g.translate(a[0]+t[0]*(start+w/2)+n[0]*.231,5.82,a[1]+t[1]*(start+w/2)+n[1]*.231);add(g,'white');start+=w+.07;}
 // Observed pale narrow downpipes distinguish source bays, no invented balconies.
 for(const u of[10.15,24.0])panel(u,.1,.08,11.93,.09,'white',.22);
}
