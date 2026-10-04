import * as T from 'three';
import type {BuildingTools} from './cultural-builders';
import data from './artis-heritage-footprints.json';
type Colour=Parameters<BuildingTools['add']>[1];
/** Two independent ARTIS monuments: exact outlines, permanent architecture only. */
export function buildArtisHeritageLandmark(id:string,_w:number,_d:number,b:BuildingTools){
 const {add,box}=b,s=data.sites.find(s=>s.id===id)!,a=s.authorHeadingDegrees*Math.PI/180;
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
 if(id==='groote-museum'){
  const r=poly[0];shell(r,16.8,'brick');roof(clip(r,4.42,true,'y'),16.8,3.6);const bowCap=new T.ShapeGeometry(new T.Shape(clip(r,4.42,false,'y')));bowCap.rotateX(Math.PI/2);add(bowCap,'slate',0,16.83,0);for(const [y,h] of [[.05,.55],[6.9,.35],[7.5,.25],[14.1,.22],[16.2,.32],[16.65,.25]])band(r,y,h,'stone',y>16?.55:.3);
  // Both long elevations retain their window rhythm. The Artisplein side
  // has the measured semicircular bay rather than an invented rectangular porch.
  for(const side of [1,-1]){const angle=side===1?0:Math.PI,z=side===1?4.43:-9.00;for(const x of [-32.9,-27.9,-22.9,-17.9,-12.9,-8.25,7.7,12.7,17.7,22.7,27.7,32.7]){arch(x,.7,z+side*.12,3.35,5.3,angle);pane(x,9.1,z+side*.14,2.65,4.5,angle);box(x,8.82,z+side*.22,3.1,.32,.38,'white',angle);box(x,13.8,z+side*.2,3.15,.30,.35,'white',angle);box(x,7.95,z+side*.11,1.7,.52,.08,'stone',angle);}
   for(const x of [-35.2,35.15])box(x,.6,z+side*.18,1.2,15.5,.42,'stone',angle);
  }
  // Three curved central openings. Their local normals follow the actual bow.
  const cx=-.57,cz=4.33,radius=5.55;for(const theta of [-.60,0,.60]){const x=cx+Math.sin(theta)*radius,z=cz+Math.cos(theta)*radius;arch(x,.7,z+.04,2.7,5.3,theta);pane(x,9.1,z+.07,2.35,4.5,theta);box(x,13.8,z+.12,2.8,.3,.38,'stone',theta);}
  // The shorter canal-side ends have three upper bays under the hipped roof.
  for(const side of [-1,1])for(const z of [-6.5,-2.1,2.2]){const x=side*35.99,angle=side*Math.PI/2;arch(x+side*.12,.7,z,2.55,5.3,angle);pane(x+side*.15,9.1,z,2.3,4.5,angle);}
 }else{
  const r=poly[0],pavilions=[[-40.1,-34.74],[-15.1,-9.8],[-2.2,2.2],[9.85,15.15],[34.8,40.1]];
  // The five projecting bays are real mapped facade offsets. Higher bays
  // interrupt three low connecting ranges, preserving the permanent roof.
  const cuts=[-40.1,-34.74,-15.1,-9.8,-2.2,2.2,9.85,15.15,34.8,40.1];for(let i=0;i<cuts.length-1;i++){const p=clip(clip(r,cuts[i],false),cuts[i+1],true),high=pavilions.some(([l,h])=>(cuts[i]+cuts[i+1])/2>=l&&(cuts[i]+cuts[i+1])/2<=h);shell(p,high?9.8:8.7,'brick');roof(p,high?9.8:8.7,high?1.0:1.6);band(p,high?9.5:8.4,.24,'stone',.45);}
  for(const side of [1,-1]){const angle=side===1?0:Math.PI;const zAt=(x:number)=>side*4.64-x*.0095+(side===1?.01:-.04);
   // Warm yellow brick infill and cream plaques belong to both elevations.
   const wings=[[-34.7,-15.1],[-9.8,-2.2],[2.2,9.8],[15.1,34.8]];for(const [lo,hi] of wings){const count=hi-lo>10?6:3;for(let k=0;k<count;k++){const x=lo+(hi-lo)*(k+.5)/count,z=zAt(x),ww=(hi-lo)/count-.7;box(x,2.7,z,ww,5.4,.11,'stone',angle);if(k%2===0)pane(x,3.15,z+side*.11,Math.min(2.1,ww-.5),3.15,angle);else{box(x,3.15,z+side*.11,Math.min(2.1,ww-.5),3.15,.055,'gold',angle);for(let yy=3.5;yy<6.3;yy+=.45)box(x,yy,z+side*.15,Math.min(2.1,ww-.5),.055,.04,'stone',angle);}box(x,7.3,z+side*.13,Math.min(2.7,ww),.83,.09,'white',angle);box(x,7.6,z+side*.2,Math.min(1.9,ww*.7),.07,.035,'gold',angle);pane(x,.35,z+side*.16,1.25,1.5,angle,'stone');}
    for(let x=lo+.2;x<hi;x+=(hi-lo)/count)box(x,2.6,zAt(x)+side*.1,.25,6.0,.25,'red',angle);
   }
   for(let i=0;i<pavilions.length;i++){const [lo,hi]=pavilions[i],x=(lo+hi)/2,z=zAt(x)+side*.82;box(x,2.7,z,hi-lo-.5,6.3,.11,'brick',angle);for(const u of [-1,1])box(x+u*(hi-lo-.45)/2,2.7,z+side*.08,.28,6.4,.25,'red',angle);pane(x,3.1,z+side*.13,2.1,i===2?3.8:3.5,angle);pediment(x,6.75,z+side*.18,2.8,.55,angle);if(i!==2){add(new T.CircleGeometry(.83,16),'glass',x,8.0,z+side*.17,angle);add(new T.TorusGeometry(.86,.12,4,16),'stone',x,8.0,z+side*.21,angle);add(new T.TorusGeometry(.50,.065,4,16),'white',x,8.0,z+side*.25,angle);for(let k=0;k<8;k++){const t=k*Math.PI/4,g=new T.PlaneGeometry(.06,.32);g.rotateZ(-t);add(g,'white',x+Math.sin(t)*.66,8+Math.cos(t)*.66,z+side*.26,angle);}}else pane(x,7.4,z+side*.15,2.0,1.45,angle);
    pediment(x,9.30,z+side*.21,hi-lo-.2,.78,angle);box(x,.05,z+side*.12,hi-lo-.1,2.5,.15,'brick',angle);pane(x,.35,z+side*.2,1.7,1.65,angle,'stone');
   }
   // Ground-level stone bands and a toothed cornice are geometric details,
   // not copied masonry textures. No speculative roof solar array is added.
   for(const y of [2.4,2.65])box(0,y,zAt(0),80.0,.16,.2,'stone',angle);for(let x=-39;x<39;x+=.8)box(x,8.12,zAt(x)+side*.10,.18,.20,.22,'stone',angle);
  }
  for(const side of [-1,1])for(const z of [-2.8,0,2.8]){pane(side*40.16,3.1,z,1.6,3.6,side*Math.PI/2);pane(side*40.18,.4,z,1.4,1.6,side*Math.PI/2,'stone');}
 }
}
