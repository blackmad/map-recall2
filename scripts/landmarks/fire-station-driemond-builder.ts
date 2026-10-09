import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism} from './house-geometry';
import source from './fire-station-driemond-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original native-scale BAG/2023 AHN5 reconstruction; geometry only, no photographic pixels. */
export function buildFireStationDriemond(_w:number,_d:number,b:BuildingTools){
 for(const r of source.surveyRoofParts){const p=r.rings[0],shape=new T.Shape(p.map(v=>new T.Vector2(v[0],v[2]))),h=Math.min(...p.map(v=>v[1]));b.add(openTopPrism(shape,0,h),r.index===17?'concrete':'brick');
  const out:number[]=[];for(const f of T.ShapeUtils.triangulateShape(p.map(v=>new T.Vector2(v[0],v[2])),[])){const [a,c,d]=f.map(i=>p[i]),n=new T.Vector3().fromArray(c).sub(new T.Vector3().fromArray(a)).cross(new T.Vector3().fromArray(d).sub(new T.Vector3().fromArray(a)));const longest=Math.max(new T.Vector3().fromArray(a).distanceTo(new T.Vector3().fromArray(c)),new T.Vector3().fromArray(c).distanceTo(new T.Vector3().fromArray(d)),new T.Vector3().fromArray(d).distanceTo(new T.Vector3().fromArray(a)));if(Math.abs(n.y)/longest<.002)continue; /* source-rounded sub-2mm roof slivers reverse after compression */out.push(...a,...(n.y<0?d:c),...(n.y<0?c:d));}const roof=new T.BufferGeometry();roof.setAttribute('position',new T.Float32BufferAttribute(out,3));roof.computeVertexNormals();roof.userData={tag:'roof'};b.add(roof,'slate');
  const skirt:number[]=[];for(let i=0;i<p.length;i++){const a=p[i],c=p[(i+1)%p.length];skirt.push(a[0],h,a[2],c[0],h,c[2],...c,a[0],h,a[2],...c,...a)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(skirt,3));g.computeVertexNormals();b.add(g,r.index===17?'concrete':'brick');
 }
 function facade(a:number[],c:number[]){const dx=c[0]-a[0],dz=c[1]-a[1],len=Math.hypot(dx,dz),tx=dx/len,tz=dz/len,nx=-tz,nz=tx,ang=Math.atan2(nx,nz);
  const box=(u:number,y:number,v:number,w:number,h:number,d:number,col:Colour,tag='')=>{const x=a[0]+u*tx+v*nx,z=a[1]+u*tz+v*nz;if(tag){const g=new T.BoxGeometry(w,h,d);g.rotateY(ang);g.translate(x,y+h/2,z);g.userData={tag,aperture:{x,z,y,w,h,angle:ang,nx,nz,tx,tz}};b.add(g,col)}else b.box(x,y,z,w,h,d,col,ang)};
  const glass=(u:number,y:number,w:number,h:number,col:Colour='white')=>{box(u,y,.09,w+.16,h+.16,.09,col);box(u,y+.08,.18,w,h-.08,.055,'glass','pane');box(u,y+.08,.23,.065,h-.08,.07,col);box(u,y+h*.53,.23,w,.06,.07,col)};
  return {box,glass,len,a,c,tx,tz,nx,nz,ang};
 }
 const ring=source.nativeRing,f=facade(ring[3],ring[4]),office=facade(ring[1],ring[2]);
 // Two observed red sectional apparatus doors, five glazed tiers and three columns each.
 f.box(f.len/2,0,.045,f.len,1,.1,'greyBrick');f.box(f.len/2,5.64,.07,f.len,.19,.19,'frame');
 for(const u of[2.65,7.98]){const w=4.1;f.box(u,.03,.08,w+.25,4.68,.11,'dark');f.box(u,.09,.2,w,0.85,.1,'red');f.box(u,0.94,.20,w,3.64,.06,'glass','pane');for(let i=0;i<=5;i++)f.box(u,0.94+i*.728,.27,w,.09,.075,'red');for(const off of[-w/2,-w/6,w/6,w/2])f.box(u+off,0.94,.27,.085,3.72,.08,'red');f.box(u+.9,.31,.27,.62,.08,.06,'stone');}
 // Authentic operator emblem without building-name lettering; shield and simplified flame.
 const sx=f.a[0]+f.tx*f.len/2+f.nx*.25,sz=f.a[1]+f.tz*f.len/2+f.nz*.25;
 function emblem(points:number[][],depth:number,col:Colour,offset:number){const sh=new T.Shape(points.map(p=>new T.Vector2(p[0],p[1]))),g=new T.ExtrudeGeometry(sh,{depth,bevelEnabled:false});g.rotateY(f.ang);g.translate(sx+f.nx*offset,4.88,sz+f.nz*offset);b.add(g,col)}
 emblem([[-.48,.65],[-.4,.12],[0,-.09],[.4,.12],[.48,.65],[0,.83]],.055,'red',0);emblem([[-.25,.49],[-.16,.13],[.12,.13],[.28,.47],[.04,.37],[.08,.73],[-.1,.6],[-.02,.36]],.025,'bronze',.06);
 for(const u of[2.15,8.45]){f.box(u,5.68,.24,.18,.43,.23,'frame');f.box(u,5.72,.37,.16,.29,.05,'stone');}
 // Lower office wing: tall glazing at the south end, upper strip above brick at the north end.
 const full=office.len*.49;office.glass(full/2,.15,full-.22,6.34);for(let i=1;i<4;i++)office.box(i*full/4,.2,.23,.07,6.2,.08,'white');office.box(full/2,1.43,.23,full,.07,.075,'white');office.box(full/2,2.8,.23,full,.07,.075,'white');office.glass(full*.84,.18,.95,2.3);office.glass(full+(office.len-full)/2,4.98,office.len-full-.22,1.5);office.box(office.len/2,6.79,.27,office.len+.35,.23,.65,'stone');
 // Canal-side rear: observed metal vertical ribs, horizontal clerestory and office glazed return.
 const rear=facade(ring[5],ring[0]);rear.box(rear.len/2,0,.045,rear.len,.85,.10,'greyBrick');
 for(let u=.15;u<rear.len;u+=.38)rear.box(u,.85,.065,.035,5.8,.06,'frame');rear.glass(rear.len*.24,4.85,rear.len*.43,.85,'frame');rear.glass(rear.len*.73,.15,1.5,5.6,'white');rear.glass(rear.len*.73+2.25,4.82,3,1,'white');
 // Southern return's cladding and narrow high-level strip are visible in the 2022 panorama.
 const side=facade(ring[4],ring[5]);side.box(side.len/2,0,.04,side.len,.85,.1,'greyBrick');for(let u=.15;u<side.len;u+=.38)side.box(u,.85,.075,.035,5.3,.08,'frame');side.glass(side.len*.58,4.78,side.len*.54,.83,'frame');
}
