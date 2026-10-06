import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import {openTopPrism,upwardRoofPlane} from './house-geometry';
import source from './jeruzalemkerk-footprints.json';
/** Original native-scale church ensemble. Historical photos inform assemblies;
 * current BAG controls extent. No reference mesh or photograph pixels used. */
export function buildJeruzalemkerk(_w:number,_d:number,b:BuildingTools){
 type Colour=Parameters<BuildingTools['add']>[1]; const a=source.authorAngleRadians;
 const at=(x:number,z:number)=>[x*Math.cos(a)+z*Math.sin(a),-x*Math.sin(a)+z*Math.cos(a)];
 function add(g:T.BufferGeometry,c:Colour,x=0,y=0,z=0,angle=0){const p=at(x,z);b.add(g,c,p[0],y,p[1],a+angle);}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,c:Colour,angle=0){const p=at(x,z);b.box(p[0],y,p[1],w,h,d,c,a+angle);}
 function shape(rings:number[][][]){const s=new T.Shape(rings[0].map(p=>new T.Vector2(p[0],p[1])));for(const r of rings.slice(1))s.holes.push(new T.Path(r.map(p=>new T.Vector2(p[0],p[1]))));return s;}
 function prism(rings:number[][][],h:number,c:Colour='brick',base=0){const s=shape(rings),wall=openTopPrism(s,base,h),roof=upwardRoofPlane(s,h);wall.userData.role='shell';roof.userData.role='roof';add(wall,c);add(roof,'slate');}
 function mass(x:number,z:number,w:number,d:number,h:number,c:Colour='brick',base=0){prism([[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2]]],h,c,base);}
 // Exact base shell owns all narrow consistory/back corners. No filled parcel.
 prism(source.parts[0].localRings,3.5,'brick');
 // Recessed central church and stepped side entrance / window terraces.
 mass(0,.45,13.3,20.8,14.18);
 for(const s of [-1,1]){mass(s*8.8,-1.5,4.25,12.85,9.9);mass(s*8.04,7.8,2.72,5.85,7.85);}
 // Front high wall and thick low plinth; current photo has an unbroken straight cornice.
 mass(-.05,11.63,12.75,2.7,14.18);box(-.05,14.18,12.97,12.97,.18,.35,'stone');
 box(0,.15,13.22,12.72,3.45,.15,'greyBrick');box(0,3.60,13.29,12.77,.15,.22,'stone');
 for(const s of [-1,1]){box(s*8.0,7.85,10.81,2.88,.15,.32,'stone');box(s*10.94,9.9,-1.5,.24,.16,12.9,'stone');}
 // Front central projecting bay: three narrow stained-glass lights beneath bell tower.
 mass(0,12.90,3.45,.72,14.8,'brick',3.5);
 function window(x:number,y:number,z:number,w:number,h:number,angle=0,trim:Colour='frame'){
  box(x,y-.06,z,w+.17,h+.12,.10,trim,angle);box(x,y,z+.11,w,h,.08,'glass',angle);
  for(let j=.43;j<h;j+=.45)box(x,y+j,z+.18,w,.045,.06,'dark',angle);
 }
 for(const x of [-1.02,0,1.02])window(x,5.05,13.36,.70,5.72);
 for(const x of [-1.53,-.51,.51,1.53])box(x,4.58,13.37,.16,8.1,.35,'brick');
 // Actual lower splayed sills are geometric planes in the wall colour.
 for(const x of [-1.02,0,1.02]){const g=new T.BoxGeometry(.77,.16,.42);g.rotateX(-.32);add(g,'brick',x,4.94,13.39);}
 // Squat stepped tower with physically open louver chambers, not painted black slots.
 mass(0,12.0,3.65,2.20,15.05,'brick',14.18);
 for(const x of [-1.70,0,1.70])box(x,15.05,12.0,.35,2.76,2.0,'brick');
 box(0,15.05,11.12,3.64,2.1,.23,'brick');box(0,17.15,12.0,3.85,.18,2.30,'stone');
 for(const x of [-1.70,0,1.70])box(x,17.33,12.0,.35,.65,2.0,'brick');
 for(const x of [-.85,.85])for(const y of [15.38,15.73,16.08,16.43])box(x,y,12.82,1.28,.10,.28,'dark');
 for(const s of [-1,1])for(let y=12.3;y<13.8;y+=.27)box(s*2.08,y,13.0,.38,.17,.28,'stone');
 // Three equal main doors fitted ahead of the plinth, with no invented lettering.
 for(const x of [-3.33,0,3.33]){box(x,.25,13.37,1.93,2.20,.12,'dark');for(const dx of [-.62,.62])box(x+dx,.32,13.47,.085,2.06,.08,'ochre');box(x,.32,13.47,.10,2.06,.08,'ochre');box(x,2.46,13.47,2.0,.16,.28,'brick');}
 for(let i=0;i<3;i++)box(0,i*.12,13.60+(2-i)*.30,12.6,.12,.3,'stone');
 // Seven tall side lights and square lower lights: each side derived tangent
 // is explicitly turned into the native facade plane, all glass forward of walls.
 for(const s of [-1,1]){
  for(let i=0;i<7;i++){const z=-6.45+i*1.64;
   const xx=s*11.03;box(xx,4.3,z,.10,4.42,1.12,'dark');box(xx+s*.11,4.36,z,.08,4.26,1.04,'glass');
   for(let y=4.7;y<8.6;y+=.43)box(xx+s*.18,y,z,.07,.045,1.04,'dark');
   box(xx+s*.07,1.90,z,.15,1.04,1.13,'stone');box(xx+s*.18,2.0,z,.06,.84,.94,'glass');
   if(i<6)box(s*11.13,3.55,z+.82,.42,6.8,.28,'brick');
  }
  box(s*11.10,1.51,-1.5,.29,.16,12.5,'stone');
  // Narrow triple front-wing glazing and side door beneath flat canopy.
  for(const dx of [-.53,0,.53])window(s*8.04+dx,1.18,10.91,.38,4.45);
  box(s*9.5,.35,6.9,.11,2.35,1.36,'dark');box(s*9.8,2.84,6.9,.88,.17,1.68,'stone');
 }
 // Attached five-storey corner houses follow exact current polygons, not padded rectangles.
 for(const part of source.parts.slice(1)){
  prism(part.localRings,16.35);const ring=part.localRings[0];
  // Actual perimeter tangents keep white-trimmed domestic windows attached.
  for(let i=0;i<ring.length;i++){const p=ring[i],q=ring[(i+1)%ring.length],dx=q[0]-p[0],dz=q[1]-p[1],len=Math.hypot(dx,dz);if(len<5.8)continue;
   const angle=Math.atan2(-dz,dx),nx=dz/len,nz=-dx/len;
   // Ring winding determines outward direction independent of side.
   const area=ring.reduce((v,p,j)=>{const q=ring[(j+1)%ring.length];return v+p[0]*q[1]-q[0]*p[1];},0),out=area>0?1:-1;
   for(const t of [.27,.72])for(const [y,h] of [[.8,2.15],[4.1,1.75],[7.2,1.75],[10.3,1.75],[13.55,1.35]]){
    const x=p[0]+dx*t+nx*out*.14,z=p[1]+dz*t+nz*out*.14;
    box(x,y-.06,z,1.82,h+.12,.12,'white',angle);box(x+nx*out*.12,y,z+nz*out*.12,1.60,h,.08,'glass',angle);
    box(x+nx*out*.18,y+h*.50,z+nz*out*.18,1.63,.065,.06,'white',angle);
   }
  }
 }
 // Brick-footed iron perimeter remains permeable and does not roof the forecourt.
 for(const s of [-1,1]){box(s*12.0,0,1.0,.20,.4,24.0,'greyBrick');for(let z=-11;z<13;z+=.7)box(s*12,.4,z,.055,.75,.055,'dark');box(s*12,1.08,1,.08,.07,24,'dark');}
}
