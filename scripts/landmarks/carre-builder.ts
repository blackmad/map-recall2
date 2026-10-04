import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import spec from './carre-spec.json';
import source from './carre-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original Carré exterior: historic circus dome and modern rear stagehouse share one surveyed parent. */
export function buildCarreLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const {add,box,sign}=b,a=spec.surveyed.anchor,h=(90+spec.surveyed.northOffsetDegrees)*Math.PI/180;
 if(id!==spec.id)throw new Error(`No Carré builder for ${id}`);
 const rings=source.parts[0].polygons[0].map(r=>r.slice(0,-1).map(([lng,lat])=>{const e=(lng-a[0])*111320*Math.cos(a[1]*Math.PI/180),n=(lat-a[1])*110540;return new T.Vector2(e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h));}));
 const clip=(r:T.Vector2[],axis:'x'|'y',v:number,more:boolean)=>{const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],pi=more?p[axis]>=v:p[axis]<=v,qi=more?q[axis]>=v:q[axis]<=v;if(pi)out.push(p.clone());if(pi!==qi)out.push(p.clone().lerp(q,(v-p[axis])/(q[axis]-p[axis])));}return out;};
 const region=(x0:number,x1:number,z0:number,z1:number)=>clip(clip(clip(clip(rings[0],'x',x0,true),'x',x1,false),'y',z0,true),'y',z1,false);
 const shape=(r:T.Vector2[])=>new T.Shape(r);
 const body=(r:T.Vector2[],hh:number,c:Colour,base=0)=>{if(r.length<3)return;const g=new T.ExtrudeGeometry(shape(r),{depth:hh-base,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,hh,0);add(g,c);};
 const flat=(r:T.Vector2[],y:number,c:Colour='slate')=>{if(r.length<3)return;const g=new T.ShapeGeometry(shape(r));g.rotateX(-Math.PI/2);g.scale(1,1,-1);const idx=g.getIndex()!;for(let i=0;i<idx.count;i+=3){const n=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,n);}g.computeVertexNormals();add(g,c,0,y,0);};
 const slope=(r:T.Vector2[],z0:number,y0:number,z1:number,y1:number,c:Colour)=>{if(r.length<3)return;const g=new T.ShapeGeometry(shape(r)),pos=g.getAttribute('position');for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getY(i);pos.setXYZ(i,x,y0+(z-z0)/(z1-z0)*(y1-y0),z);}const idx=g.getIndex()!;for(let i=0;i<idx.count;i+=3){const n=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,n);}g.computeVertexNormals();add(g,c);};
 const beam=(p:number[],q:number[],radius:number,c:Colour)=>{const start=new T.Vector3(...p),end=new T.Vector3(...q),d=end.clone().sub(start),g=new T.CylinderGeometry(radius,radius,d.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize()));const m=start.add(end).multiplyScalar(.5);add(g,c,m.x,m.y,m.z);};
 const arch=(x:number,y:number,z:number,w:number,hh:number,c:Colour,angle=0)=>{const r=w/2,sh=new T.Shape();sh.moveTo(-r,0);sh.lineTo(r,0);sh.lineTo(r,hh-r);sh.absarc(0,hh-r,r,0,Math.PI,false);sh.closePath();const g=new T.ShapeGeometry(sh);g.rotateY(angle);add(g,c,x,y,z);};
 const sash=(x:number,y:number,z:number,w:number,hh:number,angle=0,frame:Colour='frame')=>{box(x,y,z,w+.18,hh+.18,.14,frame,angle);const dx=Math.sin(angle),dz=Math.cos(angle);box(x+dx*.10,y+.09,z+dz*.10,w,hh,.07,'glass',angle);box(x+dx*.16,y+.09,z+dz*.16,.045,hh,.04,frame,angle);for(const yy of [y+hh*.35,y+hh*.70])box(x+dx*.16,yy,z+dz*.16,w,.045,.04,frame,angle);box(x,y-.14,z,w+.30,.14,.25,'stone',angle);};
 const triangle=(x:number,y:number,z:number,w:number,rise:number,c:Colour,angle=0)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-w/2,0,0,w/2,0,0,0,rise,0],3));g.computeVertexNormals();g.rotateY(angle);add(g,c,x,y,z);};
 // Actual whole parent has no enclosed mapped courtyard; lower service recesses remain lower volumes.
 const historic=region(-15.08,22.10,-5.62,30.31),northWing=region(-23.65,-15.05,-5.9,-1.69),rehearsal=region(-23.65,-16.55,-25.05,-5.90);
 body(historic,20.04,'white');body(northWing,18.05,'white');flat(northWing,18.16);const serviceLow=region(-23.65,-15.05,-1.69,6.49),serviceNarrow=region(-18.5,-15.05,6.49,15.55);body(serviceLow,8.77,'white');flat(serviceLow,9.01);body(serviceNarrow,10.40,'brick');flat(serviceNarrow,10.44);body(rehearsal,21.10,'white');flat(rehearsal,21.55);
 // Original smooth rectangular cloister dome, pale zinc, with a small flat crown rather than a conical tent.
 const x0=-15.05,x1=22.05,z0=-5.6,z1=30.3,roof:(number[][])[]=[];
 for(let i=0;i<=8;i++){const t=i/8,y=20.1+8.52*Math.sin(t*Math.PI/2),inX=8.55*t,inZ=9.5*t;roof.push([[x0+inX,y,z0+inZ],[x1-inX,y,z0+inZ],[x1-inX,y,z1-inZ],[x0+inX,y,z1-inZ]]);}
 for(let level=0;level<8;level++)for(let side=0;side<4;side++){const next=(side+1)%4,p=roof[level][side],q=roof[level][next],r=roof[level+1][next],s=roof[level+1][side];if(side===2&&level>=4){for(const [lo,hi,c] of [[q[0],-5.7,'frame'],[-5.7,11.2,'glass'],[11.2,p[0],'frame']] as const){const lowerLeft=Math.max(lo,q[0]),lowerRight=Math.min(hi,p[0]),upperLeft=Math.max(lo,r[0]),upperRight=Math.min(hi,s[0]),off=c==='glass'?.025:0,g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([lowerRight,p[1]+off,p[2],upperRight,s[1]+off,s[2],upperLeft,r[1]+off,r[2],lowerRight,p[1]+off,p[2],upperLeft,r[1]+off,r[2],lowerLeft,q[1]+off,q[2]],3));g.computeVertexNormals();add(g,c);}continue;}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([...p,...s,...r,...p,...r,...q],3));g.computeVertexNormals();add(g,'frame');}
 flat([new T.Vector2(x0+8.55,z0+9.5),new T.Vector2(x1-8.55,z0+9.5),new T.Vector2(x1-8.55,z1-9.5),new T.Vector2(x0+8.55,z1-9.5)],28.62,'frame');
 // Sparse zinc standing seams follow the curved surface; no bitmap roof texture.
 for(const x of [-13,-9,-5,-1,3,7,11,15,19])for(let i=0;i<7;i++){const t0=i/8,t1=(i+1)/8;if(x<x0+8.55*t1||x>x1-8.55*t1||(i>=4&&x>=-5.7&&x<=11.2))continue;beam([x,20.14+8.52*Math.sin(t0*Math.PI/2),z1-9.5*t0],[x,20.14+8.52*Math.sin(t1*Math.PI/2),z1-9.5*t1],.018,'stone');}
 // Large glazed roof-foyer opening visible from the river, set over the shallow upper roof slope.
 for(const x of [-5.7,-3.6,-1.5,.6,2.7,4.8,6.9,9,11.2])for(let i=4;i<8;i++){const t0=i/8,t1=(i+1)/8;beam([x,20.15+8.52*Math.sin(t0*Math.PI/2),z1-9.5*t0],[x,20.15+8.52*Math.sin(t1*Math.PI/2),z1-9.5*t1],.038,'frame');}
 // Historic river frontage: rusticated grey lower storey, cream pilasters, deep cornice and central temple-front risalit.
 const cx=3.49,front=30.37;box(cx,0,front,37.12,4.57,.16,'stone');
 for(const y of [4.55,8.88,12.81,18.93]){box(cx,y,front,37.2,.30,.40,'stone');box(cx,y+.27,front+.1,37.36,.14,.50,'white');}
 for(const x of [-13.2,-9.45,-5.7,-1.95,1.8,5.55,9.3,13.05,16.8,20.55]){
  arch(x,.35,front+.15,2.68,3.98,'white');arch(x,.56,front+.18,2.23,3.53,'dark');
  for(const y of [5.35,9.58,14.44]){sash(x,y,front+.10,1.66,y>14?1.52:2.45,0,'stone');box(x,y+2.64,front+.22,2.24,.18,.40,'white');}
  for(const dx of [-1.67,1.67]){box(x+dx,4.65,front+.12,.31,13.84,.30,'white');box(x+dx,18.36,front+.23,.52,.36,.49,'stone');}
 }
 for(const y of [.75,1.45,2.15,2.85,3.55])box(cx,y,front+.25,37.2,.045,.045,'frame');
 body(region(-.58,7.56,30.28,32.13),20.17,'white');flat(region(-.58,7.56,30.28,32.13),20.22,'stone');
 const pediment=32.17;for(const x of [.83,3.49,6.15]){arch(x,.35,pediment+.08,2.11,3.95,'stone');arch(x,.57,pediment+.13,1.77,3.50,'dark');for(const y of [5.35,9.58,14.44])sash(x,y,pediment+.10,1.40,y>14?1.52:2.45,0,'stone');}triangle(cx,20.20,pediment,8.26,2.58,'stone');triangle(cx,20.40,pediment+.07,7.55,2.14,'white');triangle(cx,20.57,pediment+.13,6.9,1.80,'gold');
 // Two colossal portal columns, the central cornice and restrained low-poly allegorical figure in the pediment.
 for(const x of [-.12,7.1]){add(new T.CylinderGeometry(.23,.30,13.0,10),'white',x,11.16,pediment+.06);box(x,4.55,pediment,.70,.42,.52,'stone');box(x,17.62,pediment,.80,.44,.66,'stone');}
 box(cx,18.62,pediment,8.35,.42,.54,'white');box(cx,19.48,pediment,8.75,.27,.68,'stone');
 add(new T.SphereGeometry(.17,6,4),'stone',cx,21.73,pediment+.17);box(cx,20.88,pediment+.18,.40,.69,.24,'red');beam([cx-.22,21.3,pediment+.18],[cx-.58,21.05,pediment+.18],.08,'stone');beam([cx+.22,21.3,pediment+.18],[cx+.52,21.78,pediment+.18],.08,'stone');
 sign('KONINKLIJK',-7.25,12.96,front+.42,.075,'dark');sign('THEATER',14.30,12.96,front+.42,.075,'dark');
 // Individual pale balusters and dentils remain geometry visible at game scale.
 for(let x=-14.6;x<21.5;x+=.69)box(x,18.75,front+.31,.24,.19,.25,'stone');
 for(const x of [-14.0,-12.6,-11.2,-9.8,-8.4,-7,-5.6,-4.2,-2.8,-1.4,8.4,9.8,11.2,12.6,14,15.4,16.8,18.2,19.6,21])box(x,19.53,front,.43,.65,.38,'white');
 // Elevated illuminated CARRÉ crown: current survey gives32.61m including its small pyramidal cap.
 box(3.5,28.58,4.7,10.24,2.46,6.61,'dark');box(3.5,31.0,4.7,10.77,.18,7.11,'frame');
 const crown=[[-1.88,31.18,1.12],[8.88,31.18,1.12],[8.88,31.18,8.27],[-1.88,31.18,8.27]];for(let i=0;i<4;i++){const p=crown[i],q=crown[(i+1)%4],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([...p,3.5,32.61,4.7,...q],3));g.computeVertexNormals();add(g,'frame');}sign('CARRE',3.5,29.29,8.06,.20,'red');
 // Stagehouse is a separate lower flat hall, seven rear brick towers and a higher panelled intermediate box.
 const stage=region(-16.55,22.35,-26.97,-5.61),upper=region(-16.55,22.30,-22.70,-5.61);body(stage,21.11,'brick');flat(stage,21.54);
 body(upper,28.34,'frame',21.11);flat(upper,28.66,'frame');
 const bayCenters=[-14.42,-8.68,-2.94,2.8,8.54,14.28,20.02];for(const x of bayCenters){const rr=region(x-2.02,x+2.02,-28.08,-22.69);body(rr,22.49,'dark');flat(rr,22.55);box(x,18.04,-28.13,3.86,4.27,.11,'glass');for(const dx of [-1.85,-.93,0,.93,1.85])box(x+dx,18.05,-28.20,.055,4.25,.05,'frame');for(const y of [18.80,19.59,20.38,21.17])box(x,y,-28.21,3.9,.055,.05,'frame');}
 // Six projecting partition fins are upper-storey cantilevers, not filled ground-floor rectangles.
 for(const x of [-11.55,-5.81,-.07,5.67,11.41,17.15])box(x,22.56,-24.46,.32,6.10,4.10,'frame');
 for(const x of [-13.2,-9.35,-5.5,-1.65,2.2,6.05,9.9,13.75,17.6,21.1]){box(x,23.11,-22.75,3.25,4.42,.12,'glass');for(const y of [24.2,25.3,26.4,27.5])box(x,y,-22.82,3.28,.05,.04,'frame');}
 // North rehearsal-house windows, rear doors and the genuine low semicircular porter lodge on the south.
 for(const y of [2.4,6.3,10.2,14.1,18.0])for(const z of [-22,-17.5,-13,-8.5])sash(-23.63,y,z,y===10.2?2.6:1.2,2.16,-Math.PI/2,'white');
 for(const x of bayCenters)box(x,.15,-28.18,1.12,2.35,.08,'dark');
 const lodge=region(22.22,28.10,-25.9,-18.2);body(lodge,6.07,'brick');flat(lodge,6.17);for(const a of [-1.1,-.4,.3,1.0]){const x=24.0+4.05*Math.cos(a),z=-21.7+4.05*Math.sin(a);sash(x,1.4,z,.72,2.04,Math.PI/2-a,'white');}
 // South historical side keeps its narrower rhythm under the curved dome.
 for(const z of [-2,2.2,6.4,10.6,14.8,19,23.2,27.4])for(const y of [1.1,5.5,9.7,14.45])sash(22.16,y,z,1.63,y>14?1.58:2.3,Math.PI/2,'stone');
}
