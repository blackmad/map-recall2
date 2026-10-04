import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './canal-collection-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Two individually scoped canal-house museums with open rear spaces. */
export function buildCanalCollectionLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const {add,box,sign}=b,s=data.sites.find(s=>s.id===id)!,a=s.authorHeadingDegrees*Math.PI/180;
 const point=(p:number[])=>{const e=(p[0]-s.anchor[0])*111320*Math.cos(s.anchor[1]*Math.PI/180),n=(p[1]-s.anchor[1])*110540;return new T.Vector2(e*Math.sin(a)+n*Math.cos(a),e*Math.cos(a)-n*Math.sin(a));};
 const poly=s.buildings[0].geometry.coordinates[0].map(r=>r.slice(0,-1).map(point));
 function shell(r:T.Vector2[],h:number,c:Colour){const g=new T.ExtrudeGeometry(new T.Shape(r),{depth:h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,h,0);add(g,c);}
 function clip(r:T.Vector2[],value:number,less:boolean,axis:'x'|'y'='x'){const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],pin=less?p[axis]<=value:p[axis]>=value,qin=less?q[axis]<=value:q[axis]>=value;if(pin)out.push(p);if(pin!==qin)out.push(p.clone().lerp(q,(value-p[axis])/(q[axis]-p[axis])));}return out;}
 function roof(r:T.Vector2[],y:number,rise:number){
  // Clip the actual outline at all four hip planes. No sampled triangle fan
  // or bounding rectangle can bridge a facade recess or the rounded bay.
  const xs=r.map(p=>p.x),zs=r.map(p=>p.y),xl=Math.min(...xs),xh=Math.max(...xs),zl=Math.min(...zs),zh=Math.max(...zs),cz=(zl+zh)/2,hz=Math.min((zh-zl)/2,(xh-xl)/2);
  const planes=[(p:T.Vector2)=>p.y-zl,(p:T.Vector2)=>zh-p.y,(p:T.Vector2)=>p.x-xl,(p:T.Vector2)=>xh-p.x];
  function half(r:T.Vector2[],f:(p:T.Vector2)=>number){const out:T.Vector2[]=[];for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],fp=f(p),fq=f(q);if(fp>=-1e-7)out.push(p);if((fp>=0)!==(fq>=0))out.push(p.clone().lerp(q,fp/(fp-fq)));}return out;}
  const vertices:number[]=[];for(let i=0;i<4;i++){let p=r;for(let j=0;j<4;j++)if(i!==j)p=half(p,q=>planes[j](q)-planes[i](q));if(p.length<3)continue;const triangulation=new T.ShapeGeometry(new T.Shape(p)),pos=triangulation.getAttribute('position'),indices=triangulation.index!;for(let k=0;k<indices.count;k++){const q=new T.Vector2(pos.getX(indices.getX(k)),pos.getY(indices.getX(k)));vertices.push(q.x,y+Math.max(0,Math.min(hz,planes[i](q)))*rise/hz,q.y);}triangulation.dispose();}
  for(let k=0;k<r.length;k++){const p=r[k],q=r[(k+1)%r.length],yp=y+Math.max(0,Math.min(hz,...planes.map(f=>f(p))))*rise/hz,yq=y+Math.max(0,Math.min(hz,...planes.map(f=>f(q))))*rise/hz;vertices.push(p.x,y,p.y,q.x,y,q.y,q.x,yq,q.y,p.x,y,p.y,q.x,yq,q.y,p.x,yp,p.y);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();add(g,'slate');
 }
 function pane(x:number,y:number,z:number,w:number,h:number,angle=0,c:Colour='white'){
  const nx=Math.sin(angle),nz=Math.cos(angle);add(new T.PlaneGeometry(w+.24,h+.24),c,x,y+h/2,z,angle);add(new T.PlaneGeometry(w,h),'glass',x+nx*.035,y+h/2,z+nz*.035,angle);add(new T.PlaneGeometry(.075,h),'white',x+nx*.065,y+h/2,z+nz*.065,angle);for(let yy=.8;yy<h;yy+=1.2)add(new T.PlaneGeometry(w,.065),'white',x+nx*.07,y+yy,z+nz*.07,angle);box(x+nx*.08,y-.16,z+nz*.08,w+.4,.18,.35,c,angle);
 }
 function arch(x:number,y:number,z:number,w:number,h:number,angle=0){
  const nx=Math.sin(angle),nz=Math.cos(angle),tx=Math.cos(angle),tz=-Math.sin(angle),sh=new T.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(w/2,h-w/2);sh.absarc(0,h-w/2,w/2,0,Math.PI,false);sh.closePath();add(new T.ShapeGeometry(sh,12),'glass',x,y,z,angle);add(new T.TorusGeometry(w/2+.13,.15,4,12,Math.PI),'white',x+nx*.06,y+h-w/2,z+nz*.06,angle);for(const u of [-w/2-.13,0,w/2+.13])box(x+u*tx+nx*.08,y,z+u*tz+nz*.08,u===0?.08:.25,h-w/2,.18,'white',angle);for(let yy=1.3;yy<h-w/2;yy+=1.3)box(x+nx*.1,y+yy,z+nz*.1,w,.07,.12,'white',angle);for(let k=1;k<6;k++){const t=k*Math.PI/6,dx=Math.cos(t)*w*.25,dy=Math.sin(t)*w*.25;const g=new T.PlaneGeometry(.065,w/2);g.rotateZ(t-Math.PI/2);add(g,'white',x+dx*tx+nx*.12,y+h-w/2+dy,z+dx*tz+nz*.12,angle);}box(x+nx*.08,y-.15,z+nz*.08,w+.45,.18,.35,'white',angle);
 }
 function pediment(x:number,y:number,z:number,w:number,h:number,angle=0){const sh=new T.Shape();sh.moveTo(-w/2,0);sh.lineTo(w/2,0);sh.lineTo(0,h);sh.closePath();add(new T.ShapeGeometry(sh),'brick',x,y,z,angle);const rim=new T.Shape();rim.moveTo(-w/2-.2,0);rim.lineTo(0,h+.2);rim.lineTo(w/2+.2,0);rim.lineTo(w/2-.12,0);rim.lineTo(0,h-.12);rim.lineTo(-w/2+.12,0);rim.closePath();add(new T.ShapeGeometry(rim),'stone',x,y,z+.02*Math.cos(angle),angle);box(x,y,z,w+.35,.2,.34,'stone',angle);}
 function band(r:T.Vector2[],y:number,h:number,c:Colour,depth=.25){for(let i=0;i<r.length;i++){const p=r[i],q=r[(i+1)%r.length],delta=q.clone().sub(p),len=delta.length(),mid=p.clone().add(q).multiplyScalar(.5),angle=-Math.atan2(delta.y,delta.x);box(mid.x,y,mid.y,len,h,depth,c,angle);}}
 function cornice(x:number,y:number,z:number,w:number,angle=0){for(const [dy,hh,dd]of [[0,.18,.28],[.18,.24,.48],[.42,.20,.64]])box(x,y+dy,z,w,hh,dd,'stone',angle);for(let u=-w/2+.2;u<w/2;u+=.45)box(x+u*Math.cos(angle),y-.24,z-u*Math.sin(angle),.15,.30,.3,'stone',angle);}
 function sideWindows(r:T.Vector2[],h:number,skipFront=false){let area=0;for(let k=0;k<r.length;k++)area+=r[k].x*r[(k+1)%r.length].y-r[(k+1)%r.length].x*r[k].y;for(let k=0;k<r.length;k++){const p=r[k],q=r[(k+1)%r.length],v=q.clone().sub(p),len=v.length();if(len<2.4)continue;const tangent=v.clone().normalize(),normal=new T.Vector2(tangent.y,-tangent.x).multiplyScalar(area>0?1:-1),angle=Math.atan2(normal.x,normal.y),count=Math.round(len/3.7);if(skipFront&&normal.y>.75)continue;for(let j=0;j<count;j++){const pt=p.clone().addScaledVector(tangent,len*(j+.5)/count).addScaledVector(normal,.05);for(let y of [1.0,5.0,9.0,13.0].filter(y=>y+2.4<h))pane(pt.x,y,pt.y,Math.min(1.4,len/count*.65),2.35,angle);}}}
 const r=poly[0];
 if(id==='willet-holthuysen'){
  // The front block ends at the measured garden-side wall. Two narrow
  // service wings and the five-sided koepelkamer remain separate projections.
  const main=clip(r,-5.1,false,'y');shell(main,16.8,'brick');roof(main,16.8,3.6);sideWindows(main,16.8,true);
  const back=clip(r,-5.1,true,'y');for(const [lo,hi,h] of [[-8,-5.35,7.2],[-3.05,2.65,7.0],[5.3,8,7.2]]){const p=clip(clip(back,lo,false),hi,true);shell(p,h,'brick');roof(p,h,.75);sideWindows(p,h);}
  const z=12.96;box(.1,0,z,14.2,2.25,.28,'stone');for(const x of [-7.0,7.25])box(x,2.25,z+.10,.42,14.55,.36,'stone');for(const yy of [2.2,6.85,11.55,16.35])box(.1,yy,z+.12,14.9,.22,.4,'stone');cornice(.1,16.5,z+.18,15.0);
  // Five fine sash-window bays and the carved central entrance articulate
  // the broad eighteenth-century facade; the double stoop projects canalward.
  for(const x of [-5.55,-2.75,0,2.75,5.55]){for(const [yy,hh]of [[2.85,3.6],[7.5,3.7],[12.2,2.5]]){if(x===0&&yy===2.85)continue;pane(x,yy,z+.23,1.7,hh);box(x,yy-.25,z+.30,2.15,.16,.28,'stone');if(x!==0){const sh=new T.Shape();sh.moveTo(-.85,0);sh.lineTo(.85,0);sh.lineTo(.65,-.25);sh.lineTo(0,-.45);sh.lineTo(-.65,-.25);sh.closePath();add(new T.ShapeGeometry(sh),'stone',x,yy-.24,z+.43);}}pane(x,.30,z+.22,1.65,1.45,0,'stone');}
  box(0,2.25,z+.23,1.75,3.65,.18,'dark');for(const x of [-1.04,1.04])box(x,2.25,z+.28,.25,4.0,.3,'stone');arch(0,5.83,z+.30,2.0,1.1);pediment(0,6.90,z+.33,2.5,.65);box(0,9.1,z+.35,2.35,.18,.42,'stone');for(const x of [-1.13,1.13])box(x,7.45,z+.35,.17,3.9,.28,'stone');add(new T.IcosahedronGeometry(.32,0),'stone',0,11.48,z+.43);
  box(0,2.25,z+1.0,2.6,.20,1.7,'stone');for(const side of [-1,1]){for(let j=0;j<7;j++)box(side*(1.7+j*.38),2.15-j*.28,z+1.02,.45,.3,1.65,'stone');for(let j=0;j<9;j++){const x=side*(1.1+j*.36),y=2.6-j*.24;box(x,y,z+1.81,.085,.7,.085,'dark');}const g=new T.CylinderGeometry(.05,.05,3.45,5);g.rotateZ(side*-.61);add(g,'dark',side*2.50,2.55,z+1.81);}
  for(const x of [-4.7,4.8]){box(x,17.00,11.45,2.05,2.8,1.2,'white');pane(x,18.45,12.10,1.45,1.1);pediment(x,19.82,12.14,2.35,.55);roof([new T.Vector2(x-1.17,10.65),new T.Vector2(x+1.17,10.65),new T.Vector2(x+1.17,12.15),new T.Vector2(x-1.17,12.15)],19.85,.4);}
  for(const x of [-6.15,6.15])for(const z of [-2.4,10.6]){box(x,17.0,z,.55,3.4,.55,'brick');box(x,20.4,z,.76,.22,.76,'stone');}
 }else{
  // The source is one long canal house, with an actual side courtyard notch.
  // Extrude three portions independently, without roofing over that recess.
  const front=clip(r,3.7,false,'y'),middle=clip(clip(r,-3.2,false,'y'),3.7,true,'y'),rear=clip(r,-3.2,true,'y');for(const [p,h,rise]of [[front,13.4,2],[middle,4.1,.2],[rear,9.4,2.0]] as [T.Vector2[],number,number][]){shell(p,h,'brick');roof(p,h,rise);sideWindows(p,h,p===front);}
  const x=-.80,z=15.64;for(const yy of [2.3,6.3,9.8])for(const u of [-2.4,2.4])pane(x+u,yy,z+.16,2.15,yy===2.3?3.55:2.85,0,'stone');cornice(x,12.94,z+.12,9.4);box(x,13.55,z,9.4,.55,.35,'stone');for(let u=-4.1;u<4.2;u+=.65){box(x+u,13.67,z+.20,.10,.30,.10,'white');}box(x-2.4,2.0,z+.25,2.15,2.75,.15,'dark');pane(x-2.4,4.85,z+.3,2.0,1.05,0,'stone');const oval=new T.TorusGeometry(.45,.09,4,16);oval.scale(.9,1.25,1);add(oval,'gold',x-2.4,5.35,z+.39);for(const u of [-3.62,-1.18])box(x+u,2.05,z+.33,.2,3.8,.3,'stone');box(x-2.4,5.90,z+.35,2.6,.3,.34,'stone');
  // Basement shop, raised museum door and iron stoop rail are permanent,
  // small-scale identifying details rather than a billboard on the roof.
  box(x+2.1,.05,z+.26,2.25,1.95,.17,'dark');pane(x-2.4,.28,z+.22,1.9,1.15,0,'stone');for(let j=0;j<7;j++)box(x-2.4,j*.285,z+2.14-j*.23,2.35,.29,.30,'stone');for(const u of [-3.62,-1.18]){box(x+u,1.92,z+.96,.085,.87,1.9,'dark');for(let j=0;j<5;j++)box(x+u,.75+j*.27,z+2.1-j*.27,.085,.7,.085,'dark');}box(x-2.4,2.28,z+1.85,2.3,.65,.07,'white');sign('PIPE',x-2.4,2.62,z+1.90,.045,'blue');sign('MUSEUM',x-2.4,2.33,z+1.90,.035,'dark');box(x+2.1,1.9,z+.32,2.4,.42,.1,'dark');sign('PIPESHOP',x+2.1,2.02,z+.39,.035,'white');
 }
}
