import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import specs from './historic-civic-specs.json';
import sources from './historic-civic-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original surveyed heritage exteriors, preserving actual adjoining complexes and open courts. */
export function buildHistoricCivicLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const {add,box}=b,s=specs.find(v=>v.id===id)!,source=sources.find(v=>v.id===id)!,a=s.surveyed.anchor,h=(90+s.surveyed.northOffsetDegrees)*Math.PI/180;
 const rings=source.parts[0].polygons[0].map(r=>r.slice(0,-1).map(([lng,lat])=>{const e=(lng-a[0])*111320*Math.cos(a[1]*Math.PI/180),n=(lat-a[1])*110540;return new T.Vector2(e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h));}));
 const clip=(r:T.Vector2[],axis:'x'|'y',v:number,more:boolean)=>{const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],pi=more?p[axis]>=v:p[axis]<=v,qi=more?q[axis]>=v:q[axis]<=v;if(pi)out.push(p.clone());if(pi!==qi)out.push(p.clone().lerp(q,(v-p[axis])/(q[axis]-p[axis])));}return out;};
 const region=(x0:number,x1:number,z0:number,z1:number)=>clip(clip(clip(clip(rings[0],'x',x0,true),'x',x1,false),'y',z0,true),'y',z1,false);
 const shape=(r:T.Vector2[])=>new T.Shape(r);
 const body=(r:T.Vector2[],hh:number,c:Colour)=>{if(r.length<3)return;const g=new T.ExtrudeGeometry(shape(r),{depth:hh,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,hh,0);add(g,c);};
 const flat=(r:T.Vector2[],y:number,c:Colour='slate')=>{if(r.length<3)return;const g=new T.ShapeGeometry(shape(r));g.rotateX(-Math.PI/2);g.scale(1,1,-1);const idx=g.getIndex()!;for(let i=0;i<idx.count;i+=3){const n=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,n);}g.computeVertexNormals();add(g,c,0,y,0);};
 const slope=(r:T.Vector2[],z0:number,y0:number,z1:number,y1:number,c:Colour)=>{if(r.length<3)return;const g=new T.ShapeGeometry(shape(r)),pos=g.getAttribute('position');for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getY(i);pos.setXYZ(i,x,y0+(z-z0)/(z1-z0)*(y1-y0),z);}const idx=g.getIndex()!;for(let i=0;i<idx.count;i+=3){const n=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,n);}g.computeVertexNormals();add(g,c);};
 const beam=(p:number[],q:number[],radius:number,c:Colour)=>{const start=new T.Vector3(...p),end=new T.Vector3(...q),d=end.clone().sub(start),g=new T.CylinderGeometry(radius,radius,d.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize()));const m=start.add(end).multiplyScalar(.5);add(g,c,m.x,m.y,m.z);};
 const arch=(x:number,y:number,z:number,w:number,hh:number,c:Colour,angle=0)=>{const r=w/2,sh=new T.Shape();sh.moveTo(-r,0);sh.lineTo(r,0);sh.lineTo(r,hh-r);sh.absarc(0,hh-r,r,0,Math.PI,false);sh.closePath();const g=new T.ShapeGeometry(sh);g.rotateY(angle);add(g,c,x,y,z);};
 const sash=(x:number,y:number,z:number,w:number,hh:number,angle=0,frame:Colour='frame')=>{box(x,y,z,w+.18,hh+.18,.14,frame,angle);const dx=Math.sin(angle),dz=Math.cos(angle);box(x+dx*.10,y+.09,z+dz*.10,w,hh,.07,'glass',angle);box(x+dx*.16,y+.09,z+dz*.16,.045,hh,.04,frame,angle);for(const yy of [y+hh*.35,y+hh*.70])box(x+dx*.16,yy,z+dz*.16,w,.045,.04,frame,angle);box(x,y-.14,z,w+.30,.14,.25,'stone',angle);};
 const triangle=(x:number,y:number,z:number,w:number,rise:number,c:Colour,angle=0)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-w/2,0,0,w/2,0,0,0,rise,0],3));g.computeVertexNormals();g.rotateY(angle);add(g,c,x,y,z);};
 const pointed=(x:number,y:number,z:number,w:number,hh:number,c:Colour,angle=0)=>{const r=w/2,sh=new T.Shape();sh.moveTo(-r,0);sh.lineTo(r,0);sh.lineTo(r,hh-r*.95);sh.quadraticCurveTo(r*.64,hh-r*.25,0,hh);sh.quadraticCurveTo(-r*.64,hh-r*.25,-r,hh-r*.95);sh.closePath();const g=new T.ShapeGeometry(sh,6);g.rotateY(angle);add(g,c,x,y,z);};
 const parabola=(x:number,y:number,z:number,w:number,hh:number,c:Colour)=>{const sh=new T.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);for(let i=1;i<=12;i++){const u=w/2-i*w/12;sh.lineTo(u,hh*(1-(u/(w/2))**2));}sh.closePath();add(new T.ShapeGeometry(sh),c,x,y,z);};
 const roofX=(r:T.Vector2[],x0:number,y0:number,x1:number,y1:number)=>{if(r.length<3)return;const g=new T.ShapeGeometry(shape(r)),pos=g.getAttribute('position');for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getY(i);pos.setXYZ(i,x,y0+(x-x0)/(x1-x0)*(y1-y0),z);}const idx=g.getIndex()!;for(let i=0;i<idx.count;i+=3){const n=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,n);}g.computeVertexNormals();add(g,'slate');};
 if(id==='walloon-church'){
  // Actual basilical plan: independent aisles below the nave, polygonal east chancel and a low service arm.
  body(region(-31,-12,-16,-7),4.25,'brick');flat(region(-31,-12,-16,-7),4.28);
  const north=region(-14,-5,-16,19.55),south=region(4.6,13.0,-16.85,19.0),nave=region(-6.8,4.72,-20.6,19.46),apse=region(-6.8,4.72,-25,-19.7);
  body(north,9.75,'brick');roofX(region(-14,-9.0,-16,19.55),-14,9.75,-9,14.15);roofX(region(-9,-5,-16,19.55),-9,14.15,-5,9.75);
  body(south,9.15,'brick');roofX(region(4.6,8.0,-16.85,19),4.6,9.15,8,13.64);roofX(region(8,13,-16.85,19),8,13.64,13,9.15);
  body(nave,13.0,'brick');roofX(region(-6.8,-.7,-20.6,19.46),-6.8,13,-.7,20.08);roofX(region(-.7,4.72,-20.6,19.46),-.7,20.08,4.72,13);
  body(apse,11.65,'brick');for(let i=0;i<apse.length;i++){const p=apse[i],q=apse[(i+1)%apse.length];const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([p.x,11.65,p.y,-.7,19.92,-19.8,q.x,11.65,q.y],3));g.computeVertexNormals();add(g,'slate');}
  // Tall western gable: pale bands, single enormous traceried window and carved projecting doorway.
  const x=-.55,z=19.55;box(x,0,z,11.4,13.1,.22,'brick');triangle(x,13.1,z+.13,11.4,6.98,'brick');
  for(const y of [1.0,3.4,5.65,7.8,10.0,12.1,14.2,16.2]){const w=y<13?11.35:11.35*(20.08-y)/7.0;box(x,y,z+.18,w,.15,.12,'stone');}
  pointed(x,5.75,z+.24,6.25,9.18,'stone');pointed(x,5.97,z+.29,5.84,8.75,'glass');
  for(const dx of [-1.96,0,1.96])box(x+dx,5.96,z+.37,.13,6.25,.10,'stone');
  for(const y of [7.2,8.6,10.0,11.4])box(x,y,z+.37,5.8,.10,.09,'frame');
  for(const dx of [-1.93,1.93]){beam([x+dx,12.0,z+.4],[x,14.65,z+.4],.10,'stone');beam([x+dx,12.0,z+.4],[x+dx,13.20,z+.4],.08,'stone');}
  for(const side of [-1,1])beam([x+side*5.69,13.13,z+.3],[x,20.08,z+.3],.14,'stone');
  box(x,20.02,z,1.60,.22,.68,'stone');box(x,20.24,z,1.25,.85,.65,'brick');box(x,21.05,z,1.55,.13,.76,'stone');triangle(x,21.18,z+.40,1.64,.67,'stone');
  pointed(x,17.68,z+.36,1.0,1.03,'stone');pointed(x,17.81,z+.40,.74,.73,'dark');
  body(region(-2.35,1.8,19.4,22.65),5.4,'stone');flat(region(-2.35,1.8,19.4,22.65),5.50,'stone');
  const porch=22.68;box(-.28,0,porch,2.0,3.13,.14,'dark');pointed(-.28,3.0,porch+.09,2.0,1.14,'stone');pointed(-.28,3.1,porch+.14,1.65,.89,'glass');
  for(const dx of [-1.72,1.72]){box(-.28+dx,0,porch,.26,5.2,.30,'white');box(-.28+dx,4.8,porch,.45,.30,.39,'stone');}
  box(-.28,5.18,porch,4.18,.20,.35,'stone');triangle(-.28,5.38,porch+.18,4.12,1.08,'stone');triangle(-.28,5.49,porch+.21,3.65,.77,'brick');
  for(const dx of [-.55,.55])add(new T.TorusGeometry(.27,.055,4,12),'stone',-.28+dx,4.62,porch+.21);
  for(const xx of [-8.85,8.15]){triangle(xx,9.4,z,6.6,4.45,'brick');pointed(xx,1.7,z+.14,1.2,3.2,'stone');pointed(xx,1.86,z+.18,.95,2.85,'glass');}
  for(const zz of [-11,-6.85,-2.65,1.6,5.8,10,14.1])for(const [xx,angle] of [[11.34,Math.PI/2],[-11.98,-Math.PI/2]]){pointed(xx,3.25,zz,1.9,4.82,'stone',angle);pointed(xx+Math.sin(angle)*.07,3.41,zz,1.61,4.48,'glass',angle);box(xx+Math.sin(angle)*.15,3.4,zz,.07,3.48,1.61,'frame');}
  for(const zz of [-12,-7.5,-3,1.5,6,10.5,15])for(const xx of [-6.8,4.73]){box(xx,13.45,zz,.11,1.52,1.75,'stone');box(xx+Math.sign(xx)*.07,13.56,zz,.07,1.27,1.47,'glass');}
  for(const xx of [-2.8,2.8])pointed(xx,3.0,-23.0,1.17,5.9,'glass',Math.PI);
 }else if(id==='schreierstoren'){
  // Ground ring is D-shaped, not circular; annex and waterside lean-to retain their actual separate roof heights.
  const tower=region(-12,-.28,-4.15,4.68),annex=region(-.28,4.1,-3.15,4.73),low=region(4.1,11,-5.9,4.8),lean=region(-4.2,4.35,-5.9,-3.15);
  body(tower,14.48,'brick');body(annex,10.92,'brick');body(low,2.72,'stone');flat(low,2.79,'slate');body(lean,4.82,'brick');flat(lean,4.91,'slate');
  // Original radial pyramid over the D-ring; 3DBAG apex controls the tall roof, without importing its triangulation.
  const apex=new T.Vector3(-6.08,22.65,.65);for(let i=0;i<tower.length;i++){const p=tower[i],q=tower[(i+1)%tower.length],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([p.x,14.49,p.y,apex.x,apex.y,apex.z,q.x,14.49,q.y],3));g.computeVertexNormals();add(g,'slate');}
  for(const p of [tower[0],tower[6],tower[12],tower[18],tower[tower.length-2]])if(p)beam([p.x,14.52,p.y],[apex.x,22.67,apex.z],.035,'stone');
  // Hipped annex with the documented much lower ridge.
  for(let i=0;i<annex.length;i++){const p=annex[i],q=annex[(i+1)%annex.length],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([p.x,10.93,p.y,1.84,12.92,.74,q.x,10.93,q.y],3));g.computeVertexNormals();add(g,'slate');}
  for(let i=0;i<tower.length;i++){const p=tower[i],q=tower[(i+1)%tower.length],len=p.distanceTo(q);if(len<.45)continue;const m=p.clone().add(q).multiplyScalar(.5),angle=-Math.atan2(q.y-p.y,q.x-p.x);box(m.x,11.95,m.y,len+.03,.20,.12,'stone',angle);}
  // Continuous decorative corbel arcade underneath the late medieval upper parapet.
  for(let t=.28;t<Math.PI*1.66;t+=.24){const xx=-6.2+5.25*Math.cos(t),zz=1.45-5.25*Math.sin(t);if(zz>4.61||xx>-.27)continue;const angle=Math.atan2(Math.cos(t),-Math.sin(t));arch(xx,11.02,zz,.65,.72,'dark',angle);box(xx,11.84,zz,.38,.16,.22,'stone',angle);}
  for(const [xx,zz,ang] of [[-9.8,4.70,0],[-6.55,4.70,0],[-3.2,4.70,0],[-11.46,1.45,-Math.PI/2],[-9.55,-2.77,-2.45],[-6.40,-4.07,Math.PI]]){
   sash(xx,12.23,zz,.66,1.24,ang,'white');for(const y of [2.1,6.1])sash(xx,y,zz,1.27,2.07,ang,'white');
   box(xx+.85*Math.cos(ang),12.75,zz,.28,.13,.06,'dark',ang);
  }
  box(-6.25,.25,4.75,1.22,2.26,.19,'stone');box(-6.25,.37,4.89,.93,1.99,.06,'dark');
  for(const xx of [1.1,3.1])for(const y of [1.75,5.6])sash(xx,y,4.79,1.17,2.12,0,'white');for(const y of [1.9,5.9])sash(4.18,y,.7,1.39,2.26,Math.PI/2,'white');
  for(const xx of [5.3,7.7,9.6])sash(xx,.34,-5.15,1.50,1.79,Math.PI,'white');
  // Thin mast and golden cogship are original geometric ornament, heights visually approximate beyond the surveyed roof.
  beam([-6.08,22.6,.65],[-6.08,24.04,.65],.026,'dark');box(-6.08,23.88,.65,.65,.10,.13,'gold');triangle(-6.13,24.01,.65,.48,.27,'gold');
 }else if(id==='huize-lydia'){
  // Continuous concave U-shaped parent: no mass or roof across the open courtyard.
  body(rings[0],3.25,'brick');
  const front=region(-26,7.75,7.8,17.35),left=region(-26,-16.1,-9,17.4),right=region(9.8,19.4,-17.5,17.4),corner=region(7.65,20.3,8.9,21.9),service=region(19.4,24,-18,-7.45);
  for(const r of [front,left,right]){body(r,19.86,'brick');flat(r,19.94);}
  body(corner,23.06,'brick');flat(corner,23.11);body(service,5.64,'brick');flat(service,5.73);
  // Tall black tile roof along Coenenstraat; narrow lead-clad parabolic roof turret.
  roofX(region(-25.45,-20.5,-8.75,10.5),-25.45,19.9,-20.5,24.62);roofX(region(-20.5,-16.1,-8.75,10.5),-20.5,24.62,-16.1,19.9);
  for(const zz of [-8.4,10.1]){triangle(-20.6,19.85,zz,8.9,4.77,'brick',zz<0?Math.PI:0);}
  slope(region(-22.7,7.76,14.45,17.35),14.45,20.68,17.35,19.96,'slate');
  add(new T.CylinderGeometry(.59,.74,3.07,10),'slate',-17.73,21.93,-7.53);add(new T.SphereGeometry(.78,10,5,0,Math.PI*2,0,Math.PI/2),'slate',-17.73,23.59,-7.53);beam([-17.73,23.69,-7.53],[-17.73,25.05,-7.53],.045,'dark');add(new T.SphereGeometry(.16,6,4),'stone',-17.73,25.05,-7.53);
  const z=17.40;for(const y of [5.87,9.36,12.85])for(const x of [-20.0,-16.0,-12.0,-8.0,-4.0,0,4.0])sash(x,y,z,x===-20?1.19:2.75,1.72,0,'white');
  for(const x of [-19.8,-17.0,-14.2,-11.4,-8.6,-5.8,-3,-.2,2.6,5.4])sash(x,18.15,z,2.27,.92,0,'white');
  box(-7.5,17.90,z,30.25,.16,.18,'stone');box(-7.5,15.88,z,30.2,.14,.18,'stone');
  // Overhanging stained-glass clerestory above the wide ground-floor conversation-room windows.
  for(const x of [-13,-9,-5,-1,3]){sash(x,1.65,z,3.45,1.95,0,'white');sash(x,3.76,z+.43,3.52,.72,0,'white');box(x,3.54,z+.32,3.71,.15,.85,'stone');}
  parabola(-17.9,2.9,z+.20,3.0,3.55,'stone');parabola(-17.9,3.02,z+.24,2.62,3.27,'glass');for(const dx of [-.79,0,.79])box(-17.9+dx,3.02,z+.30,.065,3.05,.06,'white');box(-17.9,4.19,z+.32,2.45,.07,.05,'white');
  // Rounded upper bay is attached to the real front wall, with pale vertical window fins.
  add(new T.CylinderGeometry(1.68,1.68,6.0,16,1,false,-Math.PI/2,Math.PI),'brick',-20.0,16.00,17.30);flat(region(-22,-18,15.5,17.4),19.96);
  for(let i=0;i<7;i++){const t=-Math.PI/2+(i+.5)*Math.PI/7,xx=-20+1.70*Math.sin(t),zz=17.3+1.70*Math.cos(t);sash(xx,14.3,zz,.52,4.6,t,'white');}
  // Seven-storey corner and projecting three-storey bays, kept within its mapped projections.
  for(const y of [2.0,5.4,8.8,12.2,15.6,19.0])for(const x of [10.25,14.5])sash(x,y,21.04,1.65,1.72,0,'white');
  for(const y of [5.4,8.8,12.2,15.6,19.0])for(const zz of [10.0,14.25,18.5])sash(19.4,y,zz,1.64,1.73,Math.PI/2,'white');
  for(const x of [8.0,16.2]){box(x,11.9,21.01,1.28,7.1,.42,'brick');for(const y of [12.2,15.6,19.0])sash(x,y,21.28,.89,1.71,0,'white');}
  // Recessed entry with two carved stone consoles and exactly eight steps.
  box(5.9,.48,z+.14,1.72,2.83,.18,'stone');box(5.9,.62,z+.28,1.32,2.42,.07,'dark');box(5.9,3.28,z+.68,2.53,.28,1.10,'brick');
  for(const dx of [-.92,.92]){box(5.9+dx,2.81,z+.75,.31,.46,.31,'stone');triangle(5.9+dx,2.84,z+.93,.33,.31,'stone');}
  for(let i=0;i<8;i++)box(5.9,i*.08,z+1.91-i*.21,1.76,.08,.24,'stone');
  // Side streets and courtyard retain light-framed window rhythms without a roof spanning the central garden.
  for(const zz of [-6,-2,2,6,10,14])for(const y of [2.4,5.9,9.4,12.9,16.4]){sash(-24.8,y,zz,1.80,1.72,-Math.PI/2,'white');sash(19.4,y,zz,1.72,1.72,Math.PI/2,'white');}
  for(const xx of [-12,-8,-4,0,4])for(const y of [5.4,8.9,12.4,15.9])sash(xx,y,8.10,1.64,1.76,Math.PI,'white');
  for(const zz of [-5,0,5])for(const y of [5.4,8.9,12.4,15.9]){sash(-16.05,y,zz,1.64,1.76,Math.PI/2,'white');sash(9.85,y,zz,1.64,1.76,-Math.PI/2,'white');}
 }else throw new Error(`No historic civic builder for ${id}`);
}
