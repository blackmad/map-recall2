import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import specs from './warehouse-theatre-specs.json';
import sources from './warehouse-theatre-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Original surveyed exteriors for shared theatre buildings, never isolated fictitious theatre boxes. */
export function buildWarehouseTheatreLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const {add,box,sign}=b,s=specs.find(v=>v.id===id)!,source=sources.find(v=>v.id===id)!,a=s.surveyed.anchor,h=(90+s.surveyed.northOffsetDegrees)*Math.PI/180;
 const rings=source.parts[0].polygons[0].map(r=>r.slice(0,-1).map(([lng,lat])=>{const e=(lng-a[0])*111320*Math.cos(a[1]*Math.PI/180),n=(lat-a[1])*110540;return new T.Vector2(e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h));}));
 const clip=(r:T.Vector2[],axis:'x'|'y',v:number,more:boolean)=>{const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],pi=more?p[axis]>=v:p[axis]<=v,qi=more?q[axis]>=v:q[axis]<=v;if(pi)out.push(p.clone());if(pi!==qi)out.push(p.clone().lerp(q,(v-p[axis])/(q[axis]-p[axis])));}return out;};
 const region=(x0:number,x1:number,z0:number,z1:number)=>clip(clip(clip(clip(rings[0],'x',x0,true),'x',x1,false),'y',z0,true),'y',z1,false);
 const shape=(r:T.Vector2[])=>new T.Shape(r);
 const body=(r:T.Vector2[],hh:number,c:Colour)=>{if(r.length<3)return;const g=new T.ExtrudeGeometry(shape(r),{depth:hh,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,hh,0);add(g,c);};
 const flat=(r:T.Vector2[],y:number,c:Colour='slate')=>{if(r.length<3)return;const g=new T.ShapeGeometry(shape(r));g.rotateX(-Math.PI/2);g.scale(1,1,-1);const idx=g.getIndex()!;for(let i=0;i<idx.count;i+=3){const n=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,n);}g.computeVertexNormals();add(g,c,0,y,0);};
 const quad=(p:number[][],c:Colour)=>{const ar=[...p[0],...p[1],...p[2],...p[0],...p[2],...p[3]],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(ar,3));g.computeVertexNormals();add(g,c);};
 const slope=(r:T.Vector2[],z0:number,y0:number,z1:number,y1:number,c:Colour)=>{if(r.length<3)return;const g=new T.ShapeGeometry(shape(r)),pos=g.getAttribute('position');for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getY(i);pos.setXYZ(i,x,y0+(z-z0)/(z1-z0)*(y1-y0),z);}const idx=g.getIndex()!;for(let i=0;i<idx.count;i+=3){const n=idx.getX(i);idx.setX(i,idx.getX(i+2));idx.setX(i+2,n);}g.computeVertexNormals();add(g,c);};
 const beam=(p:number[],q:number[],radius:number,c:Colour)=>{const start=new T.Vector3(...p),end=new T.Vector3(...q),d=end.clone().sub(start),g=new T.CylinderGeometry(radius,radius,d.length(),6);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.clone().normalize()));const m=start.add(end).multiplyScalar(.5);add(g,c,m.x,m.y,m.z);};
 const arch=(x:number,y:number,z:number,w:number,hh:number,c:Colour,angle=0)=>{const r=w/2,sh=new T.Shape();sh.moveTo(-r,0);sh.lineTo(r,0);sh.lineTo(r,hh-r);sh.absarc(0,hh-r,r,0,Math.PI,false);sh.closePath();const g=new T.ShapeGeometry(sh);g.rotateY(angle);add(g,c,x,y,z);};
 const sash=(x:number,y:number,z:number,w:number,hh:number,angle=0,frame:Colour='frame')=>{box(x,y,z,w+.18,hh+.18,.14,frame,angle);const dx=Math.sin(angle),dz=Math.cos(angle);box(x+dx*.10,y+.09,z+dz*.10,w,hh,.07,'glass',angle);box(x+dx*.16,y+.09,z+dz*.16,.045,hh,.04,frame,angle);for(const yy of [y+hh*.35,y+hh*.70])box(x+dx*.16,yy,z+dz*.16,w,.045,.04,frame,angle);box(x,y-.14,z,w+.30,.14,.25,'stone',angle);};
 const triangle=(x:number,y:number,z:number,w:number,rise:number,c:Colour,angle=0)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-w/2,0,0,w/2,0,0,0,rise,0],3));g.computeVertexNormals();g.rotateY(angle);add(g,c,x,y,z);};
 if(id==='het-veem'){
  // 60m yellow Oranje Nassau only. The adjacent red Koelit remains its own building.
  body(rings[0],14.75,'gold');body(region(-31,31,-7.4,13.2),17.30,'gold');
  const profile=[[-13.30,14.75],[-7.4,18.22],[-1.5,20.40],[5.2,17.35],[13.2,17.35]];
  for(let i=0;i<profile.length-1;i++){const [z0,y0]=profile[i],[z1,y1]=profile[i+1];slope(region(-31,31,z0,z1),z0,y0,z1,y1,'slate');}
  // Close the end roof profiles with simple original polygons, following the sampled cross-section.
  for(const x of [-29.95,30.0])for(let i=0;i<profile.length-1;i++){const [z0,y0]=profile[i],[z1,y1]=profile[i+1];const ps=[[x,14.73,z0],[x,14.73,z1],[x,y1,z1],[x,y0,z0]];quad(x<0?ps:ps.reverse(),'gold');}
  const front=13.17,rear=-12.13,bay=60/11;
  for(const y of [1.25,4.8,8.35,11.9,15.45]){box(0,y,front,60,.13,.08,'brick');box(0,y,rear,60,.13,.08,'brick');}
  box(0,0,front,60,1.35,.07,'brick');box(0,0,rear,60,1.35,.07,'brick');
  for(let i=0;i<11;i++){const x=-27.27+i*bay,loading=i%2===1;
   for(let floor=0;floor<4;floor++){const y=1.95+floor*3.52;
    if(loading){const whiteLift=i===3||i===7;if(whiteLift)box(x,y-.38,front,2.95,3.65,.18,'white');arch(x,y,front+.16,1.87,2.65,'dark');arch(x,y+.09,front+.18,1.69,2.42,'red');box(x,y+1.25,front+.21,1.76,.045,.04,'frame');box(x,y+.12,front+.23,1.85,.07,.05,'dark');for(const dx of [-.77,-.51,-.25,0,.25,.51,.77])box(x+dx,y+.15,front+.26,.025,.65,.025,'dark');for(const dx of [-1.83,1.83])sash(x+dx,y+.10,front,.52,2.12);}
    else for(const dx of [-1.57,0,1.57])sash(x+dx,y+.10,front,1.05,2.12);
    // Rear windows alternate with loading balconies and their five attic tuitgables.
    if(loading){arch(x,y,rear-.15,1.86,2.65,'dark',Math.PI);box(x,y-.14,rear-.56,2.05,.17,.72,'stone');beam([x-1.0,y-.10,rear-.91],[x+1.0,y-.10,rear-.91],.045,'dark');}
    else for(const dx of [-1.57,0,1.57])sash(x+dx,y+.10,rear,1.05,2.12,Math.PI);
   }
   for(const dx of loading?[-1.45,1.45]:[-1.55,0,1.55])sash(x+dx,.32,front,.78,.71);
   if(loading){box(x,13.52,rear,2.67,3.25,.17,'gold');triangle(x,16.77,rear-.10,2.67,2.14,'gold',Math.PI);arch(x,14.17,rear-.22,1.55,2.61,'dark',Math.PI);box(x,14.1,rear-.76,2.0,.15,1.1,'stone');beam([x,17.32,rear-.7],[x,17.32,rear-1.75],.065,'dark');}
  }
  // Two tall cantilever lift towers and the smaller central hoist box are distinctive front features.
  for(const [x,base,height,z] of [[-10.91,17.25,3.00,11.40],[10.91,17.25,3.00,11.40],[0,13.44,3.15,13.66]]){
   box(x,base,z,3.06,height,2.95,'gold');box(x,base-.16,z,3.32,.16,3.20,'stone');
   for(const dx of [-.83,0,.83]){arch(x+dx,base+.63,z+1.50,.57,1.55,'dark');sash(x+dx,base+.71,z+1.51,.37,1.28);}
   for(const dx of [-1.18,0,1.18])box(x+dx,base+height,z, .55,.40,2.95,'gold');
   for(const dx of [-1.43,1.43])beam([x+dx,base-.07,z+1.48],[x+dx,base-2.24,z-.05],.08,'stone');
  }
  // Semicircular rear stair turrets are within the mapped parent outline.
  for(const [x,z,hh,r] of [[-28.22,-12.49,18.28,1.06],[28.32,-12.65,17.14,1.83]]){
   add(new T.CylinderGeometry(r,r,hh,12),'gold',x,hh/2,z);add(new T.ConeGeometry(r+.07,1.28,12),'slate',x,hh+.64,z);
   for(const y of [1.65,5.18,8.7,12.22,15.70]){sash(x,y,z-r-.03,.55,1.70,Math.PI);box(x,y-.37,z,r*2,.15,.13,'brick');}
  }
  // Sloped rear daylight strips, with light metal divisions rather than a second solid roof.
  for(const x of [-24.0,-17.2,-6.4,4.6,17.0,24.0]){quad([[x-2.0,19.49,-3.82],[x+2.0,19.49,-3.82],[x+2.0,16.53,-10.02],[x-2.0,16.53,-10.02]],'glass');for(const dx of [-2,-1,0,1,2])beam([x+dx,16.57,-10.02],[x+dx,19.53,-3.82],.045,'white');}
  for(const x of [-10.91,0,10.91]){for(let i=0;i<7;i++)box(x,.20*i,front+2.0-i*.25,2.1,.20,.28,'stone');}
  sign('HET VEEM',-25.9,3.0,front+.28,.12,'white');sign('THEATER',20.7,4.48,front+.22,.10,'stone');
 }else if(id==='plein-theater'){
  // White shared housing block, lower theatre side hall and the separate low entrance porches.
  const plans=(source as typeof sources[2]).volumePlans!.map(p=>({name:p.name,height:p.height,ring:p.ring.map(v=>new T.Vector2(v[0],v[1]))}));
  for(const p of plans){body(p.ring,p.height,'white');flat(p.ring,p.height+.04);}
  const housing=plans[0].ring,hall=plans[3].ring;
  const edge=(r:T.Vector2[],axis:'x'|'y',v:number,more=true)=>{const other=axis==='x'?'y':'x',hits:number[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length];if((p[axis]<=v&&q[axis]>=v)||(q[axis]<=v&&p[axis]>=v)){const den=q[axis]-p[axis];if(Math.abs(den)>1e-6)hits.push(p[other]+(q[other]-p[other])*(v-p[axis])/den);}}return more?Math.max(...hits):Math.min(...hits);};
  const frontage=(x:number)=>edge(housing,'x',x)+.13;
  const front=11.65;
  box(-5.6,17.73,front,20.8,.26,.30,'stone');box(-5.6,17.85,-11.96,20.8,.26,.30,'stone');
  for(let floor=0;floor<3;floor++){const y=6.25+floor*3.60;for(const x of [-11.8,-9.2,-5.3,-2.6,.1,2.6])sash(x,y,frontage(x),1.47,1.99,0,'white');for(const x of [-12.9,-9.3,-5.7,-2.1,1.5])sash(x,y,-11.96,1.35,1.99,Math.PI,'white');}
  for(const x of [-9.2,-2.6]){const front=frontage(x);box(x,6.05,front+.42,1.89,.14,.90,'stone');for(const dx of [-.84,-.56,-.28,0,.28,.56,.84])box(x+dx,6.18,front+.85,.028,.68,.03,'dark');box(x,6.85,front+.85,1.78,.04,.04,'dark');}
  for(const x of [-11.8,-8.8,-5.3,-1.6,2.0])sash(x,2.75,frontage(x),2.34,2.14,0,'white');
  box(-4.5,0,15.02,4.82,2.69,.16,'frame');for(const x of [-6.15,-4.55,-2.95])sash(x,.18,15.16,1.38,2.18,0,'white');
  box(-4.55,2.42,15.23,5.0,.29,.22,'dark');sign('EETLOKAAL',-4.55,2.50,15.37,.075,'white');
  // The present small illuminated theatre sign belongs to the low side doorway, not the whole housing façade.
  box(5.0,0,12.35,2.12,2.74,.20,'dark');sash(5.0,.1,12.5,1.63,2.19,0,'white');box(5.0,2.74,12.5,2.41,.54,.35,'dark');sign('PLEIN',5.0,2.98,12.70,.072,'white');sign('THEATER',5.0,2.76,12.70,.056,'white');
  for(const z of [-10,-5,0,5])sash(edge(hall,'y',z)+.12,1.10,z,2.4,2.45,Math.PI/2,'white');
  for(let i=0;i<6;i++)box(-12.0,i*.17,front+1.6-i*.3,1.6,.17,.32,'stone');
  // Low service hall roof and shutters remain behind the plaza frontage.
  for(const z of [-8,-2,4]){const x=edge(hall,'y',z);box(x+.12,1.0,z,.13,2.7,2.5,'frame');box(x+.22,1.15,z,.05,2.42,2.15,'glass');}
 }else if(id==='tobacco-theater'){
  // The tall two-storey street office and lower rear auction rooms share one current BAG parent.
  body(region(-15,16,3.65,11),10.64,'gold');flat(region(-15,16,3.65,11),10.73);
  body(region(-15,16,-12,3.65),6.30,'brick');flat(region(-15,16,-12,3.65),6.40);
  for(const [x,z,w,d,eaves,rise] of [[-9.5,-1.3,7.0,13.1,7.9,2.6],[-3.0,-1.7,6.0,15.0,7.9,2.8],[4.0,-1.6,6.8,14.9,7.1,3.5],[11.2,.2,5.8,10.0,8.0,2.8],[-10.9,6.9,4.3,6.4,10.6,2.65]]){
   const rr=region(x-w/2,x+w/2,z-d/2,z+d/2);body(rr,eaves,'brick');for(const [lo,hi,y0,y1] of [[z-d/2,z,eaves,eaves+rise],[z,z+d/2,eaves+rise,eaves]])slope(region(x-w/2,x+w/2,lo,hi),lo,y0,hi,y1,'slate');
  }
  const front=10.23;
  box(.5,0,front,28.4,1.7,.15,'stone');for(const y of [1.70,5.70,10.1])box(.5,y,front,28.4,.19,.21,'stone');
  for(const x of [-12,-8,-4,0,4,8,12]){
   for(const y of [2.20,6.18]){sash(x,y,front,3.20,3.13,0,'stone');box(x,y,front+.21,3.2,.06,.05,'frame');}
   box(x-1.90,1.70,front,.28,8.55,.31,'gold');box(x-1.90,5.62,front,.33,.30,.36,'stone');
   arch(x,.25,front+.14,1.32,.91,'dark');
  }
  // Carved pale-stone entry surrounds and original iron transom are rebuilt geometrically.
  box(0,0,front+.29,2.66,4.26,.31,'stone');box(0,.17,front+.49,1.83,3.55,.07,'red');
  for(const x of [-.49,.49])for(const y of [.45,1.45,2.45]){box(x,y,front+.54,.77,.76,.05,'dark');add(new T.TorusGeometry(.20,.027,4,10),'frame',x,y+.36,front+.59);}
  arch(0,4.10,front+.49,2.25,1.41,'stone');arch(0,4.18,front+.53,1.93,1.22,'dark');add(new T.TorusGeometry(.32,.047,4,12),'stone',0,4.85,front+.60);
  for(const x of [-1.15,1.15])box(x,.2,front+.56,.19,5.3,.20,'white');
  box(0,3.87,front+.59,2.23,.25,.17,'dark');sign('TOBACCO',0,3.92,front+.70,.063,'white');
  // Projecting blue blade sign is visible along the narrow Nes street.
  box(-2.16,4.02,front+1.03,.14,3.17,1.32,'blue');for(const [i,ch] of [...'TOBACCO'].entries())sign(ch,-2.16,6.78-i*.35,front+1.76,.039,'white');
  for(const x of [-8,8]){box(x,1.73,front+.24,3.26,.82,.22,'dark');for(let i=0;i<4;i++)box(x-1.13+i*.75,1.83,front+.38,.62,.59,.04,i%2?'red':'blue');}
  box(-10.80,12.5,6.7,.83,1.23,.80,'brick');box(-10.80,13.73,6.7,1.0,.18,.96,'stone');
  for(const x of [-11,-7,-3,1,5,9,13])sash(x,2.03,-10.9,1.6,2.65,Math.PI);
 }else throw new Error(`No warehouse theatre builder for ${id}`);
}
