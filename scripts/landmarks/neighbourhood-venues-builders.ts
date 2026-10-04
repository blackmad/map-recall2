import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import specs from './neighbourhood-venues-specs.json';
import sources from './neighbourhood-venues-footprints.json';
type C=Parameters<BuildingTools['add']>[1];
/** Individual cinema/theatre parents; the Timorplein school includes its shared physical wings and open court. */
export function buildNeighbourhoodVenueLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const {box,add,sign}=b,s=specs.find(v=>v.id===id)!,source=sources.find(v=>v.id===id)!,a=s.surveyed.anchor,h=(90+s.surveyed.northOffsetDegrees)*Math.PI/180;
 const rings=source.parts[0].polygons[0].map(r=>r.map(([lng,lat])=>{const e=(lng-a[0])*111320*Math.cos(a[1]*Math.PI/180),n=(lat-a[1])*110540;return new T.Vector2(e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h));}));
 const clip=(r:T.Vector2[],axis:'x'|'y',v:number,more:boolean)=>{const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],pi=more?p[axis]>=v:p[axis]<=v,qi=more?q[axis]>=v:q[axis]<=v;if(pi)out.push(p.clone());if(pi!==qi)out.push(p.clone().lerp(q,(v-p[axis])/(q[axis]-p[axis])));}return out;};
 const region=(x0:number,x1:number,z0:number,z1:number)=>clip(clip(clip(clip(rings[0],'x',x0,true),'x',x1,false),'y',z0,true),'y',z1,false);
 const shape=(rs:T.Vector2[][])=>{const sh=new T.Shape(rs[0]);for(const r of rs.slice(1))sh.holes.push(new T.Path(r));return sh;};
 const body=(rs:T.Vector2[][],hh:number,c:C='brick')=>{if(rs[0].length<3)return;const g=new T.ExtrudeGeometry(shape(rs),{depth:hh,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,hh,0);add(g,c);};
 const plane=(rs:T.Vector2[][],y:number,c:C='slate')=>{if(rs[0].length<3)return;const g=new T.ShapeGeometry(shape(rs));g.rotateX(-Math.PI/2);g.scale(1,1,-1);const idx=g.getIndex()!;for(let i=0;i<idx.count;i+=3){const n=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,n);}g.computeVertexNormals();add(g,c,0,y,0);};
 const sash=(x:number,y:number,z:number,w:number,hh:number,angle=0)=>{box(x,y,z,w+.18,hh+.18,.13,'white',angle);const dx=Math.sin(angle),dz=Math.cos(angle);box(x+dx*.1,y+.09,z+dz*.1,w,hh,.07,'glass',angle);box(x+dx*.15,y+.09,z+dz*.15,.05,hh,.05,'frame',angle);for(const yy of [y+.8,y+hh*.72])box(x+dx*.15,yy,z+dz*.15,w,.05,.05,'frame',angle);box(x,y+hh+.2,z,w+.36,.15,.25,'stone',angle);};
 const arch=(x:number,y:number,z:number,w:number,hh:number,c:C,angle=0)=>{const r=w/2,sh=new T.Shape();sh.moveTo(-r,0);sh.lineTo(r,0);sh.lineTo(r,hh-r);sh.absarc(0,hh-r,r,0,Math.PI,false);sh.closePath();const g=new T.ShapeGeometry(sh);g.rotateY(angle);add(g,c,x,y,z);};
 const tri=(x:number,y:number,z:number,w:number,rise:number,c:C,angle=0)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-w/2,0,0,w/2,0,0,0,rise,0],3));g.computeVertexNormals();g.rotateY(angle);add(g,c,x,y,z);};
 const ownClock=(x:number,y:number,z:number,angle=0)=>{const g=new T.CircleGeometry(.94,16);g.rotateY(angle);add(g,'stone',x,y,z);const dx=Math.sin(angle),dz=Math.cos(angle),ux=Math.cos(angle),uz=-Math.sin(angle);for(let i=0;i<12;i++){const aa=i*Math.PI/6,gg=new T.CircleGeometry(.055,6);gg.rotateY(angle);add(gg,'dark',x+ux*Math.sin(aa)*.72+dx*.05,y+Math.cos(aa)*.72,z+uz*Math.sin(aa)*.72+dz*.05);}box(x+dx*.08,y,z+dz*.08,.045,.63,.045,'dark',angle);box(x+ux*.18+dx*.08,y-.03,z+uz*.18+dz*.08,.42,.05,.045,'dark',angle);};
 if(id==='badhuistheater'){
  // The exact almost-circular 19m outline includes two slightly projecting entrance edges.
  body(rings,3.15);plane(rings,3.16);
  const shell=(top:number,bottom:number,y:number,hh:number,c:C)=>add(new T.CylinderGeometry(top,bottom,hh,8,1,false),'slate',0,y+hh/2,0);
  shell(7.9,9.45,3.15,.65,'slate');add(new T.CylinderGeometry(7.75,7.75,.9,16),'stone',0,4.22,0);
  for(let i=0;i<16;i++){const aa=i*Math.PI/8,x=Math.sin(aa)*7.86,z=Math.cos(aa)*7.86;sash(x,3.92,z,2.45,.48,aa);}
  // Eight bent shingles panels around central chimney, with four segment dormers.
  shell(6.2,7.8,4.7,3.1,'slate');shell(1.45,6.2,7.8,1.15,'slate');
  for(let i=0;i<4;i++){const aa=i*Math.PI/2,x=Math.sin(aa)*5.35,z=Math.cos(aa)*5.35;arch(x,7.72,z,1.65,.85,'stone',aa);arch(x+Math.sin(aa)*.05,7.79,z+Math.cos(aa)*.05,1.42,.68,'glass',aa);}
  add(new T.CylinderGeometry(.76,.76,2.6,8),'brick',0,10.12,0);add(new T.CylinderGeometry(.87,.87,.18,8),'stone',0,11.47,0);box(0,11.56,0,.12,.14,.12,'dark');
  // Repeated small square windows and dark rollaag plinth follow the circumference.
  for(let i=0;i<20;i++){const aa=i*Math.PI/10,x=Math.sin(aa)*9.53,z=Math.cos(aa)*9.53;if(z>7.7&&Math.abs(x)<6)continue;sash(x,1.75,z,1.1,.85,aa);}
  add(new T.CylinderGeometry(9.52,9.52,.23,32,1,true),'dark',0,.12,0);
  for(const x of [-3.25,3.25]){const z=9.66;box(x,.05,z+.04,1.7,2.65,.14,'dark');box(x,2.72,z+.13,2.1,.19,.34,'stone');box(x,-.02,z+.48,1.9,.18,.9,'stone');}
  sign('GEMEENTE BADHUIS',0,3.13,9.8,.11,'stone');sign('BADHUISTHEATER',0,1.37,9.8,.055,'white');
 }else if(id==='cinecenter'){
  // Current 1981 apartment/cinema parent, retaining the irregular rear setback.
  body(rings,17.6);plane(rings,17.63);
  const upper=region(-13,-5,-14,14.9);body([upper],20.55);plane([upper],20.58);
  // Active entrance is on Korte Leidsedwarsstraat: official venue says canal entrance closed.
  const f=(x:number)=>14.63-x*.047;for(let x=-10;x<6;x+=3.25)for(const y of [4.1,7.3,10.5,13.7])sash(x,y,f(x)+.08,2.0,2.15);
  box(-2.1,0,f(-2.1)+.1,16.5,3.5,.18,'white');box(-5.7,.1,f(-5.7)+.2,3.8,3.15,.13,'glass');box(-5.7,.1,f(-5.7)+.28,.09,3.15,.08,'frame');box(-2.1,3.4,f(-2.1)+.48,16.8,.3,1.0,'stone');box(-2.1,3.36,f(-2.1)+1.02,16.8,.055,.065,'pink');sign('CINECENTER',-2.1,3.91,f(-2)+.24,.23,'white');
  for(const x of [-.4,3.4]){box(x,.65,f(x)+.22,2.3,1.8,.12,'dark');box(x,.79,f(x)+.31,1.94,1.5,.045,'gold');}
  // Canal elevation: projecting piers, wide square sashes, shallow glass balconies and pink neon fascia.
  const xx=-12.23;for(let z=-12;z<13;z+=3.5)for(const y of [4.1,7.3,10.5,13.7,17.0])sash(xx-.07,y,z,2.25,2.25,-Math.PI/2);
  for(const z of [-9,-2,5,12]){box(xx-.1,3.5,z,.35,17.05,.48,'brick');for(const y of [9.7,16.1]){box(xx-.6,y,z,1.1,.25,2.55,'dark');box(xx-1.05,y+.25,z,.1,.9,2.5,'glass');}}
  box(xx-.12,0,.5,.2,3.5,27.4,'white');box(xx-.6,3.4,.5,1.15,.28,27.8,'stone');box(xx-1.16,3.39,.5,.06,.055,27.7,'pink');
  // Closed canal doors remain legible as a poster wall instead of a second active glass entrance.
  for(const z of [-9,-3,3,9]){box(xx-.25,.65,z,.13,1.85,2.5,'dark');box(xx-.34,.77,z,.05,1.55,2.15,'blue');}
  for(let z=-11;z<12;z+=4.4)for(const yy of [1,5,9,13])sash(z< -4?12.74:6.95,yy,z,2.3,2.7,Math.PI/2);
 }else if(id==='studiok'){
  // Low internal workshop connectors plus four high street wings; the BAG hole stays entirely open.
  body(rings,8.5);plane(rings,8.53);
  const wings=[region(-39,-21,-27,27),region(-21,39,-27,-14),region(-21,31,6,27),region(17,39,-14,6)];
  for(const r of wings){body([r],18.45);plane([r],18.48);}
  // South Studio/K front: historic arches below gridded upper windows and the 1960s glazing band.
  for(let x=-25;x<29;x+=4.4){arch(x,.55,25.45,2.6,3.35,'stone');arch(x,.68,25.5,2.35,3.12,'glass');for(const yy of [4.4,8.65])sash(x,yy,25.47,2.8,3.25);sash(x,13.4,25.47,3.6,3.8);}
  box(1.0,13.05,25.35,60,.25,.36,'stone');box(1.0,17.83,25.35,60,.62,.48,'stone');
  box(16.9,0,25.51,4.2,3.8,.14,'dark');box(16.9,3.8,25.95,5.2,.32,1.15,'stone');sign('STUDIO K',16.9,4.25,25.65,.11,'white');
  // West school / hostel entrance with classical paired gables, separate from the cinema facade.
  for(let z=-21;z<14;z+=4.35){arch(-37.37,.6,z,2.55,3.3,'white',-Math.PI/2);arch(-37.44,.72,z,2.3,3.05,'glass',-Math.PI/2);for(const yy of [4.4,8.65,13.15])sash(-37.43,yy,z,2.7,3.2,-Math.PI/2);}
  for(const z of [-16,8]){tri(-37.48,18.4,z,10.5,3.4,'brick',-Math.PI/2);for(const dz of [-1.25,0,1.25])sash(-37.55,18.5,z+dz,.82,1.6,-Math.PI/2);b.gableRoof(-31.6,18.45,z,11.5,10.5,3.4,'slate');}
  // Tower at south-west corner, verified from primary photos and 3DBAG27.61m ridge above local terrain.
  const tr=region(-34.65,-28.63,16.1,25.36);body([tr],24.0);plane([tr],24.02);b.hip(-31.64,24.0,19.1,6.0,6.0,3.61,'glass');
  for(const y of [1.0,5.4,9.8])for(const z of [17.8,20.5])sash(-34.75,y,z,1.05,2.1,-Math.PI/2);
  arch(-34.75,15.1,19.1,3.2,3.5,'stone',-Math.PI/2);arch(-34.82,15.22,19.1,2.95,3.24,'glass',-Math.PI/2);ownClock(-34.8,22.18,19.1,-Math.PI/2);ownClock(-31.64,22.18,22.24);
  for(let x=-30;x<33;x+=4.4)for(const yy of [1.0,4.8,8.8,13.0])sash(x,yy,-25.46,2.75,3.1,Math.PI);
  for(let z=-21;z<0;z+=4.4)for(const yy of [1.0,4.8,8.8,13.0])sash(37.37,yy,z,2.75,3.1,Math.PI/2);
  // Windows on the internal court faces; no ground or roof infill in its polygon hole.
  for(const z of [-11,-7])for(const yy of [1.1,4.7,8.5])sash(-18.0,yy,z,2.25,2.7,Math.PI/2);
  for(const x of [-13,-8,-3,2,7])for(const yy of [1.1,4.7])sash(x,yy,-13.42,2.25,2.7);
 }
 else throw new Error(`No neighbourhood venue builder for ${id}`);
}
