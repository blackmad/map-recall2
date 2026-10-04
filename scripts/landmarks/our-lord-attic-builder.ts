import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import source from './our-lord-attic-footprints.json';
import {openTopPrism} from './house-geometry';
type Colour=Parameters<BuildingTools['add']>[1];
export function ourLordPoint(p:number[]){const h=source.authorHeadingDegrees*Math.PI/180,e=(p[0]-source.anchor[0])*111320*Math.cos(source.anchor[1]*Math.PI/180),n=(p[1]-source.anchor[1])*110540;return new T.Vector2(e*Math.sin(h)+n*Math.cos(h),e*Math.cos(h)-n*Math.sin(h));}
/** Original native-scale house and separate entrance: the passage is below the open alley. */
export function buildOurLordAttic(_w:number,_d:number,b:BuildingTools){
 const polygons=source.buildings.map(f=>f.geometry.coordinates.map(p=>p.map(r=>r.slice(0,-1).map(ourLordPoint))));
 function mesh(v:number[],c:Colour){if(!v.length)return;const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();b.add(g,c);}
 function clip(r:T.Vector2[],cut:number,left:boolean){const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const a=r[i],q=r[(i+1)%r.length],inside=left?a.x<=cut:a.x>=cut,next=left?q.x<=cut:q.x>=cut;if(inside)out.push(a);if(inside!==next)out.push(a.clone().lerp(q,(cut-a.x)/(q.x-a.x)));}return out;}
 function roof(poly:T.Vector2[][],eave:number,modern:boolean){
  const shape=new T.Shape(poly[0]);shape.holes=poly.slice(1).map(r=>new T.Path(r));b.add(openTopPrism(shape,0,eave),modern?'greyBrick':'brick');
  const g=new T.ShapeGeometry(shape),p=g.getAttribute('position'),ix=g.index!;
  const height=(x:number)=>eave+(modern?Math.max(0,2.8-Math.abs(x-7.14)*.84):Math.max(0,5.8-Math.abs(x+2.2)*1.81,4.2-Math.abs(x+8.1)*1.65));
  const cuts=modern?[-Infinity,7.14,Infinity]:[-Infinity,-10.65,-8.1,-5.55,-5.31,-5.4,-2.2,Infinity];cuts.sort((a,c)=>a-c);
  for(let i=0;i<ix.count;i+=3){const triangle=[0,1,2].map(j=>new T.Vector2(p.getX(ix.getX(i+j)),p.getY(ix.getX(i+j))));for(let k=1;k<cuts.length;k++){const q=clip(clip(triangle,cuts[k-1],false),cuts[k],true);for(let j=1;j<q.length-1;j++){
   // The +Y normal owns the entire roof; wall shells have no overlapping caps.
   const a=q[0],c=q[j],d=q[j+1],cross=(c.x-a.x)*(d.y-a.y)-(c.y-a.y)*(d.x-a.x);mesh((cross<0?[a,c,d]:[a,d,c]).flatMap(v=>[v.x,height(v.x),v.y]),modern?'red':'slate');}}
  }
  // Gable/valley reveals follow the same exact source boundary.
  for(const ring of poly)for(let i=0;i<ring.length;i++){const a=ring[i],q=ring[(i+1)%ring.length],ts=[0,1,...cuts.filter(x=>x>Math.min(a.x,q.x)&&x<Math.max(a.x,q.x)).map(x=>(x-a.x)/(q.x-a.x))].sort((a,c)=>a-c);for(let j=1;j<ts.length;j++){const c=a.clone().lerp(q,ts[j-1]),d=a.clone().lerp(q,ts[j]);mesh([c.x,eave,c.y,d.x,eave,d.y,d.x,height(d.x),d.y,c.x,eave,c.y,d.x,height(d.x),d.y,c.x,height(c.x),c.y],modern?'red':'brick');}}
  g.dispose();
 }
 function offset(p:T.Vector2,a:number,d:number,u=0){return new T.Vector2(p.x+Math.sin(a)*d+Math.cos(a)*u,p.y+Math.cos(a)*d-Math.sin(a)*u);}
 function pane(p:T.Vector2,y:number,w:number,h:number,a=0,modern=false){
  b.box(p.x,y,p.y,w+.18,h+.16,.07,modern?'dark':'white',a);const q=offset(p,a,.09);b.box(q.x,y+.08,q.y,w,h,.045,'glass',a);
  if(!modern){for(const u of [-w/2,0,w/2]){const q=offset(p,a,.145,u);b.box(q.x,y+.06,q.y,.06,h+.03,.07,'white',a);}for(let v=.65;v<h;v+=.7){const q=offset(p,a,.145);b.box(q.x,y+v,q.y,w,.055,.07,'white',a);}}
  const sill=offset(p,a,.1);b.box(sill.x,y-.08,sill.y,w+.3,.10,.2,modern?'dark':'stone',a);
 }
 function edgeWindows(poly:T.Vector2[][],modern:boolean){for(const r of poly){const area=r.reduce((s,p,i)=>s+p.x*r[(i+1)%r.length].y-r[(i+1)%r.length].x*p.y,0);for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],v=q.clone().sub(p),len=v.length();if(len<3)continue;v.normalize();const n=new T.Vector2(v.y,-v.x).multiplyScalar(area>0?1:-1),a=Math.atan2(n.x,n.y);if(n.y>.8)continue;const count=Math.max(1,Math.floor(len/3));for(let j=0;j<count;j++){const c=p.clone().addScaledVector(v,len*(j+.5)/count).addScaledVector(n,.045);for(const y of [1.5,5.1,8.7,12.2])pane(c,y,Math.min(1.35,len/count*.5),y>12?1.45:2.4,a,modern);}}}}
 for(let i=0;i<polygons.length;i++)for(const poly of polygons[i]){roof(poly,i?14.8:14,!!i);edgeWindows(poly,!!i);}
 // Historic main house: every detail derives from its actual slightly angled canal edge.
 const r=polygons[0][0][0],p=r[5],q=r[6],v=q.clone().sub(p),length=v.length();v.normalize();const n=new T.Vector2(-v.y,v.x),a=Math.atan2(n.x,n.y),centre=p.clone().lerp(q,.5).addScaledVector(n,.055);
 const front=(u:number,d=.0)=>offset(centre,a,d,u);
 for(const y of [4.7,8.05,11.35])for(const u of [-2.3,-.77,.77,2.3])pane(front(u),y,1.03,2.45,a);
 // White merchant-house pui, rather than an exterior ecclesiastical invention.
 const pui=front(0,.03);b.box(pui.x,1.6,pui.y,length,2.65,.1,'stone',a);
 for(const u of [-1.3,.25,1.8])pane(front(u,.12),1.75,1.16,2.20,a);
 const door=front(-2.5,.18);b.box(door.x,1.55,door.y,1.02,2.75,.08,'dark',a);
 for(const y of [1.4,4.45,7.5,10.85,13.95]){const c=front(0,.08);b.box(c.x,y,c.y,length+.10,.16,.24,'stone',a);}
 for(const u of [-1.25,1.25])pane(front(u,.13),14.35,1.12,1.6,a);pane(front(0,.13),16.6,.88,1.25,a);
 // Shoulder scrolls and lifting beam on the plain triangular neck gable.
 for(const s of [-1,1]){const c=front(s*2.95,.16);b.add(new T.TorusGeometry(.32,.105,5,12),'stone',c.x,14.28,c.y,a);b.box(c.x,14.0,c.y,.72,.12,.25,'stone',a);}
 for(const side of [-1,1]){const lo=front(side*length*.48,.09),hi=front(0,.09),delta=new T.Vector3(hi.x-lo.x,5.65,hi.y-lo.y),g=new T.CylinderGeometry(.065,.065,delta.length(),5);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));b.add(g,'stone',(lo.x+hi.x)/2,16.85,(lo.y+hi.y)/2);}
 const cap=front(0,.07);b.box(cap.x,19.68,cap.y,1.05,.17,.36,'stone',a);const beam=front(0,.43);b.box(beam.x,18.98,beam.y,.22,.24,1.02,'dark',a);
 for(let j=0;j<8;j++){const c=front(-2.5,.25+(8-j)*.26);b.box(c.x,j*.19,c.y,1.25,.19,.33,'stone',a);}
 for(const u of [-1.5,.5,2.15])pane(front(u),.20,.8,.75,a);
 // Three modern bays, ungridded glazing and orange/red brick lintels.
 const mr=polygons[1][0][0],mp=mr[5],mq=mr[8],mv=mq.clone().sub(mp),ml=mv.length();mv.normalize();const mn=new T.Vector2(-mv.y,mv.x),ma=Math.atan2(mn.x,mn.y),mc=mp.clone().lerp(mq,.5).addScaledVector(mn,.05),mf=(u:number,d=0)=>offset(mc,ma,d,u);
 for(const y of [4.1,7.65,11.1])for(const u of [-2.2,0,2.2]){const c=mf(u);pane(c,y,1.6,2.65,ma,true);const top=mf(u,.07);b.box(top.x,y+2.77,top.y,1.8,.35,.1,'red',ma);}
 pane(mf(0,.01),.08,ml-.32,2.9,ma,true);for(const u of [-ml/2+.15,0,ml/2-.15]){const c=mf(u,.16);b.box(c.x,.1,c.y,.07,2.9,.07,'dark',ma);}
 const band=mf(0,.06);b.box(band.x,3.02,band.y,ml,.8,.13,'red',ma);
 // Actual gold star-like emblem on the entrance panel, no name lettering.
 for(let j=0;j<8;j++){const g=new T.BoxGeometry(.045,.42,.045);g.rotateZ(j*Math.PI/4);b.add(g,'gold',band.x,3.43,band.y+.12,ma);}
 const attic=mf(0,.10);pane(attic,15.05,1.25,1.80,ma,true);
 // Thin glazing lantern sits on the rear pitched roof; dimensions approximate.
 b.box(6.9,16.7,-3.7,1.8,.9,1.4,'glass');b.box(6.9,17.6,-3.7,1.94,.09,1.54,'frame');
}
