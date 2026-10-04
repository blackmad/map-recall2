import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './pinto-tulip-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Individual literary house and actual 1927 tulip-museum building. */
export function buildPintoTulipLandmark(id:string,_w:number,_d:number,b:BuildingTools){
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
 function gable(r:T.Vector2[],h:number,rise:number){const xs=r.map(p=>p.x),lo=Math.min(...xs),hi=Math.max(...xs),mid=(lo+hi)/2,half=(hi-lo)/2,verts:number[]=[];for(const left of [true,false]){const p=clip(r,mid,left);if(p.length<3)continue;const sh=new T.ShapeGeometry(new T.Shape(p)),pos=sh.getAttribute('position'),ix=sh.index!;for(let j=0;j<ix.count;j++){const x=pos.getX(ix.getX(j)),z=pos.getY(ix.getX(j));verts.push(x,h+rise*(1-Math.abs(x-mid)/half),z);}sh.dispose();}for(let j=0;j<r.length;j++){const p=r[j],q=r[(j+1)%r.length],hp=h+rise*(1-Math.abs(p.x-mid)/half),hq=h+rise*(1-Math.abs(q.x-mid)/half);verts.push(p.x,h,p.y,q.x,h,q.y,q.x,hq,q.y,p.x,h,p.y,q.x,hq,q.y,p.x,hp,p.y);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.computeVertexNormals();add(g,'slate');}
 if(id==='huis-de-pinto'){
  const main=clip(r,-2.45,false,'y');shell(main,11.6,'brick');sideWindows(main,11.6,true);for(const [lo,hi,rise]of [[-6,-.3,2.4],[-.3,7.2,2.9]])gable(clip(clip(main,lo,false),hi,true),11.6,rise);
  // The irregular mapped rear wings are lower and do not become a broad
  // roof over the open notches behind the old double house.
  const rear=clip(r,-2.45,true,'y');shell(rear,7.4,'brick');roof(rear,7.4,.8);sideWindows(rear,7.4);
  const cx=.91,z=10.41;box(cx,0,z,12.30,11.7,.32,'white');for(const y of [.15,3.55,7.25,11.45])box(cx,y,z+.18,12.65,.20,.42,'stone');cornice(cx,11.63,z+.24,12.85);
  // Five sandstone bays, six plain pilasters, and marble spandrel panels.
  for(let k=0;k<6;k++)box(cx-6.08+k*2.43,.1,z+.27,.42,11.5,.46,'white');for(let k=0;k<5;k++){const x=cx-4.86+k*2.43;pane(x,.55,z+.40,1.75,2.75);pane(x,4.35,z+.40,1.75,2.25);pane(x,8.3,z+.40,1.75,2.35);for(const y of [3.45,6.98])box(x,y,z+.30,1.95,.90,.10,'stone');for(const y of [4.02,7.94])box(x,y,z+.43,1.95,.14,.22,'white');
   // Original geometric scrollwork recalls the surviving reconstructed iron
   // guards; it uses no sampled image or copied wrought-iron texture.
   if(k!==2)for(const dy of [.95,1.75])for(const dx of [-.48,.48])add(new T.TorusGeometry(.40,.055,4,12),'dark',x+dx,dy,z+.55);if(k!==2)for(const side of [-1,1]){const g=new T.CylinderGeometry(.035,.035,1.85,5);g.rotateZ(side*.43);add(g,'dark',x,.9,z+.57);}else{box(x,.02,z+.51,1.6,2.35,.16,'dark');box(x,2.42,z+.53,1.80,.15,.25,'white');}
  }
  // The closed attic parapet is part of the recognizable street silhouette.
  box(cx,12.18,z+.13,12.80,1.05,.43,'white');for(let k=0;k<6;k++)box(cx-6.08+k*2.43,12.08,z+.33,.45,1.35,.55,'white');for(let k=0;k<5;k++){const x=cx-4.86+k*2.43;box(x,12.40,z+.37,1.78,.56,.10,k===1||k===3?'gold':'frame');if(k===1||k===3)for(let u=-.65;u<.7;u+=.30)add(new T.TorusGeometry(.16,.03,3,8),'white',x+u,12.67,z+.45);}
  for(const x of [-2.80,3.65]){box(x,13.2,7.9,.8,2.0,.8,'white');box(x,15.15,7.9,1.35,.23,1.35,'slate');box(x,15.38,7.9,.26,.57,.26,'stone');}add(new T.TorusGeometry(.65,.14,4,12,Math.PI),'white',-2.8,12.9,10.0);box(cx-1.4,2.66,z+.71,.08,.1,1.18,'dark');box(cx-1.4,2.35,z+1.29,1.72,.45,.08,'dark');sign('HUIS DE PINTO',cx-1.4,2.44,z+1.36,.022,'gold');for(let j=0;j<2;j++)box(cx,.05+j*.15,z+.56-j*.2,1.8,.16,.25,'stone');
 }else{
  shell(r,16.7,'brick');sideWindows(r,16.7,true);const cap=new T.ShapeGeometry(new T.Shape(r));cap.rotateX(Math.PI/2);add(cap,'slate',0,16.75,0);
  const cx=-.43,z=7.40;box(cx,0,z,8.55,3.05,.35,'white');box(cx,3.05,z+.06,8.70,.52,.45,'white');sign('AMSTERDAM TULIP MUSEUM',cx,3.17,z+.33,.058,'dark');
  // Prinsengracht116–118 is one 1927 block: four columns, four upper floors,
  // a straight brick parapet and broad white shopfront, rather than a gable.
  for(const y of [3.94,7.13,10.32,13.51])for(const x of [-3.38,-1.42,.54,2.50]){pane(x,y,z+.12,1.25,2.25,0,'stone');box(x,y+2.49,z+.04,1.45,.075,.09,'red');}
  box(cx,16.55,z,8.65,1.15,.35,'brick');box(cx,17.54,z,8.75,.16,.47,'red');for(let x=-4.65;x<3.85;x+=.40)box(x,17.67,z+.08,.19,.08,.26,'dark');
  for(const x of [-3.78,3.2])box(x,.02,z+.31,.28,3.1,.28,'white');pane(-3.18,.18,z+.34,1.20,2.55,0,'white');box(-3.18,.10,z+.40,.86,1.65,.10,'dark');box(.55,.15,z+.34,4.70,2.70,.09,'glass');for(const x of [-1.8,-.62,.55,1.72,2.90])box(x,.1,z+.42,.075,2.78,.10,'white');for(const y of [.67,1.62,2.58])box(.55,y,z+.42,4.8,.075,.12,'white');box(.55,.06,z+.43,4.8,.42,.14,'white');
  // Small original flower pots echo the museum's own entrance photograph.
  // Petals stay in the established flat palette, with no new raster assets.
  for(const [x,col]of [[-3.5,'red'],[-2.15,'gold'],[2.95,'pink']] as [number,Colour][]){add(new T.CylinderGeometry(.28,.21,.48,7),'stone',x,.24,z+.92);for(let k=0;k<3;k++){const xx=x+(k-1)*.13,yy=.75+k*.12;box(xx,.43,z+.92,.035,yy-.43,.035,'frame');const leaf=new T.ConeGeometry(.075,.40,4);leaf.rotateZ(.55);add(leaf,'frame',xx-.10,.56,z+.92);add(new T.SphereGeometry(.12,6,4),'gold',xx,yy,z+.92);for(let j=0;j<3;j++){const angle=j*Math.PI*2/3,petal=new T.SphereGeometry(.12,5,3);petal.scale(.6,1.2,.8);add(petal,col,xx+Math.cos(angle)*.07,yy+.06,z+.92+Math.sin(angle)*.07);}}}
 }
}
